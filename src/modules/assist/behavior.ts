export function applyAcceptedSuggestion(
  original: string,
  suggestion: string,
  accepted: boolean,
) {
  return accepted ? suggestion : original;
}

export const microphoneAccessMessage =
  "Mikrofonzugriff wurde nicht erlaubt. Sie können den Text weiterhin manuell eingeben.";

export const microphoneUnsupportedMessage =
  "Spracheingabe wird von diesem Browser nicht unterstützt. Sie können den Text weiterhin manuell eingeben.";

export function appendTranscription(original: string, transcription: string) {
  return [original.trim(), transcription.trim()].filter(Boolean).join(" ");
}

export function recordingFileName(contentType: string) {
  const normalized = contentType.toLowerCase().split(";", 1)[0].trim();
  const extension =
    normalized === "audio/ogg"
      ? "ogg"
      : normalized === "audio/mp4" || normalized === "video/mp4"
        ? "mp4"
        : normalized === "audio/mpeg" || normalized === "audio/mp3"
          ? "mp3"
          : normalized === "audio/wav"
            ? "wav"
            : "webm";
  return `aufnahme.${extension}`;
}

export function safeSpeechClientErrorDetails(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError" };
  return {
    name: error.name,
    message: error.message
      .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
      .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
      .slice(0, 500),
  };
}
