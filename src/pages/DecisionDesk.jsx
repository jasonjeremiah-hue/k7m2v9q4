import { ArrowRight, Clock3, FileCheck2, Info } from "lucide-react";
import { MetricStrip, Notice, Warnings } from "../components/Common";
import { WindChart } from "../components/WindChart";
import { gw, number, publicationLabel, signed } from "../lib/format.mjs";

export function DecisionDesk({ data, setView }) {
  const s = data.summary;
  return (
    <>
      <Warnings warnings={data.warnings} />
      <MetricStrip
        metrics={[
          {
            label: "Forecast energy",
            value: number(s.forecast_energy_gwh, 1),
            unit: "GWh",
            detail: "Indicative hourly estimate",
            info: "Sum of the 24 hourly forecast MW values × 1 hour, divided by 1,000. Assumes each forecast represents its hour; not a settlement-grade energy forecast.",
          },
          {
            label: "Actual energy",
            value: number(s.actual_energy_gwh, 1),
            unit: "GWh",
            detail: "From half-hourly outturn",
          },
          {
            label: "Mean absolute error",
            value: number(gw(s.mae_mw), 2),
            unit: "GW",
            detail: `${s.paired_hours} matched hourly observations`,
            info: "Average absolute forecast minus actual, after aggregating both actual half-hours. Lower is better.",
          },
          {
            label: "Forecast coverage",
            value: number(s.forecast_coverage_pct, 0),
            unit: "%",
            detail: `${s.forecast_hours} of 24 delivery hours available`,
          },
        ]}
      />
      <section className="chart-panel">
        <WindChart series={data.series} delivery={data.delivery_date} />
        <Notice>
          A forecast is not a guarantee. The blue actuals are shown
          retrospectively, not as information available at the decision.
        </Notice>
      </section>
      <section className="context-panel">
        <div className="section-title">
          <h2>Decision context</h2>
          <button
            className="text-button"
            onClick={() => setView("methodology")}
          >
            How this works <ArrowRight size={14} />
          </button>
        </div>
        <div className="context-grid">
          <article>
            <div className="context-icon">
              <FileCheck2 size={21} />
            </div>
            <div>
              <h3>No future information</h3>
              <p>
                Each hour uses its latest forecast published at or before{" "}
                {data.cutoff} GMT. Latest included publication:{" "}
                <strong>
                  {publicationLabel(data.publication_range.latest)}
                </strong>
                .
              </p>
              <button
                className="text-button"
                onClick={() => setView("explorer")}
              >
                Explore the data <ArrowRight size={14} />
              </button>
            </div>
          </article>
          <article>
            <div className="context-icon blue">
              <Clock3 size={21} />
            </div>
            <div>
              <h3>Every half-hour accounted for</h3>
              <p>
                {s.actual_half_hours} of 48 outturn readings are available. Both
                half-hours are averaged to align with each hourly forecast.
                Missing data is never treated as zero.
              </p>
              <button
                className="text-button"
                onClick={() => setView("accuracy")}
              >
                Review forecast accuracy <ArrowRight size={14} />
              </button>
            </div>
          </article>
        </div>
      </section>
      <section className="observation-row">
        <Info size={17} />
        <p>
          <strong>
            {s.bias_mw == null
              ? "No matched observations."
              : `The forecast ${s.bias_mw >= 0 ? "overestimated" : "underestimated"} wind by ${number(gw(Math.abs(s.bias_mw)), 2)} GW on average.`}
          </strong>{" "}
          Signed bias: {signed(gw(s.bias_mw))} GW. This is hindsight analysis,
          not a procurement recommendation.
        </p>
      </section>
    </>
  );
}
