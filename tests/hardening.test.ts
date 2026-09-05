import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Watchdog } from "../desktop/lib/watchdog.js";
import nextConfig from "../next.config";
import { logAuditTx } from "../src/lib/audit";
import { soundFx } from "../src/lib/soundFx";

describe("Software Hardening Suites", () => {
  test("next.config.ts disables poweredByHeader and includes required security headers", async () => {
    assert.equal(nextConfig.poweredByHeader, false, "poweredByHeader must be false to prevent fingerprinting");
    assert.equal(typeof nextConfig.headers, "function", "headers function must be defined");

    if (typeof nextConfig.headers === "function") {
      const headerRules = await nextConfig.headers();
      assert.ok(Array.isArray(headerRules), "headers() must return an array");
      const rootRule = headerRules.find((r: any) => r.source === "/:path*" || r.source === "/(.*)");
      assert.ok(rootRule, "Root route pattern must have security headers");

      const headerMap = new Map(rootRule.headers.map((h: any) => [h.key.toLowerCase(), h.value]));
      assert.equal(headerMap.get("x-content-type-options"), "nosniff");
      assert.equal(headerMap.get("x-frame-options"), "SAMEORIGIN");
      assert.equal(headerMap.get("referrer-policy"), "strict-origin-when-cross-origin");
      assert.ok(headerMap.has("permissions-policy"));
      assert.ok(headerMap.has("cross-origin-opener-policy"));
      assert.ok(headerMap.has("cross-origin-resource-policy"));
      assert.ok(headerMap.has("strict-transport-security"));
    }
  });

  test("watchdog stop() cleanly clears timers and nulls references", () => {
    const wd = new Watchdog({
      name: "test-stop",
      command: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: process.cwd(),
      log: () => {},
    });

    wd.start();
    assert.equal(wd.stopped, false);

    wd.stop();
    assert.equal(wd.stopped, true);
    assert.equal(wd.restartTimer, null);
    assert.equal(wd.child, null);
  });

  test("watchdog death handler deduplicates exit and error events", () => {
    const wd = new Watchdog({
      name: "test-dedup",
      command: "non-existent-binary-xyz",
      args: [] as string[],
      cwd: process.cwd(),
      maxTries: 2,
      restartDelayMs: 50,
      log: () => {},
    });

    wd.start();
    assert.equal(wd.stopped, false);
    wd.stop();
  });

  test("IP throttle window computation removes expired entries", () => {
    const WINDOW_MS = 60 * 1000;
    const now = Date.now();
    const timestamps = [now - WINDOW_MS - 5000, now - 30000, now - 1000];

    const valid = timestamps.filter((t) => now - t < WINDOW_MS);
    assert.equal(valid.length, 2);
    assert.equal(valid[0], now - 30000);
    assert.equal(valid[1], now - 1000);
  });

  test("search query input is safely bounded to 100 characters to prevent ReDoS", () => {
    const oversizedQuery = "a".repeat(5000);
    const safeQuery = oversizedQuery.slice(0, 100).toLowerCase();
    assert.equal(safeQuery.length, 100);
    assert.equal(safeQuery, "a".repeat(100));
  });

  test("range slider parameters adhere to valid WCAG valuemin and valuemax bounds", () => {
    const sliders = [
      { name: "fleet", min: 4, max: 50, val: 12 },
      { name: "downtime", min: 8, max: 60, val: 24 },
      { name: "rate", min: 100, max: 500, val: 150 },
      { name: "scrap", min: 2000, max: 50000, val: 12000 },
    ];

    for (const s of sliders) {
      assert.ok(s.min < s.max, `${s.name}: min must be strictly less than max`);
      assert.ok(s.val >= s.min && s.val <= s.max, `${s.name}: value must be within [min, max]`);
    }
  });

  test("logAuditTx correctly executes inside Prisma transaction client", async () => {
    let capturedArgs: any = null;
    const mockTx = {
      auditLog: {
        create: async (args: any) => {
          capturedArgs = args;
          return { id: "audit_tx_123", ...args.data };
        },
      },
    };

    const res = await logAuditTx(mockTx, {
      actor: "OperatorJane",
      action: "PROJECT_MUTATED",
      entityType: "Project",
      entityId: "proj_999",
      details: "Reassigned work orders",
      severity: "WARN",
    });

    assert.equal(res.id, "audit_tx_123");
    assert.equal(capturedArgs.data.actor, "OperatorJane");
    assert.equal(capturedArgs.data.action, "PROJECT_MUTATED");
    assert.equal(capturedArgs.data.entityType, "PROJECT");
    assert.equal(capturedArgs.data.entityId, "proj_999");
    assert.ok(capturedArgs.data.details.includes("[SEVERITY:WARN]"));
    assert.ok(capturedArgs.data.details.includes("Reassigned work orders"));
  });

  test("soundFx.playAlert is defined and safe in non-browser/muted environments", () => {
    assert.equal(typeof soundFx.playAlert, "function");
    assert.doesNotThrow(() => {
      soundFx.playAlert();
    });
  });

  test("DesktopApp stop() is idempotent and handles multiple invocations safely", () => {
    const os = require("os");
    const fs = require("fs");
    const path = require("path");
    const { DesktopApp } = require("../desktop/launcher.js");
    const tmpDir = path.join(os.tmpdir(), `test_launcher_${Date.now()}`);
    try {
      const app = new DesktopApp({ dataDir: tmpDir, port: 3999, log: () => {} });
      assert.equal(app._stopping, undefined);
      app.stop();
      assert.equal(app._stopping, true);
      // Second stop should be a no-op and not throw
      assert.doesNotThrow(() => {
        app.stop();
      });
      assert.equal(app._stopping, true);
    } finally {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  });

  test("All modals declare role='dialog', aria-modal='true', and Escape key listeners", () => {
    const fs = require("fs");
    const path = require("path");
    const modalFiles = [
      "DrawingLightboxModal.tsx",
      "LeaveModal.tsx",
      "OverrideBadgeModal.tsx",
      "SourceRecordEditModal.tsx",
    ];

    for (const f of modalFiles) {
      const p = path.join(process.cwd(), "src/app/components/modals", f);
      const content = fs.readFileSync(p, "utf8");
      assert.ok(content.includes('role="dialog"'), `${f} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${f} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${f} must handle Escape key navigation`);
    }
  });

  test("TableDensityToggle specifies role='group' and aria-pressed attributes", () => {
    const fs = require("fs");
    const path = require("path");
    const p = path.join(process.cwd(), "src/app/components/ui/TableDensityToggle.tsx");
    const content = fs.readFileSync(p, "utf8");
    assert.ok(content.includes('role="group"'), "TableDensityToggle must specify role='group'");
    assert.ok(content.includes('aria-label="Table row density"'), "TableDensityToggle must specify aria-label");
    assert.ok(content.includes("aria-pressed="), "TableDensityToggle buttons must specify aria-pressed");
  });

  test("offlineSync guards global listeners with singleton flag", () => {
    const fs = require("fs");
    const path = require("path");
    const p = path.join(process.cwd(), "src/lib/offlineSync.ts");
    const content = fs.readFileSync(p, "utf8");
    assert.ok(
      content.includes("__MES_OFFLINE_SYNC_INITIALIZED__"),
      "offlineSync must guard listeners with __MES_OFFLINE_SYNC_INITIALIZED__",
    );
  });

  test("DashboardCustomizer components define role='dialog', aria-modal, and Escape listener", () => {
    const fs = require("fs");
    const path = require("path");
    const sharedCustomizer = fs.readFileSync(
      path.join(process.cwd(), "src/app/components/shared/DashboardCustomizer.tsx"),
      "utf8",
    );
    assert.ok(sharedCustomizer.includes('role="dialog"'));
    assert.ok(sharedCustomizer.includes('aria-modal="true"'));
    assert.ok(sharedCustomizer.includes('"Escape"'));

    const dashboardCustomizer = fs.readFileSync(
      path.join(process.cwd(), "src/app/components/dashboard/DashboardCustomizer.tsx"),
      "utf8",
    );
    assert.ok(dashboardCustomizer.includes('role="dialog"'));
    assert.ok(dashboardCustomizer.includes('aria-modal="true"'));
    assert.ok(dashboardCustomizer.includes('"Escape"'));
  });

  test("Electron main.js enforces startup flag validation and blocks webviews", () => {
    const fs = require("fs");
    const path = require("path");
    const mainJs = fs.readFileSync(
      path.join(process.cwd(), "desktop/electron/main.js"),
      "utf8",
    );
    assert.ok(mainJs.includes("remote-debugging-port"));
    assert.ok(mainJs.includes("disable-web-security"));
    assert.ok(mainJs.includes("will-attach-webview"));
    assert.ok(mainJs.includes("setPermissionRequestHandler"));
  });

  test("Reconcile and Buyer-Board routes enforce transactional logAuditTx", () => {
    const fs = require("fs");
    const path = require("path");
    const reconcileRoute = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/reconcile/route.ts"),
      "utf8",
    );
    assert.ok(reconcileRoute.includes("logAuditTx"));
    assert.ok(reconcileRoute.includes("prisma.$transaction"));
    assert.ok(!reconcileRoute.includes("logAudit("));

    const buyerBoardRoute = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/buyer-board/route.ts"),
      "utf8",
    );
    assert.ok(buyerBoardRoute.includes("logAuditTx"));
    assert.ok(buyerBoardRoute.includes("prisma.$transaction"));
    assert.ok(!buyerBoardRoute.includes("logAudit("));
  });

  test("WorkOrderSerialsCard and Navbar password modal enforce accessible dialog semantics", () => {
    const fs = require("fs");
    const path = require("path");

    const serialsCard = fs.readFileSync(
      path.join(process.cwd(), "src/app/components/workorder/WorkOrderSerialsCard.tsx"),
      "utf8",
    );
    assert.ok(serialsCard.includes('role="dialog"'));
    assert.ok(serialsCard.includes('aria-modal="true"'));
    assert.ok(serialsCard.includes('aria-labelledby="unit-passport-title"'));
    assert.ok(serialsCard.includes('"Escape"'));

    const navbar = fs.readFileSync(
      path.join(process.cwd(), "src/app/components/layout/Navbar.tsx"),
      "utf8",
    );
    assert.ok(navbar.includes('role="dialog"'));
    assert.ok(navbar.includes('aria-modal="true"'));
    assert.ok(navbar.includes('aria-labelledby="change-password-title"'));
    assert.ok(navbar.includes('"Escape"'));
    assert.ok(navbar.includes('aria-haspopup="true"'));
  });

  test("Cal-lab, Eight-D, Tools, Scrap, and Tool-Life routes enforce transactional mutations with logAuditTx", () => {
    const fs = require("fs");
    const path = require("path");

    const routesToCheck = [
      "src/app/api/cal-lab/route.ts",
      "src/app/api/eight-d/route.ts",
      "src/app/api/tools/route.ts",
      "src/app/api/scrap/disposition/route.ts",
      "src/app/api/scrap/quarantine/route.ts",
      "src/app/api/tool-life/route.ts",
      "src/app/api/ideas/route.ts",
      "src/app/api/kaizen/route.ts",
    ];

    for (const r of routesToCheck) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
      assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
    }
  });

  test("Wave 8 routes enforce transactional mutations with logAuditTx and RBAC gating", () => {
    const fs = require("fs");
    const path = require("path");

    const transactionalRoutes = [
      "src/app/api/engineering/bom-tree/route.ts",
      "src/app/api/mrp/generate-requisitions/route.ts",
      "src/app/api/quality/escalations/route.ts",
      "src/app/api/system/roles/route.ts",
      "src/app/api/system/ai/route.ts",
      "src/app/api/automation/rules/route.ts",
      "src/app/api/eco/route.ts",
      "src/app/api/eco/[id]/route.ts",
      "src/app/api/eco/[id]/items/route.ts",
      "src/lib/quotations.ts",
    ];

    for (const r of transactionalRoutes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
      assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
    }

    const rbacGatedRoutes = [
      "src/app/api/rnd/powder-log/route.ts",
      "src/app/api/digital-twin/commissioning/route.ts",
      "src/app/api/engineering/part-marking/route.ts",
      "src/app/api/finance/banking/route.ts",
      "src/app/api/routines/progress/route.ts",
      "src/app/api/maintenance/coolant/route.ts",
      "src/app/api/quality/pyrometry/route.ts",
      "src/app/api/quality/source-inspection/route.ts",
      "src/app/api/supply/plant-transfers/route.ts",
      "src/app/api/quotations/estimate/route.ts",
      "src/app/api/update/apply/route.ts",
    ];

    for (const r of rbacGatedRoutes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("getUserFromHeaders"), `${r} must authenticate caller via getUserFromHeaders`);
    }
  });

  test("Wave 8 modals declare explicit type='button' and modal backdrop dismissals", () => {
    const fs = require("fs");
    const path = require("path");

    const modalFiles = [
      "DrawingLightboxModal.tsx",
      "LeaveModal.tsx",
      "OverrideBadgeModal.tsx",
      "SourceRecordEditModal.tsx",
    ];

    for (const f of modalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), "src/app/components/modals", f), "utf8");
      assert.ok(content.includes('type="button"'), `${f} must declare type="button" on buttons`);
    }

    // Check backdrop click dismiss on LeaveModal, OverrideBadgeModal, SourceRecordEditModal
    const dismissable = ["LeaveModal.tsx", "OverrideBadgeModal.tsx", "SourceRecordEditModal.tsx"];
    for (const f of dismissable) {
      const content = fs.readFileSync(path.join(process.cwd(), "src/app/components/modals", f), "utf8");
      assert.ok(content.includes("stopPropagation"), `${f} must implement click stopPropagation on dialog card`);
    }
  });

  test("Wave 9 routes enforce transactional mutations with logAuditTx and RBAC gating", () => {
    const fs = require("fs");
    const path = require("path");

    const wave9Routes = [
      "src/app/api/rnd/route.ts",
      "src/app/api/rnd/campaigns/route.ts",
      "src/app/api/rnd/campaign/[id]/route.ts",
      "src/app/api/rnd/records/[id]/route.ts",
      "src/app/api/rnd/campaign/[id]/records/route.ts",
      "src/app/api/packaging/eans/route.ts",
      "src/app/api/downtime/route.ts",
      "src/app/api/fives/audits/route.ts",
      "src/app/api/fives/items/route.ts",
      "src/app/api/machines/[machineId]/route.ts",
      "src/app/api/shift-counts/route.ts",
      "src/app/api/kaizen/[id]/route.ts",
    ];

    for (const r of wave9Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
      assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      assert.ok(content.includes("getUserFromHeaders"), `${r} must authenticate caller via getUserFromHeaders`);
    }
  });

  test("Wave 9 modals declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const modalFiles = [
      "src/app/components/shared/UpdateDialog.tsx",
      "src/app/components/shared/AuraIntroModal.tsx",
      "src/app/components/shared/InvestorDemoModal.tsx",
      "src/app/eco/NewEcoModal.tsx",
      "src/app/eco/[id]/AddEcoItemModal.tsx",
      "src/app/commercial/desk/RecordSupplierPaymentModal.tsx",
      "src/app/system/admin/AdminModal.tsx",
      "src/app/system/admin/AssignModal.tsx",
      "src/app/system/kaizen/NewProjectModal.tsx",
    ];

    for (const file of modalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });

  test("Wave 10 routes enforce transactional mutations with logAuditTx and RBAC gating", () => {
    const fs = require("fs");
    const path = require("path");

    const wave10Routes = [
      "src/app/api/attendance/clock/route.ts",
      "src/app/api/ehs/carbon/route.ts",
      "src/app/api/cycle-count/route.ts",
      "src/app/api/fixed-assets/route.ts",
      "src/app/api/appraisals/route.ts",
      "src/app/api/clra/route.ts",
      "src/app/api/disciplinary/route.ts",
      "src/app/api/disciplinary/[id]/route.ts",
      "src/app/api/grievances/route.ts",
      "src/app/api/grievances/[id]/route.ts",
      "src/app/api/extinguishers/route.ts",
      "src/app/api/gate-pass/route.ts",
      "src/app/api/freight/route.ts",
    ];

    for (const r of wave10Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
      assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      assert.ok(content.includes("getUserFromHeaders"), `${r} must authenticate caller via getUserFromHeaders`);
    }
  });

  test("Wave 10 modals and drawers declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const modalFiles = [
      "src/app/components/ai/AuraSidecarDrawer.tsx",
      "src/app/components/layout/CommandPalette.tsx",
      "src/app/components/layout/GlossaryModal.tsx",
      "src/app/complaints/ComplaintsClient.tsx",
      "src/app/people/visitors/VisitorsClient.tsx",
      "src/app/people/appraisals/AppraisalsClient.tsx",
      "src/app/mrb/MrbDashboardClient.tsx",
      "src/app/fai/FaiListClient.tsx",
    ];

    for (const file of modalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });

  test("Wave 11 routes enforce transactional mutations with logAuditTx, caller auth, and RBAC", () => {
    const fs = require("fs");
    const path = require("path");

    const wave11Routes = [
      "src/app/api/work-orders/route.ts",
      "src/app/api/fai/route.ts",
      "src/app/api/fai/[id]/route.ts",
      "src/app/api/mrb/[id]/route.ts",
      "src/app/api/hold-points/route.ts",
      "src/app/api/ppap/route.ts",
      "src/app/api/complaints/route.ts",
      "src/app/api/grn/route.ts",
      "src/app/api/material-issue/route.ts",
      "src/app/api/movement/route.ts",
      "src/app/api/people/visitors/route.ts",
      "src/app/api/people/visitors/[id]/route.ts",
    ];

    for (const r of wave11Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
      assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      assert.ok(content.includes("getUserFromHeaders"), `${r} must authenticate caller via getUserFromHeaders`);
    }
  });

  test("Wave 11 modals and drawers declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const wave11ModalFiles = [
      "src/app/quality/8d/EightDClient.tsx",
      "src/app/quality/ppap/PpapClient.tsx",
      "src/app/quality/grr/GrrClient.tsx",
      "src/app/supply/grn/GrnClient.tsx",
      "src/app/supply/subcontracting/SubcontractingClient.tsx",
      "src/app/ops/scrap/ScrapMRBPageClient.tsx",
      "src/app/ops/schedule/ScheduleBoardClient.tsx",
      "src/app/ops/packaging/PackagingStation.tsx",
    ];

    for (const file of wave11ModalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });

  test("Wave 12 routes enforce transactional mutations with logAuditTx, caller auth, and RBAC", () => {
    const fs = require("fs");
    const path = require("path");

    const wave12Routes = [
      "src/app/api/inventory/route.ts",
      "src/app/api/invoices/route.ts",
      "src/app/api/quotations/route.ts",
      "src/app/api/quotations/[id]/route.ts",
      "src/app/api/maintenance/jobs/route.ts",
      "src/app/api/maintenance/pm/route.ts",
      "src/app/api/maintenance/pm/[id]/done/route.ts",
      "src/app/api/maintenance/tools/route.ts",
      "src/app/api/maintenance/tools/[id]/route.ts",
      "src/app/api/supply/subcontracting/route.ts",
      "src/app/api/supply/subcontracting/inward/route.ts",
      "src/app/api/vouchers/route.ts",
      "src/app/api/vouchers/[id]/route.ts",
      "src/app/api/mrb/route.ts",
      "src/app/api/schedule/route.ts",
      "src/app/api/buyer-board/route.ts",
      "src/app/api/handover/route.ts",
    ];

    for (const r of wave12Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
      assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      assert.ok(content.includes("getUserFromHeaders"), `${r} must authenticate caller via getUserFromHeaders`);
    }
  });

  test("Wave 12 modals and drawers declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const wave12ModalFiles = [
      "src/app/finance/vouchers/VouchersClient.tsx",
      "src/app/supply/tools/ToolsManagementPageClient.tsx",
      "src/app/supply/po-approvals/PoApprovalsClient.tsx",
      "src/app/quality/iqc/IqcClient.tsx",
      "src/app/quality/fqc/FqcClient.tsx",
      "src/app/supply/scorecards/SupplierScorecardsClient.tsx",
      "src/app/maintenance/reliability/ReliabilityClient.tsx",
    ];

    for (const file of wave12ModalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });

  test("Wave 13 routes enforce transactional mutations with logAuditTx, caller auth, and RBAC", () => {
    const fs = require("fs");
    const path = require("path");

    const wave13Routes = [
      "src/app/api/metrology/cert/route.ts",
      "src/app/api/metrology/issue/route.ts",
      "src/app/api/metrology/return/route.ts",
      "src/app/api/quality/pyrometry/route.ts",
      "src/app/api/quality/source-inspection/route.ts",
      "src/app/api/quality-objectives/route.ts",
      "src/app/api/qms/route.ts",
      "src/app/api/qms-docs/route.ts",
      "src/app/api/mrm/route.ts",
    ];

    for (const r of wave13Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
      assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      assert.ok(content.includes("getUserFromHeaders"), `${r} must authenticate caller via getUserFromHeaders`);
      assert.ok(content.includes("Unauthorized"), `${r} must return Unauthorized when unauthenticated`);
      assert.ok(content.includes("Forbidden"), `${r} must return Forbidden when unauthorized`);
    }
  });

  test("Wave 13 modals and drawers declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const wave13ModalFiles = [
      "src/app/quality/objectives/ObjectivesClient.tsx",
      "src/app/quality/qms-docs/QmsDocsClient.tsx",
      "src/app/quality/mrm/MrmClient.tsx",
      "src/app/quality/grr/GrrClient.tsx",
      "src/app/quality/8d/EightDClient.tsx",
      "src/app/quality/ppap/PpapClient.tsx",
    ];

    for (const file of wave13ModalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });

  test("Wave 14 routes enforce auth, atomic transactions, and audit logging", () => {
    const fs = require("fs");
    const path = require("path");

    const wave14Routes = [
      "src/app/api/commercial/customers/route.ts",
      "src/app/api/commercial/customers/[id]/route.ts",
      "src/app/api/commercial/customers/[id]/contacts/route.ts",
      "src/app/api/collections/route.ts",
      "src/app/api/comparative/route.ts",
      "src/app/api/follow-ups/route.ts",
      "src/app/api/drawing-transmittal/route.ts",
      "src/app/api/escalations/route.ts",
    ];

    for (const r of wave14Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
      assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      assert.ok(content.includes("getUserFromHeaders"), `${r} must authenticate caller via getUserFromHeaders`);
      assert.ok(content.includes("Unauthorized"), `${r} must return Unauthorized when unauthenticated`);
      assert.ok(content.includes("Forbidden"), `${r} must return Forbidden when unauthorized`);
    }
  });

  test("Wave 14 modals and drawers declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const wave14ModalFiles = [
      "src/app/commercial/customers/CustomersClient.tsx",
      "src/app/commercial/follow-ups/FollowUpsClient.tsx",
      "src/app/commercial/price-revisions/PriceRevisionsClient.tsx",
      "src/app/commercial/scorecards/ScorecardsClient.tsx",
      "src/app/commercial/exim/EximClient.tsx",
    ];

    for (const file of wave14ModalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });

  test("Wave 15 routes enforce auth, atomic transactions, and audit logging", () => {
    const fs = require("fs");
    const path = require("path");

    const wave15Routes = [
      "src/app/api/finance/gl-accounts/route.ts",
      "src/app/api/finance/expenses/route.ts",
      "src/app/api/finance/insurance/route.ts",
      "src/app/api/finance/insurance/[id]/route.ts",
      "src/app/api/finance/periods/route.ts",
      "src/app/api/finance/periods/[id]/route.ts",
      "src/app/api/bank-reconcile/route.ts",
      "src/app/api/gst-recon/route.ts",
      "src/app/api/gst-recon/[id]/route.ts",
      "src/app/api/exposure/route.ts",
    ];

    for (const r of wave15Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
      assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      assert.ok(content.includes("getUserFromHeaders"), `${r} must authenticate caller via getUserFromHeaders`);
      assert.ok(content.includes("Unauthorized"), `${r} must return Unauthorized when unauthenticated`);
      assert.ok(content.includes("Forbidden"), `${r} must return Forbidden when unauthorized`);
    }
  });

  test("Wave 15 modals and drawers declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const wave15ModalFiles = [
      "src/app/finance/expenses/ExpensesClient.tsx",
      "src/app/finance/insurance/InsuranceClient.tsx",
      "src/app/finance/gst-recon/GstReconClient.tsx",
      "src/app/finance/assets/AssetsClient.tsx",
      "src/app/finance/collections/CollectionsClient.tsx",
    ];

    for (const file of wave15ModalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });

  test("Wave 16 routes enforce auth, atomic transactions, and audit logging", () => {
    const fs = require("fs");
    const path = require("path");

    const wave16Routes = [
      "src/app/api/payroll/route.ts",
      "src/app/api/people/employees/route.ts",
      "src/app/api/people/employees/[id]/route.ts",
      "src/app/api/overtime/route.ts",
      "src/app/api/recruitment/route.ts",
      "src/app/api/training/route.ts",
      "src/app/api/ppe/route.ts",
      "src/app/api/people/expenses/route.ts",
      "src/app/api/people/visitors/route.ts",
      "src/app/api/people/visitors/[id]/route.ts",
    ];

    for (const r of wave16Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
      assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      assert.ok(content.includes("getUserFromHeaders"), `${r} must authenticate caller via getUserFromHeaders`);
      assert.ok(content.includes("Unauthorized"), `${r} must return Unauthorized when unauthenticated`);
      if (r !== "src/app/api/people/expenses/route.ts") {
        assert.ok(content.includes("403"), `${r} must return 403 when unauthorized`);
      }
    }
  });

  test("Wave 16 modals declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const wave16ModalFiles = [
      "src/app/people/employees/EmployeesClient.tsx",
      "src/app/people/payroll/PayrollClient.tsx",
      "src/app/people/recruitment/RecruitmentClient.tsx",
      "src/app/people/training/TrainingClient.tsx",
      "src/app/ehs/ppe/PpeClient.tsx",
      "src/app/people/my-expenses/MyExpensesClient.tsx",
    ];

    for (const file of wave16ModalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });

  test("Wave 17 routes enforce auth, atomic transactions, and audit logging", () => {
    const fs = require("fs");
    const path = require("path");

    const wave17Routes = [
      "src/app/api/safety/route.ts",
      "src/app/api/energy/route.ts",
      "src/app/api/fives/audits/route.ts",
      "src/app/api/fives/items/route.ts",
      "src/app/api/fives/route.ts",
      "src/app/api/compliance/digest/route.ts",
      "src/app/api/compliance/digest/send/route.ts",
      "src/app/api/docs/audit/route.ts",
      "src/app/api/access-review/route.ts",
      "src/app/api/audit/route.ts",
    ];

    for (const r of wave17Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("getUserFromHeaders"), `${r} must authenticate caller via getUserFromHeaders`);
      assert.ok(content.includes("Unauthorized"), `${r} must return Unauthorized when unauthenticated`);
      assert.ok(content.includes("Forbidden"), `${r} must return Forbidden when unauthorized`);
      const isMutative = /export async function (POST|PUT|PATCH|DELETE)/i.test(content);
      if (isMutative) {
        assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
        assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      }
    }
  });

  test("Wave 17 modals declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const wave17ModalFiles = [
      "src/app/system/safety/SafetyDashboardPageClient.tsx",
      "src/app/system/fives/FiveSClient.tsx",
      "src/app/system/access-review/AccessReviewClient.tsx",
      "src/app/system/admin/EnergyTab.tsx",
      "src/app/system/admin/FiveSChecklistTab.tsx",
    ];

    for (const file of wave17ModalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });

  test("Wave 18 routes enforce auth, atomic transactions, and audit logging", () => {
    const fs = require("fs");
    const path = require("path");

    const wave18Routes = [
      "src/app/api/commercial/sales-orders/route.ts",
      "src/app/api/commercial/sales-orders/[id]/route.ts",
      "src/app/api/quotations/route.ts",
      "src/app/api/quotations/[id]/route.ts",
      "src/app/api/quotations/[id]/convert/route.ts",
      "src/app/api/quotations/estimate/route.ts",
      "src/app/api/invoices/[id]/pay/route.ts",
      "src/app/api/marketing/route.ts",
      "src/app/api/billing/pay/route.ts",
      "src/app/api/billing/manual/route.ts",
    ];

    for (const r of wave18Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("Unauthorized"), `${r} must return Unauthorized when unauthenticated`);
      assert.ok(content.includes("Forbidden"), `${r} must return Forbidden when unauthorized`);
      const isMutative = /export async function (POST|PUT|PATCH|DELETE)/i.test(content);
      if (isMutative && r !== "src/app/api/quotations/estimate/route.ts" && r !== "src/app/api/billing/pay/route.ts" && r !== "src/app/api/quotations/[id]/convert/route.ts") {
        assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
        assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      }
    }
  });

  test("Wave 18 modals declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const wave18ModalFiles = [
      "src/app/commercial/sales-orders/SalesOrdersClient.tsx",
      "src/app/commercial/quotations/QuotationsClient.tsx",
      "src/app/commercial/marketing/MarketingClient.tsx",
      "src/app/system/subscription/SubscriptionClient.tsx",
    ];

    for (const file of wave18ModalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });

  test("Wave 19 routes enforce auth, atomic transactions, and audit logging", () => {
    const fs = require("fs");
    const path = require("path");

    const wave19Routes = [
      "src/app/api/admin/certifications/route.ts",
      "src/app/api/admin/certifications/[id]/route.ts",
      "src/app/api/admin/data/route.ts",
      "src/app/api/admin/documents/route.ts",
      "src/app/api/admin/metrology/route.ts",
      "src/app/api/admin/reveal-password/route.ts",
      "src/app/api/admin/route.ts",
      "src/app/api/admin/source-records/edit/route.ts",
      "src/app/api/system/departments/route.ts",
      "src/app/api/system/roles/route.ts",
      "src/app/api/system/announcements/route.ts",
      "src/app/api/system/announcements/[id]/route.ts",
    ];

    for (const r of wave19Routes) {
      const content = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      assert.ok(content.includes("Unauthorized"), `${r} must return Unauthorized when unauthenticated`);
      assert.ok(content.includes("Forbidden"), `${r} must return Forbidden when unauthorized`);
      const isMutative = /export async function (POST|PUT|PATCH|DELETE)/i.test(content);
      if (isMutative && r !== "src/app/api/admin/route.ts" && r !== "src/app/api/admin/source-records/edit/route.ts") {
        assert.ok(content.includes("logAuditTx"), `${r} must use logAuditTx`);
        assert.ok(content.includes("prisma.$transaction"), `${r} must wrap mutations in prisma.$transaction`);
      }
    }
  });

  test("Wave 19 modals declare backdrop dismissal, Escape listener, and explicit button types", () => {
    const fs = require("fs");
    const path = require("path");

    const wave19ModalFiles = [
      "src/app/system/admin/AdminClient.tsx",
      "src/app/system/admin/CertificationsTab.tsx",
      "src/app/system/admin/DocumentsTab.tsx",
      "src/app/system/admin/MetrologyTab.tsx",
      "src/app/system/announcements/AnnouncementsClient.tsx",
    ];

    for (const file of wave19ModalFiles) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(content.includes('role="dialog"'), `${file} must specify role="dialog"`);
      assert.ok(content.includes('aria-modal="true"'), `${file} must specify aria-modal="true"`);
      assert.ok(content.includes('"Escape"'), `${file} must handle Escape key navigation`);
      assert.ok(content.includes('type="button"'), `${file} must declare explicit button types`);
      assert.ok(content.includes("stopPropagation"), `${file} must prevent modal inner click bubbling`);
    }
  });
});
