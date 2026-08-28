const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma');
// convert utf16le to utf8 if it is utf16le
if (content[0] === 0xff && content[1] === 0xfe) {
    content = content.toString('utf16le');
} else {
    content = content.toString('utf8');
}

const appendStr = `
enum QuotationStatus {
  DRAFT
  SENT
  WON
  LOST
}

model Quotation {
  id              String          @id @default(cuid())
  quotationNumber String          @unique
  customerName    String
  customerEmail   String?
  customerPhone   String?
  itemName        String
  quantity        Int
  estimatedCost   Float
  marginPct       Float           @default(20)
  quotedPrice     Float
  status          QuotationStatus @default(DRAFT)
  notes           String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([status])
  @@index([customerName])
}
`;

fs.writeFileSync('prisma/schema.prisma', content + appendStr, 'utf8');
console.log('Appended Quotation to schema.prisma and saved as UTF8');
