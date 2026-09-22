import { redirect } from "next/navigation";
import { portalLogin } from "@/modules/auth/portal-config";
export default function Page() { redirect(portalLogin()); }
