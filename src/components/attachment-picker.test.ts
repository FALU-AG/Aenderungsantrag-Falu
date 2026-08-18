import { describe, expect, it } from "vitest";
import {
  isImagePreviewable,
  removePreviewAt,
  type Preview,
} from "./attachment-picker";

describe("Attachment-Vorschau", () => {
  it("erkennt Kamerafotos als Bildvorschau", () => {
    expect(
      isImagePreviewable(
        new File(["image"], "foto.jpg", { type: "image/jpeg" }),
      ),
    ).toBe(true);
    expect(
      isImagePreviewable(
        new File(["pdf"], "plan.pdf", { type: "application/pdf" }),
      ),
    ).toBe(false);
  });

  it("entfernt nur die ausgewählte Vorschau", () => {
    const previews = [
      { file: new File(["a"], "a.jpg", { type: "image/jpeg" }) },
      { file: new File(["b"], "b.jpg", { type: "image/jpeg" }) },
    ] satisfies Preview[];
    expect(removePreviewAt(previews, 0).map((item) => item.file.name)).toEqual([
      "b.jpg",
    ]);
  });
});
