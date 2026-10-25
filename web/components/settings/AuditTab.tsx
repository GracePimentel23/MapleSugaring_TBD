"use client";

import { useState } from "react";
import { useLive } from "@/components/live/LiveProvider";
import { useSession } from "@/components/session/SessionProvider";
import { Button, Card, CardTitle, DataTable } from "@/components/ui/ui";

const ALL = "all";

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-full border border-border bg-white px-4 py-2 font-sans text-sm font-semibold text-text outline-none"
    >
      <option value={ALL}>{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

/** Every edit, who made it, and what changed. Read-only; Owner / IT can export it. */
export default function AuditTab() {
  const { audit, can } = useSession();
  const { day } = useLive();
  const [userFilter, setUserFilter] = useState(ALL);
  const [actionFilter, setActionFilter] = useState(ALL);
  const [period, setPeriod] = useState<"week" | "all">("week");

  const users = [...new Set(audit.map((entry) => entry.user))];
  const actions = [...new Set(audit.map((entry) => entry.action))];
  const rows = audit.filter(
    (entry) =>
      (userFilter === ALL || entry.user === userFilter) &&
      (actionFilter === ALL || entry.action === actionFilter),
  );
  const weekAgo = new Date(`${day.date}T00:00:00Z`).getTime() - 6 * 86_400_000;
  const shown = period === "week" ? rows.filter((entry) => new Date(entry.at).getTime() >= weekAgo) : rows;

  function exportCsv() {
    const header = ["when", "user", "action", "record", "change"];
    const lines = [header, ...rows.map((entry) => [entry.when, entry.user, entry.action, entry.record, entry.change])]
      .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([lines], { type: "text/csv" }));
    link.download = "audit-log.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <Card className="md:px-8 md:py-7">
      <CardTitle title="Audit Log" subtitle="Every edit, who made it, and what changed. Read-only." />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value as "week" | "all")}
          className="rounded-full border border-border bg-white px-4 py-2 font-sans text-sm font-semibold text-text outline-none"
        >
          <option value="week">Last 7 Days</option>
          <option value="all">All Time</option>
        </select>
        <FilterSelect value={userFilter} onChange={setUserFilter} options={users} allLabel="All Users" />
        <FilterSelect value={actionFilter} onChange={setActionFilter} options={actions} allLabel="All Actions" />
      </div>

      <DataTable
        empty="No changes match these filters."
        columns={[
          { key: "when", label: "When" },
          { key: "user", label: "User" },
          { key: "action", label: "Action" },
          { key: "record", label: "Record" },
          { key: "change", label: "Change" },
        ]}
        rows={shown.map((entry) => ({
          key: String(entry.id),
          cells: {
            when: entry.when,
            user: entry.user,
            action: <span className="font-semibold">{entry.action}</span>,
            record: entry.record,
            change: entry.change,
          },
        }))}
      />

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5">
        <span className="text-sm text-muted">
          Showing {shown.length} of {audit.length} changes
        </span>
        {can("data:export") ? <Button onClick={exportCsv}>Export CSV</Button> : null}
      </div>
    </Card>
  );
}
