import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const shipments = [
    {
      id: "SHP-INB-901",
      type: "INBOUND_RAW_MATERIAL",
      origin: "Salem Titanium Mill (TN)",
      destination: "Plant 1 Central Vault (Bengaluru)",
      carrier: "Blue Dart Express Logistics",
      vehicleNo: "KA-01-EA-8842",
      cargo: "Titanium Grade 5 Round Bars (60mm Dia) — Lot #HEAT-T94",
      weightKg: 1250,
      status: "IN_TRANSIT",
      progressPct: 78,
      eta: "Today, 17:30 IST",
      geofenceStatus: "18 km to Plant North Gate",
      lat: 13.0827,
      lng: 77.5877,
    },
    {
      id: "SHP-SUBCON-402",
      type: "SUBCONTRACT_OUTWARD",
      origin: "Plant 1 Machining Bay",
      destination: "Apex Surface Technologies (Hosur)",
      carrier: "Dedicated Plant Shuttle 02",
      vehicleNo: "KA-05-MH-2041",
      cargo:
        "50 pcs Milled Housings under Challan #DC-2026-0042 for Hard Anodizing",
      weightKg: 240,
      status: "AT_VENDOR",
      progressPct: 100,
      eta: "In Process (Inward QC expected tomorrow 11:00)",
      geofenceStatus: "Parked at Vendor Inward Bay",
      lat: 12.7409,
      lng: 77.8253,
    },
    {
      id: "SHP-DISP-108",
      type: "CUSTOMER_DISPATCH",
      origin: "Plant 1 Dispatch Bay",
      destination: "HAL Aerospace Assembly Division (Bengaluru)",
      carrier: "SafeFreight Aerospace Carrier",
      vehicleNo: "KA-53-Z-9912",
      cargo: "100 pcs Certified Gear Housings (CoC #COC-2026-881 attached)",
      weightKg: 480,
      status: "DELIVERED",
      progressPct: 100,
      eta: "Delivered at 13:15 IST",
      geofenceStatus: "Gate Inward Completed & Signed",
      lat: 12.9569,
      lng: 77.6653,
    },
  ];

  return NextResponse.json({
    shipments,
    stats: {
      activeInTransit: 1,
      subcontractAtVendor: 1,
      deliveredToday: 1,
      onTimeDeliveryRatePct: 98.4,
    },
  });
}
