"""Shared HTTP adapter for Vercel and the local/Docker web server."""
import csv
from http.server import BaseHTTPRequestHandler
import io
import json
import logging
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from backend.analysis import day_analysis, get_archive, month_analysis, validate_inputs

CSV_COLUMNS = ("start_time", "forecast_mw", "actual_mw", "error_mw", "absolute_error_mw",
               "forecast_published_at", "lead_hours", "forecast_age_hours", "actual_half_hours")


def csv_payload(rows):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=CSV_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        query = parse_qs(url.query)
        route = query.get("route", [url.path.removeprefix("/api/")])[0].strip("/")
        if route == "index":
            route = "health"
        day = query.get("date", ["2026-01-15"])[0]
        cutoff = query.get("cutoff", ["09:00"])[0]
        try:
            if route == "health":
                archive = get_archive()
                return self.send_json({"status": "ok", "service": "aeris-python", "source": archive.manifest["source"],
                                       "archive_verified": True, "retrieved_at": archive.manifest["retrieved_at"]})
            if route == "analysis":
                return self.send_json(day_analysis(day, cutoff))
            if route == "accuracy":
                return self.send_json(month_analysis(cutoff))
            if route == "sources":
                return self.send_json(get_archive().manifest)
            if route == "export":
                validate_inputs(day, cutoff)
                rows = day_analysis(day, cutoff)["series"]
                if query.get("scope", ["day"])[0] == "month":
                    from datetime import date, timedelta
                    rows = [dict(row, decision_date=(date(2026, 1, 1) + timedelta(days=i)).isoformat())
                            for i in range(31) for row in day_analysis((date(2026, 1, 1) + timedelta(days=i)).isoformat(), cutoff)["series"]]
                    fields = ("decision_date",) + CSV_COLUMNS
                    output = io.StringIO(newline="")
                    writer = csv.DictWriter(output, fields, extrasaction="ignore")
                    writer.writeheader()
                    writer.writerows(rows)
                    payload = output.getvalue().encode()
                    name = "aeris-january-2026-" + cutoff.replace(":", "") + ".csv"
                else:
                    payload = csv_payload(rows)
                    name = "aeris-" + day + "-" + cutoff.replace(":", "") + ".csv"
                return self.send_bytes(payload, "text/csv; charset=utf-8", attachment=name)
            return self.send_json({"error": "API endpoint not found"}, 404)
        except ValueError as error:
            return self.send_json({"error": str(error)}, 400)
        except Exception:
            logging.exception("Aeris API failed")
            return self.send_json({"error": "The verified archive could not be loaded. Please try again."}, 503)

    def send_json(self, value, status=200):
        return self.send_bytes(json.dumps(value, allow_nan=False, separators=(",", ":")).encode(),
                               "application/json; charset=utf-8", status)

    def send_bytes(self, payload, content_type, status=200, attachment=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "public, max-age=3600" if status == 200 else "no-store")
        if attachment:
            self.send_header("Content-Disposition", 'attachment; filename="' + attachment + '"')
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        self.send_json({"error": "Read-only API; use GET"}, 405)

    do_PUT = do_POST
    do_DELETE = do_POST
