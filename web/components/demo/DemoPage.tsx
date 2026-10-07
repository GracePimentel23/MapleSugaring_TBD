"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import LiveRefresh from "@/components/common/LiveRefresh";
import { sendJson } from "@/lib/api/client";
import type { DemoState, StationMode } from "./types";

/**
 * Temporary Demo tab (sponsor video). Everything here calls /api/demo/* on the worker
 * (worker/src/demo.js) and then re-renders the page with fresh data.
 */

const MODES: { id: StationMode; label: string; help: string; color: string; bg: string }[] = [
  {
    id: "normal",
    label: "Normal",
    help: "A sudden drop means the bucket tipped: critical alert (and an email, if set up).",
    color: "#15803D",
    bg: "rgba(22,163,74,0.1)",
  },
  {
    id: "collection",
    label: "Collection",
    help: "Emptying the bucket: the sap taken out is logged as a collection, no alert.",
    color: "#1D4ED8",
    bg: "rgba(59,130,246,0.12)",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    help: "Working on the station: weight added or removed counts for nothing and raises no alerts.",
    color: "#B45309",
    bg: "rgba(245,158,11,0.14)",
  },
];

const GYM_PLATES_LBS = [5, 10, 25, 45];

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid var(--color-border)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-sans text-base font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Button({
  children,
  onClick,
  busy,
  tone = "default",
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  busy?: boolean;
  tone?: "default" | "primary" | "danger";
  disabled?: boolean;
}) {
  const styles = {
    default: { background: "#fff", color: "var(--color-text)", border: "1px solid var(--color-border)" },
    primary: { background: "var(--color-accent)", color: "#fff", border: "1px solid var(--color-accent)" },
    danger: { background: "#fff", color: "#B91C1C", border: "1px solid rgba(220,38,38,0.4)" },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="rounded-xl px-4 py-2.5 font-sans text-sm font-medium transition-opacity disabled:opacity-50"
      style={styles}
    >
      {busy ? "Working..." : children}
    </button>
  );
}

/** "12 s ago", ticking every second. Empty until mounted so server and client HTML match. */
function Ago({ at }: { at: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (!at || now === null) return null;
  const seconds = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  return <>{seconds < 90 ? `${seconds} s ago` : `${Math.round(seconds / 60)} min ago`}</>;
}

function Sparkline({ points }: { points: { lbs: number }[] }) {
  if (points.length < 2) return null;
  const width = 320;
  const height = 56;
  const max = Math.max(...points.map((p) => p.lbs), 1);
  const step = width / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - (p.lbs / max) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-14 w-full" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke="var(--color-accent-mid)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function DemoPage({ demo }: { demo: DemoState | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [showCalibration, setShowCalibration] = useState(false);

  if (!demo) {
    return (
      <div className="p-6 text-sm text-muted">
        The demo controls are not available: the API is not connected, or this account may not use them.
      </div>
    );
  }
  const station = demo.station;

  async function run(id: string, path: string, body: Record<string, unknown>, done?: string) {
    setBusy(id);
    setMessage(null);
    try {
      await sendJson("POST", path, body);
      if (done) setMessage({ text: done, error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: (error as Error).message, error: true });
    } finally {
      setBusy(null);
    }
  }

  const bucketId = station?.bucketId;
  const mode = MODES.find((item) => item.id === station?.mode) ?? MODES[0];
  const tipped = demo.alerts.filter((alert) => alert.alert_type === "bucket_tipped");

  return (
    <div className="w-full max-w-[880px]" style={{ padding: "24px 27px" }}>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="font-sans text-2xl font-semibold md:text-3xl">Demo</h1>
        <LiveRefresh source="live" seconds={2} />
      </div>
      <p className="mb-5 text-sm text-muted">
        Temporary controls for recording the sponsor update. Changes here affect the real data.
      </p>

      {message ? (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{
            background: message.error ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.08)",
            color: message.error ? "#B91C1C" : "#15803D",
          }}
        >
          {message.text}
        </div>
      ) : null}

      {!station ? (
        <Card title="No station yet">
          <p className="text-sm text-muted">
            Nothing has reported yet. Start the bridge on the computer with the gateway plugged in.
          </p>
        </Card>
      ) : (
        <>
          {demo.stations.length > 1 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {demo.stations.map((item) => (
                <button
                  key={item.bucketId}
                  type="button"
                  onClick={() => router.push(`/demo?bucket=${item.bucketId}`)}
                  className="rounded-full px-3 py-1.5 text-sm"
                  style={{
                    background: item.bucketId === bucketId ? "var(--color-accent)" : "#fff",
                    color: item.bucketId === bucketId ? "#fff" : "var(--color-text)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : null}

          {tipped.length ? (
            <div
              className="mb-5 rounded-2xl px-5 py-4"
              style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.35)", color: "#991B1B" }}
            >
              <div className="font-sans text-lg font-semibold">Bucket tipped!</div>
              <div className="text-sm">{tipped[0].message}</div>
              <div className="mt-1 text-xs">
                {demo.email.configured ? `Email sent to ${demo.email.to.join(", ")}` : "Email alerts are not set up yet"}
              </div>
            </div>
          ) : null}

          <Card
            title={`${station.name} on the scale`}
            right={
              <span className="text-xs text-muted">
                {station.online ? "Online" : "Offline"}
                {station.rssi !== null ? ` · ${station.rssi} dBm` : ""}
              </span>
            }
          >
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div className="font-sans font-semibold leading-none" style={{ fontSize: 72 }}>
                {station.weightLbs === null ? "--" : station.weightLbs.toFixed(1)}
                <span className="ml-2 text-2xl font-medium text-muted">lbs</span>
              </div>
              <div className="pb-2 text-sm text-muted">
                <div>
                  Updated <Ago at={station.measuredAt} />
                  {station.settled ? " · steady" : station.measuredAt ? " · settling" : ""}
                </div>
                <div>
                  Tare {station.tareLbs} lbs · calibration ×{station.calibrationFactor}
                </div>
              </div>
            </div>
            <Sparkline points={station.recent} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button busy={busy === "tare"} tone="primary" onClick={() => run("tare", "/demo/tare", { bucketId }, "Tared: the scale reads 0 lbs now.")}>
                Tare (zero the scale)
              </Button>
            </div>
          </Card>

          <Card
            title="Mode"
            right={
              station.modeUntil ? (
                <span className="text-xs text-muted">
                  back to Normal at{" "}
                  {new Date(station.modeUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              ) : null
            }
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {MODES.map((item) => {
                const active = item.id === station.mode;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => run(`mode-${item.id}`, "/demo/mode", { bucketId, mode: item.id })}
                    className="rounded-xl px-4 py-2.5 font-sans text-sm font-medium"
                    style={{
                      background: active ? item.bg : "#fff",
                      color: active ? item.color : "var(--color-muted)",
                      border: `1px solid ${active ? item.color : "var(--color-border)"}`,
                    }}
                  >
                    {busy === `mode-${item.id}` ? "Switching..." : item.label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm" style={{ color: mode.color }}>
              {mode.help}
            </p>
            {station.mode !== "normal" ? (
              <p className="mt-1 text-xs text-muted">Switches back to Normal by itself after {demo.modeMinutes} minutes.</p>
            ) : null}
          </Card>

          <Card title={`Open alerts (${demo.alerts.length})`}>
            {demo.alerts.length ? (
              <ul className="mb-4 flex flex-col gap-2">
                {demo.alerts.map((alert) => (
                  <li key={alert.id} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: alert.severity === "critical" ? "#DC2626" : alert.severity === "warning" ? "#F59E0B" : "#9CA3AF" }}
                    />
                    <span className="flex-1">{alert.message}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-muted">None.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button busy={busy === "clear"} onClick={() => run("clear", "/demo/clear-alerts", {}, "All alerts cleared.")}>
                Clear all alerts
              </Button>
              <Button
                busy={busy === "email"}
                disabled={!demo.email.configured}
                onClick={() => run("email", "/demo/test-email", {}, `Test email sent to ${demo.email.to.join(", ")}.`)}
              >
                Send test email
              </Button>
              <Button
                busy={busy === "reset"}
                tone="danger"
                onClick={() => {
                  if (window.confirm(`Delete every reading, alert and automatic collection for ${station.name}? Tare and calibration stay.`)) {
                    void run("reset", "/demo/reset", { bucketId }, "History reset.");
                  }
                }}
              >
                Reset history
              </Button>
            </div>
            {!demo.email.configured ? (
              <p className="mt-2 text-xs text-muted">Email alerts need RESEND_API_KEY and ALERT_EMAIL_TO on the API.</p>
            ) : null}
          </Card>

          <Card
            title="Calibration check (optional)"
            right={
              <button type="button" className="text-sm text-muted underline" onClick={() => setShowCalibration((open) => !open)}>
                {showCalibration ? "Hide" : "Show"}
              </button>
            }
          >
            {!showCalibration ? (
              <p className="text-sm text-muted">
                Only needed if the weight looks off. Uses gym plates (5, 10, 25, 45 lb), so do it near the gym.
              </p>
            ) : (
              <>
                <ol className="mb-3 list-decimal pl-5 text-sm text-muted">
                  <li>Switch to Maintenance mode so the plates don&apos;t raise alerts.</li>
                  <li>With the scale empty, press Tare.</li>
                  <li>Put one plate on, wait for &quot;steady&quot;, then press the button for that plate. Repeat with others.</li>
                  <li>Press Apply. Gym plates can be 1 to 3% off their label, so use the heaviest you trust.</li>
                </ol>
                <div className="mb-3 flex flex-wrap gap-2">
                  {GYM_PLATES_LBS.map((lbs) => (
                    <Button
                      key={lbs}
                      busy={busy === `plate-${lbs}`}
                      disabled={!station.settled}
                      onClick={() => run(`plate-${lbs}`, "/demo/calibration/points", { bucketId, knownLbs: lbs }, `Recorded the ${lbs} lb plate.`)}
                    >
                      {lbs} lb is on
                    </Button>
                  ))}
                </div>
                {demo.calibration.points.length ? (
                  <table className="mb-3 w-full text-left text-sm">
                    <thead className="text-xs text-muted">
                      <tr>
                        <th className="py-1 font-medium">Plate</th>
                        <th className="py-1 font-medium">Scale read</th>
                        <th className="py-1 font-medium">Reads now</th>
                        <th className="py-1 font-medium">Off by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demo.calibration.points.map((point) => (
                        <tr key={point.id}>
                          <td className="py-1">{point.knownLbs} lbs</td>
                          <td className="py-1">{point.measuredLbs} lbs</td>
                          <td className="py-1">{point.readsLbs} lbs</td>
                          <td className="py-1">{point.errorLbs > 0 ? "+" : ""}{point.errorLbs} lbs</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    busy={busy === "apply"}
                    tone="primary"
                    disabled={demo.calibration.suggestedFactor === null}
                    onClick={() => run("apply", "/demo/calibration/apply", { bucketId }, "Calibration applied.")}
                  >
                    Apply{demo.calibration.suggestedFactor !== null ? ` (×${demo.calibration.suggestedFactor})` : ""}
                  </Button>
                  <Button
                    busy={busy === "uncal"}
                    tone="danger"
                    onClick={() => run("uncal", "/demo/calibration/reset", { bucketId }, "Back to the node's own calibration.")}
                  >
                    Undo calibration
                  </Button>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
