# Required video: record your own 10-minute presentation

Do not submit without the video. Record your own voice and screen; upload to YouTube as **Unlisted**, not Private. This guide is a structure to study, not a claim that you have already recorded or mastered the implementation.

## Part 1: client presentation, 0:00–4:50

**0:00–0:40 — The problem.** Explain that wind affects the amount of additional power a utility needs to buy day ahead. The pilot makes the available forecast and its historical error visible. Do not claim the app knows client demand or makes purchasing recommendations.

**0:40–2:00 — Decision desk.** Use January 15, 09:00 GMT. Delivery is January 16. The latest available publication is January 15 at 07:30 GMT. Demonstrate that forecast energy is an indicative estimate (190.3 GWh) versus actual 181.9 GWh, with MAE approximately 0.78 GW. Toggle a line and use a chart tooltip. Explain actual is hindsight, not information available when buying power.

**2:00–2:45 — Information timing.** Change the cutoff to 00:00. Observe that some hours may be unavailable. Explain why the app does not quietly use a later forecast to fill them. Return to 09:00.

**2:45–3:50 — Accuracy.** Open Forecast accuracy at 09:00. Explain monthly MAE ~2.04 GW, RMSE ~2.50 GW, bias +1.75 GW and 744/744 matched hours. Positive bias means more wind was forecast than observed. These are dataset comparisons, not evidence that the model alone caused all differences. Click a daily bar to investigate.

**3:50–4:50 — Transparency and value.** Open Data explorer, sort largest error, show publication/lead/outturn columns and export CSV. Close the client portion by explaining that the pilot supports informed judgement, not automated trading, and that the next client discussion should confirm the operational cutoff and reconcile source coverage.

## Part 2: technical review, 4:50–9:45

**4:50–5:30 — Architecture.** Show React views -> HTTP adapter -> pure Python analysis -> verified compressed source archive. Same service runs in local Python, Docker and Vercel's Python function. Explain why an archive-backed pilot is deterministic.

**5:30–6:40 — Domain implementation.** Open `Archive.select()` in `backend/analysis.py`: per-target sorted vintages and binary search, cutoff inclusive. Show `Archive.day()` for January-to-next-day dates and two-half-hour averaging. Missing is null, zero is valid.

**6:40–7:35 — Analysis.** Show `metrics()`: signed error, MAE, RMSE, bias, sample counts and NMAE definition. Monthly statistics pool hourly observations. Explain the indicative forecast-energy assumption and differing dataset scopes.

**7:35–8:30 — Evidence and practices.** Show `data/manifest.json`, source links, checksums, the tests and a passing run. Highlight future-vintage leakage, missing half-hours, Jan 31 -> Feb 1 and the exhaustive 1,488 date/cutoff combinations. Distinguish synthetic edge-case test fixtures from real production archive data.

**8:30–9:15 — Delivery.** Show Dockerfile, Compose, Vercel routing and read-only API. Explain no runtime keys, database or third-party Python dependencies. Demonstrate error/retry if desired. A configured workflow alone is not proof of CI passing: show the actual result.

**9:15–9:45 — Handoff.** Explain deployment/run instructions, known limitations, sensible next steps and substantial AI assistance. Keep under ten minutes. Do not claim knowledge or work practices you cannot explain when asked.

## Before recording

- Study the formulas and trace one source forecast and two actual records into one hourly error yourself.
- Verify the current default snapshot numbers; changing cutoff changes the results.
- Rehearse both parts and remove setup delays. Avoid exposing other tabs, account details, private folders or credentials.
- Test video accessibility in incognito alongside repo/app links.
- Add the final video link to README and the submission form only after you verify it works.
