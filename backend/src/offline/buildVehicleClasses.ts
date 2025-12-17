import { pg } from "../db/client";

// Build vehicle_classes from existing vehicle_facts
async function run() {
	const version = process.env.TENSOR_VERSION || "v1.0.0";
	const res = await pg.query(
		`select distinct make, model, model_year from vehicle_facts where make is not null and model is not null and model_year is not null`,
	);
	for (const row of res.rows) {
		const make = String(row.make);
		const model = String(row.model);
		const year = Number(row.model_year);
		const { start, end } = bucketYears(year);
		const vehicle_class_id = [
			`make=${make.toLowerCase()}`,
			`model=${model.toLowerCase()}`,
			`years=${start}-${end}`,
			`platform=unknown`,
			`powertrain=unknown`,
			`drivetrain=unknown`,
		].join("|");
		const spec_json = {
			make,
			model,
			year_start: start,
			year_end: end,
			platform_bucket: "unknown",
			powertrain_bucket: null,
			drivetrain_bucket: null,
		};
		await pg.query(
			`insert into vehicle_classes (vehicle_class_id, make, model, year_start, year_end, platform_bucket, powertrain_bucket, drivetrain_bucket, spec_json, feature_vector, version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (vehicle_class_id) do nothing`,
			[
				vehicle_class_id,
				make,
				model,
				start,
				end,
				"unknown",
				null,
				null,
				spec_json,
				buildFeatureVector(spec_json),
				version,
			],
		);
	}
	await pg.end();
}

function bucketYears(year: number): { start: number; end: number } {
	const start = year - ((year - 2000) % 3);
	return { start, end: start + 2 };
}

function buildFeatureVector(spec: any): number[] {
	// Simple numeric vector: year mid, platform one-hot baseline
	const mid = (spec.year_start + spec.year_end) / 2;
	return [mid, 0, 0, 0]; // placeholders
}

run().catch((e) => {
	console.error(e);
	process.exit(1);
});


