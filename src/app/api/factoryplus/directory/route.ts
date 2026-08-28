import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      include: { line: true },
      orderBy: { code: "asc" },
    });

    const directoryNodes = [
      {
        nodeId: "Cell-01-EdgeGateway",
        nodeUuid: "110ec58a-a0f2-4ac4-8393-c866d813b8d1",
        hardware: "Dell Edge Gateway 3000",
        ipAddress: "192.168.1.10",
        os: "Linux RT 6.1 (Docker Engine)",
        status: "ONLINE",
        firmware: "v4.28.1-umh-benthos",
        devicesCount: machines.length + 2,
      },
    ];

    const directoryDevices = [
      ...machines.map((m, idx) => ({
        deviceId: m.code,
        deviceUuid: `e4eaaaf2-d142-11e1-b3e4-${String(idx + 1).padStart(12, "0")}`,
        name: m.name,
        type: m.code.startsWith("CNC")
          ? "5-Axis CNC Milling Center"
          : "Vertical Machining Center",
        parentNodeId: "Cell-01-EdgeGateway",
        schemaUuid: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        schemaName: "AMRC CNC Milling Schema v2.1",
        status: m.status === "RUNNING" ? "ONLINE" : "STANDBY",
        line: m.line?.name || "Machining Cell A",
        sparkplugAddress: `spBv1.0/ApexAerospace/DDATA/Cell-01-EdgeGateway/${m.code}`,
      })),
      {
        deviceId: "CMM-01",
        deviceUuid: "e4eaaaf2-d142-11e1-b3e4-000000000088",
        name: "Zeiss Prismo 3D Coordinate Measuring Machine",
        type: "Precision CMM Metrology",
        parentNodeId: "Cell-01-EdgeGateway",
        schemaUuid: "e7b92f81-304b-4f8a-92f7-7b891d4e12c1",
        schemaName: "AMRC Metrology CMM Schema v1.0",
        status: "ONLINE",
        line: "Metrology & QA Lab",
        sparkplugAddress:
          "spBv1.0/ApexAerospace/DDATA/Cell-01-EdgeGateway/CMM-01",
      },
      {
        deviceId: "ENV-01",
        deviceUuid: "e4eaaaf2-d142-11e1-b3e4-000000000099",
        name: "Class 10,000 Cleanroom Environmental Monitor",
        type: "Environmental Sensor",
        parentNodeId: "Cell-01-EdgeGateway",
        schemaUuid: "a1d82f34-1122-4a55-8899-aabbccddeeff",
        schemaName: "AMRC Environmental Schema v1.2",
        status: "ONLINE",
        line: "Cleanroom Assembly",
        sparkplugAddress:
          "spBv1.0/ApexAerospace/DDATA/Cell-01-EdgeGateway/ENV-01",
      },
    ];

    return NextResponse.json({
      nodes: directoryNodes,
      devices: directoryDevices,
      stats: {
        totalRegisteredNodes: directoryNodes.length,
        totalRegisteredDevices: directoryDevices.length,
        activeSchemas: 3,
      },
    });
  } catch (error: any) {
    console.error("Factory+ Directory error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load directory" },
      { status: 500 },
    );
  }
}
