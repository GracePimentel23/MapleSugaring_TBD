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

export function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="2.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
      <path
        d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.41 1.41M13.37 13.37l1.41 1.41M3.22 14.78l1.41-1.41M13.37 4.63l1.41-1.41"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.5"
        strokeLinecap="round"
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
