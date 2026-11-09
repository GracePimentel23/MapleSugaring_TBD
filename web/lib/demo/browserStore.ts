"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * FRONT-END DEMO STORAGE: data the redesign needs that the worker does not store yet.
 *
 * Everything here lives only in this browser (localStorage), so it is not shared between people
 * or devices. Each store is a stand-in until the worker has an API for it; when it does, delete the
 * store here and use the API instead. Nothing in worker/ depends on this file.
 *
 *   resolutions  How alerts the browser judges itself (due, sap age, battery, weather) were resolved,
 *                so they stay out of Active for the day. (On main before the redesign, too.)
 *   snoozes      Alerts put off with "Schedule for later" in the resolve pop-up.
 *   alertNotes   How a worker alert (full, no signal, knocked over, sensor fault) was resolved, e.g.
 *                "Emptied, 9.4 lbs logged". The worker records who resolved it and when, not how.
 *                To remove: add a note column to the worker's alerts and send it with PATCH /alerts/:id.
 */
export type BrowserStore = "resolutions" | "snoozes" | "alertNotes";

/** A list kept in this browser under `tbd.<store>`; empty on the server and until it has loaded. */
export function useBrowserList<T>(store: BrowserStore): [T[], (update: (current: T[]) => T[]) => void] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`tbd.${store}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      if (saved) setItems(JSON.parse(saved) as T[]);
    } catch {
      // storage blocked: start empty
    }
  }, [store]);
  const update = useCallback(
    (change: (current: T[]) => T[]) => {
      setItems((current) => {
        const next = change(current);
        try {
          window.localStorage.setItem(`tbd.${store}`, JSON.stringify(next));
        } catch {
          // not saved
        }
        return next;
      });
    },
    [store],
  );
  return [items, update];
}
