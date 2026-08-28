import PageHeader from "@/app/components/shared/PageHeader";
import UpdateCard from "@/app/components/shared/UpdateCard";
import { collectHealth } from "@/lib/serverHealth";
import QRCode from "qrcode";
import {
  HeartPulse,
  Database,
  HardDrive,
  Archive,
  Globe,
  Server,
  Activity,
  Clock,
  AlertTriangle,
  Wifi,
} from "lucide-react";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="bg-surface-1 rounded-card border border-border p-4 flex items-start gap-3">
      <span
        className={`p-2 rounded-lg bg-surface-2 border border-border ${tone || "text-text-2"}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-text-3 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-lg font-bold text-text-1 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-text-3 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default async function SystemHealthPage() {
  const health = await collectHealth();
  const port = process.env.PORT || "3000";
  const primaryIp = health.lanIps[0] || "127.0.0.1";
  const lanUrl = `http://${primaryIp}:${port}`;
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(lanUrl, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: "M",
    });
  } catch {
    qrDataUrl = null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Live status of the server, database, storage and backups — the offline edition's health window on the web."
        icon={<HeartPulse className="h-5 w-5 text-emerald-500" />}
      />

      {!health.ok && (
        <div className="p-4 rounded-card border border-rose-500/40 bg-rose-500/10 text-rose-500 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold">
            Database unreachable — {health.db.error}
          </span>
        </div>
      )}
      {health.staleBuild && (
        <div className="p-4 rounded-card border border-rose-500/60 bg-rose-500/15 text-rose-500 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold">
            STALE BUILD DETECTED — this server is serving an outdated manifest
            (built {health.staleBuild.bootBuildId}, disk now has{" "}
            {health.staleBuild.currentBuildId}). CSS/JS assets may 404. Restart
            the server to load the current build.
          </span>
        </div>
      )}
      {health.disk?.warn && (
        <div className="p-4 rounded-card border border-amber-500/40 bg-amber-500/10 text-amber-500 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold">
            Low disk space — under 10 GB free ({health.disk.freeGb} GB). Back up
            and clean up soon.
          </span>
        </div>
      )}

      <UpdateCard currentVersion={health.version} />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <Stat
          icon={<Activity className="h-4 w-4 text-emerald-500" />}
          label="Status"
          value={health.status.toUpperCase()}
          sub={`Mode: ${health.mode}`}
          tone="text-emerald-500"
        />
        <Stat
          icon={<Clock className="h-4 w-4 text-sky-500" />}
          label="Uptime"
          value={fmtUptime(health.uptimeSeconds)}
          sub={`since ${new Date(health.startedAt).toLocaleString()}`}
        />
        <Stat
          icon={<Server className="h-4 w-4 text-indigo-500" />}
          label="Version"
          value={"v" + health.version}
          sub={`Node ${health.node}`}
        />
        <Stat
          icon={<Database className="h-4 w-4 text-violet-500" />}
          label="Database"
          value={health.db.ok ? "CONNECTED" : "DOWN"}
          sub={health.db.sizeMb != null ? `${health.db.sizeMb} MB` : undefined}
          tone={health.db.ok ? "text-violet-500" : "text-rose-500"}
        />
        <Stat
          icon={<HardDrive className="h-4 w-4 text-amber-500" />}
          label="Disk Free"
          value={health.disk ? `${health.disk.freeGb} GB` : "—"}
          sub={
            health.disk ? `of ${health.disk.totalGb} GB total` : "unavailable"
          }
          tone={health.disk?.warn ? "text-rose-500" : "text-amber-500"}
        />
        <Stat
          icon={<Archive className="h-4 w-4 text-teal-500" />}
          label="Last Backup"
          value={health.backup ? health.backup.file : "None yet"}
          sub={
            health.backup
              ? `${health.backup.sizeMb} MB · ${new Date(health.backup.at).toLocaleString()}`
              : "run Backup Now from the launcher tray"
          }
        />
        <Stat
          icon={<Globe className="h-4 w-4 text-blue-500" />}
          label="LAN Access"
          value={primaryIp}
          sub={`port ${port} · scan the QR for tablets`}
        />
        <Stat
          icon={<Wifi className="h-4 w-4 text-cyan-500" />}
          label="Logs Path"
          value={process.env.LOG_DIR || "n/a (server stdout)"}
          sub="set LOG_DIR in the launcher"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-1 rounded-card border border-border p-6 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-text-2 mb-1">
            Scan to connect (tablets on the shop floor)
          </p>
          <p className="text-xs text-text-3 mb-4 font-mono">{lanUrl}</p>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR for ${lanUrl}`}
              className="rounded-xl bg-white p-2 w-56 h-56 print:bg-white"
            />
          ) : (
            <p className="text-sm text-text-3">QR generation unavailable.</p>
          )}
          <p className="text-xs text-text-3 mt-4 max-w-sm">
            Open the same URL on any device on this network to reach the factory
            floor. Data stays local — nothing leaves this machine.
          </p>
        </div>

        <div className="bg-surface-1 rounded-card border border-border p-6">
          <h2 className="text-sm font-semibold text-text-1 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" /> Offline Edition
            Notes
          </h2>
          <ul className="space-y-3 text-sm text-text-2">
            <li className="flex gap-2">
              <span className="text-emerald-500">✓</span> All floor mutations
              (good/scrap/rework, downtime, clock in/out, maintenance, safety,
              ideas, shift counts) queue locally when the server is unreachable
              and auto-drain on reconnect.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500">✓</span> The app shell is
              cached by the service worker — the UI never white-screens on
              network hiccups.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500">✓</span> Fonts and assets are
              self-hosted — zero runtime CDN dependencies.
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500">!</span> Cloud-only features
              (email digests, Razorpay, Google SSO, cloud sync) are env-gated
              and skip silently when offline.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
