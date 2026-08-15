import type { Prisma } from "@prisma/client";
import { CHANGE_REQUEST_STATUSES } from "@/modules/workflow/status";

export type ListParams = Record<string, string | string[] | undefined>;
const value = (v: string | string[] | undefined) => typeof v === "string" ? v : "";

export function buildRequestListQuery(params: ListParams): { where: Prisma.ChangeRequestWhereInput; orderBy: Prisma.ChangeRequestOrderByWithRelationInput; page: number } {
  const q = value(params.q).trim(); const status = value(params.status); const year = Number(value(params.year));
  const where: Prisma.ChangeRequestWhereInput = {
    ...(q ? { OR: ["number", "title", "articleNumber", "articleDescription", "description"].map((field) => ({ [field]: { contains: q, mode: "insensitive" } })) } : {}),
    ...(value(params.machineTypeId) ? { machineTypeId: value(params.machineTypeId) } : {}),
    ...(CHANGE_REQUEST_STATUSES.includes(status as never) ? { status: status as Prisma.EnumChangeRequestStatusFilter } : {}),
    ...(value(params.applicantId) ? { applicantId: value(params.applicantId) } : {}),
    ...(value(params.reasonId) ? { reasons: { some: { changeReasonId: value(params.reasonId) } } } : {}),
    ...(year >= 2000 ? { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } } : {}),
  };
  const sortMap: Record<string, Prisma.ChangeRequestOrderByWithRelationInput> = { number: { number: "asc" }, title: { title: "asc" }, created: { createdAt: "desc" }, status: { status: "asc" }, updated: { updatedAt: "desc" } };
  return { where, orderBy: sortMap[value(params.sort)] ?? { updatedAt: "desc" }, page: Math.max(1, Number(value(params.page)) || 1) };
}
