"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLive } from "@/components/live/LiveProvider";
import DisplayCard from "@/components/settings/DisplayCard";
import { useSession } from "@/components/session/SessionProvider";
import { Button, Card, CardTitle, Field, inputClass, PageHeader } from "@/components/ui/ui";
import type { Member } from "@/lib/data/people";

function AccountForm({ user }: { user: Member }) {
  const { viewLabels, authEnabled, signOut } = useSession();
  const router = useRouter();
  const { send } = useLive();
  const [name, setName] = useState(user.name);
  const [pronouns, setPronouns] = useState(user.pronouns ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setSaved(false);
    };
  }

  async function save() {
    setSaving(true);
    const ok = await send("PATCH", "/me", { name: name.trim() || user.name, pronouns: pronouns.trim() });
    setSaving(false);
    setSaved(ok);
  }

  return (
    <Card className="max-w-3xl md:px-8 md:py-7">
      <CardTitle title="Your details" subtitle="How you appear on notes, collections and the audit log." />
      {authEnabled ? null : (
        <p className="mb-4 rounded-xl border border-attention-border bg-attention-bg px-4 py-2.5 text-sm">
          Sign-in is off on this server, so there is no account to save. These are the test view&apos;s details.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={name}
            disabled={!authEnabled}
            onChange={(event) => edit(setName)(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Pronouns (optional)" hint="Shown next to your name for other members.">
          <input
            value={pronouns}
            disabled={!authEnabled}
            onChange={(event) => edit(setPronouns)(event.target.value)}
            placeholder="e.g. she/her, he/him, they/them"
            className={inputClass}
          />
        </Field>
        <Field label="Email" hint="Your Google account. Sign in with another account to change it.">
          <input type="email" value={user.email} disabled className={inputClass} />
        </Field>
        <Field label="Role" hint="Your role is set by the Owner / IT.">
          <input value={viewLabels[user.role] ?? user.role} disabled className={inputClass} />
        </Field>
      </div>
      {authEnabled ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
          <Button
            variant="outline"
            className="border-border text-text"
            onClick={async () => {
              await signOut();
              router.push("/login");
            }}
          >
            Sign Out
          </Button>
          {saved ? <span className="text-sm text-status-online">Saved.</span> : null}
        </div>
      ) : null}
    </Card>
  );
}

/** Everyone's own account. Members have no Settings page; this is where they edit themselves. */
export default function AccountPage() {
  const { user } = useSession();
  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <PageHeader title="Account" subtitle="Your name, pronouns, email and display preferences." />
      <div className="space-y-6">
        {/* Keyed by account so switching "View as" loads that person's details. */}
        <AccountForm key={`${user.id}-${user.role}`} user={user} />
        <DisplayCard />
      </div>
    </div>
  );
}
