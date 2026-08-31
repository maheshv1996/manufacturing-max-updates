/**
 * Desktop launcher RPC bridge and GitHub direct release checker.
 * Handles local desktop process management, daemon health, and atomic binary updates.
 */

export function desktopControlUrl(path: string): string {
  const host = process.env.MFGMAX_CONTROL_HOST || "127.0.0.1";
  const port = process.env.MFGMAX_CONTROL_PORT || "41841";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `http://${host}:${port}${cleanPath}`;
}

export function isDesktopMode(): boolean {
  const v = String(process.env.DESKTOP_MODE || "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "y" || v === "on" || v === "enable" || v === "enabled";
}

export async function controlFetch(
  path: string,
  init?: RequestInit,
  timeoutMs = Number(process.env.MFGMAX_CONTROL_TIMEOUT_MS) || 5000,
): Promise<Response> {
  const token = process.env.MFGMAX_CONTROL_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: "CONTROL_UNAVAILABLE" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

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
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return new Response(
      JSON.stringify({
        error: isTimeout ? "CONTROL_TIMEOUT" : "CONTROL_UNREACHABLE",
        message: err?.message || "Desktop launcher is offline",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

export function githubRepo(): string {
  return process.env.GITHUB_UPDATE_REPO || "";
}

export function githubReleaseUrl(): string | null {
  const repo = githubRepo();
  if (!repo || !repo.includes("/")) return null;
  const base = process.env.GITHUB_API_BASE || "https://api.github.com";
  return `${base}/repos/${repo}/releases/latest`;
}

/**
 * Robust SemVer 2.0.0 comparison.
 * Supports standard "v1.2.3", "1.2.3-beta.1", "1.2" partials, and build metadata.
 */
export function isNewerVersion(
  candidate: string | undefined | null,
  current: string | undefined | null,
): boolean {
  const parse = (v?: string | null) => {
    if (!v) return null;
    const clean = String(v).trim().replace(/^v/i, "");
    const match = clean.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([^+]+))?(?:\+.*)?$/);
    if (!match) return null;

    return {
      major: parseInt(match[1] || "0", 10),
      minor: parseInt(match[2] || "0", 10),
      patch: parseInt(match[3] || "0", 10),
      prerelease: match[4] || null,
    };
  };

  const a = parse(candidate);
  const b = parse(current);
  if (!a || !b) return false;

  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  if (a.patch !== b.patch) return a.patch > b.patch;

  // When major.minor.patch are equal, a normal release has higher precedence than a pre-release.
  // Example: 1.0.0 is newer than 1.0.0-beta
  if (!a.prerelease && b.prerelease) return true;
  if (a.prerelease && !b.prerelease) return false;
  if (a.prerelease && b.prerelease) {
    return a.prerelease.localeCompare(b.prerelease, undefined, { numeric: true }) > 0;
  }

  return false;
}
