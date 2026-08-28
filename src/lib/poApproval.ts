export const MANAGER_THRESHOLD = 50000; // ₹ — needs a manager approval
export const OWNER_THRESHOLD = 500000; // ₹ — needs an owner approval

export function approvalFor(total: number) {
  if (total > OWNER_THRESHOLD) {
    return { approvalStatus: "PENDING_OWNER", approvalLevel: "OWNER" };
  }
  if (total > MANAGER_THRESHOLD) {
    return { approvalStatus: "PENDING_MANAGER", approvalLevel: "MANAGER" };
  }
  return { approvalStatus: "APPROVED", approvalLevel: null };
}

export function formatRupees(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
