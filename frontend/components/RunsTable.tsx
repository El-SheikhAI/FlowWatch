interface Run {
  status: string;
  executed_at: string;
  workflow_name: string;
}

interface Props {
  runs: Run[];
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;

  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` ${time}`;
}

export default function RunsTable({ runs }: Props) {
  if (runs.length === 0) {
    return <div className="empty-section">No recent runs.</div>;
  }

  return (
    <table className="runs-table">
      <thead>
        <tr><th>Workflow</th><th>Status</th><th>Time</th></tr>
      </thead>
      <tbody>
        {runs.map((run, i) => (
          <tr key={i}>
            <td>{run.workflow_name}</td>
            <td className={run.status === "success" ? "run-success" : "run-fail"}>
              {run.status === "success" ? "\u2713 success" : "\u2717 failed"}
            </td>
            <td>{formatTime(run.executed_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
