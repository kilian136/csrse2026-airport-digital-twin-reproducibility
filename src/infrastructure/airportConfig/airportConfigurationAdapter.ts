import type {
  AirportCoordinateConverter,
  AirportLocalCoordinateConverter,
  Wgs84Coordinate,
} from "../../domain/geo";
import type {
  AirportConfigurationFeature,
  AirportConfigurationPackage,
  AirportConfigurationSourceBundle,
  AirportFeatureGeometry,
  AirportFeatureKind,
  AirportFeatureProperties,
  AirportGeospatialIntegration,
  AirportSpatialCoordinate,
  GateLayoutPackage,
  GeoJsonPosition,
  ProjectedAirportFeature,
  ProjectedAirportGeometry,
} from "./types";

type AdapterDependencies = Readonly<{
  coordinateConverter: AirportCoordinateConverter;
  localCoordinateConverter: AirportLocalCoordinateConverter;
}>;

function assertFinitePosition(position: GeoJsonPosition, context: string): void {
  if (
    position.length !== 2 ||
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1])
  ) {
    throw new Error(`${context}包含无效的经纬度坐标。`);
  }
}

function projectPosition(
  position: GeoJsonPosition,
  dependencies: AdapterDependencies,
): AirportSpatialCoordinate {
  assertFinitePosition(position, "机场配置");
  const wgs84: Wgs84Coordinate = {
    longitude: position[0],
    latitude: position[1],
  };
  return Object.freeze({
    wgs84: Object.freeze(wgs84),
    local: Object.freeze(
      dependencies.localCoordinateConverter.wgs84ToLocal(wgs84),
    ),
  });
}

function projectGeometry(
  geometry: AirportFeatureGeometry,
  dependencies: AdapterDependencies,
): ProjectedAirportGeometry {
  if (geometry.type === "Point") {
    return Object.freeze({
      type: "Point" as const,
      coordinates: projectPosition(geometry.coordinates, dependencies),
    });
  }
  if (geometry.type === "LineString") {
    if (geometry.coordinates.length < 2) {
      throw new Error("机场线要素至少需要两个坐标点。");
    }
    return Object.freeze({
      type: "LineString" as const,
      coordinates: Object.freeze(
        geometry.coordinates.map((coordinate) =>
          projectPosition(coordinate, dependencies),
        ),
      ),
    });
  }
  if (
    geometry.coordinates.length === 0 ||
    geometry.coordinates.some((ring) => ring.length < 4)
  ) {
    throw new Error("机场面要素必须包含至少一个闭合坐标环。");
  }
  return Object.freeze({
    type: "Polygon" as const,
    coordinates: Object.freeze(
      geometry.coordinates.map((ring) =>
        Object.freeze(
          ring.map((coordinate) => projectPosition(coordinate, dependencies)),
        ),
      ),
    ),
  });
}

function validatePackage(
  airportIdent: string,
  packageData: AirportConfigurationPackage,
): void {
  if (
    packageData.schemaVersion !== "1.0.0" ||
    packageData.airportIdent !== airportIdent ||
    packageData.coordinateSystem !== "WGS84" ||
    packageData.geoJsonCoordinateOrder !== "longitude_latitude" ||
    packageData.features.type !== "FeatureCollection"
  ) {
    throw new Error(`机场配置包与${airportIdent}契约不兼容。`);
  }
}

function gateLayoutToFeatures(
  airportIdent: string,
  layout: GateLayoutPackage,
): AirportConfigurationFeature[] {
  if (
    layout.schemaVersion !== "1.0.0" ||
    layout.airportIdent !== airportIdent
  ) {
    throw new Error(`登机口配置包与${airportIdent}契约不兼容。`);
  }
  const createdAt = "2026-09-27T00:00:00.000Z";
  return layout.gates.flatMap((gate) => {
    const gateNumber = String(gate.number).padStart(2, "0");
    const gateId = `${airportIdent}-${layout.gatePrefix}-GATE-${gateNumber}`;
    const gateProperties: AirportFeatureProperties = {
      id: gateId,
      airportIdent,
      kind: "gate",
      name: `${layout.gatePrefix}-G${gateNumber}`,
      createdAt,
      parentTerminalId: layout.terminalId,
      parentConcourseId: layout.concourseId,
      gateNumber: gate.number,
      dataStatus: "complete",
      source: layout.source,
      operational: true,
    };
    const gateFeature: AirportConfigurationFeature = {
      type: "Feature",
      properties: gateProperties,
      geometry: { type: "Point", coordinates: gate.coordinate },
    };
    const bridgeFeatures = gate.bridges.map((bridge, bridgeIndex) => {
      const suffix = bridge.position
        ? bridge.position.toUpperCase()
        : String(bridgeIndex + 1).padStart(2, "0");
      return {
        type: "Feature" as const,
        properties: {
          id: `${gateId}-BRIDGE-${suffix}`,
          airportIdent,
          kind: "boarding_bridge" as const,
          name: `${layout.gatePrefix}-G${gateNumber}廊桥${bridgeIndex + 1}`,
          createdAt,
          parentGateId: gateId,
          bridgePosition: bridge.position,
          dataStatus: "complete" as const,
          source: layout.source,
          operational: false,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: [gate.coordinate, bridge.coordinate],
        },
      } satisfies AirportConfigurationFeature;
    });
    return [gateFeature, ...bridgeFeatures];
  });
}

function groupFeaturesByKind(
  features: readonly ProjectedAirportFeature[],
): ReadonlyMap<AirportFeatureKind, readonly ProjectedAirportFeature[]> {
  const grouped = new Map<AirportFeatureKind, ProjectedAirportFeature[]>();
  features.forEach((feature) => {
    const group = grouped.get(feature.properties.kind) ?? [];
    group.push(feature);
    grouped.set(feature.properties.kind, group);
  });
  return grouped;
}

/**
 * 将编辑器的WGS84配置转换为运行系统使用的WGS84和局部米制坐标。
 * 旧底图百分比坐标不进入机场配置对象。
 * OSM路网在经过拓扑编译前只作为只读参考，不能替换运行路网。
 */
export function adaptAirportConfigurationBundle(
  bundle: AirportConfigurationSourceBundle,
  dependencies: AdapterDependencies,
): AirportGeospatialIntegration {
  bundle.featurePackages.forEach((packageData) =>
    validatePackage(bundle.airportIdent, packageData),
  );
  if (bundle.networkSnapshot.airportIdent !== bundle.airportIdent) {
    throw new Error("OSM快照与机场配置包不属于同一机场。");
  }

  const sourceFeatures = [
    ...bundle.featurePackages.flatMap(
      (packageData) => packageData.features.features,
    ),
    ...bundle.gateLayouts.flatMap((layout) =>
      gateLayoutToFeatures(bundle.airportIdent, layout),
    ),
  ];
  const featureIds = new Set<string>();
  const projectedFeatures = sourceFeatures.map((feature) => {
    if (feature.properties.airportIdent !== bundle.airportIdent) {
      throw new Error(`要素${feature.properties.id}属于其他机场。`);
    }
    if (featureIds.has(feature.properties.id)) {
      throw new Error(`机场配置包含重复要素编号：${feature.properties.id}`);
    }
    featureIds.add(feature.properties.id);
    return Object.freeze({
      properties: Object.freeze({ ...feature.properties }),
      geometry: projectGeometry(feature.geometry, dependencies),
    });
  });

  const incompleteKinds = bundle.networkSnapshot.incompleteKinds ?? [];
  const warnings = [
    "当前为只读融合试点，仿真继续使用原AirportProfile运行路网。",
    "OSM线段必须经过交叉点切分、拓扑连接和运行属性校核后才能参与寻路。",
    ...(incompleteKinds.length > 0
      ? [`OSM参考层尚未完成：${incompleteKinds.join("、")}`]
      : []),
  ];

  return Object.freeze({
    airportIdent: bundle.airportIdent,
    mode: "read_only_pilot" as const,
    runtimeNetworkAuthority: "legacy_airport_profile" as const,
    coordinateConverter: dependencies.coordinateConverter,
    localCoordinateConverter: dependencies.localCoordinateConverter,
    features: Object.freeze(projectedFeatures),
    featuresByKind: groupFeaturesByKind(projectedFeatures),
    networkSnapshot: Object.freeze(bundle.networkSnapshot),
    networkSnapshotUrl: bundle.networkSnapshotUrl,
    manualNetworkCalibration: bundle.manualNetworkCalibration,
    manualParkingPositionCatalog: bundle.manualParkingPositionCatalog,
    candidateStandClassificationCatalog:
      bundle.candidateStandClassificationCatalog,
    warnings: Object.freeze(warnings),
  });
}
