"use client";

import {
  notificationTopics,
  useClubSettings,
  type Channel,
} from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { Card, CardTitle, Checkbox, DataTable, inputClass } from "@/components/ui/ui";

const channels: { key: Channel; label: string }[] = [
  { key: "app", label: "In app" },
  { key: "email", label: "Email" },
  { key: "text", label: "Text" },
];

export default function NotificationsTab() {
  const { can, roles, viewLabels } = useSession();
  const { notificationPrefs, setNotificationPref, recipients, setRecipients, quietHours, setQuietHours } =
    useClubSettings();
  // Who gets alerts for the whole club is the owner's call; everyone else sets their own.
  const isOwner = can("users:manage");

  return (
    <>
      <Card className="md:px-8 md:py-7">
        <CardTitle
          title="Who Gets Told, and How"
          subtitle={
            isOwner
              ? "Alerts always show in the app first. Email and text are optional. Members can set their own under My account."
              : "Your own alert preferences. Alerts always show in the app first; email and text are optional."
          }
        />
        <DataTable
          columns={[
            { key: "alert", label: "Alert" },
            ...channels.map((channel) => ({ key: channel.key, label: channel.label })),
          ]}
          rows={notificationTopics.map((topic) => ({
            key: topic.key,
            cells: {
              alert: topic.label,
              ...Object.fromEntries(
                channels.map((channel) => [
                  channel.key,
                  <Checkbox
                    key={channel.key}
                    label=""
                    // In-app is always on: it is where every alert lands first.
                    disabled={channel.key === "app"}
                    checked={notificationPrefs[topic.key][channel.key]}
                    onChange={(checked) => setNotificationPref(topic.key, channel.key, checked)}
                  />,
                ]),
              ),
            },
          }))}
        />
      </Card>

      {isOwner ? (
        <Card className="md:px-8 md:py-7">
          <CardTitle title="Recipients" subtitle="Alerts go to these roles." />
          <div className="flex flex-wrap gap-6">
            {roles.map((role) => (
              <Checkbox
                key={role}
                label={viewLabels[role] ?? role}
                checked={recipients[role]}
                onChange={(checked) => setRecipients({ ...recipients, [role]: checked })}
              />
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="md:px-8 md:py-7">
        <CardTitle title="Quiet Hours" subtitle="Only critical alerts break through." />
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Quiet hours start"
            value={quietHours.from}
            onChange={(event) => setQuietHours({ ...quietHours, from: event.target.value })}
            className={`${inputClass} w-40`}
          />
          <span className="text-muted">to</span>
          <input
            aria-label="Quiet hours end"
            value={quietHours.to}
            onChange={(event) => setQuietHours({ ...quietHours, to: event.target.value })}
            className={`${inputClass} w-40`}
          />
        </div>
      </Card>
    </>
  );
}
