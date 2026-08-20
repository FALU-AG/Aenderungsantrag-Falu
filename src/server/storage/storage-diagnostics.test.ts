import {describe,expect,it,vi} from "vitest";
import {checkStorageReadOnly,classifySupabaseKey,formatStorageError,supabaseHost} from "./storage-diagnostics";
import {createSupabaseStorageClient} from "./supabase-storage";
const url="https://abc.supabase.co";
function client(error:unknown=null){const listBuckets=vi.fn(async()=>({data:error?null:[],error}));return{client:{storage:{listBuckets}}as never,listBuckets};}
describe("Supabase Storage diagnostics",()=>{
  it("accepts current sb_secret keys without JWT parsing",()=>{expect(classifySupabaseKey("sb_secret_example")).toBe("secret");expect(()=>createSupabaseStorageClient({SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:"sb_secret_example"})).not.toThrow();});
  it("accepts legacy service-role values",()=>{expect(classifySupabaseKey("eyJlegacy-service-role-value-long-enough")).toBe("legacy-service-role");expect(()=>createSupabaseStorageClient({SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:"eyJlegacy-service-role-value-long-enough"})).not.toThrow();});
  it("validates the URL and reports only its host",()=>expect(supabaseHost(url)).toBe("abc.supabase.co"));
  it("reports listBuckets success using only a read operation",async()=>{const f=client();const logs:string[]=[];await checkStorageReadOnly(f.client,{SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:"sb_secret_hidden"},(line)=>logs.push(line));expect(f.listBuckets).toHaveBeenCalledOnce();expect(logs).toEqual(["Supabase host: abc.supabase.co","Key type: secret","Storage API: reachable","Buckets readable: yes"]);expect(logs.join(" ")).not.toContain("sb_secret_hidden");});
  it.each([401,403])("reports a safe detailed %s error",async(status)=>{const secret="sb_secret_never_log_this";const f=client({status,statusCode:String(status),message:`Invalid API key ${secret}`,code:"AccessDenied"});const logs:string[]=[];await expect(checkStorageReadOnly(f.client,{SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:secret},(line)=>logs.push(line))).rejects.toThrow(new RegExp(`Status: ${status}.*Invalid API key \\[REDACTED\\].*AccessDenied`));expect(logs.join(" ")).not.toContain(secret);});
  it("formats setup errors without logging keys",()=>{const secret="sb_secret_private";const message=formatStorageError("Storage buckets could not be inspected",{statusCode:"401",message:`Invalid API key ${secret}`,name:"StorageApiError"},[secret]);expect(message).toContain("Status: 401");expect(message).toContain("Invalid API key [REDACTED]");expect(message).not.toContain(secret);});
});
