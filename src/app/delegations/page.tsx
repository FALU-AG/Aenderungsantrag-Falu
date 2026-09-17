import { DelegationManager } from "@/components/delegation-manager";
import { PageHeading } from "@/components/page-heading";
import { getCurrentUser } from "@/modules/auth";
import { loadDelegationPageData } from "@/modules/delegations/query";
import { canManageOwnDelegations } from "@/modules/delegations/domain";
import { redirect } from "next/navigation";

export default async function DelegationsPage() {
  const user = await getCurrentUser();
  if (!canManageOwnDelegations(user.roles)) redirect("/");
  const data = await loadDelegationPageData(user.id);
  return <><PageHeading title="Stellvertretung" description="Zeitlich begrenzte Stellvertretung für Ihre AVOR- oder technischen Freigaben verwalten."/><DelegationManager {...data} currentUserId={user.id}/></>;
}
