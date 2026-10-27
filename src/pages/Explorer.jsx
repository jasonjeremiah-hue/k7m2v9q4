import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Search, Database } from 'lucide-react';
import { Notice } from '../components/Common';
import { dateLabel, hourLabel, number, publicationLabel, signed } from '../lib/format.mjs';

export function Explorer({ data }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('time');
  const rows = useMemo(() => {
    const selected = data.series.filter(row => filter === 'over' ? row.error_mw > 0 : filter === 'under' ? row.error_mw < 0 : filter === 'missing' ? row.forecast_mw == null || row.actual_mw == null : true);
    return sort === 'error' ? selected.sort((a, b) => (b.absolute_error_mw ?? -1) - (a.absolute_error_mw ?? -1)) : selected;
  }, [data.series, filter, sort]);
  return <>
    <div className="explorer-summary"><Database size={18} /><span><strong>{dateLabel(data.delivery_date)}</strong> delivery day <span className="footer-dot">·</span>24 hourly records<span className="footer-dot">·</span>Power in MW</span></div>
    <section className="table-panel"><div className="explorer-toolbar"><div><h2>Behind every point.</h2><p>Forecast vintages, outturn and error. Nothing hidden.</p></div><div className="table-filters"><label><Search size={14} /><span className="sr-only">Filter records</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All observations</option><option value="over">Overforecast only</option><option value="under">Underforecast only</option><option value="missing">Missing data only</option></select></label><label><ArrowDownWideNarrow size={15} /><span className="sr-only">Sort records</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="time">Delivery time</option><option value="error">Largest error</option></select></label></div></div>
      <div className="table-scroll" role="region" aria-label="Hourly observations" tabIndex={0}><table><thead><tr><th>Delivery (GMT)</th><th className="numeric">Forecast (MW)</th><th className="numeric">Actual (MW)</th><th className="numeric">Error (MW)</th><th>Published (GMT)</th><th className="numeric">Lead time</th><th className="numeric">Outturn</th></tr></thead><tbody>{rows.map(row => <tr key={row.start_time}><th scope="row">{hourLabel(row.hour)}<span className="table-time-end">–{hourLabel(row.hour + 1)}</span></th><td className="numeric forecast-cell">{number(row.forecast_mw, 0)}</td><td className="numeric actual-cell">{number(row.actual_mw, 1)}</td><td className="numeric"><span className={`error-value ${row.error_mw == null ? '' : row.error_mw >= 0 ? 'positive' : 'negative'}`}>{signed(row.error_mw, 1)}</span></td><td>{publicationLabel(row.forecast_published_at)}</td><td className="numeric">{number(row.lead_hours, 1)} h</td><td className="numeric">{row.actual_half_hours}/2</td></tr>)}</tbody></table></div>
      {!rows.length && <div className="empty-state"><Database size={28} /><h3>No observations match this filter.</h3><p>{filter === 'missing' ? 'Good news: this delivery day has complete forecast and outturn data.' : 'Try a different filter or decision date.'}</p><button className="text-button" onClick={() => setFilter('all')}>Show all observations</button></div>}
      <div className="table-footer"><span>{rows.length} of 24 observations</span><span>CSV exports all 24 source-aligned hours, regardless of table filters.</span></div>
    </section>
    <Notice>Signed error = forecast − actual. Positive means overforecast. Lead time is delivery start minus decision time, not the age of the forecast publication.</Notice>
  </>;
}
