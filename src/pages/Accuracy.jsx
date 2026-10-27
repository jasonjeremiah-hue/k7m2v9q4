import { ArrowRight } from "lucide-react";
import { MetricStrip, Notice } from "../components/Common";
import { number, gw, signed, dateLabel } from "../lib/format.mjs";

export function Accuracy({ data, onDay }) {
  const s = data.summary;
  const max = Math.max(1000, ...data.days.map((day) => day.mae_mw || 0));
  const available = data.days.filter((day) => day.mae_mw != null);
  const worst = available.length
    ? available.reduce((a, b) => (a.mae_mw > b.mae_mw ? a : b))
    : null;
  return (
    <>
      <MetricStrip
        metrics={[
          {
            label: "Mean absolute error",
            value: number(gw(s.mae_mw), 2),
            unit: "GW",
            detail: "Typical absolute hourly error",
          },
          {
            label: "Root mean squared error",
            value: number(gw(s.rmse_mw), 2),
            unit: "GW",
            detail: "More sensitive to large misses",
          },
          {
            label: "Signed bias",
            value: signed(gw(s.bias_mw)),
            unit: "GW",
            detail:
              s.bias_mw >= 0
                ? "Positive means overforecast"
                : "Negative means underforecast",
          },
          {
            label: "Paired coverage",
            value: number(s.paired_coverage_pct, 0),
            unit: "%",
            detail: `${s.paired_hours} of ${s.expected_hours} hourly pairs`,
          },
        ]}
      />
      <section className="chart-panel accuracy-panel">
        <div className="chart-toolbar">
          <div>
            <h2>A month of decisions, measured.</h2>
            <p>
              Daily mean absolute error <span>·</span> GW <span>·</span>{" "}
              {data.cutoff} GMT cutoff
            </p>
          </div>
          <span className="chart-instruction">Select a day to inspect</span>
        </div>
        <div className="daily-chart">
          <div className="daily-y-label">MAE · GW</div>
          <div className="daily-bars">
            {data.days.map((day) => (
              <button
                className="day-bar-button"
                key={day.decision_date}
                onClick={() => onDay(day.decision_date)}
                aria-label={`${dateLabel(day.decision_date, true)} decision: mean absolute error ${number(gw(day.mae_mw), 2)} GW. Open decision desk.`}
                title={`${dateLabel(day.decision_date, true)} · ${number(gw(day.mae_mw), 2)} GW MAE`}
              >
                <span
                  className="day-bar"
                  style={{
                    height: `${day.mae_mw == null ? 0 : Math.max(1, (day.mae_mw / max) * 100)}%`,
                  }}
                />
                <span className="day-bar-label">
                  {Number(day.decision_date.slice(-2))}
                </span>
              </button>
            ))}
          </div>
        </div>
        <Notice>
          Each bar is a January decision, evaluated against the following
          delivery day. Month-wide metrics use all hourly errors, not an average
          of daily RMSE values.
        </Notice>
      </section>
      <section className="accuracy-explain">
        <div>
          <h2>Read the error, not just the forecast.</h2>
          <p>
            At {data.cutoff} GMT, the forecast’s mean absolute error was{" "}
            <strong>{number(gw(s.mae_mw), 2)} GW</strong>, equivalent to{" "}
            <strong>{number(s.nmae_pct, 1)}%</strong> of mean matched actual
            generation. This is normalized MAE, not an “accuracy percentage”.
          </p>
          <p>
            A positive bias means more wind was forecast than ultimately
            observed. Comparing the same cutoff across all days avoids mixing
            different decision horizons.
          </p>
        </div>
        <dl>
          <div>
            <dt>90th percentile absolute error</dt>
            <dd>
              {number(gw(s.p90_absolute_error_mw), 2)} <span>GW</span>
            </dd>
          </div>
          <div>
            <dt>Largest hourly miss</dt>
            <dd>
              {number(gw(s.max_absolute_error_mw), 2)} <span>GW</span>
            </dd>
          </div>
          {worst && (
            <div>
              <dt>Highest daily MAE</dt>
              <dd>
                <button
                  className="text-button"
                  onClick={() => onDay(worst.decision_date)}
                >
                  {dateLabel(worst.decision_date, true)} decision{" "}
                  <ArrowRight size={14} />
                </button>
              </dd>
            </div>
          )}
        </dl>
      </section>
      <section className="table-panel">
        <div className="section-title">
          <h2>Daily breakdown</h2>
          <span>31 decisions · 2 January–1 February delivery</span>
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="Daily accuracy data"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Decision date</th>
                <th>Delivery date</th>
                <th className="numeric">MAE (GW)</th>
                <th className="numeric">RMSE (GW)</th>
                <th className="numeric">Bias (GW)</th>
                <th className="numeric">Pairs</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <tr key={day.decision_date}>
                  <th scope="row">{dateLabel(day.decision_date, true)}</th>
                  <td>{dateLabel(day.delivery_date, true)}</td>
                  <td className="numeric">{number(gw(day.mae_mw), 2)}</td>
                  <td className="numeric">{number(gw(day.rmse_mw), 2)}</td>
                  <td className="numeric">{signed(gw(day.bias_mw))}</td>
                  <td className="numeric">{day.paired_hours}/24</td>
                  <td>
                    <button
                      className="row-link"
                      onClick={() => onDay(day.decision_date)}
                      aria-label={`Inspect ${day.decision_date}`}
                    >
                      <ArrowRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
