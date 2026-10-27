# Aeris

A point-in-time decision desk for UK national wind forecasts. Built for the January 2026 day-ahead purchasing pilot using only Elexon **WINDFOR** and **FUELHH (WIND)**.

## Review the product

- **Live application:** https://k7m2v9q4.vercel.app/
- **Video:** not recorded yet. The required two-part, unlisted YouTube presentation must be recorded by the applicant before submission. See [the recording guide](docs/VIDEO-GUIDE.md).
- **Repository:** https://github.com/jasonjeremiah-hue/k7m2v9q4

The repository name is intentionally anonymous, as requested. The product name does not change that repository naming convention.

## What it does

1. **Decision desk:** select a January decision date and UK cutoff. Inspect the next day's wind forecast, the retrospective actual, coverage, indicative energy, MAE and bias. Toggle plotted series and inspect each hour using a pointer or arrow keys.
2. **Forecast accuracy:** apply the same cutoff to all 31 January decisions. See pooled MAE/RMSE/bias, normalized MAE, P90 error, daily errors and full denominators. Open any day for investigation.
3. **Data explorer:** inspect all 24 hourly observations, source publication times, decision lead times, outturn completeness and signed errors. Filter by overforecast, underforecast or missing data; sort by largest miss.
4. **Methodology:** transparent assumptions, formulas, units, source provenance and limitations. Export daily or monthly observations as CSV. Exports always include the complete selected day/month, not just the UI filter.

All views use a real archived source snapshot. There are **no simulated dashboard values**, runtime API credentials, accounts or paid services. The runtime reads verified archive files, not the external API; this is intentional for deterministic review and offline/container use. Reload analysis re-requests the Python API; it does not pretend to download a newer archive.

## Run locally

Requirements: **Node 22.12+**, **pnpm 11.25.0**, **Python 3.12+**. Python has no third-party dependencies. Node 24 is also supported.

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:5173**. The Vite frontend proxies `/api` to the Python server at port 8000. On systems where the executable is not called `python`/`python3`, set the `PYTHON` environment variable to its path before `pnpm dev`.

Alternatively run the two processes separately:

```sh
python -m backend.server --port 8000
pnpm dev:frontend
```

### Production-like local server

```sh
pnpm build
python -m backend.server --port 8080
```

Open **http://127.0.0.1:8080**. The same Python process serves the built React frontend and API.

### Docker

```sh
docker compose up --build
```

Open **http://localhost:8080**. The multi-stage image builds React with Node and runs a Python 3.12 service as an unprivileged user. Compose uses a read-only root filesystem, a temporary `/tmp`, dropped capabilities and no-new-privileges. No host data or secrets are mounted. Vercel runs the Python function directly; it does not execute this Docker image.

## Tests

```sh
python -m unittest discover -s tests -v
pnpm test
pnpm build
```

The suite covers cutoff inclusivity, future-vintage exclusion, missing half-hours, invalid inputs, duplicate/revised records, zero and non-finite values, exact metric formulas, energy conversion, CSV endpoints, real-data regression values and **all 1,488 UI date/cutoff combinations**. GitHub Actions also builds and starts the production Docker image. A configured workflow is not itself evidence of a passing run; see the verified run status when reviewing.

## Data and assumptions

### Decision date is not delivery date

Decisions **1–31 January 2026** concern delivery **2 January–1 February 2026**. The archive includes December forecast publications so the first decision is not artificially deprived of earlier information. Default **09:00 GMT** is an explicitly chosen, adjustable pilot cutoff, **not** an assertion about a specific market's gate closure. Every January decision is GMT/UTC+0; dates outside this scope are rejected rather than assuming daylight-saving behavior.

### Point-in-time selection

For each target hour `t`, select `argmax(publishTime)` subject to `publishTime <= decision_time`. Selection is independent per hour; mixed vintages remain visible. Missing forecasts stay null and reduce coverage. Example: the 00:00 cutoff can have fewer than 24 next-day forecasts because the source horizon does not necessarily cover the final hours yet. A future forecast is never substituted to make the chart look complete.

### Align hourly forecast and half-hourly actual

The observed WINDFOR snapshot has whole-hour `startTime`s. FUELHH has half-hour readings in MW. Both actual half-hours are required:

```text
actual_hour_MW = (actual_at_HH00_MW + actual_at_HH30_MW) / 2
error_MW = forecast_hour_MW - actual_hour_MW
```

No interpolation/forward-fill is performed. The chart connects available hourly observations only. Missing data is never treated as zero. Outturn revisions are deduplicated to the latest publication in the downloaded response. Outturn is hindsight data **as retrieved**, not a reconstructed historical outturn vintage.

### Metrics and units

- MAE = mean(abs(error)); RMSE = sqrt(mean(error²)); bias = mean(error). Positive bias means overforecast.
- NMAE = MAE / mean(matched actual) × 100; this is **not MAPE** or “percent accurate”. Undefined for zero mean actual.
- P90 absolute error uses the nearest-rank definition.
- Monthly metrics pool matched **hourly** errors, not averages of daily RMSE or differently weighted days.
- 1 GW = 1,000 MW. Display uses GW; downloadable observations use MW.
- Forecast energy is an **indicative estimate**, sum(hourly MW × 1 hour)/1,000 GWh; it assumes each forecast value represents its whole hour. Actual energy integrates half-hour MW × 0.5 hours. Complete-period totals are omitted if the period is incomplete.
- Each output includes forecast, actual, paired and half-hour counts. Coverage denominators are explicit.

### Domain limitations

National Elexon datasets are used exactly as scoped in the brief, but they should not be interpreted as perfectly reconciled, exhaustive measures of all UK wind. Visibility/metering coverage, curtailment and definitional differences can affect forecast-versus-outturn comparisons. The error is therefore not attributable exclusively to weather/forecast model skill. No demand, prices, thermal generation, external weather or fabricated procurement recommendations are included. Actuals and month-wide metrics are explicitly retrospective.

### Refresh the reproducible archive

```sh
python scripts/fetch_data.py
python -m unittest discover -s tests -v
pnpm build
```

This makes outbound requests to the two public Elexon endpoints and replaces the archive and manifest. Commit and redeploy the updated snapshot together. The manifest records source URLs, UTC retrieval time, record counts, ranges and SHA-256 digests. The service verifies digests before loading. The committed snapshot contains **22,192 WINDFOR records** and **1,488 WIND FUELHH records**. These raw forecast records include a lookback and some targets outside the delivery window; the analysis itself is strictly limited to January decisions.

Sources:

- https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream
- https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream
- https://bmrs.elexon.co.uk/wind-generation
- https://developer.data.elexon.co.uk/

Contains Elexon Insights data; attribution does not imply endorsement. Observe the provider's BMRS data licence terms when reusing source data.

## Architecture and files

```text
React browser -> same-origin /api -> Python HTTP adapter -> pure analysis engine
                                                        -> verified gzip archives
```

| Path                         | Responsibility                                                               |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `src/App.jsx`                | URL-backed navigation, selected decision/cutoff, view composition            |
| `src/components/`            | Reusable shell, controls, metrics, notices and accessible SVG chart          |
| `src/pages/`                 | Decision, month accuracy, explorer and methodology views                     |
| `src/lib/`                   | Unit/date formatting and abortable API loading                               |
| `src/styles.css`             | Shared tokens, responsive layouts, focus and reduced-motion styles           |
| `backend/analysis.py`        | Vintage selection, half-hour aggregation, metrics and verified archive cache |
| `backend/http.py`            | Read-only JSON/CSV HTTP endpoints and input/error handling                   |
| `backend/server.py`          | Native local/Docker server, including safe static-file serving               |
| `api/index.py`               | Vercel Python function adapter; same backend, no duplicated calculations     |
| `data/`                      | Compressed real source records and provenance/checksum manifest              |
| `scripts/fetch_data.py`      | Explicit, repeatable archive refresh; fixed upstream endpoints               |
| `scripts/dev.mjs`            | Cross-platform local process launcher                                        |
| `tests/`                     | Python domain/HTTP integration tests and JavaScript formatting tests         |
| `.github/workflows/ci.yml`   | Tests, frontend production build and Docker smoke check                      |
| `Dockerfile`, `compose.yaml` | Multi-stage image and hardened local production configuration                |
| `vercel.json`                | Vite build, Python bundling, API routing and security headers                |
| `docs/`                      | Architecture, recording guide and submission checklist                       |

```

The service uses sorted vintage indexes and binary search. Warm archive reads and analysis results are bounded in-process caches, not a database. No credentials or mutable user data are needed. Deployments package the source archive with the Python function, avoiding provider outages, CORS issues and secret configuration. Backend code is standard-library-only to keep the cold-start/dependency footprint small.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Service identity and archive integrity check |
| `GET /api/analysis?date=2026-01-15&cutoff=09:00` | Point-in-time next-day outlook, observations and summary |
| `GET /api/accuracy?cutoff=09:00` | All January decisions at a consistent cutoff |
| `GET /api/sources` | Snapshot provenance and source checksums |
| `GET /api/export?date=2026-01-15&cutoff=09:00` | 24-hour CSV |
| `GET /api/export?scope=month&cutoff=09:00` | 744-hour CSV with decision date |

Invalid scope dates/cutoffs return HTTP 400; unknown API routes return 404; mutation requests return 405. Unexpected server errors return a generic 503 and log diagnostics server-side. Missing values are JSON null/empty CSV cells, not strings or zeros.

## Deploy to Vercel

Import this repository as a **new project**, framework **Vite**, repository root as the root directory, build `pnpm run build`, output `dist`. No environment variables are required. The committed `vercel.json` routes `/api/*` to the standard-library Python function, which bundles `backend/` and `data/`. Do not select a Python framework preset: this is a Vite frontend with an `/api` function, not a FastAPI-only site.

Use the deployed root URL and `/api/health` to verify frontend and backend, then test the CSV and deep links. Test the live URL, repository and unlisted video in an incognito window before submitting. See [submission checklist](docs/SUBMISSION-CHECKLIST.md).

## AI assistance disclosure

**OpenAI Codex was used substantially** for research assistance, implementation, tests, documentation and UI refinement. An AI-generated design concept informed the initial visual direction. This is disclosed explicitly as required by the assignment. The applicant must review and understand the code, validate the results, and give their own customer presentation and technical walkthrough; the repository must not be represented as unaided work. No AI service is called by the running application.
```
