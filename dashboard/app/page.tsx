import { getLeaderboard, getStats, type LeaderboardEntry } from "@/lib/api";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-mark">--</span>
        <p>No site reports have been recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Domain</th>
            <th>Flags</th>
            <th>Confirmed</th>
            <th>Risk score</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.domain}-${index}`}>
              <td className="rank">{String(index + 1).padStart(2, "0")}</td>
              <td className="domain">{entry.domain}</td>
              <td>{formatNumber(entry.totalFlags)}</td>
              <td>{formatNumber(entry.confirmedFlags)}</td>
              <td><span className="score">{entry.score}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Home() {
  const [statsResult, leaderboardResult] = await Promise.allSettled([
    getStats(),
    getLeaderboard(),
  ]);
  const stats = statsResult.status === "fulfilled"
    ? statsResult.value
    : { totalPatterns: 0, sitesScanned: 0 };
  const leaderboard = leaderboardResult.status === "fulfilled"
    ? leaderboardResult.value
    : [];

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SURVEILLANCE CONSOLE / V1.0</p>
          <h1>🕵️ Dark Connector</h1>
        </div>
        <div className="live-status"><span /> SYSTEM ONLINE</div>
      </header>

      <section className="intro">
        <p className="eyebrow">NETWORK OVERVIEW</p>
        <h2>Manipulation patterns,<br /><em>made visible.</em></h2>
        <p className="intro-copy">A live readout of deceptive interface signals detected across the web.</p>
      </section>

      <section className="stats-grid" aria-label="Overview statistics">
        <article className="stat-card accent-card">
          <span className="stat-label">TOTAL PATTERNS</span>
          <strong>{formatNumber(stats.totalPatterns)}</strong>
          <span className="stat-note">detected signals</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">SITES SCANNED</span>
          <strong>{formatNumber(stats.sitesScanned)}</strong>
          <span className="stat-note">unique domains</span>
        </article>
        <article className="stat-card status-card">
          <span className="stat-label">MONITOR STATUS</span>
          <strong>ACTIVE</strong>
          <span className="stat-note">last sync: just now</span>
        </article>
      </section>

      <section className="leaderboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RISK INDEX</p>
            <h2>Site leaderboard</h2>
          </div>
          <span className="record-count">{leaderboard.length} RECORDS</span>
        </div>
        <Leaderboard entries={leaderboard} />
      </section>

      <footer><span>DC // DARK CONNECTOR</span><span>API LINK ESTABLISHED</span></footer>
    </main>
  );
}
