/**
 * Which commit this copy of the site was built from.
 *
 * The deploy waits on this: App Service keeps serving the old version until the
 * new one has started (a minute or more), so "the site answers" says nothing
 * about whether the push has landed. Public on purpose, and harmless: it is
 * only a commit hash. "dev" outside the pipeline, where no hash is set.
 */
export function GET() {
  return Response.json(
    { sha: process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
