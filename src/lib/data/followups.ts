import "server-only";
import { execute, query } from "@/lib/db";

export interface ClientFollowup {
  id: string;
  client_id: string;
  note: string;
  created_at: string;
}

export interface FollowupWithClient extends ClientFollowup {
  client: { id: string; full_name: string; phone_display: string | null; phone: string } | null;
}

export async function addFollowup(input: {
  clientId: string;
  note: string;
}): Promise<void> {
  await execute("insert into client_followups (client_id, note) values ($1, $2)", [
    input.clientId,
    input.note.trim(),
  ]);

  // Deliberately does NOT touch clients.last_activity_at. That column means
  // "the client responded"; a follow-up is us contacting them, and counting it
  // would make silent clients look engaged in the dashboard.
}

export async function listFollowupsForClient(clientId: string): Promise<ClientFollowup[]> {
  return query<ClientFollowup>(
    "select * from client_followups where client_id = $1 order by created_at desc",
    [clientId]
  );
}

export async function listRecentFollowups(limit = 15): Promise<FollowupWithClient[]> {
  // A left join rather than an inner one: a follow-up whose client was deleted
  // is still worth showing, with the client shown as unknown.
  return query<FollowupWithClient>(
    `select f.*,
            case when c.id is null then null
                 else jsonb_build_object(
                   'id', c.id,
                   'full_name', c.full_name,
                   'phone_display', c.phone_display,
                   'phone', c.phone
                 )
            end as client
       from client_followups f
       left join clients c on c.id = f.client_id
      order by f.created_at desc
      limit $1`,
    [limit]
  );
}

export async function deleteFollowup(id: string): Promise<void> {
  await execute("delete from client_followups where id = $1", [id]);
}
