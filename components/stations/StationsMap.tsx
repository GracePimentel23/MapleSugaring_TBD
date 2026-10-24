"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { GROVE_CENTER } from "@/lib/demo/profiles";
import { NorthIcon } from "@/components/icons";
import { stationStatusMeta } from "@/lib/selectors/stations";
import type { StationView } from "@/lib/types/schema";
import { formatLbsNumber } from "@/lib/units";

/**
 * A draggable, zoomable map of the grove built straight from OpenStreetMap
 * tiles, so it needs no mapping library. Only the tiles in view are drawn and
 * new ones load as the map is dragged.
 */

const TILE_SIZE = 256;
/** About 0.44 m per pixel at RIT's latitude: the grove spans a couple hundred px. */
const DEFAULT_ZOOM = 18;
const MIN_ZOOM = 15;
/** OpenStreetMap's standard tiles stop at 19. */
const MAX_ZOOM = 19;
/** How far from the grove the map can be dragged, in pixels at the default zoom. */
const PAN_LIMIT = 1500;
/** Pointer travel below this still counts as a click, not a drag. */
const DRAG_THRESHOLD = 4;
/** Used for the first render, before the container has been measured. */
const FALLBACK_SIZE = { width: 1200, height: 400 };

interface Point {
  x: number;
  y: number;
}

/** Web Mercator lat/lon -> global pixel position at `zoom`. */
function project(lat: number, lon: number, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function StationMarker({
  station,
  position,
  highlighted,
  showLocation,
  onSelect,
}: {
  station: StationView;
  position: Point;
  highlighted: boolean;
  /** Label the area once, under the first pin in it */
  showLocation: boolean;
  onSelect: () => void;
}) {
  const meta = stationStatusMeta[station.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: position.x, top: position.y }}
      aria-label={`${station.name}, ${meta.label}. Open station`}
    >
      {/* Hover card */}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-left text-xs whitespace-nowrap text-white shadow-lg group-hover:block group-focus-visible:block"
        style={{ background: "var(--color-text)" }}
      >
        <span className="block font-semibold">{station.name}</span>
        <span className="block text-[12px] opacity-80">
          {meta.label} · {formatLbsNumber(station.currentLbs)} /{" "}
          {formatLbsNumber(station.capacityLbs)} lbs
        </span>
      </span>

      {/* Ring pin: the ring color is the station's status */}
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-sans text-sm font-bold shadow-md transition-transform group-hover:scale-110"
        style={{
          border: `4px solid ${meta.bar}`,
          color: "var(--color-text)",
          boxShadow: highlighted ? "0 0 0 4px rgba(223,168,0,0.45)" : undefined,
        }}
      >
        {station.shortName.replace("#", "")}
      </span>

      {/* Location under the pin */}
      {showLocation ? (
      <span className="absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded-full bg-white/85 px-1.5 text-[12px] whitespace-nowrap text-text shadow-sm">
        {station.location}
      </span>
      ) : null}
    </button>
  );
}

function MapButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center bg-white text-text transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:text-muted/50"
    >
      {children}
    </button>
  );
}

export default function StationsMap({
  stations,
  highlightedId,
  onSelect,
}: {
  stations: StationView[];
  highlightedId: number | null;
  onSelect: (bucketId: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(FALLBACK_SIZE);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  /** How far the view has been dragged from the grove, in pixels at the current zoom. */
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; start: Point; startPan: Point; moved: boolean } | null>(
    null,
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Everything is positioned relative to the grove centre, which keeps CSS
  // offsets small (global pixel coordinates at zoom 18+ are tens of millions).
  const origin = project(GROVE_CENTER.lat, GROVE_CENTER.lon, zoom);
  const view = { x: origin.x + pan.x, y: origin.y + pan.y };
  const limit = PAN_LIMIT * 2 ** (zoom - DEFAULT_ZOOM);

  const firstTileX = Math.floor((view.x - size.width / 2) / TILE_SIZE);
  const lastTileX = Math.floor((view.x + size.width / 2) / TILE_SIZE);
  const firstTileY = Math.floor((view.y - size.height / 2) / TILE_SIZE);
  const lastTileY = Math.floor((view.y + size.height / 2) / TILE_SIZE);

  const tiles: { key: string; src: string; left: number; top: number }[] = [];
  for (let y = firstTileY; y <= lastTileY; y += 1) {
    for (let x = firstTileX; x <= lastTileX; x += 1) {
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        src: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
        left: x * TILE_SIZE - origin.x,
        top: y * TILE_SIZE - origin.y,
      });
    }
  }

  function changeZoom(delta: number) {
    const next = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);
    if (next === zoom) return;
    // Keep the same spot in the middle of the view.
    const factor = 2 ** (next - zoom);
    setPan((current) => ({ x: current.x * factor, y: current.y * factor }));
    setZoom(next);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    // Markers and controls handle their own clicks.
    if ((event.target as HTMLElement).closest("button, a")) return;
    drag.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      startPan: pan,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.start.x;
    const dy = event.clientY - current.start.y;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!current.moved) {
      current.moved = true;
      setDragging(true);
    }
    setPan({
      x: clamp(current.startPan.x - dx, -limit, limit),
      y: clamp(current.startPan.y - dy, -limit, limit),
    });
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }

  const centred = pan.x === 0 && pan.y === 0 && zoom === DEFAULT_ZOOM;

  return (
    <div className="overflow-hidden rounded-2xl">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative h-[360px] touch-none overflow-hidden bg-[#E4EDDC] select-none md:h-[440px]"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        {/* Moves with the drag; its origin is the grove centre. */}
        <div
          className="absolute top-0 left-0"
          style={{
            transform: `translate(${size.width / 2 - pan.x}px, ${size.height / 2 - pan.y}px)`,
          }}
        >
          {tiles.map((tile) => (
            // Plain <img>: these are third-party map tiles, not app assets for next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={tile.key}
              src={tile.src}
              alt=""
              width={TILE_SIZE}
              height={TILE_SIZE}
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ left: tile.left, top: tile.top }}
            />
          ))}

          {stations.map((station, index) => {
            const point = project(station.lat, station.lon, zoom);
            const firstInArea =
              stations.findIndex((item) => item.location === station.location) === index;
            return (
              <StationMarker
                key={station.bucketId}
                station={station}
                position={{ x: point.x - origin.x, y: point.y - origin.y }}
                highlighted={highlightedId === station.bucketId}
                showLocation={firstInArea}
                onSelect={() => onSelect(station.bucketId)}
              />
            );
          })}
        </div>

        <div className="absolute top-3 right-3 z-20 flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border shadow-sm">
          <MapButton label="Zoom in" onClick={() => changeZoom(1)} disabled={zoom >= MAX_ZOOM}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </MapButton>
          <MapButton label="Zoom out" onClick={() => changeZoom(-1)} disabled={zoom <= MIN_ZOOM}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </MapButton>
          <MapButton
            label="Back to the grove"
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setZoom(DEFAULT_ZOOM);
            }}
            disabled={centred}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </MapButton>
        </div>

        <span className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-0.5 rounded-md bg-white/85 px-1.5 py-0.5 text-xs font-medium text-muted">
          N <NorthIcon size={12} />
        </span>

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="absolute right-0 bottom-0 z-20 bg-white/80 px-1.5 py-0.5 text-[12px] text-muted"
        >
          © OpenStreetMap contributors
        </a>
      </div>
    </div>
  );
}
