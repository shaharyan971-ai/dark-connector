const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://dark-connector-production.up.railway.app"
);

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

export type Overview = {
  total_patterns: number;
  sites_scanned: number;
  average_risk: number;
  pattern_breakdown: {
    pattern_type: string;
    count: number;
    percentage: number;
  }[];
  recent_activity: {
    site_url: string;
    domain: string;
    pattern_type: string;
    confidence: number;
    created_at: string;
  }[];
};

export type SiteRange = "24h" | "7d" | "30d";

export type SiteEntry = {
  domain: string;
  score: number;
  total_flags: number;
  confirmed_flags: number;
  last_scanned: string | null;
};

export type SitesResponse = {
  sites: SiteEntry[];
  range: SiteRange;
};

export type PatternsResponse = {
  patterns: {
    pattern_type: string;
    count: number;
    average_confidence: number;
  }[];
};

export type AlertsResponse = {
  alerts: {
    id: string;
    site_url: string;
    pattern_type: string;
    severity: string;
    message: string;
    created_at: string;
    read: boolean;
  }[];
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export type ProfileUpdate = {
  name: string;
  email: string;
};

export type Settings = {
  notify_high_risk: boolean;
  risk_threshold: number;
  default_range: SiteRange;
  analytics_consent: boolean;
};

export type SettingsUpdate = Settings;

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

async function fetchApi<T>(
  path: string,
  label: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...options,
  });
  if (!response.ok) {
    throw new Error(`${label} request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export function getOverview(): Promise<Overview> {
  return fetchApi("/api/overview", "Overview");
}

export function getSites(options: {
  search?: string;
  sort?: "domain" | "score" | "total_flags" | "confirmed_flags";
  range?: SiteRange;
} = {}): Promise<SitesResponse> {
  const query = new URLSearchParams();
  if (options.search !== undefined) query.set("search", options.search);
  if (options.sort !== undefined) query.set("sort", options.sort);
  if (options.range !== undefined) query.set("range", options.range);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return fetchApi(`/api/sites${suffix}`, "Sites");
}

export function getPatterns(): Promise<PatternsResponse> {
  return fetchApi("/api/patterns", "Patterns");
}

export function getAlerts(): Promise<AlertsResponse> {
  return fetchApi("/api/alerts", "Alerts");
}

export function markAlertRead(alertId: string): Promise<{ id: string; read: boolean }> {
  return fetchApi(
    `/api/alerts/${encodeURIComponent(alertId)}/read`,
    "Mark alert read",
    { method: "PATCH" },
  );
}

export function getProfile(): Promise<Profile> {
  return fetchApi("/api/profile", "Profile");
}

export function updateProfile(payload: ProfileUpdate): Promise<Profile> {
  return fetchApi("/api/profile", "Profile update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getSettings(): Promise<Settings> {
  return fetchApi("/api/settings", "Settings");
}

export function updateSettings(payload: SettingsUpdate): Promise<Settings> {
  return fetchApi("/api/settings", "Settings update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
