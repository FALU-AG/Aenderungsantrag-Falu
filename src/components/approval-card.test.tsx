import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApprovalCard } from "./approval-card";

vi.mock("@/modules/approvals/actions", () => ({
  decideApproval: vi.fn(),
}));

describe("ApprovalCard", () => {
  it("zeigt die frühe technische Arbeitsfreigabe nur bei genehmigter Technikfreigabe", () => {
    const { rerender } = render(
      <ApprovalCard
        requestId="cr-1"
        type="TECHNICAL"
        status="APPROVED"
        cycle={1}
        canDecide={false}
      />,
    );
    expect(
      screen.getByText("✓ Technische Bearbeitung kann beginnen"),
    ).toBeInTheDocument();

    rerender(
      <ApprovalCard
        requestId="cr-1"
        type="AVOR"
        status="PENDING"
        cycle={1}
        canDecide={false}
      />,
    );
    expect(
      screen.queryByText("✓ Technische Bearbeitung kann beginnen"),
    ).not.toBeInTheDocument();
  });
});
