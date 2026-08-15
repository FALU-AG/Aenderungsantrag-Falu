export function submissionData(now = new Date(), cycle = 1) {
  return {
    request: { status: "UNDER_REVIEW" as const, submittedAt: now },
    approvals: [
      { type: "AVOR" as const, status: "PENDING" as const, cycle },
      { type: "TECHNICAL" as const, status: "PENDING" as const, cycle },
    ],
    audit: { action: "CHANGE_REQUEST_SUBMITTED", summary: "Änderungsantrag eingereicht" },
  };
}
