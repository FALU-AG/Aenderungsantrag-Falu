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
        currentCycle={1}
        requestStatus="UNDER_REVIEW"
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
        currentCycle={1}
        requestStatus="UNDER_REVIEW"
        canDecide={false}
      />,
    );
    expect(
      screen.queryByText("✓ Technische Bearbeitung kann beginnen"),
    ).not.toBeInTheDocument();
  });
  it("blendet nach einer Ablehnung die Aktionen aus und erklärt die beendete Runde", () => {
    render(<ApprovalCard requestId="cr-1" type="AVOR" status="PENDING" cycle={2} currentCycle={2} requestStatus="CHANGES_REQUESTED" canDecide />);
    expect(screen.queryByRole("button", { name: "Freigeben" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ablehnen" })).not.toBeInTheDocument();
    expect(screen.getByText("Freigaberunde beendet")).toBeInTheDocument();
    expect(screen.getByText(/muss zuerst überarbeitet und erneut eingereicht werden/)).toBeInTheDocument();
  });

  it("macht die beiden neuen Freigaben nach Wiedereinreichung wieder bedienbar", () => {
    const { rerender } = render(<ApprovalCard requestId="cr-1" type="AVOR" status="PENDING" cycle={3} currentCycle={3} requestStatus="UNDER_REVIEW" canDecide />);
    expect(screen.getByRole("button", { name: "Freigeben" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ablehnen" })).toBeInTheDocument();
    rerender(<ApprovalCard requestId="cr-1" type="TECHNICAL" status="PENDING" cycle={3} currentCycle={3} requestStatus="UNDER_REVIEW" canDecide />);
    expect(screen.getByRole("button", { name: "Freigeben" })).toBeInTheDocument();
  });
});
