import "server-only";
import { insertOne, selectMany } from "@/lib/db";

export interface ClientSearch {
  id: string;
  client_id: string;
  filters: Record<string, string>;
  result_count: number | null;
  created_at: string;
}

export async function recordClientSearch(input: {
  clientId: string;
  filters: Record<string, string>;
  resultCount: number;
}): Promise<void> {
  await insertOne("client_searches", {
    client_id: input.clientId,
    filters: JSON.stringify(input.filters),
    result_count: input.resultCount,
  });
}

export async function listClientSearches(
  clientId: string,
  limit = 25
): Promise<ClientSearch[]> {
  return selectMany<ClientSearch>("client_searches", {
    where: { client_id: clientId },
    orderBy: "created_at desc",
    limit,
  });
}
