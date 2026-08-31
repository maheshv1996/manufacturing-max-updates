"use client";


import { logClientError } from "@/lib/clientLogger";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Package,
  Play,
  Plus,
  RefreshCw,
  UserCheck,
  Delete,
  BadgeCheck,
  Zap,
  StopCircle,
  X,
  Tablet,
  Check,
  ArrowRight,
  Truck,
  Inbox,
  Wrench,
  Lightbulb,
  ShieldAlert,
  Info,
  Key,
  Loader2,
  AlertCircle,
  FileText,
  ClipboardCheck,
  LogOut,
  Camera,
  Home,
  Shuffle,
} from "lucide-react";
import InstallPrompt from "@/app/components/layout/InstallPrompt";

import OperatorRecentLogs from "./OperatorRecentLogs";
import AiVisionDiagnostics from "./AiVisionDiagnostics";
import MyRoutineCard from "@/app/components/shared/MyRoutineCard";
import { offlineFetchWrapper } from "@/lib/offlineSync";
import OfflineSyncBadge from "@/app/components/layout/OfflineSyncBadge";
import DrawingLightboxModal from "@/app/components/modals/DrawingLightboxModal";
import LanguageToggle from "@/app/components/layout/LanguageToggle";
import { t, Language } from "@/lib/i18n";
import { soundFx, triggerHaptic } from "@/lib/soundFx";

interface OperatorUser {
  employeeNumber?: string | null;
  id: string;
  name: string;
  role: string;
}

interface OperatorMachine {
  id: string;
  name: string;
  code: string;
  status: string;
  line?: {
    name: string;
    plant?: { name: string };
  };
}

interface DowntimeReason {
  id: string;
  code: string;
  description: string;
  nameTe?: string;
  nameHi?: string;
  category: string;
}

interface DefectCode {
  id: string;
  code: string;
  description: string;
  nameTe?: string;
  nameHi?: string;
  severity: string;
}

export default function OperatorTabletView() {
  // Saved selection states
  const [operatorId, setOperatorId] = useState<string>("");
  const [machineId, setMachineId] = useState<string>("");
  const [isSetupDone, setIsSetupDone] = useState<boolean>(false);

  // Employee-number keypad (badge culture)
  const [empInput, setEmpInput] = useState<string>("");
  const [empError, setEmpError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState<number>(0);

  const [currentLang, setCurrentLang] = useState<Language>("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("operator_lang") as Language;
      if (saved && ["en", "te", "hi"].includes(saved)) {
        setCurrentLang(saved);
      }
    }

    const handleLangChangeEvent = (e: any) => {
      if (e.detail && ["en", "te", "hi"].includes(e.detail)) {
        setCurrentLang(e.detail as Language);
      }
    };

    window.addEventListener("operator_lang_changed", handleLangChangeEvent);
    return () =>
      window.removeEventListener(
        "operator_lang_changed",
        handleLangChangeEvent,
      );
  }, []);

  // Initial lookup data
  const [operators, setOperators] = useState<OperatorUser[]>([]);
  const [machines, setMachines] = useState<OperatorMachine[]>([]);
  const [downtimeReasons, setDowntimeReasons] = useState<DowntimeReason[]>([]);
  const [defectCodes, setDefectCodes] = useState<DefectCode[]>([]);
  const [calibratedTools, setCalibratedTools] = useState<any[]>([]);
  const [selectedCalibratedToolId, setSelectedCalibratedToolId] =
    useState<string>("");

  // Live state data
  const [machineState, setMachineState] = useState<OperatorMachine | null>(
    null,
  );
  const [openDowntime, setOpenDowntime] = useState<any>(null);
  const [activeWorkOrder, setActiveWorkOrder] = useState<any>(null);
  const [plannedWorkOrders, setPlannedWorkOrders] = useState<any[]>([]);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [selectedPlannedWoId, setSelectedPlannedWoId] = useState<string>("");
  const [showAiVisionModal, setShowAiVisionModal] = useState<boolean>(false);
  // P8 — skill-based My Queue: only WOs whose op machine matches valid certs,
  // plus manager assign-overrides.
  const [skillMachineIds, setSkillMachineIds] = useState<string[]>([]);
  const [myRoster, setMyRoster] = useState<any[]>([]); // P24 — own shifts from the published weekly roster
  const [overrideWorkOrderIds, setOverrideWorkOrderIds] = useState<string[]>(
    [],
  );
  // P10 — IPQC checklist (from Control Plan)
  const [ipccRun, setIpccRun] = useState<any>(null);
  const [ipccValues, setIpccValues] = useState<Record<string, string>>({});
  const [ipccLoading, setIpccLoading] = useState(false);
  const [ipccMsg, setIpccMsg] = useState("");
  const [ipccError, setIpccError] = useState("");
  const [showOnlyCertified, setShowOnlyCertified] = useState(true);
  const [isManagerView, setIsManagerView] = useState(false);
  const [operatorsList, setOperatorsList] = useState<any[]>([]);
  const [overrideTarget, setOverrideTarget] = useState<string>("");
  const [overrideOperator, setOverrideOperator] = useState<string>("");
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);
  const [incomingQueue, setIncomingQueue] = useState<any[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<any[]>([]);
  const [todayAttendanceLog, setTodayAttendanceLog] = useState<any>(null);
  const [certification, setCertification] = useState<any>(null);
  const [assignedTools, setAssignedTools] = useState<any[]>([]);
  const [dismissedToolAlert, setDismissedToolAlert] = useState<boolean>(false);
  const [clockingLoading, setClockingLoading] = useState<boolean>(false);

  // Quick Idea Modal States
  const [showIdeaModal, setShowIdeaModal] = useState<boolean>(false);
  const [ideaTitleInput, setIdeaTitleInput] = useState<string>("");
  const [ideaDescInput, setIdeaDescInput] = useState<string>("");
  const [ideaCategoryInput, setIdeaCategoryInput] =
    useState<string>("CYCLE_TIME");
  const [ideaSubmitting, setIdeaSubmitting] = useState<boolean>(false);

  // Fast Safety Log States
  const [showFastSafetyModal, setShowFastSafetyModal] =
    useState<boolean>(false);
  const [safetyTypeInput, setSafetyTypeInput] = useState<string>("HAZARD");
  const [safetySeverityInput, setSafetySeverityInput] =
    useState<string>("HIGH");
  const [safetyDescInput, setSafetyDescInput] = useState<string>("");
  const [safetySubmitting, setSafetySubmitting] = useState<boolean>(false);

  // Serial Capture States
  const [serialCaptureType, setSerialCaptureType] = useState<"MANUAL" | "AUTO">(
    "MANUAL",
  );
  const [serialInput, setSerialInput] = useState<string>("");
  const [scrappedSerialNo, setScrappedSerialNo] = useState<string>("");

  // Change Password Modal States
  const [showChangePasswordModal, setShowChangePasswordModal] =
    useState<boolean>(false);
  const [opCurrentPass, setOpCurrentPass] = useState<string>("");
  const [opNewPass, setOpNewPass] = useState<string>("");
  const [opConfirmPass, setOpConfirmPass] = useState<string>("");
  const [opPassLoading, setOpPassLoading] = useState<boolean>(false);
  const [opPassError, setOpPassError] = useState<string | null>(null);

  // Drawing & SOP Lightbox States
  const [activeWoDocuments, setActiveWoDocuments] = useState<any[]>([]);
  const [showDrawingModal, setShowDrawingModal] = useState<boolean>(false);
  const [selectedDrawing, setSelectedDrawing] = useState<any>(null);

  // Request Maintenance Modal States
  const [showMaintenanceModal, setShowMaintenanceModal] =
    useState<boolean>(false);
  const [maintDescInput, setMaintDescInput] = useState<string>("");
  const [maintPriorityInput, setMaintPriorityInput] =
    useState<string>("MEDIUM");
  const [maintSubmitting, setMaintSubmitting] = useState<boolean>(false);
  const [activeRoutingSteps, setActiveRoutingSteps] = useState<any[]>([]);
  const [activeEcoRevisions, setActiveEcoRevisions] = useState<string[]>([]);
  const [activeBomLines, setActiveBomLines] = useState<any[]>([]);
  const [effectivityPending, setEffectivityPending] = useState<boolean>(false);
  const [prototypeMode, setPrototypeMode] = useState<boolean>(false);

  useEffect(() => {
    if (activeWorkOrder?.id) {
      const firstSerial = serialInput.split(",")[0].trim();
      const serialQuery = firstSerial ? `&serialNumber=${firstSerial}` : "";
      const url = `/api/terminal/active-documents?workOrderId=${activeWorkOrder.id}${serialQuery}`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.documents) {
            setActiveWoDocuments(data.documents);
            if (data.appliedRevisions && data.appliedRevisions.length > 0) {
              setActiveEcoRevisions((prev) =>
                Array.from(new Set([...prev, ...data.appliedRevisions])),
              );
            }
          }
          if (typeof data.effectivityPending === "boolean") {
            setEffectivityPending(data.effectivityPending);
          }
          if (typeof data.prototypeMode === "boolean") {
            setPrototypeMode(data.prototypeMode);
          }
        })
        .catch((err) => logClientError(err, "OperatorTabletView"));

      const rUrl = `/api/terminal/active-routing?workOrderId=${activeWorkOrder.id}${serialQuery}`;
      fetch(rUrl)
        .then((res) => res.json())
        .then((data) => {
          if (data.routingSteps) {
            setActiveRoutingSteps(data.routingSteps);
            if (data.appliedRevisions && data.appliedRevisions.length > 0) {
              setActiveEcoRevisions((prev) =>
                Array.from(new Set([...prev, ...data.appliedRevisions])),
              );
            }
          }
          if (typeof data.effectivityPending === "boolean") {
            setEffectivityPending(data.effectivityPending);
          }
          if (typeof data.prototypeMode === "boolean") {
            setPrototypeMode(data.prototypeMode);
          }
        })
        .catch((err) => logClientError(err, "OperatorTabletView"));

      const bUrl = `/api/terminal/active-bom?workOrderId=${activeWorkOrder.id}${serialQuery}`;
      fetch(bUrl)
        .then((res) => res.json())
        .then((data) => {
          if (data.bomLines) {
            setActiveBomLines(data.bomLines);
          }
          if (typeof data.effectivityPending === "boolean") {
            setEffectivityPending(data.effectivityPending);
          }
          if (typeof data.prototypeMode === "boolean") {
            setPrototypeMode(data.prototypeMode);
          }
        })
        .catch((err) => logClientError(err, "OperatorTabletView"));
    } else {
      setActiveWoDocuments([]);
      setActiveRoutingSteps([]);
      setActiveEcoRevisions([]);
      setActiveBomLines([]);
      setEffectivityPending(false);
      setPrototypeMode(false);
    }
  }, [activeWorkOrder?.id, serialInput]);

  const handleChangeOperatorPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (opNewPass !== opConfirmPass) {
      setOpPassError("New passwords do not match.");
      return;
    }

    try {
      setOpPassLoading(true);
      setOpPassError(null);

      const res = await offlineFetchWrapper("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: opCurrentPass,
          newPassword: opNewPass,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setOpPassError(resData.error || "Failed to change password.");
      } else {
        alert("✅ Password updated successfully!");
        setShowChangePasswordModal(false);
        setOpCurrentPass("");
        setOpNewPass("");
        setOpConfirmPass("");
      }
    } catch (err) {
      setOpPassError("Failed to connect to server.");
    } finally {
      setOpPassLoading(false);
    }
  };

  // UI Modals
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<
    | "LOG_GOOD"
    | "LOG_SCRAP"
    | "REPORT_DOWNTIME"
    | "MOVE_MATERIAL"
    | "HOLDPOINT_SIGNOFF"
    | null
  >(null);

  // Calibration Expired Block State (Nadcap)
  const [calibrationBlock, setCalibrationBlock] = useState<{
    toolName: string;
    toolSerial: string;
    expiresAt: string;
  } | null>(null);

  // Hold Point Blocked State
  const [holdPointData, setHoldPointData] = useState<{
    authority: string;
    stepId: string;
    serialUnitIds?: string[];
  } | null>(null);
  const [signoffInspectorName, setSignoffInspectorName] = useState("");
  const [signoffInspectorOrg, setSignoffInspectorOrg] = useState("");
  const [signoffResult, setSignoffResult] = useState("PASSED");
  const [signoffRemarks, setSignoffRemarks] = useState("");
  const [signoffLoading, setSignoffLoading] = useState(false);

  // Form Inputs
  const [goodQtyInput, setGoodQtyInput] = useState<string>("10");
  const [scrapQtyInput, setScrapQtyInput] = useState<string>("1");
  const [selectedDefectCodeId, setSelectedDefectCodeId] = useState<string>("");
  const [selectedReasonId, setSelectedReasonId] = useState<string>("");
  const [downtimeNotes, setDowntimeNotes] = useState<string>("");
  const [moveQtyInput, setMoveQtyInput] = useState<string>("0");
  const [moveToStation, setMoveToStation] = useState<string>("");
  const [moveLoading, setMoveLoading] = useState<boolean>(false);

  // Live Clock
  const [clockTime, setClockTime] = useState<string>("");

  // 1. Initial Load & Restore LocalStorage
  useEffect(() => {
    const savedOp = localStorage.getItem("operator_id");
    const savedMac = localStorage.getItem("operator_machine_id");

    if (savedOp && savedMac) {
      setOperatorId(savedOp);
      setMachineId(savedMac);
      setIsSetupDone(true);
    }

    fetchInitData();

    const timer = setInterval(() => {
      setClockTime(new Date().toLocaleTimeString());
    }, 1000);
    setClockTime(new Date().toLocaleTimeString());

    return () => clearInterval(timer);
  }, []);

  // 2. Fetch Live Machine & WO State
  useEffect(() => {
    if (isSetupDone && machineId && operatorId) {
      fetchLiveState(machineId, operatorId);
      const poll = setInterval(
        () => fetchLiveState(machineId, operatorId),
        5000,
      );
      return () => clearInterval(poll);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetupDone, machineId, operatorId]);

  const fetchInitData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/operator/init");
      const data = await res.json();
      setOperators(data.operators || []);
      setMachines(data.machines || []);
      setDowntimeReasons(data.downtimeReasons || []);
      setDefectCodes(data.defectCodes || []);
      setCalibratedTools(data.calibratedTools || []);

      if (data.defectCodes && data.defectCodes.length > 0) {
        setSelectedDefectCodeId(data.defectCodes[0].id);
      }
      if (data.downtimeReasons && data.downtimeReasons.length > 0) {
        setSelectedReasonId(data.downtimeReasons[0].id);
      }
    } catch (err) {
      logClientError("Failed to fetch init data:", err, "OperatorTabletView");
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveState = async (mId: string, opId: string) => {
    try {
      const res = await fetch(
        `/api/operator/state?machineId=${mId}&operatorId=${opId}`,
      );
      const data = await res.json();

      setMachineState(data.machine || null);
      setOpenDowntime(data.openDowntime || null);
      setActiveWorkOrder(data.activeWorkOrder || null);
      setPlannedWorkOrders(data.plannedWorkOrders || []);
      setSkillMachineIds(data.skillMachineIds || []);
      setMyRoster(data.myRoster || []);
      setOverrideWorkOrderIds(data.overrideWorkOrderIds || []);
      setCurrentShift(data.currentShift || null);
      setIncomingQueue(data.incomingQueue || []);
      setActiveAssignments(data.activeAssignments || []);
      setCertification(data.certification || null);
      setAssignedTools(data.assignedTools || []);
      if (data.todayAttendanceLog) {
        setTodayAttendanceLog(data.todayAttendanceLog);
      }

      if (
        data.plannedWorkOrders &&
        data.plannedWorkOrders.length > 0 &&
        !selectedPlannedWoId
      ) {
        setSelectedPlannedWoId(data.plannedWorkOrders[0].id);
      }
    } catch (err) {
      logClientError("Failed to fetch live state:", err, "OperatorTabletView");
    }
  };

  // P8 — manager detection + operator list for skill overrides.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m?.user && (m.user.level === "MANAGER" || m.user.isOwner)) {
          setIsManagerView(true);
          fetch("/api/admin/data?type=users")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              const users = d?.users || d?.items || (Array.isArray(d) ? d : []);
              setOperatorsList(
                users.filter(
                  (u: any) =>
                    u.roleName === "OPERATOR" ||
                    u.role?.name === "OPERATOR" ||
                    u.level === "WORKER",
                ),
              );
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const doAssignOverride = async () => {
    if (!overrideTarget || !overrideOperator) {
      setOverrideMsg("Pick a WO and an operator first.");
      return;
    }
    const reason = window.prompt(
      "Reason for the skill override (audit trail):",
    );
    if (reason === null) return;
    try {
      const res = await offlineFetchWrapper("/api/operator/assign-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: overrideTarget,
          operatorId: overrideOperator,
          reason,
        }),
      });
      const d = await res.json();
      setOverrideMsg(
        res.ok
          ? `Assigned — ${d.record?.id ? "override saved (ASSIGN_OVERRIDE audited)" : "already assigned"}`
          : d.error || "Override failed",
      );
      if (res.ok) {
        setOverrideTarget("");
        setOverrideOperator("");
      }
    } catch (e) {
      setOverrideMsg("Network error");
    }
  };

  // Skill-based My Queue: certified ops only, plus manager overrides.
  const myQueue = showOnlyCertified
    ? plannedWorkOrders.filter(
        (wo) =>
          skillMachineIds.includes(wo.currentMachineId) ||
          overrideWorkOrderIds.includes(wo.id),
      )
    : plannedWorkOrders;
  const queueWos = myQueue.length > 0 ? myQueue : plannedWorkOrders;

  // Shift Count States
  const [pendingCount, setPendingCount] = useState<any>(null);
  const [showIncomingModal, setShowIncomingModal] = useState<boolean>(false);
  const [incomingCountInput, setIncomingCountInput] = useState<string>("");
  const [outgoingCountInput, setOutgoingCountInput] = useState<string>("450");
  const [countLoading, setCountLoading] = useState<boolean>(false);
  const [lastOutgoingSaved, setLastOutgoingSaved] = useState<number | null>(
    null,
  );

  // --- Employee-number keypad (badge culture) ---
  const matchedOperator = empInput
    ? operators.find((o) => o.employeeNumber === String(empInput)) || null
    : null;

  const evaluateEmpInput = (next: string) => {
    const m = operators.find((o) => o.employeeNumber === next);
    if (m) {
      setOperatorId(m.id);
      setEmpError(null);
    } else if (next.length >= 4) {
      setOperatorId("");
      setEmpError("Unknown employee number — check your badge and try again.");
      setShakeKey((k) => k + 1);
    } else {
      setOperatorId("");
      setEmpError(null);
    }
  };

  const pressDigit = (d: string) => {
    if (empInput.length >= 8) return;
    const next = empInput + d;
    setEmpInput(next);
    evaluateEmpInput(next);
  };

  const pressBackspace = () => {
    const next = empInput.slice(0, -1);
    setEmpInput(next);
    evaluateEmpInput(next);
  };

  const pressClear = () => {
    setEmpInput("");
    setOperatorId("");
    setEmpError(null);
  };

  const handleStartShift = async () => {
    if (!operatorId || !machineId) return;
    localStorage.setItem("operator_id", operatorId);
    localStorage.setItem("operator_machine_id", machineId);

    // Check if there is a PENDING shift count for this machine from previous shift
    try {
      const res = await fetch(
        `/api/shift-counts?machineId=${machineId}&status=PENDING`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setPendingCount(data[0]);
          setIncomingCountInput(String(data[0].outCount));
          setShowIncomingModal(true);
          return;
        }
      }
    } catch (e) {
      logClientError("Check pending count error:", e, "OperatorTabletView");
    }

    setIsSetupDone(true);
  };

  const handleVerifyIncomingCount = async () => {
    if (!pendingCount || !incomingCountInput) return;
    setCountLoading(true);
    try {
      const res = await offlineFetchWrapper("/api/shift-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "INCOMING",
          countId: pendingCount.id,
          operatorId,
          inCount: parseInt(incomingCountInput, 10),
          toShiftId: currentShift?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to verify count");
      } else {
        if (data.status === "AGREED") {
          alert(`✅ Count Agreed (${data.inCount} units)! Handoff verified.`);
        } else {
          alert(
            `⚠️ Count Discrepancy Flagged!\nOutgoing: ${pendingCount.outCount} vs Incoming: ${data.inCount}.\nDispute sent to Supervisor for reconciliation.`,
          );
        }
        setShowIncomingModal(false);
        setIsSetupDone(true);
      }
    } catch (e) {
      alert("Error verifying count");
    } finally {
      setCountLoading(false);
    }
  };

  const handleSaveOutgoingCount = async () => {
    if (!machineId || !operatorId || !outgoingCountInput) return;
    setCountLoading(true);
    try {
      const val = parseInt(outgoingCountInput, 10);
      const res = await offlineFetchWrapper("/api/shift-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "OUTGOING",
          machineId,
          fromShiftId: currentShift?.id || activeAssignments[0]?.shiftId,
          operatorId,
          outCount: val,
        }),
      });
      if (res.ok) {
        setLastOutgoingSaved(val);
        alert(
          `Saved outgoing WIP count (${val} units). Incoming shift will verify on login!`,
        );
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save count");
      }
    } catch (e) {
      alert("Error saving count");
    } finally {
      setCountLoading(false);
    }
  };

  const handleSwitchSelection = () => {
    localStorage.removeItem("operator_id");
    localStorage.removeItem("operator_machine_id");
    setIsSetupDone(false);
  };

  const handleLogout = async () => {
    try {
      await offlineFetchWrapper("/api/auth/logout", { method: "POST" });
    } catch (err) {
      logClientError("Logout error:", err, "OperatorTabletView");
    }
    localStorage.removeItem("operator_id");
    localStorage.removeItem("operator_machine_id");
    // Hard reload to clear terminal session state
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };

  // Helper action call
  const performOperatorAction = async (payload: any) => {
    try {
      setActionLoading(true);
      triggerHaptic(20);
      soundFx.playPunch();

      const res = await offlineFetchWrapper("/api/operator/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok && !resData.offline) {
        soundFx.playError();
        triggerHaptic([30, 50, 30]);
        if (resData.code === "CALIBRATION_EXPIRED") {
          setCalibrationBlock({
            toolName: resData.toolName,
            toolSerial: resData.toolSerial,
            expiresAt: resData.expiresAt,
          });
        } else {
          alert(resData.error || "Action failed");
        }
      } else {
        soundFx.playSuccess();
        triggerHaptic(15);
        if (resData.offline) {
          alert(
            "📡 Network Offline: Action saved to queue! Will auto-sync when connection restores.",
          );
        }
        setActiveModal(null);
        await fetchLiveState(machineId, operatorId);
      }
    } catch (err) {
      soundFx.playError();
      triggerHaptic([50, 50, 50]);
      logClientError("Action error:", err, "OperatorTabletView");
      alert("Failed to perform action");
    } finally {
      setActionLoading(false);
    }
  };

  // P10 — IPQC checklist from the Control Plan
  const openIpcc = async () => {
    if (!activeWorkOrder) return;
    setIpccLoading(true);
    setIpccError("");
    setIpccMsg("");
    try {
      const res = await offlineFetchWrapper("/api/ipcc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          data: { workOrderId: activeWorkOrder.id, machineId },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIpccError(data.error || "Could not create checklist");
        setIpccRun(null);
      } else {
        setIpccRun(data.run);
        const init: Record<string, string> = {};
        (data.run.checks || []).forEach((c: any) => (init[c.id] = ""));
        setIpccValues(init);
      }
    } catch {
      setIpccError("Network error while creating checklist");
    } finally {
      setIpccLoading(false);
    }
  };

  const submitIpcc = async () => {
    if (!ipccRun) return;
    setIpccLoading(true);
    setIpccMsg("");
    setIpccError("");
    try {
      const values = (ipccRun.checks || []).map((c: any) => ({
        checkId: c.id,
        value: ipccValues[c.id] || "",
      }));
      const res = await offlineFetchWrapper("/api/ipcc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record",
          data: { runId: ipccRun.id, values },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIpccError(data.error || "Could not record checks");
      } else if (data.ncr) {
        setIpccMsg(
          `⚠ ${data.failures?.length || ipccRun.failedCount} check(s) FAILED — non-conformance ${data.ncr.ncrNumber} raised automatically.`,
        );
        setIpccRun(data.run);
      } else {
        setIpccMsg(`✓ All checks PASSED — ${data.run.runNumber} complete.`);
        setIpccRun(data.run);
      }
      await fetchLiveState(machineId, operatorId);
    } catch {
      setIpccError("Network error while recording checks");
    } finally {
      setIpccLoading(false);
    }
  };

  const currentOperatorName =
    operators.find((o) => o.id === operatorId)?.name || "Operator";

  // Assignment check
  const isOperatorAssigned = activeAssignments.some(
    (a: any) => a.operatorId === operatorId && a.shiftId === currentShift?.id,
  );

  // Routing helpers
  const routingSteps: any[] =
    activeRoutingSteps.length > 0
      ? activeRoutingSteps
      : activeWorkOrder?.product?.routingSteps || [];
  const currentSeq: number = activeWorkOrder?.currentSeq || 1;
  const currentStep = routingSteps.find((s: any) => s.seq === currentSeq);
  const nextStep = routingSteps.find((s: any) => s.seq === currentSeq + 1);

  const handleHoldPointSignoff = async () => {
    if (!activeWorkOrder || !holdPointData) return;
    setSignoffLoading(true);
    try {
      const payload: any = {
        workOrderId: activeWorkOrder.id,
        routingStepId: holdPointData.stepId,
        inspectorName: signoffInspectorName,
        inspectorOrg: signoffInspectorOrg,
        result: signoffResult,
        remarks: signoffRemarks,
      };

      if (activeWorkOrder.trackingMode === "SERIAL") {
        if (
          !holdPointData.serialUnitIds ||
          holdPointData.serialUnitIds.length === 0
        ) {
          alert("Must select at least one serial unit to sign off");
          setSignoffLoading(false);
          return;
        }
        payload.serialUnitIds = holdPointData.serialUnitIds;
      }

      const res = await offlineFetchWrapper("/api/hold-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Sign-off failed");
      } else {
        alert("Sign-off recorded successfully");
        setActiveModal(null);
        await fetchLiveState(machineId, operatorId);
      }
    } catch (e) {
      alert("Sign-off failed");
    } finally {
      setSignoffLoading(false);
    }
  };

  const handleMoveMaterial = async () => {
    if (!activeWorkOrder || !moveToStation || !moveQtyInput) return;
    setMoveLoading(true);
    try {
      const res = await offlineFetchWrapper("/api/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: activeWorkOrder.id,
          fromStation: currentStep?.stationName || "Unknown",
          toStation: moveToStation,
          quantity: parseInt(moveQtyInput, 10),
          movedByName: currentOperatorName,
        }),
      });
      const resData = await res.json();
      if (!res.ok && !resData.offline) {
        if (resData.code === "HOLDPOINT_BLOCKED") {
          // Determine if we need to select serials
          let serialsToSignoff: string[] | undefined;
          if (
            activeWorkOrder.trackingMode === "SERIAL" &&
            activeWorkOrder.serialUnits
          ) {
            // we will need to list serial units for sign-off. we'll pre-select those that are pending signoff
            serialsToSignoff = activeWorkOrder.serialUnits.map(
              (su: any) => su.id,
            );
          }
          setHoldPointData({
            authority: resData.authority,
            stepId: resData.stepId,
            serialUnitIds: serialsToSignoff,
          });
          setActiveModal("HOLDPOINT_SIGNOFF");
          return;
        } else {
          alert(resData.error || "Move failed");
        }
      } else {
        if (resData.offline) {
          alert(
            "📡 Network Offline: Material movement saved locally and queued for auto-sync.",
          );
        }
        setActiveModal(null);
        await fetchLiveState(machineId, operatorId);
      }
    } catch (e) {
      alert("Move failed");
    } finally {
      setMoveLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!operatorId) return alert("Select an operator first.");
    setClockingLoading(true);
    try {
      const res = await offlineFetchWrapper("/api/attendance/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorId,
          shiftId: currentShift?.id,
          action: "CLOCK_IN",
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.offline) {
        alert(data.error || "Clock in failed");
      } else {
        if (data.offline) {
          alert(
            "📡 Network Offline: Clock In saved locally and queued for auto-sync.",
          );
        } else {
          setTodayAttendanceLog(data);
          alert(
            data.status === "LATE"
              ? "Clocked in (Status: LATE)"
              : "Clocked in successfully!",
          );
        }
      }
    } catch (e) {
      alert("Clock in error");
    } finally {
      setClockingLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!operatorId) return;
    setClockingLoading(true);
    try {
      const res = await offlineFetchWrapper("/api/attendance/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorId,
          action: "CLOCK_OUT",
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.offline) {
        alert(data.error || "Clock out failed");
      } else {
        if (data.offline) {
          alert(
            "📡 Network Offline: Clock Out saved locally and queued for auto-sync.",
          );
        } else {
          setTodayAttendanceLog(null);
          alert("Clocked out successfully!");
        }
      }
    } catch (e) {
      alert("Clock out error");
    } finally {
      setClockingLoading(false);
    }
  };

  // Compute live machine status badge
  const isDown = Boolean(openDowntime);
  const isRunning = !isDown && activeWorkOrder?.status === "IN_PROGRESS";
  const statusLabel = isDown ? "DOWN" : isRunning ? "RUNNING" : "IDLE";
  const statusColor = isDown
    ? "bg-rose-600 text-white animate-pulse"
    : isRunning
      ? "bg-emerald-600 text-white"
      : "bg-amber-500 text-slate-950 font-bold";

  // Calculate produced total for active WO
  const totalGoodUnits = (activeWorkOrder?.productionLogs || []).reduce(
    (sum: number, log: any) => sum + (log.goodQuantity || 0),
    0,
  );
  const totalPlannedUnits = activeWorkOrder?.plannedQuantity || 1;
  const progressPct = Math.min(
    100,
    Number(((totalGoodUnits / totalPlannedUnits) * 100).toFixed(1)),
  );

  // ----------------------------------------------------
  // CERTIFICATION LOGIC
  // ----------------------------------------------------
  const now = new Date();
  const certValidUntil = certification?.validUntil
    ? new Date(certification.validUntil)
    : null;
  // Admin logic (optional): if we had an admin override we'd check it, but for now just operator
  const isCertified =
    certification?.isActive && (!certValidUntil || certValidUntil > now);
  const isExpiringSoon =
    isCertified &&
    certValidUntil &&
    certValidUntil.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000;

  // ----------------------------------------------------
  // RENDER 1: SELECTION SCREEN (FIRST SCREEN)
  // ----------------------------------------------------
  if (!isSetupDone) {
    return (
      <>
        <div className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-8 relative">
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-sm"
                title="Exit to Home Gateway"
              >
                <Home className="w-4 h-4 text-blue-400" />
                Exit to Gateway
              </button>
              <LanguageToggle currentLang={currentLang} userId={operatorId} />
            </div>
            <div className="text-center space-y-2 border-b border-slate-800 pb-6">
              <div className="inline-flex p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30 text-white mb-2">
                <Tablet className="w-10 h-10" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                {t("operatorTerminal", currentLang)}
              </h1>
              <p className="text-slate-400 text-base">
                Enter your employee number and select your assigned machine to
                start your shift.
              </p>
            </div>

            <style>{`
            @keyframes empShake {
              0%, 100% { transform: translateX(0); }
              20% { transform: translateX(-8px); }
              40% { transform: translateX(8px); }
              60% { transform: translateX(-6px); }
              80% { transform: translateX(6px); }
            }
            .emp-shake { animation: empShake 0.4s ease-in-out; }
          `}</style>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-blue-400" />
                  Employee No. *
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Type your badge number — your name appears the moment it
                  matches.
                </p>

                {/* typed number + instant name match / red shake on miss */}
                <div
                  key={shakeKey}
                  className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border-2 px-5 py-4 transition-colors ${
                    empError
                      ? "border-rose-500/70 bg-rose-950/40 emp-shake"
                      : matchedOperator
                        ? "border-emerald-500/60 bg-emerald-950/30"
                        : "border-slate-700 bg-slate-800/60"
                  }`}
                >
                  <span
                    className={`text-3xl font-black tracking-[0.3em] font-mono ${empError ? "text-rose-300" : matchedOperator ? "text-emerald-300" : "text-white"}`}
                  >
                    {empInput || "—"}
                  </span>
                  {matchedOperator ? (
                    <span className="text-emerald-300 font-bold text-sm flex items-center gap-1.5 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />{" "}
                      {matchedOperator.name}
                    </span>
                  ) : empError ? (
                    <span className="text-rose-300 font-bold text-sm flex items-center gap-1.5 shrink-0">
                      <AlertCircle className="w-4 h-4" /> No match
                    </span>
                  ) : null}
                </div>
                {empError && (
                  <p className="text-rose-400 text-sm font-semibold -mt-2 mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> {empError}
                  </p>
                )}

                {/* big keypad */}
                <div className="grid grid-cols-3 gap-3 max-w-sm">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => pressDigit(d)}
                      className="min-h-[64px] rounded-2xl bg-slate-800/80 border border-slate-700 text-2xl font-black text-white hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={pressClear}
                    className="min-h-[64px] rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300 font-bold hover:bg-slate-700 active:scale-95 transition-all cursor-pointer text-sm"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => pressDigit("0")}
                    className="min-h-[64px] rounded-2xl bg-slate-800/80 border border-slate-700 text-2xl font-black text-white hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={pressBackspace}
                    className="min-h-[64px] rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  >
                    <Delete className="w-6 h-6" />
                  </button>
                </div>

                {matchedOperator && (
                  <div className="mt-4 rounded-2xl bg-emerald-600/15 border border-emerald-500/40 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-emerald-300 font-bold text-lg">
                        {matchedOperator.name}
                      </p>
                      <p className="text-emerald-400/70 text-xs font-mono">
                        EMP {matchedOperator.employeeNumber}
                      </p>
                    </div>
                    <BadgeCheck className="w-8 h-8 text-emerald-400" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  {t("selectMachine", currentLang)} *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {machines.map((m) => {
                    const isSelected = machineId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMachineId(m.id)}
                        className={`min-h-[64px] p-4 rounded-2xl border-2 font-bold text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600/20 border-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                            : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div>
                          <div className="text-lg font-extrabold">{m.name}</div>
                          <div className="text-xs font-mono text-slate-400">
                            {m.code}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-6 h-6 text-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* CLOCK IN / CLOCK OUT BUTTONS */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleClockIn}
                disabled={
                  !operatorId || clockingLoading || Boolean(todayAttendanceLog)
                }
                className="min-h-[64px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-lg font-black rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/40"
              >
                <Clock className="w-6 h-6" />
                {clockingLoading
                  ? t("saving", currentLang)
                  : t("clockIn", currentLang)}
              </button>

              <button
                onClick={handleClockOut}
                disabled={!operatorId || clockingLoading || !todayAttendanceLog}
                className="min-h-[64px] bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-lg font-black rounded-2xl shadow-xl shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer border border-rose-400/40"
              >
                <Clock className="w-6 h-6" />
                {clockingLoading
                  ? t("saving", currentLang)
                  : t("clockOut", currentLang)}
              </button>
            </div>

            <button
              onClick={handleStartShift}
              disabled={!operatorId || !machineId}
              className="w-full min-h-[64px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xl font-extrabold rounded-2xl shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <Play className="w-7 h-7 fill-white" />
              Enter Shopfloor Station
            </button>
          </div>
        </div>

        {/* INCOMING SHIFT COUNT VERIFICATION MODAL */}
        {showIncomingModal && pendingCount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border-2 border-purple-500/50 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl">
              <div className="space-y-2 text-center">
                <div className="inline-flex p-3 bg-purple-600/20 text-purple-400 rounded-2xl border border-purple-500/30">
                  <Package className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white">
                  Joint Shift-Change WIP Count Verification
                </h2>
                <p className="text-sm text-slate-300">
                  Outgoing operator{" "}
                  <strong>
                    {pendingCount.outgoingUser?.name ||
                      "Previous Shift Operator"}
                  </strong>{" "}
                  counted:
                </p>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-center">
                  <span className="text-xs uppercase font-extrabold text-slate-400 block">
                    Outgoing Shift WIP Count
                  </span>
                  <span className="text-4xl font-black font-mono text-purple-400">
                    {pendingCount.outCount} units
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-extrabold text-slate-200 uppercase">
                  Your Incoming WIP Count *
                </label>
                <input
                  type="number"
                  min="0"
                  value={incomingCountInput}
                  onChange={(e) => setIncomingCountInput(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-purple-500/50 rounded-2xl p-4 text-2xl font-mono font-black text-center text-white focus:outline-none focus:border-purple-400"
                />
                <p className="text-xs text-slate-400 text-center">
                  If count differs from outgoing by more than tolerance, a
                  dispute will be flagged to your supervisor.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowIncomingModal(false);
                    setIsSetupDone(true);
                  }}
                  className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl"
                >
                  Skip Verification
                </button>
                <button
                  type="button"
                  onClick={handleVerifyIncomingCount}
                  disabled={countLoading}
                  className="w-1/2 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-2xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {countLoading ? "Verifying..." : "Confirm & Agree"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* DRAWING LIGHTBOX MODAL */}
        {showDrawingModal && selectedDrawing && (
          <DrawingLightboxModal
            document={selectedDrawing}
            operatorName={currentOperatorName}
            woNumber={activeWorkOrder?.woNumber}
            onClose={() => {
              setShowDrawingModal(false);
              setSelectedDrawing(null);
            }}
          />
        )}
      </>
    );
  }

  // ----------------------------------------------------
  // RENDER 2: MAIN SHOP-FLOOR TABLET INTERFACE
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-6 select-none relative">
      {/* CERTIFICATION BLOCKER MODAL */}
      {!isCertified && !loading && (
        <div className="absolute inset-0 z-50 bg-rose-950/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-slate-900 border-4 border-rose-600 rounded-3xl p-10 text-center shadow-[0_0_100px_rgba(225,29,72,0.6)] space-y-8">
            <div className="flex justify-center">
              <div className="w-32 h-32 bg-rose-600 rounded-full flex items-center justify-center animate-pulse shadow-xl shadow-rose-600/50">
                <AlertTriangle className="w-20 h-20 text-white" />
              </div>
            </div>
            <div className="space-y-4">
              <h1 className="text-6xl font-black text-rose-500 tracking-tight">
                {t("safetyGateStopTitle", currentLang)}
              </h1>
              <h2 className="text-2xl font-bold text-white">
                {t("safetyGateNotCertifiedMsg", currentLang)}
              </h2>
              <p className="text-slate-400 text-lg">
                {t("safetyGateNotCertifiedMsg", currentLang)}
              </p>
            </div>
            <div className="pt-8">
              <button
                onClick={handleSwitchSelection}
                className="w-full min-h-[80px] bg-slate-800 hover:bg-slate-700 text-white text-2xl font-black rounded-2xl border-2 border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-3"
              >
                <RefreshCw className="w-8 h-8" />
                {t("changeMachine", currentLang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPIRING CERTIFICATION WARNING */}
      {isExpiringSoon && (
        <div className="bg-amber-500/20 border-2 border-amber-500/50 rounded-2xl p-4 flex items-center gap-4 text-amber-200">
          <AlertCircle className="w-8 h-8 text-amber-400 shrink-0" />
          <div>
            <h4 className="font-bold text-lg">
              {t("certExpiringSoonWarn", currentLang)}
            </h4>
            <p className="text-sm opacity-90">
              {t("certExpiringSoonWarn", currentLang)} (Valid until{" "}
              {certValidUntil?.toLocaleDateString()})
            </p>
          </div>
        </div>
      )}

      {/* TOP SHOP-FLOOR BAR */}
      <header className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-md">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Operator
              </span>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <span>{currentOperatorName}</span>
                <button
                  onClick={() => setShowChangePasswordModal(true)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
                  title="Change my password"
                >
                  <Key className="w-4 h-4" />
                </button>
              </h2>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Cpu className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Machine
              </span>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                {machineState?.name || "Machine"}
                <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
                  {machineState?.code}
                </span>
              </h2>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600/20 text-purple-400 rounded-2xl border border-purple-500/30">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Shift / Attendance
              </span>
              <h2 className="text-lg font-extrabold font-mono text-purple-300">
                {currentShift?.name || "Shift A"} • {clockTime}
              </h2>
              {todayAttendanceLog ? (
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Clocked in:{" "}
                  {new Date(todayAttendanceLog.clockIn).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {todayAttendanceLog.status === "LATE" && (
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] ml-1">
                      LATE
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-amber-400 font-bold mt-0.5">
                  Not clocked in today
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <LanguageToggle currentLang={currentLang} userId={operatorId} />
          <OfflineSyncBadge />
          <InstallPrompt />
          <button
            onClick={() => setShowFastSafetyModal(true)}
            className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center sm:justify-start gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer w-full sm:w-auto"
          >
            <ShieldAlert className="w-5 h-5 text-white" />
            Fast Safety Log ⚠️
          </button>
          <button
            onClick={() => setShowIdeaModal(true)}
            className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center sm:justify-start gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer w-full sm:w-auto"
          >
            <Lightbulb className="w-5 h-5 fill-slate-950" />
            Submit Idea 💡
          </button>
          <button
            onClick={handleSwitchSelection}
            className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-bold flex items-center justify-center sm:justify-start gap-2 transition-all cursor-pointer w-full sm:w-auto"
          >
            <RefreshCw className="w-4 h-4" />
            {t("changeMachine", currentLang)}
          </button>
          <button
            onClick={handleLogout}
            className="px-5 py-3 rounded-2xl bg-rose-950/60 hover:bg-rose-900 border border-rose-700/60 text-rose-300 hover:text-white text-sm font-bold flex items-center justify-center sm:justify-start gap-2 shadow-lg shadow-rose-950/40 transition-all cursor-pointer w-full sm:w-auto"
            title="Sign out and return to Gateway"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* MY ROUTINE CARD */}
      <MyRoutineCard role="OPERATOR" userId={operatorId} />

      {/* ASSIGNED TOOL HEALTH WIDGET */}
      {assignedTools.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              Machine Tooling Health ({assignedTools.length} tools assigned)
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              Live Wear Counters
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assignedTools.map((t: any) => {
              const wearPct = Math.min(
                100,
                Math.round((t.currentCycles / t.maxLifeCycles) * 100),
              );
              const isMaint = t.status === "MAINTENANCE" || wearPct >= 100;
              const isWarn =
                t.status === "WARNING" || wearPct >= (t.warningThreshold || 85);

              const colorClass = isMaint
                ? "text-rose-400 bg-rose-500/20 border-rose-500/40"
                : isWarn
                  ? "text-amber-400 bg-amber-500/20 border-amber-500/40"
                  : "text-emerald-400 bg-emerald-500/20 border-emerald-500/40";

              return (
                <div
                  key={t.id}
                  className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate max-w-[150px]">
                      {t.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black rounded border ${colorClass}`}
                    >
                      {wearPct}% ({t.status})
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isMaint
                          ? "bg-rose-500"
                          : isWarn
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${wearPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SHIFT CHANGE WIP COUNT CARD */}
      <div className="bg-slate-900 border-2 border-purple-500/40 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-2xl border border-purple-500/30">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">
                Shift Change WIP Count
              </h3>
              <p className="text-xs text-slate-400">
                Log current WIP count at your station before shift handoff to
                end inventory disputes.
              </p>
            </div>
          </div>

          <span className="px-3 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-full text-xs font-mono font-bold self-start sm:self-center">
            {lastOutgoingSaved !== null
              ? `Last Recorded: ${lastOutgoingSaved} units ✓`
              : "Joint WIP Handoff Tracking"}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-2/3 space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              WIP at your machine now?
            </label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 450"
              value={outgoingCountInput}
              onChange={(e) => setOutgoingCountInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-lg font-mono font-bold text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            type="button"
            onClick={handleSaveOutgoingCount}
            disabled={countLoading || !outgoingCountInput}
            className="w-full sm:w-1/3 h-[52px] mt-auto bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Check className="w-5 h-5" />
            {countLoading ? "Saving..." : "Save Shift Count"}
          </button>
        </div>
      </div>

      {/* SOFT ASSIGNMENT WARNING BANNER */}
      {!isOperatorAssigned && currentShift && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl text-amber-200 flex items-center gap-3 text-sm font-semibold">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
          <span>
            You&apos;re not the assigned operator for this machine this shift —
            logging anyway is fine.
          </span>
        </div>
      )}

      {/* LIVE MACHINE STATUS BANNER */}
      <div
        className={`p-5 rounded-3xl border shadow-xl flex items-center justify-between gap-4 ${
          isDown
            ? "bg-rose-950/80 border-rose-600 text-rose-100"
            : isRunning
              ? "bg-emerald-950/60 border-emerald-600 text-emerald-100"
              : "bg-amber-950/60 border-amber-600 text-amber-100"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${statusColor}`}>
            {isDown ? (
              <AlertTriangle className="w-8 h-8" />
            ) : isRunning ? (
              <Zap className="w-8 h-8" />
            ) : (
              <Clock className="w-8 h-8" />
            )}
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest block opacity-80">
              Machine Live Status
            </span>
            <h3 className="text-3xl font-black tracking-tight flex items-center gap-3">
              STATUS: {statusLabel}
              {isDown && openDowntime?.reason && (
                <span className="text-lg font-bold px-3 py-1 bg-rose-900 rounded-xl border border-rose-700">
                  Reason: {openDowntime.reason.description}
                </span>
              )}
            </h3>
          </div>
        </div>

        {isDown && (
          <button
            onClick={() =>
              performOperatorAction({
                action: "END_DOWNTIME",
                machineId,
                downtimeLogId: openDowntime.id,
              })
            }
            disabled={actionLoading}
            className="min-h-[64px] px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl rounded-2xl shadow-2xl shadow-emerald-600/40 animate-bounce cursor-pointer flex items-center gap-3"
          >
            <CheckCircle2 className="w-7 h-7" />
            CLEAR & END DOWNTIME NOW
          </button>
        )}
      </div>

      {/* CURRENT WORK ORDER CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {myRoster.length > 0 && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 mb-3">
            <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1.5">
              My roster — this week
            </div>
            <div className="flex flex-wrap gap-1.5">
              {myRoster.map((r: any, i: number) => (
                <span
                  key={i}
                  className="text-[11px] font-semibold rounded-full border border-indigo-500/40 bg-indigo-500/10 text-indigo-200 px-2 py-0.5"
                >
                  {r.day} · {r.shift?.name} ({r.shift?.startTime}–
                  {r.shift?.endTime})
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Active Shop Floor Job
            </span>
            {activeWorkOrder ? (
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-3xl font-black font-mono text-blue-400">
                  {activeWorkOrder.woNumber}
                </h3>
                <span className="text-xl font-bold text-white">
                  {activeWorkOrder.product?.name}
                </span>
                <span className="px-3 py-1 bg-slate-800 text-slate-300 font-mono text-sm rounded-lg border border-slate-700">
                  {activeWorkOrder.product?.sku}
                </span>
                {activeWorkOrder.product?.fixtures?.length > 0 &&
                  (() => {
                    const fx = activeWorkOrder.product.fixtures[0];
                    const blocked = fx.status !== "AVAILABLE";
                    return (
                      <span
                        title={
                          blocked
                            ? `Fixture ${fx.code} is ${fx.status} — job start is blocked until it returns or a manager overrides`
                            : `Fixture ${fx.code} ready`
                        }
                        className={`px-2.5 py-1 rounded-xl border font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 ${blocked ? "bg-rose-500/20 border-rose-400/50 text-rose-300" : "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"}`}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Fixture {fx.code} · {fx.status}
                      </span>
                    );
                  })()}
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-400">
                  No Job Currently In Progress
                </h3>
                {myRoster.length > 0 && (
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 mb-3">
                    <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1.5">
                      My roster — this week
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {myRoster.map((r: any, i: number) => (
                        <span
                          key={i}
                          className="text-[11px] font-semibold rounded-full border border-indigo-500/40 bg-indigo-500/10 text-indigo-200 px-2 py-0.5"
                        >
                          {r.day} · {r.shift?.name} ({r.shift?.startTime}–
                          {r.shift?.endTime})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {plannedWorkOrders.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm text-slate-400">
                        Select Planned WO to start:
                      </span>
                      <div className="flex items-center rounded-xl border border-slate-700 overflow-hidden">
                        <button
                          onClick={() => {
                            setShowOnlyCertified(true);
                            setSelectedPlannedWoId(queueWos[0]?.id || "");
                          }}
                          className={`px-3 py-2 text-xs font-bold transition-colors ${showOnlyCertified ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"}`}
                        >
                          My Queue (certified)
                        </button>
                        <button
                          onClick={() => setShowOnlyCertified(false)}
                          className={`px-3 py-2 text-xs font-bold transition-colors ${!showOnlyCertified ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"}`}
                        >
                          All WOs
                        </button>
                      </div>
                    </div>
                    <select
                      value={selectedPlannedWoId}
                      onChange={(e) => setSelectedPlannedWoId(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm font-bold focus:outline-none"
                    >
                      {queueWos.map((wo) => {
                        const certified = skillMachineIds.includes(
                          wo.currentMachineId,
                        );
                        const overridden = overrideWorkOrderIds.includes(wo.id);
                        return (
                          <option key={wo.id} value={wo.id}>
                            {wo.woNumber} - {wo.product?.name} (
                            {wo.plannedQuantity} pcs)
                            {certified
                              ? " [✓ certified]"
                              : overridden
                                ? " [manager override]"
                                : " [no cert]"}
                          </option>
                        );
                      })}
                    </select>
                    {myQueue.length === 0 && (
                      <div className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> No certified
                        WOs in your queue — ask a manager to assign-override.
                      </div>
                    )}
                    {isManagerView && !showOnlyCertified && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                        <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                          Skill assign-override
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={overrideTarget}
                            onChange={(e) => setOverrideTarget(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs font-bold"
                          >
                            <option value="">WO…</option>
                            {plannedWorkOrders.map((wo) => (
                              <option key={wo.id} value={wo.id}>
                                {wo.woNumber}
                              </option>
                            ))}
                          </select>
                          <select
                            value={overrideOperator}
                            onChange={(e) =>
                              setOverrideOperator(e.target.value)
                            }
                            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs font-bold"
                          >
                            <option value="">Operator…</option>
                            {operatorsList.map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={doAssignOverride}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold hover:bg-amber-500/30"
                          >
                            Assign override
                          </button>
                        </div>
                        {overrideMsg && (
                          <div className="text-xs text-slate-300">
                            {overrideMsg}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {activeWorkOrder &&
            (() => {
              const currentStep = routingSteps.find(
                (s: any) => s.seq === currentSeq,
              );
              const currentOpId = currentStep?.operationId || null;
              const activeDrawingDoc =
                activeWoDocuments.find(
                  (d: any) => d.operationId === currentOpId,
                ) || activeWoDocuments.find((d: any) => !d.operationId);

              return (
                <div className="flex items-center gap-4 flex-wrap justify-end">
                  {activeDrawingDoc ? (
                    <div className="flex items-center gap-2">
                      {activeDrawingDoc.transmittal &&
                        activeDrawingDoc.transmittal.status !== "FULL" && (
                          <span
                            title={`Rev ${activeDrawingDoc.transmittal.revision} awaiting acknowledgement — Production ${activeDrawingDoc.transmittal.ackProduction ? "✓" : "✗"} · Quality ${activeDrawingDoc.transmittal.ackQuality ? "✓" : "✗"}`}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 animate-pulse"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Stale rev · unacknowledged
                          </span>
                        )}
                      <button
                        onClick={() => {
                          setSelectedDrawing(activeDrawingDoc);
                          setShowDrawingModal(true);
                        }}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-600/40 flex items-center gap-2 cursor-pointer border border-blue-400/40 transition-all hover:scale-105"
                      >
                        <FileText className="w-5 h-5 text-white" />
                        View Drawing (REV {activeDrawingDoc.version}) 📐
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 bg-slate-800 text-slate-500 font-bold text-xs rounded-xl border border-slate-700 opacity-60 cursor-not-allowed flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      No Drawing for Op
                    </button>
                  )}

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-semibold">
                      Planned vs Produced
                    </span>
                    <span className="text-3xl font-black font-mono text-emerald-400">
                      {totalGoodUnits.toLocaleString()} /{" "}
                      {totalPlannedUnits.toLocaleString()}
                    </span>
                  </div>

                  {/* M5 — hourly andon: target vs actual for this hour */}
                  {(() => {
                    const step = routingSteps.find(
                      (s: any) => s.seq === currentSeq,
                    );
                    const cycleMin =
                      step?.cycleTimeMin ||
                      (activeWorkOrder?.product?.targetCycleTimeSeconds
                        ? activeWorkOrder.product.targetCycleTimeSeconds / 60
                        : 1);
                    const targetHour = Math.max(1, Math.round(60 / cycleMin));
                    const hNow = new Date().getHours();
                    const hourActual = (activeWorkOrder?.productionLogs || [])
                      .filter(
                        (l: any) =>
                          l.startTime &&
                          new Date(l.startTime).getHours() === hNow,
                      )
                      .reduce(
                        (s: number, l: any) =>
                          s + (l.goodQuantity || 0) + (l.scrapQuantity || 0),
                        0,
                      );
                    const short = hourActual < targetHour;
                    return (
                      <div
                        title={`Hourly target ${targetHour} pcs/h from op cycle time — actual this hour`}
                        className={`px-3 py-1.5 rounded-xl border font-black text-xs flex items-center gap-1.5 ${
                          short
                            ? "bg-rose-500/20 border-rose-400/50 text-rose-300 animate-pulse"
                            : "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        HOURLY {hourActual}/{targetHour}{" "}
                        {short ? "BEHIND" : "ON TARGET"}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
        </div>

        {/* PROGRESS BAR */}
        {activeWorkOrder && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-slate-400 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" />
                Target Completion
              </span>
              <span className="text-white font-mono">
                {progressPct}% Complete
              </span>
            </div>
            <div className="w-full bg-slate-800 h-6 rounded-2xl p-1 border border-slate-700 overflow-hidden">
              <div
                className="h-full rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* ECO REVISIONS BANNER */}
        {activeEcoRevisions.length > 0 && (
          <div className="bg-amber-900/30 border border-amber-500/50 rounded-2xl p-4 shadow-xl mb-6">
            <h3 className="text-amber-400 font-bold text-lg mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Effectivity Warning: Old Revisions Active
            </h3>
            <ul className="list-disc list-inside text-amber-200/80 text-sm space-y-1">
              {activeEcoRevisions.map((rev, i) => (
                <li key={i}>{rev}</li>
              ))}
            </ul>
          </div>
        )}

        {/* SERIAL EFFECTIVITY PENDING BANNER */}
        {effectivityPending && activeWorkOrder?.trackingMode === "SERIAL" && (
          <div className="bg-blue-900/30 border border-blue-500/50 rounded-2xl p-4 shadow-xl">
            <h3 className="text-blue-300 font-bold text-lg mb-1 flex items-center gap-2">
              <Info className="w-5 h-5" />
              {t("effectivityPendingTitle", currentLang)}
            </h3>
            <p className="text-blue-200/80 text-sm">
              {t("effectivityPendingMsg", currentLang)}
            </p>
          </div>
        )}

        {/* ROUTING / CURRENT OPERATION & MACHINE INSTRUCTIONS BANNER */}
        {activeWorkOrder && routingSteps.length > 0 && (
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
                      Active Operation Sequence: Op {currentSeq * 10}
                    </span>
                    {activeWorkOrder.project && (
                      <span className="px-2.5 py-0.5 bg-blue-950 border border-blue-700/60 text-blue-300 text-xs font-mono font-bold rounded-lg">
                        📁 Project: {activeWorkOrder.project.name}
                      </span>
                    )}
                    {prototypeMode && (
                      <span className="px-2.5 py-0.5 bg-purple-950 border border-purple-700/60 text-purple-300 text-xs font-mono font-bold rounded-lg">
                        🧪 Prototype Mode — ECO gates bypassed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xl font-black text-white">
                      {currentStep
                        ? `Op ${currentStep.seq * 10} — ${currentStep.operation?.name || currentStep.stationName}`
                        : "—"}
                    </span>
                    {currentStep && (
                      <span className="px-3 py-1 bg-cyan-950/80 border border-cyan-700/60 text-cyan-200 text-sm font-mono font-bold rounded-xl flex items-center gap-1.5">
                        📍{" "}
                        {currentStep.machine?.code
                          ? `${currentStep.machine.code} (${currentStep.stationName})`
                          : currentStep.stationName}
                      </span>
                    )}
                    {(currentStep?.setupTimeMin ||
                      currentStep?.cycleTimeMin) && (
                      <span className="text-xs text-slate-300 font-mono bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-700">
                        ⏱ Setup: {currentStep.setupTimeMin ?? 15}m | Cycle:{" "}
                        {currentStep.cycleTimeMin ?? 2.5}m/pc
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                  {routingSteps.map((step: any) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                        step.seq < currentSeq
                          ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
                          : step.seq === currentSeq
                            ? "bg-cyan-800/80 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400"
                            : "bg-slate-900 border-slate-800 text-slate-500"
                      }`}
                    >
                      <span>
                        {step.seq < currentSeq
                          ? "✓"
                          : step.seq === currentSeq
                            ? "▶"
                            : "○"}
                      </span>
                      <span>
                        Op {step.seq * 10}:{" "}
                        {step.operation?.name || step.stationName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* MACHINE-SPECIFIC OPERATOR INSTRUCTIONS CARD */}
              {currentStep?.instructions && (
                <div className="bg-cyan-950/40 border border-cyan-700/50 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="p-2 bg-cyan-900/60 border border-cyan-600/50 rounded-lg text-cyan-300 shrink-0">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Machine-Specific Operator Instructions (Op{" "}
                      {currentStep.seq * 10})
                    </h4>
                    <p className="text-sm font-medium text-slate-200 mt-0.5 leading-relaxed">
                      {currentStep.instructions}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* BILL OF MATERIALS (ECO-EFFECTIVE) */}
        {activeWorkOrder && activeBomLines.length > 0 && (
          <div className="bg-slate-800/60 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Bill of Materials (ECO-Effective)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Materials required for this work order
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-mono font-bold self-start sm:self-center">
                {activeBomLines.length} material line
                {activeBomLines.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid gap-2.5">
              {activeBomLines.map((line: any) => {
                const rm = line.rawMaterial || {};
                const qtyPerUnit = Number(line.qtyPerUnit || 0);
                const requiredQty = Number(
                  (
                    (activeWorkOrder?.plannedQuantity || 0) * qtyPerUnit
                  ).toFixed(4),
                );
                const stock = Number(rm.currentStock || 0);
                const isShort = stock < requiredQty;
                return (
                  <div
                    key={line.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3.5 bg-slate-900 rounded-xl border border-slate-700/70"
                  >
                    <div className="min-w-[140px] flex-1">
                      <span className="block font-bold text-white text-sm">
                        {rm.name || "Material"}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {rm.sku || "N/A"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold">
                        {t("bomQtyPerUnit", currentLang)}
                      </span>
                      <span className="text-base font-black font-mono text-white">
                        {qtyPerUnit} {rm.unit || "pcs"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold">
                        {t("bomRequired", currentLang)}
                      </span>
                      <span className="text-base font-black font-mono text-white">
                        {requiredQty.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-right min-w-[92px]">
                      <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold">
                        {t("bomStock", currentLang)}
                      </span>
                      <span
                        className={`text-sm font-bold font-mono px-2 py-0.5 rounded-lg border ${
                          isShort
                            ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                        }`}
                      >
                        {stock.toLocaleString()} {rm.unit || "pcs"}{" "}
                        {isShort ? "• SHORT" : "• OK"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* BIG ACTION BUTTONS GRID (Min height 64px, touch optimized) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Machine Mode State Switcher: SETUP / RUN / CHANGEOVER */}
        {activeWorkOrder && (
          <div className="col-span-full bg-slate-900/90 border border-slate-700/80 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Operating Mode:
              </span>
              <span className="px-3 py-1 rounded-xl text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                {activeWorkOrder.status}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  performOperatorAction({
                    action: "SETUP",
                    workOrderId: activeWorkOrder.id,
                    machineId,
                  })
                }
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-2xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-sm font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Wrench className="w-4 h-4" />
                SETUP
              </button>
              <button
                onClick={() =>
                  performOperatorAction({
                    action: "RUN",
                    workOrderId: activeWorkOrder.id,
                    machineId,
                  })
                }
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-sm font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Play className="w-4 h-4" />
                RUN
              </button>
              <button
                onClick={() =>
                  performOperatorAction({
                    action: "CHANGEOVER",
                    workOrderId: activeWorkOrder.id,
                    machineId,
                  })
                }
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-2xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-sm font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                CHANGEOVER
              </button>
            </div>
          </div>
        )}
        {/* 1. START JOB */}
        {!activeWorkOrder && plannedWorkOrders.length > 0 && (
          <button
            onClick={() =>
              performOperatorAction({
                action: "START_JOB",
                workOrderId: selectedPlannedWoId || plannedWorkOrders[0].id,
                machineId,
                operatorId,
                shiftId: currentShift?.id,
              })
            }
            disabled={actionLoading || !isCertified}
            className="min-h-[80px] p-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-3xl font-black text-xl shadow-xl shadow-blue-600/30 flex items-center justify-center gap-4 transition-all cursor-pointer border border-blue-400/40"
          >
            <Play className="w-8 h-8 fill-white" />
            {t("startJob", currentLang)}
          </button>
        )}

        {/* 2. LOG GOOD OUTPUT */}
        <button
          onClick={() => {
            if (!activeWorkOrder) return alert("Please start a job first.");
            setGoodQtyInput("10");
            setActiveModal("LOG_GOOD");
          }}
          disabled={!activeWorkOrder || actionLoading || !isCertified}
          className="min-h-[80px] p-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-3xl font-black text-xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-4 transition-all cursor-pointer border border-emerald-400/40"
        >
          <Plus className="w-8 h-8" />
          {t("logOutput", currentLang)}
        </button>

        {/* 3. IPQC CHECK (P10 — Control Plan checklist) */}
        <button
          onClick={() => {
            if (!activeWorkOrder) return alert("Please start a job first.");
            setIpccRun(null);
            setIpccValues({});
            setIpccMsg("");
            setIpccError("");
            openIpcc();
          }}
          disabled={!activeWorkOrder || actionLoading || ipccLoading}
          className="min-h-[80px] p-6 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-3xl font-black text-xl shadow-xl shadow-cyan-600/30 flex items-center justify-center gap-4 transition-all cursor-pointer border border-cyan-400/40"
        >
          <ClipboardCheck className="w-8 h-8" />
          IPQC CHECK
        </button>

        {/* 4. LOG SCRAP */}
        <button
          onClick={() => {
            if (!activeWorkOrder) return alert("Please start a job first.");
            setScrapQtyInput("1");
            setSelectedCalibratedToolId("");
            setActiveModal("LOG_SCRAP");
          }}
          disabled={!activeWorkOrder || actionLoading}
          className="min-h-[80px] p-6 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-3xl font-black text-xl shadow-xl shadow-amber-600/30 flex items-center justify-center gap-4 transition-all cursor-pointer border border-amber-400/40"
        >
          <AlertTriangle className="w-8 h-8" />
          {t("logScrap", currentLang)}
        </button>

        {/* 5. REPORT DOWNTIME */}
        <button
          onClick={() => setActiveModal("REPORT_DOWNTIME")}
          disabled={actionLoading}
          className="min-h-[80px] p-6 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-3xl font-black text-xl shadow-xl shadow-rose-600/30 flex items-center justify-center gap-4 transition-all cursor-pointer border border-rose-400/40"
        >
          <StopCircle className="w-8 h-8" />
          {t("logDowntime", currentLang)}
        </button>

        {/* 5. END DOWNTIME (Visible while downtime open) */}
        {isDown && (
          <button
            onClick={() =>
              performOperatorAction({
                action: "END_DOWNTIME",
                machineId,
                downtimeLogId: openDowntime.id,
              })
            }
            disabled={actionLoading}
            className="min-h-[80px] p-6 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-3xl font-black text-xl shadow-xl flex items-center justify-center gap-4 transition-all cursor-pointer border-2 border-emerald-300"
          >
            <CheckCircle2 className="w-8 h-8" />
            {t("logGoodUnits", currentLang)} / END DOWNTIME
          </button>
        )}

        {/* 6. COMPLETE JOB */}
        {activeWorkOrder && (
          <button
            onClick={() => {
              if (
                confirm(
                  `Are you sure you want to complete Work Order ${activeWorkOrder.woNumber}?`,
                )
              ) {
                performOperatorAction({
                  action: "COMPLETE_JOB",
                  workOrderId: activeWorkOrder.id,
                  machineId,
                });
              }
            }}
            disabled={actionLoading}
            className="min-h-[80px] p-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 text-purple-300 rounded-3xl font-black text-xl shadow-xl flex items-center justify-center gap-4 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-8 h-8 text-purple-400" />
            COMPLETE JOB
          </button>
        )}

        {/* 7. COMPLETE & MOVE MATERIAL */}
        {activeWorkOrder && routingSteps.length > 0 && nextStep && (
          <button
            onClick={() => {
              const lastLogged =
                totalGoodUnits > 0 ? totalGoodUnits.toString() : "0";
              setMoveQtyInput(lastLogged);
              setMoveToStation(nextStep.stationName);
              setActiveModal("MOVE_MATERIAL");
            }}
            disabled={actionLoading}
            className="min-h-[80px] p-6 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-3xl font-black text-xl shadow-xl shadow-cyan-700/30 flex items-center justify-center gap-4 transition-all cursor-pointer border border-cyan-500/40"
          >
            <Truck className="w-8 h-8" />
            MOVE MATERIAL
          </button>
        )}

        {/* 8. REQUEST MAINTENANCE */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => {
              setMaintDescInput("");
              setMaintPriorityInput("MEDIUM");
              setShowMaintenanceModal(true);
            }}
            disabled={actionLoading}
            className="min-h-[80px] p-6 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white rounded-3xl font-black text-xl shadow-xl shadow-orange-700/30 flex items-center justify-center gap-4 transition-all cursor-pointer border border-orange-500/40"
          >
            <Wrench className="w-8 h-8" />
            REQUEST MAINTENANCE
          </button>

          {/* 9. AI VISION DIAGNOSTICS */}
          <button
            onClick={() => setShowAiVisionModal(true)}
            disabled={actionLoading}
            className="min-h-[80px] p-6 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-3xl font-black text-xl shadow-xl shadow-blue-700/30 flex items-center justify-center gap-4 transition-all cursor-pointer border border-blue-500/40 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-shimmer" />
            <Camera className="w-8 h-8" />
            <div className="flex flex-col items-start text-left leading-tight z-10">
              <span className="text-sm font-bold text-blue-200 uppercase tracking-widest">
                Gemini Omni
              </span>
              <span>VISION AI</span>
            </div>
          </button>
        </div>
      </div>

      {/* INCOMING QUEUE CARD */}
      {incomingQueue.length > 0 && (
        <div className="bg-slate-900 border border-cyan-800/60 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-4">
            <div className="p-2 bg-cyan-800/40 rounded-xl">
              <Inbox className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h4 className="text-lg font-black text-white">Incoming Queue</h4>
              <p className="text-xs text-slate-400">
                Jobs headed to this station next
              </p>
            </div>
            <span className="ml-auto px-3 py-1 bg-cyan-700 text-white text-sm font-black rounded-xl">
              {incomingQueue.length}
            </span>
          </div>
          <div className="space-y-3">
            {incomingQueue.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 bg-slate-800/60 rounded-2xl border border-slate-700"
              >
                <div className="flex-1">
                  <span className="text-base font-black text-cyan-300 font-mono">
                    {item.woNumber}
                  </span>
                  <span className="text-slate-400 text-sm ml-2">
                    {item.productName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="px-2 py-1 bg-slate-700 rounded-lg font-mono text-xs">
                    {item.fromStation}
                  </span>
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                  <span className="px-2 py-1 bg-cyan-900/50 border border-cyan-700 rounded-lg font-mono text-xs text-cyan-200">
                    {item.toStation}
                  </span>
                </div>
                <span className="text-sm font-bold text-white">
                  {item.quantity.toLocaleString()} pcs
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: LOG GOOD OUTPUT */}
      {/* ---------------------------------------------------- */}
      {/* P10 — IPQC CHECKLIST MODAL (from Control Plan) */}
      {ipccRun && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-cyan-300 flex items-center gap-2">
                  <ClipboardCheck className="w-6 h-6" /> IPQC CHECKLIST
                </h3>
                <p className="text-xs text-slate-400">
                  {ipccRun.runNumber} · {activeWorkOrder?.woNumber} ·{" "}
                  {ipccRun.processStep || "In-process"} — record measured values
                </p>
              </div>
              <button
                onClick={() => setIpccRun(null)}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {ipccError && (
              <div className="rounded-2xl bg-rose-950/40 border border-rose-500/50 p-4 text-rose-200 text-sm font-semibold">
                {ipccError}
              </div>
            )}

            {ipccMsg && (
              <div
                className={`rounded-2xl p-4 text-sm font-bold ${ipccMsg.includes("FAILED") ? "bg-rose-950/40 border border-rose-500/50 text-rose-200" : "bg-emerald-950/40 border border-emerald-500/50 text-emerald-200"}`}
              >
                {ipccMsg}
              </div>
            )}

            {ipccRun.status === "OPEN" && !ipccMsg && (
              <div className="space-y-3">
                {(ipccRun.checks || []).map((c: any) => (
                  <div
                    key={c.id}
                    className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-white">
                          {c.characteristic}
                        </p>
                        <p className="text-xs text-slate-400">
                          {c.processStep || ""} · Spec {c.specMin ?? "—"} –{" "}
                          {c.specMax ?? "—"}
                          {c.measurementMethod
                            ? ` · ${c.measurementMethod}`
                            : ""}
                          {c.sampleSize ? ` · sample ${c.sampleSize}` : ""}
                          {c.frequency ? ` · ${c.frequency}` : ""}
                        </p>
                      </div>
                      <input
                        value={ipccValues[c.id] || ""}
                        onChange={(e) =>
                          setIpccValues((v) => ({
                            ...v,
                            [c.id]: e.target.value,
                          }))
                        }
                        placeholder={
                          c.specMin !== null || c.specMax !== null
                            ? "Value…"
                            : "OK / NG"
                        }
                        inputMode={
                          c.specMin !== null || c.specMax !== null
                            ? "decimal"
                            : "text"
                        }
                        className="w-28 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-center text-lg font-mono text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={submitIpcc}
                  disabled={ipccLoading}
                  className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-2xl font-black text-lg shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {ipccLoading ? "Recording…" : "RECORD & EVALUATE"}
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  Any value outside spec auto-raises a non-conformance (NCR).
                </p>
              </div>
            )}

            {ipccRun.status !== "OPEN" && ipccMsg && (
              <button
                onClick={() => setIpccRun(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}

      {activeModal === "LOG_GOOD" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-2xl font-black text-white flex items-center gap-3">
                <Plus className="w-7 h-7 text-emerald-400" />
                {activeWorkOrder?.trackingMode === "SERIAL"
                  ? "Serial Capture (Aerospace)"
                  : "Log Good Output Units"}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {activeWorkOrder?.trackingMode === "SERIAL" ? (
              <div className="space-y-4">
                <div className="flex gap-2 p-1 bg-slate-800 rounded-lg">
                  <button
                    onClick={() => setSerialCaptureType("MANUAL")}
                    className={`flex-1 py-2 rounded-md font-bold ${serialCaptureType === "MANUAL" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-300"}`}
                  >
                    Manual/Scan
                  </button>
                  <button
                    onClick={() => setSerialCaptureType("AUTO")}
                    className={`flex-1 py-2 rounded-md font-bold ${serialCaptureType === "AUTO" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-300"}`}
                  >
                    Auto-range
                  </button>
                </div>

                {serialCaptureType === "MANUAL" ? (
                  <div>
                    <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Scan or Enter Serials (comma separated)
                    </label>
                    <textarea
                      value={serialInput}
                      onChange={(e) => setSerialInput(e.target.value)}
                      placeholder="e.g. SN-001, SN-002"
                      className="w-full min-h-[100px] bg-slate-800 border-2 border-slate-700 text-white text-xl font-bold p-4 rounded-2xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Generate Next N Serials
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={goodQtyInput}
                      onChange={(e) => setGoodQtyInput(e.target.value)}
                      className="w-full min-h-[64px] bg-slate-800 border-2 border-slate-700 text-white text-3xl font-black text-center rounded-2xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Quick Number Buttons */}
                <div className="grid grid-cols-4 gap-3">
                  {["+1", "+5", "+10", "+50"].map((btnLabel) => (
                    <button
                      key={btnLabel}
                      onClick={() => {
                        const num = parseInt(btnLabel.replace("+", ""));
                        setGoodQtyInput(
                          (parseInt(goodQtyInput || "0") + num).toString(),
                        );
                      }}
                      className="min-h-[64px] bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xl rounded-2xl border border-slate-700"
                    >
                      {btnLabel}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Good Quantity to Log
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={goodQtyInput}
                    onChange={(e) => setGoodQtyInput(e.target.value)}
                    className="w-full min-h-[64px] bg-slate-800 border-2 border-slate-700 text-white text-3xl font-black text-center rounded-2xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </>
            )}

            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 min-h-[64px] bg-slate-800 text-slate-300 font-bold text-lg rounded-2xl"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  performOperatorAction({
                    action: "LOG_GOOD",
                    workOrderId: activeWorkOrder.id,
                    machineId,
                    operatorId,
                    shiftId: currentShift?.id,
                    quantity: goodQtyInput,
                    serialInput:
                      activeWorkOrder?.trackingMode === "SERIAL" &&
                      serialCaptureType === "MANUAL"
                        ? serialInput
                        : undefined,
                    serialCaptureType:
                      activeWorkOrder?.trackingMode === "SERIAL"
                        ? serialCaptureType
                        : undefined,
                  })
                }
                disabled={actionLoading}
                className="flex-1 min-h-[64px] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-600/30"
              >
                Confirm Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: LOG SCRAP */}
      {/* ---------------------------------------------------- */}
      {activeModal === "LOG_SCRAP" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-2xl font-black text-white flex items-center gap-3">
                <AlertTriangle className="w-7 h-7 text-amber-400" />
                {activeWorkOrder?.trackingMode === "SERIAL"
                  ? "Quarantine Serial (Aerospace)"
                  : "Log Scrap / Defect"}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {activeWorkOrder?.trackingMode === "SERIAL" ? (
              <div>
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Defective Serial Number
                </label>
                <input
                  type="text"
                  value={scrappedSerialNo}
                  onChange={(e) => setScrappedSerialNo(e.target.value)}
                  placeholder="Scan or enter SN"
                  className="w-full min-h-[64px] bg-slate-800 border-2 border-slate-700 text-white text-3xl font-black text-center rounded-2xl focus:outline-none focus:border-amber-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Scrap Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={scrapQtyInput}
                  onChange={(e) => setScrapQtyInput(e.target.value)}
                  className="w-full min-h-[64px] bg-slate-800 border-2 border-slate-700 text-white text-3xl font-black text-center rounded-2xl focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                Defect Reason Code
              </label>
              <select
                value={selectedDefectCodeId}
                onChange={(e) => setSelectedDefectCodeId(e.target.value)}
                className="w-full min-h-[64px] bg-slate-800 border-2 border-slate-700 text-white text-lg font-bold px-4 rounded-2xl focus:outline-none focus:border-amber-500"
              >
                {defectCodes.map((d) => {
                  const translatedName =
                    currentLang === "te" && d.nameTe
                      ? d.nameTe
                      : currentLang === "hi" && d.nameHi
                        ? d.nameHi
                        : d.description;
                  return (
                    <option key={d.id} value={d.id}>
                      {d.code} — {translatedName}
                    </option>
                  );
                })}
              </select>
            </div>

            {activeWorkOrder?.trackingMode === "SERIAL" && (
              <div>
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Calibrated Tool Used *
                </label>
                <select
                  value={selectedCalibratedToolId}
                  onChange={(e) => setSelectedCalibratedToolId(e.target.value)}
                  className="w-full min-h-[64px] bg-slate-800 border-2 border-slate-700 text-white text-lg font-bold px-4 rounded-2xl focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select calibrated tool...</option>
                  {calibratedTools.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name} ({ct.serialNumber}) — {ct.status}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Required for aerospace inspections. EXPIRED tools are
                  hard-blocked by the system.
                </p>
              </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 min-h-[64px] bg-slate-800 text-slate-300 font-bold text-lg rounded-2xl"
              >
                {t("cancel", currentLang)}
              </button>
              <button
                onClick={() =>
                  performOperatorAction({
                    action: "LOG_SCRAP",
                    workOrderId: activeWorkOrder.id,
                    machineId,
                    operatorId,
                    shiftId: currentShift?.id,
                    quantity:
                      activeWorkOrder?.trackingMode === "SERIAL"
                        ? "1"
                        : scrapQtyInput,
                    defectCodeId: selectedDefectCodeId,
                    scrappedSerialNo:
                      activeWorkOrder?.trackingMode === "SERIAL"
                        ? scrappedSerialNo
                        : undefined,
                    calibratedToolId:
                      activeWorkOrder?.trackingMode === "SERIAL"
                        ? selectedCalibratedToolId
                        : undefined,
                  })
                }
                disabled={
                  actionLoading ||
                  (activeWorkOrder?.trackingMode === "SERIAL" &&
                    (!scrappedSerialNo || !selectedCalibratedToolId))
                }
                className="flex-1 min-h-[64px] bg-amber-600 hover:bg-amber-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-amber-600/30"
              >
                {t("logScrap", currentLang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: REPORT DOWNTIME */}
      {/* ---------------------------------------------------- */}
      {activeModal === "REPORT_DOWNTIME" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-4 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-2xl font-black text-white flex items-center gap-3">
                <StopCircle className="w-7 h-7 text-rose-500" />
                {t("selectDowntimeReason", currentLang)}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
                {t("selectDowntimeReason", currentLang)}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {downtimeReasons.map((r) => {
                  const isSelected = selectedReasonId === r.id;
                  const translatedReason =
                    currentLang === "te" && r.nameTe
                      ? r.nameTe
                      : currentLang === "hi" && r.nameHi
                        ? r.nameHi
                        : r.description;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReasonId(r.id)}
                      className={`min-h-[64px] p-4 rounded-2xl border-2 text-left font-bold transition-all ${
                        isSelected
                          ? "bg-rose-600/20 border-rose-500 text-white shadow-lg shadow-rose-600/20"
                          : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <div className="text-base font-extrabold">
                        {translatedReason}
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        {r.category}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                Operator Notes (Optional)
              </label>
              <input
                type="text"
                value={downtimeNotes}
                onChange={(e) => setDowntimeNotes(e.target.value)}
                placeholder="e.g. Hydraulic leak under main cylinder..."
                className="w-full p-4 bg-slate-800 border border-slate-700 text-white text-base rounded-2xl focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 min-h-[64px] bg-slate-800 text-slate-300 font-bold text-lg rounded-2xl"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  performOperatorAction({
                    action: "REPORT_DOWNTIME",
                    machineId,
                    workOrderId: activeWorkOrder?.id || null,
                    reasonId: selectedReasonId,
                    notes: downtimeNotes,
                  })
                }
                disabled={!selectedReasonId || actionLoading}
                className="flex-1 min-h-[64px] bg-rose-600 hover:bg-rose-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-rose-600/30"
              >
                START DOWNTIME
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 4: MOVE MATERIAL */}
      {/* ---------------------------------------------------- */}
      {activeModal === "MOVE_MATERIAL" && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-2xl font-black text-white flex items-center gap-3">
                <Truck className="w-7 h-7 text-cyan-400" />
                Complete &amp; Move Material
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {currentStep && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 text-sm">
                <div className="text-slate-400 mb-1">Moving from</div>
                <div className="font-bold text-white text-lg">
                  {currentStep.stationName}
                </div>
                <div className="text-slate-400 mt-2 mb-1">
                  Operation completed
                </div>
                <div className="font-bold text-cyan-300">
                  {currentStep.operation?.code} — {currentStep.operation?.name}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                Destination Station
              </label>
              <input
                type="text"
                value={moveToStation}
                onChange={(e) => setMoveToStation(e.target.value)}
                className="w-full min-h-[52px] bg-slate-800 border-2 border-slate-700 text-white text-xl font-bold px-4 rounded-2xl focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                Quantity to Move (pcs)
              </label>
              <input
                type="number"
                min="1"
                value={moveQtyInput}
                onChange={(e) => setMoveQtyInput(e.target.value)}
                className="w-full min-h-[64px] bg-slate-800 border-2 border-slate-700 text-white text-3xl font-black text-center rounded-2xl focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 min-h-[64px] bg-slate-800 text-slate-300 font-bold text-lg rounded-2xl"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveMaterial}
                disabled={moveLoading || !moveToStation}
                className="flex-1 min-h-[64px] bg-cyan-600 hover:bg-cyan-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-cyan-600/30 disabled:opacity-50"
              >
                {moveLoading ? "Moving..." : "Confirm Move"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 5: HOLD POINT SIGNOFF */}
      {/* ---------------------------------------------------- */}
      {activeModal === "HOLDPOINT_SIGNOFF" && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl max-w-2xl w-full p-4 sm:p-8 shadow-[0_0_50px_-12px_rgba(225,29,72,0.3)] space-y-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-2xl font-black text-rose-500 flex items-center gap-3">
                <AlertTriangle className="w-7 h-7" />
                HOLD POINT - {holdPointData?.authority} Inspection Required
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="text-slate-300 text-sm">
              Material movement is blocked until this hold point is signed off
              by an authorized inspector.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Inspector Name
                </label>
                <input
                  type="text"
                  value={signoffInspectorName}
                  onChange={(e) => setSignoffInspectorName(e.target.value)}
                  className="w-full min-h-[52px] bg-slate-800 border-2 border-slate-700 text-white text-lg font-bold px-4 rounded-2xl focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Organization / Authority
                </label>
                <input
                  type="text"
                  value={signoffInspectorOrg}
                  onChange={(e) => setSignoffInspectorOrg(e.target.value)}
                  placeholder="e.g. DSA QA"
                  className="w-full min-h-[52px] bg-slate-800 border-2 border-slate-700 text-white text-lg font-bold px-4 rounded-2xl focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                Inspection Result
              </label>
              <select
                value={signoffResult}
                onChange={(e) => setSignoffResult(e.target.value)}
                className="w-full min-h-[52px] bg-slate-800 border-2 border-slate-700 text-white text-lg font-bold px-4 rounded-2xl focus:outline-none focus:border-rose-500"
              >
                <option value="PASSED">PASSED - Approved to Proceed</option>
                <option value="CONCESSION">
                  CONCESSION - Approved with Remarks
                </option>
              </select>
            </div>

            {activeWorkOrder?.trackingMode === "SERIAL" &&
              holdPointData?.serialUnitIds && (
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                  <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
                    Select Serial Units for Sign-off
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {activeWorkOrder.serialUnits.map((su: any) => {
                      const isSelected = holdPointData.serialUnitIds?.includes(
                        su.id,
                      );
                      return (
                        <label
                          key={su.id}
                          className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 border border-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newIds = e.target.checked
                                ? [
                                    ...(holdPointData.serialUnitIds || []),
                                    su.id,
                                  ]
                                : (holdPointData.serialUnitIds || []).filter(
                                    (id) => id !== su.id,
                                  );
                              setHoldPointData({
                                ...holdPointData,
                                serialUnitIds: newIds,
                              });
                            }}
                            className="w-5 h-5 rounded text-rose-500 focus:ring-rose-500 bg-slate-900 border-slate-600"
                          />
                          <span className="text-white font-medium">
                            {su.serialNumber}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

            <div>
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                Remarks (Optional)
              </label>
              <textarea
                value={signoffRemarks}
                onChange={(e) => setSignoffRemarks(e.target.value)}
                className="w-full h-24 bg-slate-800 border-2 border-slate-700 text-white text-lg px-4 py-3 rounded-2xl focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 min-h-[64px] bg-slate-800 text-slate-300 font-bold text-lg rounded-2xl"
              >
                Cancel
              </button>
              <button
                onClick={handleHoldPointSignoff}
                disabled={
                  signoffLoading ||
                  !signoffInspectorName ||
                  !signoffInspectorOrg
                }
                className="flex-1 min-h-[64px] bg-rose-600 hover:bg-rose-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-rose-600/30 disabled:opacity-50"
              >
                {signoffLoading ? "Saving..." : "Record Sign-off"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URGENT TOOL CHANGE WARNING MODAL */}
      {(() => {
        const depletedTool = assignedTools.find(
          (t: any) =>
            t.status === "MAINTENANCE" ||
            t.currentCycles / t.maxLifeCycles >= 1.0,
        );
        if (!depletedTool || dismissedToolAlert) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl">
              <div className="space-y-2 text-center">
                <div className="inline-flex p-4 bg-rose-600/20 text-rose-500 rounded-3xl border border-rose-500/40">
                  <Wrench className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-white">
                  URGENT TOOL CHANGE REQUIRED
                </h2>
                <p className="text-sm text-rose-300">
                  Tool{" "}
                  <strong>
                    {depletedTool.name} ({depletedTool.toolCode})
                  </strong>{" "}
                  has reached 100% of its maximum life limit (
                  {depletedTool.maxLifeCycles.toLocaleString()} cycles).
                </p>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-center font-mono">
                  <span className="text-xs uppercase font-extrabold text-slate-400 block">
                    Life Status
                  </span>
                  <span className="text-4xl font-black text-rose-500">
                    100% EXHAUSTED
                  </span>
                </div>
              </div>

              <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-2xl text-xs text-rose-200">
                ⚠️ Continuous operation with worn tooling risks dimensional part
                defects, surface burrs, or tool fracture. Perform tool
                replacement or regrind.
              </div>

              <button
                type="button"
                onClick={() => setDismissedToolAlert(true)}
                className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white text-base font-black rounded-2xl shadow-xl shadow-rose-600/30 cursor-pointer"
              >
                Acknowledge Tool Change Warning
              </button>
            </div>
          </div>
        );
      })()}

      {/* CALIBRATION EXPIRED BLOCK MODAL (Nadcap) */}
      {calibrationBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-4 border-rose-600 rounded-3xl w-full max-w-lg p-6 sm:p-8 space-y-6 shadow-[0_0_80px_rgba(225,29,72,0.5)] text-center">
            <div className="inline-flex p-5 bg-rose-600/20 rounded-full border-2 border-rose-500/50">
              <AlertTriangle className="w-14 h-14 text-rose-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-rose-500 tracking-tight">
                CALIBRATION EXPIRED
              </h2>
              <h3 className="text-xl font-bold text-white">
                Inspection Invalid
              </h3>
              <p className="text-slate-300 text-sm">
                Tool{" "}
                <strong className="text-white">
                  {calibrationBlock.toolName}
                </strong>{" "}
                ({calibrationBlock.toolSerial}) is past its calibration expiry
                date. The inspection was NOT saved and the scrap log is blocked.
              </p>
              <p className="text-xs font-mono text-slate-400">
                Expired:{" "}
                {new Date(calibrationBlock.expiresAt).toLocaleDateString()} ·
                CALIBRATION_BLOCKED audit logged
              </p>
            </div>
            <button
              onClick={() => setCalibrationBlock(null)}
              className="w-full min-h-[64px] bg-rose-600 hover:bg-rose-500 text-white text-xl font-black rounded-2xl shadow-xl shadow-rose-600/40 cursor-pointer border border-rose-400/40 transition-all"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}

      {/* FAST SAFETY LOG MODAL */}
      {showFastSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!safetyDescInput.trim()) return;
              setSafetySubmitting(true);
              try {
                const res = await offlineFetchWrapper("/api/safety", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: safetyTypeInput,
                    severity: safetySeverityInput,
                    description: safetyDescInput.trim(),
                    location: machineState?.name || "Shopfloor",
                    reportedBy: currentOperatorName || "Operator",
                  }),
                });
                if (res.ok) {
                  alert(
                    safetySeverityInput === "HIGH" ||
                      safetySeverityInput === "CRITICAL"
                      ? "🚨 CRITICAL Safety Report Logged! Immediate Andon alert triggered on shopfloor."
                      : "⚠️ Safety incident reported successfully.",
                  );
                  setShowFastSafetyModal(false);
                  setSafetyDescInput("");
                } else {
                  alert("Failed to submit safety report");
                }
              } catch (err) {
                alert("Error submitting safety report");
              } finally {
                setSafetySubmitting(false);
              }
            }}
            className="bg-slate-900 border-2 border-rose-600 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-rose-500" />
                Fast Safety &amp; Near-Miss Log
              </h3>
              <button
                type="button"
                onClick={() => setShowFastSafetyModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block font-extrabold text-slate-300 uppercase text-xs mb-1">
                  Incident Type *
                </label>
                <select
                  value={safetyTypeInput}
                  onChange={(e) => setSafetyTypeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-rose-500 font-bold"
                >
                  <option value="HAZARD">Hazard Condition</option>
                  <option value="NEAR_MISS">Near-Miss Event</option>
                  <option value="PPE_VIOLATION">PPE Violation</option>
                  <option value="INCIDENT">Injury Incident</option>
                </select>
              </div>

              <div>
                <label className="block font-extrabold text-slate-300 uppercase text-xs mb-1">
                  Severity *
                </label>
                <select
                  value={safetySeverityInput}
                  onChange={(e) => setSafetySeverityInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-rose-500 font-black"
                >
                  <option value="LOW">Low (Minor hazard)</option>
                  <option value="MEDIUM">Medium (Needs attention)</option>
                  <option value="HIGH">HIGH (High Risk - Auto Andon)</option>
                  <option value="CRITICAL">
                    CRITICAL (Stop Work - Auto Andon)
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-extrabold text-slate-300 uppercase text-xs mb-1">
                  Detailed Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the hazard, near-miss, or safety risk..."
                  value={safetyDescInput}
                  onChange={(e) => setSafetyDescInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowFastSafetyModal(false)}
                className="px-5 py-3 text-sm font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={safetySubmitting}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                {safetySubmitting ? "Submitting..." : "Submit Safety Report ⚠️"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUBMIT IDEA MODAL */}
      {showIdeaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ideaTitleInput.trim() || !ideaDescInput.trim()) return;
              setIdeaSubmitting(true);
              try {
                const res = await offlineFetchWrapper("/api/ideas", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: ideaTitleInput.trim(),
                    description: ideaDescInput.trim(),
                    category: ideaCategoryInput,
                    submittedBy: currentOperatorName || "Operator",
                  }),
                });
                if (res.ok) {
                  alert(
                    "💡 Idea submitted successfully! Thank you for improving our shopfloor.",
                  );
                  setShowIdeaModal(false);
                  setIdeaTitleInput("");
                  setIdeaDescInput("");
                } else {
                  alert("Failed to submit idea");
                }
              } catch (err) {
                alert("Error submitting idea");
              } finally {
                setIdeaSubmitting(false);
              }
            }}
            className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Lightbulb className="w-6 h-6 text-amber-400" />
                Submit Shopfloor Improvement Idea
              </h3>
              <button
                type="button"
                onClick={() => setShowIdeaModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block font-extrabold text-slate-300 uppercase text-xs mb-1">
                  Category *
                </label>
                <select
                  value={ideaCategoryInput}
                  onChange={(e) => setIdeaCategoryInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="SAFETY">Safety Improvement</option>
                  <option value="FIVES">5S & Workplace Organization</option>
                  <option value="CYCLE_TIME">Cycle Time Reduction</option>
                  <option value="ERGONOMICS">Ergonomics & Workstation</option>
                </select>
              </div>

              <div>
                <label className="block font-extrabold text-slate-300 uppercase text-xs mb-1">
                  Idea Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shadow board for hex keys on CNC Machine 01"
                  value={ideaTitleInput}
                  onChange={(e) => setIdeaTitleInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-extrabold text-slate-300 uppercase text-xs mb-1">
                  Idea Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the issue and your Kaizen improvement solution..."
                  value={ideaDescInput}
                  onChange={(e) => setIdeaDescInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowIdeaModal(false)}
                className="px-5 py-3 text-sm font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={ideaSubmitting}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg cursor-pointer"
              >
                {ideaSubmitting ? "Submitting..." : "Submit Idea 💡"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Change My Password
                  </h3>
                  <p className="text-xs text-slate-400">
                    Update account credentials
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setOpPassError(null);
                  setOpCurrentPass("");
                  setOpNewPass("");
                  setOpConfirmPass("");
                }}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {opPassError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{opPassError}</span>
              </div>
            )}

            <form onSubmit={handleChangeOperatorPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={opCurrentPass}
                  onChange={(e) => setOpCurrentPass(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={opNewPass}
                  onChange={(e) => setOpNewPass(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={opConfirmPass}
                  onChange={(e) => setOpConfirmPass(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setOpPassError(null);
                  }}
                  className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={opPassLoading}
                  className="w-1/2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {opPassLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save Password"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: REQUEST MAINTENANCE */}
      {/* ---------------------------------------------------- */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-2xl font-black text-white flex items-center gap-3">
                <Wrench className="w-7 h-7 text-orange-400" />
                Request Maintenance
              </h3>
              <button
                onClick={() => setShowMaintenanceModal(false)}
                className="text-slate-400 hover:text-white p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Machine
                </label>
                <div className="w-full min-h-[48px] bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white font-bold text-base">
                  {machineState?.name || machineId}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setMaintPriorityInput(p)}
                      className={`py-3 rounded-2xl font-black text-sm border transition-all ${
                        maintPriorityInput === p
                          ? p === "LOW"
                            ? "bg-slate-600 border-slate-400 text-white"
                            : p === "MEDIUM"
                              ? "bg-amber-600 border-amber-400 text-white"
                              : p === "HIGH"
                                ? "bg-orange-600 border-orange-400 text-white"
                                : "bg-red-600 border-red-400 text-white"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Issue Description *
                </label>
                <textarea
                  rows={4}
                  value={maintDescInput}
                  onChange={(e) => setMaintDescInput(e.target.value)}
                  placeholder="Describe the fault or maintenance required…"
                  className="w-full bg-slate-800 border-2 border-slate-700 text-white text-base rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-500 resize-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowMaintenanceModal(false)}
                className="flex-1 min-h-[60px] bg-slate-800 text-slate-300 font-bold text-lg rounded-2xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!maintDescInput.trim()) return;
                  setMaintSubmitting(true);
                  try {
                    const res = await offlineFetchWrapper(
                      "/api/maintenance/jobs",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          machineId,
                          requestedByName: operatorId,
                          type: "BREAKDOWN",
                          priority: maintPriorityInput,
                          description: maintDescInput,
                        }),
                      },
                    );
                    if (res.ok) {
                      setShowMaintenanceModal(false);
                      alert(
                        "✅ Maintenance request submitted! A job card has been created.",
                      );
                    } else {
                      const d = await res.json();
                      alert("❌ Failed: " + (d.error || "Unknown error"));
                    }
                  } catch {
                    alert("❌ Network error — please try again.");
                  } finally {
                    setMaintSubmitting(false);
                  }
                }}
                disabled={maintSubmitting || !maintDescInput.trim()}
                className="flex-1 min-h-[60px] bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black text-lg rounded-2xl shadow-xl shadow-orange-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Wrench className="w-6 h-6" />
                {maintSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECENT ACTIVITY */}
      <OperatorRecentLogs
        operatorId={operatorId}
        downtimeReasons={downtimeReasons}
        onEditComplete={() => fetchLiveState(machineId, operatorId)}
      />

      {showAiVisionModal && (
        <AiVisionDiagnostics
          machineId={machineId}
          onClose={() => setShowAiVisionModal(false)}
        />
      )}
    </div>
  );
}
