import type { Prisma, PrismaClient } from "@prisma/client";

export type AuditInput = {
  changeRequestId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  details?: Prisma.InputJsonValue;
};

type AuditClient = Pick<PrismaClient, "auditEvent">;

export async function recordAuditEvent(client: AuditClient, input: AuditInput) {
  return client.auditEvent.create({ data: input });
}

// Future mutations should use this helper so the business change and audit event commit atomically.
export async function withAudit<T>(
  prisma: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<{ result: T; audit: AuditInput }>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const { result, audit } = await operation(tx);
    await recordAuditEvent(tx as unknown as AuditClient, audit);
    return result;
  });
}
