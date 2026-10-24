"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import DisplayCard from "@/components/settings/DisplayCard";
import { useSession } from "@/components/session/SessionProvider";
import { Button, Card, CardTitle, Field, inputClass, PageHeader } from "@/components/ui/ui";
import { roleLabels, type Member } from "@/lib/data/people";

function AccountForm({ user }: { user: Member }) {
  const { updateMember, signOut } = useSession();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [pronouns, setPronouns] = useState(user.pronouns ?? "");
  const [saved, setSaved] = useState(false);

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setSaved(false);
    };
  }

  return (
    <Card className="max-w-3xl md:px-8 md:py-7">
      <CardTitle title="Your details" subtitle="How you appear on notes, collections and the audit log." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input value={name} onChange={(event) => edit(setName)(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Pronouns (optional)" hint="Shown next to your name for other members.">
          <input
            value={pronouns}
            onChange={(event) => edit(setPronouns)(event.target.value)}
            placeholder="e.g. she/her, he/him, they/them"
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => edit(setEmail)(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Role" hint="Your role is set by a Manager or the Owner / IT.">
          <input value={roleLabels[user.role]} disabled className={inputClass} />
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            updateMember({ ...user, name: name.trim() || user.name, email, pronouns: pronouns.trim() || undefined });
            setSaved(true);
          }}
        >
          Save Changes
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
        <AccountForm key={user.id} user={user} />
        <DisplayCard />
      </div>
    </div>
  );
}
