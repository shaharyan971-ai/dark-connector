"use client";

import { useEffect, useRef, useState } from "react";
import { getOverview, getSites, type SiteRange } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import usePolling from "@/lib/usePolling";

type Site = {
  domain: string;
  flags: number;
  confirmed: number;
  risk: number;
  tier: "high" | "med" | "low";
  lastScan: string;
  patterns: string;
};

type SortKey = "domain" | "flags" | "confirmed" | "risk";

const activityColors = ["var(--rose-fg)", "var(--cyan-fg)", "var(--emerald-fg)", "var(--violet-fg)"];
const patternColors = ["var(--violet-fg)", "var(--cyan-fg)", "var(--amber-fg)", "var(--rose-fg)"];

function parseUtcDate(value: string) {
  return new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
}

function formatRelativeTime(value: string) {
  const date = parseUtcDate(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function SortArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [range, setRange] = useState<SiteRange>("24h");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState(1);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [counters, setCounters] = useState({ patterns: 0, sites: 0, risk: 0 });
  const countersRef = useRef(counters);
  const rangeRef = useRef(range);
  const overviewPolling = usePolling((signal) => getOverview(signal));
  const {
    data: sitesData,
    error: sitesPollingError,
    loading: sitesPollingLoading,
    refresh: refreshSites,
  } = usePolling((signal) => getSites({ range }, signal));
  const sites: Site[] = (sitesData?.sites ?? []).map((entry) => ({
    domain: entry.domain,
    flags: entry.total_flags,
    confirmed: entry.confirmed_flags,
    risk: entry.score,
    tier: entry.score >= 90 ? "high" : entry.score >= 75 ? "med" : "low",
    lastScan: entry.last_scanned
      ? parseUtcDate(entry.last_scanned).toLocaleString()
      : "—",
    patterns: `${entry.total_flags} reports`,
  }));
  const sitesLoading = sitesPollingLoading && !sitesData;
  const sitesError = Boolean(sitesPollingError && !sitesData);
  const statusReady = Boolean(overviewPolling.data);
  const animationsReady = Boolean(overviewPolling.data);

  useEffect(() => {
    if (rangeRef.current === range) return;
    rangeRef.current = range;
    void refreshSites();
  }, [range, refreshSites]);

  useEffect(() => {
    if (!overviewPolling.data) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = {
      patterns: overviewPolling.data.total_patterns,
      sites: overviewPolling.data.sites_scanned,
      risk: Math.round(overviewPolling.data.average_risk),
    };
    const start = performance.now();
    const initial = countersRef.current;
    let counterFrame = 0;

    const animateCounters = (now: number) => {
      const progress = reducedMotion ? 1 : Math.min((now - start) / 1300, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = {
        patterns: Math.round(initial.patterns + eased * (targets.patterns - initial.patterns)),
        sites: Math.round(initial.sites + eased * (targets.sites - initial.sites)),
        risk: Math.round(initial.risk + eased * (targets.risk - initial.risk)),
      };
      countersRef.current = next;
      setCounters(next);
      if (progress < 1) counterFrame = requestAnimationFrame(animateCounters);
    };

    counterFrame = requestAnimationFrame(animateCounters);
    return () => {
      cancelAnimationFrame(counterFrame);
    };
  }, [overviewPolling.data]);

  const filteredSites = sites
    .filter((site) => site.domain.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice()
    .sort((first, second) => {
      if (!sortKey) return 0;
      const firstValue = first[sortKey];
      const secondValue = second[sortKey];
      if (typeof firstValue === "string" && typeof secondValue === "string") {
        return firstValue.localeCompare(secondValue) * sortDir;
      }
      return (Number(firstValue) - Number(secondValue)) * sortDir;
    });

  const handleSort = (key: SortKey) => {
    setSortDir(sortKey === key ? -sortDir : 1);
    setSortKey(key);
  };

  const renderSortButton = (label: string, key: SortKey) => (
    <button
      type="button"
      className={`sort-btn${sortKey === key ? ` active dir-${sortDir === 1 ? "asc" : "desc"}` : ""}`}
      aria-label={`Sort by ${label}`}
      onClick={() => handleSort(key)}
    >
      {label}<SortArrow />
    </button>
  );
  const patternBreakdown = (overviewPolling.data?.pattern_breakdown ?? []).map(
    (pattern, index) => ({
      name: pattern.pattern_type.replace(/_/g, " "),
      pct: pattern.percentage,
      color: patternColors[index % patternColors.length],
    }),
  );
  const activityFeed = (overviewPolling.data?.recent_activity ?? []).map(
    (activity, index) => ({
      color: activityColors[index % activityColors.length],
      domain: activity.domain,
      pattern: activity.pattern_type.replace(/_/g, " "),
      time: formatRelativeTime(activity.created_at),
    }),
  );
  const ranges: SiteRange[] = ["24h", "7d", "30d"];

  return (
    <DashboardShell>
      <div className="content">
        <div className="page-head">
          <div className="eyebrow">NETWORK OVERVIEW</div>
          <h1>Manipulation patterns, <em>made visible.</em></h1>
          <p>A live readout of deceptive interface signals detected across the web in real time.</p>
        </div>

        <div className="kpi-row">
          <div className="panel kpi-card accent" role="group" aria-label="Total patterns detected">
            <div className="kpi-top">
              <div className="kpi-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg></div>
            </div>
            <div className="kpi-lbl">TOTAL PATTERNS</div>
            <div className="kpi-num">{overviewPolling.data ? counters.patterns : "—"}</div>
            <div className="kpi-sub">detected signals</div>
          </div>

          <div className="panel kpi-card" role="group" aria-label="Sites scanned">
            <div className="kpi-top">
              <div className="kpi-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" /></svg></div>
            </div>
            <div className="kpi-lbl">SITES SCANNED</div>
            <div className="kpi-num">{overviewPolling.data ? counters.sites : "—"}</div>
            <div className="kpi-sub">unique domains</div>
          </div>

          <div className="panel kpi-card" role="group" aria-label="Average risk score">
            <div className="kpi-top">
              <div className="kpi-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10.5 20.5 1.5-1.5m0 0L18 13m-6 6L6 13m6 6V4" /><path d="M4 4h16" /></svg></div>
            </div>
            <div className="kpi-lbl">AVG RISK SCORE</div>
            <div className="kpi-num">{overviewPolling.data ? counters.risk : "—"}</div>
            <div className="kpi-sub">across all sites</div>
          </div>

          <div className="panel kpi-card" role="group" aria-label="Monitor status">
            <div className="kpi-top"><div className="kpi-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg></div></div>
            <div className="kpi-lbl">MONITOR STATUS</div>
            <div className={`kpi-num${overviewPolling.error ? "" : " emerald"}`} aria-live="polite">
              {overviewPolling.error ? "STALE" : statusReady ? "ACTIVE" : "—"}
            </div>
            <div className="kpi-sub">
              {overviewPolling.lastUpdated
                ? `last sync: ${formatRelativeTime(overviewPolling.lastUpdated.toISOString())}`
                : "waiting for API"}
            </div>
          </div>
        </div>

        <div className="main-grid">
          <div className="panel leaderboard-panel">
            <div className="panel-head">
              <div className="titles"><div className="eyebrow">RISK INDEX</div><h2>Site leaderboard</h2></div>
              <span className="count">{filteredSites.length} RECORD{filteredSites.length === 1 ? "" : "S"}</span>
            </div>

            <div className="toolbar-new">
              <div className="search-box">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
                <input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.currentTarget.value)} placeholder="Search domain…" aria-label="Search sites by domain" />
              </div>
              <div className="range-group" role="group" aria-label="Time range">
                {ranges.map((option) => <button type="button" className={`range-btn${range === option ? " active" : ""}`} key={option} onClick={() => setRange(option)}>{option}</button>)}
              </div>
            </div>

            <div>
              {sitesPollingError && sitesData && (
                <div className="empty-state data-error" role="status">
                  Connection lost. Showing last updated sites.
                </div>
              )}
              {sitesLoading ? (
                <div className="empty-state"><div className="title">LOADING SITE REPORTS</div></div>
              ) : sitesError ? (
                <div className="empty-state"><div className="title">SITE REPORTS UNAVAILABLE</div><div className="sub">Check the API connection and try again</div></div>
              ) : sites.length === 0 ? (
                <div className="empty-state"><div className="icon">◉</div><div className="title">NO SITE REPORTS YET</div><div className="sub">Detections will appear here as data flows in</div></div>
              ) : (
                <>
                  <div className="table-head">
                    <span>#</span><span>{renderSortButton("DOMAIN", "domain")}</span><span>{renderSortButton("FLAGS", "flags")}</span><span>{renderSortButton("CONFIRMED", "confirmed")}</span><span>{renderSortButton("RISK", "risk")}</span>
                  </div>
                  {filteredSites.length === 0 ? (
                    <div className="empty-state"><div className="icon">◉</div><div className="title">NO MATCHES</div><div className="sub">Try a different search term</div></div>
                  ) : filteredSites.map((site, index) => {
                    const isExpanded = expandedDomain === site.domain;
                    return (
                      <div key={site.domain}>
                        <div
                          className="table-row"
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          aria-label={`${site.domain}, risk score ${site.risk}, expand for details`}
                          onClick={() => setExpandedDomain(isExpanded ? null : site.domain)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setExpandedDomain(isExpanded ? null : site.domain);
                            }
                          }}
                        >
                          <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                          <span className="domain-cell"><span className="favicon-dot">{site.domain.charAt(0).toUpperCase()}</span><span className="domain">{site.domain}</span></span>
                          <span className="flags">{site.flags}</span>
                          <span className="flags">{site.confirmed}</span>
                          <span><span className={`score-pill pill-${site.tier}`}>{site.risk}</span></span>
                        </div>
                        {isExpanded && <div className="row-detail"><div><b>LAST SCAN</b>{site.lastScan || "—"}</div><div><b>PATTERN REPORTS</b>{site.patterns || "—"}</div></div>}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div className="side-col">
            <div className="panel">
              <div className="panel-head"><div className="titles"><div className="eyebrow">DETECTED</div><h2>Pattern breakdown</h2></div></div>
              <div>
                {patternBreakdown.map((pattern) => (
                  <div className="breakdown-item" key={pattern.name}>
                    <div className="breakdown-row"><span className="name">{pattern.name}</span><span className="pct">{pattern.pct}%</span></div>
                    <div className="bar-track"><div className="bar-fill" style={{ background: pattern.color, width: animationsReady ? `${pattern.pct}%` : "0%" }} /></div>
                  </div>
                ))}
                {!overviewPolling.loading && patternBreakdown.length === 0 && (
                  <div className="empty-state"><div className="sub">No pattern reports yet</div></div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><div className="titles"><div className="eyebrow">LIVE FEED</div><h2>Recent activity</h2></div></div>
              <div>
                {activityFeed.map((activity, index) => (
                  <div className="activity-item" key={`${activity.domain}-${activity.time}-${index}`}>
                    <div className="activity-dot" style={{ background: activity.color }} />
                    <div><div className="activity-text"><b>{activity.domain}</b> · {activity.pattern}</div><div className="activity-time">{activity.time}</div></div>
                  </div>
                ))}
                {!overviewPolling.loading && activityFeed.length === 0 && (
                  <div className="empty-state"><div className="sub">No recent activity yet</div></div>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="page-foot"><span>DC // DARK CONNECTOR</span><span>{overviewPolling.error ? "API CONNECTION DEGRADED" : overviewPolling.data ? "API LINK ESTABLISHED" : "CONNECTING TO API"}</span></footer>
      </div>
    </DashboardShell>
  );
}