import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Gauge, ListTodo } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileNavigation } from "./mobile-navigation";

vi.mock("next/navigation",()=>({usePathname:()=>"/"}));
afterEach(cleanup);

describe("MobileNavigation",()=>{
  const items=[{href:"/",label:"Dashboard",icon:Gauge},{href:"/meine-aufgaben",label:"Meine Aufgaben",icon:ListTodo,count:3}];
  it("öffnet und schliesst den mobilen Drawer mit gut bedienbaren Links",()=>{render(<MobileNavigation items={items}/>);const trigger=screen.getByRole("button",{name:"Navigation öffnen"});expect(trigger).toHaveAttribute("aria-expanded","false");fireEvent.click(trigger);expect(screen.getByRole("dialog",{name:"Mobile Navigation"})).toBeInTheDocument();expect(screen.getByRole("link",{name:/Meine Aufgaben/})).toHaveClass("min-h-11");fireEvent.click(screen.getAllByRole("button",{name:"Navigation schliessen"})[0]);expect(screen.queryByRole("dialog",{name:"Mobile Navigation"})).not.toBeInTheDocument()});
});
