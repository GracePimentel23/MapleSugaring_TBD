"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Card, CardTitle } from "@/components/ui/ui";
import Select from "@/components/ui/Select";
import { DEMO_CHOICES, DEMO_COOKIE, type DemoChoice } from "@/lib/demo/scenario";

const noSubscribe = () => () => {};

function readChoice(): DemoChoice {
  const match = document.cookie.match(new RegExp(`(?:^|; )${DEMO_COOKIE}=([^;]*)`));
  const value = match?.[1];
  return DEMO_CHOICES.some((choice) => choice.value === value) ? (value as DemoChoice) : "real";
}

/**
 * DEMO DATA (front end only, see lib/demo/scenario.ts): picks today's weather for the demo, or
 * turns the demo layer off. Kept in a cookie so the server renders the same choice. Remove with
 * that file.
 */
export default function DemoDataCard() {
  const router = useRouter();
  // The cookie is only readable in the browser; the server renders the default until hydration.
  const saved = useSyncExternalStore(noSubscribe, readChoice, () => "real" as DemoChoice);
  const [picked, setPicked] = useState<DemoChoice | null>(null);
  const choice = picked ?? saved;

  function pick(value: string) {
    const next = value as DemoChoice;
    setPicked(next);
    document.cookie = `${DEMO_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <Card className="max-w-3xl md:px-8 md:py-7">
      <CardTitle
        title="Demo Data"
        subtitle="Sample alerts and weather for trying out the app. Nothing here is saved to the server."
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-sans text-base font-semibold">Today&apos;s weather</p>
          <p className="max-w-md text-sm text-muted">
            Swap today for a snow day, an ice storm, a good sap day or the best kind of sap day. The past two
            weeks and the next four days always include one of each, along with buckets in every alert state.
          </p>
        </div>
        <div className="w-full sm:w-64 sm:shrink-0">
          <Select
            label="Today's weather"
            value={choice}
            onChange={pick}
            options={DEMO_CHOICES.map(({ value, label, detail }) => ({ value, label, detail }))}
          />
        </div>
      </div>
    </Card>
  );
}
