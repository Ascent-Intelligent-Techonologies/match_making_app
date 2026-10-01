import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { CLIENT_SESSION_COOKIE } from "@/lib/constants";

const CLIENT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET environment variable must be set to a long random string.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Identifies the client browsing the public site.
 *
 * Signed rather than storing a bare id, so a visitor cannot point the cookie
 * at someone else's client record and read their shortlist.
 */
export async function setClientSessionCookie(clientId: string): Promise<void> {
  const token = await new SignJWT({ clientId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CLIENT_SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());

  const store = await cookies();
  store.set(CLIENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CLIENT_SESSION_TTL_SECONDS,
  });
}

export async function getBrowsingClientId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(CLIENT_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.clientId === "string" ? payload.clientId : null;
  } catch {
    return null;
  }
}

export async function clearClientSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CLIENT_SESSION_COOKIE);
}
