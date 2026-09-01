// Workspace keys
export const WORKSPACE_PERMISSIONS = {
  ops: { view: "ops.view", edit: "ops.edit" },
  supply: { view: "supply.view", edit: "supply.edit" },
  commercial: { view: "commercial.view", edit: "commercial.edit" },
  people: { view: "people.view", edit: "people.edit" },
  system: { view: "system.view", edit: "system.edit" },
  quality: { view: "quality.view", edit: "quality.edit" },
  metrology: { view: "metrology.view", edit: "metrology.edit" },
  engineering: { view: "engineering.view", edit: "engineering.edit" },
  finance: { view: "finance.view", edit: "finance.edit" },
  ehs: { view: "ehs.view", edit: "ehs.edit" },
  maintenance: { view: "maintenance.view", edit: "maintenance.edit" },
  projects: { view: "projects.view", edit: "projects.edit" },
  exec: { view: "exec.view", edit: "exec.edit" },
  legal: { view: "legal.view", edit: "legal.edit" },
  risk: { view: "risk.view", edit: "risk.edit" },
  brand: { view: "brand.view", edit: "brand.edit" },
  sustainability: { view: "sustainability.view", edit: "sustainability.edit" },
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

// Standardized dynamic department approval key generator
export function departmentApproveKey(deptId: string): string {
  const sanitized = String(deptId || "").trim().toLowerCase();
  return `${sanitized}.approve`;
}

export const ALL_PERMISSIONS = [
  ...Object.values(WORKSPACE_PERMISSIONS).flatMap((ws) => [ws.view, ws.edit]),
  ...Object.keys(WORKSPACE_PERMISSIONS).map(departmentApproveKey),
  ...Object.values(SPECIAL_PERMISSIONS),
];

export type PermissionKey = string;

// Helper to safely parse permissions array from various formats (Array, JSON, CSV)
export function parsePermissions(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean);
      } catch {}
    }
    return trimmed.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function userPermissions(user: any): string[] {
  if (!user) return [];
  if (user.isOwner || user.level === "OWNER") {
    return ["*", ...ALL_PERMISSIONS];
  }
  return parsePermissions(user.permissions);
}

/**
 * Checks if a user has permission for a specific key.
 * Enforces negative permissions ("!key"), wildcards ("*"), and role hierarchy.
 */
export function can(user: any, key: PermissionKey): boolean {
  if (!user) return false;

  const perms = userPermissions(user);

  // 1. Explicit negative / deny permission rule takes highest priority
  if (perms.includes(`!${key}`) || perms.includes("!*")) {
    return false;
  }

  // 2. Wildcard or Owner privilege
  if (perms.includes("*") || user.isOwner || user.level === "OWNER") {
    return true;
  }

  // 3. Domain wildcard support (e.g., "ops.*" grants "ops.view", "ops.edit", "ops.approve")
  const domain = key.split(".")[0];
  if (domain && perms.includes(`${domain}.*`)) {
    return true;
  }

  // 4. Direct key match
  if (perms.includes(key)) {
    return true;
  }

  // 5. Role level inheritance: MANAGER gets view/edit on their assigned role/department
  if (user.level === "MANAGER") {
    if (key.endsWith(".view") || key.endsWith(".edit")) {
      const userDept = (user.roleName || "").toLowerCase();
      if (userDept && key.startsWith(userDept)) {
        return true;
      }
    }
  }

  return false;
}

export function canAny(user: any, keys: PermissionKey[]): boolean {
  if (!user) return false;
  return keys.some((key) => can(user, key));
}

export function canAll(user: any, keys: PermissionKey[]): boolean {
  if (!user) return false;
  return keys.every((key) => can(user, key));
}

export function getUserFromHeaders(headersList: Headers) {
  const rawPerms = headersList.get("x-user-permissions") || "";
  const isOwner = headersList.get("x-user-is-owner") === "true";
  const level = headersList.get("x-user-level") || (isOwner ? "OWNER" : "WORKER");

  return {
    id: headersList.get("x-user-id") || "",
    name: headersList.get("x-user-name") || "",
    roleId: headersList.get("x-user-role-id") || "",
    roleName: headersList.get("x-user-role-name") || "",
    isOwner,
    level,
    permissions: parsePermissions(rawPerms),
  };
}
