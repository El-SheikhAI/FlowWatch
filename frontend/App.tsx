import { useState, useEffect, useCallback, useRef } from "react";
import Header from "./components/Header";
import StatusBanner from "./components/StatusBanner";
import WorkflowCard from "./components/WorkflowCard";
import UptimeBar from "./components/UptimeBar";
import RunsTable from "./components/RunsTable";
import Footer from "./components/Footer";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";

interface RecentRun {
  status: string;
  duration_ms: number | null;
  executed_at: string;
  workflow_name: string;
}

interface DayStatuses {
  day_statuses?: ("green" | "yellow" | "red" | "empty")[];
}

interface Workflow extends DayStatuses {
  id: string;
  name: string;
  description: string | null;
  status: "success" | "failed" | "never_run";
  last_run_at: string | null;
  last_run_duration_ms: number | null;
  last_run_status: string | null;
  uptime_30d: number;
  recent_runs: RecentRun[];
}

interface StatusData {
  client: string;
  generated_at: string;
  workflows: Workflow[];
  all_recent_runs: RecentRun[];
}

function getSlugAndToken(): { slug: string; token: string } | null {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (path === "admin" || path.startsWith("admin/")) return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (!path || !token) return null;
  return { slug: path, token };
}

function StatusPage() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("flowwatch-theme") as "dark" | "light") ?? "dark";
  });
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const creds = useRef(getSlugAndToken());

  const fetchStatus = useCallback(async () => {
    const c = creds.current;
    if (!c) return;

    try {
      const res = await fetch(`/api/status/${c.slug}`, {
        headers: { Authorization: `Bearer ${c.token}` },
      });
      if (!res.ok) {
        if (res.status === 404) setError("Client not found or invalid token.");
        else setError(`Request failed (${res.status}).`);
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
      setLive(true);
    } catch {
      setError("Could not connect to FlowWatch.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    const c = creds.current;
    if (!c) return;

    const es = new EventSource(`/api/status/${c.slug}/watch?token=${c.token}`);

    es.onmessage = (e) => {
      try {
        const json = JSON.parse(e.data);
        setData(json);
        setLive(true);
        setError(null);
      } catch {}
    };

    es.onerror = () => setLive(false);

    return () => es.close();
  }, [fetchStatus]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("flowwatch-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  if (!creds.current) {
    return (
      <div className="page">
        <div className="error-state">
          <div className="error-icon">&#9888;</div>
          <h2>Missing Credentials</h2>
          <p>
            Access this page via the URL shared with you:
            <br />
            <code>/{'<slug>'}?token={'<read_token>'}</code>
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <Header clientName="" theme={theme} onToggleTheme={toggleTheme} />
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading workflow status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Header clientName="" theme={theme} onToggleTheme={toggleTheme} />
        <div className="error-state">
          <div className="error-icon">&#9888;</div>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const healthyCount = data.workflows.filter((w) => w.status === "success").length;
  const totalCount = data.workflows.length;
  const attentionCount = totalCount - healthyCount;
  const allOk = attentionCount === 0;

  return (
    <div className="page">
      <Header
        clientName={data.client}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <StatusBanner
        allOk={allOk}
        attentionCount={attentionCount}
        healthyCount={healthyCount}
        totalCount={totalCount}
        live={live}
      />
      <div className="section-label">Workflows</div>
      <div className="workflow-list">
        {data.workflows.map((wf) => (
          <WorkflowCard
            key={wf.id}
            name={wf.name}
            description={wf.description}
            status={wf.status}
            lastRunAt={wf.last_run_at}
            lastError={(wf as any).last_error ?? null}
          />
        ))}
      </div>
      <div className="uptime-section">
        <div className="section-label">30-day uptime</div>
        {data.workflows.map((wf) => (
          <UptimeBar
            key={wf.id}
            name={wf.name}
            uptime={wf.uptime_30d}
            dayStatuses={wf.day_statuses ?? []}
          />
        ))}
      </div>
      <div className="section-label">Recent runs</div>
      <RunsTable runs={data.all_recent_runs ?? []} />
      <Footer />
    </div>
  );
}

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const isHome = pathname === "/";
  const [adminToken, setAdminToken] = useState(
    () => isHome ? localStorage.getItem("flowwatch-admin-token") : null
  );

  const handleLogin = (t: string) => setAdminToken(t);
  const handleLogout = () => {
    localStorage.removeItem("flowwatch-admin-token");
    localStorage.removeItem("flowwatch-admin-username");
    setAdminToken(null);
  };

  if (isHome) {
    if (adminToken) {
      return <AdminDashboard token={adminToken} onLogout={handleLogout} />;
    }
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <StatusPage />;
}
