export type DealerLeadsResponse = {
  dealer_id: string;
  leads: Array<{
    lead_id: string;
    vin_masked: string;
    priority_score: number | null;
    bucket: string | null;
    reasons: string[];
    offers: string[];
    scored_at: string | null;
  }>;
};

export async function fetchDealerLeads(dealerId: string): Promise<DealerLeadsResponse> {
  const base = process.env.API_BASE_URL!;
  const key = process.env.API_KEY!;
  const res = await fetch(`${base}/api/dealers/${dealerId}/leads`, {
    headers: { "X-API-Key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load leads");
  return res.json();
}

export async function fetchLeadExplain(leadId: string): Promise<any> {
  const base = process.env.API_BASE_URL!;
  const key = process.env.API_KEY!;
  const res = await fetch(`${base}/api/leads/${leadId}/explain`, {
    headers: { "X-API-Key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load explain");
  return res.json();
}


