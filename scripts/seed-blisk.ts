import "dotenv/config";
import { prisma } from "../src/lib/prisma";
async function main(){
  const existing = await (prisma as any).customEntity.findUnique({ where: { slug: "titanium_blisk_cell" } });
  if (existing) {
    console.log("Already exists:", existing.slug);
    return;
  }
  const entity = await (prisma as any).customEntity.create({
    data: {
      slug: "titanium_blisk_cell",
      title: "Titanium Blisk Cell",
      description: "5-Axis blisk milling cell — demo infinite entity",
      icon: "Layers",
      colorTone: "violet",
      fields: {
        create: [
          { key: "blisk_serial", label: "Blisk Serial", fieldType: "text", required: true, placeholder: "BLK-001", sortOrder: 0 },
          { key: "coating_microns", label: "Coating (µm)", fieldType: "number", required: false, placeholder: "12.5", sortOrder: 1 },
        ]
      }
    },
    include: { fields: true }
  });
  console.log("Created:", entity.slug, entity.id, entity.fields.map((f:any)=>f.key).join(","));
  const rec = await (prisma as any).customRecord.create({
    data: {
      entityId: entity.id,
      values: { blisk_serial: "BLK-001", coating_microns: 12.5 },
      createdBy: "seed"
    }
  });
  console.log("Demo record:", rec.id);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e); process.exit(1)});
