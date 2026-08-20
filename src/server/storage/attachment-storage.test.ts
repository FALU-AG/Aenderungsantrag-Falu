import { describe,expect,it } from "vitest";
import { safeFilename,supabaseObjectKey } from "./attachment-storage";
describe("Attachment object keys",()=>{
  it("erzeugt stabile nicht erratbare Pfade mit sicherem Dateinamen",()=>expect(supabaseObjectKey("request-1","550e8400-e29b-41d4-a716-446655440000","Prüfung / Plan (final).PDF")).toBe("change-requests/request-1/550e8400-e29b-41d4-a716-446655440000/Plan-final.pdf"));
  it("entfernt Pfadanteile aus Dateinamen",()=>expect(safeFilename("../../secret?.jpg")).toBe("secret.jpg"));
});
