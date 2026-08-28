const BASE = "http://localhost:51888";
async function login(id, pass) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: id, password: pass }) });
  const setCookie = res.headers.get("set-cookie");
  const cookie = setCookie ? setCookie.split(";")[0] : "";
  return { status: res.status, cookie };
}
const admin = await login("1001", "factory123");
const op = await login("2001", "operator123");
console.log("admin login:", admin.status, "| operator login:", op.status);

// approvals: manager ok, worker 403
const aOk = await fetch(`${BASE}/api/approvals`, { headers: { Cookie: admin.cookie } });
const aOp = await fetch(`${BASE}/api/approvals`, { headers: { Cookie: op.cookie } });
const aData = await aOk.json();
console.log("approvals manager:", aOk.status, "| worker:", aOp.status);
console.log("  pendingLeaves:", aData.approvals?.pendingLeaveCount, "| openNcrs:", aData.approvals?.openNcrs, "| disputed:", aData.approvals?.disputedCounts, "| FAIs:", aData.approvals?.submittedFais);
console.log("  presentToday:", aData.team?.presentToday, "| monthSpend:", aData.budget?.monthSpend);

// leave approval gates: manager w/o reason -> 400; worker w/ reason -> 403; manager w/ reason -> ok
const leaves = await fetch(`${BASE}/api/leaves`, { headers: { Cookie: admin.cookie } });
const leaveList = await leaves.json();
const pending = (Array.isArray(leaveList) ? leaveList : []).find((l) => l.status === "PENDING") || (Array.isArray(leaveList) ? leaveList[0] : null);
if (pending) {
  const noReason = await fetch(`${BASE}/api/leaves/${pending.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: admin.cookie }, body: JSON.stringify({ status: "APPROVED" }) });
  const opApprove = await fetch(`${BASE}/api/leaves/${pending.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: op.cookie }, body: JSON.stringify({ status: "APPROVED", reason: "worker trying" }) });
  const mgrApprove = await fetch(`${BASE}/api/leaves/${pending.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: admin.cookie }, body: JSON.stringify({ status: "APPROVED", reason: "Manager approved after checking balance" }) });
  console.log("leave: no-reason:", noReason.status, "| worker:", opApprove.status, "| manager+reason:", mgrApprove.status);
  // revert for clean demo
  await fetch(`${BASE}/api/leaves/${pending.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: admin.cookie }, body: JSON.stringify({ status: "PENDING", reason: "reverted for demo" }) });
}

// override: worker 403, manager+reason ok, audit KPI_OVERRIDDEN
const ovWorker = await fetch(`${BASE}/api/overrides`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: op.cookie }, body: JSON.stringify({ entityType: "machine", entityId: "test", field: "oee", value: 80, note: "worker override attempt" }) });
const ovNoReason = await fetch(`${BASE}/api/overrides`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: admin.cookie }, body: JSON.stringify({ entityType: "machine", entityId: "test", field: "oee", value: 80 }) });
const ovMgr = await fetch(`${BASE}/api/overrides`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: admin.cookie }, body: JSON.stringify({ entityType: "machine", entityId: "test", field: "oee", value: 80, note: "Manager override for demo" }) });
console.log("override: worker:", ovWorker.status, "| manager-no-reason:", ovNoReason.status, "| manager+reason:", ovMgr.status);
