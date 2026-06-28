export interface PingBody {
  workflow_id: string;
  workflow_name: string;
  status: "success" | "failed" | "running";
  description?: string;
  duration_ms: number | null;
  error_message: string | null;
  stale_after_minutes?: number;
}

export type WorkflowStatus = "success" | "failed" | "never_run";

export interface WorkflowStatusItem {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  last_run_at: string | null;
  last_run_duration_ms: number | null;
  last_run_status: string | null;
  last_error: string | null;
  uptime_30d: number;
  day_statuses: ("green" | "red" | "empty")[];
  recent_runs: RecentRun[];
}

export interface RecentRun {
  status: string;
  duration_ms: number | null;
  executed_at: string;
  workflow_name: string;
}

export interface StatusResponse {
  client: string;
  generated_at: string;
  workflows: WorkflowStatusItem[];
}
