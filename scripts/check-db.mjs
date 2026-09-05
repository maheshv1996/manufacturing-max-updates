import { Client } from "pg";
const c = new Client({ connectionString: "postgresql://postgres:1996@localhost:5432/postgres" });
await c.connect();
const r = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", ["mfgmax_v2_test"]);
console.log(r.rows.length > 0 ? "DB exists" : "DB missing");
await c.end();
