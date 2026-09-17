import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RequestWorkflowNavigation } from "./request-workflow-navigation";

afterEach(cleanup);

const stages = [
  { tab: "Übersicht", state: "COMPLETED" },
  { tab: "Freigaben", state: "REJECTED" },
  { tab: "Technische Prüfung", state: "NOT_STARTED" },
  { tab: "AVOR", state: "NOT_STARTED" },
  { tab: "Einkauf", state: "NOT_REQUIRED" },
  { tab: "Abschlussprüfung", state: "NOT_STARTED" },
] as const;

describe("RequestWorkflowNavigation", () => {
  it("trennt Workflowstufen semantisch von zusätzlichen Bereichen", () => {
    render(
      <RequestWorkflowNavigation activeTab="Freigaben" stages={[...stages]} />,
    );
    const workflow = screen.getByRole("navigation", {
      name: "Workflow des Änderungsantrags",
    });
    const additional = screen.getByRole("navigation", {
      name: "Weitere Bereiche des Änderungsantrags",
    });
    expect(within(workflow).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "1ÜbersichtAbgeschlossen",
      "2FreigabenÜberarbeitung erforderlich",
      "3Technische PrüfungNoch nicht gestartet",
      "4AVORNoch nicht gestartet",
      "5EinkaufNicht erforderlich",
      "6AbschlussprüfungNoch nicht gestartet",
    ]);
    expect(within(additional).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Aufgaben",
      "Anhänge",
      "Kommentare",
      "Historie",
    ]);
  });

  it("zeigt Status nicht nur farblich und markiert den aktiven Tab", () => {
    render(
      <RequestWorkflowNavigation activeTab="Freigaben" stages={[...stages]} />,
    );
    expect(screen.getByText("Überarbeitung erforderlich")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Freigaben/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("nutzt mobil gestapelte Touch-Ziele und ab Tablet ein Workflow-Raster", () => {
    const { container } = render(
      <RequestWorkflowNavigation activeTab="Übersicht" stages={[...stages]} />,
    );
    expect(
      screen.getByRole("navigation", {
        name: "Workflow des Änderungsantrags",
      }),
    ).toHaveClass("grid", "md:grid-cols-3", "xl:grid-cols-6");
    expect(container.querySelectorAll("a.min-h-14")).toHaveLength(6);
  });
});
