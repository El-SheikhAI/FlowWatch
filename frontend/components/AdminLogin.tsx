import { useState, useEffect, useCallback } from "react";
import { generatePassword, passwordStrength, type Strength } from "../lib/password";

interface Props {
  onLogin: (token: string) => void;
}

const strengthColors: Record<Strength, string> = {
  weak: "var(--red)",
  fair: "var(--yellow)",
  good: "#7ab648",
  strong: "var(--green)",
};

const strengthWidth: Record<Strength, string> = { weak: "25%", fair: "50%", good: "75%", strong: "100%" };

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" className="pw-copy" onClick={handle} title="Copy password">
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

export default function AdminLogin({ onLogin }: Props) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState<{ label: Strength; score: number } | null>(null);

  useEffect(() => {
    fetch("/api/admin/check-setup")
      .then((r) => r.json())
      .then((d) => setNeedsSetup(d.setup))
      .catch(() => setNeedsSetup(false));
  }, []);

  useEffect(() => {
    if (password) setStrength(passwordStrength(password));
    else setStrength(null);
  }, [password]);

  const handleGenerate = useCallback(() => {
    const pw = generatePassword();
    setPassword(pw);
    if (needsSetup) setConfirmPassword(pw);
  }, [needsSetup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }

    if (needsSetup && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (needsSetup && password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = needsSetup ? "/api/admin/setup" : "/api/admin/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      localStorage.setItem("flowwatch-admin-token", data.token);
      localStorage.setItem("flowwatch-admin-username", data.username);
      onLogin(data.token);
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  if (needsSetup === null) {
    return (
      <div className="admin-page">
        <div className="admin-card">
          <div className="admin-logo">
            <div className="admin-login-logo-wrap">
              <img src="https://i.ibb.co/Zz5pZDGk/darkmode.png" alt="FlowWatch" className="admin-login-logo admin-login-logo-dark" />
              <img src="https://i.ibb.co/600g6wV0/lightmode.png" alt="FlowWatch" className="admin-login-logo admin-login-logo-light" />
            </div>
          </div>
          <div className="admin-loading" style={{ textAlign: "center" }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-card">
        <div className="admin-logo">
          <div className="admin-login-logo-wrap">
            <img src="https://i.ibb.co/Zz5pZDGk/darkmode.png" alt="FlowWatch" className="admin-login-logo admin-login-logo-dark" />
            <img src="https://i.ibb.co/600g6wV0/lightmode.png" alt="FlowWatch" className="admin-login-logo admin-login-logo-light" />
          </div>
        </div>

        {needsSetup && (
          <p className="admin-hint" style={{ marginBottom: "1.5rem", marginTop: "-1rem" }}>
            First time here. Create your admin account.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label className="admin-label">Username</label>
          <input
            type="text"
            className="admin-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyUp={(e) => setCapsOn(e.getModifierState("CapsLock"))}
            placeholder="admin"
            autoFocus
          />
          {capsOn && <div className="admin-caps">Caps lock is on</div>}

          <label className="admin-label" style={{ marginTop: "0.75rem" }}>Password</label>
          <div className="pw-input-wrap">
            <input
              type={showPw ? "text" : "password"}
              className="admin-input pw-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={needsSetup ? "Choose a password" : "Enter password"}
            />
            {needsSetup && <CopyBtn text={password} />}
            <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} title={showPw ? "Hide password" : "Show password"}>
              {showPw ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.01 10.01 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            {needsSetup && (
              <button type="button" className="pw-gen" onClick={handleGenerate} title="Generate strong password">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 20V10M12 20V4M6 20v-6" />
                </svg>
              </button>
            )}
          </div>

          {needsSetup && strength && (
            <div className="pw-strength">
              <div className="pw-strength-bar" style={{ width: strengthWidth[strength.label], background: strengthColors[strength.label] }} />
            </div>
          )}
          {needsSetup && strength && (
            <div className="pw-strength-label" style={{ color: strengthColors[strength.label] }}>
              {strength.label}
            </div>
          )}

          {needsSetup && (
            <>
              <label className="admin-label" style={{ marginTop: "0.75rem" }}>Confirm password</label>
              <div className="pw-input-wrap">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="admin-input pw-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                />
                <button type="button" className="pw-eye" onClick={() => setShowConfirm(!showConfirm)} title={showConfirm ? "Hide" : "Show"}>
                  {showConfirm ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.01 10.01 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {password && confirmPassword && (
                <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: password === confirmPassword ? "var(--green)" : "var(--red)" }}>
                  {password === confirmPassword ? "Passwords match" : "Passwords do not match"}
                </div>
              )}
            </>
          )}

          {error && <div className="admin-error">{error}</div>}
          <button type="submit" className="admin-btn" disabled={loading}>
            {loading ? "Please wait..." : needsSetup ? "Create account" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
