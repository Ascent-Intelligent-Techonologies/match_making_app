import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { OWNER_SESSION_COOKIE } from "@/lib/constants";

async function hasValidOwnerSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(OWNER_SESSION_COOKIE)?.value;
  if (!token) return false;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.role === "owner";
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedPage = pathname.startsWith("/owner") && pathname !== "/owner/login";
  const isProtectedApi =
    pathname.startsWith("/api/profiles") || pathname.startsWith("/api/share-links");

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const authenticated = await hasValidOwnerSession(request);
  if (authenticated) {
    return NextResponse.next();
  }

  if (isProtectedApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/owner/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/owner/:path*", "/api/profiles/:path*", "/api/share-links/:path*"],
};
