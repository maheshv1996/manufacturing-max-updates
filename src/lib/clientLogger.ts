/**
 * Centralized Client-Side Logger & Error Reporting
 * Provides standardized error formatting and prevents unhandled console spam in production.
 */

export interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  meta?: Record<string, any>;
}

export function logClientError(
  error: unknown,
  context?: LogContext | string | any,
  ...extraArgs: any[]
) {
  let ctx: LogContext = {};
  if (typeof context === "string") {
    ctx = { component: context };
  } else if (context && typeof context === "object" && !(context instanceof Error)) {
    ctx = context;
  }

  let errorMessage = "";
  let stack: string | undefined;

  if (error instanceof Error) {
    errorMessage = error.message;
    stack = error.stack;
  } else if (typeof error === "string") {
    errorMessage = error;
    if (context instanceof Error) {
      errorMessage += `: ${context.message}`;
      stack = context.stack;
    }
  } else {
    errorMessage = String(error || "Unknown Error");
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(
      `[${ctx.component || "App"}] ${ctx.action ? ctx.action + ": " : ""}${errorMessage}`,
      {
        ...ctx,
        stack,
        ...(extraArgs.length > 0 ? { extraArgs } : {}),
      },
    );
  } else {
    // In production, keep logging structured
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: errorMessage,
        component: ctx.component,
        action: ctx.action,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

export function logClientWarn(message: string, context?: LogContext | string) {
  const ctx = typeof context === "string" ? { component: context } : context || {};
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[${ctx.component || "App"}] ${message}`, ctx);
  }
}
