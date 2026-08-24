import Link from "next/link";
import { Suspense } from "react";
import { ClipboardList, Gauge, ListTodo, LogOut, Settings } from "lucide-react";
import type { AuthUser } from "@/modules/auth";
import { hasPermission } from "@/modules/authorization/permissions";
import { CreateChangeRequestCta } from "./create-change-request-cta";
import { LiveDateTime } from "./live-date-time";
import { logout } from "@/modules/auth/actions";
import { roleSummary } from "@/modules/users/domain";
import { loadPersonalInbox } from "@/modules/inbox/query";
import { MobileNavigation, type NavigationItem } from "./mobile-navigation";

const navigation = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/change-requests", label: "Änderungsanträge", icon: "change-requests" },
  { href: "/meine-aufgaben", label: "Meine Aufgaben", icon: "tasks" },
] satisfies NavigationItem[];

const navigationIcons = {
  dashboard: Gauge,
  "change-requests": ClipboardList,
  tasks: ListTodo,
  administration: Settings,
} satisfies Record<NavigationItem["icon"], typeof Gauge>;

export async function AppShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const inboxCount = (await loadPersonalInbox(user)).length;
  const items: NavigationItem[] = [...navigation.map((item) => ({...item, count: item.href === "/meine-aufgaben" ? inboxCount : undefined})), ...(user.roles.includes("ADMINISTRATOR") ? [{ href: "/admin/users", label: "Administration", icon: "administration" as const }] : [])];
  return (
    <div className="min-h-screen overflow-x-clip bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-18 w-full max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6 md:flex-nowrap lg:px-8 xl:px-10">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="Falu Change Request Startseite"
          >
            <span className="grid size-9 place-items-center rounded-md bg-[#175f91] text-sm font-bold text-white">
              F
            </span>
            <span>
              <span className="block text-sm font-bold tracking-wide text-slate-900">
                FALU AG
              </span>
              <span className="block text-xs text-slate-500">
                Change Request
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2 md:hidden">
            <MobileNavigation items={items} />
            <form action={logout}><button aria-label="Abmelden" className="grid size-11 place-items-center rounded-md border border-slate-300 text-slate-700"><LogOut className="size-4" aria-hidden="true"/></button></form>
          </div>
          <div className="order-3 flex w-full items-center justify-end gap-2 md:order-none md:w-auto md:gap-3">
            <LiveDateTime />
            <Suspense fallback={null}>
              <CreateChangeRequestCta
                canCreate={hasPermission(user, "CHANGE_REQUEST_CREATE")}
              />
            </Suspense>
            <div className="hidden text-right lg:block"><p className="text-sm font-semibold text-slate-900">{user.name}</p><p className="text-xs text-slate-500">{roleSummary(user.roles)}</p></div>
            <form action={logout} className="hidden md:block"><button className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#175f91] focus:ring-offset-2">Abmelden</button></form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-[1600px] md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white px-3 py-6 md:block md:min-h-[calc(100vh-4.5rem)] lg:px-4">
          <nav
            className="flex gap-2 overflow-x-auto lg:flex-col"
            aria-label="Hauptnavigation"
          >
            {items.map(({ href, label, icon, count }) => {
              const Icon = navigationIcons[icon];
              return (
              <Link
                key={href}
                href={href}
                className="flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                {Boolean(count) && (
                  <span className="ml-auto rounded-full bg-[#175f91] px-2 py-0.5 text-xs font-semibold text-white">
                    {count}
                  </span>
                )}
              </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 xl:px-10">{children}</main>
      </div>
    </div>
  );
}
