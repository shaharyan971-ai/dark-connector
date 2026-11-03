const API_URL = "/api/backend";

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

export type SiteDetails = {
  domain: string;
  score: number;
  total_flags: number;
  confirmed_flags: number;
  first_seen: string;
  last_scan: string;
  patterns_found: {
    pattern_type: string;
    confidence: number;
    confirmed: boolean;
    created_at: string;
  }[];
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

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

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
    const responseBody = await response.text();
    throw new ApiRequestError(
      `${label} request failed with ${response.status}`,
      response.status,
      responseBody,
    );
  }
  return (await response.json()) as T;
}

export function getOverview(signal?: AbortSignal): Promise<Overview> {
  return fetchApi("/api/overview", "Overview", { signal });
}

export function getSites(options: {
  search?: string;
  sort?: "domain" | "score" | "total_flags" | "confirmed_flags";
  range?: SiteRange;
} = {}, signal?: AbortSignal): Promise<SitesResponse> {
  const query = new URLSearchParams();
  if (options.search !== undefined) query.set("search", options.search);
  if (options.sort !== undefined) query.set("sort", options.sort);
  if (options.range !== undefined) query.set("range", options.range);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return fetchApi(`/api/sites${suffix}`, "Sites", { signal });
}

export function getSite(domain: string, signal?: AbortSignal): Promise<SiteDetails> {
  return fetchApi(`/api/sites/${encodeURIComponent(domain)}`, "Site", { signal });
}

export function getPatterns(signal?: AbortSignal): Promise<PatternsResponse> {
  return fetchApi("/api/patterns", "Patterns", { signal });
}

export function getAlerts(signal?: AbortSignal): Promise<AlertsResponse> {
  return fetchApi("/api/alerts", "Alerts", { signal });
}

export function markAlertRead(
  alertId: string,
  signal?: AbortSignal,
): Promise<{ id: string; read: boolean }> {
  return fetchApi(
    `/api/alerts/${encodeURIComponent(alertId)}/read`,
    "Mark alert read",
    { method: "PATCH", signal },
  );
}

export function getProfile(signal?: AbortSignal): Promise<Profile> {
  return fetchApi("/api/profile", "Profile", { signal });
}

export function updateProfile(
  payload: ProfileUpdate,
  signal?: AbortSignal,
): Promise<Profile> {
  return fetchApi("/api/profile", "Profile update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}

export function getSettings(signal?: AbortSignal): Promise<Settings> {
  return fetchApi("/api/settings", "Settings", { signal });
}

export function updateSettings(
  payload: SettingsUpdate,
  signal?: AbortSignal,
): Promise<Settings> {
  return fetchApi("/api/settings", "Settings update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}

export async function getStats(): Promise<DashboardStats> {
  const data = await fetchApi<Overview>("/api/overview", "Stats");
  return {
    totalPatterns: numberOrZero(data.total_patterns),
    sitesScanned: numberOrZero(data.sites_scanned),
  };
}

export async function getLeaderboard(signal?: AbortSignal): Promise<LeaderboardEntry[]> {
  const data = await fetchApi<ApiReport[] | { sites?: ApiReport[] }>(
    "/api/report",
    "Leaderboard",
    { signal },
  );
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
