const BASE = "http://localhost:51888";
async function login(id, pass) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: id, password: pass }) });
  return { status: res.status, cookie: (res.headers.get("set-cookie") || "").split(";")[0] };
}
const admin = await login("1001", "factory123");
const op = await login("2001", "operator123");

// operator creates a leave request
const now = new Date();
const fmt = (d) => d.toISOString().slice(0, 10);
const from = new Date(now.getTime() + 86400000 * 5);
const to = new Date(now.getTime() + 86400000 * 6);
const create = await fetch(`${BASE}/api/leaves`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: op.cookie }, body: JSON.stringify({ type: "PL", fromDate: fmt(from), toDate: fmt(to), days: 2, reason: "Family function" }) });
const created = await create.json();
console.log("create leave (worker):", create.status, "id:", created.id);
const leaveId = created.id;

// worker approve -> 403
const opApprove = await fetch(`${BASE}/api/leaves/${leaveId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: op.cookie }, body: JSON.stringify({ status: "APPROVED", reason: "self-approve attempt" }) });
console.log("worker self-approve:", opApprove.status);
// manager no reason -> 400
const noReason = await fetch(`${BASE}/api/leaves/${leaveId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: admin.cookie }, body: JSON.stringify({ status: "APPROVED" }) });
console.log("manager no-reason:", noReason.status);
// manager + reason -> 200
const mgr = await fetch(`${BASE}/api/leaves/${leaveId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: admin.cookie }, body: JSON.stringify({ status: "APPROVED", reason: "Approved - balance OK" }) });
console.log("manager + reason:", mgr.status);

// audits
const audits = await fetch(`${BASE}/api/audit?action=LEAVE_APPROVED`, { headers: { Cookie: admin.cookie } });
const rows = (await audits.json()).rows || (await audits.json());
console.log("LEAVE_APPROVED audits:", Array.isArray(rows) ? rows.filter(r => (r.action||"").includes("LEAVE_APPROVED")).length : "n/a");
const ovAudits = await fetch(`${BASE}/api/audit?action=KPI_OVERRIDDEN`, { headers: { Cookie: admin.cookie } });
const ovRows = (await ovAudits.json()).rows || (await ovAudits.json());
console.log("KPI_OVERRIDDEN audits:", Array.isArray(ovRows) ? ovRows.filter(r => (r.action||"").includes("KPI_OVERRIDDEN")).length : "n/a");
