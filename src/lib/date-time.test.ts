import { describe, expect, it } from "vitest";
import { formatDateTimeZurich } from "./date-time";

describe("Schweizer Zeitformatierung", () => {
  it("berücksichtigt im Sommer CEST", () => {
    expect(formatDateTimeZurich("2026-08-24T15:15:00Z")).toBe("24.08.2026, 17:15");
  });

  it("berücksichtigt im Winter CET", () => {
    expect(formatDateTimeZurich("2026-01-24T15:15:00Z")).toBe("24.01.2026, 16:15");
  });

  it("zeigt keine Sekunden an", () => {
    expect(formatDateTimeZurich("2026-08-24T15:15:42Z")).not.toContain("42");
  });
});
