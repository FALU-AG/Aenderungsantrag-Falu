import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const administrators = await db.user.findMany({
    where: {
      roles: {
        some: {
          role: { key: "ADMINISTRATOR" },
        },
      },
    },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      active: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
  });

  if (administrators.length === 0) {
    console.log("No Administrator accounts found.");
    return;
  }

  console.table(administrators);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Administrator listing failed.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
