import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSupportedSpeechContentType,
  normalizeSpeechContentType,
} from "./speech-validation";

describe("Speech input transport validation", () => {
  it.each([
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/ogg",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ])("accepts MediaRecorder type %s", (contentType) => {
    expect(isSupportedSpeechContentType(contentType)).toBe(true);
  });

  it("normalizes codec parameters without weakening the media allowlist", () => {
    expect(normalizeSpeechContentType(" Audio/WebM; codecs=opus ")).toBe(
      "audio/webm",
    );
    expect(isSupportedSpeechContentType("application/octet-stream")).toBe(false);
    expect(isSupportedSpeechContentType("text/plain")).toBe(false);
  });

  it("keeps the use-server module limited to async runtime exports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/assist/actions.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/^export const /m);
    expect(source).not.toMatch(/^export (?:class|let|var) /m);
    expect(source).toContain("export async function transcribeSpeech");
  });
});
