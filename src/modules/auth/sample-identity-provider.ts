import { cookies } from "next/headers";
import { DEFAULT_SAMPLE_USER, SAMPLE_USERS } from "./sample-users";
import type { IdentityProvider } from "./types";

export const USER_COOKIE = "falu-prototype-user";

export class SampleIdentityProvider implements IdentityProvider {
  async getCurrentUser() {
    const cookieStore = await cookies();
    const selectedId = cookieStore.get(USER_COOKIE)?.value;
    return SAMPLE_USERS.find((user) => user.id === selectedId) ?? DEFAULT_SAMPLE_USER;
  }
}
