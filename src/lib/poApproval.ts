export const MANAGER_THRESHOLD = 50000; // ₹ — needs a manager approval
export const OWNER_THRESHOLD = 500000; // ₹ — needs an owner approval

export function approvalFor(
  total: number,
  managerThreshold: number = MANAGER_THRESHOLD,
  ownerThreshold: number = OWNER_THRESHOLD,
) {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (safeTotal > ownerThreshold) {
    return { approvalStatus: "PENDING_OWNER", approvalLevel: "OWNER" };
  }
  if (safeTotal > managerThreshold) {
    return { approvalStatus: "PENDING_MANAGER", approvalLevel: "MANAGER" };
  }
  return { approvalStatus: "APPROVED", approvalLevel: null };
}

export function formatRupees(n: number) {
  const safeNum = Number(n) || 0;
  return `₹${safeNum.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
