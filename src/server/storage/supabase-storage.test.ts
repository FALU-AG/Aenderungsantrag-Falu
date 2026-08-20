import { describe,expect,it,vi } from "vitest";
import { downloadSupabaseObject,removeSupabaseObject,uploadSupabaseObject } from "./supabase-storage";
function client(result:Record<string,unknown>){const bucket={upload:vi.fn(async()=>result),download:vi.fn(async()=>result),remove:vi.fn(async()=>result)};return {client:{storage:{from:vi.fn(()=>bucket)}} as never,bucket};}
describe("Supabase Storage adapter",()=>{
  it("lädt binäre Daten privat hoch",async()=>{const f=client({error:null});await uploadSupabaseObject(f.client,"key",Buffer.from("data"),"application/pdf");expect(f.bucket.upload).toHaveBeenCalledWith("key",expect.any(Buffer),{contentType:"application/pdf",upsert:false});});
  it("meldet Storage-Uploadfehler sicher",async()=>{await expect(uploadSupabaseObject(client({error:{message:"secret detail"}}).client,"key",Buffer.from("x"),"image/png")).rejects.toThrow("Datei konnte nicht hochgeladen werden");});
  it("lädt authentifiziert über den Serveradapter",async()=>{const blob=new Blob(["file"]);const f=client({data:blob,error:null});expect((await downloadSupabaseObject(f.client,"key")).toString()).toBe("file");expect(f.bucket.download).toHaveBeenCalledWith("key");});
  it("entfernt das Storage-Objekt",async()=>{const f=client({error:null});await removeSupabaseObject(f.client,"key");expect(f.bucket.remove).toHaveBeenCalledWith(["key"]);});
});
