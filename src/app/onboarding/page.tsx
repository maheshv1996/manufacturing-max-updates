import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import OnboardingWizard from "./OnboardingWizard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OnboardingPage(props: {
  searchParams?: Promise<{ reset?: string; guided?: string }>;
}) {
  const searchParams = await props.searchParams;
  const settings = await getSettings();

  if (settings.onboardingComplete && searchParams?.reset !== "true") {
    redirect("/command");
  }

  return <OnboardingWizard />;
}
