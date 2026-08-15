import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { getCurrentUser } from "@/modules/auth";
import { requirePermission } from "@/modules/authorization/permissions";
import { readAttachment } from "@/server/storage/local-storage";

export async function GET(_request: Request, { params }: RouteContext<"/change-requests/[id]/attachments/[attachmentId]">) {
  const user = await getCurrentUser(); requirePermission(user, "CHANGE_REQUEST_VIEW");
  const { id, attachmentId } = await params;
  const item = await db.attachment.findFirstOrThrow({ where: { id: attachmentId, changeRequestId: id, deletedAt: null } });
  const data = await readAttachment(item.storageKey);
  return new NextResponse(data, { headers: { "Content-Type": item.mimeType, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(item.originalName)}`, "X-Content-Type-Options": "nosniff" } });
}
