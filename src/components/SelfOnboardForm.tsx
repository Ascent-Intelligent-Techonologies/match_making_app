"use client";

import { useRef } from "react";
import { unstable_isUnrecognizedActionError, useRouter } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { putBlob } from "@/lib/blob-upload";
import { SELF_ONBOARD_MAX_PHOTOS, SELF_ONBOARD_MAX_PHOTO_BYTES } from "@/lib/constants";
import {
  completeOnboardingAction,
  finaliseOnboardingPhotoAction,
  requestOnboardingPhotoUploadAction,
  saveOnboardingDetailsAction,
} from "@/lib/actions/onboarding";
import type { ProfileFormState } from "@/lib/actions/profiles";

/** A file, by what identifies it, so a retry can skip photos that already went up. */
const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

/**
 * The public sign-up: the profile form without its internal parts, and a
 * submit that saves the details, uploads the photos, then sends the whole
 * thing for review.
 *
 * The three steps mirror the server (see src/lib/data/onboarding.ts). If a
 * photo fails, the profile already exists as a draft, so the next press of the
 * button carries on with the same draft rather than starting a second one: the
 * token and the photos already uploaded are kept here between attempts.
 */
export function SelfOnboardForm() {
  const router = useRouter();
  // Written straight to the element rather than held in state: React keeps
  // state set inside a form action back until the action finishes, so a
  // progress message set that way would only ever appear once it was over.
  const statusRef = useRef<HTMLParagraphElement>(null);
  const setStatus = (text: string) => {
    if (statusRef.current) statusRef.current.textContent = text;
  };
  const draft = useRef<{ token: string; uploaded: Set<string> } | null>(null);

  async function submit(_previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
    const files = formData
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (files.length === 0) return { error: "Please add at least one photo." };
    if (files.length > SELF_ONBOARD_MAX_PHOTOS) {
      return { error: `Please choose no more than ${SELF_ONBOARD_MAX_PHOTOS} photos.` };
    }
    const tooBig = files.find((f) => f.size > SELF_ONBOARD_MAX_PHOTO_BYTES);
    if (tooBig) {
      return {
        error: `${tooBig.name} is over the ${SELF_ONBOARD_MAX_PHOTO_BYTES / 1_048_576} MB limit.`,
      };
    }

    try {
      // The details only: the photos go straight to storage, not through here.
      const details = new FormData();
      formData.forEach((value, name) => {
        if (typeof value === "string") details.append(name, value);
      });
      if (draft.current) details.append("_token", draft.current.token);

      setStatus("Saving your details…");
      const saved = await saveOnboardingDetailsAction(details);
      if ("error" in saved) {
        return { error: saved.error, fieldErrors: saved.fieldErrors };
      }
      draft.current = { token: saved.token, uploaded: draft.current?.uploaded ?? new Set() };
      const { token, uploaded } = draft.current;

      for (const [index, file] of files.entries()) {
        if (uploaded.has(fileKey(file))) continue;

        const label = `photo ${index + 1} of ${files.length}`;
        setStatus(`Uploading ${label}…`);
        const ticket = await requestOnboardingPhotoUploadAction(token, {
          name: file.name,
          type: file.type,
          size: file.size,
        });
        if ("error" in ticket) return { error: ticket.error };

        await putBlob(ticket.ticket.uploadUrl, file, (fraction) =>
          setStatus(`Uploading ${label}… ${Math.round(fraction * 100)}%`)
        );

        setStatus(`Checking ${label}…`);
        const attached = await finaliseOnboardingPhotoAction(token, ticket.ticket.path);
        if ("error" in attached) return { error: attached.error };
        uploaded.add(fileKey(file));
      }

      setStatus("Sending for review…");
      const done = await completeOnboardingAction(token);
      if ("error" in done) return { error: done.error };

      router.push("/onboard/thanks");
      return {};
    } catch (error) {
      // A page opened before a deploy: the form itself explains and offers a reload.
      if (unstable_isUnrecognizedActionError(error)) throw error;
      // Not a validation problem: the network dropped, or a photo could not
      // reach storage. The draft survives, so pressing the button again resumes.
      const reason =
        error instanceof Error && /storage|upload/i.test(error.message)
          ? error.message
          : "We could not send your profile.";
      return { error: `${reason} Please check your connection and try again.` };
    } finally {
      setStatus("");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ProfileForm audience="self" action={submit} submitLabel="Submit for approval" />
      <p
        ref={statusRef}
        role="status"
        aria-live="polite"
        className="min-h-5 text-right text-sm text-maroon-700/80"
      />
    </div>
  );
}
