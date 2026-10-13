"use client";

import { useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { Button, Card, CardTitle, Field, inputClass } from "@/components/ui/ui";
import { roleLabels } from "@/lib/data/people";

export default function AccountTab() {
  const { user, updateMember } = useSession();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saved, setSaved] = useState(false);

  return (
    <Card className="md:px-8 md:py-7">
      <CardTitle title="My Account" subtitle="How you appear on notes, collections and the audit log." />
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSaved(false);
            }}
            className={inputClass}
          />
        </Field>
        <Field label="Role" hint="Your role is set by a Manager or the Owner / IT.">
          <input value={roleLabels[user.role]} disabled className={inputClass} />
        </Field>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Button
          onClick={() => {
            updateMember({ ...user, name, email });
            setSaved(true);
          }}
        >
          Save Changes
        </Button>
        <Button variant="outline" className="border-border text-text">
          Sign Out
        </Button>
        {saved ? <span className="text-sm text-status-online">Saved.</span> : null}
      </div>
    </Card>
  );
}
