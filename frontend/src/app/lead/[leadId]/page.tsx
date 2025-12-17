import { fetchLeadExplain } from "../../../lib/api";
import { ExplainView } from "../../../components/ExplainView";

export default async function LeadPage({ params }: { params: { leadId: string } }) {
  const data = await fetchLeadExplain(params.leadId);
  return (
    <div>
      <h2>Lead {params.leadId}</h2>
      <ExplainView data={data} />
    </div>
  );
}


