/**
 * C1-4 — Typed permission catalog (DEPTH_02 §8).
 * Single source of truth for every permission key in the system. Org-created
 * roles may only reference keys that exist here — this module makes that a
 * compile-time + runtime guarantee (no `as any`, no free-form strings at the
 * authorization boundary).
 */
export const WORKSPACES = [
  "ops",
  "supply",
  "commercial",
  "people",
  "system",
  "quality",
  "metrology",
  "engineering",
  "finance",
  "ehs",
  "maintenance",
  "projects",
  "exec",
  "legal",
  "risk",
  "brand",
  "sustainability",
] as const;

export type Workspace = (typeof WORKSPACES)[number];

export const SPECIAL_PERMISSIONS = [
  "users.manage",
  "terminal.use",
  "reports.print",
  "records.edit",
  "kpi.override",
  "audit.view",
] as const;

export type SpecialPermission = (typeof SPECIAL_PERMISSIONS)[number];

export type PermissionKey =
  | `${Workspace}.view`
  | `${Workspace}.edit`
  | `${Workspace}.approve`
  | SpecialPermission;

export const ALL_PERMISSIONS: PermissionKey[] = [
  ...WORKSPACES.flatMap(
    (ws) => [`${ws}.view`, `${ws}.edit`, `${ws}.approve`] as PermissionKey[],
  ),
  ...SPECIAL_PERMISSIONS,
];

const KEY_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);

/** Runtime guard — narrows an arbitrary string to a known PermissionKey. */
export function isPermissionKey(value: string): value is PermissionKey {
  return KEY_SET.has(value);
}
