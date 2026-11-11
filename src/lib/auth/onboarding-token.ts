import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { SELF_ONBOARD_TOKEN_TTL_SECONDS } from "@/lib/constants";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET environment variable must be set to a long random string.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * What lets the person who just submitted the public form attach photos to
 * the draft that submission created, and nothing else.
 *
 * There are no accounts on the public form, so this signed token is the only
 * thing tying the upload calls to the profile they belong to. It names one
 * profile, expires in a few hours, and carries a `purpose` so a token minted
 * here can never pass as an admin session or a browsing client's (those read
 * other claims, and the secret is shared).
 */
export async function signOnboardingToken(profileId: string): Promise<string> {
  return new SignJWT({ purpose: "onboarding", profileId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SELF_ONBOARD_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/** The profile id the token was issued for, or null if it is missing, forged or expired. */
export async function verifyOnboardingToken(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2000) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "onboarding") return null;
    return typeof payload.profileId === "string" ? payload.profileId : null;
  } catch {
    return null;
  }
}
