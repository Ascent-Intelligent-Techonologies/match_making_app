"use server";

import { redirect } from "next/navigation";
import { verifyAdminPassword } from "@/lib/auth/password";
import { setAdminSessionCookie, clearAdminSessionCookie } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // Trim to tolerate stray whitespace/newlines from copy-pasting the password.
  const password = String(formData.get("password") ?? "").trim();
  const next = String(formData.get("next") ?? "/admin");

  const valid = await verifyAdminPassword(password);
  if (!valid) {
    return { error: "Incorrect password. Please try again." };
  }

  await setAdminSessionCookie();
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
