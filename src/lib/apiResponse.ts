import { NextResponse } from "next/server";

export interface ApiErrorPayload {
  error: string;
  code?: string;
  details?: any;
}

/**
 * Standardized API Error JSON response helper.
 * Enforces uniform `{ error: string, code?: string }` shape across all 269 API routes.
 */
export function apiError(
  message: string,
  status: number = 400,
  code?: string,
  details?: any,
) {
  const body: ApiErrorPayload = {
    error: message,
    ...(code ? { code } : {}),
    ...(details ? { details } : {}),
  };
  return NextResponse.json(body, { status });
}

/**
 * Standardized API Success JSON response helper.
 */
export function apiSuccess<T extends Record<string, any>>(data: T = {} as T, status: number = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}
