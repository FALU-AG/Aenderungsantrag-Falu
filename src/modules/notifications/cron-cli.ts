export type ScheduledJobResult = { queued: number; skippedSchedule: boolean };

export async function runScheduledCommand(options: {
  job: () => Promise<ScheduledJobResult>;
  disconnect: () => Promise<unknown>;
  processedMessage: (queued: number) => string;
  failureMessage: string;
  log?: (message: string) => void;
  logError?: (message: string) => void;
}) {
  const log = options.log ?? console.log;
  const logError = options.logError ?? console.error;
  try {
    const result = await options.job();
    log(result.skippedSchedule ? "Kein geplanter Ausführungszeitpunkt." : options.processedMessage(result.queued));
    return 0;
  } catch {
    logError(options.failureMessage);
    return 1;
  } finally {
    await options.disconnect();
  }
}
