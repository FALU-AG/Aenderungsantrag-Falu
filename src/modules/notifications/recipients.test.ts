vi.mock("@/modules/auth/directory",()=>({centralUsers:vi.fn().mockResolvedValue([{id:"avor",roles:[{role:{key:"AVOR"}}]},{id:"admin",roles:[{role:{key:"ADMINISTRATOR"}}]}])}));
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
    expect(await activeRoleRecipients({ user: { findMany } } as never, "AVOR")).toEqual([{id:"avor",roles:[{role:{key:"AVOR"}}]}]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
