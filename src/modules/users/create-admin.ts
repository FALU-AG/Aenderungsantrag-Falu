import { hashPassword, MIN_PASSWORD_LENGTH } from "@/modules/auth/password";

export type CreateAdminEnvironment = {
  BOOTSTRAP_ADMIN_EMAIL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
  BOOTSTRAP_ADMIN_FIRST_NAME?: string;
  BOOTSTRAP_ADMIN_LAST_NAME?: string;
};

export type CreateAdminResult = "created" | "promoted" | "reset";
type UserRecord = { id: string; roles: Array<{ role: { key: string } }> };
type TransactionClient = {
  role: { upsert(args: object): Promise<{ id: string }> };
  user: {
    findUnique(args: object): Promise<UserRecord | null>;
    create(args: object): Promise<{ id: string }>;
    update(args: object): Promise<{ id: string }>;
  };
  userRole: { upsert(args: object): Promise<unknown> };
  session: { deleteMany(args: object): Promise<unknown> };
  auditEvent: { create(args: object): Promise<unknown> };
};
export type CreateAdminDatabase = {
  $transaction(operation: (tx: TransactionClient) => Promise<CreateAdminResult>): Promise<CreateAdminResult>;
};

function required(value: string | undefined, name: string) {
  if (!value?.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

export async function createOrRecoverAdministrator(
  db: CreateAdminDatabase,
  environment: CreateAdminEnvironment,
): Promise<CreateAdminResult> {
  const email = required(environment.BOOTSTRAP_ADMIN_EMAIL, "BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = required(environment.BOOTSTRAP_ADMIN_PASSWORD, "BOOTSTRAP_ADMIN_PASSWORD");
  const firstName = required(environment.BOOTSTRAP_ADMIN_FIRST_NAME, "BOOTSTRAP_ADMIN_FIRST_NAME");
  const lastName = required(environment.BOOTSTRAP_ADMIN_LAST_NAME, "BOOTSTRAP_ADMIN_LAST_NAME");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`BOOTSTRAP_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
  const passwordHash = await hashPassword(password);
  const name = `${firstName} ${lastName}`;

  return db.$transaction(async (tx) => {
    const administratorRole = await tx.role.upsert({
      where: { key: "ADMINISTRATOR" },
      update: { name: "Administrator" },
      create: { key: "ADMINISTRATOR", name: "Administrator" },
    });
    const existing = await tx.user.findUnique({
      where: { email },
      select: { id: true, roles: { select: { role: { select: { key: true } } } } },
    });
    const alreadyAdministrator = existing?.roles.some(({ role }) => role.key === "ADMINISTRATOR") ?? false;
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { firstName, lastName, name, email, passwordHash, active: true, mustChangePassword: true },
        })
      : await tx.user.create({
          data: { firstName, lastName, name, email, passwordHash, active: true, mustChangePassword: true },
        });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: administratorRole.id } },
      update: {},
      create: { userId: user.id, roleId: administratorRole.id },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditEvent.create({
      data: {
        action: "PRODUCTION_ADMINISTRATOR_CONFIGURED",
        entityType: "User",
        entityId: user.id,
        summary: `Produktiver Administrator ${name} wurde eingerichtet.`,
      },
    });
    return existing ? (alreadyAdministrator ? "reset" : "promoted") : "created";
  });
}
