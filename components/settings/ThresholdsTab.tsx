"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { PencilIcon } from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { Button, Card, CardTitle, Field, inputClass, Modal } from "@/components/ui/ui";
import { defaultThresholds, thresholdDefs, type ThresholdDef } from "@/lib/data/thresholds";
import { tableStamp } from "@/lib/time";

function EditThresholdModal({ def, onClose }: { def: ThresholdDef; onClose: () => void }) {
  const { day } = useDemo();
  const { thresholds, setThresholds } = useClubSettings();
  const { logAudit } = useSession();
  const current = thresholds[def.key];
  const [warn, setWarn] = useState(String(current.warn));
  const [critical, setCritical] = useState(String(current.critical));

  function save() {
    const next = {
      warn: Number.parseFloat(warn) || current.warn,
      critical: Number.parseFloat(critical) || 0,
    };
    setThresholds({ ...thresholds, [def.key]: next });
    const changes = [
      next.warn !== current.warn && `warn ${def.warnFormat(current.warn)} to ${def.warnFormat(next.warn)}`,
      next.critical !== current.critical &&
        `critical ${def.criticalFormat(current.critical)} to ${def.criticalFormat(next.critical)}`,
    ].filter(Boolean);
    if (changes.length) {
      logAudit({
        when: tableStamp(day.date),
        action: "Changed threshold",
        record: def.label,
        change: changes.join("; "),
      });
    }
    onClose();
  }

  return (
    <Modal
      title={def.label}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save Threshold</Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">{def.description}.</p>
      <div className="grid grid-cols-2 gap-3 pb-2">
        <Field label={`Warn (${def.warnUnit})`}>
          <input type="number" value={warn} onChange={(event) => setWarn(event.target.value)} className={inputClass} />
        </Field>
        <Field label={`Critical (${def.criticalUnit})`}>
          <input
            type="number"
            value={critical}
            onChange={(event) => setCritical(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <p className="pb-2 text-sm text-muted">The change is written to the audit log.</p>
    </Modal>
  );
}

export default function ThresholdsTab() {
  const { day } = useDemo();
  const { thresholds, setThresholds } = useClubSettings();
  const { can, logAudit } = useSession();
  const [editing, setEditing] = useState<ThresholdDef | null>(null);
  const canEdit = can("thresholds:manage");

  function reset() {
    setThresholds(defaultThresholds);
    logAudit({
      when: tableStamp(day.date),
      action: "Reset thresholds",
      record: "All thresholds",
      change: "Back to defaults",
    });
  }

  return (
    <Card className="md:px-8 md:py-7">
      <CardTitle
        title="Alert Thresholds"
        subtitle={
          <>
            Alerts fire when a reading crosses these. Every change is written to the audit log. Owner / IT only
            {canEdit ? "." : "; you can view them."}
          </>
        }
        action={
          canEdit ? (
            <Button variant="outline" size="sm" onClick={reset}>
              Reset To Defaults
            </Button>
          ) : null
        }
      />
      <ul className="border-t border-border">
        {thresholdDefs.map((def) => {
          const value = thresholds[def.key];
          return (
            <li key={def.key} className="flex flex-wrap items-center gap-4 border-b border-border py-5">
              <div className="min-w-[200px] flex-1">
                <p className="font-sans text-base font-medium">{def.label}</p>
                <p className="text-sm text-muted">{def.description}</p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <div className="text-sm text-muted">Warn</div>
                  <div className="font-sans text-base font-semibold">{def.warnFormat(value.warn)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted">Critical</div>
                  <div className="font-sans text-base font-semibold text-status-problem">
                    {def.criticalFormat(value.critical)}
                  </div>
                </div>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing(def)}
                  aria-label={`Edit ${def.label}`}
                  className="rounded-lg p-2 hover:bg-bg"
                >
                  <PencilIcon size={22} />
                </button>
              ) : (
                <span className="w-[38px]" />
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-sm text-muted">
        The sensors measure weight only, so there are no sap temperature or sugar thresholds. Enter Brix by hand when a
        batch finishes.
      </p>
      {editing ? <EditThresholdModal def={editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}
