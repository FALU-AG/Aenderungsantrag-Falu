import { describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/modules/auth/password";
import { createOrRecoverAdministrator, type CreateAdminDatabase } from "./create-admin";

type StoredUser = { id: string; email: string; firstName: string; lastName: string; name: string; passwordHash: string; active: boolean; mustChangePassword: boolean; roles: string[] };
function fixture(target?: Partial<StoredUser>) {
  const users: StoredUser[] = [
    { id: "demo", email: "admin@example.falu.ch", firstName: "Admin", lastName: "Falu", name: "Admin Falu", passwordHash: "demo-hash", active: true, mustChangePassword: false, roles: ["ADMINISTRATOR"] },
    ...(target ? [{ id: "target", email: "kaufmann@falu.com", firstName: "Old", lastName: "Name", name: "Old Name", passwordHash: "old-hash", active: false, mustChangePassword: false, roles: ["EMPLOYEE"], ...target }] : []),
  ];
  let sessions = target ? 3 : 0;
  const roleUpsert = vi.fn(async () => ({ id: "admin-role" }));
  const userRoleUpsert = vi.fn(async ({ where }: { where: { userId_roleId: { userId: string } } }) => { const user=users.find((item)=>item.id===where.userId_roleId.userId)!; if(!user.roles.includes("ADMINISTRATOR")) user.roles.push("ADMINISTRATOR"); });
  const tx = {
    role: { upsert: roleUpsert },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => { const user=users.find((item)=>item.email===where.email); return user ? { id:user.id, roles:user.roles.map((key)=>({role:{key}})) } : null; }),
      create: vi.fn(async ({ data }: { data: Omit<StoredUser,"id"|"roles"> }) => { const user={id:"target",roles:[] as string[],...data};users.push(user);return user; }),
      update: vi.fn(async ({ where, data }: { where:{id:string};data:Partial<StoredUser> }) => { const user=users.find((item)=>item.id===where.id)!;Object.assign(user,data);return user; }),
    },
    userRole: { upsert: userRoleUpsert },
    session: { deleteMany: vi.fn(async()=>{sessions=0;}) },
    auditEvent: { create: vi.fn(async()=>undefined) },
  };
  const db={ $transaction: vi.fn(async(operation:(client:typeof tx)=>Promise<"created"|"promoted"|"reset">)=>operation(tx)) } as unknown as CreateAdminDatabase;
  return { db, tx, users, get sessions(){return sessions;} };
}
const environment={BOOTSTRAP_ADMIN_EMAIL:" KAUFMANN@FALU.COM ",BOOTSTRAP_ADMIN_PASSWORD:"Production1!",BOOTSTRAP_ADMIN_FIRST_NAME:"Florian",BOOTSTRAP_ADMIN_LAST_NAME:"Kaufmann"};

describe("production Administrator creation",()=>{
  it("creates a new active Administrator with a hashed password",async()=>{const f=fixture();expect(await createOrRecoverAdministrator(f.db,environment)).toBe("created");const user=f.users.find((item)=>item.email==="kaufmann@falu.com")!;expect(user.roles).toContain("ADMINISTRATOR");expect(user.active).toBe(true);expect(user.mustChangePassword).toBe(true);expect(await verifyPassword(environment.BOOTSTRAP_ADMIN_PASSWORD,user.passwordHash)).toBe(true);});
  it("promotes an existing normal user while preserving roles",async()=>{const f=fixture();f.users.push({id:"target",email:"kaufmann@falu.com",firstName:"Old",lastName:"Name",name:"Old Name",passwordHash:"old",active:false,mustChangePassword:false,roles:["EMPLOYEE","TECHNICAL"]});expect(await createOrRecoverAdministrator(f.db,environment)).toBe("promoted");expect(f.users.find((u)=>u.id==="target")?.roles).toEqual(["EMPLOYEE","TECHNICAL","ADMINISTRATOR"]);});
  it("updates an existing Administrator without duplicates",async()=>{const f=fixture({roles:["EMPLOYEE","ADMINISTRATOR"],active:false});expect(await createOrRecoverAdministrator(f.db,environment)).toBe("reset");expect(f.users).toHaveLength(2);expect(f.users[1].roles.filter((role)=>role==="ADMINISTRATOR")).toHaveLength(1);expect(f.tx.userRole.upsert).toHaveBeenCalledOnce();});
  it("reactivates, requires password change, hashes password and invalidates sessions",async()=>{const f=fixture({roles:["ADMINISTRATOR"]});await createOrRecoverAdministrator(f.db,environment);const user=f.users[1];expect(user.active).toBe(true);expect(user.mustChangePassword).toBe(true);expect(await verifyPassword(environment.BOOTSTRAP_ADMIN_PASSWORD,user.passwordHash)).toBe(true);expect(f.sessions).toBe(0);expect(f.tx.session.deleteMany).toHaveBeenCalledWith({where:{userId:"target"}});});
  it.each(["BOOTSTRAP_ADMIN_EMAIL","BOOTSTRAP_ADMIN_PASSWORD","BOOTSTRAP_ADMIN_FIRST_NAME","BOOTSTRAP_ADMIN_LAST_NAME"])("rejects missing %s",async(key)=>{await expect(createOrRecoverAdministrator(fixture().db,{...environment,[key]:""})).rejects.toThrow(`${key} is required.`);});
  it("rejects a short password",async()=>{await expect(createOrRecoverAdministrator(fixture().db,{...environment,BOOTSTRAP_ADMIN_PASSWORD:"short"})).rejects.toThrow("at least 10 characters");});
  it("leaves the demo Administrator unchanged",async()=>{const f=fixture();const before={...f.users[0],roles:[...f.users[0].roles]};await createOrRecoverAdministrator(f.db,environment);expect(f.users[0]).toEqual(before);});
});
