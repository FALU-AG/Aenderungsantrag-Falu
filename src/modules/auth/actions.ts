"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SAMPLE_USERS } from "./sample-users";
import { USER_COOKIE } from "./sample-identity-provider";

export async function switchPrototypeUser(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  if (!SAMPLE_USERS.some((user) => user.id === userId)) throw new Error("Unbekannter Beispielbenutzer");

  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    path: "/",
  });
  revalidatePath("/", "layout");
}
