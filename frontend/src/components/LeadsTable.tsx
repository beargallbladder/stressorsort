type LeadRow = {
  lead_id: string;
  vin_masked: string;
  priority_score: number | null;
  bucket: string | null;
  reasons: string[];
  scored_at: string | null;
};

export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Lead</th>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>VIN</th>
          <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: "8px" }}>Score</th>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Bucket</th>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Reasons</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.lead_id}>
            <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>
              <a href={`/lead/${r.lead_id}`} style={{ textDecoration: "none" }}>{r.lead_id}</a>
            </td>
            <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>{r.vin_masked}</td>
            <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>
              {r.priority_score ?? "-"}
            </td>
            <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>{r.bucket ?? "-"}</td>
            <td style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>
              {r.reasons?.length ? r.reasons.join(", ") : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


