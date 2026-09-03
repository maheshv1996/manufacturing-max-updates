import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import KanbanBoardClient from "./KanbanBoardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Shopfloor Visual Kanban Board | ManufacturingMax",
};

export default async function KanbanPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ops/kanban");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <KanbanBoardClient />
    </div>
  );
}
