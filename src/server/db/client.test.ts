import { describe, expect, it } from "vitest";
import { databaseUrlWithSafePool } from "./client";

describe("Supabase-kompatibler Prisma-Verbindungspool", () => {
  it("ergänzt eine sichere Grenze", () => expect(databaseUrlWithSafePool("postgresql://host/db")).toBe("postgresql://host/db?connection_limit=1"));
  it("behält eine explizite Grenze", () => expect(databaseUrlWithSafePool("postgresql://host/db?connection_limit=1")).toBe("postgresql://host/db?connection_limit=1"));
});
