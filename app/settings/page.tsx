"use client";

import { useState } from "react";
import AccountTab from "@/components/settings/AccountTab";
import AuditTab from "@/components/settings/AuditTab";
import NotificationsTab from "@/components/settings/NotificationsTab";
import ThresholdsTab from "@/components/settings/ThresholdsTab";
import TreesTab from "@/components/settings/TreesTab";
import UnitsTab from "@/components/settings/UnitsTab";
import UsersTab from "@/components/settings/UsersTab";
import { useSession } from "@/components/session/SessionProvider";
import { cx } from "@/components/ui/ui";
import type { Role } from "@/lib/data/people";

type TabId = "thresholds" | "users" | "trees" | "notifications" | "units" | "audit" | "account";

/** Who can open each tab. Members only see what applies to them. */
const tabs: { id: TabId; label: string; roles: Role[] }[] = [
  { id: "thresholds", label: "Thresholds", roles: ["owner", "manager"] },
  { id: "users", label: "Users & Roles", roles: ["owner", "manager"] },
  { id: "trees", label: "Trees & Sensors", roles: ["owner", "manager"] },
  { id: "notifications", label: "Notifications", roles: ["owner", "manager", "member"] },
  { id: "units", label: "Units & Season", roles: ["owner", "manager", "member"] },
  { id: "audit", label: "Audit Log", roles: ["owner", "manager"] },
  { id: "account", label: "My Account", roles: ["owner", "manager", "member"] },
];

export default function SettingsPage() {
  const { user } = useSession();
  const visible = tabs.filter((tab) => tab.roles.includes(user.role));
  const [requested, setRequested] = useState<TabId>("thresholds");
  // Switching to a role that cannot see the open tab falls back to the first one it can.
  const active = visible.some((tab) => tab.id === requested) ? requested : visible[0]!.id;

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <h1 className="mb-6 font-sans text-3xl font-bold tracking-tight md:text-[40px] md:leading-tight">
        Settings
      </h1>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <nav
          aria-label="Settings sections"
          className="no-scrollbar -mx-4 flex shrink-0 gap-1 overflow-x-auto px-4 lg:mx-0 lg:w-[240px] lg:flex-col lg:px-0"
        >
          {visible.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRequested(tab.id)}
              aria-current={active === tab.id ? "page" : undefined}
              className={cx(
                "shrink-0 rounded-xl px-4 py-2.5 text-left font-sans text-[15px] whitespace-nowrap transition-colors lg:py-3",
                active === tab.id
                  ? "bg-accent-mid font-semibold text-white"
                  : "text-text hover:bg-white",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {active === "thresholds" ? <ThresholdsTab /> : null}
          {active === "users" ? <UsersTab /> : null}
          {active === "trees" ? <TreesTab /> : null}
          {active === "notifications" ? <NotificationsTab /> : null}
          {active === "units" ? <UnitsTab /> : null}
          {active === "audit" ? <AuditTab /> : null}
          {active === "account" ? <AccountTab key={user.id} /> : null}
        </div>
      </div>
    </div>
  );
}
