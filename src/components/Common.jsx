import { AlertCircle, Info, RefreshCw } from "lucide-react";

export function PageHeading({ title, description, aside }) {
  return (
    <div className="page-heading">
      <div>
        <h1 id="page-title">{title}</h1>
        <p>{description}</p>
      </div>
      {aside}
    </div>
  );
}

export function MetricStrip({ metrics }) {
  return (
    <section className="metrics-strip" aria-label="Key metrics">
      {metrics.map((metric) => (
        <div className="metric" key={metric.label}>
          <span className="metric-label">
            {metric.label}
            {metric.info && (
              <span
                className="metric-info"
                title={metric.info}
                aria-label={metric.info}
              >
                <Info size={12} />
              </span>
            )}
          </span>
          <div className="metric-number">
            {metric.value}
            <span>{metric.unit}</span>
          </div>
          <span className="metric-detail">{metric.detail}</span>
        </div>
      ))}
    </section>
  );
}

export function DataState({ error, retry, loading }) {
  if (error)
    return (
      <div className="data-error" role="alert">
        <AlertCircle size={24} />
        <h2>We couldn’t load this analysis.</h2>
        <p>{error}</p>
        <button className="button primary" onClick={retry}>
          <RefreshCw size={15} />
          Try again
        </button>
      </div>
    );
  if (loading)
    return (
      <div
        className="loading-panel"
        role="status"
        aria-label="Loading analysis"
      >
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-metrics" />
        <div className="skeleton skeleton-chart" />
        <span className="loading-text">Selecting point-in-time forecasts…</span>
      </div>
    );
  return null;
}

export function Warnings({ warnings }) {
  return warnings?.length ? (
    <div className="warning-list" role="status">
      {warnings.map((warning) => (
        <p key={warning}>
          <AlertCircle size={16} />
          {warning}
        </p>
      ))}
    </div>
  ) : null;
}

export function Notice({ children, tone = "" }) {
  return (
    <div className={`notice ${tone}`}>
      <Info size={17} />
      <span>{children}</span>
    </div>
  );
}
