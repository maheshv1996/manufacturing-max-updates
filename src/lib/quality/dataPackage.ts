/**
 * C3-4 — Pure data-package release gate (DEPTH_04 W6; schema
 * `DataPackageStatus DRAFT|RELEASED`). RELEASE requires completeness: an
 * APPROVED FAI when the part requires one (G-1 thread), material certs
 * present, and non-empty contents. Guardrail G-6: a RELEASED package is
 * frozen — mutation requires an explicit newRevision (caller bumps revision +
 * audit), never silent edits.
 */
export type DataPackageStatus = "DRAFT" | "RELEASED";

export interface ReleaseInput {
  faiRequired: boolean;
  faiApproved: boolean;
  certsPresent: boolean;
  itemCount: number;
}

export type ReleaseResult =
  | { ok: true; status: "RELEASED" }
  | { ok: false; code: "FAI_MISSING" | "CERT_MISSING" | "EMPTY_PACKAGE"; message: string };

export function releasePackage(input: ReleaseInput): ReleaseResult {
  if (input.faiRequired && !input.faiApproved) {
    return { ok: false, code: "FAI_MISSING", message: "An APPROVED FAI report is required in the package (G-1)" };
  }
  if (!input.certsPresent) {
    return { ok: false, code: "CERT_MISSING", message: "Material certificates are required in the package" };
  }
  if (input.itemCount < 1) {
    return { ok: false, code: "EMPTY_PACKAGE", message: "A data package cannot be released empty" };
  }
  return { ok: true, status: "RELEASED" };
}

export type MutateResult =
  | { ok: true }
  | { ok: false; code: "FROZEN"; message: string };

export function mutatePackage(status: DataPackageStatus, opts: { newRevision?: boolean } = {}): MutateResult {
  if (status === "RELEASED" && opts.newRevision !== true) {
    return {
      ok: false,
      code: "FROZEN",
      message: "A RELEASED data package is frozen (G-6) — changes require an explicit new revision",
    };
  }
  return { ok: true };
}