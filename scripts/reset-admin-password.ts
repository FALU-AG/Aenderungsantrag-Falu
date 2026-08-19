import { PrismaClient } from "@prisma/client";
import { resetAdministratorPassword } from "../src/modules/users/reset-admin-password";

const db = new PrismaClient();

async function main() {
  await resetAdministratorPassword(db, {
    BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  });
  console.log("Administrator password reset successfully.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Administrator password reset failed.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
