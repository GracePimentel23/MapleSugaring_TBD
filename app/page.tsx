"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShowFor } from "@/components/auth/AccessContext";
import NextSteps from "@/components/dashboard/NextSteps";
import StationTile from "@/components/dashboard/StationTile";
import SummaryCards from "@/components/dashboard/SummaryCards";
import { useDemo } from "@/components/demo/DemoProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import StationDialogs from "@/components/stations/StationSheet";
import { useStationCards } from "@/components/stations/StationStateProvider";
import { Button } from "@/components/ui/ui";
import { greeting, seasonPhase } from "@/lib/selectors/season";
import { shortDate } from "@/lib/time";
import { getStationSummary } from "@/lib/selectors/stations";

/** "Sam R." -> "Sam"; titles like "Mr. Adams" stay whole. */
function firstName(name: string): string {
  const [first] = name.split(" ");
  return first && !first.endsWith(".") ? first : name;
}

export default function Home() {
  const { day } = useDemo();
  const { user, signedIn } = useSession();
  const router = useRouter();
  const { seasons } = useClubSettings();
  const stations = useStationCards();
  const [openBucket, setOpenBucket] = useState<number | null>(null);
  const { onlineCount, attentionCount } = getStationSummary(stations);
  const phase = seasonPhase(day.date, seasons);
  const seasonLine =
    phase?.kind === "during"
      ? `Day ${phase.day} of the sugaring season`
      : phase?.kind === "before"
        ? `Sugaring season starts in ${phase.daysUntil} day${phase.daysUntil === 1 ? "" : "s"} (${shortDate(phase.start)})`
        : phase
          ? `Off season · last season ran ${shortDate(phase.start)} to ${shortDate(phase.end)}`
          : "No season set up yet";

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <h1 className="mt-2 font-sans max-md:pt-4 text-3xl font-bold tracking-tight md:text-[48px] md:leading-tight">
        {greeting()}
        {signedIn ? `, ${firstName(user.name)}` : ""}
      </h1>
      <p className="mt-1 mb-7 text-body text-muted md:text-base">
        {seasonLine} ·{" "}
        {attentionCount === 0
          ? "every bucket looks fine"
          : `${attentionCount} bucket${attentionCount === 1 ? " needs" : "s need"} a look`}
      </p>

      <ShowFor id="dashboard.signIn">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-6 py-4">
          <p className="text-body">You are viewing as a guest. Sign in to log collections, and handle alerts.</p>
          <Button onClick={() => router.push("/login")}>Sign In</Button>
        </div>
      </ShowFor>

      <ShowFor id="dashboard.summary">
        <SummaryCards />
      </ShowFor>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(280px,1.15fr)]">
        <ShowFor id="dashboard.stations">
          <section>
            <h2 className="mb-4 font-sans text-xl font-semibold max-md:pt-4 md:text-2xl">
              Buckets · {onlineCount} Online
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stations.map((station) => (
                <StationTile key={station.bucketId} station={station} onOpen={() => setOpenBucket(station.bucketId)} />
              ))}
            </div>
          </section>
        </ShowFor>
        <ShowFor id="dashboard.nextSteps">
          <div className="xl:pt-[52px]">
            <NextSteps stations={stations} />
          </div>
        </ShowFor>
      </div>

      <StationDialogs bucketId={openBucket} onClose={() => setOpenBucket(null)} />
    </div>
  );
}
