// ─── UI primitives ─────────────────────────────────────────────
export {
  Button,
  type ButtonVariant,
  type ButtonSize,
  Card,
  CardHeader,
  CardContent,
  EmptyState,
  Input,
  type InputProps,
  Select,
  type SelectProps,
  StatusPill,
  type StatusVariant,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
  ToastContainer,
  AnimatedCounter,
  KpiCard,
} from "./ui";

// ─── Layout & app chrome ───────────────────────────────────────
export { default as AppShell } from "./layout/AppShell";
export { default as Sidebar } from "./layout/Sidebar";
export { default as Topbar } from "./layout/Topbar";
export { default as Navbar } from "./layout/Navbar";
export { default as CommandPalette } from "./layout/CommandPalette";
export { default as PlantSwitcher } from "./layout/PlantSwitcher";
export { default as LanguageToggle } from "./layout/LanguageToggle";
export { default as ServiceWorkerRegister } from "./layout/ServiceWorkerRegister";
export { default as InstallPrompt } from "./layout/InstallPrompt";
export { default as SubscriptionGuard } from "./layout/SubscriptionGuard";
export { default as ServerHealthBanner } from "./layout/ServerHealthBanner";
export { default as OfflineSyncBadge } from "./layout/OfflineSyncBadge";
export { default as OfflineToastNotifier } from "./layout/OfflineToastNotifier";

// ─── Dashboard / command center ────────────────────────────────
export { default as DashboardClient } from "./dashboard/DashboardClient";
export { default as DashboardCharts } from "./dashboard/DashboardCharts";
export { default as DashboardCustomizer } from "./dashboard/DashboardCustomizer";
export { default as DashboardHeaderClient } from "./dashboard/DashboardHeaderClient";
export { default as DashboardMachineCards } from "./dashboard/DashboardMachineCards";
export { default as DashboardRecentLogs } from "./dashboard/DashboardRecentLogs";
export { default as CollapsibleDigestCard } from "./dashboard/CollapsibleDigestCard";
export { default as DateRangeBar } from "./dashboard/DateRangeBar";

// ─── Work order detail cards ───────────────────────────────────
export { default as WorkOrderDataPackageCard } from "./workorder/WorkOrderDataPackageCard";
export { default as WorkOrderDispatchesCard } from "./workorder/WorkOrderDispatchesCard";
export { default as WorkOrderDrawingsCard } from "./workorder/WorkOrderDrawingsCard";
export { default as WorkOrderFinancialCard } from "./workorder/WorkOrderFinancialCard";
export { default as WorkOrderReadinessCard } from "./workorder/WorkOrderReadinessCard";
export { default as WorkOrderSerialsCard } from "./workorder/WorkOrderSerialsCard";
export { default as WorkOrderStandardTimeCard } from "./workorder/WorkOrderStandardTimeCard";
export { default as WorkOrderTablesWithEdits } from "./workorder/WorkOrderTablesWithEdits";
export { default as WorkOrdersClientHeader } from "./workorder/WorkOrdersClientHeader";
export { default as CopyTrackingButton } from "./workorder/CopyTrackingButton";

// ─── Machine detail ────────────────────────────────────────────
export { default as MachineDetailChart } from "./machine/MachineDetailChart";
export { default as MachineDetailHeaderClient } from "./machine/MachineDetailHeaderClient";
export { default as MaintenanceCard } from "./machine/MaintenanceCard";

// ─── Modals ────────────────────────────────────────────────────
export { default as SourceRecordEditModal } from "./modals/SourceRecordEditModal";
export { default as OverrideBadgeModal } from "./modals/OverrideBadgeModal";
export { default as DrawingLightboxModal } from "./modals/DrawingLightboxModal";
export { default as LeaveModal } from "./modals/LeaveModal";

// ─── Print & reports ───────────────────────────────────────────
export { default as PrintButton } from "./print/PrintButton";
export { default as PrintWrapper } from "./print/PrintWrapper";

// ─── Shared ────────────────────────────────────────────────────
export { default as HubClient } from "./shared/HubClient";
export { default as PageHeader } from "./shared/PageHeader";
export { default as DynamicRegister } from "./shared/DynamicRegister";
export { default as ScrambleText } from "./shared/ScrambleText";
export { default as ThreeHero } from "./shared/ThreeHero";
export { default as UpdateCard } from "./shared/UpdateCard";
export { default as UpdateDialog } from "./shared/UpdateDialog";
export { default as SidebarUpdateButton } from "./shared/SidebarUpdateButton";
export { default as MyRoutineCard } from "./shared/MyRoutineCard";
