import "server-only";
import { execute, query } from "@/lib/db";

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
  await execute(
    `insert into client_searches (client_id, filters, result_count) values ($1, $2, $3)`,
    [input.clientId, JSON.stringify(input.filters), input.resultCount]
  );
}

export async function listClientSearches(
  clientId: string,
  limit = 25
): Promise<ClientSearch[]> {
  return query<ClientSearch>(
    `select * from client_searches
      where client_id = $1
      order by created_at desc
      limit $2`,
    [clientId, limit]
  );
}
