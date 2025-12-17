import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString =
	process.env.DATABASE_URL ||
	"postgres://postgres:postgres@localhost:5432/dealer_stressor";

export const pg = new Pool({
	connectionString,
	max: Number(process.env.PG_POOL_MAX || 10),
	ssl:
		process.env.PGSSL === "true"
			? { rejectUnauthorized: false }
			: undefined,
});

export async function withTransaction<T>(
	fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
	const client = await pg.connect();
	try {
		await client.query("BEGIN");
		const result = await fn(client);
		await client.query("COMMIT");
		return result;
	} catch (err) {
		await client.query("ROLLBACK");
		throw err;
	} finally {
		client.release();
	}
}


