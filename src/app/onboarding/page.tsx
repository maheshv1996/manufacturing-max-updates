import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Rocket } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";
import OnboardingWizard from "./OnboardingWizard";

export default async function OnboardingPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.isOwner && !can(user, "system.edit")) {
    redirect("/");
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <PageHeader
        title="Welcome to Manufacturing Max"
        description="Four quick steps to set up your workspace — company identity, departments, your team, and starter data."
        icon={<Rocket className="h-6 w-6" />}
        iconTone="blue"
        badge={{ label: "FIRST RUN", tone: "new" }}
      />
      <OnboardingWizard />
    </div>
  );
}
