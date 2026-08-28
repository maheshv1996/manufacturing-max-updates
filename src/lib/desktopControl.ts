/**
 * Bridges the web UI to the desktop launcher's localhost control server.
 * The launcher injects MFGMAX_CONTROL_TOKEN + MFGMAX_CONTROL_PORT into the
 * server process env; the browser never sees the token — all calls proxy
 * through these server routes.
 */
export function desktopControlUrl(path: string) {
  const port = process.env.MFGMAX_CONTROL_PORT || "41841";
  return `http://127.0.0.1:${port}${path}`;
}

export function isDesktopMode() {
  return process.env.DESKTOP_MODE === "true";
}

export async function controlFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = process.env.MFGMAX_CONTROL_TOKEN;
  if (!token)
    return new Response(JSON.stringify({ error: "CONTROL_UNAVAILABLE" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(desktopControlUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    return new Response(JSON.stringify({ error: "CONTROL_UNREACHABLE" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GITHUB DIRECT update channel (zero Vercel): the public
 * <owner>/<brand>-updates releases repo is the update server.
 * GITHUB_API_BASE is a testing/self-hosted override; production uses
 * https://api.github.com (unauthenticated, 60 req/hr — plenty for
 * start-check + manual checks).
 */
export function githubRepo(): string {
  return process.env.GITHUB_UPDATE_REPO || "";
}

export function githubReleaseUrl(): string | null {
  const repo = githubRepo();
  if (!repo.includes("/")) return null;
  const base = process.env.GITHUB_API_BASE || "https://api.github.com";
  return `${base}/repos/${repo}/releases/latest`;
}

/** Tiny semver compare for the server side (no desktop dep). */
export function isNewerVersion(
  candidate: string | undefined | null,
  current: string,
): boolean {
  const parse = (v: string) => {
    const m = String(v)
      .trim()
      .match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
    return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
  };
  const a = parse(candidate || "");
  const b = parse(current);
  if (!a || !b) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch > b.patch;
}
