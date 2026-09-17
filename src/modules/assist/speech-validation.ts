import "server-only";

export const MAX_SPEECH_AUDIO_BYTES = 10 * 1024 * 1024;

const SUPPORTED_SPEECH_AUDIO_TYPES = new Set([
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/mpga",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "video/webm",
]);

export function normalizeSpeechContentType(contentType: string) {
  return contentType.toLowerCase().split(";", 1)[0].trim();
}

export function isSupportedSpeechContentType(contentType: string) {
  return SUPPORTED_SPEECH_AUDIO_TYPES.has(
    normalizeSpeechContentType(contentType),
  );
}
