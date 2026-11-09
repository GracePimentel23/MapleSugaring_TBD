"use client";

import { CheckCircleIcon } from "@/components/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import AlertIcon, { alertLabelColor, type AlertIconKind } from "@/components/alerts/AlertIcon";
import ResolveAlertModal from "@/components/alerts/ResolveAlertModal";
import { Can } from "@/components/auth/AccessContext";
import { useLive } from "@/components/live/LiveProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useAlerts, useStationState } from "@/components/stations/StationStateProvider";
import { Button, Card, DataTable, EmptyState, FilterPill, PageHeader } from "@/components/ui/ui";
import { getResolvedHistory } from "@/lib/selectors/alerts";
import type { ClubAlert } from "@/lib/types/schema";

type Section = "active" | "resolved";

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

function AlertsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { day } = useLive();
  const { maintenanceDefaults } = useClubSettings();
  const { can } = useSession();
  const { active, snoozed, maintenanceAlerts } = useAlerts();
  const { resolutions, focusStation, extendMaintenance, toggleMaintenance } = useStationState();
  const [filter, setFilter] = useState<Section | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  // A notification links here with ?alert=<key>: open that alert's resolve pop-up.
  const wanted = openKey ?? params.get("alert");
  const opened = [...active, ...snoozed.map((item) => item.alert)].find((alert) => alert.key === wanted) ?? null;

  function closeResolve() {
    setOpenKey(null);
    if (params.get("alert")) router.replace("/alerts");
  }

  const history = getResolvedHistory(day);
  const resolvedRows = [
    // Ones tied to a worker alert are listed from the worker's own history below.
    ...resolutions
      .filter((item) => item.alertId === undefined)
      .map((item) => ({
        key: `user-${item.key}-${item.date}-${item.at}`,
        when: item.at,
        label: item.label,
        kind: item.key.split("-")[0] as AlertIconKind,
        bucketLabel: item.bucketLabel,
        resolvedBy: item.by,
        note: item.note ?? "",
      })),
    ...history,
  ];

  const activeCount = active.length + maintenanceAlerts.length + snoozed.length;
  const show = (section: Section) => filter === null || filter === section;

  function viewStation(bucketId: number | null) {
    if (bucketId === null) return;
    focusStation(bucketId);
    router.push("/stations");
  }

  function actionsFor(alert: ClubAlert) {
    return (
      <>
        {alert.bucketId !== null ? (
          <Button variant="outline" onClick={() => viewStation(alert.bucketId)}>
            View Station
          </Button>
        ) : null}
        <Can permission="alerts:resolve">
          <Button onClick={() => setOpenKey(alert.key)}>{alert.kind === "weather" ? "Acknowledge" : "Resolve"}</Button>
        </Can>
      </>
    );
  }

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <PageHeader
        title="Alerts"
        subtitle="Resolve each alert to clear it; the pop-up walks you through what to do. Weather alerts only need acknowledging."
      />

      <div className="no-scrollbar -mx-4 mb-8 flex items-center gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
        <FilterPill
          label="All"
          count={activeCount + resolvedRows.length}
          active={filter === null}
          onClick={() => setFilter(null)}
        />
        {(
          [
            ["active", "Active", activeCount],
            ["resolved", "Resolved", resolvedRows.length],
          ] as [Section, string, number][]
        ).map(([id, label, count]) => (
          <FilterPill key={id} label={label} count={count} active={filter === id} onClick={() => setFilter(id)} />
        ))}
      </div>

      {show("active") ? (
        <section className="mb-8">
          <h2 className="mb-3 font-sans text-lg font-semibold max-md:pt-4">Active</h2>
          {active.length + maintenanceAlerts.length === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircleIcon size={22} />}
              title="Nothing active"
              description="Every alert is resolved."
            />
          ) : (
            <div className="space-y-4">
              {active.map((alert) => (
                <AlertRow
                  key={alert.key}
                  kind={alert.kind}
                  title={alert.title}
                  context={alert.context}
                  actions={actionsFor(alert)}
                />
              ))}
              {maintenanceAlerts.map((item) => (
                <AlertRow
                  key={`maintenance-${item.bucketId}`}
                  kind="maintenance"
                  title={`${item.station.name} is in maintenance mode`}
                  context={`${item.station.location} · alerts paused until ${item.endsLabel}.`}
                  actions={
                    can("stations:maintenance") ? (
                      <>
                        {maintenanceDefaults.allowExtend ? (
                          <Button variant="outline" onClick={() => extendMaintenance(item.bucketId)}>
                            Extend 1 Hour
                          </Button>
                        ) : null}
                        <Button onClick={() => toggleMaintenance(item.bucketId)}>End Maintenance</Button>
                      </>
                    ) : null
                  }
                />
              ))}
            </div>
          )}

          {snoozed.length > 0 ? (
            <>
              <h3 className="mt-6 mb-3 font-sans text-base font-semibold text-muted">Snoozed</h3>
              <div className="space-y-4">
                {snoozed.map(({ alert, untilLabel }) => (
                  <AlertRow
                    key={alert.key}
                    kind={alert.kind}
                    title={alert.title}
                    context={`Back as a reminder at ${untilLabel}. ${alert.context}`}
                    actions={actionsFor(alert)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {show("resolved") ? (
        <Card className="md:px-7">
          <h2 className="mb-4 font-sans text-lg font-semibold max-md:pt-4">Resolved This Week</h2>
          <DataTable
            empty="Nothing resolved in the last seven days."
            columns={[
              { key: "when", label: "Time" },
              { key: "alert", label: "Alert" },
              { key: "bucket", label: "Bucket" },
              { key: "how", label: "How" },
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
                how: row.note || <span className="text-muted">—</span>,
                by: row.resolvedBy,
              },
            }))}
          />
        </Card>
      ) : null}

      {opened ? <ResolveAlertModal alert={opened} onClose={closeResolve} /> : null}
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense>
      <AlertsContent />
    </Suspense>
  );
}
