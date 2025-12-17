import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pg } from "./client";
import dotenv from "dotenv";

dotenv.config();

async function run() {
	const migrationsDir = join(process.cwd(), "src", "db", "migrations");
	const files = readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort();
	for (const file of files) {
		const full = join(migrationsDir, file);
		const sql = readFileSync(full, "utf8");
		console.log(`Running migration: ${file}`);
		await pg.query(sql);
	}
	console.log("Migrations complete.");
	await pg.end();
}

run().catch((err) => {
	console.error("Migration failed", err);
	process.exit(1);
});


