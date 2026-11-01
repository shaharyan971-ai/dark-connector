"use client";

import { useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";

type Site = {
  domain: string;
  flags: number;
  confirmed: number;
  risk: number;
  tier: "high" | "med" | "low";
  firstSeen: string;
  lastScan: string;
  patterns: string;
};

type SortKey = "domain" | "flags" | "confirmed" | "risk";

const patternBreakdown = [
  { name: "Confirmshaming", pct: 34, color: "var(--violet-fg)" },
  { name: "Fake urgency", pct: 27, color: "var(--cyan-fg)" },
  { name: "Forced continuity", pct: 21, color: "var(--amber-fg)" },
  { name: "Hidden costs", pct: 18, color: "var(--rose-fg)" },
];

const activityFeed = [
  {
    color: "var(--rose-fg)",
    text: < >New high-risk pattern flagged on <b>booking.com</b></>,
    time: "2 min ago",
  },
  {
    color: "var(--cyan-fg)",
    text: <><b>flipkart.com</b> re-scanned, 3 patterns cleared</>,
    time: "18 min ago",
  },
  {
    color: "var(--emerald-fg)",
    text: <>Scan completed for 12 new domains</>,
    time: "1 hr ago",
  },
  {
    color: "var(--violet-fg)",
    text: <><b>amazon.in</b> added to watchlist</>,
    time: "3 hr ago",
  },
];

function SortArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function TrendArrow({ down = false }: { down?: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      {down ? <path d="M17 7 7 17M7 7v10h10" /> : <path d="M7 17 17 7M7 7h10v10" />}
    </svg>
  );
}

function Spark({ variant }: { variant: "violet" | "cyan" | "amber" | "emerald" }) {
  const paths = {
    violet: "M0,17 L20,14 L40,15 L60,10 L80,11 L100,6 L120,7 L140,3 L160,4",
    cyan: "M0,16 L20,16 L40,13 L60,14 L80,11 L100,12 L120,8 L140,9 L160,6",
    amber: "M0,8 L20,10 L40,7 L60,11 L80,9 L100,13 L120,11 L140,15 L160,14",
    emerald: "M0,11 L20,10 L40,12 L60,9 L80,11 L100,8 L120,10 L140,7 L160,9",
  };
  const path = paths[variant];
  return (
    <svg className="spark" viewBox="0 0 160 22" preserveAspectRatio="none" aria-hidden="true">
      <path className="fill" d={`${path} L160,22 L0,22 Z`} style={{ fill: `var(--${variant}-fg)` }} />
      <path d={path} style={{ stroke: `var(--${variant}-fg)` }} />
    </svg>
  );
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [range, setRange] = useState("24h");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState(1);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState(false);
  const [counters, setCounters] = useState({ patterns: 0, sites: 0, risk: 0 });
  const [statusReady, setStatusReady] = useState(false);
  const [animationsReady, setAnimationsReady] = useState(false);

  useEffect(() => {
    let active = true;
    getLeaderboard()
      .then((entries) => {
        if (!active) return;
        setSites(entries.map((entry) => ({
          domain: entry.domain,
          flags: entry.totalFlags,
          confirmed: entry.confirmedFlags,
          risk: entry.score,
          tier: entry.score >= 90 ? "high" : entry.score >= 75 ? "med" : "low",
          firstSeen: "—",
          lastScan: "—",
          patterns: "—",
        })));
        setSitesError(false);
      })
      .catch(() => {
        if (active) setSitesError(true);
      })
      .finally(() => {
        if (active) setSitesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = { patterns: 247, sites: 83, risk: 80 };
    const start = performance.now();
    let counterFrame = 0;

    const animateCounters = (now: number) => {
      const progress = reducedMotion ? 1 : Math.min((now - start) / 1300, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCounters({
        patterns: Math.round(eased * targets.patterns),
        sites: Math.round(eased * targets.sites),
        risk: Math.round(eased * targets.risk),
      });
      if (progress < 1) counterFrame = requestAnimationFrame(animateCounters);
    };

    counterFrame = requestAnimationFrame(animateCounters);
    const statusTimer = window.setTimeout(() => setStatusReady(true), reducedMotion ? 0 : 500);
    const animationTimer = window.setTimeout(() => setAnimationsReady(true), reducedMotion ? 0 : 200);

    return () => {
      cancelAnimationFrame(counterFrame);
      window.clearTimeout(statusTimer);
      window.clearTimeout(animationTimer);
    };
  }, []);

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
              <div className="kpi-trend up"><TrendArrow />12%</div>
            </div>
            <div className="kpi-lbl">TOTAL PATTERNS</div>
            <div className="kpi-num">{counters.patterns}</div>
            <div className="kpi-sub">detected signals</div>
            <Spark variant="violet" />
          </div>

          <div className="panel kpi-card" role="group" aria-label="Sites scanned">
            <div className="kpi-top">
              <div className="kpi-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" /></svg></div>
              <div className="kpi-trend up"><TrendArrow />5%</div>
            </div>
            <div className="kpi-lbl">SITES SCANNED</div>
            <div className="kpi-num">{counters.sites}</div>
            <div className="kpi-sub">unique domains</div>
            <Spark variant="cyan" />
          </div>

          <div className="panel kpi-card" role="group" aria-label="Average risk score">
            <div className="kpi-top">
              <div className="kpi-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10.5 20.5 1.5-1.5m0 0L18 13m-6 6L6 13m6 6V4" /><path d="M4 4h16" /></svg></div>
              <div className="kpi-trend down"><TrendArrow down />3%</div>
            </div>
            <div className="kpi-lbl">AVG RISK SCORE</div>
            <div className="kpi-num">{counters.risk}</div>
            <div className="kpi-sub">across all sites</div>
            <Spark variant="amber" />
          </div>

          <div className="panel kpi-card" role="group" aria-label="Monitor status">
            <div className="kpi-top"><div className="kpi-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg></div></div>
            <div className="kpi-lbl">MONITOR STATUS</div>
            <div className="kpi-num emerald">{statusReady ? "ACTIVE" : "—"}</div>
            <div className="kpi-sub">last sync: {statusReady ? "just now" : "—"}</div>
            <Spark variant="emerald" />
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
                {["24h", "7d", "30d"].map((option) => <button type="button" className={`range-btn${range === option ? " active" : ""}`} key={option} onClick={() => setRange(option)}>{option}</button>)}
              </div>
            </div>

            <div>
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
                        {isExpanded && <div className="row-detail"><div><b>FIRST SEEN</b>{site.firstSeen || "—"}</div><div><b>LAST SCAN</b>{site.lastScan || "—"}</div><div><b>PATTERNS FOUND</b>{site.patterns || "—"}</div></div>}
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
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><div className="titles"><div className="eyebrow">LIVE FEED</div><h2>Recent activity</h2></div></div>
              <div>
                {activityFeed.map((activity, index) => (
                  <div className="activity-item" key={`${activity.time}-${index}`}>
                    <div className="activity-dot" style={{ background: activity.color }} />
                    <div><div className="activity-text">{activity.text}</div><div className="activity-time">{activity.time}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="page-foot"><span>DC // DARK CONNECTOR</span><span>API LINK ESTABLISHED</span></footer>
      </div>
    </DashboardShell>
  );
}