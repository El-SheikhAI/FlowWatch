interface Props {
  allOk: boolean;
  attentionCount: number;
  healthyCount: number;
  totalCount: number;
  live: boolean;
}

export default function StatusBanner({
  allOk,
  attentionCount,
  healthyCount,
  totalCount,
  live,
}: Props) {
  return (
    <div className={`status-banner${allOk ? " ok" : ""}`}>
      <div className="status-dot-large" />
      <div>
        <div className="status-banner-text">
          {allOk
            ? "All workflows operational"
            : `${attentionCount} workflow${attentionCount > 1 ? "s" : ""} need${
                attentionCount === 1 ? "s" : ""
              } attention`}
        </div>
        <div className="status-banner-sub">
          {healthyCount} of {totalCount} workflow{totalCount > 1 ? "s" : ""} running normally
        </div>
      </div>
      <div className={`status-live${live ? "" : " status-live-off"}`}>
        <span className="status-live-dot" />
        {live ? "Live" : "Offline"}
      </div>
    </div>
  );
}
