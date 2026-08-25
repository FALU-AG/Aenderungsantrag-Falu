import { Prisma } from "@prisma/client";
import type { NotificationInput } from "./domain";

export async function queueNotification(tx: Prisma.TransactionClient, input: NotificationInput) {
  return tx.emailNotification.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: {
      ...input,
      recipientUserId: input.recipientUserId ?? null,
      recipientName: input.recipientName ?? null,
      changeRequestId: input.changeRequestId ?? null,
      taskId: input.taskId ?? null,
      templateData: (input.templateData ?? {}) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}
