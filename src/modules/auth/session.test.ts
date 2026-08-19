import { describe, expect, it } from "vitest";
import { hashSessionToken } from "./session";
describe("Sessions", () => { it("persistiert nicht den Klartext-Token", () => { const token="geheimer-zufaelliger-token"; const hashed=hashSessionToken(token); expect(hashed).not.toBe(token); expect(hashed).toHaveLength(64); }); });
