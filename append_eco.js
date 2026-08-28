const fs = require('fs');
const txt = `
enum EcoStatus {
  DRAFT
  APPROVED
  IMPLEMENTED
  REJECTED
}

enum EffectivityType {
  DATE
  SERIAL
}

enum EntityType {
  BOM
  DRAWING
  ROUTING
}

enum ActionType {
  REPLACE
  ADD
  REMOVE
}

model Eco {
  id               String          @id @default(cuid())
  ecoNumber        String          @unique
  title            String
  description      String?
  status           EcoStatus       @default(DRAFT)
  effectivityType  EffectivityType @default(DATE)
  effectivityValue String
  raisedBy         String
  approvedBy       String?
  approvedAt       DateTime?
  implementedAt    DateTime?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  items            EcoItem[]
}

model EcoItem {
  id         String     @id @default(cuid())
  ecoId      String
  eco        Eco        @relation(fields: [ecoId], references: [id], onDelete: Cascade)
  entityType EntityType
  productId  String
  product    Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  action     ActionType
  oldData    Json?
  newData    Json?
  notes      String?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  @@index([ecoId])
  @@index([productId])
}
`;
fs.appendFileSync('prisma/schema.prisma', txt);
