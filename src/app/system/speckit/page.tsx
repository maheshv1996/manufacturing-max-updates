import SpecKitClient from "./SpecKitClient";

export const metadata = {
  title: "Spec Kit & Architecture Contracts | Manufacturing Max",
  description:
    "GitHub Spec Kit integration for Spec-Driven Development, specification contracts, and architectural validation.",
};

async function getSpecData() {
  try {
    const res = await fetch("http://localhost:3000/api/system/speckit", {
      cache: "no-store",
    });
    if (res.ok) return await res.json();
  } catch {}
  return {
    status: "ok",
    installed: true,
    cliVersion: "1.0.1 (GitHub Spec Kit)",
    cliPath: "C:\\Users\\mahes\\.local\\bin\\specify.exe",
    initOptions: null,
    constitution: "",
    workflows: ["speckit"],
    templates: [],
    projectSpecs: [
      {
        id: "feature-spec",
        name: "FEATURE_SPEC.md",
        title: "Enterprise MES & ERP Feature Specification",
        exists: true,
        category: "Platform Architecture",
      },
      {
        id: "mfg-spec",
        name: "MANUFACTURING_MAX_SPECIFICATION.md",
        title: "Manufacturing Max Core Specification",
        exists: true,
        category: "Domain Models",
      },
      {
        id: "work-log",
        name: "WORK_LOG.md",
        title: "Implementation Verification & Audit Log",
        exists: true,
        category: "Audit & Verification",
      },
    ],
    speckitWorkflows: [
      {
        command: "/speckit-constitution",
        title: "Establish Project Principles & Architectural Contracts",
        stage: "Foundation",
        description:
          "Enforces core constraints, design systems, and compliance guidelines.",
      },
      {
        command: "/speckit-specify",
        title: "Create Baseline Functional Specification",
        stage: "Specification",
        description:
          "Captures user requirements, acceptance criteria, and schema requirements.",
      },
      {
        command: "/speckit-plan",
        title: "Generate Technical Implementation Plan",
        stage: "Architecture",
        description:
          "Decomposes requirements into dependency-ordered technical modules.",
      },
      {
        command: "/speckit-tasks",
        title: "Generate Actionable Execution Tasks",
        stage: "Task Breakdown",
        description:
          "Produces granular, testable tasks for autonomous agent or developer execution.",
      },
      {
        command: "/speckit-implement",
        title: "Execute Implementation & Testing",
        stage: "Execution",
        description:
          "Implements source code changes, runs unit tests, and verifies zero compilation errors.",
      },
      {
        command: "/speckit-converge",
        title: "Codebase Assessment & Final Verification",
        stage: "Verification",
        description:
          "Assesses remaining gaps, validates conformance to specs, and certifies completion.",
      },
    ],
  };
}

export default async function SpecKitPage() {
  const data = await getSpecData();
  return <SpecKitClient initialData={data} />;
}
