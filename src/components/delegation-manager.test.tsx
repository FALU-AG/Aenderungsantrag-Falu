import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/modules/delegations/actions", () => ({ createDelegation: vi.fn(), updateDelegation: vi.fn(), cancelDelegation: vi.fn() }));
import { DelegationManager } from "./delegation-manager";

const owners = [{ id: "owner", name: "Florian Kaufmann", scopes: ["AVOR_APPROVAL" as const] }];
const users = [{ id: "owner", name: "Florian Kaufmann" }, { id: "sub", name: "Max Bodmer" }];
describe("DelegationManager", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-18T12:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("renders create controls and active delegation status", () => {
    render(<DelegationManager currentUserId="owner" owners={owners} users={users} delegations={[{ id:"d1", delegatingUserId:"owner", substituteUserId:"sub", scope:"AVOR_APPROVAL", startsAt:new Date("2026-09-17T00:00:00Z"), endsAt:new Date("2026-09-20T00:00:00Z"), enabled:true, delegatingUser:users[0], substituteUser:users[1] }]}/>);
    expect(screen.getByRole("heading",{name:"Stellvertretung erstellen"})).toBeInTheDocument();
    expect(screen.getByText("Florian Kaufmann → Max Bodmer")).toBeInTheDocument();
    expect(screen.getByText("Aktiv")).toBeInTheDocument();
  });
  it("offers the administrative owner selector", () => { render(<DelegationManager currentUserId="admin" owners={owners} users={users} delegations={[]} admin/>); expect(screen.getByLabelText("Delegierende Person")).toBeInTheDocument(); });
});
