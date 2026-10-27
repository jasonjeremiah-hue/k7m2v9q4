import {
  CalendarDays,
  Clock3,
  Info,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { dateLabel, nextDay } from "../lib/format.mjs";

const dates = Array.from(
  { length: 31 },
  (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`,
);
const times = Array.from(
  { length: 48 },
  (_, i) =>
    `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);

export function Controls({
  date,
  setDate,
  cutoff,
  setCutoff,
  refresh,
  loading,
  monthly = false,
}) {
  return (
    <section className="controls-panel" aria-label="Analysis controls">
      <div className="control-field">
        <label htmlFor="decision-date">
          {monthly ? "Decision period" : "Decision date"}
        </label>
        <div className={`input-wrap ${monthly ? "readonly" : ""}`}>
          <CalendarDays size={16} />
          {monthly ? (
            <span>1–31 January 2026</span>
          ) : (
            <select
              id="decision-date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            >
              {dates.map((item) => (
                <option key={item} value={item}>
                  {dateLabel(item, true)} 2026
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="control-field time-field">
        <label htmlFor="decision-time">Decision time (UK)</label>
        <div className="input-wrap">
          <Clock3 size={16} />
          <select
            id="decision-time"
            value={cutoff}
            onChange={(event) => setCutoff(event.target.value)}
          >
            {times.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="control-field delivery-field">
        <span className="control-label">
          View delivery {monthly ? "period" : "day"}
        </span>
        <div className="input-wrap readonly">
          <CalendarDays size={16} />
          <span>
            {monthly
              ? "2 Jan – 1 Feb 2026"
              : `${dateLabel(nextDay(date), true)} 2026`}
          </span>
          <ArrowRight size={14} className="delivery-arrow" />
        </div>
      </div>
      <div className="replay-note">
        <Info size={16} />
        <span>
          Historical replay
          <br />
          <strong>Only forecasts available at the cutoff.</strong>
        </span>
      </div>
      <button
        className="icon-button reload-button"
        onClick={refresh}
        disabled={loading}
        title="Reload analysis"
        aria-label="Reload analysis"
      >
        <RefreshCw size={16} className={loading ? "spin" : ""} />
      </button>
    </section>
  );
}
