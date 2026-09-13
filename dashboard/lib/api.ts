const API_URL = "https://dark-connector-production.up.railway.app";

export type DashboardStats = {
  totalPatterns: number;
  sitesScanned: number;
};

export type LeaderboardEntry = {
  domain: string;
  score: number;
  totalFlags: number;
  confirmedFlags: number;
};

type ApiStats = {
  total_patterns?: number;
  totalPatterns?: number;
  patterns_found?: number;
  sites_scanned?: number;
  sitesScanned?: number;
  sites?: number;
};

type ApiReport = {
  domain?: string;
  site_url?: string;
  siteUrl?: string;
  score?: number;
  total_flags?: number;
  totalFlags?: number;
  confirmed_flags?: number;
  confirmedFlags?: number;
};

function numberOrZero(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getStats(): Promise<DashboardStats> {
  const response = await fetch(`${API_URL}/`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Stats request failed with ${response.status}`);
  }

  const data = (await response.json()) as ApiStats;
  return {
    totalPatterns: numberOrZero(
      data.total_patterns ?? data.totalPatterns ?? data.patterns_found,
    ),
    sitesScanned: numberOrZero(
      data.sites_scanned ?? data.sitesScanned ?? data.sites,
    ),
  };
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await fetch(`${API_URL}/api/report`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Leaderboard request failed with ${response.status}`);
  }

  const data = (await response.json()) as ApiReport[] | { sites?: ApiReport[] };
  const reports = Array.isArray(data) ? data : data.sites ?? [];

  return reports
    .map((report) => ({
      domain: report.domain ?? report.site_url ?? report.siteUrl ?? "unknown site",
      score: numberOrZero(report.score),
      totalFlags: numberOrZero(report.total_flags ?? report.totalFlags),
      confirmedFlags: numberOrZero(
        report.confirmed_flags ?? report.confirmedFlags,
      ),
    }))
    .sort((first, second) => second.score - first.score);
}

export { API_URL };
