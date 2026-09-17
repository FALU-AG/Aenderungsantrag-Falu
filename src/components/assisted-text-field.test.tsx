import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/assist/actions", () => ({
  formulateText: vi.fn(),
  transcribeSpeech: vi.fn(),
}));

import { transcribeSpeech } from "@/modules/assist/actions";
import { AssistedTextField } from "./assisted-text-field";

class TestMediaRecorder {
  static emptyRecording = false;
  readonly mimeType = "audio/webm";
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(readonly stream: MediaStream) {}

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    if (!TestMediaRecorder.emptyRecording) {
      this.ondataavailable?.({
        data: new Blob(["audio"], { type: this.mimeType }),
      } as BlobEvent);
    }
    this.onstop?.();
  }
}

const stopTrack = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
const getUserMedia = vi.fn();

describe("AssistedTextField Spracheingabe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestMediaRecorder.emptyRecording = false;
    getUserMedia.mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal("MediaRecorder", TestMediaRecorder);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("zeichnet auf, transkribiert und erhält bestehenden Feldinhalt", async () => {
    let resolveTranscription: (value: { text: string }) => void = () => undefined;
    vi.mocked(transcribeSpeech).mockReturnValue(
      new Promise((resolve) => {
        resolveTranscription = resolve;
      }),
    );
    const user = userEvent.setup();
    render(
      <AssistedTextField
        name="description"
        label="Beschreibung"
        defaultValue="Bestehender Text."
        multiline
      />,
    );

    await user.click(screen.getByRole("button", { name: "Spracheingabe" }));
    expect(screen.getByRole("status")).toHaveTextContent("Aufnahme läuft…");
    await user.click(screen.getByRole("button", { name: "Aufnahme stoppen" }));
    expect(screen.getByRole("button", { name: "Wird transkribiert…" })).toBeDisabled();

    resolveTranscription({ text: "Neue Spracheingabe." });
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Beschreibung" })).toHaveValue(
        "Bestehender Text. Neue Spracheingabe.",
      ),
    );
    expect(stopTrack).toHaveBeenCalled();
  });

  it("zeigt Provider- und Netzwerkfehler auf Deutsch", async () => {
    vi.mocked(transcribeSpeech).mockResolvedValue({
      message: "Die Spracheingabe konnte nicht verarbeitet werden.",
    });
    const user = userEvent.setup();
    render(<AssistedTextField name="title" label="Titel" />);
    await user.click(screen.getByRole("button", { name: "Spracheingabe" }));
    await user.click(screen.getByRole("button", { name: "Aufnahme stoppen" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Die Spracheingabe konnte nicht verarbeitet werden.",
    );
  });

  it("erklärt verweigerten Mikrofonzugriff", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const user = userEvent.setup();
    render(<AssistedTextField name="title" label="Titel" />);
    await user.click(screen.getByRole("button", { name: "Spracheingabe" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Mikrofonzugriff wurde nicht erlaubt.",
    );
  });

  it("sendet leere Aufnahmen nicht an den Server", async () => {
    TestMediaRecorder.emptyRecording = true;
    render(<AssistedTextField name="title" label="Titel" />);
    fireEvent.click(screen.getByRole("button", { name: "Spracheingabe" }));
    await screen.findByRole("button", { name: "Aufnahme stoppen" });
    fireEvent.click(screen.getByRole("button", { name: "Aufnahme stoppen" }));
    expect(screen.getByRole("status")).toHaveTextContent("Die Aufnahme ist leer.");
    expect(transcribeSpeech).not.toHaveBeenCalled();
  });
});
