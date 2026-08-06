import { ProfileForm } from "@/components/ProfileForm";
import { createProfileAction } from "@/lib/actions/profiles";

export default function NewProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">New Profile</h1>
        <p className="text-sm text-ink-900/60">
          Create a new profile. You can upload photos after saving.
        </p>
      </div>
      <div className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <ProfileForm action={createProfileAction} submitLabel="Create profile" />
      </div>
    </div>
  );
}
