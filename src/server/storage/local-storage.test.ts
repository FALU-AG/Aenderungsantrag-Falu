import { describe, expect, it } from "vitest";
import { validateAttachment } from "./local-storage";

describe("Foto-Anhänge", () => {
  it("verwendet für Kamerafotos dieselbe Attachment-Validierung", () => {
    expect(() =>
      validateAttachment(
        new File(["image"], "foto.jpg", { type: "image/jpeg" }),
      ),
    ).not.toThrow();
  });

  it("weist nicht erlaubte Kamera-Dateitypen ab", () => {
    expect(() =>
      validateAttachment(
        new File(["video"], "foto.webm", { type: "video/webm" }),
      ),
    ).toThrow("Dateityp nicht erlaubt");
  });
});
