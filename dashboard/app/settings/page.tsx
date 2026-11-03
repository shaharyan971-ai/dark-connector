"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import DashboardShell from "@/components/DashboardShell";
import { getSettings, updateSettings, type Settings } from "@/lib/api";
import usePolling from "@/lib/usePolling";

type SettingsForm = Settings;

export default function SettingsPage() {
  const fetchSettings = useCallback((signal: AbortSignal) => getSettings(signal), []);
  const { data, error, loading, refresh } = usePolling(fetchSettings);
  const [editedValues, setEditedValues] = useState<SettingsForm | null>(null);
  const [savedValues, setSavedValues] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const values = editedValues ?? data;
  const baselineValues = savedValues ?? data;
  const dirty = Boolean(values && baselineValues &&
    (values.notify_high_risk !== baselineValues.notify_high_risk ||
      values.risk_threshold !== baselineValues.risk_threshold ||
      values.default_range !== baselineValues.default_range ||
      values.analytics_consent !== baselineValues.analytics_consent));

  const change = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    if (!values) return;
    setEditedValues({ ...values, [key]: value });
    setMessage("");
    setSaveError(false);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values) return;
    setSaving(true);
    setMessage("");
    setSaveError(false);
    try {
      const updated = await updateSettings(values);
      setEditedValues(updated);
      setSavedValues(updated);
      setMessage("Settings saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not save settings.");
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <main className="content">
        <header className="page-head">
          <div className="eyebrow">PREFERENCES</div>
          <h1>Settings</h1>
          <p>Manage your alert threshold, dashboard range, and optional report sharing.</p>
        </header>
        {error && data && <p className="data-warning" role="status">Connection lost. Showing last updated settings.</p>}
        {loading && !data ? (
          <section className="panel data-panel" aria-live="polite">Loading your settings…</section>
        ) : error && !data ? (
          <section className="panel data-state data-error" role="alert">
            Could not load settings. <button className="data-refresh" type="button" onClick={() => void refresh()}>Retry</button>
          </section>
        ) : values ? (
          <form className="panel settings-form" onSubmit={save}>
            <section className="settings-option">
              <div>
                <h2>High-risk alerts</h2>
                <p>Receive an alert when a monitored site&apos;s risk score crosses your threshold.</p>
              </div>
              <label className="settings-toggle">
                <span className="sr-only">Enable high-risk alerts</span>
                <input
                  type="checkbox"
                  checked={values.notify_high_risk}
                  disabled={saving}
                  onChange={(event) => change("notify_high_risk", event.target.checked)}
                />
                <span aria-hidden="true" />
              </label>
            </section>
            <section className="settings-option settings-option-stack">
              <div>
                <label htmlFor="risk-threshold">Risk threshold</label>
                <p>Choose the score at which a site triggers a high-risk alert.</p>
              </div>
              <div className="settings-range">
                <input
                  id="risk-threshold"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={values.risk_threshold}
                  disabled={saving}
                  onChange={(event) => change("risk_threshold", Number(event.target.value))}
                />
                <output htmlFor="risk-threshold">{values.risk_threshold}</output>
              </div>
            </section>
            <section className="settings-option">
              <div>
                <label htmlFor="default-range">Default activity range</label>
                <p>Choose the reporting window used by default.</p>
              </div>
              <select
                id="default-range"
                value={values.default_range}
                disabled={saving}
                onChange={(event) => change("default_range", event.target.value as Settings["default_range"])}
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </section>
            <section className="settings-option">
              <div>
                <h2>Share reports from the extension</h2>
                <p>Allow the browser extension to send detected pattern metadata to your account.</p>
              </div>
              <label className="settings-toggle">
                <span className="sr-only">Allow extension report sharing</span>
                <input
                  type="checkbox"
                  checked={values.analytics_consent}
                  disabled={saving}
                  onChange={(event) => change("analytics_consent", event.target.checked)}
                />
                <span aria-hidden="true" />
              </label>
            </section>
            <div className="settings-footer">
              <button className="profile-save" type="submit" disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save settings"}
              </button>
              <p className={`profile-result${message ? saveError ? " error" : " success" : ""}`} aria-live="polite">
                {message}
              </p>
            </div>
            <Link href="/profile" className="profile-summary-link">Back to profile</Link>
          </form>
        ) : null}
      </main>
    </DashboardShell>
  );
}
