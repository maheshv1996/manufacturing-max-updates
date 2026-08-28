import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import Gateway from "./gateway/Gateway";

export const dynamic = "force-dynamic";

export default async function GatewayPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const isLoggedIn = !!user.id || user.isOwner;

  return <Gateway initialUser={isLoggedIn ? user : null} />;
}
