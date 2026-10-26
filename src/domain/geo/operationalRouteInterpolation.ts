import type { AirportOperationalPosition } from "./operationalPosition";

type OperationalRoutePoint = Readonly<{
  accumulatedDistance: number;
  operationalPosition?: AirportOperationalPosition;
}>;

export type InterpolatedOperationalRoutePosition = Readonly<{
  wgs84: Readonly<{ longitude: number; latitude: number }>;
  local: Readonly<{ eastMeters: number; northMeters: number }>;
}>;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * 按局部米制累计距离插值运行位置。只接受带权威运行坐标的路线点，
 * 不从旧图片百分比坐标反算经纬度。
 */
export function interpolateOperationalRoutePosition(
  points: readonly OperationalRoutePoint[],
  totalDistanceMeters: number,
  requestedProgress: number,
): InterpolatedOperationalRoutePosition | null {
  if (
    points.length < 2 ||
    totalDistanceMeters <= 0 ||
    points.some(
      (point) =>
        !point.operationalPosition ||
        point.operationalPosition.authority === "legacy_projection",
    )
  ) {
    return null;
  }

  const targetDistance =
    clamp(requestedProgress, 0, 1) * totalDistanceMeters;
  let segmentIndex = points.length - 2;
  for (let index = 0; index < points.length - 1; index += 1) {
    if (targetDistance <= points[index + 1].accumulatedDistance) {
      segmentIndex = index;
      break;
    }
  }

  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  const startPosition = start.operationalPosition!;
  const endPosition = end.operationalPosition!;
  const span = end.accumulatedDistance - start.accumulatedDistance;
  const ratio = span <= 0
    ? 0
    : clamp((targetDistance - start.accumulatedDistance) / span, 0, 1);

  return Object.freeze({
    wgs84: Object.freeze({
      longitude:
        startPosition.wgs84.longitude +
        (endPosition.wgs84.longitude - startPosition.wgs84.longitude) * ratio,
      latitude:
        startPosition.wgs84.latitude +
        (endPosition.wgs84.latitude - startPosition.wgs84.latitude) * ratio,
    }),
    local: Object.freeze({
      eastMeters:
        startPosition.local.eastMeters +
        (endPosition.local.eastMeters - startPosition.local.eastMeters) * ratio,
      northMeters:
        startPosition.local.northMeters +
        (endPosition.local.northMeters - startPosition.local.northMeters) * ratio,
    }),
  });
}
