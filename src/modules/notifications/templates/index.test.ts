import { describe, expect, it } from "vitest";
import { renderNotification } from ".";
describe("notification templates", () => {
  it("creates professional html and plain text with direct link", () => { const result = renderNotification("APPROVAL_REQUIRED_AVOR", "Freigabe erforderlich: CR-2026-031", { number: "CR-2026-031", title: "Riemenspanner", url: "https://app.example/change-requests/1?tab=Freigaben" }); expect(result.html).toContain("CR-2026-031"); expect(result.html).toContain("https://app.example"); expect(result.text).toContain("Freigaben"); });
  it("escapes internal values in html", () => expect(renderNotification("TASK_ASSIGNED", "Aufgabe", { detail: "<script>" }).html).not.toContain("<script>"));
});
