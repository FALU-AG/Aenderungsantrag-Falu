import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign, randomBytes, createHash } from "node:crypto";
const mocks=vi.hoisted(()=>({headers:vi.fn(),findUnique:vi.fn()}));
vi.mock("next/headers",()=>({headers:mocks.headers}));
vi.mock("@/server/db/client",()=>({db:{user:{findUnique:mocks.findUnique}}}));
import { getSessionUser } from "./session";
const keys=generateKeyPairSync("ed25519",{privateKeyEncoding:{format:"pem",type:"pkcs8"},publicKeyEncoding:{format:"pem",type:"spki"}});
function token(overrides:Record<string,unknown>={}){const now=Math.floor(Date.now()/1000);const payload=Buffer.from(JSON.stringify({v:1,iss:"https://admin.falu.com",aud:"CHANGE_REQUEST",sub:"central-A",name:"Portal A",roles:["EMPLOYEE"],iat:now,exp:now+15,jti:randomBytes(32).toString("hex"),method:"GET",target:"/aenderungsantrag",bodyHash:createHash("sha256").update("").digest("hex"),...overrides})).toString("base64url");return payload+"."+sign(null,Buffer.from(payload,"ascii"),keys.privateKey).toString("base64url")}
beforeEach(()=>{process.env.FALU_APP_SIGNING_PUBLIC_KEY=keys.publicKey;mocks.findUnique.mockReset().mockResolvedValue({id:"local-A",email:"historical@example.invalid"});});
describe("central identity only",()=>{
 it("ignores legacy B cookie and returns A using stable externalId",async()=>{mocks.headers.mockResolvedValue(new Headers({cookie:"falu-session=old-B","x-falu-assertion":token()}));expect(await getSessionUser()).toMatchObject({id:"local-A",centralId:"central-A",name:"Portal A",roles:["EMPLOYEE"]});expect(mocks.findUnique).toHaveBeenCalledWith({where:{externalId:"central-A"},select:{id:true,email:true}})});
 it("legacy cookie alone never authenticates",async()=>{mocks.headers.mockResolvedValue(new Headers({cookie:"falu-session=old-B"}));expect(await getSessionUser()).toBeNull();expect(mocks.findUnique).not.toHaveBeenCalled()});
 it.each([{roles:["AVOR"]},{roles:["TECHNICAL"]},{roles:["AVOR","TECHNICAL","ADMINISTRATOR"]}])("uses exactly central app roles %j",async(claims)=>{mocks.headers.mockResolvedValue(new Headers({"x-falu-assertion":token(claims)}));expect((await getSessionUser())?.roles).toEqual(claims.roles)});
 it.each([{aud:"CUSTOMER_SERVICE"},{iss:"https://evil.invalid"},{exp:1},{roles:["ADMIN"]},{roles:[]}])("rejects invalid claims %j",async(claims)=>{mocks.headers.mockResolvedValue(new Headers({"x-falu-assertion":token(claims)}));expect(await getSessionUser()).toBeNull()});
 it("rejects unmapped users without email fallback",async()=>{mocks.headers.mockResolvedValue(new Headers({"x-falu-assertion":token()}));mocks.findUnique.mockResolvedValue(null);expect(await getSessionUser()).toBeNull()});
 it("rejects tampered identity",async()=>{mocks.headers.mockResolvedValue(new Headers({"x-falu-assertion":"forged"}));expect(await getSessionUser()).toBeNull()});
});
