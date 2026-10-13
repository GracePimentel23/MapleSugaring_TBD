"use client";

import { useBatchState } from "@/components/data/BatchStateProvider";
import { useDemo } from "@/components/demo/DemoProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useStationState } from "@/components/stations/StationStateProvider";
import { demoWeather } from "@/lib/demo/weather";
import { weekdayName } from "@/lib/time";

function Footnote({ label, value, light = false }: { label: string; value: string; light?: boolean }) {
  return (
    <div>
      <div className={light ? "text-sm text-white/85" : "text-sm text-muted"}>{label}</div>
      <div className="font-sans text-lg font-bold">{value}</div>
    </div>
  );
}

export default function SummaryCards() {
  const { day, dayIndex } = useDemo();
  const { weight, temp } = useClubSettings();
  const { viewBatch } = useBatchState();
  const { loggedCollections } = useStationState();

  const today = day.dailyTotals[day.dailyTotals.length - 1];
  const collectedToday =
    (day.collections.find((collection) => collection.date === day.date)?.entries.length ?? 0) +
    loggedCollections.filter((entry) => entry.dayIndex === dayIndex).length;

  const batches = day.batches.map(viewBatch).map((view) => view.batch);
  const closed = batches.filter((batch) => batch.status === "completed");
  const syrup = closed.reduce((sum, batch) => sum + batch.syrupOutLbs, 0);
  const sapBoiled = closed.reduce((sum, batch) => sum + batch.sapInLbs, 0);
  const avgBrix = closed.length ? closed.reduce((sum, batch) => sum + batch.brix, 0) / closed.length : 0;

  const forecast = demoWeather.slice(dayIndex + 1, dayIndex + 4);

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="flex flex-col rounded-2xl bg-accent p-5 text-white md:p-6">
        <div className="text-[15px] text-white/85">Sap collected today</div>
        <div className="mt-1 font-sans text-4xl font-bold md:text-5xl">{weight(today?.lbs ?? 0)}</div>
        <div className="mt-auto flex gap-8 border-t border-white/20 pt-4 max-md:mt-6 md:mt-10">
          <Footnote light label="Season total" value={weight(day.meta.production.sapCollectedLbs)} />
          <Footnote light label="Collections today" value={String(collectedToday)} />
        </div>
      </div>

      <div className="flex flex-col rounded-2xl border border-border bg-white p-5 md:p-6">
        <div className="text-[15px] text-muted">Syrup this season</div>
        <div className="mt-1 font-sans text-4xl font-bold md:text-5xl">{weight(syrup)}</div>
        <div className="mt-auto flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4 max-md:mt-6 md:mt-10">
          <Footnote label="Avg Brix" value={avgBrix ? `${avgBrix.toFixed(1)}°` : "—"} />
          <Footnote label="Batches boiled" value={`${closed.length} of ${batches.length}`} />
          <Footnote label="Sap to syrup" value={syrup ? `${(sapBoiled / syrup).toFixed(1)} : 1` : "—"} />
        </div>
      </div>

      <div className="flex flex-col rounded-2xl border border-[#d3dde6] bg-weather-bg p-5 text-weather-text md:col-span-2 md:p-6 xl:col-span-1">
        <div className="text-[15px]">Weather · Rochester</div>
        <div className="mt-1 font-sans text-4xl font-bold text-text md:text-5xl">
          {temp(day.weather.temperatureF)}
        </div>
        <p className="mt-2 text-[15px] leading-snug">
          {day.meta.sapCondition.headline}. Sap flow: {day.meta.sapCondition.flow.toLowerCase()}.
        </p>
        {forecast.length > 0 ? (
          <div className="mt-auto flex gap-8 pt-4 max-md:mt-4">
            {forecast.map((item) => (
              <div key={item.date}>
                <div className="text-sm">{weekdayName(item.date, "short")}</div>
                <div className="font-sans text-lg font-bold text-text">
                  {temp(item.highF, false)}/{temp(item.lowF, false)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
