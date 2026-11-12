"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { alertHeadlines, urgencyMeta, urgencyOf } from "@/components/alerts/AlertIcon";
import { ExclamationIcon } from "@/components/icons";
import { useLive } from "@/components/live/LiveProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import Select from "@/components/ui/Select";
import { lineCursor, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@/components/ui/chartTheme";
import { Button, ChartEmpty, Checkbox, cx, InfoBox, Modal, NumberBox, Steps } from "@/components/ui/ui";
import { collectionIsOpen } from "@/lib/batchStatus";
import { monthDay } from "@/lib/time";
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

/** One radio-style choice card. */
function Choice({
  selected,
  onSelect,
  title,
  detail,
  disabled = false,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cx(
        "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "border-accent bg-accent-light" : "border-border bg-white enabled:hover:border-accent/40",
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
  const router = useRouter();
  const { weight, weightUnit, maintenanceDefaults } = useClubSettings();
  const stations = useStationCards();
  const { resolve, snooze, logCollection, addNote, startEmptying, cancelEmptying, setEmptyingInto } =
    useStationState();
  const emptyMinutes = maintenanceDefaults.emptyMinutes ?? 2;
  const station = stations.find((item) => item.bucketId === alert.bucketId) ?? null;
  const flow = flowFor[alert.kind];
  const canAct = can("alerts:resolve");

  const [choice, setChoice] = useState<string | null>(null);
  const [lbs, setLbs] = useState(station ? String(station.currentLbs) : "");
  const [collectStage, setCollectStage] = useState<"intro" | "where">("intro");
  const [pauseFailed, setPauseFailed] = useState(false);
  // The weight when Start Collection was pressed: what gets logged, even once the bucket reads 0.
  const [startLbs, setStartLbs] = useState(0);
  // "new", or "existing" with the collection picked from the dropdown
  const [into, setInto] = useState<"new" | "existing">("new");
  const [existingId, setExistingId] = useState("");
  // Only collections still taking sap; most recent first.
  const openCollections = day.collections.filter((collection) =>
    collectionIsOpen(day.batches, collection.batchName),
  );
  // Adding a bucket to a logged collection is an edit, which the worker allows Managers and up.
  const canAddToExisting = can("collections:edit");
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

  /** Start Collection: pause the bucket's weight alerts, then ask where the sap goes. */
  async function beginCollection() {
    if (!station) return;
    setSaving(true);
    setStartLbs(station.currentLbs);
    const paused = await startEmptying(station, alert);
    setSaving(false);
    setPauseFailed(!paused);
    setCollectStage("where");
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
    <NumberBox label={label} value={lbs} onChange={setLbs} unit="lbs" className="mt-3 max-w-xs" />
  );

  let body: ReactNode = null;
  let footer: ReactNode = null;
  const cancel = (
    <Button variant="outline" className="border-border text-text" onClick={onClose}>
      Cancel
    </Button>
  );

  // Bucket Full, sap waiting too long, and "Empty it now": the collection steps, then where the sap goes.
  const collectSteps = [
    <>
      Press <span className="font-semibold">Start Collection</span>. Weight alerts on this bucket pause for{" "}
      {emptyMinutes} minute{emptyMinutes === 1 ? "" : "s"}, so emptying it is not taken for a spill.
    </>,
    "Empty the bucket into the collection barrel.",
    <>
      Put the bucket back and press <span className="font-semibold">Finished Collection</span>.
    </>,
  ];
  const startButton = (
    <Button disabled={saving || !canAct || !station} onClick={() => void beginCollection()}>
      {saving ? "Starting…" : "Start Collection"}
    </Button>
  );

  if (collectStage === "where" && station) {
    body = (
      <>
        {pauseFailed ? (
          <p className="mb-4 flex items-start gap-2 font-sans text-body font-semibold text-status-problem">
            <ExclamationIcon size={20} strokeWidth={2} className="mt-px shrink-0" />
            Weight alerts could not be paused (a Manager has to start that), so empty it gently.
          </p>
        ) : (
          <p className="mb-4 flex items-start gap-2 font-sans text-body font-semibold text-accent">
            <ExclamationIcon size={20} strokeWidth={2} className="mt-px shrink-0" />
            Weight alerts on {station.name} are paused for {emptyMinutes} minute{emptyMinutes === 1 ? "" : "s"}.
          </p>
        )}
        <Section title="Where is this sap going?">
          <div role="radiogroup" aria-label="Where is this sap going?" className="space-y-2">
            <Choice selected={into === "new"} onSelect={() => setInto("new")} title="Start a new collection" />
            <Choice
              selected={into === "existing"}
              onSelect={() => setInto("existing")}
              title="Add to an existing collection"
              detail={
                !canAddToExisting
                  ? "Managers only for now: adding to a logged collection is an edit."
                  : openCollections.length === 0
                    ? "No collection is open right now."
                    : undefined
              }
              disabled={!canAddToExisting || openCollections.length === 0}
            />
            {into === "existing" ? (
              <div className="pt-1 pl-1">
                <Select
                  label="Open collection"
                  value={existingId}
                  onChange={setExistingId}
                  placeholder="Choose a collection"
                  options={openCollections.map((collection) => ({
                    value: collection.id,
                    label: `Collection #${String(collection.collectionNumber).padStart(2, "0")}`,
                    detail: `${monthDay(collection.date)} · ${collection.entries.map((entry) => entry.bucketName).join(", ")} · ${weight(collection.totalLbs)}`,
                  }))}
                />
              </div>
            ) : null}
          </div>
        </Section>
        <Steps items={collectSteps} current={1} />
      </>
    );
    footer = (
      <>
        <Button
          variant="outline"
          className="border-border text-text"
          onClick={() => {
            cancelEmptying(station.bucketId);
            onClose();
          }}
        >
          Cancel Collection
        </Button>
        <Button
          disabled={into === "existing" && !existingId}
          onClick={() => {
            const target = into === "existing" ? existingId : "new";
            setEmptyingInto(station.bucketId, target);
            router.push(`/data/collections?empty=${station.bucketId}&into=${target}&lbs=${startLbs}`);
            onClose();
          }}
        >
          Continue
        </Button>
      </>
    );
  } else if (flow === "full" || flow === "sapAge") {
    body = (
      <>
        {flow === "sapAge" ? (
          <p className="mb-4 rounded-xl bg-[#FBF1D6] px-4 py-3 text-body text-text">
            Sap starts to spoil once it has sat thawed for about a day, sooner in warm weather. Empty this bucket and
            boil or chill the sap soon.
          </p>
        ) : null}
        {station ? (
          <div className="mb-5 grid grid-cols-3 gap-2.5">
            <InfoBox label="Weight" value={weight(station.currentLbs, false, true)} unit={weightUnit} />
            <InfoBox
              label="Level"
              value={Math.round(station.fillPercent)}
              unit="%"
              // Full is critical: the level is the reason, so it is tinted red.
              className={flow === "full" ? "bg-attention-bg! text-status-problem" : undefined}
            />
            {flow === "sapAge" ? (
              <InfoBox label="Sap age" value={station.sapAgeHours} unit="h" />
            ) : (
              <InfoBox label="Target" value={weight(station.capacityLbs, false)} unit={weightUnit} />
            )}
          </div>
        ) : null}
        <Section title="How to collect it">
          <Steps items={collectSteps} current={0} />
        </Section>
      </>
    );
    footer = (
      <>
        {cancel}
        {startButton}
      </>
    );
  } else if (flow === "capacity") {
    body = (
      <>
        {station ? (
          <div className="mb-5 grid grid-cols-3 gap-2.5">
            <InfoBox label="Level" value={Math.round(station.fillPercent)} unit="%" />
            <InfoBox label="Fill rate" value={(station.sapFlowLph * LITERS_TO_LBS).toFixed(1)} unit="lbs/h" />
            <InfoBox label="Until full" value={untilFull(station)} />
          </div>
        ) : null}
        <Section title="What are you doing about it?">
          <div role="radiogroup" aria-label="What are you doing about it?" className="space-y-2">
            <Choice
              selected={choice === "now"}
              onSelect={() => setChoice("now")}
              title="Empty it now"
              detail="Start a collection for this bucket."
            />
            {choice === "now" ? (
              <div className="py-2 pl-1">
                <Steps items={collectSteps} current={0} />
              </div>
            ) : null}
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
              title="Switched to a backup bucket"
              detail="Another bucket is taking the sap for now."
            />
          </div>
        </Section>
      </>
    );
    footer = (
      <>
        {cancel}
        {choice === "now" ? (
          startButton
        ) : (
          <Button
            disabled={!choice || !canAct}
            onClick={() => {
              if (choice === "later") {
                snooze(alert, snoozeHours);
                onClose();
              } else done("Switched to a backup bucket");
            }}
          >
            {choice === "later" ? "Snooze" : "Resolve"}
          </Button>
        )}
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
      title={alertHeadlines[alert.kind]}
      eyebrow={where}
      width="lg"
      tag={
        <span
          className="rounded-full px-2.5 py-1 font-sans text-xs font-semibold whitespace-nowrap"
          style={{ background: urgencyMeta[urgencyOf(alert)].bg, color: urgencyMeta[urgencyOf(alert)].color }}
        >
          {urgencyMeta[urgencyOf(alert)].label}
        </span>
      }
      onClose={onClose}
      footer={canAct ? footer : cancel}
    >
      {/* The full title ("sap has waited 164 hours"); the list only shows the short one. Bucket Full
          and the collecting step leave it out: the heading and eyebrow already say it. */}
      {flow === "full" || collectStage === "where" ? null : (
        <p className="mb-5 font-sans text-body font-semibold">{alert.title}</p>
      )}
      {body}
    </Modal>
  );
}
