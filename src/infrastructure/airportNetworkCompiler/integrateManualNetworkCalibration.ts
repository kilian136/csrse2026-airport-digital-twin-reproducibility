import type {
  AirportLocalCoordinateConverter,
  Wgs84Coordinate,
} from "../../domain/geo";
import type {
  AirportCandidateStandClassificationCatalog,
  AirportCandidateStandClassificationGroup,
  AirportManualNetworkCalibrationSnapshot,
  AirportManualParkingPositionCatalog,
  ProjectedAirportCoordinate,
} from "../airportConfig";
import { deriveTopologyReport } from "./compileOsmAirportNetwork";
import type {
  CandidateAirportNetwork,
  CandidateServiceRoad,
  CandidateManualNetworkCalibrationSummary,
  CandidateNetworkEdge,
  CandidateNetworkKind,
  CandidateNetworkKindSummary,
  CandidateNetworkNode,
  CandidateOperationalPoint,
  CandidateStandClassificationSummary,
} from "./types";

type MutableIntegrationNode = {
  id: string;
  coordinate: ProjectedAirportCoordinate;
};

type Attachment = Readonly<{
  edgeIndex: number;
  ratio: number;
  distanceMeters: number;
  coordinate: Wgs84Coordinate;
}>;

type MutableServiceRoad = Omit<CandidateServiceRoad, "coordinates"> & {
  coordinates: ProjectedAirportCoordinate[];
};

export type ManualNetworkIntegrationReport = CandidateManualNetworkCalibrationSummary;

export type CandidateAirportNetworkWithManualCalibration = CandidateAirportNetwork &
  Readonly<{ manualCalibration: ManualNetworkIntegrationReport }>;

function createProjectedCoordinate(
  coordinate: Wgs84Coordinate,
  converter: AirportLocalCoordinateConverter,
): ProjectedAirportCoordinate {
  return Object.freeze({
    wgs84: Object.freeze({ ...coordinate }),
    local: Object.freeze(converter.wgs84ToLocal(coordinate)),
  });
}

function createManualNodeId(airportIdent: string, coordinate: Wgs84Coordinate) {
  const longitudeCode = Math.round((coordinate.longitude + 180) * 10_000_000);
  const latitudeCode = Math.round((coordinate.latitude + 90) * 10_000_000);
  return `${airportIdent}-MANUAL-N-${longitudeCode}-${latitudeCode}`;
}

function distanceBetween(
  first: ProjectedAirportCoordinate,
  second: ProjectedAirportCoordinate,
) {
  return Math.hypot(
    second.local.eastMeters - first.local.eastMeters,
    second.local.northMeters - first.local.northMeters,
  );
}

function attachManualServiceRoadCoordinate(
  coordinate: Wgs84Coordinate,
  roads: MutableServiceRoad[],
  converter: AirportLocalCoordinateConverter,
  thresholdMeters: number,
) {
  const projected = createProjectedCoordinate(coordinate, converter);
  let nearest: {
    roadIndex: number;
    segmentIndex: number;
    ratio: number;
    distanceMeters: number;
    coordinate: ProjectedAirportCoordinate;
  } | undefined;
  for (let roadIndex = 0; roadIndex < roads.length; roadIndex += 1) {
    const road = roads[roadIndex];
    if (road.reviewStatus === "excluded") continue;
    for (let segmentIndex = 0; segmentIndex < road.coordinates.length - 1; segmentIndex += 1) {
      const from = road.coordinates[segmentIndex];
      const to = road.coordinates[segmentIndex + 1];
      const dx = to.local.eastMeters - from.local.eastMeters;
      const dy = to.local.northMeters - from.local.northMeters;
      const denominator = dx * dx + dy * dy;
      const ratio = denominator === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((projected.local.eastMeters - from.local.eastMeters) * dx +
                (projected.local.northMeters - from.local.northMeters) * dy) /
                denominator,
            ),
          );
      const local = {
        eastMeters: from.local.eastMeters + ratio * dx,
        northMeters: from.local.northMeters + ratio * dy,
      };
      const distanceMeters = Math.hypot(
        projected.local.eastMeters - local.eastMeters,
        projected.local.northMeters - local.northMeters,
      );
      if (nearest && distanceMeters >= nearest.distanceMeters) continue;
      nearest = {
        roadIndex,
        segmentIndex,
        ratio,
        distanceMeters,
        coordinate: Object.freeze({
          wgs84: Object.freeze({
            longitude:
              from.wgs84.longitude + ratio * (to.wgs84.longitude - from.wgs84.longitude),
            latitude:
              from.wgs84.latitude + ratio * (to.wgs84.latitude - from.wgs84.latitude),
          }),
          local: Object.freeze(local),
        }),
      };
    }
  }
  if (!nearest || nearest.distanceMeters > thresholdMeters) return projected;
  const road = roads[nearest.roadIndex];
  if (nearest.ratio <= 1e-6) return road.coordinates[nearest.segmentIndex];
  if (nearest.ratio >= 1 - 1e-6) return road.coordinates[nearest.segmentIndex + 1];
  road.coordinates.splice(nearest.segmentIndex + 1, 0, nearest.coordinate);
  return nearest.coordinate;
}

function integrateManualServiceRoads(
  base: CandidateAirportNetwork,
  calibration: AirportManualNetworkCalibrationSnapshot,
  converter: AirportLocalCoordinateConverter,
  thresholdMeters: number,
) {
  const roads: MutableServiceRoad[] = (base.serviceRoadNetwork?.roads ?? []).map(
    (road) => ({ ...road, coordinates: [...road.coordinates] }),
  );
  const manualSegments = calibration.segments.filter(
    (segment) => segment.kind === "service_road" && segment.coordinates.length >= 2,
  );
  manualSegments.forEach((segment, index) => {
    const coordinates = segment.coordinates.map(([longitude, latitude]) =>
      createProjectedCoordinate({ longitude, latitude }, converter),
    );
    coordinates[0] = attachManualServiceRoadCoordinate(
      coordinates[0].wgs84,
      roads,
      converter,
      thresholdMeters,
    );
    coordinates[coordinates.length - 1] = attachManualServiceRoadCoordinate(
      coordinates.at(-1)!.wgs84,
      roads,
      converter,
      thresholdMeters,
    );
    roads.push({
      id: segment.id,
      sourceWayId: -(index + 1),
      coordinates,
      lengthMeters: coordinates.slice(1).reduce(
        (total, coordinate, coordinateIndex) =>
          total + distanceBetween(coordinates[coordinateIndex], coordinate),
        0,
      ),
      access: "airside_manual_calibration",
      service: "ground_support",
      oneWay: false,
      reviewStatus: "likely_airside",
    });
  });
  if (!base.serviceRoadNetwork || manualSegments.length === 0) {
    return base.serviceRoadNetwork;
  }
  const frozenRoads = Object.freeze(
    roads.map((road) =>
      Object.freeze({ ...road, coordinates: Object.freeze(road.coordinates) }),
    ),
  );
  return Object.freeze({
    ...base.serviceRoadNetwork,
    source: "OpenStreetMap+ManualCalibration" as const,
    importedWayCount: frozenRoads.length,
    totalLengthMeters: frozenRoads.reduce(
      (total, road) => total + road.lengthMeters,
      0,
    ),
    oneWayCount: frozenRoads.filter((road) => road.oneWay).length,
    statusCounts: Object.freeze({
      likely_airside: frozenRoads.filter(
        (road) => road.reviewStatus === "likely_airside",
      ).length,
      requires_review: frozenRoads.filter(
        (road) => road.reviewStatus === "requires_review",
      ).length,
      excluded: frozenRoads.filter((road) => road.reviewStatus === "excluded")
        .length,
    }),
    roads: frozenRoads,
  });
}

function findNearestAttachment(
  coordinate: Wgs84Coordinate,
  nodesById: ReadonlyMap<string, MutableIntegrationNode>,
  edges: readonly CandidateNetworkEdge[],
  converter: AirportLocalCoordinateConverter,
): Attachment | null {
  const projected = createProjectedCoordinate(coordinate, converter);
  let nearest: Attachment | null = null;
  edges.forEach((edge, edgeIndex) => {
    const from = nodesById.get(edge.fromNodeId)?.coordinate;
    const to = nodesById.get(edge.toNodeId)?.coordinate;
    if (!from || !to) return;
    const dx = to.local.eastMeters - from.local.eastMeters;
    const dy = to.local.northMeters - from.local.northMeters;
    const denominator = dx * dx + dy * dy;
    const ratio = denominator === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((projected.local.eastMeters - from.local.eastMeters) * dx +
              (projected.local.northMeters - from.local.northMeters) * dy) /
              denominator,
          ),
        );
    const snappedLocal = {
      eastMeters: from.local.eastMeters + ratio * dx,
      northMeters: from.local.northMeters + ratio * dy,
    };
    const distanceMeters = Math.hypot(
      projected.local.eastMeters - snappedLocal.eastMeters,
      projected.local.northMeters - snappedLocal.northMeters,
    );
    if (nearest && distanceMeters >= nearest.distanceMeters) return;
    nearest = {
      edgeIndex,
      ratio,
      distanceMeters,
      coordinate: {
        longitude:
          from.wgs84.longitude + ratio * (to.wgs84.longitude - from.wgs84.longitude),
        latitude:
          from.wgs84.latitude + ratio * (to.wgs84.latitude - from.wgs84.latitude),
      },
    };
  });
  return nearest;
}

function buildKindSummary(
  base: CandidateAirportNetwork,
  edges: readonly CandidateNetworkEdge[],
  calibration: AirportManualNetworkCalibrationSnapshot,
) {
  const result: Record<
    CandidateNetworkKind,
    { wayCount: number; edgeCount: number; lengthMeters: number }
  > = {
    runway: { ...base.report.kinds.runway, edgeCount: 0, lengthMeters: 0 },
    taxiway: { ...base.report.kinds.taxiway, edgeCount: 0, lengthMeters: 0 },
    taxilane: { ...base.report.kinds.taxilane, edgeCount: 0, lengthMeters: 0 },
    parking_position: {
      ...base.report.kinds.parking_position,
      edgeCount: 0,
      lengthMeters: 0,
    },
  };
  calibration.segments.forEach((segment) => {
    if (segment.kind !== "service_road") result[segment.kind].wayCount += 1;
  });
  edges.forEach((edge) => {
    result[edge.primaryKind].edgeCount += 1;
    result[edge.primaryKind].lengthMeters += edge.lengthMeters;
  });
  return Object.fromEntries(
    Object.entries(result).map(([kind, summary]) => [kind, Object.freeze(summary)]),
  ) as Record<CandidateNetworkKind, CandidateNetworkKindSummary>;
}

export function integrateManualNetworkCalibration(
  base: CandidateAirportNetwork,
  calibration: AirportManualNetworkCalibrationSnapshot,
  converter: AirportLocalCoordinateConverter,
  thresholdMeters = 12,
  parkingPositionCatalog?: AirportManualParkingPositionCatalog,
  standClassificationCatalog?: AirportCandidateStandClassificationCatalog,
): CandidateAirportNetworkWithManualCalibration {
  if (calibration.airportIdent !== base.airportIdent) {
    throw new Error(
      `人工路网机场不匹配：${calibration.airportIdent} != ${base.airportIdent}`,
    );
  }
  if (
    parkingPositionCatalog &&
    parkingPositionCatalog.airportIdent !== base.airportIdent
  ) {
    throw new Error(
      `人工机位编号表机场不匹配：${parkingPositionCatalog.airportIdent} != ${base.airportIdent}`,
    );
  }
  if (
    standClassificationCatalog &&
    standClassificationCatalog.airportIdent !== base.airportIdent
  ) {
    throw new Error(
      `候选机位分类表机场不匹配：${standClassificationCatalog.airportIdent} != ${base.airportIdent}`,
    );
  }
  const designationByCorridorId = new Map(
    (parkingPositionCatalog?.positions ?? []).map((designation) => [
      designation.corridorId,
      designation,
    ]),
  );
  if (
    designationByCorridorId.size !==
    (parkingPositionCatalog?.positions.length ?? 0)
  ) {
    throw new Error("人工机位编号表包含重复的引导线绑定。");
  }
  const designationIds = new Set(
    (parkingPositionCatalog?.positions ?? []).map((designation) => designation.id),
  );
  const designationSequences = new Set(
    (parkingPositionCatalog?.positions ?? []).map(
      (designation) => designation.sequence,
    ),
  );
  if (
    designationIds.size !== (parkingPositionCatalog?.positions.length ?? 0) ||
    designationSequences.size !==
      (parkingPositionCatalog?.positions.length ?? 0)
  ) {
    throw new Error("人工机位编号表包含重复的机位编号或顺序号。");
  }
  const calibrationCorridorIds = new Set(
    calibration.segments.map((segment) => segment.id),
  );
  const unknownDesignation = (parkingPositionCatalog?.positions ?? []).find(
    (designation) => !calibrationCorridorIds.has(designation.corridorId),
  );
  if (unknownDesignation) {
    throw new Error(
      `人工机位编号${unknownDesignation.id}绑定了不存在的引导线${unknownDesignation.corridorId}。`,
    );
  }
  const nodesById = new Map<string, MutableIntegrationNode>(
    base.nodes.map((node) => [node.id, { id: node.id, coordinate: node.coordinate }]),
  );
  const edges = [...base.edges];
  const segmentNodeIds = new Map<string, string[]>();
  let splitSequence = 0;
  let snappedEndpointCount = 0;
  let maximumSnapDistanceMeters = 0;

  const getOrCreateManualNode = (coordinate: Wgs84Coordinate) => {
    const id = createManualNodeId(base.airportIdent, coordinate);
    if (!nodesById.has(id)) {
      nodesById.set(id, {
        id,
        coordinate: createProjectedCoordinate(coordinate, converter),
      });
    }
    return id;
  };

  const attachEndpoint = (coordinate: Wgs84Coordinate) => {
    const attachment = findNearestAttachment(coordinate, nodesById, edges, converter);
    if (!attachment || attachment.distanceMeters > thresholdMeters) {
      return { nodeId: getOrCreateManualNode(coordinate), coordinate, snapped: false };
    }
    const targetEdge = edges[attachment.edgeIndex];
    const fromNode = nodesById.get(targetEdge.fromNodeId)!;
    const toNode = nodesById.get(targetEdge.toNodeId)!;
    const distanceFrom = distanceBetween(
      fromNode.coordinate,
      createProjectedCoordinate(attachment.coordinate, converter),
    );
    const distanceTo = distanceBetween(
      toNode.coordinate,
      createProjectedCoordinate(attachment.coordinate, converter),
    );
    snappedEndpointCount += 1;
    maximumSnapDistanceMeters = Math.max(
      maximumSnapDistanceMeters,
      attachment.distanceMeters,
    );
    if (distanceFrom <= 1) {
      return {
        nodeId: fromNode.id,
        coordinate: fromNode.coordinate.wgs84,
        snapped: true,
      };
    }
    if (distanceTo <= 1) {
      return {
        nodeId: toNode.id,
        coordinate: toNode.coordinate.wgs84,
        snapped: true,
      };
    }

    const nodeId = getOrCreateManualNode(attachment.coordinate);
    splitSequence += 1;
    const splitNode = nodesById.get(nodeId)!;
    const createSplitEdge = (
      id: string,
      fromNodeId: string,
      toNodeId: string,
    ): CandidateNetworkEdge => {
      const from = nodesById.get(fromNodeId)!.coordinate;
      const to = nodesById.get(toNodeId)!.coordinate;
      return Object.freeze({
        ...targetEdge,
        id,
        fromNodeId,
        toNodeId,
        lengthMeters: distanceBetween(from, to),
      });
    };
    edges.splice(
      attachment.edgeIndex,
      1,
      createSplitEdge(
        `${targetEdge.id}:S${splitSequence}A`,
        targetEdge.fromNodeId,
        splitNode.id,
      ),
      createSplitEdge(
        `${targetEdge.id}:S${splitSequence}B`,
        splitNode.id,
        targetEdge.toNodeId,
      ),
    );
    return { nodeId, coordinate: attachment.coordinate, snapped: true };
  };

  calibration.segments.forEach((segment) => {
    if (segment.kind === "service_road" || segment.coordinates.length < 2) return;
    const nodeIds = segment.coordinates.map((coordinate, index) => {
      const wgs84 = { longitude: coordinate[0], latitude: coordinate[1] };
      if (index === 0 || index === segment.coordinates.length - 1) {
        return attachEndpoint(wgs84).nodeId;
      }
      return getOrCreateManualNode(wgs84);
    });
    segmentNodeIds.set(segment.id, nodeIds);
    const edgeBaseId = segment.id.replace(/^CORRIDOR-/, "").replace(/-1$/, "");
    for (let index = 0; index < nodeIds.length - 1; index += 1) {
      const fromNodeId = nodeIds[index];
      const toNodeId = nodeIds[index + 1];
      if (fromNodeId === toNodeId) continue;
      edges.push(
        Object.freeze({
          id: `${edgeBaseId}-${index + 1}`,
          fromNodeId,
          toNodeId,
          primaryKind: segment.kind,
          kinds: Object.freeze([segment.kind]),
          refs: Object.freeze([segment.id]),
          sourceWayIds: Object.freeze([]),
          lengthMeters: distanceBetween(
            nodesById.get(fromNodeId)!.coordinate,
            nodesById.get(toNodeId)!.coordinate,
          ),
          bidirectional: true,
        }),
      );
    }
  });

  const degrees = new Map<string, number>();
  edges.forEach((edge) => {
    degrees.set(edge.fromNodeId, (degrees.get(edge.fromNodeId) ?? 0) + 1);
    degrees.set(edge.toNodeId, (degrees.get(edge.toNodeId) ?? 0) + 1);
  });
  const nodes = [...nodesById.values()].map(
    (node): CandidateNetworkNode =>
      Object.freeze({
        id: node.id,
        coordinate: node.coordinate,
        degree: degrees.get(node.id) ?? 0,
      }),
  );
  const nodesByFinalId = new Map(nodes.map((node) => [node.id, node]));
  const manualOperationalPoints: CandidateOperationalPoint[] = [];
  calibration.segments.forEach((segment) => {
    if (segment.kind !== "parking_position") return;
    const nodeIds = segmentNodeIds.get(segment.id);
    if (!nodeIds) return;
    const standNodeId = [nodeIds.at(-1), nodeIds[0]].find(
      (nodeId): nodeId is string => Boolean(nodeId && nodesByFinalId.get(nodeId)?.degree === 1),
    );
    if (!standNodeId) return;
    const designation = designationByCorridorId.get(segment.id);
    manualOperationalPoints.push(
      Object.freeze({
        id:
          designation?.id ??
          `${base.airportIdent}-MANUAL-P-${segment.id.replace(/^CORRIDOR-/, "")}`,
        sourceElementId: null,
        kind: "parking_position",
        ref:
          designation?.displayName ??
          (segment.name === segment.id ? null : segment.name),
        mapLabel: designation?.mapLabel ?? null,
        sourceCorridorId: segment.id,
        coordinate: nodesByFinalId.get(standNodeId)!.coordinate,
        networkNodeId: standNodeId,
      }),
    );
  });

  const topology = deriveTopologyReport(nodes, edges);
  const danglingNodeCount = nodes.filter((node) => node.degree === 1).length;
  const manualEdgeCount = edges.filter((edge) => edge.id.includes("-MANUAL-E-")).length;
  const manualReport = Object.freeze({
    corridorIds: Object.freeze(calibration.segments.map((segment) => segment.id)),
    segmentCount: calibration.segments.length,
    aircraftCorridorSegmentCount: calibration.segments.filter(
      (segment) => segment.kind !== "service_road",
    ).length,
    serviceRoadSegmentCount: calibration.segments.filter(
      (segment) => segment.kind === "service_road",
    ).length,
    pointCount: calibration.segments.reduce(
      (total, segment) => total + segment.coordinates.length,
      0,
    ),
    edgeCount: manualEdgeCount,
    parkingPositionCount: manualOperationalPoints.length,
    numberedParkingPositionCount: manualOperationalPoints.filter((point) =>
      Boolean(point.mapLabel),
    ).length,
    snappedEndpointCount,
    maximumSnapDistanceMeters,
    thresholdMeters,
    sourceExportedAt: calibration.exportedAt,
  });
  const warnings = [
    ...base.report.warnings.filter(
      (warning) => !warning.startsWith("第一版仅按OSM共享顶点"),
    ),
    `已将${manualReport.segmentCount}条人工WGS84走廊吸附并编译进候选图；保留MANUAL来源标记，尚未取得运行权威。`,
  ];
  const rawOperationalPoints = [
    ...base.operationalPoints,
    ...manualOperationalPoints,
  ];
  let standClassification: CandidateStandClassificationSummary | undefined;
  let operationalPoints: readonly CandidateOperationalPoint[] =
    rawOperationalPoints;
  if (standClassificationCatalog) {
    const groupByPointRef = new Map<
      string,
      AirportCandidateStandClassificationGroup
    >();
    const groupByPointId = new Map<
      string,
      AirportCandidateStandClassificationGroup
    >();
    standClassificationCatalog.groups.forEach((group) => {
      (group.pointRefs ?? []).forEach((ref) => {
        if (groupByPointRef.has(ref)) {
          throw new Error(`候选机位编号${ref}被重复分类。`);
        }
        groupByPointRef.set(ref, group);
      });
      (group.pointIds ?? []).forEach((id) => {
        if (groupByPointId.has(id)) {
          throw new Error(`候选机位标识${id}被重复分类。`);
        }
        groupByPointId.set(id, group);
      });
    });
    const matchedRefs = new Set<string>();
    const matchedIds = new Set<string>();
    operationalPoints = Object.freeze(
      rawOperationalPoints.map((point): CandidateOperationalPoint => {
        if (point.kind !== "parking_position") return point;
        const idGroup = groupByPointId.get(point.id);
        const refGroup = point.ref ? groupByPointRef.get(point.ref) : undefined;
        const group = idGroup ?? refGroup;
        if (idGroup) matchedIds.add(point.id);
        if (refGroup && point.ref) matchedRefs.add(point.ref);
        return Object.freeze({
          ...point,
          standClassificationGroupId: group?.id ?? null,
          standOperationalRole: group?.role ?? null,
          terminalAffinity: group?.terminalAffinity ?? null,
          standSizeProfile: group?.sizeProfile ?? null,
          standActivationStatus: group
            ? "candidate_active" as const
            : standClassificationCatalog.defaultStatus,
        });
      }),
    );
    const unmatchedRefs = [...groupByPointRef.keys()].filter(
      (ref) => !matchedRefs.has(ref),
    );
    const unmatchedIds = [...groupByPointId.keys()].filter(
      (id) => !matchedIds.has(id),
    );
    if (unmatchedRefs.length > 0 || unmatchedIds.length > 0) {
      throw new Error(
        `候选机位分类表存在未命中的定位点：${[
          ...unmatchedRefs,
          ...unmatchedIds,
        ].join("、")}`,
      );
    }
    const parkingPoints = operationalPoints.filter(
      (point) => point.kind === "parking_position",
    );
    const activePoints = parkingPoints.filter(
      (point) => point.standActivationStatus === "candidate_active",
    );
    const roles = [
      "passenger_gate",
      "remote_passenger",
      "cargo",
      "maintenance",
    ] as const;
    const sizeProfiles = [
      "unclassified",
      "small",
      "medium",
      "medium_large",
      "large",
    ] as const;
    const terminalIds = [
      ...new Set(
        activePoints.flatMap((point) =>
          point.terminalAffinity ? [point.terminalAffinity] : [],
        ),
      ),
    ].sort();
    standClassification = Object.freeze({
      totalParkingPositionCount: parkingPoints.length,
      activeCount: activePoints.length,
      temporarilyAbandonedCount: parkingPoints.length - activePoints.length,
      countsByRole: Object.freeze(
        Object.fromEntries(
          roles.map((role) => [
            role,
            activePoints.filter((point) => point.standOperationalRole === role)
              .length,
          ]),
        ) as Record<(typeof roles)[number], number>,
      ),
      countsByTerminal: Object.freeze(
        Object.fromEntries(
          terminalIds.map((terminalId) => [
            terminalId,
            activePoints.filter(
              (point) => point.terminalAffinity === terminalId,
            ).length,
          ]),
        ),
      ),
      countsBySizeProfile: Object.freeze(
        Object.fromEntries(
          sizeProfiles.map((profile) => [
            profile,
            activePoints.filter((point) => point.standSizeProfile === profile)
              .length,
          ]),
        ) as Record<(typeof sizeProfiles)[number], number>,
      ),
      sourceUpdatedAt: standClassificationCatalog.updatedAt,
    });
    warnings.push(
      `已按用户确认口径分类${standClassification.activeCount}个候选机位，另有${standClassification.temporarilyAbandonedCount}个定位点暂时废弃。`,
    );
  }

  return Object.freeze({
    ...base,
    source: "OpenStreetMap+ManualCalibration" as const,
    compiledAt: new Date().toISOString(),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    operationalPoints,
    serviceRoadNetwork: integrateManualServiceRoads(
      base,
      calibration,
      converter,
      thresholdMeters,
    ),
    manualCalibration: manualReport,
    standClassification,
    report: Object.freeze({
      ...base.report,
      sourceElementCount: base.report.sourceElementCount + calibration.segments.length,
      compiledWayCount: base.report.compiledWayCount + calibration.segments.length,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      connectedComponentCount: topology.components.length,
      largestComponentNodeCount: topology.components[0]?.nodeCount ?? 0,
      danglingNodeCount,
      danglingNodes: Object.freeze({
        runwayEndNodeIds: Object.freeze(topology.runwayEndNodeIds),
        parkingGuideEndNodeIds: Object.freeze(topology.parkingGuideEndNodeIds),
        perimeterOperationalEndNodeIds: Object.freeze(
          topology.perimeterOperationalEndNodeIds,
        ),
        suspectedBreakNodeIds: Object.freeze(topology.suspectedBreakNodeIds),
      }),
      components: Object.freeze(topology.components),
      kinds: Object.freeze(buildKindSummary(base, edges, calibration)),
      warnings: Object.freeze(warnings),
    }),
  });
}
