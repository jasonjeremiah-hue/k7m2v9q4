# Technical review notes

## Design choices

- **React + Vite** for a small, read-only client with four focused views. The app is a working tool, not a marketing page.
- **Pure Python domain layer**, independent of transport. Archive, vintage selection and metrics can be tested without a running HTTP service.
- **Standard-library HTTP adapter**, reused locally, in Docker and in Vercel. No unnecessary framework/dependency or production secrets for a bounded pilot.
- **Immutable, provenance-tracked data snapshot**. Reviewers get deterministic results rather than a brittle cold-start upstream download. Refresh is explicit and repeatable, not a pretend “live” data button.
- **Binary search per delivery hour** avoids repeatedly scanning all forecast records. A bounded process cache reuses the archive and recent analysis results.
- **No user data/auth/database** because there is no requirement for saving private work or accounts. Shareable URL parameters preserve analysis context instead.

## Correctness boundaries

1. Only January decision dates accepted. Delivery is explicitly the next calendar day, including February 1.
2. Forecast publication must be <= selected decision time. No post-cutoff fallback.
3. Both actual half-hours required for each hourly comparison. Real zero remains zero, missing remains null.
4. Select most recent outturn revision within the retrieved archive. This is not a vintage reconstruction of actuals.
5. Errors are signed forecast-minus-actual. MAE and RMSE do not erase direction in the separately reported bias.
6. Monthly error metrics pool hourly errors. Coverage and sample size remain visible.
7. Forecast energy is a clearly labelled integration assumption; source hourly power is not falsely called settlement-grade energy.
8. Visible/telemetered national wind may differ across source definitions; mismatch is disclosed, not automatically attributed to forecast skill.

## Reliability and security

- Archive hashes and counts verified on load. No silent fallback to invented values.
- Fixed upstream URLs in the explicit ingest script; no user-supplied fetch URLs/SSRF.
- UI uses abortable fetch requests, loading/error/retry and missing-data states; stale results are not displayed under new filter controls.
- CSV uses validated dates/times and numeric/source-only values. No arbitrary user strings are exported as spreadsheet formulas.
- Static server resolves paths and checks confinement to `dist`.
- API is read-only. No login, writable database, environment keys or personal information.
- Container runs unprivileged with read-only filesystem and dropped capabilities.
- Vercel sets nosniff, frame denial, restricted referrer and device permission headers.
- Google Fonts is an optional external typography dependency with system fallbacks; no analytics or tracking scripts.

## What is deliberately not included

Trading recommendations, demand forecasts, thermal procurement calculations, price/cost optimization, live markets, personal accounts and paid integrations are outside the two-dataset pilot. A production procurement tool would require client demand data, reconciled market definitions, market-specific cutoffs, stronger operational monitoring and rolling out-of-sample validation.

## If the scope grows

Add validated timezone-aware delivery calendars before supporting DST months; persist raw source versions in object storage; schedule a monitored ingest process; compare forecast vintages/horizons using a reconciled target definition; and add authentication only when client-sensitive data or saved portfolios become a requirement. These are future options, not current implementation claims.
