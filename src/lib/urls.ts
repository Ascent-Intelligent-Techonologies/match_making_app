/**
 * The origin the public sees, for building absolute redirects.
 *
 * Behind App Service a route handler's `request.url` is built from the
 * address the Node process listens on — 0.0.0.0:8080 — not from the public
 * host, and Next's production server also rewrites a relative Location
 * header against that same internal URL. So neither `request.url` nor a
 * relative redirect can be trusted to reach the browser intact.
 *
 * NEXT_PUBLIC_SITE_URL is the configured answer and is used first: it is
 * exactly "the public base URL" the rest of the app already builds share
 * links from, and nothing a client sends can change it. The forwarded host
 * is the fallback for a deployment that has not set it, and `request.url`
 * the fallback for local development.
 */
export function publicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

/** An absolute URL on the public origin, for `NextResponse.redirect`. */
export function publicUrl(path: string, request: Request): URL {
  return new URL(path, publicOrigin(request) + "/");
}
