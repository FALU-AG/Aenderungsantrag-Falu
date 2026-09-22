/** Shared by the harness and the tests, so neither has to import the other's side effects. */
export const centralId = (localId: string) => `central-${localId}`;
