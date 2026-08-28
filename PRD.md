# Product Requirements Document (PRD)

## Product Overview
Manufacturing Max is a modern, web-based Manufacturing Execution System (MES) and Enterprise Resource Planning (ERP) platform. It is designed to bridge the gap between heavy, legacy ERP systems and modern, fast-paced manufacturing needs.

## Target Users
- **Primary:** Aerospace, Defense, and R&D Tier-2/3 Suppliers.
- **Secondary:** General discrete manufacturing shops (CNC machining, assembly, fabrication).
- **User Roles:**
  - **Operators:** Interacting with touch-friendly terminals on the shop floor.
  - **Supervisors / Production Managers:** Monitoring live OEE, shift counts, and capacity.
  - **Quality Inspectors / Engineers:** Managing FAI, NCRs, and hold points.
  - **Admin / Management:** Overseeing analytics, quotes, dispatch, and overall configuration.

## Problems Solved
- **Traceability:** Legacy systems fail to track component history accurately. This system natively supports deep serialization and material traceability.
- **Compliance overhead:** Automates the creation of Data Packages (dossiers) and manages strict compliance frameworks (e.g., AS9100) effortlessly.
- **Real-time visibility:** Eliminates paper-based tracking with live Operator Terminals logging production, scrap, downtime, and IoT telemetry.
- **Change Management:** Strict, system-enforced ECO (Engineering Change Order) flows ensure out-of-date drawings or BOMs are never used on the shop floor.

## Feature List by Department

### Production & Shop Floor
- **Live Operator Terminal:** Big-touch UI for clock-ins, job starts, scrap/downtime logging, and material movement.
- **OEE & Telemetry:** Real-time Overall Equipment Effectiveness (OEE) tracking with direct machine state telemetry.
- **Shift Management & Handovers:** Shift-to-shift counts and digital handover logs.

### Quality & Aero Compliance Pack
- **Serialization & Tracking:** Support for both BATCH and SERIAL tracking modes.
- **AS9102 FAI (First Article Inspection):** Dedicated reporting and approvals for FAI.
- **NCR/MRB (Non-Conformance Report / Material Review Board):** End-to-end scrap quarantines and NCR dispositioning.
- **Mill Certs & Material Traceability:** Mandatory attachment and tracking of material certificates (COC, Mill Certs, Test Reports).
- **Hold Points:** Enforced sign-offs by quality/engineering before a serial unit can advance in its routing.
- **Data Packages:** One-click generation of the entire proof-of-part dossier, frozen upon release.
- **ECO/ECN Configuration Management:** Revisions become law. ECOs govern changes to BOM, Routing, and Drawings with date/serial effectivity gating.

### Engineering & Planning
- **BOM & Routings:** Deep product structures with sequence-based routing steps and cycle/setup times.
- **Document Control:** Version-controlled documents with automated archiving of superseded revisions.
- **Maintenance (PM & Breakdown):** Preventive maintenance rules, tool tracking, and breakdown job management.

### Supply Chain & Inventory
- **Purchasing:** Purchase orders with partial/full receipt tracking and supplier performance.
- **Inventory & Transactions:** Real-time raw material tracking with detailed adjustment history.
- **Dispatch & Invoicing:** Challans (dispatch records) linked directly to invoices and payment tracking.

### Sales & Customer Relations
- **Quotations:** CRM-style quoting with margin calculations and tracking.
- **Customer Complaints (RMA):** CAPA tracking and root cause analysis via 8D / 5Why methodologies.
- **CRM / Leads:** Basic lead tracking and status updates.

### Management & Analytics
- **Live Dashboards:** Command center for pending approvals, overall OEE, and active jobs.
- **AI Analyst:** LLM-powered data analyst capable of querying current DB metrics.
- **Energy Tracking:** kWh usage vs. cost tracking for sustainability metrics.
