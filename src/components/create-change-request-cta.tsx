"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";

const AUTH_PATH_PREFIXES = ["/auth", "/login", "/sign-in"];

export function shouldShowCreateRequestCta(
  pathname: string,
  canCreate: boolean,
): boolean {
  if (!canCreate || pathname === "/change-requests/new") return false;
  return !AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function CreateChangeRequestCta({ canCreate }: { canCreate: boolean }) {
  const pathname = usePathname();

  if (!shouldShowCreateRequestCta(pathname, canCreate)) return null;

  return (
    <Link
      href="/change-requests/new"
      aria-label="Neuer Änderungsantrag"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#175f91] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#124d76] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175f91] focus-visible:ring-offset-2 sm:gap-2 sm:px-4 sm:py-2.5"
    >
      <Plus className="size-4" aria-hidden="true" />
      <span className="sm:hidden">Neu</span>
      <span className="hidden sm:inline">Neuer Änderungsantrag</span>
    </Link>
  );
}
