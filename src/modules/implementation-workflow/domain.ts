import type { ChangeRequestStatus } from "@prisma/client";
export function statusWhenImplementationReviewStarts(
  currentStatus: string,
): ChangeRequestStatus {
  return currentStatus === "APPROVED_FOR_IMPLEMENTATION"
    ? "AVOR_PRODUCTION_PREPARATION"
    : (currentStatus as ChangeRequestStatus);
}
export function statusWhenImplementationReviewsComplete(
  currentStatus: string,
  technicalCompleted: boolean,
  avorCompleted: boolean,
): ChangeRequestStatus {
  return technicalCompleted &&
    avorCompleted &&
    (currentStatus === "APPROVED_FOR_IMPLEMENTATION" ||
      currentStatus === "AVOR_PRODUCTION_PREPARATION")
    ? "PURCHASING_PROCUREMENT"
    : (currentStatus as ChangeRequestStatus);
}
export function shouldWriteStatusTransition(
  currentStatus: string,
  nextStatus: string,
) {
  return currentStatus !== nextStatus;
}
