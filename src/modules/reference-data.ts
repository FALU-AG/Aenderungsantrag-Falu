export const MACHINE_TYPES = ["CB1", "CS-2500", "CT", "SV-2X", "BL-16", "ABS"].map((code) => ({ code, name: code, active: true }));

export const CHANGE_REASONS = [
  "Änderung eines Teils oder einer Baugruppe an einer bestehenden Maschine",
  "Verbesserung eines Bauteils oder einer Baugruppe",
  "Kundenwunsch",
  "Fehlerbehebung / konstruktiver Mangel",
  "Softwareänderung",
  "Elektrische Änderung",
  "Kostenoptimierung",
  "Änderung aufgrund Produktion / Montage",
  "Sicherheitsänderung",
  "Änderung aufgrund Service-Erfahrung",
  "Sonstiges",
].map((label, index) => ({ key: `REASON_${String(index + 1).padStart(2, "0")}`, label, isOther: label === "Sonstiges", active: true, sortOrder: index + 1 }));
