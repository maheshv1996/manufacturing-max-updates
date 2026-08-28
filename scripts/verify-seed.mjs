// Verify seeded module tables + onboarding state on the live desktop cluster.
import { createRequire } from "module";
import pg from "pg";

const require = createRequire(import.meta.url);
const cfg = require("C:/Users/mahes/MfgMaxData/config.json");
const { Client } = pg;

const c = new Client({ connectionString: cfg.url });
await c.connect();
const r = await c.query(
  `SELECT (SELECT count(*) FROM "Eco") eco,
          (SELECT count(*) FROM "FaiReport") fai,
          (SELECT count(*) FROM "ImprovementProject") kaizen,
          (SELECT count(*) FROM "TestCampaign") rnd,
          (SELECT count(*) FROM "PermitToWork") permits,
          (SELECT count(*) FROM "Voucher") vouchers,
          (SELECT count(*) FROM "Grievance") grievances,
          (SELECT count(*) FROM "User") users`
);
console.log("table counts:", JSON.stringify(r.rows[0]));
const s = await c.query(`SELECT value FROM "Setting" WHERE key = 'onboardingComplete'`);
console.log("onboardingComplete:", s.rows[0] ? s.rows[0].value : "(missing)");
await c.end();
