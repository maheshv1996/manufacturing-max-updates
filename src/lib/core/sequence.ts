/**
 * C1-9 — Sequence core. Document numbers (WO, GRN, challan, invoice, voucher)
 * are allocated through SequenceCounter rows incremented inside the same
 * transaction as the document write — never `count()+1`. This module owns
 * the naming rules; the transactional allocator (DB adapter) is wired with
 * the route layer. Pure module.
 */

const NAME_RE = /^[A-Z][A-Z0-9_-]{0,63}$/;

export function validateSequenceName(name: string): boolean {
  return NAME_RE.test(name);
}
