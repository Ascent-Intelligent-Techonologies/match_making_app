"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { describeActionError } from "@/lib/stale-deploy";
import { approveWithResolutionAction } from "@/lib/actions/approvals";
import type {
  ApprovalDecision,
  ClientNameChoice,
  FieldChoice,
  FieldDiff,
  ResolverData,
} from "@/lib/profile-merge";

type Mode = "separate" | "merge" | "overwrite";
type Use = FieldChoice["use"];

/** Merge keeps what is there; overwrite lets the new answers win. Either can be changed per field. */
const startingUse = (mode: Mode): Use => (mode === "overwrite" ? "incoming" : "existing");

function startingChoices(mode: Mode, diffs: FieldDiff[]): Record<string, Use> {
  return Object.fromEntries(
    diffs.filter((d) => d.kind === "conflict").map((d) => [d.key, startingUse(mode)])
  );
}

const radioClass = "h-4 w-4 border-blush-300 text-maroon-600 focus:ring-maroon-600";

/** One answer in a row of choices: the radio, its caption and the value it stands for. */
function Choice({
  name,
  checked,
  onSelect,
  caption,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition-colors ${
        checked ? "border-maroon-600 bg-blush-100" : "border-blush-200 bg-white/60 hover:bg-blush-50"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className={`mt-0.5 ${radioClass}`}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-maroon-700/60">
          {caption}
        </span>
        <span className="break-words text-ink-900">{children}</span>
      </span>
    </label>
  );
}

/**
 * What an admin sees when approving a sign-up whose phone number is already on
 * the books: the flag, the choice of how to approve, and, if they merge, an
 * answer for every field where the two records disagree.
 *
 * Nothing is chosen for them. Phone numbers are shared on purpose here (a
 * parent registering two children), so "keep both" is as likely as "merge",
 * and the button stays off until one has been picked. The server looks the
 * matches up again and checks every answer; this only collects them.
 */
export function ApprovalResolver({ data }: { data: ResolverData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode | null>(null);
  const [targetId, setTargetId] = useState(data.profiles[0]?.id ?? "");
  const target = data.profiles.find((p) => p.id === targetId) ?? data.profiles[0];

  const [choices, setChoices] = useState<Record<string, Use>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});

  const [linkClient, setLinkClient] = useState(true);
  const [nameUse, setNameUse] = useState<ClientNameChoice["use"]>("client");
  const [nameText, setNameText] = useState("");

  const conflicts = target?.diffs.filter((d) => d.kind === "conflict") ?? [];
  const fills = target?.diffs.filter((d) => d.kind === "fill") ?? [];
  const canLink = Boolean(data.client?.standalone);
  const hasProfiles = data.profiles.length > 0;

  function pickMode(next: Mode, forTarget = target) {
    setMode(next);
    setError(null);
    if (next !== "separate" && forTarget) {
      setChoices(startingChoices(next, forTarget.diffs));
      setTyped({});
    }
  }

  function pickTarget(id: string) {
    setTargetId(id);
    const next = data.profiles.find((p) => p.id === id);
    if (mode && mode !== "separate" && next) {
      setChoices(startingChoices(mode, next.diffs));
      setTyped({});
    }
  }

  function decision(): ApprovalDecision | null {
    if (mode === "separate") {
      if (!(canLink && linkClient)) return { mode: "separate" };
      return {
        mode: "separate",
        linkClient: nameUse === "custom" ? { use: "custom", value: nameText } : { use: nameUse },
      };
    }
    if ((mode === "merge" || mode === "overwrite") && target) {
      const fields: Record<string, FieldChoice> = {};
      for (const d of conflicts) {
        const use = choices[d.key] ?? startingUse(mode);
        fields[d.key] = use === "custom" ? { use, value: typed[d.key] ?? "" } : ({ use } as FieldChoice);
      }
      return { mode: "merge", targetId: target.id, fields };
    }
    return null;
  }

  function submit() {
    const chosen = decision();
    if (!chosen) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await approveWithResolutionAction(data.profileId, chosen);
        if (result.error) setError(result.error);
        else if (result.goTo) router.push(result.goTo);
      } catch (caught) {
        setError(describeActionError(caught, "Could not save that decision."));
      }
    });
  }

  const buttonLabel =
    mode === "merge"
      ? `Merge into ${target?.name ?? "profile"}`
      : mode === "overwrite"
        ? `Overwrite ${target?.name ?? "profile"}`
        : hasProfiles
          ? "Approve as a separate profile"
          : "Approve";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-red-700/25 bg-white/70 p-4">
      <div className="flex items-start gap-2 text-sm text-red-700">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">This phone number is already on file.</p>
          <ul className="list-disc pl-5 text-ink-900/80">
            {data.client && (
              <li>
                Client <span className="font-medium">{data.client.name}</span> (
                {data.client.summary})
              </li>
            )}
            {data.profiles.map((p) => (
              <li key={p.id}>
                Profile{" "}
                <a href={`/admin/profiles/${p.id}`} className="font-medium underline">
                  {p.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
          How should this be approved?
        </legend>

        <Choice
          name="approval-mode"
          checked={mode === "separate"}
          onSelect={() => pickMode("separate")}
          caption={hasProfiles ? "Keep both" : "Approve"}
        >
          {hasProfiles
            ? "A different person who shares this number, such as a brother or sister. It becomes a profile of its own."
            : "Add it as a new profile."}
        </Choice>

        {hasProfiles && (
          <>
            <Choice
              name="approval-mode"
              checked={mode === "merge"}
              onSelect={() => pickMode("merge")}
              caption="Merge into the existing profile"
            >
              The same person signing up again. Keeps what the profile already has, adds what
              it is missing, and asks you about every answer that differs.
            </Choice>
            <Choice
              name="approval-mode"
              checked={mode === "overwrite"}
              onSelect={() => pickMode("overwrite")}
              caption="Overwrite the existing profile"
            >
              The new answers replace the profile&rsquo;s wherever they differ. You can still
              keep the old answer for any field.
            </Choice>
          </>
        )}
      </fieldset>

      {mode === "separate" && canLink && data.client && (
        <div className="flex flex-col gap-2 rounded-lg border border-blush-200 bg-blush-50/60 p-3 text-sm">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={linkClient}
              onChange={(e) => setLinkClient(e.target.checked)}
              className={`mt-0.5 ${radioClass}`}
            />
            <span>
              Make <span className="font-medium">{data.client.name}</span> the client of this
              profile, instead of adding a second client. Their shortlists and links stay as
              they are.
            </span>
          </label>

          {linkClient && data.client.name.trim().toLowerCase() !== data.submittedName.trim().toLowerCase() && (
            <div className="flex flex-col gap-2 pl-6">
              <p className="text-xs text-ink-900/60">The client&rsquo;s name differs. Which to keep?</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Choice
                  name="client-name"
                  checked={nameUse === "client"}
                  onSelect={() => setNameUse("client")}
                  caption="Keep client's"
                >
                  {data.client.name}
                </Choice>
                <Choice
                  name="client-name"
                  checked={nameUse === "profile"}
                  onSelect={() => setNameUse("profile")}
                  caption="Use submitted"
                >
                  {data.submittedName}
                </Choice>
                <Choice
                  name="client-name"
                  checked={nameUse === "custom"}
                  onSelect={() => setNameUse("custom")}
                  caption="Type my own"
                >
                  <Input
                    value={nameText}
                    onChange={(e) => {
                      setNameText(e.target.value);
                      setNameUse("custom");
                    }}
                    aria-label="Client name"
                    className="px-2 py-1 text-sm"
                  />
                </Choice>
              </div>
            </div>
          )}
        </div>
      )}

      {(mode === "merge" || mode === "overwrite") && target && (
        <div className="flex flex-col gap-4">
          {data.profiles.length > 1 && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
                Which profile?
              </span>
              <select
                value={target.id}
                onChange={(e) => pickTarget(e.target.value)}
                className="rounded-lg border border-blush-300 bg-white/70 px-3 py-2 text-sm"
              >
                {data.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {conflicts.length === 0 ? (
            <p className="rounded-lg bg-olive-600/10 px-3 py-2 text-sm text-olive-600">
              No answers conflict with {target.name}&rsquo;s profile.
              {fills.length > 0 ? " The new answers only fill in what is missing." : ""}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-maroon-700">
                {conflicts.length} answer{conflicts.length === 1 ? "" : "s"} differ. Choose one
                for each:
              </p>
              {conflicts.map((d) => {
                const use = choices[d.key] ?? startingUse(mode);
                const set = (next: Use) => setChoices((c) => ({ ...c, [d.key]: next }));
                return (
                  <div key={d.key} className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
                      {d.label}
                    </p>
                    <div className={`grid gap-2 ${d.custom ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                      <Choice
                        name={`field-${d.key}`}
                        checked={use === "existing"}
                        onSelect={() => set("existing")}
                        caption="Keep existing"
                      >
                        {d.existing}
                      </Choice>
                      <Choice
                        name={`field-${d.key}`}
                        checked={use === "incoming"}
                        onSelect={() => set("incoming")}
                        caption="Use new"
                      >
                        {d.incoming}
                      </Choice>
                      {d.custom && (
                        <Choice
                          name={`field-${d.key}`}
                          checked={use === "custom"}
                          onSelect={() => set("custom")}
                          caption="Type my own"
                        >
                          <Input
                            value={typed[d.key] ?? ""}
                            onChange={(e) => {
                              setTyped((t) => ({ ...t, [d.key]: e.target.value }));
                              set("custom");
                            }}
                            aria-label={`${d.label}, your own answer`}
                            className="px-2 py-1 text-sm"
                          />
                        </Choice>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {fills.length > 0 && (
            <details className="rounded-lg border border-blush-200 bg-blush-50/60 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-maroon-700">
                {fills.length} missing answer{fills.length === 1 ? "" : "s"} will be added
              </summary>
              <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {fills.map((d) => (
                  <div key={d.key} className="flex flex-col">
                    <dt className="text-[11px] uppercase tracking-wider text-maroon-700/60">
                      {d.label}
                    </dt>
                    <dd className="break-words text-ink-900">{d.incoming}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}

          <p className="text-xs text-ink-900/60">
            The sign-up&rsquo;s photos are added to {target.name}&rsquo;s, after the ones already
            there, and the sign-up itself is then removed. A blank answer never erases what the
            profile already has, and nothing internal (tags, notes, finances) is touched.
          </p>
        </div>
      )}

      <div className="flex flex-col items-start gap-1.5">
        <Button type="button" disabled={!mode || pending} onClick={submit}>
          <Check size={15} /> {pending ? "Saving…" : buttonLabel}
        </Button>
        {!mode && (
          <p className="text-xs text-ink-900/50">Choose how to approve it to continue.</p>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
