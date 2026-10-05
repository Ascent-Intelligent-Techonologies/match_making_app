import Link from "next/link";
import { ArrowLeft, Download, FileWarning } from "lucide-react";
import { listJourneyMedia } from "@/lib/data/journey";
import { JourneyUploader } from "@/components/JourneyUploader";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { deleteJourneyMediaAction } from "@/lib/actions/journey";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Journey | AnuRupa Admin" };

export default async function JourneyPage() {
  const media = await listJourneyMedia();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-maroon-700/70 hover:text-maroon-700"
        >
          <ArrowLeft size={15} /> Back
        </Link>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Journey</h1>
        <p className="max-w-2xl text-sm text-ink-900/60">
          Photos and videos from the matches we have made. {media.length} item
          {media.length === 1 ? "" : "s"}.
        </p>
      </div>

      <JourneyUploader />

      {media.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gold-400/40 bg-white/40 p-10 text-center text-sm text-ink-900/50">
          Nothing uploaded yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => {
            const isVideo = item.content_type?.startsWith("video/");
            return (
              <div
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-gold-400/25 bg-white/60"
              >
                <div className="flex aspect-[4/3] items-center justify-center bg-blush-100">
                  {!item.signedUrl ? (
                    <FileWarning size={28} className="text-maroon-700/40" />
                  ) : isVideo ? (
                    <video src={item.signedUrl} controls className="h-full w-full object-cover" />
                  ) : (
                    // Signed Supabase URLs expire hourly, so these are plain
                    // <img> rather than next/image, which would cache them.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.signedUrl}
                      alt={item.caption ?? item.file_name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  {item.caption && (
                    <p className="text-sm text-ink-900/80">{item.caption}</p>
                  )}
                  <p className="truncate text-xs text-ink-900/50" title={item.file_name}>
                    {item.file_name} · {formatDate(item.created_at)}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    {item.signedUrl && (
                      <a
                        href={item.signedUrl}
                        download={item.file_name}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gold-400 px-3 py-1.5 text-sm font-medium text-maroon-700 hover:bg-blush-100"
                      >
                        <Download size={13} /> Download
                      </a>
                    )}
                    <ConfirmDeleteButton
                      action={deleteJourneyMediaAction.bind(null, item.id)}
                      label="Delete"
                      confirmLabel="Delete file"
                      iconOnly
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
