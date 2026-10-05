import { NextResponse, type NextRequest } from "next/server";
import { CLIENT_SESSION_COOKIE } from "@/lib/constants";

/**
 * Starts a fresh browsing session.
 *
 * "Browse Profiles" on the home page points here rather than straight at
 * /browse. The identity cookie lasts 30 days, so a returning visitor would
 * otherwise walk past the name-and-number gate without ever seeing it — the
 * page looked cached when in fact it was remembering. Dropping the cookie here
 * means the gate is shown every time someone starts browsing, while navigating
 * between /browse and a profile afterwards still keeps who they are.
 */
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  // 303 so the browser makes a clean GET of /browse and never replays this
  // from its own cache.
  const response = NextResponse.redirect(new URL("/browse", request.url), 303);
  response.cookies.delete(CLIENT_SESSION_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
