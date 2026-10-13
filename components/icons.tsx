import type { ReactNode } from "react";

/**
 * Thin outline icons in the rebrand style. All take `currentColor`, so color
 * them with text classes.
 */

function Svg({
  size = 20,
  children,
  className,
}: {
  size?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number; className?: string };

export function GridIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="5.5" height="5.5" rx="1.2" />
      <rect x="11.5" y="3" width="5.5" height="5.5" rx="1.2" />
      <rect x="3" y="11.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.2" />
    </Svg>
  );
}

export function DropIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 2.8S5.2 8.4 5.2 12a4.8 4.8 0 009.6 0c0-3.6-4.8-9.2-4.8-9.2z" />
    </Svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 2.8a5.2 5.2 0 00-5.2 5.2v3.1L3.5 13.6h13l-1.3-2.5V8A5.2 5.2 0 0010 2.8z" />
      <path d="M8.3 16.2a1.8 1.8 0 003.4 0" />
    </Svg>
  );
}

export function BarsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 16.5V9M10 16.5V3.5M16 16.5V7" />
    </Svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2v2.2M10 15.8V18M2 10h2.2M15.8 10H18M4.3 4.3l1.6 1.6M14.1 14.1l1.6 1.6M4.3 15.7l1.6-1.6M14.1 5.9l1.6-1.6" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.5 4.5L7 10l5.5 5.5" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 4.5L13 10l-5.5 5.5" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 7.5l5 5 5-5" />
    </Svg>
  );
}

export function BatteryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="6.5" width="13" height="7" rx="1.6" />
      <path d="M17.5 8.8v2.4M5.2 10h2.6" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4.2l2.6 1.6" />
    </Svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.5" y="4" width="3" height="12" rx="0.8" />
      <rect x="11.5" y="4" width="3" height="12" rx="0.8" />
    </Svg>
  );
}

export function SignalOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 8.2a9.5 9.5 0 0113 0M6 11a6 6 0 018 0" />
      <circle cx="10" cy="14.2" r="0.6" fill="currentColor" />
      <path d="M3 3l14 14" />
    </Svg>
  );
}

export function FullIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 5.5h11l-1.2 10.2a1.5 1.5 0 01-1.5 1.3H7.2a1.5 1.5 0 01-1.5-1.3z" />
      <path d="M5 8.5h10" />
    </Svg>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 15h8.2A3.3 3.3 0 0018 11.8c0-1.7-1.3-3.1-3-3.3A4.5 4.5 0 007.2 7.1 3.4 3.4 0 004 10.4 2.6 2.6 0 006.5 15z" />
    </Svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M6.8 10.2l2.2 2.2 4.2-4.6" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </Svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.2 3.6l3.2 3.2-9.2 9.2H4v-3.2z" />
      <path d="M4 17.5h12" />
    </Svg>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7z" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v4.5" />
      <circle cx="10" cy="6.4" r="0.5" fill="currentColor" />
    </Svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="4.5" r="0.9" fill="currentColor" />
      <circle cx="10" cy="10" r="0.9" fill="currentColor" />
      <circle cx="10" cy="15.5" r="0.9" fill="currentColor" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5l10 10M15 5L5 15" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 4v12M4 10h12" />
    </Svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10h12" />
    </Svg>
  );
}

export function CrosshairIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="3.2" />
      <path d="M10 2v3M10 15v3M2 10h3M15 10h3" />
    </Svg>
  );
}

export function NorthIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 16V4M6 8l4-4 4 4" />
    </Svg>
  );
}
