import { DeleteChoiceButton } from "@/components/DeleteChoiceButton";
import { deleteProfileAction, softDeleteProfileAction } from "@/lib/actions/profiles";

export function DeleteProfileButton({ profileId }: { profileId: string }) {
  return (
    <DeleteChoiceButton
      label="Delete profile"
      what="this profile"
      softAction={softDeleteProfileAction.bind(null, profileId)}
      hardAction={deleteProfileAction.bind(null, profileId)}
      hardDescription="Removes the profile, its photos, and it from every share link and shortlist."
    />
  );
}
