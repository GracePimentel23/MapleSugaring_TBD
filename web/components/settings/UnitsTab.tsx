"use client";

import Link from "next/link";
import { useState } from "react";
import { useLive } from "@/components/live/LiveProvider";
import { sapSeasonOf } from "@/lib/live/day";
import { PencilIcon, PlusIcon } from "@/components/icons";
import {
  useClubSettings,
  type SeasonRecord,
  type TempUnit,
  type WeightUnit,
} from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { Button, Card, CardTitle, cx, DataTable, Field, inputClass, Modal } from "@/components/ui/ui";
import { shortDate } from "@/lib/time";

function Radio<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-6">
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-center gap-2 text-lg">
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 accent-[var(--color-accent-mid)]"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function EditSeasonModal({
  season,
  onClose,
}: {
  season: SeasonRecord | null;
  onClose: () => void;
}) {
  const { day } = useLive();
  const { seasons, setSeasons } = useClubSettings();
  const isNew = season === null;
  // A new season defaults to the coming one, mid-February to mid-April.
  const coming = sapSeasonOf(day.date) + (day.date.slice(5) > "04-15" && day.date.slice(5) < "07-01" ? 1 : 0);
  const [name, setName] = useState(season?.name ?? `Season ${coming}`);
  const [start, setStart] = useState(season?.start ?? `${coming}-02-15`);
  const [end, setEnd] = useState(season?.end ?? `${coming}-04-15`);

  function save() {
    if (isNew) {
      setSeasons([
        { name, start, end, status: "active" },
        ...seasons.map((item) => ({ ...item, status: "closed" as const })),
      ]);
    } else {
      setSeasons(seasons.map((item) => (item.name === season.name ? { ...item, name, start, end } : item)));
    }
    onClose();
  }

  function close() {
    if (!season) return;
    setSeasons(seasons.map((item) => (item.name === season.name ? { ...item, status: "closed" } : item)));
    onClose();
  }

  return (
    <Modal title={isNew ? "Start new season" : "Edit season"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Season name">
          <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className={inputClass} />
          </Field>
          <Field label="End date">
            <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className={inputClass} />
          </Field>
        </div>
        <p className="text-sm text-muted">
          Dates change which days count toward this season. Collections outside the dates are listed
          so none are lost.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{isNew ? "Start Season" : "Save Dates"}</Button>
        </div>
        {!isNew ? (
          <div className="border-t border-border pt-5 pb-6">
            <h3 className="font-sans text-lg font-semibold">Close season</h3>
            <p className="mb-4 text-sm text-muted">
              Locks all data for {season.name.replace("Season ", "")}. Only Owner / IT can reopen it.
            </p>
            <Button variant="outline" className="border-border text-text" onClick={close}>
              Close Season
            </Button>
          </div>
        ) : (
          <div className="pb-4" />
        )}
      </div>
    </Modal>
  );
}

export default function UnitsTab() {
  const { day } = useLive();
  const { can, view, shows } = useSession();
  const { weightUnit, setWeightUnit, tempUnit, setTempUnit, seasons, setSeasons, weight, syrupGoalLbs, setSyrupGoalLbs } =
    useClubSettings();
  const [editing, setEditing] = useState<SeasonRecord | "new" | null>(null);
  const canEditSeason = can("seasons:manage");

  // Totals come from the season summaries the analysis uses.
  const totals = new Map(day.seasons.map((season) => [season.season, season]));

  return (
    <>
      <Card className="md:px-8 md:py-7">
        <CardTitle title="Units" subtitle="Data is stored once and shown in the units you pick." />
        <div className="flex flex-wrap gap-x-20 gap-y-4">
          <div>
            <p className="mb-2 text-sm text-muted">Temperature</p>
            <Radio<TempUnit>
              name="temperature"
              value={tempUnit}
              onChange={setTempUnit}
              options={[
                { value: "F", label: "°F" },
                { value: "C", label: "°C" },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm text-muted">Weight</p>
            <Radio<WeightUnit>
              name="weight"
              value={weightUnit}
              onChange={setWeightUnit}
              options={[
                { value: "lbs", label: "lbs" },
                { value: "kg", label: "kg" },
              ]}
            />
          </div>
        </div>
      </Card>

      {shows("settings.seasons") ? (
        <Card className="md:px-8 md:py-7">
          <CardTitle
            title="Seasons"
            subtitle="Managers can change the dates of the active season. Closing a season locks its data; only the Owner / IT can reopen it."
            action={
              canEditSeason ? (
                <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
                  <PlusIcon size={14} />
                  Start New Season
                </Button>
              ) : null
            }
          />
          <div className="mb-5 max-w-xs">
            <Field label="Syrup goal this season (lbs)" hint="Shown as the goal ring on Data › Overview.">
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={syrupGoalLbs}
                disabled={!canEditSeason}
                onChange={(event) => setSyrupGoalLbs(Math.max(Number.parseFloat(event.target.value) || 0, 0))}
                className={inputClass}
              />
            </Field>
          </div>
          <DataTable
            columns={[
              { key: "season", label: "Season" },
              { key: "dates", label: "Dates" },
              { key: "sap", label: "Sap" },
              { key: "syrup", label: "Syrup" },
              { key: "status", label: "Status" },
              { key: "action", label: "" },
            ]}
            rows={seasons.map((season) => {
              const summary = totals.get(season.name);
              const active = season.status === "active";
              return {
                key: season.name,
                cells: {
                  season: season.name.replace("Season ", ""),
                  dates: `${shortDate(season.start)} to ${shortDate(season.end)}`,
                  sap: summary ? weight(summary.totalSapLbs) : "—",
                  syrup: summary ? weight(summary.totalSyrupLbs) : "—",
                  status: (
                    <span className={cx(active && "font-semibold text-status-online")}>
                      {active ? "Active" : "Closed"}
                    </span>
                  ),
                  action: active ? (
                    canEditSeason ? (
                      <button
                        type="button"
                        onClick={() => setEditing(season)}
                        aria-label={`Edit ${season.name}`}
                        className="rounded-lg p-1.5 hover:bg-bg"
                      >
                        <PencilIcon size={20} />
                      </button>
                    ) : null
                  ) : view === "owner" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSeasons(seasons.map((item) => (item.name === season.name ? { ...item, status: "active" } : item)))
                      }
                      className="font-semibold text-accent-mid hover:underline"
                    >
                      Reopen
                    </button>
                  ) : (
                    <Link href="/data/analysis" className="font-semibold text-accent-mid hover:underline">
                      View
                    </Link>
                  ),
                },
              };
            })}
          />
        </Card>
      ) : null}

      {editing ? (
        <EditSeasonModal season={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
