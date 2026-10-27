"""Download ONLY the two datasets named in the brief; no credentials required.

Run from the repository root: python scripts/fetch_data.py
The archived raw responses and manifest make the analysis reproducible offline.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import gzip
import hashlib
import json
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets/"


def download(dataset, params):
    url = BASE + dataset + "/stream?" + urlencode(params)
    for attempt in range(3):
        try:
            request = Request(url, headers={"Accept": "application/json", "User-Agent": "Aeris-assignment/1.0"})
            with urlopen(request, timeout=90) as response:
                rows = json.load(response)
            if not isinstance(rows, list):
                raise ValueError("Expected a JSON array from Elexon")
            print(dataset, params, "records:", len(rows), flush=True)
            return rows, {"url": url, "record_count": len(rows)}
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def main():
    jobs = []
    # A seven-day lookback covers forecasts already available at the first cutoff.
    # Overlapping endpoints are intentional; deduplication is by vintage + target.
    start = date(2025, 12, 25)
    while start < date(2026, 2, 1):
        end = min(start + timedelta(days=5), date(2026, 2, 1))
        jobs.append(("WINDFOR", {"publishDateTimeFrom": start.isoformat() + "T00:00:00Z",
                                  "publishDateTimeTo": end.isoformat() + "T00:00:00Z"}))
        start = end
    # Decisions Jan 1--31 imply delivery Jan 2--Feb 1, NOT Jan 1--31.
    start = date(2026, 1, 2)
    while start <= date(2026, 2, 1):
        end = min(start + timedelta(days=4), date(2026, 2, 1))
        jobs.append(("FUELHH", {"settlementDateFrom": str(start), "settlementDateTo": str(end), "fuelType": "WIND"}))
        start = end + timedelta(days=1)
    with ThreadPoolExecutor(max_workers=3) as pool:
        responses = list(pool.map(lambda args: download(*args), jobs))
    groups = {"WINDFOR": {}, "FUELHH": {}}
    requests = []
    for (dataset, _), (rows, info) in zip(jobs, responses):
        requests.append(info)
        for row in rows:
            if dataset == "FUELHH" and row.get("fuelType") != "WIND":
                continue
            key = (row["startTime"], row.get("publishTime", ""))
            existing = groups[dataset].get(key)
            if existing is not None and existing["generation"] != row["generation"]:
                raise ValueError("Conflicting duplicate in source response")
            groups[dataset][key] = row
    DATA.mkdir(exist_ok=True)
    files = []
    for dataset, indexed in groups.items():
        rows = sorted(indexed.values(), key=lambda row: (row["startTime"], row.get("publishTime", "")))
        if not rows:
            raise ValueError("Refusing to save empty dataset " + dataset)
        payload = json.dumps(rows, separators=(",", ":"), sort_keys=True).encode()
        path = DATA / (dataset.lower() + ".json.gz")
        path.write_bytes(gzip.compress(payload, mtime=0))
        files.append({"dataset": dataset, "file": path.name, "records": len(rows),
                      "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                      "start_time_min": min(row["startTime"] for row in rows),
                      "start_time_max": max(row["startTime"] for row in rows),
                      "publish_time_min": min(row.get("publishTime", "") for row in rows),
                      "publish_time_max": max(row.get("publishTime", "") for row in rows)})
    manifest = {"retrieved_at": datetime.now(timezone.utc).isoformat(), "source": "Elexon Insights Solution",
                "decision_date_from": "2026-01-01", "decision_date_to": "2026-01-31",
                "delivery_date_from": "2026-01-02", "delivery_date_to": "2026-02-01",
                "unit": "MW", "files": files, "requests": requests,
                "note": "Source archive, not synthetic data. FUELHH reflects outturn as retrieved, not a historical outturn vintage."}
    (DATA / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(files, indent=2))


if __name__ == "__main__":
    main()
