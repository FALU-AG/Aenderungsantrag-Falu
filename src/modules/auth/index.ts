import { SampleIdentityProvider } from "./sample-identity-provider";

// Replace this binding with an EntraIdentityProvider without changing consumers.
const identityProvider = new SampleIdentityProvider();

export function getCurrentUser() {
  return identityProvider.getCurrentUser();
}

export type { AuthUser, IdentityProvider, RoleKey } from "./types";
