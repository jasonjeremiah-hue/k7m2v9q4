import { useEffect, useState } from 'react';
import { Shell, views } from './components/Shell';
import { Controls } from './components/Controls';
import { DataState, PageHeading } from './components/Common';
import { DecisionDesk } from './pages/DecisionDesk';
import { Accuracy } from './pages/Accuracy';
import { Explorer } from './pages/Explorer';
import { Methodology } from './pages/Methodology';
import { useResource } from './lib/useResource';

const headings = {
  desk: ['A clearer view of tomorrow.', 'Wind generation forecasts for better day-ahead decisions.'],
  accuracy: ['Know the forecast. Know its limits.', 'A consistent, point-in-time assessment of every January decision.'],
  explorer: ['Every number, in the open.', 'Trace each forecast to its publication and its observed outcome.'],
  methodology: ['Clarity starts with the method.', 'The assumptions, calculations and source data behind the decision desk.'],
};

function readLocation() {
  const query = new URLSearchParams(window.location.search);
  const view = query.get('view');
  const date = query.get('date');
  const cutoff = query.get('cutoff');
  return {
    view: views.some(item => item.id === view) ? view : 'desk',
    date: /^2026-01-(0[1-9]|[12]\d|3[01])$/.test(date || '') ? date : '2026-01-15',
    cutoff: /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(cutoff || '') ? cutoff : '09:00',
  };
}

export default function App() {
  const [location, setLocation] = useState(readLocation);
  const { view, date, cutoff } = location;
  const [revision, setRevision] = useState(0);
  const navigate = patch => {
    const next = { ...location, ...patch };
    const url = new URL(window.location.href);
    Object.entries(next).forEach(([key, value]) => url.searchParams.set(key, value));
    window.history.pushState({}, '', url);
    setLocation(next);
    if (patch.view && patch.view !== view) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
    }
  };
  const setView = value => navigate({ view: value });
  const setDate = value => navigate({ date: value });
  const setCutoff = value => navigate({ cutoff: value });
  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    const url = new URL(window.location.href);
    Object.entries(location).forEach(([key, value]) => url.searchParams.set(key, value));
    window.history.replaceState({}, '', url);
    document.title = `Aeris | ${views.find(item => item.id === view).label}`;
  }, [location, view]);
  useEffect(() => {
    const listener = () => setLocation(readLocation());
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);
  const analysis = useResource(view === 'desk' || view === 'explorer' ? `/api/analysis?${new URLSearchParams({ date, cutoff })}` : null, revision);
  const accuracy = useResource(view === 'accuracy' ? `/api/accuracy?cutoff=${encodeURIComponent(cutoff)}` : null, revision);
  const sources = useResource(view === 'methodology' ? '/api/sources' : null, revision);
  const resource = view === 'accuracy' ? accuracy : view === 'methodology' ? sources : analysis;
  const [title, description] = headings[view];
  return <Shell view={view} setView={setView} date={date} cutoff={cutoff} exportEnabled={Boolean(resource.data)}>
    <PageHeading title={title} description={description} />
    {view !== 'methodology' && <Controls date={date} setDate={setDate} cutoff={cutoff} setCutoff={setCutoff} refresh={refresh} loading={resource.loading} monthly={view === 'accuracy'} />}
    <div className="page-body" aria-busy={resource.loading}>
      <DataState loading={resource.loading} error={resource.error} retry={refresh} />
      {view === 'desk' && analysis.data && <DecisionDesk data={analysis.data} setView={setView} />}
      {view === 'accuracy' && accuracy.data && <Accuracy data={accuracy.data} onDay={value => navigate({ view: 'desk', date: value })} />}
      {view === 'explorer' && analysis.data && <Explorer data={analysis.data} />}
      {view === 'methodology' && sources.data && <Methodology manifest={sources.data} />}
    </div>
  </Shell>;
}
