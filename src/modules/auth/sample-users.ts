import type { AuthUser } from "./types";

export const SAMPLE_USERS: AuthUser[] = [
  { id: "sample-max-muster", name: "Max Muster", email: "max.muster@example.falu.ch", roles: ["EMPLOYEE"] },
  { id: "sample-anna-avor", name: "Anna AVOR", email: "anna.avor@example.falu.ch", roles: ["EMPLOYEE", "AVOR"] },
  { id: "sample-thomas-technik", name: "Thomas Technik", email: "thomas.technik@example.falu.ch", roles: ["EMPLOYEE", "TECHNICAL"] },
  { id: "sample-petra-einkauf", name: "Petra Einkauf", email: "petra.einkauf@example.falu.ch", roles: ["EMPLOYEE", "PURCHASING"] },
  { id: "sample-admin-falu", name: "Admin Falu", email: "admin@example.falu.ch", roles: ["ADMINISTRATOR"] },
];

export const DEFAULT_SAMPLE_USER = SAMPLE_USERS[0];
