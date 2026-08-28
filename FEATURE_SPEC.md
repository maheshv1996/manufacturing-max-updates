# Enterprise Smart Manufacturing Platform: Master Feature Specification

## 🌟 Platform Architecture Overview
An industrial-grade, aerospace-compliant Smart Manufacturing Enterprise Platform (ERP + MES + IIoT + Digital Twin + AI Assistant + Telematics) built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS (Glassmorphic Dark Design System)**, **Prisma ORM**, **PostgreSQL**, and containerized with **Docker / Docker Compose**.

The platform is organized across **11 core enterprise departments**, featuring real-time industrial communication protocols (**MQTT Sparkplug B**, **ISA-95 Unified Namespace**, **OPC-UA**), edge rule automation engines, physics-based 3D digital twins, Generative AI shopfloor copilot, hands-free voice command terminals, GPS supply chain fleet radar, predictive maintenance RUL models, and full AS9102 aerospace quality compliance.

---

## 🏛️ Enterprise Department Directory & Module Index

### 1. 🏢 Executive & General Management (`/management` & `/reports`)
* **Executive Boardroom Monthly Briefing (`/reports/executive-briefing`)**: Boardroom-grade executive briefing pack with printable formatting, contribution margin waterfall (Gross Revenue $\rightarrow$ RM $\rightarrow$ Machining $\rightarrow$ Tooling $\rightarrow$ Subcontracting $\rightarrow$ Net Margin 35.2%), plant composite OEE (87.4%), and department scorecards.
* **Executive Cockpit (`/`)**: Real-time revenue run rate, plant OEE %, open work orders, quality yield %, active alarms, and live production ticker.
* **Cost Center Budgeting & Burn (`/management/budget-burn`)**: Departmental CAPEX/OPEX expenditure tracking with warning thresholds.
* **Escalations & SLA Board (`/system/escalations`)**: Multi-tier incident escalations with auto-aging notifications.
* **Organization Hierarchy Tree (`/departments`)**: 11-department interactive org structure and head-of-department routing.

### 2. ⚙️ Engineering & R&D (`/engineering` & `/digital-twin`)
* **Multi-Level BOM Tree & Cost Exploder (`/engineering/bom-tree`)**: Hierarchical assembly decomposition with recursive standard costing ($\text{Material} + \text{Machining} + \text{Tooling} = \text{Standard Cost}$).
* **3D Digital Twin Workcell (`/digital-twin/cell`)**: Physics-based 3D simulation of BT-40 machining center, Fanuc 6-axis handling robot, conveyors, and real-time telemetry HUD overlay.
* **Virtual Commissioning & PLC Simulator (`/digital-twin/commissioning`)**: Hardware-in-the-loop DI/DO mapping, $1.2\text{ms}$ IEC 61131-3 ladder rung execution, and safety fault injection.
* **Visual ECO Diff & Approvals (`/eco/diff`)**: Side-by-side BOM revision diff (Rev A vs Rev B) with 3-tier electronic signature gate (Lead Engineer, Quality Manager, Plant Head).
* **CNC Machining Speed/Feed Calculator (`/engineering/cnc-calc`)**: Speeds, feeds, cutting power kW, and surface finish ($R_a$) estimation for aerospace alloys.
* **Tooling & Fixture Register (`/engineering/fixtures`)**: Calibrated fixture status and mandatory Work Order start gate.

### 3. 🏭 Production & Shop Floor MES (`/ops`)
* **Hands-Free Shopfloor Voice Command Terminal (`/ops/voice`)**: Acoustic voice synthesis & speech recognition: hands-free piece clocking, Andon radio dispatches, and telemetry lookups.
* **Shopfloor Tablet Kiosk Mode (`/ops/kiosk`)**: Rugged touchscreen terminal optimized for glove operation with giant $+1$ Good and Scrap piece clocking, job pause/resume, and Andon emergency controls.
* **Work Order Workbench & Dispatch (`/ops/work-orders`)**: Schedule, issue material, assign routing steps, and log production batches.
* **Shopfloor Andon Live Board (`/ops/andon`)**: Hourly target vs actual realization, cycle time variances, and bottleneck alerts.
* **OEE Analytics Engine (`/ops/oee`)**: Availability $\times$ Performance $\times$ Quality breakdown across all workcells.

### 4. 🔬 Quality Assurance, Metrology & Compliance (`/quality`)
* **360° Serial & Lot Genealogy (`/quality/genealogy`)**: Chronological 6-stage upstream/downstream trace:
  $$\text{Mill Heat Lot} \longrightarrow \text{CNC Machining} \longrightarrow \text{Subcontracting} \longrightarrow \text{AS9102 FAI} \longrightarrow \text{Packaging EAN} \longrightarrow \text{Customer Dispatch}$$
* **First Article Inspection AS9102 (`/fai`)**: Balloon drawing ballooning, Form 1/2/3 inspection records, and dimensional deviation tracking.
* **Non-Conformance & CAPA Management (`/quality/ncr`)**: 8D root-cause investigation, containment actions, and corrective signoffs.
* **Calibration Laboratory (`/quality/calibration`)**: Metrology gauge calibration schedules, master traceability certs, and drift analysis.

### 5. 📦 Supply Chain, Warehousing & Logistics (`/supply`)
* **Supply Chain Logistics & GPS Fleet Radar (`/supply/fleet-radar`)**: Real-time telematics radar tracking inbound raw materials (Titanium Mills), outward subcontracting challans, and customer dispatches with live geofencing.
* **Database MRP Planning Workbench (`/supply/mrp`)**: Explodes open work orders against PostgreSQL BOMs and stock levels; generates 1-click `PurchaseRequisitions`.
* **Subcontracting & Special Process Outsourcing (`/supply/subcontracting`)**: Delivery Challan generation (`DC-YYYY-XXXX`), vendor tracking, and inward QC inspection signoff.
* **Intralogistics AGV & AS/RS Warehouse (`/digital-twin/agv`)**: Lidar SLAM plant map routing for 3 AGVs, battery health, and high-bay AS/RS warehouse utilization ($12 \times 12$ bins).
* **Inventory Control & Vault (`/supply/vault`)**: Real-time bin mapping, heat lot segregation, minimum stock alerts, and ABC cycle counts.

### 6. 🛠️ Maintenance & Plant Reliability TPM (`/maintenance`)
* **Predictive Maintenance & Spindle Remaining Useful Life (RUL) (`/maintenance/predictive`)**: Machine learning degradation forecasting using Weibull curves, ISO 10816 vibration trajectory, and 1-click preemptive bearing replacement work orders.
* **Total Productive Maintenance & Reliability (`/maintenance/reliability`)**: Mean Time Between Failures (MTBF hrs), Mean Time To Repair (MTTR mins), equipment availability %, and Maintenance Kanban.
* **Preventive Maintenance Schedules (`/maintenance/pm`)**: Automated calendar PM triggers based on spindle run hours.

### 7. 🌐 Industrial IoT & Unified Namespace (UMH Stack) (`/iot`)
* **ISA-95 Unified Namespace (UNS) Live Explorer (`/iot/uns`)**: Hierarchical tree (`Enterprise / Site / Area / Line / Workcell / Metric`) with live JSON payload viewer.
* **Real-Time Sensor Telemetry Historian (`/iot/telemetry`)**: 6 high-frequency waveform oscilloscopes (Spindle RPM, Load %, Vibration RMS, Bearing Temp, Coolant Bar, Power kW).
* **MQTT / OPC-UA Edge Gateway (`/iot/gateway`)**: UMH Benthos stream pipeline diagnostics ($1,420\text{ msg/s}$) and interactive MQTT test injector.

### 8. 🔀 Visual Automation Studio & Edge Rule Engine (Node-RED) (`/automation`)
* **Visual Flow Studio (`/automation/flows`)**: Drag-and-wire visual canvas connecting Input Triggers, Threshold Filters, and Native MES Actions.
* **Real-Time Edge Event Engine & Debug Wire (`/automation/debug`)**: Live streaming packet console with sub-5ms execution latencies.
* **Industrial Automation Recipe Catalog (`/automation/recipes`)**: 5 pre-packaged edge recipes.

### 9. 📡 AMRC Factory+ Industrial Architecture Suite (`/factoryplus`)
* **MQTT Sparkplug B Node & Device Manager (`/factoryplus/sparkplug`)**: Eclipse Sparkplug B (spBv1.0) Report-by-Exception protocol saving 86.4% bandwidth with `NBIRTH`, `DBIRTH`, `DDATA` inspection.
* **Factory+ Asset Directory (`/factoryplus/directory`)**: Centralized UUID-indexed device catalog for Edge Gateways, CNCs, and CMMs.
* **Industrial Schema Validator (`/factoryplus/schemas`)**: Standardized JSON Schemas (Draft 2020-12) for CNC Milling, CMM Metrology, and Cleanrooms with live schema validator.

### 10. 💰 Finance, Job Costing & Commercials (`/finance` & `/commercial`)
* **Actual vs Standard Job Costing Ledger (`/finance/costing`)**: Order-level profitability reconciliation, material variance, labor cost, and margin %.
* **Quotations & Estimation (`/commercial/quotations`)**: Cycle time estimation and automated quotation generation.

### 11. 💻 IT Administration, Synthetics, AI Copilot & Cybersecurity (`/system` & `/ai`)
* **Autonomous Synthetic MES/ERP E2E Pipeline Tester (`/system/synthetics`)**: Automated 7-stage factory pipeline test runner (BOM Explosion $\rightarrow$ MRP $\rightarrow$ Work Orders $\rightarrow$ Kiosk $\rightarrow$ Subcontracting $\rightarrow$ AS9102 FAI $\rightarrow$ Job Costing) with 100% health score.
* **Shopfloor AI Copilot (`/ai/assistant`)**: Grounded generative AI assistant querying real-time telemetry, work orders, digital twins, and dispatching 1-click actions.
* **Global Command Palette (`Ctrl+K` / `Cmd+K`)**: Instant fuzzy search across all 100+ functions, tools, machines, and work orders.
* **RBAC & User Access Review (`/system/access-review`)**: Quarterly user permissions audit and SOX/ISO compliance certification.

---

## 🐳 Containerization & Deployment
* **Dockerfile**: Multi-stage standalone Next.js 16 container build.
* **docker-compose.yml**: Multi-container stack (Next.js app + PostgreSQL 16 + Eclipse Mosquitto MQTT + Redis).
