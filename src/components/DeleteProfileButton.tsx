import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { deleteProfileAction } from "@/lib/actions/profiles";

export function DeleteProfileButton({ profileId }: { profileId: string }) {
  return (
    <ConfirmDeleteButton
      action={deleteProfileAction.bind(null, profileId)}
      label="Delete profile"
      confirmLabel="Yes, delete profile"
      description="Removes the profile, its photos, and it from every share link and shortlist."
    />
  );
}
