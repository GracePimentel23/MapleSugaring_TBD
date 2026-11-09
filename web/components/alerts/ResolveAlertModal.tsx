"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AlertIcon from "@/components/alerts/AlertIcon";
import { useLive } from "@/components/live/LiveProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import { lineCursor, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@/components/ui/chartTheme";
import { Button, ChartEmpty, Checkbox, cx, InfoBox, inputClass, Modal } from "@/components/ui/ui";
import { LITERS_TO_LBS } from "@/lib/units";
import type { ClubAlert, StationView } from "@/lib/types/schema";

/**
 * The resolve pop-up, shared by Resolve on the Alerts page, Next Step on the dashboard and the bell.
 * It says what happened, what to do, and records how it was handled: the note shows under Resolved.
 * Weather is the one kind with nothing to fix, so it is acknowledged instead.
 */

type Flow = "capacity" | "sapAge" | "full" | "signal" | "weight" | "weather" | "sensor" | "battery";

const flowFor: Record<ClubAlert["kind"], Flow> = {
  due: "capacity",
  sapAge: "sapAge",
  full: "full",
  offline: "signal",
  tipped: "weight",
  weather: "weather",
  sensor: "sensor",
  battery: "battery",
};

const titles: Record<Flow, string> = {
  capacity: "Reaching Capacity",
  sapAge: "Sap Waiting Too Long",
  full: "At Capacity",
  signal: "No Signal",
  weight: "Weight Change",
  weather: "Weather Alert",
  sensor: "Sensor Error",
  battery: "Low Battery",
};

/** "about 3 h", "under an hour", "more than a day" */
function untilFull(station: StationView): string {
  const lbsPerHour = station.sapFlowLph * LITERS_TO_LBS;
  const left = station.capacityLbs - station.currentLbs;
  if (left <= 0) return "Full now";
  if (lbsPerHour <= 0.01) return "Not filling";
  const hours = left / lbsPerHour;
  if (hours < 1) return "Under an hour";
  if (hours > 24) return "More than a day";
  return `About ${Math.round(hours)} h`;
}

/** Hours from now until 8 AM tomorrow, for "Tomorrow morning". */
function hoursUntilTomorrowMorning(): number {
  const now = new Date();
  const morning = new Date(now);
  morning.setDate(now.getDate() + 1);
  morning.setHours(8, 0, 0, 0);
  return (morning.getTime() - now.getTime()) / 3_600_000;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 font-sans text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-body text-text marker:text-muted">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

/** One radio-style choice card. */
function Choice({
  selected,
  onSelect,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
        selected ? "border-accent bg-accent-light" : "border-border bg-white hover:border-accent/40",
      )}
    >
      <span
        className={cx(
          "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-accent" : "border-[#9CA39A]",
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
      </span>
      <span>
        <span className="block font-sans text-body font-semibold">{title}</span>
        {detail ? <span className="block text-sm text-muted">{detail}</span> : null}
      </span>
    </button>
  );
}

/** The bucket's weight around a sudden change, from raw readings (managers and up can read them). */
function WeightGraph({ bucketId }: { bucketId: number }) {
  const { animations } = useClubSettings();
  const [points, setPoints] = useState<{ time: string; lbs: number }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/readings?bucket=${bucketId}&limit=60`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => [])
      .then((rows: { measured_at: string; weight_kg: number | null }[]) => {
        if (cancelled) return;
        setPoints(
          rows
            .filter((row) => row.weight_kg !== null)
            .reverse()
            .map((row) => ({
              time: new Date(row.measured_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
              lbs: Math.round(row.weight_kg! * 2.20462 * 10) / 10,
            })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [bucketId]);

  if (points === null) return <ChartEmpty height={140} message="Loading readings…" />;
  if (points.length < 2) return <ChartEmpty height={140} />;
  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
          <XAxis dataKey="time" hide />
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            cursor={lineCursor}
            formatter={(value) => [`${value} lbs`, "Weight"]}
          />
          <Line
            type="linear"
            dataKey="lbs"
            stroke="var(--color-status-problem)"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={animations}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ResolveAlertModal({ alert, onClose }: { alert: ClubAlert; onClose: () => void }) {
  const { day } = useLive();
  const { user, can } = useSession();
  const { weight, weightUnit } = useClubSettings();
  const stations = useStationCards();
  const { resolve, snooze, logCollection, addNote } = useStationState();
  const station = stations.find((item) => item.bucketId === alert.bucketId) ?? null;
  const flow = flowFor[alert.kind];
  const canAct = can("alerts:resolve");

  const [choice, setChoice] = useState<string | null>(null);
  const [lbs, setLbs] = useState(station ? String(station.currentLbs) : "");
  const [emptied, setEmptied] = useState(false);
  const [snoozeHours, setSnoozeHours] = useState(1);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // "it lost 5.2 lbs at once" in the worker's message
  const lost = Number(/lost ([\d.]+) lbs/.exec(alert.context)?.[1] ?? 0);
  const where = station ? `${station.name} · ${station.location}` : "Whole grove";

  function done(note: string) {
    resolve(alert, note);
    onClose();
  }

  /** Log what came out of the bucket, then resolve with a note saying so. */
  async function emptyAndResolve(prefix: string) {
    const amount = Number.parseFloat(lbs);
    if (station && Number.isFinite(amount) && amount > 0) {
      setSaving(true);
      const ok = await logCollection({
        entries: [{ bucketId: station.bucketId, lbs: Math.round(amount * 10) / 10, collectedBy: user.name }],
        batchId: "",
        loggedBy: user.name,
        date: day.date,
        note: "",
      });
      setSaving(false);
      if (!ok) return;
      done(`${prefix}, ${Math.round(amount * 10) / 10} lbs logged`);
    } else done(prefix);
  }

  async function flagStation(note: string, resolution: string) {
    if (station) {
      setSaving(true);
      await addNote(station.bucketId, note);
      setSaving(false);
    }
    done(resolution);
  }

  const weightField = (label: string) => (
    <label className="mt-3 block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={lbs}
          onChange={(event) => setLbs(event.target.value)}
          className={cx(inputClass, "max-w-40")}
        />
        <span className="text-sm text-muted">lbs</span>
      </div>
    </label>
  );

  let body: ReactNode = null;
  let footer: ReactNode = null;
  const cancel = (
    <Button variant="outline" className="border-border text-text" onClick={onClose}>
      Cancel
    </Button>
  );

  if (flow === "capacity" || flow === "sapAge") {
    body = (
      <>
        {station ? (
          <div className="mb-5 grid grid-cols-3 gap-3">
            <InfoBox label="Level" value={Math.round(station.fillPercent)} unit="%" />
            {flow === "capacity" ? (
              <InfoBox label="Fill rate" value={(station.sapFlowLph * LITERS_TO_LBS).toFixed(1)} unit="lbs/h" />
            ) : (
              <InfoBox label="Sap age" value={station.sapAgeHours} unit="h" />
            )}
            <InfoBox label="Until full" value={untilFull(station)} />
          </div>
        ) : null}
        <Section title="What to do">
          <p className="mb-3 text-body text-muted">
            {flow === "capacity"
              ? "Plan to empty it before it overflows. Get a haul ready, or a backup bucket, and make room in storage or at the evaporator."
              : "Sap starts to spoil once it has sat thawed for a day, sooner in warm weather. Empty it and boil or chill it soon."}
          </p>
          <div role="radiogroup" aria-label="What are you doing about it?" className="space-y-2">
            <Choice
              selected={choice === "now"}
              onSelect={() => setChoice("now")}
              title="Emptying now"
              detail="Logs the collection with the weight below."
            />
            {choice === "now" ? weightField("Weight collected") : null}
            <Choice
              selected={choice === "later"}
              onSelect={() => setChoice("later")}
              title="Schedule for later"
              detail="Hides the alert and brings it back as a reminder."
            />
            {choice === "later" ? (
              <div className="flex flex-wrap gap-2 pt-1 pl-1">
                {[
                  [1, "In 1 hour"],
                  [3, "In 3 hours"],
                  [hoursUntilTomorrowMorning(), "Tomorrow morning"],
                ].map(([hours, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSnoozeHours(hours as number)}
                    className={cx(
                      "rounded-full border px-3 py-1.5 font-sans text-sm font-semibold",
                      snoozeHours === hours ? "border-accent bg-accent text-white" : "border-border bg-white",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <Choice
              selected={choice === "switch"}
              onSelect={() => setChoice("switch")}
              title="Switched to another tank"
              detail="A backup bucket is taking the sap for now."
            />
          </div>
        </Section>
      </>
    );
    footer = (
      <>
        {cancel}
        <Button
          disabled={!choice || saving || !canAct}
          onClick={() => {
            if (choice === "now") void emptyAndResolve("Emptied");
            else if (choice === "later") {
              snooze(alert, snoozeHours);
              onClose();
            } else done("Switched to another tank");
          }}
        >
          {choice === "later" ? "Snooze" : saving ? "Saving…" : "Resolve"}
        </Button>
      </>
    );
  }

  if (flow === "full") {
    body = (
      <>
        <div className="mb-5 rounded-2xl border border-attention-border bg-attention-bg px-4 py-3">
          <p className="font-sans text-body font-bold text-status-problem">Empty this bucket now.</p>
          <p className="mt-1 text-sm text-text">
            It is at the full mark, so sap may be overflowing and lost. Sap spoils quickly in warm weather: boil it or
            keep it cold once it is out.
          </p>
        </div>
        {station ? (
          <div className="mb-5 grid grid-cols-2 gap-3">
            <InfoBox label="Current" value={weight(station.currentLbs, false, true)} unit={weightUnit} />
            <InfoBox label="Target" value={weight(station.capacityLbs, false)} unit={weightUnit} />
          </div>
        ) : null}
        <Section title="Once it is emptied">
          <Checkbox checked={emptied} onChange={setEmptied} label="Tank emptied" />
          {weightField("Volume collected (optional)")}
        </Section>
      </>
    );
    footer = (
      <>
        {cancel}
        <Button disabled={!emptied || saving || !canAct} onClick={() => void emptyAndResolve("Tank emptied")}>
          {saving ? "Saving…" : "Confirm Emptied"}
        </Button>
      </>
    );
  }

  if (flow === "signal") {
    const items = [
      "Check the battery or power",
      "Check it is in range of the gateway",
      "Check the antenna for ice, snow or damage",
      "Power-cycle the sensor",
    ];
    const ticked = items.filter((item) => checked[item]);
    body = (
      <Section title="Work through the checklist">
        <p className="mb-3 text-body text-muted">
          The sensor stopped reporting{station ? ` at ${station.lastUpdated}` : ""}. When it reconnects the alert clears
          by itself and readings pick up again.
        </p>
        <div className="space-y-3">
          {items.map((item) => (
            <Checkbox
              key={item}
              checked={Boolean(checked[item])}
              onChange={(value) => setChecked((current) => ({ ...current, [item]: value }))}
              label={item}
            />
          ))}
        </div>
      </Section>
    );
    footer = (
      <>
        <Button
          variant="outline"
          className="border-border text-text"
          disabled={saving || !canAct}
          onClick={() =>
            void flagStation(
              `Needs service: no signal after checking ${ticked.length ? ticked.join(", ").toLowerCase() : "nothing yet"}.`,
              "Still not working: flagged for service",
            )
          }
        >
          Still Not Working
        </Button>
        <Button
          disabled={saving || !canAct}
          onClick={() => done(ticked.length ? `Checked: ${ticked.join(", ").toLowerCase()}` : "Signal is back")}
        >
          Signal is Back
        </Button>
      </>
    );
  }

  if (flow === "weight") {
    const reasons: [string, string, string][] = [
      ["emptied", "I emptied it", "Logs the sap that came out as a collection."],
      ["leak", "Leak or damage", "Go inspect the bucket, spout and lid."],
      ["weather", "Weather or rain", "Rain or snowmelt can dilute the sap."],
      ["unknown", "Unknown", "Logged as unexplained."],
    ];
    body = (
      <>
        <Section title={lost ? `It lost ${lost} lbs at once` : "A sudden weight change"}>
          {station ? <WeightGraph bucketId={station.bucketId} /> : null}
          <p className="mt-3 text-sm text-muted">
            A sudden drop can be a leak, a spill, an animal, tampering, or someone emptying it without logging it.
          </p>
        </Section>
        <Section title="What happened?">
          <div role="radiogroup" aria-label="What happened?" className="space-y-2">
            {reasons.map(([id, title, detail]) => (
              <Choice
                key={id}
                selected={choice === id}
                onSelect={() => {
                  setChoice(id);
                  if (id === "emptied" && lost) setLbs(String(lost));
                }}
                title={title}
                detail={detail}
              />
            ))}
          </div>
          {choice === "emptied" ? weightField("Weight collected") : null}
        </Section>
      </>
    );
    footer = (
      <>
        {cancel}
        <Button
          disabled={!choice || saving || !canAct}
          onClick={() => {
            if (choice === "emptied") void emptyAndResolve("Emptied it");
            else done(reasons.find(([id]) => id === choice)![1]);
          }}
        >
          {saving ? "Saving…" : "Resolve"}
        </Button>
      </>
    );
  }

  if (flow === "weather") {
    const freeze = /freeze/i.test(alert.title);
    body = (
      <>
        <Section title="What to expect">
          <p className="text-body text-muted">
            {freeze
              ? "Sap runs best with freezing nights and days above freezing. A hard freeze stops the flow and can crack buckets, spouts and lines."
              : "Sap runs best with freezing nights and days above freezing. A long warm spell slows the run and can end the season."}
          </p>
        </Section>
        <Section title="What to do">
          <Steps
            items={
              freeze
                ? [
                    "Empty buckets so ice does not crack them",
                    "Check lines and spouts before and after",
                    "Secure lids and loose equipment if it is windy",
                  ]
                : [
                    "Empty every bucket today: warm sap spoils faster",
                    "Boil or chill what you collect",
                    "Check for leaks once it warms up",
                  ]
            }
          />
        </Section>
        <Section title="Timing">
          <p className="text-body text-muted">{alert.context}</p>
        </Section>
      </>
    );
    footer = (
      <>
        {cancel}
        <Button disabled={!canAct} onClick={() => done("Acknowledged")}>
          Acknowledge
        </Button>
      </>
    );
  }

  if (flow === "sensor") {
    body = (
      <>
        <div className="mb-5 rounded-2xl bg-bg px-4 py-3">
          <p className="text-sm text-muted">Error</p>
          <p className="font-sans text-body font-semibold">{alert.title}</p>
          <p className="mt-1 text-sm text-muted">{alert.context}</p>
        </div>
        <Section title="Try these in order">
          <Steps
            items={[
              "Clean the load cell and check for ice or debris",
              "Recalibrate or zero it from the Demo page",
              "Restart the sensor",
              "Replace it if the error comes back",
            ]}
          />
        </Section>
      </>
    );
    footer = (
      <>
        <Button
          variant="outline"
          className="border-border text-text"
          disabled={saving || !canAct}
          onClick={() =>
            void flagStation(
              "Needs replacement: the sensor keeps erroring. Treat its readings as unreliable.",
              "Still erroring: flagged for replacement",
            )
          }
        >
          Still Erroring
        </Button>
        <Button disabled={saving || !canAct} onClick={() => done("Fixed")}>
          Fixed
        </Button>
      </>
    );
  }

  if (flow === "battery") {
    body = (
      <Section title="What to do">
        <Steps
          items={[
            "Take a spare battery from the shed",
            "Swap it in and close the case tightly",
            "Check a new reading comes in",
          ]}
        />
      </Section>
    );
    footer = (
      <>
        {cancel}
        <Button disabled={!canAct} onClick={() => done("Battery replaced")}>
          Battery Replaced
        </Button>
      </>
    );
  }

  return (
    <Modal
      title={titles[flow]}
      eyebrow={where}
      width="lg"
      badge={
        <span
          className={cx(
            "rounded-full px-2.5 py-1 font-sans text-xs font-semibold",
            alert.severity === "critical" ? "bg-attention-bg text-status-problem" : "bg-[#FBF1D6] text-status-due",
            flow === "weather" && "bg-weather-bg text-weather-text",
          )}
        >
          {flow === "weather" ? "Info" : alert.severity === "critical" ? "Critical" : "Warning"}
        </span>
      }
      onClose={onClose}
      footer={canAct ? footer : cancel}
    >
      <div className="mb-5 flex items-start gap-3">
        <AlertIcon kind={alert.kind} size={24} />
        <div>
          <p className="font-sans text-body font-semibold">{alert.title}</p>
          <p className="text-sm text-muted">{alert.advice}</p>
        </div>
      </div>
      {body}
    </Modal>
  );
}
