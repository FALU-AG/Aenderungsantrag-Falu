"use client";

import type { AuthUser } from "@/modules/auth";
import { switchPrototypeUser } from "@/modules/auth/actions";
import { SAMPLE_USERS } from "@/modules/auth/sample-users";

const roleLabels: Record<string, string> = { EMPLOYEE: "Mitarbeitende", AVOR: "AVOR", TECHNICAL: "Technik", PURCHASING: "Einkauf", ADMINISTRATOR: "Administration" };

export function UserSwitcher({ currentUser }: { currentUser: AuthUser }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right lg:block">
        <p className="text-sm font-semibold text-slate-900">{currentUser.name}</p>
        <p className="text-xs text-slate-500">{currentUser.roles.map((role) => roleLabels[role]).join(" · ")}</p>
      </div>
      <form action={switchPrototypeUser}>
        <label className="sr-only" htmlFor="prototype-user">Beispielbenutzer wechseln</label>
        <select
          id="prototype-user"
          name="userId"
          defaultValue={currentUser.id}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="max-w-48 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        >
          {SAMPLE_USERS.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
      </form>
    </div>
  );
}
