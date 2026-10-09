"use client";

import { useState, type ReactNode } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { currentUser } from "@/lib/data/stationNotes";
import { CAPACITY_LBS, LOW_BATTERY_THRESHOLD } from "@/lib/demo/profiles";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-text outline-none focus:border-accent";

function Section({
  title,
  description,
  children,
  wide = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-white p-5 shadow-sm ${wide ? "lg:col-span-2" : ""}`}
    >
      <h2 className="font-sans text-base font-semibold">{title}</h2>
      <p className="mt-0.5 mb-4 text-xs text-muted">{description}</p>
      {children}
    </section>
  );
}

function Toggle({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{detail}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className="h-6 w-10 shrink-0 rounded-full p-1 transition-colors"
        style={{ background: value ? "var(--color-accent)" : "var(--color-progress-track)" }}
      >
        <span
          className="block h-4 w-4 rounded-full bg-white transition-transform"
          style={{ transform: value ? "translateX(16px)" : "none" }}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { day } = useDemo();
  const [stationAlerts, setStationAlerts] = useState(true);
  const [weatherAlerts, setWeatherAlerts] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [emailCopies, setEmailCopies] = useState(false);

  return (
    <div className="min-h-full w-full p-4 md:p-6">
      <div className="mb-6">
        <h1 className="font-sans text-2xl font-semibold md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your account, alerts, stations, and season preferences.
        </p>
      </div>

      <div className="grid w-full gap-4 lg:grid-cols-2">
        <Section title="Profile" description="How you appear on notes and collections.">
          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted">
              Display name
              <input defaultValue={currentUser.name} className={inputClass} />
            </label>
            <label className="block text-xs font-medium text-muted">
              Email
              <input type="email" defaultValue={currentUser.email} className={inputClass} />
            </label>
            <label className="block text-xs font-medium text-muted">
              Role
              <input
                disabled
                value={currentUser.roleLabel}
                className={`${inputClass} bg-bg text-muted`}
              />
            </label>
          </div>
        </Section>

        <Section title="Notifications" description="What shows up under the bell.">
          <Toggle
            label="Station alerts"
            detail="Hardware errors, full buckets, and low batteries"
            value={stationAlerts}
            onChange={setStationAlerts}
          />
          <Toggle
            label="Weather alerts"
            detail="Storms, heat, and snow that affect the grove"
            value={weatherAlerts}
            onChange={setWeatherAlerts}
          />
          <Toggle
            label="Weekly season summary"
            detail="Collection and production recap"
            value={weeklySummary}
            onChange={setWeeklySummary}
          />
          <Toggle
            label="Email me a copy"
            detail={`Send alerts to ${currentUser.email} as well`}
            value={emailCopies}
            onChange={setEmailCopies}
          />
        </Section>

        <Section title="Stations" description="Defaults and alert thresholds for buckets.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted">
              Default target weight (lbs)
              <input type="number" defaultValue={CAPACITY_LBS} className={inputClass} />
            </label>
            <label className="block text-xs font-medium text-muted">
              Low battery alert (%)
              <input type="number" defaultValue={LOW_BATTERY_THRESHOLD} className={inputClass} />
            </label>
            <label className="block text-xs font-medium text-muted">
              Sudden weight change alert (lbs)
              <input type="number" defaultValue={3} className={inputClass} />
            </label>
            <label className="block text-xs font-medium text-muted">
              Mark offline after no reading for
              <select defaultValue="2h" className={inputClass}>
                <option value="1h">1 hour</option>
                <option value="2h">2 hours</option>
                <option value="6h">6 hours</option>
              </select>
            </label>
          </div>
        </Section>

        <Section title="Season" description="Which season the dashboard reports on.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted">
              Active season
              <select defaultValue={day.seasons[0]?.season} className={inputClass}>
                {day.seasons.map((season) => (
                  <option key={season.season} value={season.season}>
                    {season.season}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted">
              Weight unit
              <select defaultValue="lbs" className={inputClass}>
                <option value="lbs">Pounds (lbs)</option>
                <option value="kg">Kilograms (kg)</option>
              </select>
            </label>
          </div>
        </Section>
      </div>
    </div>
  );
}
