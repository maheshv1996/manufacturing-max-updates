import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders } from "@/lib/permissions";
import MyExpensesClient from "./MyExpensesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "My Expense Claims | ManufacturingMax",
};

export default async function MyExpensesPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) {
    redirect("/login");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <MyExpensesClient />
    </div>
  );
}
