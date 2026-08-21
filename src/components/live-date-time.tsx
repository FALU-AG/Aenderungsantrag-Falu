"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

const fullFormatter = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const timeFormatter = new Intl.DateTimeFormat("de-CH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function LiveDateTime() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      aria-label="Aktuelles Datum und Uhrzeit"
      className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium tabular-nums text-slate-600 sm:px-3"
    >
      <Clock3 className="size-3.5" aria-hidden="true" />
      <span className="sm:hidden">{now ? timeFormatter.format(now) : "--:--"}</span>
      <span className="hidden sm:inline">
        {now ? fullFormatter.format(now) : "--.--.----, --:--"}
      </span>
    </div>
  );
}
