import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding Telugu and Hindi translations for Downtime Reasons & Defect Codes...");

  // Update Downtime Reasons
  const downtimeTranslations: Record<string, { te: string; hi: string }> = {
    "D-MECH-01": {
      te: "మోటారు / స్పిండిల్ వేడెక్కింది",
      hi: "मोटर / स्पिंडल ओवरहीट हो गया",
    },
    "D-ELEC-01": {
      te: "సెన్సార్ ప్రాబ్లం / బ్రేకర్ ట్రిప్",
      hi: "सेंसर खराब / ब्रेकर ट्रिप",
    },
    "D-MAT-01": {
      te: "రా మెటీరియల్ అయిపోయింది",
      hi: "कच्चा माल खत्म",
    },
    "D-QUAL-01": {
      te: "క్వాలిటీ ప్రాబ్లం / చెకింగ్ హోల్డ్",
      hi: "क्वालिटी चेक होल्ड",
    },
    "D-OP-01": {
      te: "షిఫ్ట్ మార్పు / టూల్ సెట్టింగ్",
      hi: "शिफ्ट चेंज / टूल सेटिंग",
    },
    "IoT Auto-Logged / Machine Fault or Idle": {
      te: "IoT ఆటో డౌన్ టైమ్",
      hi: "IoT ऑटो डाउनटाइम",
    },
  };

  for (const [code, trans] of Object.entries(downtimeTranslations)) {
    await prisma.downtimeReason.updateMany({
      where: { OR: [{ code }, { description: code }] },
      data: {
        nameTe: trans.te,
        nameHi: trans.hi,
      },
    });
  }

  // Update Defect Codes
  const defectTranslations: Record<string, { te: string; hi: string }> = {
    "DEF-SURF": {
      te: "పైన గీతలు / డెంట్",
      hi: "सतह पर खरोंच / डेंट",
    },
    "DEF-DIM": {
      te: "సైజ్ తప్పు వచ్చింది / అవుట్ ఆఫ్ సైజ్",
      hi: "साइज़ गलत / आउट ऑफ़ स्पेसिफिकेशन",
    },
    "DEF-POR": {
      te: "వెల్డింగ్ రంధ్రాలు / పోరోసిటీ",
      hi: "वेल्डिंग में सुराख / छिद्र",
    },
  };

  for (const [code, trans] of Object.entries(defectTranslations)) {
    await prisma.defectCode.updateMany({
      where: { code },
      data: {
        nameTe: trans.te,
        nameHi: trans.hi,
      },
    });
  }

  console.log("Translations seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
