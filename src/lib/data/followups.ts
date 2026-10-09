import "server-only";
import { deleteMany, insertOne, selectMany } from "@/lib/db";

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
  await insertOne("client_followups", {
    client_id: input.clientId,
    note: input.note.trim(),
  });

  // Deliberately does NOT touch clients.last_activity_at. That column means
  // "the client responded"; a follow-up is us contacting them, and counting it
  // would make silent clients look engaged in the dashboard.
}

export async function listFollowupsForClient(clientId: string): Promise<ClientFollowup[]> {
  return selectMany<ClientFollowup>("client_followups", {
    where: { client_id: clientId },
    orderBy: "created_at desc",
  });
}

export async function listRecentFollowups(limit = 15): Promise<FollowupWithClient[]> {
  // Left-joined and folded into a JSON object so the caller gets `client`
  // already shaped. A generic select cannot express the join, so this one is
  // written out.
  return selectMany<FollowupWithClient>("client_followups", {
    from: "client_followups f",
    joins: "left join clients c on c.id = f.client_id",
    columns: `f.*,
              case when c.id is null then null
                   else jsonb_build_object(
                     'id', c.id,
                     'full_name', c.full_name,
                     'phone_display', c.phone_display,
                     'phone', c.phone
                   )
              end as client`,
    orderBy: "f.created_at desc",
    limit,
  });
}

export async function deleteFollowup(id: string): Promise<void> {
  await deleteMany("client_followups", { id });
}
