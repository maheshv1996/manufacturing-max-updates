import { NextResponse } from "next/server";
import {
  controlFetch,
  githubReleaseUrl,
  isDesktopMode,
  isNewerVersion,
} from "@/lib/desktopControl";
import { APP_VERSION } from "@/lib/appVersion";

export const dynamic = "force-dynamic";

const CURRENT = APP_VERSION;

interface GithubAsset {
  name?: string;
  browser_download_url?: string;
  size?: number;
}

export async function GET() {
  // Desktop: ask the launcher (it owns the fetch + timeout + rate handling).
  if (isDesktopMode()) {
    const res = await controlFetch("/update/status");
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        source: "launcher",
        current: data.currentVersion,
        ...data.feed,
      });
    }
    return NextResponse.json({
      source: "launcher",
      error:
        (await res.json().catch(() => ({}))).error || "CONTROL_UNREACHABLE",
      offline: true,
      current: CURRENT,
    });
  }

  // Cloud / web: read the public GitHub latest release directly.
  const url = githubReleaseUrl();
  if (!url) {
    return NextResponse.json({
      source: "cloud",
      offline: true,
      current: CURRENT,
      reason: "GITHUB_UPDATE_REPO not configured",
    });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "MfgMax-Web-Updater",
      },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("FEED_HTTP_" + res.status);
    const feed = await res.json();
    const tag = String(feed.tag_name || "").replace(/^v/, "");
    const assets: GithubAsset[] = Array.isArray(feed.assets) ? feed.assets : [];
    const exe = assets.find(
      (a) => /\.exe$/i.test(a.name || "") && !/\.sha256$/i.test(a.name || ""),
    );
    const shaAsset = assets.find((a) => /\.sha256$/i.test(a.name || ""));
    return NextResponse.json({
      source: "github",
      current: CURRENT,
      offline: false,
      updateAvailable: isNewerVersion(tag, CURRENT),
      latest: tag,
      version: tag,
      notes: feed.body || "",
      url: exe?.browser_download_url || "",
      sha256Url: shaAsset?.browser_download_url || null,
      sizeMb: exe?.size ? Math.round((exe.size / 1024 / 1024) * 10) / 10 : 0,
      tag: feed.tag_name || "",
      releasedAt: feed.published_at || null,
    });
  } catch {
    return NextResponse.json({
      source: "cloud",
      offline: true,
      current: CURRENT,
    });
  }
}
