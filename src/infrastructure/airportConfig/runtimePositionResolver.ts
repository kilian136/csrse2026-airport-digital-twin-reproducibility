import type { Wgs84Coordinate } from "../../domain/geo";
import type {
  ProjectedAirportCoordinate,
  ProjectedAirportFeature,
} from "./types";

function featureCenter(
  feature: ProjectedAirportFeature,
): Wgs84Coordinate | null {
  if (feature.geometry.type === "Point") {
    return feature.geometry.coordinates.wgs84;
  }
  const coordinates =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates;
  const uniqueCoordinates =
    coordinates.length > 1 &&
    coordinates[0].wgs84.longitude ===
      coordinates[coordinates.length - 1].wgs84.longitude &&
    coordinates[0].wgs84.latitude ===
      coordinates[coordinates.length - 1].wgs84.latitude
      ? coordinates.slice(0, -1)
      : coordinates;
  if (uniqueCoordinates.length === 0) return null;
  return uniqueCoordinates.reduce(
    (center, coordinate) => ({
      longitude:
        center.longitude +
        coordinate.wgs84.longitude / uniqueCoordinates.length,
      latitude:
        center.latitude +
        coordinate.wgs84.latitude / uniqueCoordinates.length,
    }),
    { longitude: 0, latitude: 0 },
  );
}

/**
 * 由廊桥末端推算飞机在机位上的实际机身中心。
 *
 * 登机口点位于建筑侧，不能作为飞机滑行起点；滑行、图标和运行锚点必须
 * 共用这一坐标，避免飞机从航站楼内起步或误吸附到相邻机位引导线。
 */
export function resolveGateAircraftCenterCoordinate(
  gate: ProjectedAirportFeature,
  features: readonly ProjectedAirportFeature[],
): ProjectedAirportCoordinate | null {
  if (gate.geometry.type !== "Point") return null;
  const gateCoordinate = gate.geometry.coordinates;
  if (gate.properties.runtimePositionAuthority === "compiled_parking_endpoint") {
    return gateCoordinate;
  }
  const bridgeEnds = features.flatMap((feature) => {
    if (
      feature.properties.kind !== "boarding_bridge" ||
      feature.properties.parentGateId !== gate.properties.id ||
      feature.geometry.type !== "LineString"
    ) {
      return [];
    }
    const end = feature.geometry.coordinates.at(-1);
    return end ? [end] : [];
  });
  if (bridgeEnds.length === 0) return gateCoordinate;
  const doorCoordinate = bridgeEnds.reduce(
    (center, coordinate) => ({
      wgs84: {
        longitude:
          center.wgs84.longitude +
          coordinate.wgs84.longitude / bridgeEnds.length,
        latitude:
          center.wgs84.latitude +
          coordinate.wgs84.latitude / bridgeEnds.length,
      },
      local: {
        eastMeters:
          center.local.eastMeters +
          coordinate.local.eastMeters / bridgeEnds.length,
        northMeters:
          center.local.northMeters +
          coordinate.local.northMeters / bridgeEnds.length,
      },
    }),
    {
      wgs84: { longitude: 0, latitude: 0 },
      local: { eastMeters: 0, northMeters: 0 },
    },
  );
  const eastMeters =
    doorCoordinate.local.eastMeters - gateCoordinate.local.eastMeters;
  const northMeters =
    doorCoordinate.local.northMeters - gateCoordinate.local.northMeters;
  const bridgeLength = Math.hypot(eastMeters, northMeters);
  if (bridgeLength < 0.1) return doorCoordinate;
  const scale = (bridgeLength + 16) / bridgeLength;
  return {
    wgs84: {
      longitude:
        gateCoordinate.wgs84.longitude +
        (doorCoordinate.wgs84.longitude - gateCoordinate.wgs84.longitude) *
          scale,
      latitude:
        gateCoordinate.wgs84.latitude +
        (doorCoordinate.wgs84.latitude - gateCoordinate.wgs84.latitude) * scale,
    },
    local: {
      eastMeters:
        gateCoordinate.local.eastMeters + eastMeters * scale,
      northMeters:
        gateCoordinate.local.northMeters + northMeters * scale,
    },
  };
}

/** 用人工确认的语义绑定解析运行机位，不读取旧图片坐标或做最近点猜测。 */
export function resolveRuntimeStandWgs84Coordinate(
  standId: string | null,
  features: readonly ProjectedAirportFeature[],
  bindings: Readonly<Record<string, string>>,
): Wgs84Coordinate | null {
  if (!standId) return null;
  const featureId = bindings[standId] ?? standId;
  const feature = features.find(
    (candidate) =>
      candidate.properties.id === featureId ||
      candidate.properties.name === standId,
  );
  if (!feature || feature.geometry.type !== "Point") return null;
  return feature.properties.kind === "gate"
    ? resolveGateAircraftCenterCoordinate(feature, features)?.wgs84 ?? null
    : featureCenter(feature);
}

/** 解析人工标定的保障基地中心；优先使用配置中的supportBaseId语义。 */
export function resolveSupportBaseWgs84Coordinate(
  baseId: string,
  features: readonly ProjectedAirportFeature[],
  bindings: Readonly<Partial<Record<string, string>>>,
): Wgs84Coordinate | null {
  const semanticFeature = features.find(
    (feature) => feature.properties.supportBaseId === baseId,
  );
  const boundFeatureId = bindings[baseId];
  const boundFeature = boundFeatureId
    ? features.find((feature) => feature.properties.id === boundFeatureId)
    : null;
  const source = semanticFeature ?? boundFeature;
  return source ? featureCenter(source) : null;
}

/** 解析人工标定的保障等待区；没有显式语义或绑定时绝不猜测最近点。 */
export function resolveSupportWaitingAreaWgs84Coordinate(
  waitingAreaId: string,
  features: readonly ProjectedAirportFeature[],
  bindings: Readonly<Partial<Record<string, string>>>,
): Wgs84Coordinate | null {
  const semanticFeature = features.find(
    (feature) =>
      feature.properties.supportWaitingAreaId === waitingAreaId,
  );
  const boundFeatureId = bindings[waitingAreaId];
  const boundFeature = boundFeatureId
    ? features.find((feature) => feature.properties.id === boundFeatureId)
    : null;
  const source = semanticFeature ?? boundFeature;
  return source ? featureCenter(source) : null;
}
