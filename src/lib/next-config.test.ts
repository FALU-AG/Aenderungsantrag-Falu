import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Next.js reverse-proxy configuration", () => {
  it("keeps the application base path", () => {
    expect(nextConfig.basePath).toBe("/aenderungsantrag");
  });

  it("allows only the known public admin origin for Server Actions", () => {
    const origins = nextConfig.experimental?.serverActions && typeof nextConfig.experimental.serverActions === "object"
      ? nextConfig.experimental.serverActions.allowedOrigins
      : undefined;

    expect(origins).toEqual(["admin.falu.com"]);
    expect(origins).not.toContain("*");
    expect(origins?.some((origin) => origin.includes("railway.app") || origin.includes("localhost"))).toBe(false);
  });

  it("preserves the attachment request body limit", () => {
    const serverActions = nextConfig.experimental?.serverActions;
    expect(serverActions && typeof serverActions === "object" ? serverActions.bodySizeLimit : undefined).toBe("21mb");
  });
});
