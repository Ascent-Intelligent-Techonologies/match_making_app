import { searchMatchCandidates } from "@/lib/data/client-matches";

/**
 * What the profile pickers on the Client match tab ask as you type: profiles
 * of one side (`side=boy` or `side=girl`) whose name or number matches `q`.
 *
 * A route rather than a server action for the same reason as the client
 * lookup next door: it is a read that can fire on every pause in typing.
 * Admin-only through the proxy, like all of /admin.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const side = params.get("side");
  if (side !== "boy" && side !== "girl") {
    return Response.json({ error: "Say which side to search." }, { status: 400 });
  }
  try {
    return Response.json(await searchMatchCandidates(params.get("q") ?? "", side));
  } catch {
    return Response.json({ error: "Could not search profiles." }, { status: 500 });
  }
}
