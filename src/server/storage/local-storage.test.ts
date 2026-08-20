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
  it("weist Dateien über 20 MB ab",()=>expect(()=>validateAttachment(new File([new Uint8Array(20*1024*1024+1)],"gross.pdf",{type:"application/pdf"}))).toThrow("20 MB"));
  it("akzeptiert alle unterstützten Dokumenttypen",()=>{for(const type of ["application/pdf","image/png","image/jpeg","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])expect(()=>validateAttachment(new File(["x"],"datei",{type}))).not.toThrow();});
});
