import { redirect } from "next/navigation";
import { DelegationManager } from "@/components/delegation-manager";
import { PageHeading } from "@/components/page-heading";
import { getCurrentUser } from "@/modules/auth";
import { loadDelegationPageData } from "@/modules/delegations/query";

export default async function AdminDelegationsPage() {
  const user = await getCurrentUser();
  if (!user.roles.includes("ADMINISTRATOR")) redirect("/");
  const data = await loadDelegationPageData(user.id, true);
  return <><PageHeading title="Stellvertretungen" description="Freigabestellvertretungen aller aktiven Benutzer einsehen und verwalten."/><DelegationManager {...data} currentUserId={user.id} admin/></>;
}
