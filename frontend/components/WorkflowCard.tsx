import type { WorkflowStatus } from "../../src/types";

interface Props {
  name: string;
  description: string | null;
  status: WorkflowStatus;
  lastRunAt: string | null;
  lastError: string | null;
}

const dotClass: Record<WorkflowStatus, string> = {
  success: "dot-green",
  failed: "dot-red",
  never_run: "dot-gray",
};

const pillClass: Record<WorkflowStatus, string> = {
  success: "pill-green",
  failed: "pill-red",
  never_run: "pill-gray",
};

function formatLastRun(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatLastRunFailed(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return `Failed ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function WorkflowCard({ name, description, status, lastRunAt, lastError }: Props) {
  const timeLabel =
    status === "failed" ? formatLastRunFailed(lastRunAt) : formatLastRun(lastRunAt);

  const subtitle = status === "failed" && lastError
    ? lastError
    : description;

  return (
    <div className="workflow-card">
      <div className={`status-dot ${dotClass[status]}`} />
      <div className="wf-info">
        <div className="wf-name">{name}</div>
        {subtitle && <div className="wf-desc">{subtitle}</div>}
      </div>
      <div className="wf-meta">
        <div className="wf-time">{timeLabel}</div>
        <div className={`wf-status-pill ${pillClass[status]}`}>
          {status.replace("_", " ")}
        </div>
      </div>
    </div>
  );
}
