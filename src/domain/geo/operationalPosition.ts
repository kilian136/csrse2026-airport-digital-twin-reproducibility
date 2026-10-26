export type OperationalPositionAuthority =
  | "wgs84_configuration"
  | "compiled_network"
  | "local_simulation"
  | "telemetry"
  | "legacy_projection";

export type AirportOperationalPosition = Readonly<{
  wgs84: Readonly<{
    longitude: number;
    latitude: number;
  }>;
  local: Readonly<{
    eastMeters: number;
    northMeters: number;
  }>;
  authority: OperationalPositionAuthority;
}>;

export type AirportOperationalRoutePoint = Readonly<{
  nodeId: string;
  position: AirportOperationalPosition;
  headingDegrees?: number;
  accumulatedDistanceMeters: number;
}>;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label}必须是有限数值。`);
  }
}

/**
 * 创建与底图无关的运行位置。WGS84用于交换和显示，局部米制坐标用于运行计算。
 */
export function createAirportOperationalPosition(input: {
  longitude: number;
  latitude: number;
  eastMeters: number;
  northMeters: number;
  authority: OperationalPositionAuthority;
}): AirportOperationalPosition {
  assertFinite(input.longitude, "经度");
  assertFinite(input.latitude, "纬度");
  assertFinite(input.eastMeters, "局部东向坐标");
  assertFinite(input.northMeters, "局部北向坐标");
  if (input.longitude < -180 || input.longitude > 180) {
    throw new Error("经度必须位于-180到180度之间。");
  }
  if (input.latitude < -90 || input.latitude > 90) {
    throw new Error("纬度必须位于-90到90度之间。");
  }
  return Object.freeze({
    wgs84: Object.freeze({
      longitude: input.longitude,
      latitude: input.latitude,
    }),
    local: Object.freeze({
      eastMeters: input.eastMeters,
      northMeters: input.northMeters,
    }),
    authority: input.authority,
  });
}

/** 旧底图反算结果只能用于兼容显示，不能成为新版运行或地图定位权威。 */
export function isAuthoritativeOperationalPosition(
  position: AirportOperationalPosition | null | undefined,
): position is AirportOperationalPosition {
  return Boolean(position && position.authority !== "legacy_projection");
}

export function createAirportOperationalRoutePoint(input: {
  nodeId: string;
  position: AirportOperationalPosition;
  headingDegrees?: number;
  accumulatedDistanceMeters: number;
}): AirportOperationalRoutePoint {
  assertFinite(input.accumulatedDistanceMeters, "累计距离");
  if (input.accumulatedDistanceMeters < 0) {
    throw new Error("累计距离不能为负数。");
  }
  if (input.headingDegrees !== undefined) {
    assertFinite(input.headingDegrees, "航向");
  }
  return Object.freeze({
    nodeId: input.nodeId,
    position: input.position,
    ...(input.headingDegrees === undefined
      ? {}
      : { headingDegrees: input.headingDegrees }),
    accumulatedDistanceMeters: input.accumulatedDistanceMeters,
  });
}
