import { createSupabaseStorageClient } from "../src/server/storage/supabase-storage";
import { checkStorageReadOnly } from "../src/server/storage/storage-diagnostics";
const environment={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY};
checkStorageReadOnly(createSupabaseStorageClient(environment),environment,console.log).catch((error:unknown)=>{console.error(error instanceof Error?error.message:"Storage check failed.");process.exitCode=1;});
