"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteProfileAction } from "@/lib/actions/profiles";

export function DeleteProfileButton({ profileId }: { profileId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (confirm("Permanently delete this profile and all its photos?")) {
          startTransition(() => deleteProfileAction(profileId));
        }
      }}
    >
      <Trash2 size={14} /> Delete profile
    </Button>
  );
}
