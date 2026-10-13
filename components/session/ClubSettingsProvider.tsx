"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { defaultThresholds, type Thresholds } from "@/lib/data/thresholds";
import type { Role } from "@/lib/data/people";
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

const defaultSeasons: SeasonRecord[] = [
  { name: "Season 2022", start: "2022-02-28", end: "2022-03-14", status: "active" },
  { name: "Season 2021", start: "2021-02-26", end: "2021-03-16", status: "closed" },
  { name: "Season 2020", start: "2020-03-01", end: "2020-03-18", status: "closed" },
];

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
}

const ClubSettingsContext = createContext<ClubSettingsValue | null>(null);

const LBS_PER_KG = 2.20462262;

export default function ClubSettingsProvider({ children }: { children: ReactNode }) {
  const [thresholds, setThresholds] = useState<Thresholds>(defaultThresholds);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs");
  const [tempUnit, setTempUnit] = useState<TempUnit>("F");
  const [maintenanceDefaults, setMaintenanceDefaults] = useState<MaintenanceDefaults>({
    autoOffHours: 4,
    warnMinutes: 30,
    allowExtend: true,
  });
  const [notificationPrefs, setNotificationPrefs] = useState(defaultNotificationPrefs);
  const [recipients, setRecipients] = useState<Record<Role, boolean>>({
    owner: true,
    manager: true,
    member: false,
  });
  const [quietHours, setQuietHours] = useState({ from: "10:00 PM", to: "6:00 AM" });
  const [seasons, setSeasons] = useState(defaultSeasons);

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
      setNotificationPrefs((current) => ({
        ...current,
        [topic]: { ...current[topic], [channel]: on },
      }));
    },
    [],
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
      setSeasons,
    }),
    [
      thresholds,
      weightUnit,
      tempUnit,
      weight,
      temp,
      maintenanceDefaults,
      notificationPrefs,
      setNotificationPref,
      recipients,
      quietHours,
      seasons,
    ],
  );

  return <ClubSettingsContext.Provider value={value}>{children}</ClubSettingsContext.Provider>;
}

export function useClubSettings(): ClubSettingsValue {
  const context = useContext(ClubSettingsContext);
  if (!context) throw new Error("useClubSettings must be used inside ClubSettingsProvider");
  return context;
}
