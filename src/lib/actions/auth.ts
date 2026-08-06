"use server";

import { redirect } from "next/navigation";
import { verifyOwnerPassword } from "@/lib/auth/password";
import { setOwnerSessionCookie, clearOwnerSessionCookie } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/owner");

  const valid = await verifyOwnerPassword(password);
  if (!valid) {
    return { error: "Incorrect password. Please try again." };
  }

  await setOwnerSessionCookie();
  redirect(next.startsWith("/owner") ? next : "/owner");
}

export async function logoutAction() {
  await clearOwnerSessionCookie();
  redirect("/owner/login");
}
