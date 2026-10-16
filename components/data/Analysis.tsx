"use client";

import { useState, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useBatchState } from "@/components/data/BatchStateProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import {
  barCursor,
  lineCursor,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from "@/components/ui/chartTheme";

import { Button, Card, DataTable, StatCard } from "@/components/ui/ui";
import {
  bucketYields,
  cycleDays,
  overduePickups,
  seasonStats,
  TREE_COUNT,
} from "@/lib/selectors/analysis";
import type { DemoDay } from "@/lib/demo/timeline";
import { daysBetween, monthDay } from "@/lib/time";
import type { SeasonSummary } from "@/lib/types/schema";

const axisTick = { fontSize: 11, fill: "#8A8F86" };

function year(season: SeasonSummary): string {
  return season.season.replace("Season ", "");
}

/** "15% below 2021" / "0.3° above 2021" */
function versus(value: number, other: number, compareYear: string, format: (diff: number) => string): string {
  const diff = value - other;
  if (Math.abs(diff) < 0.05) return `same as ${compareYear}`;
  return `${format(Math.abs(diff))} ${diff < 0 ? "below" : "above"} ${compareYear}`;
}

function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <h3 className="font-sans text-base font-semibold">{title}</h3>
      {subtitle ? <p className="mb-4 text-sm text-muted">{subtitle}</p> : <div className="mb-4" />}
      {children}
    </Card>
  );
}

function SeasonSelect({
  label,
  value,
  seasons,
  onChange,
}: {
  label: string;
  value: string;
  seasons: SeasonSummary[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border-2 border-accent bg-white px-3 py-2 font-sans text-sm font-semibold text-text outline-none"
      >
        {seasons.map((season) => (
          <option key={season.season} value={season.season}>
            {year(season)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Analysis({ day }: { day: DemoDay }) {
  const seasons = day.seasons;
  const { weight, temp, thresholds, seasons: seasonRecords, animations } = useClubSettings();
  const { can } = useSession();
  const { viewBatch } = useBatchState();
  const [primaryName, setPrimaryName] = useState(seasons[0]!.season);
  const [compareName, setCompareName] = useState(seasons[1]!.season);

  const current = seasons[0]!;
  const primary = seasons.find((season) => season.season === primaryName) ?? current;
  const compare =
    seasons.find((season) => season.season === compareName && season.season !== primaryName) ??
    seasons.find((season) => season.season !== primary.season)!;
  const isCurrent = primary.season === current.season;
  const py = year(primary);
  const cy = year(compare);

  const pStats = seasonStats(primary, isCurrent);
  const cStats = seasonStats(compare, compare.season === current.season);

  const batches = day.batches.map(viewBatch).map((view) => view.batch);
  const boiled = batches.filter((batch) => batch.status === "completed" || batch.status === "processing");
  const closed = batches.filter((batch) => batch.status === "completed" && batch.syrupOutLbs > 0);
  const closedSyrup = closed.reduce((sum, batch) => sum + batch.syrupOutLbs, 0);
  // Ratio from closed batches only: a batch still boiling has sap in but no syrup yet.
  const ratioFor = (season: SeasonSummary) =>
    season.season === current.season
      ? closedSyrup
        ? closed.reduce((sum, batch) => sum + batch.sapInLbs, 0) / closedSyrup
        : 0
      : season.sapToSyrupRatio;
  const boilSessions = (season: SeasonSummary) =>
    season.season === current.season ? boiled.length : season.totalBatches;

  const seasonDays = (season: SeasonSummary) => {
    const record = seasonRecords.find((item) => item.name === season.season);
    return record ? daysBetween(record.start, record.end) + 1 : season.weeklyFlow.length;
  };

  // Both series lined up by day of March.
  const frame = primary.weeklyFlow.length >= compare.weeklyFlow.length ? primary.weeklyFlow : compare.weeklyFlow;
  const dailyData = frame.map((point, index) => ({
    day: point.week,
    [py]: primary.weeklyFlow[index]?.lbs ?? null,
    [cy]: compare.weeklyFlow[index]?.lbs ?? null,
  }));

  const cycles = cycleDays(primary, isCurrent);
  const cycleData = primary.weeklyFlow.map((point, index) => ({
    day: point.week,
    lbs: point.lbs,
    cycle: cycles[index],
    compare: compare.weeklyFlow[index]?.lbs ?? null,
  }));

  const yields = isCurrent ? bucketYields(day) : [];
  const maxYield = Math.max(1, ...yields.map((item) => item.total));
  const overdue = isCurrent ? overduePickups(day, thresholds) : [];
  const canExport = can("data:export");

  const openBatches = batches.filter((batch) => batch.status !== "completed");
  const weakest = yields[yields.length - 1];
  const notes = [
    {
      note: `Sap total is ${primary.totalSapLbs < compare.totalSapLbs ? "down" : "up"} ${Math.round(
        (Math.abs(primary.totalSapLbs - compare.totalSapLbs) / Math.max(compare.totalSapLbs, 1)) * 100,
      )}%`,
      detail: `${pStats.cycleDays < cStats.cycleDays ? "Fewer" : "More"} freeze-thaw cycle days recorded than in ${cy} (${pStats.cycleDays} vs ${cStats.cycleDays}).`,
    },
    ...(isCurrent && openBatches.length
      ? [
          {
            note: "Ratio uses closed batches only",
            detail: `${openBatches.map((batch) => batch.batchNumber).join(" and ")} ${
              openBatches.length === 1 ? "has" : "have"
            } no syrup yet, so ${openBatches.length === 1 ? "it is" : "they are"} excluded. Update them when boiling finishes.`,
          },
        ]
      : []),
    ...(weakest
      ? [
          {
            note: `Bucket ${weakest.label} yields least`,
            detail: `Battery is at ${Math.round(weakest.battery)}% and it sits in the ${weakest.location}. Check the sensor and the tree location.`,
          },
        ]
      : []),
  ];

  function exportCsv() {
    const rows = [["day", `${py} lbs`, `${cy} lbs`, `${py} temp F`]];
    frame.forEach((point, index) =>
      rows.push([
        point.week,
        String(primary.weeklyFlow[index]?.lbs ?? ""),
        String(compare.weeklyFlow[index]?.lbs ?? ""),
        String(primary.weeklyFlow[index]?.temp ?? ""),
      ]),
    );
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sap-analysis-${py}-vs-${cy}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-3xl font-bold tracking-tight md:text-[40px] md:leading-tight">Analysis</h1>
          <p className="mt-1 text-sm text-muted">
            Compares with the season before by default. Pick any past season.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SeasonSelect label="Season" value={primary.season} seasons={seasons} onChange={setPrimaryName} />
          <SeasonSelect
            label="Compare with"
            value={compare.season}
            seasons={seasons.filter((season) => season.season !== primary.season)}
            onChange={setCompareName}
          />
          {canExport ? (
            <>
              <Button variant="outline" className="border-border text-text" onClick={exportCsv}>
                Export CSV
              </Button>
              <Button onClick={() => window.print()}>Export PDF Report</Button>
            </>
          ) : null}
        </div>
      </div>

      <h2 className="mb-3 font-sans text-base font-semibold">Season Metrics</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          dark
          label="Total sap"
          value={weight(primary.totalSapLbs)}
          note={versus(primary.totalSapLbs, compare.totalSapLbs, cy, (diff) =>
            `${Math.round((diff / Math.max(compare.totalSapLbs, 1)) * 100)}%`,
          )}
        />
        <StatCard
          label="Syrup"
          value={weight(primary.totalSyrupLbs)}
          note={versus(primary.totalSyrupLbs, compare.totalSyrupLbs, cy, (diff) => weight(diff))}
        />
        <StatCard
          label="Avg Brix"
          value={primary.avgBrix ? `${primary.avgBrix}°` : "—"}
          note={primary.avgBrix ? versus(primary.avgBrix, compare.avgBrix, cy, (diff) => `${diff.toFixed(1)}°`) : "no batch finished yet"}
        />
        <StatCard
          label="Sap to syrup"
          value={ratioFor(primary) ? `${ratioFor(primary).toFixed(1)} : 1` : "—"}
          note="closed batches only"
        />
        <StatCard
          label="Season length"
          value={`${pStats.days} days`}
          note={`${isCurrent ? "so far; " : ""}${cy} ran ${seasonDays(compare)}`}
        />
        <StatCard label="Boil sessions" value={String(boilSessions(primary))} note={`${cy}: ${boilSessions(compare)}`} />
        <StatCard
          label="Sap per tree"
          value={weight(Math.round((primary.totalSapLbs / TREE_COUNT) * 10) / 10)}
          note={`${cy}: ${weight(Math.round((compare.totalSapLbs / TREE_COUNT) * 10) / 10)}`}
        />
        <StatCard
          label="Syrup per tree"
          value={weight(Math.round((primary.totalSyrupLbs / TREE_COUNT) * 100) / 100)}
          note={`${cy}: ${weight(Math.round((compare.totalSyrupLbs / TREE_COUNT) * 100) / 100)}`}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Panel title="Daily Sap Collected (lbs)" subtitle={`Season ${py} against ${cy}, by day of March.`}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dailyData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="#ECECE6" />
              <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={lineCursor}
              />
              <Line
                type="linear"
                dataKey={py}
                stroke="#1A2318"
                strokeWidth={2}
                dot={false}
                isAnimationActive={animations}
                animationDuration={900}
              />
              <Line
                type="linear"
                dataKey={cy}
                stroke="var(--color-slate)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={animations}
                animationDuration={900}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 flex gap-5 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-text" /> {py}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed border-slate" /> {cy}
            </span>
          </div>
        </Panel>

        <Panel title="Season Totals">
          <DataTable
            columns={[
              { key: "label", label: "" },
              { key: "p", label: py, align: "right" },
              { key: "c", label: cy, align: "right" },
            ]}
            rows={[
              ["Total sap", weight(primary.totalSapLbs), weight(compare.totalSapLbs)],
              ["Peak day", weight(pStats.peakLbs), weight(cStats.peakLbs)],
              ["Best day", pStats.bestDay, cStats.bestDay],
              ["Avg temp", temp(primary.avgTempF), temp(compare.avgTempF)],
              ["Collections", String(primary.totalCollections), String(compare.totalCollections)],
              ["Freeze-thaw days", String(pStats.cycleDays), String(cStats.cycleDays)],
            ].map(([label, p, c]) => ({ key: label!, cells: { label, p, c } }))}
          />
        </Panel>

        <Panel
          title="Freeze-Thaw Days vs Sap per Day"
          subtitle={`Dark bars had a hard freeze overnight and a thaw by midday. The dashed line is ${cy}.`}
        >
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={cycleData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={barCursor}
              />
              <Bar
                dataKey="lbs"
                name={py}
                radius={[4, 4, 0, 0]}
                isAnimationActive={animations}
                animationDuration={900}
              >
                {cycleData.map((point) => (
                  <Cell key={point.day} fill={point.cycle ? "var(--color-chart-bar)" : "var(--color-chart-bar-light)"} />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="compare"
                name={cy}
                stroke="var(--color-slate)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={animations}
                animationDuration={900}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Freeze-Thaw Summary">
          <DataTable
            columns={[
              { key: "label", label: "" },
              { key: "p", label: py, align: "right" },
              { key: "c", label: cy, align: "right" },
            ]}
            rows={[
              ["Cycle days", String(pStats.cycleDays), String(cStats.cycleDays)],
              ["Avg lbs, cycle day", pStats.avgCycleLbs.toFixed(1), cStats.avgCycleLbs.toFixed(1)],
              ["Avg lbs, other day", pStats.avgOtherLbs.toFixed(1), cStats.avgOtherLbs.toFixed(1)],
              ["Sap from cycle days", `${Math.round(pStats.cycleShare * 100)}%`, `${Math.round(cStats.cycleShare * 100)}%`],
            ].map(([label, p, c]) => ({ key: label!, cells: { label, p, c } }))}
          />
        </Panel>

        {isCurrent ? (
          <>
            <Panel title="Yield by Bucket" subtitle="Season total in lbs, to spot weak trees.">
              <div className="space-y-5 py-2">
                {yields.map((item, index) => (
                  <div key={item.bucketId} className="grid grid-cols-[44px_1fr_44px] items-center gap-4">
                    <span className="text-sm">{item.label}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-progress-track">
                      <div
                        className="anim-grow h-full rounded-full bg-accent-mid"
                        style={{ width: `${(item.total / maxYield) * 100}%`, animationDelay: `${index * 120}ms` }}
                      />
                    </div>
                    <span className="text-right font-sans text-sm font-semibold">{item.total}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Bucket Detail" subtitle="Scrolls when there are more trees.">
              <div className="max-h-72 overflow-y-auto">
                <DataTable
                  columns={[
                    { key: "bucket", label: "Bucket" },
                    { key: "total", label: "Total", align: "right" },
                    { key: "perDay", label: "Per day", align: "right" },
                  ]}
                  rows={yields.map((item) => ({
                    key: String(item.bucketId),
                    cells: { bucket: item.label, total: item.total, perDay: item.perDay },
                  }))}
                />
              </div>
            </Panel>

            <Panel title="Batches: Sap in and Syrup Out" subtitle="Only boiled batches count toward the ratio.">
              <DataTable
                columns={[
                  { key: "batch", label: "Batch" },
                  { key: "date", label: "Date" },
                  { key: "sapIn", label: "Sap in" },
                  { key: "syrup", label: "Syrup out" },
                  { key: "brix", label: "Brix" },
                  { key: "ratio", label: "Ratio" },
                  { key: "water", label: "Water removed" },
                ]}
                rows={batches.map((batch) => {
                  const done = batch.status === "completed" && batch.syrupOutLbs > 0;
                  return {
                    key: batch.id,
                    cells: {
                      batch: batch.batchNumber.replace("Batch ", ""),
                      date: monthDay(batch.date),
                      sapIn: weight(batch.sapInLbs),
                      syrup: done ? weight(batch.syrupOutLbs) : "—",
                      brix: done ? `${batch.brix}°` : "—",
                      ratio: done ? `${(batch.sapInLbs / batch.syrupOutLbs).toFixed(1)} : 1` : "—",
                      water: done
                        ? `${Math.round(((batch.sapInLbs - batch.syrupOutLbs) / batch.sapInLbs) * 100)}%`
                        : "—",
                    },
                  };
                })}
              />
            </Panel>

            <Panel title="Overdue Pickups" subtitle="Collections made after the sap-age limit.">
              <DataTable
                empty="Every collection was on time."
                columns={[
                  { key: "date", label: "Date" },
                  { key: "bucket", label: "Bucket" },
                  { key: "hours", label: "Hours overdue", align: "right" },
                ]}
                rows={overdue.map((row) => ({
                  key: `${row.date}-${row.bucket}`,
                  cells: { date: monthDay(row.date), bucket: row.bucket, hours: row.hoursOver.toFixed(1) },
                }))}
              />
            </Panel>
          </>
        ) : (
          <Card className="text-sm text-muted xl:col-span-2">
            Per-bucket yield, batch and pickup detail is kept for the current season only. Pick Season{" "}
            {year(current)} to see it.
          </Card>
        )}
      </div>

      <Panel title="Season Notes" subtitle="Generated from the data. Check anything unusual before relying on it.">
        <DataTable
          columns={[
            { key: "note", label: "Note", className: "w-1/3" },
            { key: "detail", label: "Detail" },
          ]}
          rows={notes.map((row) => ({ key: row.note, cells: row }))}
        />
      </Panel>
    </div>
  );
}
