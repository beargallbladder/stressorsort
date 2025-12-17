export function ExplainView({ data }: { data: any }) {
  if (!data) return <div>No data</div>;
  const fv = data.feature_vector;
  const sc = data.score;
  const offers: string[] = data.offers || [];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div>
        <h3>Score</h3>
        <div>Score: <strong>{sc?.priority_score ?? "-"}</strong></div>
        <div>Bucket: <strong>{sc?.bucket ?? "-"}</strong></div>
        <div>Reasons: {sc?.reasons?.join(", ") || "-"}</div>
        <div>Version: {sc?.score_version || "-"}</div>
        <div>Scored: {sc?.scored_at || "-"}</div>
        <h3>Suggested Services</h3>
        <div>{offers.length ? offers.join(", ") : "-"}</div>
      </div>
      <div>
        <h3>Features</h3>
        <pre style={{ background: "#fafafa", padding: 12, border: "1px solid #eee", borderRadius: 6, maxHeight: 400, overflow: "auto" }}>
{JSON.stringify(fv?.features ?? {}, null, 2)}
        </pre>
        <h3>Inputs (audit)</h3>
        <pre style={{ background: "#fafafa", padding: 12, border: "1px solid #eee", borderRadius: 6, maxHeight: 400, overflow: "auto" }}>
{JSON.stringify(fv?.inputs ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}


