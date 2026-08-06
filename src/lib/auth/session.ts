import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { OWNER_SESSION_COOKIE } from "@/lib/constants";

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET environment variable must be set to a long random string."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createOwnerSessionToken(): Promise<string> {
  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyOwnerSessionToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.role === "owner";
  } catch {
    return false;
  }
}

/** Reads and validates the owner session cookie from a Server Component/Action. */
export async function isOwnerAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(OWNER_SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifyOwnerSessionToken(token);
}

export async function setOwnerSessionCookie() {
  const token = await createOwnerSessionToken();
  const store = await cookies();
  store.set(OWNER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearOwnerSessionCookie() {
  const store = await cookies();
  store.delete(OWNER_SESSION_COOKIE);
}
