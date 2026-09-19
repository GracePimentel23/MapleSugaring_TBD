/**
 * Real observed daily weather for Rochester NY (43.1566, -77.6088),
 * March 1-14 2022, from the Open-Meteo historical archive.
 *
 * This window was chosen because it contains seven freeze-thaw days, a 71F
 * warm anomaly, and two snow events - the swings that actually drive sap flow.
 * Values are baked in so the demo never needs network access.
 */

export interface DemoWeatherDay {
  /** ISO date, e.g. "2022-03-05" */
  date: string;
  /** "Saturday, March 5" */
  label: string;
  /** "Sat, Mar 5" */
  shortLabel: string;
  /** Representative reading shown on the dashboard card */
  temperatureF: number;
  lowF: number;
  highF: number;
  precipIn: number;
  snowIn: number;
  windMph: number;
  cloudPercent: number;
  summary: string;
}

export const SEASON_LABEL = "Season 2022";

export const demoWeather: DemoWeatherDay[] = [
  {
    date: "2022-03-01",
    label: "Tuesday, March 1",
    shortLabel: "Tue, Mar 1",
    temperatureF: 35,
    lowF: 17,
    highF: 47,
    precipIn: 0.1,
    snowIn: 0.11,
    windMph: 13.5,
    cloudPercent: 95,
    summary: "Overcast, light flurries",
  },
  {
    date: "2022-03-02",
    label: "Wednesday, March 2",
    shortLabel: "Wed, Mar 2",
    temperatureF: 34,
    lowF: 27,
    highF: 39,
    precipIn: 0.03,
    snowIn: 0.19,
    windMph: 9.8,
    cloudPercent: 87,
    summary: "Cloudy, light snow",
  },
  {
    date: "2022-03-03",
    label: "Thursday, March 3",
    shortLabel: "Thu, Mar 3",
    temperatureF: 26,
    lowF: 18,
    highF: 31,
    precipIn: 0.03,
    snowIn: 0.19,
    windMph: 17.5,
    cloudPercent: 53,
    summary: "Partly cloudy, breezy",
  },
  {
    date: "2022-03-04",
    label: "Friday, March 4",
    shortLabel: "Fri, Mar 4",
    temperatureF: 27,
    lowF: 16,
    highF: 33,
    precipIn: 0,
    snowIn: 0,
    windMph: 10.8,
    cloudPercent: 75,
    summary: "Mostly cloudy, cold",
  },
  {
    date: "2022-03-05",
    label: "Saturday, March 5",
    shortLabel: "Sat, Mar 5",
    temperatureF: 37,
    lowF: 23,
    highF: 46,
    precipIn: 0,
    snowIn: 0,
    windMph: 18.5,
    cloudPercent: 99,
    summary: "Overcast, big thaw",
  },
  {
    date: "2022-03-06",
    label: "Sunday, March 6",
    shortLabel: "Sun, Mar 6",
    temperatureF: 58,
    lowF: 39,
    highF: 71,
    precipIn: 0.09,
    snowIn: 0,
    windMph: 30.3,
    cloudPercent: 64,
    summary: "Unseasonably warm, very windy",
  },
  {
    date: "2022-03-07",
    label: "Monday, March 7",
    shortLabel: "Mon, Mar 7",
    temperatureF: 38,
    lowF: 32,
    highF: 42,
    precipIn: 0.64,
    snowIn: 0.83,
    windMph: 18.4,
    cloudPercent: 99,
    summary: "Heavy rain, wintry mix",
  },
  {
    date: "2022-03-08",
    label: "Tuesday, March 8",
    shortLabel: "Tue, Mar 8",
    temperatureF: 33,
    lowF: 26,
    highF: 37,
    precipIn: 0.19,
    snowIn: 1.32,
    windMph: 14.7,
    cloudPercent: 89,
    summary: "Snow",
  },
  {
    date: "2022-03-09",
    label: "Wednesday, March 9",
    shortLabel: "Wed, Mar 9",
    temperatureF: 35,
    lowF: 26,
    highF: 41,
    precipIn: 0.05,
    snowIn: 0,
    windMph: 11.7,
    cloudPercent: 79,
    summary: "Mostly cloudy",
  },
  {
    date: "2022-03-10",
    label: "Thursday, March 10",
    shortLabel: "Thu, Mar 10",
    temperatureF: 36,
    lowF: 27,
    highF: 41,
    precipIn: 0,
    snowIn: 0,
    windMph: 11.2,
    cloudPercent: 61,
    summary: "Partly cloudy",
  },
  {
    date: "2022-03-11",
    label: "Friday, March 11",
    shortLabel: "Fri, Mar 11",
    temperatureF: 39,
    lowF: 26,
    highF: 47,
    precipIn: 0.14,
    snowIn: 0.47,
    windMph: 8.4,
    cloudPercent: 94,
    summary: "Overcast, light snow early",
  },
  {
    date: "2022-03-12",
    label: "Saturday, March 12",
    shortLabel: "Sat, Mar 12",
    temperatureF: 27,
    lowF: 18,
    highF: 33,
    precipIn: 0.3,
    snowIn: 2.09,
    windMph: 20.6,
    cloudPercent: 92,
    summary: "Heavy snow, windy",
  },
  {
    date: "2022-03-13",
    label: "Sunday, March 13",
    shortLabel: "Sun, Mar 13",
    temperatureF: 25,
    lowF: 18,
    highF: 30,
    precipIn: 0.06,
    snowIn: 0.39,
    windMph: 18.1,
    cloudPercent: 90,
    summary: "Cloudy, flurries, hard freeze",
  },
  {
    date: "2022-03-14",
    label: "Monday, March 14",
    shortLabel: "Mon, Mar 14",
    temperatureF: 41,
    lowF: 26,
    highF: 51,
    precipIn: 0,
    snowIn: 0,
    windMph: 9.3,
    cloudPercent: 74,
    summary: "Mostly cloudy, mild",
  },
];

/** A freeze overnight followed by a thaw is what actually moves sap. */
export function isFreezeThaw(day: DemoWeatherDay): boolean {
  return day.lowF <= 30 && day.highF >= 38;
}
