// Workspace keys
export const WORKSPACE_PERMISSIONS = {
  ops: { view: "ops.view", edit: "ops.edit" },
  supply: { view: "supply.view", edit: "supply.edit" },
  commercial: { view: "commercial.view", edit: "commercial.edit" },
  people: { view: "people.view", edit: "people.edit" },
  system: { view: "system.view", edit: "system.edit" },
  // Department-level keys (gateway + hubs)
  quality: { view: "quality.view", edit: "quality.edit" },
  metrology: { view: "metrology.view", edit: "metrology.edit" },
  engineering: { view: "engineering.view", edit: "engineering.edit" },
  finance: { view: "finance.view", edit: "finance.edit" },
  ehs: { view: "ehs.view", edit: "ehs.edit" },
  maintenance: { view: "maintenance.view", edit: "maintenance.edit" },
  projects: { view: "projects.view", edit: "projects.edit" },
  exec: { view: "exec.view", edit: "exec.edit" },
};

// Special keys
export const SPECIAL_PERMISSIONS = {
  USERS_MANAGE: "users.manage",
  TERMINAL_USE: "terminal.use",
  REPORTS_PRINT: "reports.print",
  RECORDS_EDIT: "records.edit",
  KPI_OVERRIDE: "kpi.override",
  AUDIT_VIEW: "audit.view",
};

// Manager approval keys — one per department (`<dept>.approve`). Approve and
// override actions require BOTH level MANAGER and the matching dept.approve key.
export const APPROVE_PERMISSIONS: Record<string, string> = {
  ops: "ops.approve",
  supply: "supply.approve",
  commercial: "commercial.approve",
  people: "people.approve",
  system: "system.approve",
  quality: "quality.approve",
  metrology: "metrology.approve",
  engineering: "engineering.approve",
  finance: "finance.approve",
  ehs: "ehs.approve",
  maintenance: "maintenance.approve",
  projects: "projects.approve",
  exec: "exec.approve",
};

export function departmentApproveKey(deptId: string): string {
  return APPROVE_PERMISSIONS[deptId] || `${deptId}.approve`;
}

export const ALL_PERMISSIONS = [
  ...Object.values(WORKSPACE_PERMISSIONS).flatMap((ws) => [ws.view, ws.edit]),
  ...Object.values(APPROVE_PERMISSIONS),
  ...Object.values(SPECIAL_PERMISSIONS),
];

export type PermissionKey = string;

// Helpers
export function userPermissions(user: any): string[] {
  if (!user) return [];
  // The JWT token / user object will contain the permissions array
  if (Array.isArray(user.permissions)) {
    return user.permissions;
  }
  return [];
}

export function can(user: any, key: PermissionKey): boolean {
  if (!user) return false;
  // Owner always can do anything, or if they have the specific permission.
  // Wait, does Owner inherently have all permissions? The prompt says "Owner account cannot be deleted... isOwner sees everyone".
  // Let's assume Owner explicitly has Administrator role which has ALL permissions, but we can also hardcode a bypass.
  if (user.isOwner) return true;
  return userPermissions(user).includes(key);
}

export function canAny(user: any, keys: PermissionKey[]): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  const userPerms = userPermissions(user);
  return keys.some((key) => userPerms.includes(key));
}

export function canAll(user: any, keys: PermissionKey[]): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  const userPerms = userPermissions(user);
  return keys.every((key) => userPerms.includes(key));
}

export function getUserFromHeaders(headersList: Headers) {
  return {
    id: headersList.get("x-user-id") || "",
    name: headersList.get("x-user-name") || "",
    roleId: headersList.get("x-user-role-id") || "",
    roleName: headersList.get("x-user-role-name") || "",
    isOwner: headersList.get("x-user-is-owner") === "true",
    level: headersList.get("x-user-level") || "WORKER",
    permissions: (headersList.get("x-user-permissions") || "")
      .split(",")
      .filter(Boolean),
  };
}
