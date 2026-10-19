import { NextResponse } from "next/server";
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

export function GET() {
  // 303 so the browser makes a clean GET of /browse and never replays this
  // from its own cache.
  //
  // The Location is relative on purpose. Behind App Service, a route
  // handler's `request.url` is built from the address the Node process
  // listens on — 0.0.0.0:8080 — not the public host, so
  // `new URL("/browse", request.url)` sent families to a server that does
  // not exist. A relative Location is resolved by the browser against the
  // page it asked for, which is the only origin that is guaranteed right,
  // and it leaves nothing for a forged Host header to redirect to.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/browse", "Cache-Control": "no-store" },
  });
  response.cookies.delete(CLIENT_SESSION_COOKIE);
  return response;
}
