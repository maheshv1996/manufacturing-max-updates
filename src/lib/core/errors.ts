/**
 * C1-2 — Domain error envelope.
 * Typed AppError with stable codes; `toApiError` is the ONLY sanctioned way
 * to convert a thrown value into an API payload. It never leaks `cause`
 * internals or arbitrary error messages (repo precedent: internalError,
 * docs/DEPTH_01 §8 "no 500 details leak").
 */

export type ErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "CONFLICT"
  | "INTERNAL";

export interface AppErrorOptions {
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = options.details;
    if (options.cause !== undefined) {
      // Attach but never serialize: toApiError ignores `cause`.
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function notFound(message: string): AppError {
  return new AppError("NOT_FOUND", message);
}

export function forbidden(message: string, details?: Record<string, unknown>): AppError {
  return new AppError("FORBIDDEN", message, { details });
}

export function unauthorized(message: string): AppError {
  return new AppError("UNAUTHORIZED", message);
}

export function validation(message: string, details?: Record<string, unknown>): AppError {
  return new AppError("VALIDATION", message, { details });
}

export function conflict(message: string): AppError {
  return new AppError("CONFLICT", message);
}

export function internal(message = "Internal Server Error", cause?: unknown): AppError {
  return new AppError("INTERNAL", message, { cause });
}

export interface ApiErrorPayload {
  error: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/** Convert any thrown value to a safe API payload. Never leaks internals. */
export function toApiError(e: unknown): ApiErrorPayload {
  if (e instanceof AppError) {
    return { error: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) };
  }
  // Unknown error — never echo its message or stack.
  return { error: "INTERNAL", message: "Internal Server Error" };
}
