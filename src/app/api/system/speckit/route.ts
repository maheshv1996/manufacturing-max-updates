import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const cwd = process.cwd();
    const specifyDir = path.join(cwd, ".specify");
    const hasSpecify = fs.existsSync(specifyDir);

    let constitutionContent = "";
    const constitutionPath = path.join(specifyDir, "memory", "constitution.md");
    if (fs.existsSync(constitutionPath)) {
      constitutionContent = fs.readFileSync(constitutionPath, "utf-8");
    }

    let initOptions: any = null;
    const initOptionsPath = path.join(specifyDir, "init-options.json");
    if (fs.existsSync(initOptionsPath)) {
      try {
        initOptions = JSON.parse(fs.readFileSync(initOptionsPath, "utf-8"));
      } catch {}
    }

    let workflows: string[] = [];
    const workflowsDir = path.join(specifyDir, "workflows");
    if (fs.existsSync(workflowsDir)) {
      workflows = fs.readdirSync(workflowsDir);
    }

    let templates: string[] = [];
    const templatesDir = path.join(specifyDir, "templates");
    if (fs.existsSync(templatesDir)) {
      templates = fs.readdirSync(templatesDir);
    }

    // Read project specifications
    const specs = [
      {
        id: "feature-spec",
        name: "FEATURE_SPEC.md",
        title: "Enterprise MES & ERP Feature Specification",
        exists: fs.existsSync(path.join(cwd, "FEATURE_SPEC.md")),
        category: "Platform Architecture",
      },
      {
        id: "mfg-spec",
        name: "MANUFACTURING_MAX_SPECIFICATION.md",
        title: "Manufacturing Max Core Specification",
        exists: fs.existsSync(
          path.join(cwd, "MANUFACTURING_MAX_SPECIFICATION.md"),
        ),
        category: "Domain Models",
      },
      {
        id: "work-log",
        name: "WORK_LOG.md",
        title: "Implementation Verification & Audit Log",
        exists: fs.existsSync(path.join(cwd, "WORK_LOG.md")),
        category: "Audit & Verification",
      },
    ];

    const speckitWorkflows = [
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
    ];

    return NextResponse.json({
      status: "ok",
      installed: hasSpecify,
      cliVersion: "1.0.1 (GitHub Spec Kit)",
      cliPath: "C:\\Users\\mahes\\.local\\bin\\specify.exe",
      initOptions,
      constitution: constitutionContent,
      workflows,
      templates,
      projectSpecs: specs,
      speckitWorkflows,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 },
    );
  }
}
