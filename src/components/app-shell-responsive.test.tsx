import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation",()=>({usePathname:()=>"/"}));
vi.mock("@/modules/inbox/query",()=>({loadPersonalInbox:vi.fn(async()=>[])}));
vi.mock("@/modules/auth/actions",()=>({logout:vi.fn()}));
afterEach(cleanup);

describe("responsive AppShell",()=>{
  it("hält Desktop-Sidebar, mobilen Menütrigger, Zeit und Haupt-CTA zugänglich",async()=>{const view=await AppShell({user:{id:"u1",name:"Erika Beispiel",email:"e@falu.test",roles:["EMPLOYEE"]},children:<p>Inhalt</p>});const {container}=render(view);expect(container.querySelector("aside.hidden.md\\:block")).toBeInTheDocument();expect(screen.getByRole("button",{name:"Navigation öffnen"})).toBeInTheDocument();expect(screen.getByLabelText("Aktuelles Datum und Uhrzeit")).toBeInTheDocument();expect(screen.getByRole("link",{name:"Neuer Änderungsantrag"})).toBeInTheDocument();expect(container.querySelector("main")).toHaveClass("px-4","sm:px-6","lg:px-8","xl:px-10")});
  it("verwendet die breite Desktop-Arbeitsfläche ohne starre Breite",async()=>{const view=await AppShell({user:{id:"u1",name:"Erika Beispiel",email:"e@falu.test",roles:["EMPLOYEE"]},children:<p>Inhalt</p>});const {container}=render(view);expect(container.querySelectorAll(".max-w-\\[1600px\\]").length).toBeGreaterThanOrEqual(2)});
});
