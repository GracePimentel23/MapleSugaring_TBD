"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLive } from "@/components/live/LiveProvider";
import { defaultThresholds, type Thresholds } from "@/lib/data/thresholds";
import type { Role } from "@/lib/data/people";
import { sapSeasonOf } from "@/lib/live/day";
import { formatLbsNumber } from "@/lib/units";

export type WeightUnit = "lbs" | "kg";
export type TempUnit = "F" | "C";

export type NotificationTopic =
  | "sapOverdue"
  | "nearlyFull"
  | "knockedOver"
  | "sensorSilent"
  | "lowBattery"
  | "maintenanceEnding"
  | "weather";

export type Channel = "app" | "email" | "text";

export const notificationTopics: { key: NotificationTopic; label: string }[] = [
  { key: "sapOverdue", label: "Sap overdue for collection" },
  { key: "nearlyFull", label: "Bucket nearly full" },
  { key: "knockedOver", label: "Bucket knocked over" },
  { key: "sensorSilent", label: "Sensor silent" },
  { key: "lowBattery", label: "Low battery" },
  { key: "maintenanceEnding", label: "Maintenance mode ending soon" },
  { key: "weather", label: "Hard freeze or heat event" },
];

type NotificationPrefs = Record<NotificationTopic, Record<Channel, boolean>>;

const allOn = { app: true, email: true, text: true };
const defaultNotificationPrefs: NotificationPrefs = {
  sapOverdue: allOn,
  nearlyFull: { app: true, email: true, text: false },
  knockedOver: allOn,
  sensorSilent: { app: true, email: true, text: false },
  lowBattery: { app: true, email: false, text: false },
  maintenanceEnding: allOn,
  weather: allOn,
};

export interface SeasonRecord {
  name: string;
  /** ISO dates */
  start: string;
  end: string;
  status: "active" | "closed";
}

/**
 * Season dates until someone sets real ones in Settings > Units & Season: every season the data
 * has, plus the coming one, on the usual mid-February to mid-April window around Rochester.
 */
function defaultSeasons(today: string, names: string[]): SeasonRecord[] {
  const current = sapSeasonOf(today);
  const years = new Set([current, ...names.map((name) => Number(name.replace("Season ", ""))).filter(Number.isFinite)]);
  return [...years]
    .sort((a, b) => b - a)
    .map((year) => ({
      name: `Season ${year}`,
      start: `${year}-02-15`,
      end: `${year}-04-15`,
      status: year === current ? "active" : "closed",
    }));
}

/**
 * Settings that have no home in the API yet live in this browser (localStorage), so they survive a
 * reload but are not shared with other people or devices.
 */
function usePersistent<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`tbd.settings.${key}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      if (saved !== null) setValue(JSON.parse(saved) as T);
    } catch {
      // private window or blocked storage: keep the default
    }
  }, [key]);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(`tbd.settings.${key}`, JSON.stringify(next));
      } catch {
        // not saved, still applied for this visit
      }
    },
    [key],
  );
  return [value, set];
}

export interface MaintenanceDefaults {
  /** Hours before maintenance switches itself off */
  autoOffHours: number;
  /** Minutes of warning before it ends */
  warnMinutes: number;
  allowExtend: boolean;
}

interface ClubSettingsValue {
  thresholds: Thresholds;
  setThresholds: (thresholds: Thresholds) => void;
  weightUnit: WeightUnit;
  setWeightUnit: (unit: WeightUnit) => void;
  tempUnit: TempUnit;
  setTempUnit: (unit: TempUnit) => void;
  /** Formats a weight stored in lbs in the chosen unit, e.g. "5.4 kg". `fixed` keeps one decimal ("7.0"). */
  weight: (lbs: number, withUnit?: boolean, fixed?: boolean) => string;
  /** Formats a temperature stored in °F in the chosen unit, e.g. "2°C" */
  temp: (fahrenheit: number, withUnit?: boolean) => string;
  maintenanceDefaults: MaintenanceDefaults;
  setMaintenanceDefaults: (defaults: MaintenanceDefaults) => void;
  notificationPrefs: NotificationPrefs;
  setNotificationPref: (topic: NotificationTopic, channel: Channel, on: boolean) => void;
  recipients: Record<Role, boolean>;
  setRecipients: (recipients: Record<Role, boolean>) => void;
  quietHours: { from: string; to: string };
  setQuietHours: (hours: { from: string; to: string }) => void;
  seasons: SeasonRecord[];
  setSeasons: (seasons: SeasonRecord[]) => void;
  /** Pounds of syrup the club is aiming for this season */
  syrupGoalLbs: number;
  setSyrupGoalLbs: (lbs: number) => void;
  /** Moving background art on the dashboard cards */
  animations: boolean;
  setAnimations: (on: boolean) => void;
}

const ClubSettingsContext = createContext<ClubSettingsValue | null>(null);

const LBS_PER_KG = 2.20462262;

export default function ClubSettingsProvider({ children }: { children: ReactNode }) {
  const { day } = useLive();
  const [thresholds, setThresholds] = usePersistent<Thresholds>("thresholds", defaultThresholds);
  const [weightUnit, setWeightUnit] = usePersistent<WeightUnit>("weightUnit", "lbs");
  const [tempUnit, setTempUnit] = usePersistent<TempUnit>("tempUnit", "F");
  const [maintenanceDefaults, setMaintenanceDefaults] = usePersistent<MaintenanceDefaults>("maintenance", {
    autoOffHours: 4,
    warnMinutes: 30,
    allowExtend: true,
  });
  const [notificationPrefs, setNotificationPrefs] = usePersistent("notifications", defaultNotificationPrefs);
  const [recipients, setRecipients] = usePersistent<Record<Role, boolean>>("recipients", {
    owner: true,
    manager: true,
    member: false,
  });
  const [quietHours, setQuietHours] = usePersistent("quietHours", { from: "10:00 PM", to: "6:00 AM" });
  const seasonNames = day.seasons.map((season) => season.season).join(",");
  const fallbackSeasons = useMemo(
    () => defaultSeasons(day.date, seasonNames ? seasonNames.split(",") : []),
    [day.date, seasonNames],
  );
  const [savedSeasons, setSeasons] = usePersistent<SeasonRecord[] | null>("seasons", null);
  const seasons = savedSeasons ?? fallbackSeasons;
  const [syrupGoalLbs, setSyrupGoalLbs] = usePersistent("syrupGoalLbs", 5);
  const [animations, setAnimations] = usePersistent("animations", true);

  const weight = useCallback(
    (lbs: number, withUnit = true, fixed = false) => {
      const value = weightUnit === "kg" ? Math.round((lbs / LBS_PER_KG) * 10) / 10 : lbs;
      const text = fixed ? value.toFixed(1) : formatLbsNumber(value);
      return withUnit ? `${text} ${weightUnit}` : text;
    },
    [weightUnit],
  );

  const temp = useCallback(
    (fahrenheit: number, withUnit = true) => {
      const value = tempUnit === "C" ? Math.round(((fahrenheit - 32) * 5) / 9) : fahrenheit;
      return withUnit ? `${value}°${tempUnit}` : `${value}°`;
    },
    [tempUnit],
  );

  const setNotificationPref = useCallback(
    (topic: NotificationTopic, channel: Channel, on: boolean) => {
      setNotificationPrefs({ ...notificationPrefs, [topic]: { ...notificationPrefs[topic], [channel]: on } });
    },
    [notificationPrefs, setNotificationPrefs],
  );

  const value = useMemo<ClubSettingsValue>(
    () => ({
      thresholds,
      setThresholds,
      weightUnit,
      setWeightUnit,
      tempUnit,
      setTempUnit,
      weight,
      temp,
      maintenanceDefaults,
      setMaintenanceDefaults,
      notificationPrefs,
      setNotificationPref,
      recipients,
      setRecipients,
      quietHours,
      setQuietHours,
      seasons,
      setSeasons: (next: SeasonRecord[]) => setSeasons(next),
      syrupGoalLbs,
      setSyrupGoalLbs,
      animations,
      setAnimations,
    }),
    [
      thresholds,
      setThresholds,
      weightUnit,
      setWeightUnit,
      tempUnit,
      setTempUnit,
      weight,
      temp,
      maintenanceDefaults,
      setMaintenanceDefaults,
      notificationPrefs,
      setNotificationPref,
      recipients,
      setRecipients,
      quietHours,
      setQuietHours,
      seasons,
      setSeasons,
      syrupGoalLbs,
      setSyrupGoalLbs,
      animations,
      setAnimations,
    ],
  );

  return <ClubSettingsContext.Provider value={value}>{children}</ClubSettingsContext.Provider>;
}

export function useClubSettings(): ClubSettingsValue {
  const context = useContext(ClubSettingsContext);
  if (!context) throw new Error("useClubSettings must be used inside ClubSettingsProvider");
  return context;
}
