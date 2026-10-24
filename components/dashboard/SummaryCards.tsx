"use client";

import { useBatchState } from "@/components/data/BatchStateProvider";
import { useDemo } from "@/components/demo/DemoProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { DropArt, LeafArt, WeatherArt, weatherKind } from "@/components/dashboard/CardArt";
import { useStationState } from "@/components/stations/StationStateProvider";
import { demoWeather } from "@/lib/demo/weather";
import { sapStory, seasonPhase } from "@/lib/selectors/season";
import { weekdayName } from "@/lib/time";

function Footnote({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="text-sm" style={{ color: tone }}>
        {label}
      </div>
      <div className="font-sans text-lg font-bold text-text">{value}</div>
    </div>
  );
}

export default function SummaryCards() {
  const { day, dayIndex } = useDemo();
  const { weight, temp, seasons, syrupGoalLbs } = useClubSettings();
  const { viewBatch } = useBatchState();
  const { loggedCollections } = useStationState();

  const today = day.dailyTotals[day.dailyTotals.length - 1];
  const collectedToday =
    (day.collections.find((collection) => collection.date === day.date)?.entries.length ?? 0) +
    loggedCollections.filter((entry) => entry.dayIndex === dayIndex).length;
  const phase = seasonPhase(day.date, seasons);

  const batches = day.batches.map(viewBatch).map((view) => view.batch);
  const closed = batches.filter((batch) => batch.status === "completed");
  const syrup = closed.reduce((sum, batch) => sum + batch.syrupOutLbs, 0);
  const sapBoiled = closed.reduce((sum, batch) => sum + batch.sapInLbs, 0);
  const avgBrix = closed.length ? closed.reduce((sum, batch) => sum + batch.brix, 0) / closed.length : 0;

  const forecast = demoWeather.slice(dayIndex + 1, dayIndex + 4);
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
            <p className="mt-3 max-w-md text-[16px] text-text md:text-base">{sapStory(day)}</p>
            <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3">
              <Footnote tone={sapTone} label="Season Total" value={weight(day.meta.production.sapCollectedLbs)} />
              <Footnote tone={sapTone} label="Collections Today" value={String(collectedToday)} />
              <Footnote
                tone={sapTone}
                label="Season Day"
                value={phase?.kind === "during" ? String(phase.day) : "Off season"}
              />
            </div>
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
            <div className="mt-auto flex flex-wrap gap-x-10 gap-y-3 pt-8">
              <Footnote tone={syrupTone} label="Avg Brix" value={avgBrix ? `${avgBrix.toFixed(1)}°` : "—"} />
              <Footnote tone={syrupTone} label="Boiled" value={`${closed.length} of ${batches.length}`} />
              <Footnote
                tone={syrupTone}
                label="Sap to Syrup"
                value={syrup ? `${(sapBoiled / syrup).toFixed(1)} : 1` : "—"}
              />
            </div>
          </div>
        </section>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-[#D3DDE6] bg-weather-bg p-6 text-weather-text md:p-8">
        <WeatherArt kind={weatherKind(day.weather)} />
        <div className="relative">
          <h2 className="font-sans text-lg font-semibold">Weather · Rochester</h2>
          <div className="mt-1 font-sans text-5xl font-bold tracking-tight text-[#1E3347]">
            {temp(day.weather.temperatureF)}
          </div>
          <p className="mt-2 text-[16px] md:text-base">
            {day.weather.summary} · High {temp(day.weather.highF, false)}, Low {temp(day.weather.lowF, false)}
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
