export function machineTypeChangeSummary(added: string[], removed: string[]) {
  const parts = [
    added.length ? `Hinzugefügt: ${added.join(", ")}` : "",
    removed.length ? `Entfernt: ${removed.join(", ")}` : "",
  ].filter(Boolean);
  return `Maschinentypen geändert. ${parts.join(". ")}`;
}
