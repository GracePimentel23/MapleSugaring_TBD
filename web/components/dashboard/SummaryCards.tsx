"use client";

import { useBatchState } from "@/components/data/BatchStateProvider";
import { useLive } from "@/components/live/LiveProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { DropArt, LeafArt, WeatherArt, weatherKind } from "@/components/dashboard/CardArt";
import { sapSeasonOf } from "@/lib/live/day";
import { sapStory } from "@/lib/selectors/season";
import { weekdayName } from "@/lib/time";

export default function SummaryCards() {
  const { day, dayIndex, weather } = useLive();
  const { weight, temp, syrupGoalLbs } = useClubSettings();
  const { viewBatch } = useBatchState();

  const today = day.dailyTotals[day.dailyTotals.length - 1];

  // This season's batches only.
  const season = sapSeasonOf(day.date);
  const batches = day.batches
    .filter((batch) => sapSeasonOf(batch.date) === season)
    .map(viewBatch)
    .map((view) => view.batch);
  const closed = batches.filter((batch) => batch.status === "completed");
  const syrup = closed.reduce((sum, batch) => sum + batch.syrupOutLbs, 0);

  const forecast = weather.slice(dayIndex + 1, dayIndex + 4).filter((item) => item.available);
  const sapTone = "#3E6B35";
  const syrupTone = "#8A5A1C";

  return (
    <div className="mb-8 space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-3xl border border-[#D3DFC9] bg-[#E7EFE0] p-6 md:p-8">
          <LeafArt lbs={today?.lbs ?? 0} />
          <div className="relative">
            <h2 className="font-sans text-lg font-semibold" style={{ color: sapTone }}>
              Sap Collected Today
            </h2>
            <div className="mt-1 font-sans text-5xl font-bold tracking-tight text-accent md:text-6xl">
              {weight(today?.lbs ?? 0)}
            </div>
            <p className="mt-3 max-w-md text-body text-text md:text-base">{sapStory(day)}</p>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-[#F0D9BC] bg-[#FAEBD7] p-6 md:p-8">
          <DropArt fill={syrupGoalLbs ? syrup / syrupGoalLbs : 0} />
          <div className="relative flex h-full flex-col">
            <h2 className="font-sans text-lg font-semibold" style={{ color: syrupTone }}>
              Syrup This Season
            </h2>
            <div className="mt-1 font-sans text-5xl font-bold tracking-tight text-[#4A2E0E] md:text-6xl">
              {weight(syrup)}
            </div>
            {/* One line, like the sap card; the season's numbers live on Data > Overview. */}
            <p className="mt-3 max-w-xs text-body md:text-base" style={{ color: syrupTone }}>
              {syrupGoalLbs
                ? `${Math.round((syrup / syrupGoalLbs) * 100)}% of the ${weight(syrupGoalLbs)} goal · ${closed.length} of ${batches.length} batches boiled`
                : `${closed.length} of ${batches.length} batches boiled`}
            </p>
          </div>
        </section>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-[#D3DDE6] bg-weather-bg p-6 text-weather-text md:p-8">
        <WeatherArt kind={weatherKind(day.weather)} />
        <div className="relative">
          <h2 className="font-sans text-lg font-semibold">Weather · Rochester</h2>
          <div className="mt-1 font-sans text-5xl font-bold tracking-tight text-[#1E3347]">
            {day.weather.available ? temp(day.weather.temperatureF) : "—"}
          </div>
          <p className="mt-2 text-body md:text-base">
            {day.weather.available
              ? `${day.weather.summary} · High ${temp(day.weather.highF, false)}, Low ${temp(day.weather.lowF, false)}`
              : "The forecast could not be reached right now."}
          </p>
          {forecast.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
              {forecast.map((item) => (
                <div key={item.date}>
                  <div className="text-sm">{weekdayName(item.date, "short")}</div>
                  <div className="font-sans text-lg font-bold text-[#1E3347]">
                    {temp(item.highF, false)}/{temp(item.lowF, false)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
