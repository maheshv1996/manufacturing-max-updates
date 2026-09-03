"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Sparkles,
  Zap,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface IndustryContent {
  name: string;
  shortName: string;
  step1: {
    title: string;
    speech: string;
    hint: string;
  };
  step2: {
    title: string;
    speech: string;
    hint: string;
  };
  step3: {
    title: string;
    speech: string;
    hint: string;
  };
  step4: {
    title: string;
    speech: string;
    hint: string;
  };
  faqs: {
    q: string;
    a: string;
  }[];
}

const INDUSTRY_DATA: Record<string, IndustryContent> = {
  aerospace: {
    name: "Aerospace & Defense",
    shortName: "Aerospace",
    step1: {
      title: "Aerospace Identity & AS9100D Standard",
      speech:
        "For aerospace & defense manufacturing, AS9100 Rev D is the global benchmark. It enforces strict raw material melt-lot traceability, AS9102 First Article Inspection (FAI), and Nadcap special process controls for high-temperature superalloys.",
      hint: "💡 Enter your registered company legal name and GSTIN to ensure batch travelers, FAI packages, and CMM reports display audit-ready headers.",
    },
    step2: {
      title: "Aerospace Department Architecture",
      speech:
        "Select the modules you need for your plant. Aerospace machine shops typically operate CNC Machining, AS9100D Quality, Engineering, Supply Chain, Metrology (CMM), and Tool Room.",
      hint: "💡 You have full control — toggle any department on or off to tailor operator kiosk menus to your shop's structure.",
    },
    step3: {
      title: "Aerospace Shift Handovers",
      speech:
        "Aerospace machining runs best with synchronized shifts and a 15-minute handover buffer so tool wear offsets, fixture calibrations, and work-in-progress are verified before operator swaps.",
      hint: "💡 Clear shift boundaries prevent work order count discrepancies and ensure accurate OEE availability calculation.",
    },
    step4: {
      title: "Aerospace CNC Workcenters",
      speech:
        "Register your primary CNC milling and turning centers with their realistic ideal cycle times. This enables AURA to begin tracking live OEE, spindle utilization, and cycle variance immediately.",
      hint: "💡 Ideal cycle time is critical for OEE performance rating. 60s is standard for precision structural aerospace brackets.",
    },
    faqs: [
      {
        q: "Why is AS9100 Rev D critical?",
        a: "AS9100 Rev D mandates strict raw-material heat lot traceability and AS9102 First Article Inspection. It qualifies your machine shop for tier-1 aerospace defense contracts.",
      },
      {
        q: "How does cycle time impact OEE?",
        a: "Ideal Cycle Time sets the benchmark. If a Haas VF-2 takes 75s instead of 60s, OEE Performance drops from 100% to 80%, alerting supervisors of tool wear or sub-optimal feed rates.",
      },
    ],
  },
  cnc: {
    name: "Precision CNC Machining",
    shortName: "Precision CNC",
    step1: {
      title: "Precision CNC & ISO 9001 Standard",
      speech:
        "For precision CNC milling and turning shops, ISO 9001 with Lean Six Sigma optimizes spindle utilization, tool wear monitoring, and setup time reduction.",
      hint: "💡 Enter your registered business name and tax ID to ensure setup sheets, work orders, and routing sheets display clean, professional headers.",
    },
    step2: {
      title: "CNC Machine Shop Departments",
      speech:
        "Choose the operational modules that match your facility. CNC shops commonly utilize Operations, Engineering, Quality, Tool Crib & Metrology to keep tool life and finite scheduling connected.",
      hint: "💡 Select only the departments your plant uses. You can always activate additional modules later from System Settings.",
    },
    step3: {
      title: "CNC Spindle Runtime Shifts",
      speech:
        "Maximizing spindle runtime requires consistent shift handovers. Logging operator changeover notes prevents duplicate setup adjustments and unrecorded idle time.",
      hint: "💡 Set your actual shop working hours to ensure scheduled downtime and break times are factored accurately into OEE availability.",
    },
    step4: {
      title: "CNC Milling & Turning Centers",
      speech:
        "Register your active CNC machines (milling, turning, wire EDM) with their target cycle times so tablets on the shopfloor can count parts and report OEE in real time.",
      hint: "💡 Accurate ideal cycle times allow AURA to automatically distinguish between micro-stoppages and planned changeovers.",
    },
    faqs: [
      {
        q: "How does live tool wear monitoring reduce scrap?",
        a: "AURA tracks spindle load spikes and cut duration. When tool wear exceeds 80%, operators receive proactive alerts to replace carbide inserts before dimensional drift causes scrap.",
      },
      {
        q: "What is finite capacity scheduling?",
        a: "Unlike infinite MRP, finite scheduling locks jobs based on real spindle availability, fixture changeover time, and tooling readiness.",
      },
    ],
  },
  automotive: {
    name: "Automotive & Mobility",
    shortName: "Automotive",
    step1: {
      title: "Automotive Identity & IATF 16949 Standard",
      speech:
        "For automotive tier-1/tier-2 suppliers, IATF 16949 emphasizes defect prevention, PPAP Level 3 documentation, and automated poka-yoke defect containment.",
      hint: "💡 Enter your company legal entity name and GSTIN to ensure PPAP packages and control plans display verified OEM supplier identification.",
    },
    step2: {
      title: "Automotive Production Departments",
      speech:
        "Select the modules needed for your automotive lines. High-volume manufacturing typically relies on Operations, Quality, Preventive Maintenance, and Supply Chain.",
      hint: "💡 You have complete freedom to choose which departments are visible to line supervisors and machine operators.",
    },
    step3: {
      title: "Automotive Line Shift Rosters",
      speech:
        "Automotive machining and assembly lines require strict shift boundaries to track hourly output against customer takt time.",
      hint: "💡 Align your shifts with your actual shift handover windows to maintain seamless line balancing.",
    },
    step4: {
      title: "Automotive Production Workcells",
      speech:
        "Register your production machines or automated cells. Linking them with planned takt times enables instant bottleneck identification on digital andon boards.",
      hint: "💡 Setting ideal takt times allows AURA to calculate line efficiency and alert teams to micro-stoppages.",
    },
    faqs: [
      {
        q: "Why is PPAP Level 3 required?",
        a: "PPAP Level 3 includes full design records, process flow diagrams, PFMEA, dimensional results, and initial process capability (Cpk >= 1.67) required by automotive OEMs.",
      },
      {
        q: "How does takt-time tracking improve OEE?",
        a: "Comparing actual cycle time against customer takt time instantly highlights micro-stoppages and feeding delays across the line.",
      },
    ],
  },
  fabrication: {
    name: "Heavy Fabrication & Vessels",
    shortName: "Fabrication",
    step1: {
      title: "Heavy Fabrication & ASME Standard",
      speech:
        "For heavy fabrication and pressure vessel manufacturers, ASME Section VIII and AWS D1.1 enforce welder qualifications (WPQR), welding procedure specifications (WPS), and non-destructive testing (NDT).",
      hint: "💡 Enter your manufacturer identity so Mill Test Certificates (MTC) and hydrostatic test reports show legally compliant manufacturer records.",
    },
    step2: {
      title: "Fabrication Operational Modules",
      speech:
        "Choose the modules your plant requires. Structural fabrication facilities typically activate Operations, Welding Quality/NDT, Engineering/Nesting, Supply, and EHS.",
      hint: "💡 Select only the areas your workshop actively manages. Custom departments can be added whenever needed.",
    },
    step3: {
      title: "Fabrication Shift Schedules",
      speech:
        "Fabrication facilities benefit from clear shift definitions to facilitate welder booth allocations and daily hot-work safety sign-offs.",
      hint: "💡 Configure your shift hours to match plant shift handovers and safety check windows.",
    },
    step4: {
      title: "Fabrication Stations & Welding Bays",
      speech:
        "Register your cutting, bending, and welding workcenters to begin tracking machine utilization and job order progress across bays.",
      hint: "💡 Preloaded stations allow tracking fabrication throughput and plate nesting utilization.",
    },
    faqs: [
      {
        q: "What are WPQR and WPS welder records?",
        a: "A Welding Procedure Specification (WPS) defines welding parameters, while Procedure Qualification Records (WPQR) prove welder certification for high-pressure joints.",
      },
      {
        q: "How are NDT ultrasonic inspections logged?",
        a: "AURA logs joint weld IDs, radiographic films, and ultrasonic test pass/fail results directly against the vessel batch traveler.",
      },
    ],
  },
  medical: {
    name: "Medical Devices & Implants",
    shortName: "Medical",
    step1: {
      title: "Medical Implants & ISO 13485 Standard",
      speech:
        "For orthopedic, surgical, and dental implant manufacturing, ISO 13485 and FDA 21 CFR Part 820 require bio-compatible raw material genealogy and cleanroom Device History Records (DHR).",
      hint: "💡 Enter your verified company legal name and registration details to ensure DHR traveler documents satisfy regulatory submission audits.",
    },
    step2: {
      title: "Medical Cleanroom Departments",
      speech:
        "Select the modules appropriate for your facility. Medical manufacturers typically select Operations, Cleanroom Quality, Metrology (sub-micron CMM), Tooling, and R&D.",
      hint: "💡 Tailor the department selection to match your cleanroom and machine shop workflow.",
    },
    step3: {
      title: "Cleanroom Shift Protocols",
      speech:
        "Cleanroom operations require structured shift intervals to accommodate mandatory gowning, sanitization, and room air particulate monitoring intervals.",
      hint: "💡 Setting shift windows ensures air pressure and environmental logs are timed with operator changes.",
    },
    step4: {
      title: "Medical Swiss Lathes & Implant Centers",
      speech:
        "Register your Swiss-type micro-lathes and 5-axis implant machining centers to track micron-level precision and cycle stability.",
      hint: "💡 Setting cycle benchmarks allows AURA to audit precision repeatability across surgical implant lots.",
    },
    faqs: [
      {
        q: "What is a Device History Record (DHR)?",
        a: "A DHR contains complete manufacturing traceability, raw material certifications, sterilization records, and QA release signatures for every medical implant lot.",
      },
      {
        q: "How is bio-compatible material lot genealogy audited?",
        a: "Every bar of medical-grade Ti-6Al-4V ELI is tracked from melt heat number to final laser-etched serial number on the surgical implant.",
      },
    ],
  },
  custom: {
    name: "Custom / Multi-Domain Enterprise",
    shortName: "Enterprise",
    step1: {
      title: "Enterprise Identity & Quality Standards",
      speech:
        "For custom discrete manufacturing, ISO 9001:2015 provides a solid framework for flexible job routing, capacity planning, and configurable quality gates.",
      hint: "💡 Enter your registered business name and tax number to brand your production travelers and invoices.",
    },
    step2: {
      title: "Department Architecture",
      speech:
        "Select whichever operational modules fit your organization. You can enable any combination of Operations, Quality, Engineering, Supply, Maintenance, and Finance.",
      hint: "💡 Choose the exact departments your team needs right now. You can add or toggle modules anytime.",
    },
    step3: {
      title: "Production Shift Structure",
      speech:
        "Configure your facility's regular working hours and shift handovers to establish an accurate availability baseline for OEE calculations.",
      hint: "💡 Setting realistic shift hours ensures machine downtime is accurately segregated from planned idle time.",
    },
    step4: {
      title: "Workstations & Machinery",
      speech:
        "Register your shopfloor workcenters and machines. Setting baseline cycle times allows digital tablets to immediately capture live operational throughput.",
      hint: "💡 Workcenters can connect via zero-sensor operator tablets or automated machine telemetry.",
    },
    faqs: [
      {
        q: "How do custom operational departments work?",
        a: "You can add custom departments with their own workflows, document approvals, and role permissions at any time.",
      },
      {
        q: "Can I modify my quality standards later?",
        a: "Yes, quality gate templates, inspection checklists, and compliance standards can be reconfigured under System Settings.",
      },
    ],
  },
};

interface AuraOnboardingAssistantProps {
  currentStep: number;
  selectedIndustry?: string;
}

export default function AuraOnboardingAssistant({
  currentStep,
  selectedIndustry = "aerospace",
}: AuraOnboardingAssistantProps) {
  const [activeModel, setActiveModel] = useState<string>("Local Workstation Core");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/system/ai")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.config?.model) {
          setActiveModel(d.config.model.toUpperCase());
        }
      })
      .catch(() => {});
  }, []);

  const ind = INDUSTRY_DATA[selectedIndustry] || INDUSTRY_DATA.aerospace;

  const getStepGuidance = () => {
    switch (currentStep) {
      case 1:
        return ind.step1;
      case 2:
        return ind.step2;
      case 3:
        return ind.step3;
      case 4:
        return ind.step4;
      default:
        return {
          title: "Factory Setup",
          speech: "I am actively monitoring your configuration and ready to assist.",
          hint: "Follow the steps on the left to configure your factory profile.",
        };
    }
  };

  const guidance = getStepGuidance();

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-cyan-500/30 p-5 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header with Avatar, Active Brain Badge and Industry Badge */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white tracking-tight">AURA Copilot</h3>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                ACTIVE
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Brain: <strong className="text-slate-300">{activeModel}</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-[11px] text-cyan-400 font-mono bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
            <Sparkles className="w-3 h-3" />
            <span>Step {currentStep}</span>
          </div>
          <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
            {ind.shortName}
          </span>
        </div>
      </div>

      {/* Guidance Content */}
      <div className="mt-4 space-y-3">
        <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-xs text-slate-200 leading-relaxed shadow-sm">
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span>{guidance.title}</span>
          </div>
          <p className="text-slate-300">{guidance.speech}</p>

          {guidance.hint && (
            <div className="mt-2.5 pt-2 border-t border-slate-700/60 text-[11px] text-slate-400">
              {guidance.hint}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Industry-Specific Micro-FAQ */}
      {ind.faqs && ind.faqs.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            <span>{ind.shortName} Insights from AURA</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            {ind.faqs.map((faq, idx) => {
              const isExpanded = expandedFaq === idx;
              return (
                <div key={idx}>
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                    className="w-full text-left flex items-center justify-between text-slate-300 hover:text-white py-1 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3 shrink-0 ml-1" />
                    ) : (
                      <ChevronDown className="w-3 h-3 shrink-0 ml-1" />
                    )}
                  </button>
                  {isExpanded && (
                    <p className="text-slate-400 pl-2 pb-1 border-l border-cyan-500/40 text-[10.5px] leading-relaxed">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
