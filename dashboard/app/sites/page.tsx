"use client";

import { useMemo, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { getSites } from "@/lib/api";
import usePolling from "@/lib/usePolling";

export default function SitesPage() {
  const { data, error, loading, refresh } = usePolling((signal) => getSites({}, signal));
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"domain" | "score" | "total_flags">("score");
  const sites = useMemo(() => {
    const filtered = (data?.sites ?? []).filter((site) =>
      site.domain.toLowerCase().includes(query.trim().toLowerCase()),
    );
    return filtered.sort((first, second) =>
      sortBy === "domain"
        ? first.domain.localeCompare(second.domain)
        : second[sortBy] - first[sortBy],
    );
  }, [data, query, sortBy]);

  return (
    <DashboardShell>
      <main className="content">
        <header className="page-head">
          <div className="eyebrow">MONITORED DOMAINS</div>
          <h1>Sites</h1>
          <p>Review websites monitored for deceptive interface patterns.</p>
        </header>
        <section className="panel data-panel" aria-label="Monitored sites">
          <div className="data-toolbar">
            <label className="data-search-label" htmlFor="site-search">Search domains</label>
            <input
              id="site-search"
              className="data-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search domains…"
            />
            <label htmlFor="site-sort">Sort by</label>
            <select id="site-sort" value={sortBy} onChange={(event) =>
              setSortBy(event.target.value as typeof sortBy)
            }>
              <option value="score">Risk score</option>
              <option value="total_flags">Total flags</option>
              <option value="domain">Domain</option>
            </select>
            <button className="data-refresh" type="button" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
          {error && data && <p className="data-warning" role="status">Connection lost. Showing last updated data.</p>}
          {loading && !data ? (
            <div className="data-state" aria-live="polite">Loading monitored sites…</div>
          ) : error && !data ? (
            <div className="data-state data-error" role="alert">Could not load sites. Use Refresh to try again.</div>
          ) : sites.length === 0 ? (
            <div className="data-state">No monitored sites{query ? " match your search" : " yet"}.</div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Domain</th><th>Risk score</th><th>Flags</th><th>Confirmed</th><th>Last scanned</th></tr></thead>
                <tbody>
                  {sites.map((site) => (
                    <tr key={site.domain}>
                      <td>{site.domain}</td>
                      <td>{Math.round(site.score)}</td>
                      <td>{site.total_flags}</td>
                      <td>{site.confirmed_flags}</td>
                      <td>{site.last_scanned ? new Date(`${site.last_scanned}${/[zZ]|[+-]\d{2}:\d{2}$/.test(site.last_scanned) ? "" : "Z"}`).toLocaleString() : "—"}</td>
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
