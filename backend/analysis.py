"""Point-in-time forecast selection and transparent hourly evaluation.

Business logic is pure Python. No UI, HTTP, external API, or pandas dependency.
"""
from bisect import bisect_right
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
import gzip
import hashlib
import json
import math
from pathlib import Path
import re

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
UTC = timezone.utc
FIRST_DAY = date(2026, 1, 1)
LAST_DAY = date(2026, 1, 31)


class ArchiveError(RuntimeError):
    """A source integrity failure, not an invalid user query."""


def timestamp(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Source timestamps must include a timezone")
    return parsed.astimezone(UTC)


def iso(value):
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_inputs(decision_date, cutoff):
    try:
        day = date.fromisoformat(decision_date)
    except (ValueError, TypeError):
        raise ValueError("Choose a decision date in January 2026") from None
    if not FIRST_DAY <= day <= LAST_DAY:
        raise ValueError("Decision date must be between 1 and 31 January 2026")
    if not isinstance(cutoff, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", cutoff):
        raise ValueError("Decision time must be HH:MM in 24-hour UK time")
    hour, minute = map(int, cutoff.split(":"))
    # January UK local time is GMT (UTC+0). Dates outside January are rejected.
    return day, datetime.combine(day, time(hour, minute), UTC)


class Archive:
    def __init__(self, forecasts, actuals, manifest=None):
        self.manifest = manifest or {}
        by_target = defaultdict(dict)
        for record in forecasts:
            if not numeric(record.get("generation")):
                continue
            target = timestamp(record["startTime"])
            publication = timestamp(record["publishTime"])
            if target.minute != 0 or target.second != 0:
                raise ValueError("WINDFOR cadence changed: expected whole-hour timestamps")
            if publication in by_target[target] and by_target[target][publication] != record["generation"]:
                raise ValueError("Conflicting forecast values for identical target and vintage")
            by_target[target][publication] = record["generation"]
        self.forecasts = {}
        for target, versions in by_target.items():
            publications = sorted(versions)
            self.forecasts[target] = (publications, [versions[p] for p in publications])
        self.actuals = {}
        for record in actuals:
            if record.get("fuelType") != "WIND" or not numeric(record.get("generation")):
                continue
            target = timestamp(record["startTime"])
            published = timestamp(record["publishTime"])
            if target.minute not in (0, 30) or target.second != 0:
                raise ValueError("FUELHH cadence changed: expected half-hour timestamps")
            previous = self.actuals.get(target)
            if previous is None or published > previous[0]:
                self.actuals[target] = (published, record["generation"])
            elif published == previous[0] and record["generation"] != previous[1]:
                raise ValueError("Conflicting outturn values for identical timestamp and revision")

    def select(self, target, cutoff):
        versions = self.forecasts.get(target)
        if versions is None:
            return None, None
        publications, values = versions
        index = bisect_right(publications, cutoff) - 1
        if index < 0:
            return None, None
        return values[index], publications[index]

    def day(self, decision_date, cutoff="09:00"):
        day, decision_time = validate_inputs(decision_date, cutoff)
        delivery = day + timedelta(days=1)
        start = datetime.combine(delivery, time(), UTC)
        rows = []
        for hour in range(24):
            target = start + timedelta(hours=hour)
            forecast, publication = self.select(target, decision_time)
            half_hours = [self.actuals.get(target + timedelta(minutes=offset)) for offset in (0, 30)]
            # Never use one half-hour as a substitute for the whole hour.
            actual = sum(item[1] for item in half_hours) / 2 if all(half_hours) else None
            error = forecast - actual if forecast is not None and actual is not None else None
            rows.append({"start_time": iso(target), "hour": hour, "forecast_mw": forecast,
                         "actual_mw": actual, "error_mw": error,
                         "absolute_error_mw": abs(error) if error is not None else None,
                         "forecast_published_at": iso(publication) if publication else None,
                         "lead_hours": (target - decision_time).total_seconds() / 3600,
                         "forecast_age_hours": (decision_time - publication).total_seconds() / 3600 if publication else None,
                         "actual_half_hours": sum(item is not None for item in half_hours)})
        summary = metrics(rows)
        publications = sorted({row["forecast_published_at"] for row in rows if row["forecast_published_at"]})
        return {"decision_date": day.isoformat(), "decision_time": iso(decision_time), "cutoff": cutoff,
                "delivery_date": delivery.isoformat(), "timezone": "Europe/London", "unit": "MW",
                "resolution_minutes": 60, "series": rows, "summary": summary,
                "publication_range": {"earliest": publications[0] if publications else None,
                                      "latest": publications[-1] if publications else None},
                "warnings": (["Some delivery hours have no forecast available by the selected cutoff."] if summary["forecast_hours"] < 24 else [])
                            + (["Some hourly outturns are incomplete. Missing values are excluded, never replaced with zero."] if summary["actual_hours"] < 24 else [])}

    def month(self, cutoff="09:00"):
        validate_inputs("2026-01-01", cutoff)
        days, all_rows = [], []
        for offset in range(31):
            day = self.day((FIRST_DAY + timedelta(days=offset)).isoformat(), cutoff)
            days.append({"decision_date": day["decision_date"], "delivery_date": day["delivery_date"], **day["summary"]})
            all_rows.extend(day["series"])
        return {"cutoff": cutoff, "decision_date_from": "2026-01-01", "decision_date_to": "2026-01-31",
                "days": days, "summary": metrics(all_rows),
                "note": "Retrospective evaluation of every January decision at the same UK cutoff; not information available at an individual decision."}


def metrics(rows):
    pairs = [row for row in rows if row["error_mw"] is not None]
    forecast = [row["forecast_mw"] for row in rows if row["forecast_mw"] is not None]
    actual = [row["actual_mw"] for row in rows if row["actual_mw"] is not None]
    n = len(pairs)
    errors = [row["error_mw"] for row in pairs]
    mae = sum(abs(e) for e in errors) / n if n else None
    mean_actual = sum(row["actual_mw"] for row in pairs) / n if n else None
    absolute = sorted(abs(e) for e in errors)
    return {"expected_hours": len(rows), "forecast_hours": len(forecast), "actual_hours": len(actual),
            "paired_hours": n, "actual_half_hours": sum(row["actual_half_hours"] for row in rows),
            "forecast_coverage_pct": len(forecast) / len(rows) * 100 if rows else 0,
            "paired_coverage_pct": n / len(rows) * 100 if rows else 0,
            "mae_mw": mae, "rmse_mw": math.sqrt(sum(e * e for e in errors) / n) if n else None,
            "bias_mw": sum(errors) / n if n else None,
            "nmae_pct": mae / mean_actual * 100 if mean_actual and mae is not None else None,
            "max_absolute_error_mw": max(absolute) if n else None,
            "p90_absolute_error_mw": absolute[max(0, math.ceil(0.9 * n) - 1)] if n else None,
            # These totals are omitted on incomplete periods rather than silently
            # passing a partial day/month off as a complete energy estimate.
            "forecast_energy_gwh": sum(forecast) / 1000 if len(forecast) == len(rows) and rows else None,
            "actual_energy_gwh": sum(actual) / 1000 if len(actual) == len(rows) and rows else None,
            "net_error_gwh": sum(errors) / 1000 if n == len(rows) and rows else None}


@lru_cache(maxsize=1)
def get_archive():
    manifest = json.loads((DATA_DIR / "manifest.json").read_text(encoding="utf-8"))
    datasets = {}
    for info in manifest["files"]:
        filename = info["file"]
        if filename not in ("windfor.json.gz", "fuelhh.json.gz"):
            raise ArchiveError("Unexpected archive filename")
        payload = (DATA_DIR / filename).read_bytes()
        if hashlib.sha256(payload).hexdigest() != info["sha256"]:
            raise ArchiveError("Source archive checksum mismatch")
        rows = json.loads(gzip.decompress(payload))
        if len(rows) != info["records"]:
            raise ArchiveError("Source archive row count mismatch")
        datasets[info["dataset"]] = rows
    return Archive(datasets["WINDFOR"], datasets["FUELHH"], manifest)


@lru_cache(maxsize=256)
def day_analysis(day, cutoff):
    return get_archive().day(day, cutoff)


@lru_cache(maxsize=48)
def month_analysis(cutoff):
    return get_archive().month(cutoff)
