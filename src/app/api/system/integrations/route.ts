import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connectors = [
      {
        id: "tally",
        name: "Tally Prime ERP Connector",
        category: "Accounting & GST",
        status: "CONNECTED",
        lastSync: new Date(Date.now() - 1800000).toISOString(),
        details: "XML Ledger export, GST Invoices, Voucher auto-import",
      },
      {
        id: "sap",
        name: "SAP S/4HANA OData Bridge",
        category: "Enterprise ERP",
        status: "READY",
        lastSync: "Configured",
        details: "Material Master, Work Center routing, PO Inward sync",
      },
      {
        id: "edi",
        name: "Aerospace EDI 850 / 856 Engine",
        category: "Customer Portal",
        status: "ACTIVE",
        lastSync: new Date(Date.now() - 3600000 * 4).toISOString(),
        details: "Boeing / Airbus purchase order & ASN exchange",
      },
      {
        id: "webhooks",
        name: "Universal Outgoing Webhooks",
        category: "Real-time Events",
        status: "ACTIVE",
        lastSync: "Live",
        details: "Dispatches JSON payloads on WO Finish, Scrap Spike, Quality Hold",
      },
    ];

    return NextResponse.json({ success: true, connectors });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
