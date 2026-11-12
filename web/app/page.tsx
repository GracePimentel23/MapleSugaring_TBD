"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShowFor } from "@/components/auth/AccessContext";
import NextSteps from "@/components/dashboard/NextSteps";
import StationTile from "@/components/dashboard/StationTile";
import { ChevronRightIcon } from "@/components/icons";
import SummaryCards from "@/components/dashboard/SummaryCards";
import { useLive } from "@/components/live/LiveProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import StationDialogs from "@/components/stations/StationSheet";
import { useStationCards } from "@/components/stations/StationStateProvider";
import { Button } from "@/components/ui/ui";
import { greeting, seasonPhase } from "@/lib/selectors/season";
import { shortDate } from "@/lib/time";
import { byUrgency, getStationSummary } from "@/lib/selectors/stations";

/** The dashboard shows this many buckets, most urgent first; the rest are a tap away on Stations. */
const DASHBOARD_BUCKETS = 4;

/** "Sam R." -> "Sam"; titles like "Mr. Adams" stay whole. */
function firstName(name: string): string {
  const [first] = name.split(" ");
  return first && !first.endsWith(".") ? first : name;
}

export default function Home() {
  const { day } = useLive();
  const { user, signedIn } = useSession();
  const router = useRouter();
  const { seasons } = useClubSettings();
  const stations = useStationCards();
  const [openBucket, setOpenBucket] = useState<number | null>(null);
  const { onlineCount, attentionCount } = getStationSummary(stations);
  const shown = [...stations].sort(byUrgency).slice(0, DASHBOARD_BUCKETS);
  const hidden = stations.length - shown.length;
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
      <h1 className="font-sans text-3xl leading-tight font-bold tracking-tight max-md:pt-4 md:text-[40px]">
        {greeting()}
        {signedIn ? `, ${firstName(user.name)}` : ""}
      </h1>
      <p className="mt-0.5 mb-5 text-body text-muted">
        {seasonLine} ·{" "}
        {attentionCount === 0
          ? "every bucket looks fine"
          : `${attentionCount} bucket${attentionCount === 1 ? " needs" : "s need"} a look`}
      </p>

      <ShowFor id="dashboard.signIn">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-6 py-4 shadow-card">
          <p className="text-body">You are viewing as a guest. Sign in to log collections, and handle alerts.</p>
          <Button onClick={() => router.push("/login")}>Sign In</Button>
        </div>
      </ShowFor>

      <ShowFor id="dashboard.summary">
        <SummaryCards />
      </ShowFor>

      <ShowFor id="dashboard.stations">
        {/* The heading runs the full width, so "All 5" sits at the right edge of the whole row. */}
        <div className="mb-4 flex items-center justify-between gap-3 max-md:pt-4">
          <h2 className="font-sans text-lg font-semibold">Buckets · {onlineCount} Online</h2>
          <Link
            href="/stations"
            className="flex shrink-0 items-center gap-1 rounded-full bg-white py-1.5 pr-2 pl-3.5 font-sans text-sm font-semibold text-accent shadow-card transition-colors hover:bg-accent-light"
          >
            {hidden > 0 ? `All ${stations.length}` : "Stations"}
            <ChevronRightIcon size={18} />
          </Link>
        </div>
      </ShowFor>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(280px,1.15fr)]">
        <ShowFor id="dashboard.stations">
          {/* Two by two beside Next Steps, a row of four when there is room, one column on phones */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
            {shown.map((station) => (
              <StationTile key={station.bucketId} station={station} onOpen={() => setOpenBucket(station.bucketId)} />
            ))}
          </div>
        </ShowFor>
        <ShowFor id="dashboard.nextSteps">
          <NextSteps />
        </ShowFor>
      </div>

      <StationDialogs bucketId={openBucket} onClose={() => setOpenBucket(null)} />
    </div>
  );
}
