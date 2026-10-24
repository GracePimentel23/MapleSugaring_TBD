"use client";

import { useState, type ReactNode } from "react";
import { Bar, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBatchState } from "@/components/data/BatchStateProvider";
import { useDemo } from "@/components/demo/DemoProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { barCursor, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@/components/ui/chartTheme";
import { Card, PageHeader } from "@/components/ui/ui";
import type { DemoDay } from "@/lib/demo/timeline";
import { demoWeather } from "@/lib/demo/weather";
import { activityWhen, getRecentActivity } from "@/lib/selectors/activity";
import { cycleDays } from "@/lib/selectors/analysis";
import { flowRating, flowRatingMeta, seasonDay, seasonPhase, TYPICAL_SEASON_DAYS } from "@/lib/selectors/season";
import { shortDate, weekdayName } from "@/lib/time";
import type { Batch, SeasonSummary } from "@/lib/types/schema";

const IDEAL_BRIX = { low: 66, high: 68, min: 60, max: 70 };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div className="font-sans text-lg font-bold">{value}</div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-sans text-lg font-semibold">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Ring showing how far the syrup is toward the season goal. */
function GoalRing({ percent }: { percent: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(percent, 100) / 100) * circumference;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#D9CCBB" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#C47A1E"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-sans text-lg font-bold text-[#4A2E0E]">
        {Math.round(percent)}%
      </span>
    </div>
  );
}

/** Where a Brix reading sits against the 66 to 68° range for Grade A syrup. */
function BrixScale({ brix }: { brix: number }) {
  const span = IDEAL_BRIX.max - IDEAL_BRIX.min;
  const at = (value: number) => `${((value - IDEAL_BRIX.min) / span) * 100}%`;
  return (
    <div className="mt-3">
      <div className="relative h-1.5 rounded-full bg-progress-track">
        <div
          className="anim-grow absolute h-full rounded-full bg-[#A9C99F]"
          style={{
            left: at(IDEAL_BRIX.low),
            width: `${((IDEAL_BRIX.high - IDEAL_BRIX.low) / span) * 100}%`,
          }}
        />
        {brix > 0 ? (
          <div
            className="absolute -top-1 h-3.5 w-1 -translate-x-1/2 rounded-full bg-accent"
            style={{
              left: at(Math.min(Math.max(brix, IDEAL_BRIX.min), IDEAL_BRIX.max)),
            }}
          />
        ) : null}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{IDEAL_BRIX.min}°</span>
        <span>
          Ideal {IDEAL_BRIX.low} to {IDEAL_BRIX.high}°
        </span>
        <span>{IDEAL_BRIX.max}°</span>
      </div>
    </div>
  );
}

function batchLine(batch: Batch, weight: (lbs: number) => string): { status: string; color: string; detail: string } {
  if (batch.status === "completed") {
    return {
      status: "Closed",
      color: "var(--color-accent)",
      detail: `${weight(batch.sapInLbs)} in · ${weight(batch.syrupOutLbs)} syrup`,
    };
  }
  if (batch.status === "processing") {
    return {
      status: "Boiling",
      color: "var(--color-accent-mid)",
      detail: `${weight(batch.sapInLbs)} in · on the evaporator`,
    };
  }
  if (batch.status === "waiting") {
    return {
      status: "Waiting",
      color: "var(--color-status-due)",
      detail: `${weight(batch.sapInLbs)} in · waiting to boil`,
    };
  }
  return {
    status: "Collecting",
    color: "#4F8A43",
    detail: `${weight(batch.sapInLbs)} in so far`,
  };
}

export default function Overview({ day }: { day: DemoDay }) {
  const { dayIndex } = useDemo();
  const { weight, temp, seasons: seasonRecords, syrupGoalLbs, thresholds, animations } = useClubSettings();
  const { audit } = useSession();
  const { viewBatch } = useBatchState();
  const seasons = day.seasons;
  const [selected, setSelected] = useState(seasons[0]!.season);
  const season: SeasonSummary = seasons.find((item) => item.season === selected) ?? seasons[0]!;
  const isCurrent = season.season === seasons[0]!.season;

  // Live numbers come from batches, so edits and logged collections show up here.
  const batches = day.batches.map(viewBatch).map((view) => view.batch);
  const closed = batches.filter((batch) => batch.status === "completed" && batch.syrupOutLbs > 0);
  const syrup = isCurrent ? closed.reduce((sum, batch) => sum + batch.syrupOutLbs, 0) : season.totalSyrupLbs;
  const closedSap = closed.reduce((sum, batch) => sum + batch.sapInLbs, 0);
  const ratio = isCurrent ? (syrup ? closedSap / syrup : 0) : season.sapToSyrupRatio;
  const brix = isCurrent
    ? closed.length
      ? closed.reduce((sum, batch) => sum + batch.brix, 0) / closed.length
      : 0
    : season.avgBrix;

  const cycles = cycleDays(season, isCurrent);
  const flow = season.weeklyFlow;
  const peakIndex = flow.reduce((best, point, index) => (point.lbs > (flow[best]?.lbs ?? -1) ? index : best), 0);
  const peak = flow[peakIndex];
  const peakDate = isCurrent && demoWeather[peakIndex] ? shortDate(demoWeather[peakIndex]!.date) : peak?.week;
  const chartData = flow.map((point, index) => ({
    day: point.week,
    lbs: point.lbs,
    temp: point.temp,
    cycle: cycles[index],
  }));

  const record = seasonRecords.find((item) => item.status === "active");
  const start = record?.start ?? day.date;
  const dayNumber = seasonDay(day.date, start);
  const phase = seasonPhase(day.date, seasonRecords);
  const offSeason = phase?.kind !== "during";
  const progress =
    phase?.kind === "before" ? 0 : offSeason ? 100 : Math.min((dayNumber / TYPICAL_SEASON_DAYS) * 100, 100);
  const progressSubtitle =
    phase?.kind === "during"
      ? `Day ${dayNumber} · started ${shortDate(start)} · seasons usually run 4 to 6 weeks`
      : phase?.kind === "before"
        ? `Starts ${shortDate(phase.start)}, in ${phase.daysUntil} day${phase.daysUntil === 1 ? "" : "s"}`
        : phase
          ? `Off season · last season ran ${shortDate(phase.start)} to ${shortDate(phase.end)}`
          : "No season set up yet";
  const todayRating = flowRating(day.weather.lowF, day.weather.highF);
  const outlook = demoWeather.slice(dayIndex + 1, dayIndex + 5);
  const nextGood = outlook.find((item) => flowRating(item.lowF, item.highF) === "good");
  const today = day.dailyTotals[day.dailyTotals.length - 1];

  const goalPercent = syrupGoalLbs ? (syrup / syrupGoalLbs) * 100 : 0;
  const sapNeeded = Math.round(syrupGoalLbs * (ratio || 40));
  const activity = isCurrent ? getRecentActivity(dayIndex, audit, thresholds) : [];

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <PageHeader
        title="Overview"
        subtitle="Full season summary and sap flow."
        actions={
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            aria-label="Season"
            className="rounded-xl border-2 border-accent bg-white px-4 py-2.5 font-sans text-body font-semibold text-text outline-none"
          >
            {seasons.map((item) => (
              <option key={item.season} value={item.season}>
                {item.season}
              </option>
            ))}
          </select>
        }
      />

      {isCurrent ? (
        <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
          <Panel
            title="Season Progress"
            subtitle={progressSubtitle}
            action={
              offSeason ? (
                <span className="shrink-0 font-sans text-sm font-semibold text-muted">
                  {phase?.kind === "before" ? "Coming Up" : "Season Over"}
                </span>
              ) : (
                <span
                  className="shrink-0 font-sans text-sm font-semibold"
                  style={{
                    color: todayRating === "slow" ? "var(--color-status-due)" : "var(--color-status-online)",
                  }}
                >
                  {todayRating === "slow" ? "Sap Is Resting" : "Sap Is Running"}
                </span>
              )
            }
          >
            {/* "Today" rides above the bar so it can never collide with the start and end labels. */}
            <div className="relative mb-2 h-7">
              {offSeason ? null : (
                <span
                  className="absolute bottom-0 -translate-x-1/2 rounded-full bg-accent px-2.5 py-0.5 font-sans text-xs font-semibold whitespace-nowrap text-white"
                  style={{
                    left: `clamp(34px, ${progress}%, calc(100% - 34px))`,
                  }}
                >
                  Today
                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-accent" />
                </span>
              )}
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-progress-track">
              <div className="anim-grow h-full rounded-full bg-accent-mid" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex justify-between gap-4 text-sm text-muted">
              <span>{shortDate(phase?.start ?? start)} start</span>
              <span className="text-right">
                {phase && phase.kind !== "before" && offSeason
                  ? `Ended ${shortDate(phase.end)}`
                  : "Typical end, early April"}
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-12 gap-y-3">
              <Stat label="Freeze-Thaw Days" value={`${cycles.filter(Boolean).length} so far`} />
              <Stat label="Best Day" value={peak ? `${peakDate} · ${weight(peak.lbs)}` : "—"} />
              <Stat
                label="Next Good Day"
                value={
                  nextGood
                    ? `${weekdayName(nextGood.date, "short")} ${shortDate(nextGood.date)}`
                    : "Not in the forecast"
                }
              />
            </div>
          </Panel>

          <section className="rounded-2xl border border-[#F0D9BC] bg-[#FAEBD7] p-5">
            <h2 className="mb-4 font-sans text-lg font-semibold text-[#4A2E0E]">Syrup Goal</h2>
            <div className="flex items-center gap-5">
              <GoalRing percent={goalPercent} />
              <div>
                <p className="font-sans text-2xl font-bold text-[#4A2E0E]">
                  {weight(syrup)} of {weight(syrupGoalLbs)}
                </p>
                <p className="mt-1 text-sm text-[#8A5A1C]">
                  {ratio
                    ? `At your ${ratio.toFixed(1)} : 1 ratio, ${weight(syrupGoalLbs)} needs about ${weight(sapNeeded)} of sap.`
                    : `No batch has finished yet. At a typical 40 : 1, ${weight(syrupGoalLbs)} needs about ${weight(sapNeeded)} of sap.`}{" "}
                  You have {weight(day.meta.production.sapCollectedLbs, false)}.
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <Card className="mb-5 text-sm text-muted">
          {season.season} is closed. Progress, goal, outlook and activity are kept for the current season only.
        </Card>
      )}

      <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-muted">Sap Collected</div>
          <div className="mt-1 font-sans text-3xl font-bold">{weight(season.totalSapLbs)}</div>
          <div className="mt-1 text-sm text-muted">
            {isCurrent ? `${weight(today?.lbs ?? 0)} today` : `${season.totalCollections} collections`}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-muted">Syrup Made</div>
          <div className="mt-1 font-sans text-3xl font-bold">{weight(syrup)}</div>
          <div className="mt-1 text-sm text-muted">
            {isCurrent
              ? `${closed.length} of ${batches.length} batches boiled`
              : `${season.totalBatches} batches boiled`}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-muted">Syrup Brix</div>
          <div className="mt-1 font-sans text-3xl font-bold">{brix ? `${brix.toFixed(1)}°` : "—"}</div>
          <div className="mt-1 text-sm text-muted">Average of closed batches</div>
          <BrixScale brix={brix} />
        </Card>
        <Card>
          <div className="text-sm text-muted">Sap to Syrup</div>
          <div className="mt-1 font-sans text-3xl font-bold">{ratio ? `${ratio.toFixed(1)} : 1` : "—"}</div>
          <div className="mt-1 text-sm text-muted">Closed batches only. Lower is better.</div>
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <Panel
          title="Daily Sap Flow"
          subtitle="Dark bars had a freeze overnight and a thaw by midday. The dashed line is average temperature."
        >
          <div className="mb-2 text-sm">
            <div>
              <span className="text-muted">Avg Temp</span>{" "}
              <span className="font-semibold">{temp(season.avgTempF)}</span>
            </div>
            <div>
              <span className="text-muted">Peak</span>{" "}
              <span className="font-semibold">{peak ? `${weight(peak.lbs)} · ${peakDate}` : "—"}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#8A8F86" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="lbs" hide />
              <YAxis yAxisId="temp" hide domain={["dataMin - 15", "dataMax + 5"]} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={barCursor}
                formatter={(value, name) => (name === "temp" ? [`${value}°F`, "Temp"] : [`${value} lbs`, "Sap"])}
              />
              <Bar
                yAxisId="lbs"
                dataKey="lbs"
                radius={[4, 4, 4, 4]}
                maxBarSize={38}
                isAnimationActive={animations}
                animationDuration={900}
              >
                {chartData.map((point) => (
                  <Cell
                    key={point.day}
                    fill={point.cycle ? "var(--color-chart-bar)" : "var(--color-chart-bar-light)"}
                  />
                ))}
              </Bar>
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temp"
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

        {isCurrent ? (
          <Panel
            title="Outlook"
            subtitle="Sap runs best when nights drop below freezing and days climb past about 40°F."
          >
            {outlook.length === 0 ? (
              <p className="text-sm text-muted">The forecast ends with the season.</p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {outlook.map((item) => {
                  const rating = flowRatingMeta[flowRating(item.lowF, item.highF)];
                  return (
                    <li key={item.date} className="grid grid-cols-[1fr_auto_1fr] items-center py-3">
                      <span className="font-sans text-base font-semibold">{weekdayName(item.date, "short")}</span>
                      <span className="text-sm text-muted">
                        {temp(item.highF, false)} / {temp(item.lowF, false)}
                      </span>
                      <span className="text-right font-sans text-base font-semibold" style={{ color: rating.color }}>
                        {rating.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {isCurrent ? (
          <>
            <Panel title="Batches" subtitle="Where each one is right now.">
              {batches.length === 0 ? (
                <p className="text-sm text-muted">No batches yet.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {[...batches].reverse().map((batch) => {
                    const line = batchLine(batch, weight);
                    return (
                      <li key={batch.id} className="py-3">
                        <p className="font-sans text-base">
                          <span className="font-semibold">{batch.batchNumber}</span>{" "}
                          <span className="ml-2 font-semibold" style={{ color: line.color }}>
                            {line.status}
                          </span>
                        </p>
                        <p className="text-sm text-muted">{line.detail}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Recent Activity" subtitle="Latest from the sugarbush.">
              {activity.length === 0 ? (
                <p className="text-sm text-muted">Nothing yet this season.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {activity.map((item) => (
                    <li key={item.key} className="py-3">
                      <p className="text-body">{item.text}</p>
                      <p className="text-sm text-muted">{activityWhen(item, dayIndex)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        ) : null}

        <section className="rounded-2xl border border-[#D3DFC9] bg-[#E7EFE0] p-5 lg:col-start-3">
          <h2 className="mb-3 font-sans text-lg font-semibold">Sugaring Tips</h2>
          <p className="font-sans text-base font-semibold">Collect within a day.</p>
          <p className="mb-4 text-sm text-muted">
            Sap spoils fast once it warms up, so empty buckets quickly after a thaw.
          </p>
          <p className="font-sans text-base font-semibold">Boil the same day if you can.</p>
          <p className="text-sm text-muted">
            Fresh sap makes lighter, cleaner syrup. Aim for {IDEAL_BRIX.low} to {IDEAL_BRIX.high}° Brix.
          </p>
        </section>
      </div>
    </div>
  );
}
