"use client";

import Link from "next/link";
import { ClipboardList, Gauge, ListTodo, Menu, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";

export type NavigationIcon = "dashboard" | "change-requests" | "tasks" | "administration";
export type NavigationItem = { href: string; label: string; icon: NavigationIcon; count?: number };

const navigationIcons = {
  dashboard: Gauge,
  "change-requests": ClipboardList,
  tasks: ListTodo,
  administration: Settings,
} satisfies Record<NavigationIcon, typeof Gauge>;

export function MobileNavigation({ items }: { items: NavigationItem[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <div className="md:hidden"><button type="button" aria-label="Navigation öffnen" aria-expanded={open} onClick={()=>setOpen(true)} className="grid size-11 place-items-center rounded-md border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#175f91]"><Menu className="size-5" aria-hidden="true"/></button>{open&&<div className="fixed inset-0 z-50"><button type="button" aria-label="Navigation schliessen" className="absolute inset-0 bg-slate-950/40" onClick={()=>setOpen(false)}/><aside role="dialog" aria-modal="true" aria-label="Mobile Navigation" className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col bg-white shadow-xl"><div className="flex h-18 items-center justify-between border-b px-4"><p className="font-semibold">Navigation</p><button type="button" aria-label="Navigation schliessen" onClick={()=>setOpen(false)} className="grid size-11 place-items-center rounded-md hover:bg-slate-100"><X className="size-5" aria-hidden="true"/></button></div><nav className="space-y-1 overflow-y-auto p-3">{items.map(({href,label,icon,count})=>{const Icon=navigationIcons[icon];return <Link key={href} href={href} onClick={()=>setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"><Icon className="size-5 text-slate-500" aria-hidden="true"/><span>{label}</span>{Boolean(count)&&<span className="ml-auto rounded-full bg-[#175f91] px-2 py-0.5 text-xs font-semibold text-white">{count}</span>}</Link>})}</nav></aside></div>}</div>;
}
