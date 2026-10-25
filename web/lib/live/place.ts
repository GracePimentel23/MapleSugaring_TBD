/**
 * Where the club is. RIT taps trees on the grounds of the Joseph M. Lobozzo Alumni House (west side
 * of campus, Andrews Memorial Drive). The weather forecast and the Stations map center here.
 */
export const GROVE_CENTER = { lat: 43.08272, lon: -77.68595 };

/** Day boundaries ("today", "collected Mar 5") follow the club's clock, like the worker's TZ_DISPLAY. */
export const TIME_ZONE = "America/New_York";

/**
 * A map spot for a station that has no position saved yet: spread around the grove center so pins
 * don't sit on top of each other. Drag-to-place can save a real one later.
 */
export function defaultPosition(bucketId: number): { lat: number; lon: number } {
  const angle = bucketId * 2.39996; // golden angle, so neighbours never line up
  const meters = 14 + 9 * Math.sqrt(bucketId);
  return {
    lat: GROVE_CENTER.lat + (meters * Math.cos(angle)) / 111_320,
    lon: GROVE_CENTER.lon + (meters * Math.sin(angle)) / (111_320 * Math.cos((GROVE_CENTER.lat * Math.PI) / 180)),
  };
}
