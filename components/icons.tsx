export function MapleLeafLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M14 3C14 3 9 10 7 14c-1 2-2 3-2 4 0 .8.3 1.4.8 1.8L9 21l-.5 3h11L19 21l3.2-1.2c.5-.4.8-1 .8-1.8 0-1-1-2-2-4C19 10 14 3 14 3z"
        fill="white"
        opacity="0.95"
      />
      <path d="M11 21h6" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
    </svg>
  );
}

export function DashboardIcon({ active }: { active: boolean }) {
  const fill = active ? "#fff" : "rgba(255,255,255,0.55)";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="7" height="7" rx="1.5" fill={fill} />
      <rect x="11" y="2" width="7" height="7" rx="1.5" fill={fill} />
      <rect x="2" y="11" width="7" height="7" rx="1.5" fill={fill} />
      <rect x="11" y="11" width="7" height="7" rx="1.5" fill={fill} />
    </svg>
  );
}

export function StationsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2C10 2 5 8 5 12a5 5 0 0010 0c0-4-5-10-5-10z"
        fill={active ? "#fff" : "rgba(255,255,255,0.55)"}
      />
    </svg>
  );
}

export function DataIcon({ active }: { active: boolean }) {
  const fill = active ? "#fff" : "rgba(255,255,255,0.55)";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="12" width="3" height="6" rx="1" fill={fill} />
      <rect x="8.5" y="8" width="3" height="10" rx="1" fill={fill} />
      <rect x="14" y="4" width="3" height="14" rx="1" fill={fill} />
    </svg>
  );
}

export function SettingsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.41 1.41M13.37 13.37l1.41 1.41M3.22 14.78l1.41-1.41M13.37 4.63l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WrenchIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M14.3 3.6l-2.4 2.4-1.9-.5-.5-1.9 2.4-2.4a4 4 0 00-5.2 5.2L1.6 11.5a1.4 1.4 0 002 2L8.7 8.4a4 4 0 005.6-4.8z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SignOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M7 3H4a1 1 0 00-1 1v10a1 1 0 001 1h3M11.5 12.5L15 9l-3.5-3.5M15 9H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2a6 6 0 00-6 6v3l-1.5 2h15L16 11V8a6 6 0 00-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.5 16a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloudIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6.5 15h8.2A3.3 3.3 0 0018 11.8c0-1.7-1.3-3.1-3-3.3A4.5 4.5 0 007.2 7.1 3.4 3.4 0 004 10.4 2.6 2.6 0 004.2 15h2.3z"
        fill="#1C1C1E"
      />
    </svg>
  );
}

export function DropletIcon({ fill = "currentColor", size = 16 }: { fill?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2C10 2 5 8 5 12a5 5 0 0010 0c0-4-5-10-5-10z" fill={fill} />
    </svg>
  );
}

export function MobileNavIcon({ id }: { id: "dashboard" | "stations" | "data" }) {
  if (id === "dashboard") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" />
      </svg>
    );
  }

  if (id === "stations") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2C10 2 5 8 5 12a5 5 0 0010 0c0-4-5-10-5-10z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="12" width="3" height="6" rx="1" fill="currentColor" />
      <rect x="8.5" y="8" width="3" height="10" rx="1" fill="currentColor" />
      <rect x="14" y="4" width="3" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

export type NotificationKind =
  | "weather"
  | "battery"
  | "offline"
  | "full"
  | "maintenance"
  | "back-online";

const notificationTint: Record<NotificationKind, { fg: string; bg: string }> = {
  weather: { fg: "#DC2626", bg: "rgba(220,38,38,0.1)" },
  battery: { fg: "#D97706", bg: "rgba(245,158,11,0.14)" },
  offline: { fg: "#DC2626", bg: "rgba(239,68,68,0.12)" },
  full: { fg: "#2B4A1E", bg: "rgba(43,74,30,0.1)" },
  maintenance: { fg: "#4B5563", bg: "rgba(107,114,128,0.14)" },
  "back-online": { fg: "#16A34A", bg: "rgba(34,197,94,0.12)" },
};

function NotificationGlyph({ kind }: { kind: NotificationKind }) {
  const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  if (kind === "weather") {
    return (
      <>
        <path
          d="M6.5 15h8.2A3.3 3.3 0 0018 11.8c0-1.7-1.3-3.1-3-3.3A4.5 4.5 0 007.2 7.1 3.4 3.4 0 004 10.4 2.6 2.6 0 004.2 15h2.3z"
          {...stroke}
        />
        <path d="M8 17.5v.5M11 17v1M14 17.5v.5" {...stroke} />
      </>
    );
  }

  if (kind === "battery") {
    return (
      <>
        <rect x="2.5" y="6.5" width="13" height="7" rx="1.5" {...stroke} />
        <path d="M17.5 8.7v2.6" {...stroke} />
        <path d="M5 9v2" {...stroke} />
      </>
    );
  }

  if (kind === "offline") {
    return (
      <>
        <path d="M3.5 8.2a9.5 9.5 0 0113 0M6 11a6 6 0 018 0" {...stroke} />
        <circle cx="10" cy="14.2" r="0.9" fill="currentColor" />
        <path d="M3 3l14 14" {...stroke} />
      </>
    );
  }

  if (kind === "full") {
    return (
      <path d="M10 2.5S5 8 5 12a5 5 0 0010 0c0-4-5-9.5-5-9.5z" {...stroke} fill="currentColor" fillOpacity="0.25" />
    );
  }

  if (kind === "back-online") {
    return <path d="M4 10.5l4 4 8-9" {...stroke} />;
  }

  return (
    <path
      d="M14.3 3.6l-2.4 2.4-1.9-.5-.5-1.9 2.4-2.4a4 4 0 00-5.2 5.2L1.6 11.5a1.4 1.4 0 002 2L8.7 8.4a4 4 0 005.6-4.8z"
      transform="translate(1.5 2.5)"
      {...stroke}
    />
  );
}

/** Round, tinted icon badge shown next to each notification. */
export function NotificationIcon({ kind }: { kind: NotificationKind }) {
  const tint = notificationTint[kind];

  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      style={{ color: tint.fg, background: tint.bg }}
      aria-hidden="true"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <NotificationGlyph kind={kind} />
      </svg>
    </span>
  );
}
