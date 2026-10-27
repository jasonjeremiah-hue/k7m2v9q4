import {
  ChartNoAxesColumnIncreasing,
  CircleHelp,
  Database,
  FileText,
  ArrowUpRight,
  Wind,
  Check,
  Menu,
  X,
  Download,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { exportUrl } from "../lib/format.mjs";

export const views = [
  { id: "desk", label: "Decision desk", icon: ChartNoAxesColumnIncreasing },
  { id: "accuracy", label: "Forecast accuracy", icon: CircleHelp },
  { id: "explorer", label: "Data explorer", icon: Database },
  { id: "methodology", label: "Methodology", icon: FileText },
];

export function Shell({
  view,
  setView,
  date,
  cutoff,
  children,
  exportEnabled,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const menuButton = useRef(null);
  const drawer = useRef(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const closeMenu = () => {
    setMobileOpen(false);
    requestAnimationFrame(() => menuButton.current?.focus());
  };
  useEffect(() => {
    if (!mobileOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector("button")?.focus();
    const keyboard = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
      if (event.key === "Tab") {
        const controls = [...drawer.current.querySelectorAll("button, nav a")];
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keyboard);
    };
  }, [mobileOpen]);
  const active = views.find((item) => item.id === view) || views[0];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="mobile-bar" inert={mobileOpen ? true : undefined}>
        <a
          className="brand"
          href="?view=desk"
          onClick={(event) => {
            event.preventDefault();
            setView("desk");
          }}
        >
          <Wind size={30} />
          <span>
            AERIS<span className="brand-dot">.</span>
          </span>
        </a>
        <button
          ref={menuButton}
          className="icon-button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>
      {mobileOpen && (
        <button
          className="nav-scrim"
          tabIndex={-1}
          aria-hidden="true"
          onClick={closeMenu}
        />
      )}
      <aside
        ref={drawer}
        className={`sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="Primary navigation"
        inert={mobile && !mobileOpen ? true : undefined}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
      >
        <div className="drawer-head">
          <strong>Navigate</strong>
          <button
            className="icon-button"
            aria-label="Close navigation"
            onClick={closeMenu}
          >
            <X size={19} />
          </button>
        </div>
        <a
          className="brand desktop-brand"
          href="?view=desk"
          onClick={(event) => {
            event.preventDefault();
            setView("desk");
          }}
        >
          <Wind size={34} strokeWidth={1.8} />
          <span>
            AERIS<span className="brand-dot">.</span>
          </span>
        </a>
        <nav>
          {views.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`?view=${id}&date=${date}&cutoff=${encodeURIComponent(cutoff)}`}
              className={`nav-link ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setView(id);
                setMobileOpen(false);
              }}
            >
              <Icon size={19} strokeWidth={1.65} />
              <span>{label}</span>
              {view === id && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="archive-symbol">
            <Wind size={23} />
          </div>
          <div>
            <strong>UK national wind</strong>
            <span>January 2026</span>
          </div>
        </div>
        <div className="sidebar-footnote">
          <Check size={12} /> Real data. Reproducible analysis.
        </div>
      </aside>
      <main
        id="main"
        className="main-content"
        tabIndex={-1}
        aria-labelledby="page-title"
        inert={mobileOpen ? true : undefined}
      >
        <header className="topbar">
          <div className="breadcrumb">
            Workspace<span>/</span>
            <strong>{active.label}</strong>
          </div>
          {view !== "methodology" && (
            <a
              className={`button export-button ${!exportEnabled ? "disabled" : ""}`}
              aria-disabled={!exportEnabled}
              href={
                exportEnabled
                  ? exportUrl(date, cutoff, view === "accuracy")
                  : undefined
              }
              download
            >
              <Download size={15} />
              <span>Export CSV</span>
            </a>
          )}
          {view === "methodology" && (
            <a
              className="source-link"
              href="https://bmrs.elexon.co.uk/api-documentation"
              target="_blank"
              rel="noreferrer"
            >
              Elexon documentation <ArrowUpRight size={15} />
            </a>
          )}
        </header>
        {children}
        <footer className="page-footer">
          <span>
            Aeris <span className="footer-dot">·</span> January 2026 historical
            replay
          </span>
          <span>
            Source:{" "}
            <a
              href="https://bmrs.elexon.co.uk/"
              target="_blank"
              rel="noreferrer"
            >
              Elexon Insights
            </a>
            <span className="footer-dot">·</span>All times UK (GMT)
          </span>
        </footer>
      </main>
    </div>
  );
}
