import type { WorkflowStatus } from "../types.js";

interface LastRunInfo {
  status: string;
  executed_at: string;
}

export function computeWorkflowStatus(lastRun: LastRunInfo | null): WorkflowStatus {
  if (!lastRun) return "never_run";
  if (lastRun.status === "failed") return "failed";
  return "success";
}

export function computeDayStatuses(
  runs: { status: string; executed_at: string }[]
): ("green" | "red" | "empty")[] {
  const days: ("green" | "red" | "empty")[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dayRuns = runs.filter((r) => {
      const d = new Date(r.executed_at);
      return d >= dayStart && d <= dayEnd;
    });

    if (dayRuns.length === 0) {
      days.push("empty");
      continue;
    }

    const hasFailed = dayRuns.some((r) => r.status === "failed");
    days.push(hasFailed ? "red" : "green");
  }

  return days;
}
