import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BulkImportForm } from "@/components/BulkImportForm";

export const metadata = { title: "Bulk upload | AnuRupa Admin" };

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/analytics"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-maroon-700/70 hover:text-maroon-700"
        >
          <ArrowLeft size={15} /> Back to the dashboard
        </Link>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Bulk upload</h1>
        <p className="max-w-2xl text-sm text-ink-900/60">
          Import profiles from a CSV export. Check the file first to see exactly what
          will happen, then import.
        </p>
      </div>

      <BulkImportForm />
    </div>
  );
}
