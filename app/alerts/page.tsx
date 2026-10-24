"use client";

import { CheckCircleIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import AlertIcon, { alertLabelColor, type AlertIconKind } from "@/components/alerts/AlertIcon";
import { Can } from "@/components/auth/AccessContext";
import { useDemo } from "@/components/demo/DemoProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useAlerts, useStationState } from "@/components/stations/StationStateProvider";
import { Button, Card, DataTable, EmptyState, FilterPill, PageHeader } from "@/components/ui/ui";
import { getResolvedHistory } from "@/lib/selectors/alerts";
import type { ClubAlert } from "@/lib/types/schema";

type Section = "active" | "acknowledged" | "resolved";

function AlertRow({
  kind,
  title,
  context,
  actions,
}: {
  kind: AlertIconKind;
  title: string;
  context: string;
  actions: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 md:flex-row md:items-center md:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-5">
        <AlertIcon kind={kind} size={28} />
        <div className="min-w-0">
          <p className="font-sans text-base font-semibold md:text-lg">{title}</p>
          <p className="text-sm text-muted md:text-body">{context}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3 md:justify-end">{actions}</div>
    </Card>
  );
}

export default function AlertsPage() {
  const router = useRouter();
  const { dayIndex } = useDemo();
  const { thresholds, maintenanceDefaults } = useClubSettings();
  const { can } = useSession();
  const { active, acknowledged, maintenanceAlerts, acks } = useAlerts();
  const { acknowledge, resolve, resolutions, focusStation, extendMaintenance, toggleMaintenance } = useStationState();
  const [filter, setFilter] = useState<Section | null>(null);

  const history = getResolvedHistory(dayIndex, thresholds);
  const resolvedRows = [
    ...resolutions
      .filter((item) => item.dayIndex <= dayIndex && item.dayIndex > dayIndex - 7)
      .map((item) => ({
        key: `user-${item.key}-${item.dayIndex}`,
        when: item.at,
        label: item.label,
        kind: item.key.split("-")[0] as AlertIconKind,
        bucketLabel: item.bucketLabel,
        resolvedBy: item.by,
      })),
    ...history,
  ];

  const acknowledgedCount = acknowledged.length + maintenanceAlerts.length;
  const show = (section: Section) => filter === null || filter === section;

  function viewStation(bucketId: number | null) {
    if (bucketId === null) return;
    focusStation(bucketId);
    router.push("/stations");
  }

  function stationButton(alert: ClubAlert) {
    return alert.bucketId !== null ? (
      <Button variant="outline" onClick={() => viewStation(alert.bucketId)}>
        View Station
      </Button>
    ) : null;
  }

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <PageHeader
        title="Alerts"
        subtitle="Active means nobody is on it yet. Acknowledged means someone is. Resolved means it is fixed."
      />

      <div className="no-scrollbar -mx-4 mb-8 flex items-center gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
        <FilterPill
          label="All"
          count={active.length + acknowledgedCount + resolvedRows.length}
          active={filter === null}
          onClick={() => setFilter(null)}
        />
        {(
          [
            ["active", "Active", active.length],
            ["acknowledged", "Acknowledged", acknowledgedCount],
            ["resolved", "Resolved", resolvedRows.length],
          ] as [Section, string, number][]
        ).map(([id, label, count]) => (
          <FilterPill key={id} label={label} count={count} active={filter === id} onClick={() => setFilter(id)} />
        ))}
      </div>

      {show("active") ? (
        <section className="mb-8">
          <h2 className="max-md:pt-4 mb-3 font-sans text-lg font-semibold">Active</h2>
          {active.length === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircleIcon size={22} />}
              title="Nothing active"
              description="Every alert has someone on it."
            />
          ) : (
            <div className="space-y-4">
              {active.map((alert) => (
                <AlertRow
                  key={alert.key}
                  kind={alert.kind}
                  title={alert.title}
                  context={alert.context}
                  actions={
                    <>
                      <Can permission="alerts:resolve">
                        <Button variant="outline" onClick={() => acknowledge(alert)}>
                          Acknowledge
                        </Button>
                      </Can>
                      {stationButton(alert)}
                    </>
                  }
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {show("acknowledged") ? (
        <section className="mb-8">
          <h2 className="max-md:pt-4 mb-3 font-sans text-lg font-semibold">Acknowledged</h2>
          {acknowledgedCount === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircleIcon size={22} />}
              title="Nothing acknowledged"
              description="When someone takes an alert, it shows here until it is fixed."
            />
          ) : (
            <div className="space-y-4">
              {maintenanceAlerts.map((item) => (
                <AlertRow
                  key={`maintenance-${item.bucketId}`}
                  kind="maintenance"
                  title={`${item.station.name} maintenance mode is ending`}
                  context={`${item.station.location} · ends ${item.endsLabel}. Acknowledged by ${item.entry.by} at ${item.startedLabel}.`}
                  actions={
                    can("stations:maintenance") ? (
                      <>
                        {maintenanceDefaults.allowExtend ? (
                          <Button variant="outline" onClick={() => extendMaintenance(item.bucketId)}>
                            Extend 1 Hour
                          </Button>
                        ) : null}
                        <Button onClick={() => toggleMaintenance(item.bucketId)}>Resolve</Button>
                      </>
                    ) : null
                  }
                />
              ))}
              {acknowledged.map((alert) => {
                const stamp = acks[alert.key];
                return (
                  <AlertRow
                    key={alert.key}
                    kind={alert.kind}
                    title={alert.title}
                    context={`${alert.context}${stamp ? ` Acknowledged by ${stamp.by} at ${stamp.at.split(", ")[1]}.` : ""}`}
                    actions={
                      <>
                        {stationButton(alert)}
                        <Can permission="alerts:resolve">
                          <Button onClick={() => resolve(alert)}>Resolve</Button>
                        </Can>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {show("resolved") ? (
        <Card className="md:px-7">
          <h2 className="max-md:pt-4 mb-4 font-sans text-lg font-semibold">Resolved This Week</h2>
          <DataTable
            empty="Nothing resolved in the last seven days."
            columns={[
              { key: "when", label: "Time" },
              { key: "alert", label: "Alert" },
              { key: "bucket", label: "Bucket" },
              { key: "by", label: "Resolved by" },
            ]}
            rows={resolvedRows.map((row) => ({
              key: row.key,
              cells: {
                when: row.when,
                alert: (
                  <span className="font-semibold" style={{ color: alertLabelColor[row.kind] ?? "inherit" }}>
                    {row.label}
                  </span>
                ),
                bucket: row.bucketLabel,
                by: row.resolvedBy,
              },
            }))}
          />
        </Card>
      ) : null}
    </div>
  );
}
