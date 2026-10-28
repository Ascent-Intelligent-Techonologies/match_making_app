import { searchClients } from "@/lib/data/clients";

/**
 * What the client pickers ask as you type: clients whose name or number
 * matches `q`, up to a screenful, and whether there were more.
 *
 * A route rather than a server action because it is a read that can fire on
 * every pause in typing, and an action would queue behind (and hold up) any
 * page navigation in flight. Admin-only through the proxy, like all of /admin.
 */
export async function GET(request: Request) {
  const text = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return Response.json(await searchClients(text));
  } catch {
    return Response.json({ error: "Could not search clients." }, { status: 500 });
  }
}
