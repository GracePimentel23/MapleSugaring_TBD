"use client";

import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { Card, CardTitle, Toggle } from "@/components/ui/ui";

/** Display preferences. Shown on the Account page and in Settings > Display. */
export default function DisplayCard() {
  const { animations, setAnimations } = useClubSettings();

  return (
    <Card className="max-w-3xl md:px-8 md:py-7">
      <CardTitle title="Display" subtitle="How the app looks on this device." />
      <div className="flex items-start gap-4">
        <Toggle checked={animations} onChange={setAnimations} label="Background animations" />
        <div>
          <p className="font-sans text-base font-semibold">Background animations</p>
          <p className="text-sm text-muted">
            Falling leaves, syrup bubbles and moving weather on the dashboard cards. Turn off for a still
            picture. Devices set to reduce motion always get the still version.
          </p>
        </div>
      </div>
    </Card>
  );
}
