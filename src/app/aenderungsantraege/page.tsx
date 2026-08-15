import { redirect } from "next/navigation";

export default function LegacyRequestsPage() {
  redirect("/change-requests");
}
