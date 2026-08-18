export function applyAcceptedSuggestion(
  original: string,
  suggestion: string,
  accepted: boolean,
) {
  return accepted ? suggestion : original;
}

export const microphoneAccessMessage =
  "Mikrofonzugriff wurde nicht erlaubt. Sie können den Text weiterhin manuell eingeben.";
