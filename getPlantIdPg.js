require('dotenv').config();
const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT id FROM "Plant" LIMIT 1');
  console.log("PLANT_ID:", res.rows[0]?.id);
  await client.end();
}
main();
