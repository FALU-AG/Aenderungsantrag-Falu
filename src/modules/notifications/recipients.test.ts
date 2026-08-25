import { describe, expect, it, vi } from "vitest";
import { activeRoleRecipients, explicitApprovalNotificationRoles } from "./recipients";

describe("Empfänger neuer Freigaberunden", () => {
  it.each([
    [["ADMINISTRATOR"], []], [["AVOR"], ["AVOR"]], [["TECHNICAL"], ["TECHNICAL"]],
    [["ADMINISTRATOR", "AVOR"], ["AVOR"]], [["ADMINISTRATOR", "TECHNICAL"], ["TECHNICAL"]],
    [["EMPLOYEE"], []], [["AVOR", "TECHNICAL"], ["AVOR", "TECHNICAL"]],
  ] as const)("verwendet nur explizite Fachrollen: %j", (roles, expected) => {
    expect(explicitApprovalNotificationRoles([...roles])).toEqual(expected);
  });

  it("fragt aktive Empfänger ohne Administrator-Vererbung und ohne Duplikate ab", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await activeRoleRecipients({ user: { findMany } } as never, "AVOR");
    expect(findMany).toHaveBeenCalledWith({
      where: { active: true, roles: { some: { role: { key: "AVOR" } } } },
      select: { id: true, email: true, name: true }, distinct: ["id"],
    });
  });
});
