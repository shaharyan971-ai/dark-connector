"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: { name?: string };
};

type AuthMode = "sign-in" | "sign-up";

async function responseMessage(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return `Request failed (${response.status}).`;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as { user?: AuthUser | null };
      setConnectionError("");
      setUser(result.user ?? null);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Could not check your session.",
      );
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void checkSession(), 0);
    const authError = new URLSearchParams(window.location.search).get("authError");
    const authErrorTimer = authError
      ? window.setTimeout(() => {
          setFormError(
        authError === "invalid-link"
          ? "This account link is invalid or expired."
          : authError === "confirmation-failed"
            ? "Email confirmation failed or the link has expired."
            : "Authentication service is unavailable. Try again.",
          );
        }, 0)
      : undefined;
    const timer = window.setInterval(() => void checkSession(), 5 * 60 * 1_000);
    const onFocus = () => void checkSession();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(timer);
      if (authErrorTimer !== undefined) window.clearTimeout(authErrorTimer);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkSession]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setNotice("");
    setSubmitting(true);
    try {
      const endpoint = mode === "sign-in" ? "/api/auth/sign-in" : "/api/auth/sign-up";
      const payload =
        mode === "sign-in" ? { email, password } : { name, email, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        user?: AuthUser;
        confirmationRequired?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status}).`);
      if (result.confirmationRequired) {
        setNotice(result.message ?? "Check your email to confirm your account.");
      } else if (result.user) {
        setUser(result.user);
      } else {
        throw new Error("Authentication succeeded without a user session.");
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as { warning?: string };
      setUser(null);
      setEmail("");
      setPassword("");
      setNotice("");
      setFormError(result.warning ?? "");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not sign out.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestPasswordReset = async () => {
    setFormError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status}).`);
      setNotice(result.message ?? "If the address is registered, a recovery link will be sent.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not request password reset.");
    }
  };

  if (checking) {
    return <main className="auth-page" aria-live="polite">Checking your secure session…</main>;
  }

  if (connectionError) {
    return (
      <main className="auth-page">
        <section className="panel auth-card">
          <h1>Dark Connector</h1>
          <p className="auth-error">{connectionError}</p>
          <button className="profile-save" type="button" onClick={() => void checkSession()}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="panel auth-card">
          <div className="eyebrow">OBSIDIAN PULSE</div>
          <h1>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
          <p className="auth-description">
            Sign in to view your private Dark Connector monitoring data.
          </p>
          <form className="profile-form" onSubmit={submit}>
            {mode === "sign-up" && (
              <div className="profile-field">
                <label htmlFor="auth-name">Name</label>
                <input
                  id="auth-name"
                  name="name"
                  autoComplete="name"
                  maxLength={120}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            )}
            <div className="profile-field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={255}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="profile-field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                minLength={10}
                maxLength={1024}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {formError && <p className="profile-result error" role="alert">{formError}</p>}
            {notice && <p className="profile-result success" role="status">{notice}</p>}
            <button className="profile-save" type="submit" disabled={submitting}>
              {submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
            </button>
          </form>
          {mode === "sign-in" && (
            <button className="auth-mode-button" type="button" onClick={() => void requestPasswordReset()}>
              Forgot password? Email me a recovery link
            </button>
          )}
          <button
            className="auth-mode-button"
            type="button"
            onClick={() => {
              setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
              setFormError("");
              setNotice("");
            }}
          >
            {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <>
      {children}
      <button
        className="auth-signout"
        type="button"
        onClick={() => void signOut()}
        disabled={submitting}
        aria-label="Sign out"
      >
        {submitting ? "Signing out…" : `Sign out${user.email ? ` · ${user.email}` : ""}`}
      </button>
      {formError && <p className="auth-signout-error" role="alert">{formError}</p>}
    </>
  );
}
