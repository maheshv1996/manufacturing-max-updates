import { NextResponse } from "next/server";

/**
 * Centralized error sanitizer — prevents internal stack / prisma messages leaking to clients.
 * - 400 validation/business errors: preserve the safe message passed in (caller explicitly chose it)
 * - 500 unknown: log server-side, return generic "Internal Server Error" (or failClosedMessage)
 * Use in every catch block that previously did `error.message`.
 */
export function internalError(message = "Internal Server Error", status = 500, logContext?: string, originalError?: unknown) {
  if (originalError) {
    console.error(logContext || "API internal error:", originalError);
  }
  return NextResponse.json({ error: message }, { status });
}

export function validationError(message: string, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
}
