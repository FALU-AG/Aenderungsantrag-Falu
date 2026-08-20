import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export function databaseUrlWithSafePool(url: string | undefined): string | undefined {
  if (!url || /(?:\?|&)connection_limit=\d+/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
}

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: databaseUrlWithSafePool(process.env.DATABASE_URL) });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
