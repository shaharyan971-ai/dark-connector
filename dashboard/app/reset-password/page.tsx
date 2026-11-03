"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (password.length < 10 || password.length > 1024) {
      setError("Password must be between 10 and 1024 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status}).`);
      setMessage("Password updated.");
      setPassword("");
      setConfirmation("");
      window.setTimeout(() => router.replace("/profile"), 900);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <main className="content">
        <header className="page-head">
          <div className="eyebrow">ACCOUNT SECURITY</div>
          <h1>Reset password</h1>
          <p>Choose a new password for your account.</p>
        </header>
        <section className="panel auth-card">
          <form className="profile-form" onSubmit={submit}>
            <div className="profile-field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={1024}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="profile-field">
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={1024}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            {error && <p className="profile-result error" role="alert">{error}</p>}
            {message && <p className="profile-result success" role="status">{message}</p>}
            <button className="profile-save" type="submit" disabled={saving}>
              {saving ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>
      </main>
    </DashboardShell>
  );
}
