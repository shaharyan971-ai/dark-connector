"use client";

import DashboardShell from "@/components/DashboardShell";
import { getPatterns } from "@/lib/api";
import usePolling from "@/lib/usePolling";

export default function PatternsPage() {
  const { data, error, loading, refresh } = usePolling((signal) => getPatterns(signal));

  return (
    <DashboardShell>
      <main className="content">
        <header className="page-head">
          <div className="eyebrow">DETECTED SIGNALS</div>
          <h1>Patterns</h1>
          <p>Explore deceptive design patterns detected across the web.</p>
        </header>
        <section className="panel data-panel" aria-label="Detected patterns">
          <div className="data-toolbar">
            <span className="data-toolbar-title">Pattern activity</span>
            <button className="data-refresh" type="button" onClick={() => void refresh()}>Refresh</button>
          </div>
          {error && data && <p className="data-warning" role="status">Connection lost. Showing last updated data.</p>}
          {loading && !data ? (
            <div className="data-state" aria-live="polite">Loading detected patterns…</div>
          ) : error && !data ? (
            <div className="data-state data-error" role="alert">Could not load patterns. Use Refresh to try again.</div>
          ) : !data?.patterns.length ? (
            <div className="data-state">No patterns have been reported yet.</div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Pattern</th><th>Reports</th><th>Average confidence</th></tr></thead>
                <tbody>
                  {data.patterns.map((pattern) => (
                    <tr key={pattern.pattern_type}>
                      <td>{pattern.pattern_type.replaceAll("_", " ")}</td>
                      <td>{pattern.count}</td>
                      <td>{Math.round(pattern.average_confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}
