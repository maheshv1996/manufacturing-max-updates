import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders } from "@/lib/permissions";
import MyPayslipsClient from "./MyPayslipsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "My Payslips | ManufacturingMax",
};

export default async function MyPayslipsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    redirect("/login");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <MyPayslipsClient />
    </div>
  );
}