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
