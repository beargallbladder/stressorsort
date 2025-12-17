import { fetchDealerLeads } from "../../../lib/api";
import { LeadsTable } from "../../../components/LeadsTable";

export default async function DealerPage({ params }: { params: { dealerId: string } }) {
  const data = await fetchDealerLeads(params.dealerId);
  return (
    <div>
      <h2>Dealer {data.dealer_id}</h2>
      <LeadsTable rows={data.leads} />
    </div>
  );
}


