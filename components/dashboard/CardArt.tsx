import type { CSSProperties, ReactNode } from "react";
import type { DemoWeatherDay } from "@/lib/demo/weather";

/**
 * Background scenes for the dashboard cards. They never stop moving, and they
 * react to the data: more sap means more (and faster) falling leaves, the drop
 * fills toward the syrup goal, and the weather scene matches the day.
 * Everything is placed by fixed numbers (no randomness) so server and browser
 * render the same thing. The sap card has leaves; the syrup card has the drops. Motion turns off with the Background animations
 * setting (data-motion="off" on the app) or prefers-reduced-motion.
 */

/** A big day for this grove; today's sap is shown as a share of it. */
const BIG_DAY_LBS = 20;

const LEAF_PATH =
  "M50 4l7 19 11-7-3 20 17-9-3 14 19-2-11 16 9 6-24 11 4 11-20-4-1 26h-6l-1-26-20 4 4-11-24-11 9-6-11-16 19 2-3-14 17 9-3-20 11 7z";
const DROP_PATH = "M20 0S0 24 0 34a20 18 0 0040 0C40 24 20 0 20 0z";

function Layer({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {children}
    </div>
  );
}

function Leaf({
  size,
  color,
  style,
  className,
}: {
  size: number;
  color: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 100 110" width={size} height={size * 1.1} className={className} style={style} fill={color}>
      <path d={LEAF_PATH} />
    </svg>
  );
}

/** Falling leaves, in the order they join as the day's sap grows. */
const FALLING_LEAVES = [
  { left: "62%", size: 28, color: "#9DBB8C", duration: 16, delay: 0 },
  { left: "78%", size: 20, color: "#D9AE6E", duration: 19, delay: 4 },
  { left: "48%", size: 24, color: "#AFC79F", duration: 17, delay: 8.5 },
  { left: "90%", size: 32, color: "#9DBB8C", duration: 21, delay: 2 },
  { left: "70%", size: 18, color: "#DDA06A", duration: 14, delay: 11 },
  { left: "56%", size: 22, color: "#AFC79F", duration: 16.5, delay: 6.4 },
  { left: "84%", size: 26, color: "#CFAE72", duration: 18, delay: 13 },
  { left: "40%", size: 16, color: "#9DBB8C", duration: 15, delay: 7.5 },
];

/** Where syrup drips from, along the top of the syrup card. */
const DRIPS = [
  { left: "38%", delay: 0 },
  { left: "54%", delay: 1.3 },
  { left: "66%", delay: 2.4 },
];

export function LeafArt({ lbs }: { lbs: number }) {
  const share = Math.min(Math.max(lbs / BIG_DAY_LBS, 0), 1);
  // A quiet day: a small leaf and a couple drifting down. A big run: a full flurry.
  const scale = 0.5 + share * 0.6;
  const falling = 3 + Math.round(share * (FALLING_LEAVES.length - 3));
  const speed = 1.25 - share * 0.45;

  return (
    <Layer>
      {FALLING_LEAVES.slice(0, falling).map((leaf) => (
        <Leaf
          key={leaf.left}
          size={leaf.size}
          color={leaf.color}
          className="anim-leaf-fall particle absolute top-0"
          style={
            {
              "--p": `${leaf.size}px`,
              left: leaf.left,
              animationDuration: `${leaf.duration * speed}s`,
              animationDelay: `-${leaf.delay}s`,
            } as CSSProperties
          }
        />
      ))}

      <div
        className="absolute right-0 -bottom-6 h-60 w-60 origin-bottom-right transition-transform duration-700 ease-out md:right-6"
        style={{ transform: `scale(${scale})`, opacity: 0.8 + share * 0.2 }}
      >
        <Leaf size={240} color="#B7CDA8" className="anim-sway h-full w-full" />
      </div>
    </Layer>
  );
}

const BUBBLES = [
  { left: "58%", size: 11, duration: 12, delay: 0 },
  { left: "66%", size: 7, duration: 10, delay: 3.5 },
  { left: "74%", size: 15, duration: 15, delay: 7 },
  { left: "82%", size: 9, duration: 11, delay: 1.8 },
  { left: "90%", size: 12, duration: 13.5, delay: 5.5 },
  { left: "50%", size: 8, duration: 12.5, delay: 9 },
];

export function DropArt({ fill }: { fill: number }) {
  const level = Math.min(Math.max(fill, 0), 1);
  // Inside the drop is 52 units tall; the syrup surface rises from the bottom.
  const surface = 50 - level * 44;

  return (
    <Layer>
      {DRIPS.map((drip) => (
        <svg
          key={drip.left}
          viewBox="0 0 10 16"
          width="9"
          height="14"
          className="anim-drip particle absolute top-0"
          style={{ "--p": "9px", left: drip.left, animationDelay: `${drip.delay}s` } as CSSProperties}
          fill="#D99E52"
        >
          <path d="M5 0S0 7 0 10.5a5 5 0 0010 0C10 7 5 0 5 0z" />
        </svg>
      ))}

      {BUBBLES.map((bubble) => (
        <span
          key={bubble.left}
          className="anim-bubble particle-round absolute bottom-0 rounded-full border-2 border-[#D9A962] bg-[#F3D6AE]"
          style={
            {
              "--p": `${bubble.size}px`,
              left: bubble.left,
              animationDuration: `${bubble.duration}s`,
              animationDelay: `-${bubble.delay}s`,
            } as CSSProperties
          }
        />
      ))}

      <div className="absolute top-4 right-6 h-32 w-24">
        <svg viewBox="0 0 40 52" className="anim-bob h-full w-full overflow-visible">
          <defs>
            <clipPath id="syrup-drop">
              <path d={DROP_PATH} />
            </clipPath>
          </defs>
          <path d={DROP_PATH} fill="#F0D3AC" />
          <g clipPath="url(#syrup-drop)">
            {/* A wide wavy surface that slides sideways, so the syrup always looks like it is moving. */}
            <g style={{ transform: `translateY(${surface}px)`, transition: "transform 800ms ease-out" }}>
              <g className="anim-wave">
                <path
                  d="M-40 3 q5 -3 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 V60 H-40z"
                  fill="#D99E52"
                />
              </g>
            </g>
          </g>
          <path
            d="M13 22c-3 5-4 9-3 13"
            stroke="#FFFFFF"
            strokeOpacity="0.6"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </Layer>
  );
}

export type WeatherKind = "sun" | "partly" | "cloud" | "rain" | "storm" | "snow";

export function weatherKind(day: DemoWeatherDay): WeatherKind {
  if (day.snowIn >= 0.2) return "snow";
  if (day.precipIn >= 0.5 && day.windMph >= 18) return "storm";
  if (day.precipIn >= 0.15) return "rain";
  if (day.cloudPercent >= 80) return "cloud";
  if (day.cloudPercent >= 40) return "partly";
  return "sun";
}

const CLOUD = "M14 38h30a10 10 0 000-20 14 14 0 00-27-3A11 11 0 0014 38z";

function Cloud({
  top,
  rest,
  width,
  duration,
  delay,
  color,
}: {
  top: string;
  /** Where the cloud sits when animations are off */
  rest: string;
  width: number;
  duration: number;
  delay: number;
  color: string;
}) {
  return (
    <svg
      viewBox="4 6 52 34"
      width={width}
      className="anim-across absolute"
      style={{ top, left: rest, animationDuration: `${duration}s`, animationDelay: `-${delay}s` }}
      fill={color}
    >
      <path d={CLOUD} />
    </svg>
  );
}

function Sun({ size }: { size: number }) {
  return (
    <div className="absolute top-3 right-8 md:right-14" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="h-full w-full overflow-visible">
        <circle cx="32" cy="32" r="22" fill="#F6E3A8" className="anim-glow" />
        <g className="anim-spin" stroke="#E8C77A" strokeWidth="3" strokeLinecap="round">
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index * Math.PI) / 6;
            return (
              <line
                key={index}
                x1={32 + Math.cos(angle) * 17}
                y1={32 + Math.sin(angle) * 17}
                x2={32 + Math.cos(angle) * 24}
                y2={32 + Math.sin(angle) * 24}
              />
            );
          })}
        </g>
        <circle cx="32" cy="32" r="12" fill="#E8C77A" />
      </svg>
    </div>
  );
}

const PRECIP_COLUMNS = [
  "52%",
  "57%",
  "61%",
  "66%",
  "70%",
  "74%",
  "79%",
  "83%",
  "87%",
  "92%",
  "96%",
  "45%",
  "63%",
  "89%",
];

export function WeatherArt({ kind }: { kind: WeatherKind }) {
  const dark = kind === "storm";
  const cloudColor = dark ? "#93A5B6" : "#B5C7D8";
  const cloudy = kind !== "sun";

  return (
    <Layer>
      {kind === "sun" || kind === "partly" ? <Sun size={kind === "sun" ? 140 : 110} /> : null}

      {cloudy || kind === "sun" ? (
        <>
          <Cloud top="12%" rest="58%" width={kind === "sun" ? 90 : 150} duration={64} delay={6} color={cloudColor} />
          <Cloud top="38%" rest="78%" width={kind === "sun" ? 60 : 110} duration={52} delay={28} color={cloudColor} />
        </>
      ) : null}
      {cloudy && kind !== "partly" ? (
        <>
          <Cloud top="2%" rest="68%" width={190} duration={78} delay={46} color={cloudColor} />
          <Cloud top="55%" rest="88%" width={90} duration={44} delay={14} color={cloudColor} />
        </>
      ) : null}

      {kind === "rain" || kind === "storm"
        ? PRECIP_COLUMNS.map((left, index) => (
            <span
              key={left}
              className="anim-precip absolute top-[18%] h-4 w-[2px] rounded-full bg-[#7E98B0] md:h-6 md:w-[3px]"
              style={{
                left,
                animationDuration: `${1.8 + (index % 4) * 0.4}s`,
                animationDelay: `-${(index * 0.6) % 2.4}s`,
              }}
            />
          ))
        : null}

      {kind === "snow"
        ? PRECIP_COLUMNS.map((left, index) => (
            <span
              key={left}
              className="anim-snow particle-round absolute top-[14%] rounded-full bg-white shadow-[0_0_0_1px_rgba(126,152,176,0.35)]"
              style={
                {
                  "--p": `${5 + (index % 3) * 2}px`,
                  left,
                  opacity: 0.9,
                  animationDuration: `${9 + (index % 5) * 1.5}s`,
                  animationDelay: `-${(index * 1.4) % 10}s`,
                } as CSSProperties
              }
            />
          ))
        : null}

      {kind === "storm" ? (
        <svg viewBox="0 0 20 34" className="anim-flash absolute top-[22%] right-[22%] h-24 w-14" fill="#E8C77A">
          <path d="M12 0L2 19h7l-3 15 12-21h-7l4-13z" />
        </svg>
      ) : null}
    </Layer>
  );
}
