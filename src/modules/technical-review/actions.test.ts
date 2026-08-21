import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  transaction: vi.fn(),
  reviewFind: vi.fn(),
  reviewUpsert: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: "tech-1",
    name: "Thomas Technik",
    email: "technik@falu.test",
    roles: ["TECHNICAL"],
    permissions: ["TECHNICAL_REVIEW_EDIT"],
    mustChangePassword: false,
  })),
}));
vi.mock("@/server/db/client", () => ({
  db: {
    changeRequest: { findUniqueOrThrow: mocks.request },
    $transaction: mocks.transaction,
  },
}));

import { saveTechnicalReview } from "./actions";

describe("saveTechnicalReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.request.mockResolvedValue({
      status: "UNDER_REVIEW",
      approvalCycle: 2,
      approvals: [{ cycle: 2, status: "APPROVED" }],
      technicalReview: null,
    });
    mocks.reviewFind.mockResolvedValue(null);
    mocks.reviewUpsert.mockResolvedValue({ id: "review-1" });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        changeRequest: { findUniqueOrThrow: mocks.request },
        technicalReview: {
          findUnique: mocks.reviewFind,
          upsert: mocks.reviewUpsert,
        },
        auditEvent: { create: mocks.auditCreate },
      }),
    );
  });

  it("speichert einen Teilstand bei Technikfreigabe und noch offener AVOR-Freigabe", async () => {
    const form = new FormData();
    form.set("intent", "save");
    form.set("implementationNotes", "Erste technische Abklärung");

    await expect(saveTechnicalReview("cr-1", {}, form)).resolves.toEqual({
      success: "Technische Prüfung gespeichert.",
    });
    expect(mocks.reviewUpsert).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "TECHNICAL_REVIEW_STARTED" }),
    });
  });
});
