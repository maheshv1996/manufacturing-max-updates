import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FileUp } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";
import ImportWizardClient from "./ImportWizardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ImportPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.isOwner && !can(user, "system.edit")) {
    redirect("/");
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <PageHeader
        title="Import Wizard"
        description="Bulk-load master data from CSV — products, customers, suppliers and BOMs. Rows are validated live (mandatory fields, numeric formats, duplicates) and re-checked on the server before anything is written."
        icon={<FileUp className="h-6 w-6" />}
        iconTone="blue"
        badge={{ label: "ADMIN", tone: "new" }}
      />
      <ImportWizardClient />
    </div>
  );
}
