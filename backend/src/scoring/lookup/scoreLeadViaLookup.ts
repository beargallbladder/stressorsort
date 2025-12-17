import { pg } from "../../db/client";

export async function scoreLeadViaLookup(vehicleClassId: string, scenarioId: string): Promise<{
	score: number;
	reasons: string[];
	model_version: string;
	confidence: number;
}> {
	// Exact lookup
	const exact = await pg.query(
		`select score, reasons, model_version, confidence
     from vehicle_scenario_scores
     where vehicle_class_id = $1 and scenario_id = $2`,
		[vehicleClassId, scenarioId],
	);
	if (exact.rowCount && exact.rowCount > 0) {
		const r = exact.rows[0];
		return {
			score: Number(r.score) || 0,
			reasons: r.reasons || [],
			model_version: r.model_version || "v1.0.0",
			confidence: Number(r.confidence) || 0.7,
		};
	}

	// Neighbor fallback weighted by similarity
	const rows = await pg.query(
		`select vss.score, vss.reasons, vss.model_version, n.similarity
       from vehicle_class_neighbors n
       join vehicle_scenario_scores vss
         on vss.vehicle_class_id = n.neighbor_vehicle_class_id
      where n.vehicle_class_id = $1 and vss.scenario_id = $2
      order by n.similarity desc
      limit 20`,
		[vehicleClassId, scenarioId],
	);
	if (!rows.rowCount || rows.rowCount === 0) {
		return { score: 0, reasons: [], model_version: "v1.0.0", confidence: 0.3 };
	}
	let weighted = 0;
	let totalSim = 0;
	let reasons: string[] = [];
	let modelVersion = rows.rows[0].model_version || "v1.0.0";
	for (const r of rows.rows) {
		const s = Number(r.similarity) || 0;
		weighted += (Number(r.score) || 0) * s;
		totalSim += s;
		reasons.push(...(r.reasons || []));
	}
	const score = totalSim > 0 ? Math.round(weighted / totalSim) : 0;
	reasons = Array.from(new Set(reasons)).slice(0, 5);
	const confidence = Math.max(0.3, Math.min(0.8, totalSim / rows.rowCount));
	return { score, reasons, model_version: modelVersion, confidence };
}


