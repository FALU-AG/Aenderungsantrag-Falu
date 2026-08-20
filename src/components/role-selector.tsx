"use client";

import { useState } from "react";
import type { RoleKey } from "@/modules/auth";
import { normalizeRoles, ROLE_LABELS, selectableRoles } from "@/modules/users/domain";

export function RoleSelector({ defaultRoles }: { defaultRoles: readonly string[] }) {
  const [roles, setRoles] = useState<RoleKey[]>(() => normalizeRoles(defaultRoles));
  const employeeIsRedundant = roles.some((role) => role !== "EMPLOYEE");

  function toggle(role: RoleKey, checked: boolean) {
    setRoles((current) => {
      const next = new Set(current);
      if (checked) next.add(role);
      else next.delete(role);
      return normalizeRoles([...next]);
    });
  }

  return (
    <fieldset className="md:col-span-2">
      <legend className="mb-2 text-sm font-medium">Rollen</legend>
      <div className="flex flex-wrap gap-4">
        {selectableRoles.map((role) => {
          const disabled = role === "EMPLOYEE" && employeeIsRedundant;
          return (
            <label key={role} className={`text-sm ${disabled ? "text-slate-400" : ""}`}>
              <input
                type="checkbox"
                name="roles"
                value={role}
                checked={roles.includes(role)}
                disabled={disabled}
                onChange={(event) => toggle(role, event.target.checked)}
                className="mr-2 focus:ring-2 focus:ring-[#175f91] focus:ring-offset-2"
              />
              {ROLE_LABELS[role]}
            </label>
          );
        })}
      </div>
      {employeeIsRedundant && <p className="mt-2 text-xs text-slate-500">Mitarbeiter-Berechtigungen sind in den gewählten Rollen bereits enthalten.</p>}
    </fieldset>
  );
}
