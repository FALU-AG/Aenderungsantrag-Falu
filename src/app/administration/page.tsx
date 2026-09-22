import { redirect } from "next/navigation";
import { requireRole } from "@/modules/auth";
export default async function Page() { await requireRole("ADMINISTRATOR"); redirect("/admin/delegations"); }
