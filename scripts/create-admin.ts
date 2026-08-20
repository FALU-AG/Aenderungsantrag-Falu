import { PrismaClient } from "@prisma/client";
import {
  createOrRecoverAdministrator,
  type CreateAdminDatabase,
} from "../src/modules/users/create-admin";

const db = new PrismaClient();

async function main() {
  const result = await createOrRecoverAdministrator(db as unknown as CreateAdminDatabase, {
    BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    BOOTSTRAP_ADMIN_FIRST_NAME: process.env.BOOTSTRAP_ADMIN_FIRST_NAME,
    BOOTSTRAP_ADMIN_LAST_NAME: process.env.BOOTSTRAP_ADMIN_LAST_NAME,
  });
  console.log(result === "created"
    ? "Administrator account created successfully."
    : result === "promoted"
      ? "Existing user promoted to Administrator and credentials reset successfully."
      : "Existing Administrator credentials reset successfully.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Administrator creation failed.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
