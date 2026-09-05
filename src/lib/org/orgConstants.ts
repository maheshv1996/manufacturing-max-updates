/**
 * C1 — Org constants shared by the v2 org routes and seed tooling.
 * Single source for the string enum values used across OrgUnit/RoleAssignment
 * so no route re-declares them.
 */
export const UNIT_TYPES = ["DIVISION", "DEPARTMENT", "CELL", "TEAM", "FUNCTION"] as const;
export type OrgUnitType = (typeof UNIT_TYPES)[number];

export const SCOPE_VALUES = ["SELF", "TEAM", "UNIT", "PLANT", "ALL"] as const;

export const ASSIGNMENT_STATUS_VALUES = ["ACTIVE", "ACTING", "SUSPENDED", "EXITED"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS_VALUES)[number];
