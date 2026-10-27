import { useId, useState } from "react";
import { hourLabel, number, gw, dateLabel } from "../lib/format.mjs";

const W = 1100,
  H = 230,
  LEFT = 50,
  RIGHT = 17,
  TOP = 20,
  BOTTOM = 37;
const plotH = H - TOP - BOTTOM;

function lineSegments(rows, key, x, y) {
  let drawing = false;
  return rows
    .map((row, index) => {
      if (row[key] == null) {
        drawing = false;
        return "";
      }
      const segment = `${drawing ? "L" : "M"}${x(index).toFixed(2)},${y(row[key]).toFixed(2)}`;
      drawing = true;
      return segment;
    })
    .join(" ");
}

export function WindChart({ series, delivery }) {
  const [hovered, setHovered] = useState(null);
  const [visible, setVisible] = useState({
    forecast_mw: true,
    actual_mw: true,
  });
  const gradientId = useId().replaceAll(":", "");
  const numbers = series
    .flatMap((row) => [row.forecast_mw, row.actual_mw])
    .filter((value) => value != null);
  const max = Math.max(5000, Math.ceil(Math.max(0, ...numbers) / 5000) * 5000);
  const x = (i) => LEFT + (i / 23) * (W - LEFT - RIGHT);
  const y = (value) => TOP + (1 - value / max) * plotH;
  const row = hovered == null ? null : series[hovered];
  const fullForecast = series.every((item) => item.forecast_mw != null);
  return (
    <div className="chart-component">
      <div className="chart-toolbar">
        <div>
          <h2>Tomorrow’s wind outlook</h2>
          <p>
            National wind generation <span>·</span> GW <span>·</span>{" "}
            {dateLabel(delivery, true)}
          </p>
        </div>
        <div className="chart-legend">
          {[
            ["forecast_mw", "Forecast at decision", "green"],
            ["actual_mw", "Actual generation", "blue"],
          ].map(([key, label, color]) => (
            <button
              key={key}
              aria-pressed={visible[key]}
              onClick={() =>
                setVisible((previous) => ({
                  ...previous,
                  [key]: !previous[key],
                }))
              }
              className={`legend-item ${!visible[key] ? "muted" : ""}`}
            >
              <span className={`legend-line ${color}`} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-wrapper">
        <span className="axis-unit">GW</span>
        <svg
          className="wind-chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          tabIndex={0}
          aria-label={`Wind power for ${delivery}. Forecast is green; retrospective actual is dashed blue. Use left and right arrows to inspect hourly values, Escape to clear. Exact values are also available in Data explorer.`}
          onPointerLeave={() => setHovered(null)}
          onKeyDown={(event) => {
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(
                event.key,
              )
            ) {
              event.preventDefault();
              setHovered((previous) =>
                event.key === "Escape"
                  ? null
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 23
                      : Math.max(
                          0,
                          Math.min(
                            23,
                            (previous ?? 0) +
                              (event.key === "ArrowRight" ? 1 : -1),
                          ),
                        ),
              );
            }
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#07836a" stopOpacity=".12" />
              <stop offset="100%" stopColor="#07836a" stopOpacity=".015" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((step) => (
            <g key={step}>
              <line
                x1={LEFT}
                x2={W - RIGHT}
                y1={y((max * step) / 4)}
                y2={y((max * step) / 4)}
                stroke="#dce4ec"
                strokeDasharray="3 4"
              />
              <text x={LEFT - 14} y={y((max * step) / 4) + 4} textAnchor="end">
                {number((max * step) / 4000, max % 20000 ? 1 : 0)}
              </text>
            </g>
          ))}
          {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((hour) => (
            <g key={hour}>
              <line
                x1={x(hour)}
                x2={x(hour)}
                y1={TOP}
                y2={H - BOTTOM}
                stroke="#f0f3f7"
              />
              <text x={x(hour)} y={H - 12} textAnchor="middle">
                {hourLabel(hour)}
              </text>
            </g>
          ))}
          {visible.forecast_mw && fullForecast && (
            <path
              d={`${lineSegments(series, "forecast_mw", x, y)} L${x(23)},${y(0)} L${x(0)},${y(0)} Z`}
              fill={`url(#${gradientId})`}
            />
          )}
          {visible.actual_mw && (
            <path
              d={lineSegments(series, "actual_mw", x, y)}
              fill="none"
              stroke="#5387bd"
              strokeWidth="2.4"
              strokeDasharray="7 6"
              strokeLinejoin="round"
            />
          )}
          {visible.forecast_mw && (
            <path
              d={lineSegments(series, "forecast_mw", x, y)}
              fill="none"
              stroke="#07836a"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
          )}
          {row && (
            <g>
              <line
                x1={x(hovered)}
                x2={x(hovered)}
                y1={TOP}
                y2={H - BOTTOM}
                stroke="#63748a"
                strokeDasharray="3 3"
              />
              {["forecast_mw", "actual_mw"].map(
                (key) =>
                  visible[key] &&
                  row[key] != null && (
                    <circle
                      key={key}
                      cx={x(hovered)}
                      cy={y(row[key])}
                      r="4"
                      fill={key === "forecast_mw" ? "#07836a" : "#5387bd"}
                      stroke="white"
                      strokeWidth="2"
                    />
                  ),
              )}
            </g>
          )}
          {series.map((item, i) => (
            <rect
              key={item.start_time}
              x={x(i) - (W - LEFT - RIGHT) / 46}
              y={TOP}
              width={(W - LEFT - RIGHT) / 23}
              height={plotH}
              fill="transparent"
              aria-hidden="true"
              onPointerEnter={() => setHovered(i)}
            />
          ))}
        </svg>
        {row && (
          <div
            role="status"
            aria-live="polite"
            className={`chart-tooltip ${hovered > 16 ? "tooltip-left" : ""}`}
            style={{
              left: `${Math.min(84, Math.max(9, 5 + (hovered / 23) * 89))}%`,
            }}
          >
            <strong>
              {hourLabel(hovered)}–{hourLabel(hovered + 1)} GMT
            </strong>
            <span>
              <i className="green-dot" />
              Forecast<b>{number(gw(row.forecast_mw), 2)} GW</b>
            </span>
            <span>
              <i className="blue-dot" />
              Actual<b>{number(gw(row.actual_mw), 2)} GW</b>
            </span>
          </div>
        )}
      </div>
      <span className="mobile-chart-hint">
        Scroll the chart horizontally to explore all 24 hours.
      </span>
    </div>
  );
}
