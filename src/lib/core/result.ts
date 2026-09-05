/**
 * C1-1 — Typed Result (either) core.
 * Discriminated union on `tag` so TS narrows cleanly and no `as any` is
 * needed at call sites. Pure module — no Prisma, no I/O.
 */

export type Ok<T> = { tag: "ok"; value: T };
export type Err<E> = { tag: "err"; error: E };

export type Result<T, E = string> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { tag: "ok", value };
}

export function err<E>(error: E): Err<E> {
  return { tag: "err", error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.tag === "ok";
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return r.tag === "err";
}

/** Rewrite only the error branch, leaving the ok branch untouched. */
export function mapErr<T, E, F>(
  r: Result<T, E>,
  fn: (e: E) => F,
): Result<T, F> {
  return r.tag === "ok" ? r : err(fn(r.error));
}

/** Unwrap with a fallback — for call sites where the default is acceptable. */
export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.tag === "ok" ? r.value : fallback;
}
