import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { generateKeyPairSync, sign, randomBytes, createHash } from "node:crypto";
const mocks=vi.hoisted(()=>({findUnique:vi.fn(),consume:vi.fn()}));
vi.mock("@/server/db/client",()=>({db:{user:{findUnique:mocks.findUnique},$transaction:async(f: (tx: unknown)=>unknown)=>f({appAssertionUse:{deleteMany:vi.fn(),create:mocks.consume}})}}));
import { proxy } from "./proxy";
const keys=generateKeyPairSync("ed25519",{privateKeyEncoding:{format:"pem",type:"pkcs8"},publicKeyEncoding:{format:"pem",type:"spki"}});
function assertion(target="/aenderungsantrag",method="GET",body=""){const now=Math.floor(Date.now()/1000);const p=Buffer.from(JSON.stringify({v:1,iss:"https://admin.falu.com",aud:"CHANGE_REQUEST",sub:"a",name:"A",roles:["EMPLOYEE"],iat:now,exp:now+15,jti:randomBytes(32).toString("hex"),method,target,bodyHash:createHash("sha256").update(body).digest("hex")})).toString("base64url");return p+"."+sign(null,Buffer.from(p,"ascii"),keys.privateKey).toString("base64url")}
beforeEach(()=>{process.env.FALU_APP_SIGNING_PUBLIC_KEY=keys.publicKey;mocks.findUnique.mockResolvedValue({id:"local-a"});mocks.consume.mockReset().mockResolvedValue({});});
describe("cryptographic origin protection",()=>{
 it("redirects anonymous direct origin despite legacy cookie and spoofed identity",async()=>{const r=await proxy(new NextRequest("https://railway.invalid/aenderungsantrag",{headers:{cookie:"falu-session=B","x-forwarded-user":"admin"}}));expect(r.status).toBe(307);expect(r.headers.get("location")).toBe("https://admin.falu.com/login?returnTo=%2Faenderungsantrag")});
 it("valid assertion accepted, old cookies stripped",async()=>{const r=await proxy(new NextRequest("https://railway.invalid/aenderungsantrag",{headers:{cookie:"falu-session=B","x-falu-assertion":assertion()}}));expect(r.status).toBe(200);expect(r.headers.get("x-middleware-request-cookie")).toBeNull()});
 it("replay rejected",async()=>{mocks.consume.mockRejectedValue(new Error("duplicate"));expect((await proxy(new NextRequest("https://railway.invalid/aenderungsantrag",{headers:{"x-falu-assertion":assertion()}}))).status).toBe(403)});
 it("request binding rejects different path",async()=>{expect((await proxy(new NextRequest("https://railway.invalid/aenderungsantrag/admin/delegations",{headers:{"x-falu-assertion":assertion()}}))).status).toBe(403)});
 it("server action without verified identity fails",async()=>{expect((await proxy(new NextRequest("https://railway.invalid/aenderungsantrag",{method:"POST",headers:{origin:"https://admin.falu.com","next-action":"forged"}}))).status).toBe(401)});
 it.each(["login","forgot-password","reset-password","change-password"])("old %s redirects centrally",async(path)=>{expect((await proxy(new NextRequest("https://railway.invalid/aenderungsantrag/"+path))).headers.get("location")).toContain("https://admin.falu.com/login")});
 it("signed provider webhook remains independently authenticated",async()=>{expect((await proxy(new NextRequest("https://railway.invalid/aenderungsantrag/api/webhooks/resend",{method:"POST"}))).status).toBe(200)});
 // The body binding is the only thing stopping a captured assertion from being reused with
 // different form content on the same path and method.
 it("request binding rejects a tampered body",async()=>{const r=await proxy(new NextRequest("https://railway.invalid/aenderungsantrag",{method:"POST",body:"decision=REJECTED",headers:{origin:"https://admin.falu.com","x-falu-assertion":assertion("/aenderungsantrag","POST","decision=APPROVED")}}));expect(r.status).toBe(403)});
 it("accepts a matching body on the same binding",async()=>{const r=await proxy(new NextRequest("https://railway.invalid/aenderungsantrag",{method:"POST",body:"decision=APPROVED",headers:{origin:"https://admin.falu.com","x-falu-assertion":assertion("/aenderungsantrag","POST","decision=APPROVED")}}));expect(r.status).toBe(200)});
 // Origin remains the CSRF boundary even once identity is proven.
 it("rejects a foreign origin despite a valid assertion",async()=>{const r=await proxy(new NextRequest("https://railway.invalid/aenderungsantrag",{method:"POST",body:"x=1",headers:{origin:"https://evil.invalid","x-falu-assertion":assertion("/aenderungsantrag","POST","x=1")}}));expect(r.status).toBe(403)});
 // The path every account without an externalId mapping takes.
 it("rejects a verified identity that is not mapped locally",async()=>{mocks.findUnique.mockResolvedValue(null);const r=await proxy(new NextRequest("https://railway.invalid/aenderungsantrag",{headers:{"x-falu-assertion":assertion()}}));expect(r.status).toBe(403)});
 // A misconfigured origin must reach the fail-closed page, not throw while building it.
 it("answers a misconfigured portal origin with a controlled 503",async()=>{const previous=process.env.FALU_PORTAL_ORIGIN;process.env.FALU_PORTAL_ORIGIN="https://admin.falu.com/portal";try{const r=await proxy(new NextRequest("https://railway.invalid/aenderungsantrag"));expect(r.status).toBe(503);expect(await r.text()).not.toContain("<a href");}finally{if(previous===undefined)delete process.env.FALU_PORTAL_ORIGIN;else process.env.FALU_PORTAL_ORIGIN=previous}});
 it("forwards the verified path but no browser cookie",async()=>{const r=await proxy(new NextRequest("https://railway.invalid/aenderungsantrag",{headers:{cookie:"falu-session=B","x-falu-assertion":assertion()}}));const overridden=(r.headers.get("x-middleware-override-headers")??"").split(",").map((name)=>name.trim());expect(overridden).toContain("x-falu-pathname");expect(overridden).not.toContain("cookie")});
});
