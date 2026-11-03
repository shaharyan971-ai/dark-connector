"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import DashboardShell from "@/components/DashboardShell";
import {
  ApiRequestError,
  getAlerts,
  getOverview,
  getProfile,
  getSettings,
  updateProfile,
  type Profile,
  type ProfileUpdate,
} from "@/lib/api";
import usePolling from "@/lib/usePolling";

type ProfileDashboardData = {
  profile: Profile;
  unreadAlerts: number;
  sitesScanned: number;
  totalPatterns: number;
  riskThreshold: number;
};

type ProfileFields = {
  name: string;
  email: string;
};

type ProfileFieldErrors = Partial<Record<keyof ProfileFields, string>>;

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "DC";
}

function parseBackendDate(value: string) {
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

function formatMemberSince(value: string) {
  const date = parseBackendDate(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function validateProfile(values: ProfileFields): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();

  if (!name) errors.name = "Name is required.";
  else if (name.length > 120) errors.name = "Name must be 120 characters or fewer.";

  if (!email) errors.email = "Email is required.";
  else if (email.length > 255) errors.email = "Email must be 255 characters or fewer.";
  else if (email.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

function backendFieldErrors(error: ApiRequestError): ProfileFieldErrors {
  if (error.status !== 422) return {};

  try {
    const body: unknown = JSON.parse(error.responseBody);
    if (
      typeof body !== "object" ||
      body === null ||
      !("detail" in body) ||
      !Array.isArray(body.detail)
    ) {
      return {};
    }

    const errors: ProfileFieldErrors = {};
    for (const issue of body.detail) {
      if (typeof issue !== "object" || issue === null || !("loc" in issue)) continue;
      const location = issue.loc;
      if (!Array.isArray(location) || !("msg" in issue) || typeof issue.msg !== "string") continue;
      const field = location.find(
        (part: unknown): part is keyof ProfileFields =>
          part === "name" || part === "email",
      );
      if (field) errors[field] = issue.msg;
    }
    return errors;
  } catch (caught) {
    if (caught instanceof SyntaxError) return {};
    throw caught;
  }
}

function ProfileSkeleton() {
  return (
    <>
      <div className="profile-layout" aria-label="Loading profile">
        <div className="panel profile-card">
          <div className="profile-skeleton profile-avatar" />
          <div>
            <div className="profile-skeleton profile-skeleton-line" />
            <div className="profile-skeleton profile-skeleton-line" />
          </div>
        </div>
        <div className="panel profile-form-card">
          <div className="profile-skeleton profile-skeleton-line" />
          <div className="profile-skeleton profile-skeleton-line" />
          <div className="profile-skeleton profile-skeleton-line" />
        </div>
      </div>
      <div className="profile-summary-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="panel profile-summary-card" key={index}>
            <div className="profile-skeleton profile-skeleton-line" />
            <div className="profile-skeleton profile-skeleton-large" />
          </div>
        ))}
      </div>
    </>
  );
}

export default function ProfilePage() {
  const fetchProfileDashboard = useCallback(
    async (signal: AbortSignal): Promise<ProfileDashboardData> => {
      const [profile, alerts, overview, settings] = await Promise.all([
        getProfile(signal),
        getAlerts(signal),
        getOverview(signal),
        getSettings(signal),
      ]);
      return {
        profile,
        unreadAlerts: alerts.alerts.filter((alert) => !alert.read).length,
        sitesScanned: overview.sites_scanned,
        totalPatterns: overview.total_patterns,
        riskThreshold: settings.risk_threshold,
      };
    },
    [],
  );
  const { data, error, loading, lastUpdated, refresh } =
    usePolling(fetchProfileDashboard);
  const [editedValues, setEditedValues] = useState<ProfileFields | null>(null);
  const [savedValues, setSavedValues] = useState<ProfileFields | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [saveMessage, setSaveMessage] = useState("");
  const [saveResult, setSaveResult] = useState<"success" | "error" | "">("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(0);

  const values = editedValues ?? {
    name: data?.profile.name ?? "",
    email: data?.profile.email ?? "",
  };
  const baselineValues = savedValues ?? (data
    ? { name: data.profile.name, email: data.profile.email }
    : null);
  const dirty =
    baselineValues !== null &&
    (values.name !== baselineValues.name || values.email !== baselineValues.email);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleFieldChange = (field: keyof ProfileFields, value: string) => {
    setEditedValues({ ...values, [field]: value });
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSaveMessage("");
    setSaveResult("");
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    const currentProfile = data.profile;
    const errors = validateProfile(values);
    setFieldErrors(errors);
    setSaveMessage("");
    setSaveResult("");
    if (Object.keys(errors).length > 0) return;

    const payload: ProfileUpdate = {
      name: values.name.trim(),
      email: values.email.trim(),
    };
    setSaving(true);
    try {
      let confirmationRequired = false;
      let profilePayload = payload;
      if (currentProfile.email.toLowerCase() !== payload.email.toLowerCase()) {
        const emailResponse = await fetch("/api/auth/change-email", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: payload.email }),
        });
        const emailResult = (await emailResponse.json()) as {
          currentEmail?: string | null;
          confirmationRequired?: boolean;
          error?: string;
        };
        if (!emailResponse.ok) {
          throw new Error(emailResult.error ?? `Email update failed (${emailResponse.status}).`);
        }
        confirmationRequired = emailResult.confirmationRequired === true;
        profilePayload = {
          ...payload,
          email: emailResult.currentEmail ?? currentProfile.email,
        };
      }
      const savedProfile = await updateProfile(profilePayload);
      const refreshed = await refresh();
      const nextValues = refreshed
        ? { name: refreshed.profile.name, email: refreshed.profile.email }
        : { name: savedProfile.name, email: savedProfile.email };
      setEditedValues(nextValues);
      setSavedValues(nextValues);
      setFieldErrors({});
      setSaveMessage(
        confirmationRequired
          ? "Name saved. Confirm the new email using the link sent to that address."
          : refreshed
            ? "Profile saved."
            : "Profile saved. Refresh confirmation is unavailable.",
      );
      setSaveResult("success");
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        const backendErrors = backendFieldErrors(caught);
        if (caught.status === 409) {
          backendErrors.email = "That email is already in use.";
        }
        setFieldErrors(backendErrors);
      }
      setSaveMessage(
        caught instanceof Error ? caught.message : "Could not save your profile.",
      );
      setSaveResult("error");
    } finally {
      setSaving(false);
    }
  };

  const ageInSeconds = lastUpdated
    ? Math.max(0, Math.floor((now - lastUpdated.getTime()) / 1_000))
    : null;

  return (
    <DashboardShell>
      <main className="content">
        <header className="page-head">
          <div className="eyebrow">ACCOUNT</div>
          <h1>Profile</h1>
          <p>View and update your local account details and dashboard activity.</p>
        </header>

        <p className="profile-status" aria-live="polite">
          <span
            className={`profile-live-dot${error ? " stale" : !data ? " pending" : ""}`}
            aria-hidden="true"
          />
          {error
            ? "Connection lost, retrying"
            : ageInSeconds === null
              ? "Connecting"
              : `Updated ${ageInSeconds}s ago`}
        </p>
        {error && data && <p className="profile-stale">Showing the last available data; it may be stale.</p>}

        {loading && !data ? (
          <ProfileSkeleton />
        ) : !data ? (
          <div className="panel profile-error-panel" role="status">
            Could not load profile data.{" "}
            <button className="profile-save" type="button" onClick={() => void refresh()}>
              Retry now
            </button>
          </div>
        ) : (
          <>
            <div className="profile-layout">
              <section className="panel profile-card" aria-label="Profile details">
                <div className="profile-avatar" aria-hidden="true">
                  {initialsFor(data.profile.name)}
                </div>
                <div>
                  <h2 className="profile-name">{data.profile.name}</h2>
                  <p className="profile-email">{data.profile.email}</p>
                  <p className="profile-member">
                    Member since {formatMemberSince(data.profile.created_at)}
                  </p>
                </div>
              </section>

              <section className="panel profile-form-card">
                <h2>Edit profile</h2>
                <form className="profile-form" onSubmit={handleSave} noValidate>
                  <div className="profile-field">
                    <label htmlFor="profile-name">Name</label>
                    <input
                      id="profile-name"
                      name="name"
                      autoComplete="name"
                      value={values.name}
                      maxLength={120}
                      required
                      disabled={saving}
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? "profile-name-error" : undefined}
                      onChange={(event) => handleFieldChange("name", event.target.value)}
                    />
                    {fieldErrors.name && (
                      <p className="profile-field-error" id="profile-name-error">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="profile-field">
                    <label htmlFor="profile-email">Email</label>
                    <input
                      id="profile-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={values.email}
                      maxLength={255}
                      required
                      disabled={saving}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? "profile-email-error" : undefined}
                      onChange={(event) => handleFieldChange("email", event.target.value)}
                    />
                    {fieldErrors.email && (
                      <p className="profile-field-error" id="profile-email-error">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                  <div className="profile-form-footer">
                    <button className="profile-save" type="submit" disabled={saving || !dirty}>
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <p
                      className={`profile-result${saveResult ? ` ${saveResult}` : ""}`}
                      aria-live="polite"
                    >
                      {saveMessage}
                    </p>
                  </div>
                </form>
              </section>
            </div>

            <section className="profile-summary-grid" aria-label="Activity summary">
              <div className="panel profile-summary-card">
                <p className="profile-summary-label">UNREAD ALERTS</p>
                <p className="profile-summary-value">{data.unreadAlerts}</p>
              </div>
              <div className="panel profile-summary-card">
                <p className="profile-summary-label">SITES SCANNED</p>
                <p className="profile-summary-value">{data.sitesScanned}</p>
              </div>
              <div className="panel profile-summary-card">
                <p className="profile-summary-label">TOTAL PATTERNS</p>
                <p className="profile-summary-value">{data.totalPatterns}</p>
              </div>
              <div className="panel profile-summary-card">
                <p className="profile-summary-label">RISK THRESHOLD</p>
                <p className="profile-summary-value">{data.riskThreshold}</p>
                <Link className="profile-summary-link" href="/settings">
                  Manage settings
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
}
