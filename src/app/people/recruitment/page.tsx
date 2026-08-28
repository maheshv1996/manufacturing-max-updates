import RecruitmentClient from "./RecruitmentClient";
import { UserPlus } from "lucide-react";

export const metadata = { title: "Recruitment & Onboarding" };

export default function RecruitmentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl border bg-blue-500/10 text-blue-400 border-blue-500/30">
          <UserPlus className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Recruitment & Onboarding
          </h1>
          <p className="text-sm text-slate-400">
            Job requisitions, candidate pipeline, interview scheduling, and
            onboarding checklists.
          </p>
        </div>
      </div>
      <RecruitmentClient />
    </div>
  );
}
