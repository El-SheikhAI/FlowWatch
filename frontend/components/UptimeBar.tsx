interface Props {
  name: string;
  uptime: number;
  dayStatuses: ("green" | "red" | "empty")[];
}

const barClass: Record<string, string> = {
  green: "bar-green",
  red: "bar-red",
  empty: "bar-empty",
};

export default function UptimeBar({ name, uptime, dayStatuses }: Props) {
  return (
    <div className="uptime-row">
      <div className="uptime-label" title={name}>
        {name}
      </div>
      <div className="uptime-bar">
        {dayStatuses.length > 0
          ? dayStatuses.map((s, i) => (
              <span key={i} className={barClass[s]} title={`Day ${i + 1}: ${s}`} />
            ))
          : Array.from({ length: 30 }).map((_, i) => (
              <span key={i} className="bar-empty" title={`Day ${i + 1}`} />
            ))}
      </div>
      <div className="uptime-pct">{uptime}%</div>
    </div>
  );
}
