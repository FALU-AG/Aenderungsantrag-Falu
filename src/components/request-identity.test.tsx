import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RequestIdentity } from "./request-identity";

afterEach(cleanup);
describe("RequestIdentity", () => {
  it("zeigt Ersteller, Antragsteller und Erstellzeit getrennt", () => {
    render(<dl><RequestIdentity creatorName="Florian Kaufmann" applicantName="Marc Wyss" createdAt="20.08.2026, 08:23" /></dl>);
    expect(screen.getByText("Erstellt von")).toBeInTheDocument();
    expect(screen.getByText("Florian Kaufmann")).toBeInTheDocument();
    expect(screen.getByText("Antragsteller")).toBeInTheDocument();
    expect(screen.getByText("Marc Wyss")).toBeInTheDocument();
    expect(screen.getByText("20.08.2026, 08:23")).toBeInTheDocument();
  });
});
