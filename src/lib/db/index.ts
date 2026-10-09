import "server-only";

/**
 * Database access for the application.
 *
 * `crud` is the layer the data modules are written against: table-agnostic
 * select/insert/update/delete that any module can use for any table, with
 * every value bound and every identifier checked.
 *
 * `client` underneath it owns the pool and runs statements. Import from there
 * directly only for a query a generic builder cannot express — a lateral-join
 * aggregate, say — and leave a comment saying why.
 */
export * from "@/lib/db/client";
export * from "@/lib/db/crud";
