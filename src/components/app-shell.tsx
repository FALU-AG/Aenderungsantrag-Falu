import Link from "next/link";
import { ClipboardList, Gauge, ListTodo, Settings } from "lucide-react";
import type { AuthUser } from "@/modules/auth";
import { UserSwitcher } from "./user-switcher";

const navigation = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/aenderungsantraege", label: "Änderungsanträge", icon: ClipboardList },
  { href: "/meine-aufgaben", label: "Meine Aufgaben", icon: ListTodo },
  { href: "/administration", label: "Administration", icon: Settings },
];

export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-18 max-w-[1500px] items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Falu Change Request Startseite">
            <span className="grid size-9 place-items-center rounded-md bg-[#175f91] text-sm font-bold text-white">F</span>
            <span><span className="block text-sm font-bold tracking-wide text-slate-900">FALU AG</span><span className="block text-xs text-slate-500">Change Request</span></span>
          </Link>
          <UserSwitcher currentUser={user} />
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:min-h-[calc(100vh-4.5rem)] lg:border-r lg:border-b-0 lg:py-7">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Hauptnavigation">
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950">
                <Icon className="size-4" aria-hidden="true" />{label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 px-5 py-7 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
