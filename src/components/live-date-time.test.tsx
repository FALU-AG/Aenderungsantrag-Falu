import { act, cleanup, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveDateTime } from "./live-date-time";

describe("LiveDateTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T09:12:00+02:00"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rendert de-CH-Datum und 24-Stunden-Zeit ohne Sekunden", () => {
    render(<LiveDateTime />);
    const display = screen.getByLabelText("Aktuelles Datum und Uhrzeit");
    expect(display).toHaveTextContent("21.08.2026, 09:12");
    expect(display).not.toHaveTextContent("09:12:00");
  });

  it("aktualisiert den Wert automatisch und räumt das Intervall auf", () => {
    const clearInterval = vi.spyOn(window, "clearInterval");
    const { unmount } = render(<LiveDateTime />);
    vi.setSystemTime(new Date("2026-08-21T09:13:00+02:00"));
    act(() => vi.advanceTimersByTime(30_000));
    expect(
      screen.getByLabelText("Aktuelles Datum und Uhrzeit"),
    ).toHaveTextContent("09:13");
    unmount();
    expect(clearInterval).toHaveBeenCalledOnce();
  });

  it("verwendet identisches SSR- und erstes Client-Markup ohne Hydration-Warnung", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<LiveDateTime />);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, <LiveDateTime />);
    });
    expect(
      consoleError.mock.calls.some((call) =>
        call.some((value) => String(value).toLowerCase().includes("hydration")),
      ),
    ).toBe(false);
    await act(async () => root.unmount());
  });

  it("liefert auf Mobile nur die kompakte Zeitdarstellung", () => {
    render(<LiveDateTime />);
    expect(screen.getByText("09:12", { exact: true })).toHaveClass("sm:hidden");
    expect(screen.getByText("21.08.2026, 09:12", { exact: true })).toHaveClass(
      "hidden",
      "sm:inline",
    );
  });
});
