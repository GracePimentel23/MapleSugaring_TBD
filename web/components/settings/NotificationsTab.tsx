"use client";

import {
  notificationTopics,
  useClubSettings,
  type Channel,
} from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import Select from "@/components/ui/Select";
import { Card, CardTitle, Checkbox, DataTable } from "@/components/ui/ui";

/** "12:00 AM" … "11:30 PM", every half hour */
const halfHours = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minutes = index % 2 ? "30" : "00";
  return `${hour % 12 || 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`;
});

/** The saved time if it is not on the half hour, so it still shows. */
function timeOptions(current: string) {
  const times = halfHours.includes(current) || !current ? halfHours : [current, ...halfHours];
  return times.map((time) => ({ value: time, label: time }));
}

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
          title="Alert Preferences"
          subtitle={
            isOwner
              ? "Alerts always show in the app first. Email and text are optional. Members can set their own under My account."
              : "Alerts always show in the app first; email and text are optional."
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
        <div className="flex items-center gap-2">
          <div className="w-36">
            <Select
              label="Quiet hours start"
              value={quietHours.from}
              onChange={(from) => setQuietHours({ ...quietHours, from })}
              options={timeOptions(quietHours.from)}
            />
          </div>
          <span className="text-sm text-muted">to</span>
          <div className="w-36">
            <Select
              label="Quiet hours end"
              value={quietHours.to}
              onChange={(to) => setQuietHours({ ...quietHours, to })}
              options={timeOptions(quietHours.to)}
            />
          </div>
        </div>
      </Card>
    </>
  );
}
