export type Language = "en" | "te" | "hi";

export interface TranslationDictionary {
  [key: string]: {
    en: string;
    te: string;
    hi: string;
  };
}

export const translations: TranslationDictionary = {
  // Login & General Chrome
  loginTitle: {
    en: "Operator Terminal Login",
    te: "ఆపరేటర్ లాగిన్",
    hi: "ऑपरेटर लॉगिन",
  },
  usernameLabel: {
    en: "Employee No. / Username",
    te: "ఉద్యోగి నం. / యూజర్ నేమ్",
    hi: "कर्मचारी नं. / यूज़रनेम",
  },
  passwordLabel: {
    en: "Password",
    te: "పాస్‌వర్డ్",
    hi: "पासवर्ड",
  },
  signInBtn: {
    en: "Sign In",
    te: "లాగిన్ అవ్వండి",
    hi: "साइन इन करें",
  },
  signingIn: {
    en: "Signing in...",
    te: "లాగిన్ అవుతోంది...",
    hi: "साइन इन हो रहा है...",
  },
  invalidCredentials: {
    en: "Invalid username or password",
    te: "యూజర్ నేమ్ లేదా పాస్‌వర్డ్ తప్పు",
    hi: "गलत यूज़रनेम या पासवर्ड",
  },

  // Terminal Header & Navigation
  operatorTerminal: {
    en: "Shopfloor Operator Terminal",
    te: "షాప్‌ఫ్లోర్ ఆపరేటర్ టెర్మినల్",
    hi: "शॉपफ़्लोर ऑपरेटर टर्मिनल",
  },
  changeMachine: {
    en: "Change Machine",
    te: "మెషీన్ మార్చుకోవచ్చు",
    hi: "मशीन बदलें",
  },
  clockIn: {
    en: "Clock In",
    te: "క్లాక్ ఇన్",
    hi: "क्लॉक इन",
  },
  clockOut: {
    en: "Clock Out",
    te: "క్లాక్ అవుట్",
    hi: "क्लॉक आउट",
  },
  myRoutine: {
    en: "My Routine",
    te: "నా పనులు",
    hi: "मेरी रूटीन",
  },
  shiftHandover: {
    en: "Shift Handover",
    te: "షిఫ్ట్ మార్పు",
    hi: "शिफ्ट हैंडओवर",
  },
  changePassword: {
    en: "Change Password",
    te: "పాస్‌వర్డ్ మార్చండి",
    hi: "पासवर्ड बदलें",
  },
  logout: {
    en: "Logout",
    te: "లాగ్‌అవుట్",
    hi: "लॉगआउट",
  },

  // Action Buttons
  startJob: {
    en: "Start Job",
    te: "పని ప్రారంభించు",
    hi: "काम शुरू करें",
  },
  logOutput: {
    en: "Log Output",
    te: "పని ఎంటర్ చేయి (గుడ్/సరియైనవి)",
    hi: "आउटपुट दर्ज करें",
  },
  logGoodUnits: {
    en: "Good Units",
    te: "సరియైన పీసులు (గుడ్)",
    hi: "सही पीस (गुड)",
  },
  logScrap: {
    en: "Scrap / Reject",
    te: "కరాబైనవి (స్క్రాప్)",
    hi: "खराब माल (स्क्रैप)",
  },
  logRework: {
    en: "Rework",
    te: "తిరిగి చేసేవి (రీవర్క్)",
    hi: "दोबारा काम (रीवर्क)",
  },
  logDowntime: {
    en: "Log Downtime / Stop",
    te: "మెషీన్ ఆగిపోయింది (డౌన్‌టైమ్)",
    hi: "मशीन बंद (डाउनटाइम)",
  },
  requestMaintenance: {
    en: "Request Maintenance",
    te: "మెయింటెనెన్స్ కావాలి",
    hi: "मेंटेनेंस बुलाएं",
  },
  viewDrawing: {
    en: "View Drawing / SOP",
    te: "డ్రాయింగ్ / సూచనలు చూడండి",
    hi: "ड्राइंग / एसओपी देखें",
  },
  moveMaterial: {
    en: "Move Material",
    te: "సామాను పంపండి",
    hi: "सामान भेजें",
  },

  // Modals & Labels
  enterGoodQty: {
    en: "Enter Good Quantity",
    te: "సరియైన పీసుల సంఖ్య ఇవ్వండి",
    hi: "सही पीस की संख्या दर्ज करें",
  },
  enterScrapQty: {
    en: "Enter Scrap Quantity",
    te: "కరాబైన పీసుల సంఖ్య ఇవ్వండి",
    hi: "खराब पीस की संख्या दर्ज करें",
  },
  selectDefectCode: {
    en: "Select Defect Cause",
    te: "ఎందుకు కరాబైందో ఎంచుకోండి",
    hi: "खराबी का कारण चुनें",
  },
  selectDowntimeReason: {
    en: "Select Downtime Reason",
    te: "మెషీన్ ఎందుకు ఆగిందో ఎంచుకోండి",
    hi: "मशीन रुकने का कारण चुनें",
  },
  notesOptional: {
    en: "Notes (Optional)",
    te: "వివరాలు (అవసరమైతే)",
    hi: "विवरण (ऐच्छिक)",
  },
  cancel: {
    en: "Cancel",
    te: "క్యాన్సిల్",
    hi: "रद्द करें",
  },
  submit: {
    en: "Submit",
    te: "సబ్‌మిట్ చేయండి",
    hi: "सबमिट करें",
  },
  saving: {
    en: "Saving...",
    te: "సేవ్ అవుతోంది...",
    hi: "सेव हो रहा है...",
  },

  // Safety Gate & Certification Warnings
  safetyGateStopTitle: {
    en: "STOP: Safety Gate",
    te: "ఆగండి: సేఫ్టీ గేట్",
    hi: "रुकें: सेफ्टी गेट",
  },
  safetyGateNotCertifiedMsg: {
    en: "Safety Gate: You are not certified to operate this machine. Contact your supervisor.",
    te: "సేఫ్టీ గేట్: మీరు ఈ మెషీన్ ఉపయోగించడానికి సర్టిఫై అవ్వలేదు. సూపర్‌వైజర్‌ని సంప్రదించండి.",
    hi: "सेफ्टी गेट: आप इस मशीन को चलाने के लिए सर्टिफाइड नहीं हैं। सुपरवाइजर से संपर्क करें।",
  },
  certExpiredMsg: {
    en: "Safety Gate: Your certification to operate this machine has EXPIRED. Contact your supervisor.",
    te: "సేఫ్టీ గేట్: ఈ మెషీన్ నడపడానికి మీ సర్టిఫికేషన్ కాలపరిమితి పూర్తయింది. సూపర్‌వైజర్‌ని సంప్రదించండి.",
    hi: "सेफ्टी गेट: इस मशीन को चलाने का आपका सर्टिफिकेश समाप्त हो गया है। सुपरवाइजर से संपर्क करें।",
  },
  certExpiringSoonWarn: {
    en: "Certification Warning: Your certification for this machine expires soon. Please arrange renewal.",
    te: "సర్టిఫికేషన్ హెచ్చరిక: ఈ మెషీన్ సర్టిఫికేషన్ త్వరలో పూర్తవుతుంది. దయచేసి రీన్యూ చేసుకోండి.",
    hi: "प्रमाणपत्र चेतावनी: इस मशीन के लिए आपका प्रमाणपत्र जल्द ही समाप्त हो रहा है। कृपया रिन्यू कराएं।",
  },
  certBlockedToast: {
    en: "Action blocked: You are not certified to operate this machine.",
    te: "పని ఆపబడింది: ఈ మెషీన్ నడపడానికి మీకు అనుమతి/సర్టిఫికేషన్ లేదు.",
    hi: "कार्य रोक दिया गया: आप इस मशीन को चलाने के लिए सर्टिफाइड नहीं हैं।",
  },

  // Status Labels
  machineRunning: {
    en: "RUNNING",
    te: "మెషీన్ నడుస్తోంది",
    hi: "मशीन चालू है",
  },
  machineIdle: {
    en: "IDLE",
    te: "ఖాళీగా ఉంది",
    hi: "खाली है",
  },
  machineSetup: {
    en: "SETUP",
    te: "సెటప్ జరుగుతోంది",
    hi: "सेटअप चल रहा है",
  },
  machineDowntime: {
    en: "DOWNTIME",
    te: "మెషీన్ ఆగింది",
    hi: "मशीन बंद है",
  },
  targetQty: {
    en: "Target Quantity",
    te: "లక్ష్యం (టార్గెట్)",
    hi: "लक्ष्य (टारगेट)",
  },
  producedQty: {
    en: "Produced So Far",
    te: "ఇప్పటివరకు చేసినవి",
    hi: "अब तक बना सामान",
  },
  activeWorkOrder: {
    en: "Active Work Order",
    te: "ప్రస్తుత పని (వర్క్ ఆర్డర్)",
    hi: "वर्तमान काम (वर्क ऑर्डर)",
  },
  noActiveWorkOrder: {
    en: "No Active Work Order",
    te: "ప్రస్తుతం ఏ పని లేదు",
    hi: "कोई सक्रिय काम नहीं है",
  },

  // Bill of Materials (ECO-Effective)
  bomQtyPerUnit: {
    en: "Qty / Unit",
    te: "ఒక్కో యూనిట్‌కు పరిమాణం",
    hi: "प्रति यूनिट मात्रा",
  },
  bomRequired: {
    en: "Required",
    te: "అవసరమైన పరిమాణం",
    hi: "आवश्यक मात्रा",
  },
  bomStock: {
    en: "Stock",
    te: "స్టాక్",
    hi: "स्टॉक",
  },
  effectivityPendingTitle: {
    en: "ECO Effectivity Pending — Serial Not Scanned",
    te: "ECO ప్రభావం కోసం సీరియల్ స్కాన్ చేయాలి",
    hi: "ECO प्रभावशीलता के लिए सीरियल स्कैन करें",
  },
  effectivityPendingMsg: {
    en: "A serial-gated ECO applies to this work order. Showing the pre-ECO list until you scan or enter the serial number being worked.",
    te: "ఈ వర్క్ ఆర్డర్‌కు సీరియల్ ఆధారిత ECO వర్తిస్తుంది. పని చేస్తున్న సీరియల్ నంబర్ స్కాన్ చేసే వరకు ECOకి ముందు జాబితా చూపబడుతుంది.",
    hi: "इस वर्क ऑर्डर पर सीरियल-आधारित ECO लागू है। सीरियल नंबर स्कैन/दर्ज करने तक ECO से पहले की सूची दिखाई जा रही है।",
  },
};

/**
 * Get translated string for a key based on active language.
 * Resolution order: language arg -> localStorage 'operator_lang' -> 'en'.
 */
export function getTranslation(key: string, lang?: Language): string {
  let activeLang: Language = lang || "en";

  if (!lang && typeof window !== "undefined") {
    const saved = localStorage.getItem("operator_lang") as Language;
    if (saved && ["en", "te", "hi"].includes(saved)) {
      activeLang = saved;
    }
  }

  const dict = translations[key];
  if (!dict) return key;

  return dict[activeLang] || dict.en || key;
}

export const t = getTranslation;
