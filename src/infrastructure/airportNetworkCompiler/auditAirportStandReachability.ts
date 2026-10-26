import type { ProjectedAirportFeature } from "../airportConfig";
import type { OperationalAirportNetworkDraft } from "./buildOperationalAirportNetworkDraft";
import type { OperationalSurfaceNetworkReadiness } from "./assessOperationalSurfaceNetwork";

export type AirportStandReachabilityKind =
  | "gate"
  | "remote_stand"
  | "cargo_stand"
  | "maintenance_stand";

export type AirportStandReachabilityStatus =
  | "reachable"
  | "connector_too_far"
  | "network_unreachable"
  | "no_eligible_edge";

export type AirportStandReachabilityItem = Readonly<{
  sourceId: string;
  name: string;
  kind: AirportStandReachabilityKind;
  status: AirportStandReachabilityStatus;
  nearestEdgeId: string | null;
  attachmentNodeId: string | null;
  connectorDistanceMeters: number | null;
  maximumConnectorDistanceMeters: number;
  sourceCoordinate: readonly [longitude: number, latitude: number];
  attachmentCoordinate: readonly [longitude: number, latitude: number] | null;
}>;

type KindCounts = Readonly<{
  total: number;
  reachable: number;
  connectorTooFar: number;
  networkUnreachable: number;
  noEligibleEdge: number;
}>;

export type AirportStandReachabilityAudit = Readonly<{
  airportIdent: string;
  authority: "validation_draft";
  mayDriveSimulation: false;
  items: readonly AirportStandReachabilityItem[];
  report: Readonly<{
    totalStandCount: number;
    reachableStandCount: number;
    connectorTooFarCount: number;
    networkUnreachableCount: number;
    noEligibleEdgeCount: number;
    coverage: number;
    averageConnectorDistanceMeters: number;
    maximumConnectorDistanceMeters: number;
    countsByKind: Readonly<Record<AirportStandReachabilityKind, KindCounts>>;
  }>;
}>;

type LocalPoint = Readonly<{ eastMeters: number; northMeters: number }>;

const DEFAULT_MAXIMUM_CONNECTOR_DISTANCE_METERS = 250;

function classifyFeature(
  feature: ProjectedAirportFeature,
): AirportStandReachabilityKind | null {
  if (feature.properties.kind === "gate") return "gate";
  if (feature.properties.kind === "remote_stand") return "remote_stand";
  if (feature.properties.kind === "cargo_stand") return "cargo_stand";
  if (feature.properties.kind === "stand") return "maintenance_stand";
  return null;
}

function projectPointToSegment(
  point: LocalPoint,
  start: LocalPoint,
  end: LocalPoint,
): Readonly<{ distanceMeters: number; ratio: number }> {
  const dx = end.eastMeters - start.eastMeters;
  const dy = end.northMeters - start.northMeters;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return {
      distanceMeters: Math.hypot(
        point.eastMeters - start.eastMeters,
        point.northMeters - start.northMeters,
      ),
      ratio: 0,
    };
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.eastMeters - start.eastMeters) * dx +
        (point.northMeters - start.northMeters) * dy) /
        lengthSquared,
    ),
  );
  return {
    distanceMeters: Math.hypot(
      point.eastMeters - (start.eastMeters + t * dx),
      point.northMeters - (start.northMeters + t * dy),
    ),
    ratio: t,
  };
}

function buildNodesThatCanReachHoldingPoints(
  readiness: OperationalSurfaceNetworkReadiness,
  operationalDraft: OperationalAirportNetworkDraft,
) {
  const eligibleNodeIds = new Set(readiness.nodes.map((node) => node.id));
  const reverseAdjacency = new Map<string, string[]>();
  readiness.nodes.forEach((node) => reverseAdjacency.set(node.id, []));
  readiness.edges
    .filter((edge) => !edge.kinds.includes("runway"))
    .forEach((edge) => {
      reverseAdjacency.get(edge.toNodeId)?.push(edge.fromNodeId);
      if (edge.bidirectional) {
        reverseAdjacency.get(edge.fromNodeId)?.push(edge.toNodeId);
      }
    });

  const queue = operationalDraft.anchors
    .filter(
      (anchor) =>
        anchor.kind === "holding_point" &&
        anchor.connectionStatus === "connected" &&
        anchor.connectedNodeId &&
        eligibleNodeIds.has(anchor.connectedNodeId),
    )
    .map((anchor) => anchor.connectedNodeId!);
  const reachable = new Set(queue);
  for (let index = 0; index < queue.length; index += 1) {
    const nodeId = queue[index];
    (reverseAdjacency.get(nodeId) ?? []).forEach((previousNodeId) => {
      if (reachable.has(previousNodeId)) return;
      reachable.add(previousNodeId);
      queue.push(previousNodeId);
    });
  }
  return reachable;
}

function emptyKindCounts(): Record<AirportStandReachabilityKind, {
  total: number;
  reachable: number;
  connectorTooFar: number;
  networkUnreachable: number;
  noEligibleEdge: number;
}> {
  return {
    gate: { total: 0, reachable: 0, connectorTooFar: 0, networkUnreachable: 0, noEligibleEdge: 0 },
    remote_stand: { total: 0, reachable: 0, connectorTooFar: 0, networkUnreachable: 0, noEligibleEdge: 0 },
    cargo_stand: { total: 0, reachable: 0, connectorTooFar: 0, networkUnreachable: 0, noEligibleEdge: 0 },
    maintenance_stand: { total: 0, reachable: 0, connectorTooFar: 0, networkUnreachable: 0, noEligibleEdge: 0 },
  };
}

/**
 * 只读检查人工机位到可信飞机路网以及跑道等待点的可达性。
 * 审计不生成正式连接、不修改路网，也不得直接驱动仿真。
 */
export function auditAirportStandReachability({
  readiness,
  operationalDraft,
  configurationFeatures,
  standGuidanceBindings = {},
  maximumConnectorDistanceMeters = DEFAULT_MAXIMUM_CONNECTOR_DISTANCE_METERS,
}: Readonly<{
  readiness: OperationalSurfaceNetworkReadiness;
  operationalDraft: OperationalAirportNetworkDraft;
  configurationFeatures: readonly ProjectedAirportFeature[];
  /** 人工确认的机位专属引导线ref；绑定后不允许退回全局最近路段。 */
  standGuidanceBindings?: Readonly<Partial<Record<string, readonly string[]>>>;
  maximumConnectorDistanceMeters?: number;
}>): AirportStandReachabilityAudit {
  if (readiness.airportIdent !== operationalDraft.airportIdent) {
    throw new Error("机位可达性审计的路网与运行锚点不属于同一机场。");
  }
  const nodeById = new Map(readiness.nodes.map((node) => [node.id, node]));
  const safeEdges = readiness.edges.filter(
    (edge) =>
      !edge.kinds.includes("runway") &&
      nodeById.has(edge.fromNodeId) &&
      nodeById.has(edge.toNodeId),
  );
  const nodesThatCanReachHoldingPoints = buildNodesThatCanReachHoldingPoints(
    readiness,
    operationalDraft,
  );
  const anchorBySourceId = new Map(
    operationalDraft.anchors.map((anchor) => [anchor.sourceId, anchor]),
  );

  const items = configurationFeatures.flatMap((feature): AirportStandReachabilityItem[] => {
    const kind = classifyFeature(feature);
    if (
      !kind ||
      feature.geometry.type !== "Point" ||
      feature.properties.airportIdent !== readiness.airportIdent
    ) {
      return [];
    }
    const operationalAnchor = anchorBySourceId.get(feature.properties.id);
    const point =
      operationalAnchor?.position.local ?? feature.geometry.coordinates.local;
    const sourceWgs84 =
      operationalAnchor?.position.wgs84 ?? feature.geometry.coordinates.wgs84;
    let nearest: Readonly<{
      edgeId: string;
      distanceMeters: number;
      candidateNodeIds: readonly string[];
      attachmentCoordinate: readonly [number, number];
    }> | null = null;
    const boundGuidanceRefs = standGuidanceBindings[feature.properties.id] ?? [];
    const eligibleEdges = boundGuidanceRefs.length > 0
      ? safeEdges.filter(
          (edge) =>
            edge.kinds.includes("parking_position") &&
            edge.refs.some((ref) => boundGuidanceRefs.includes(ref)),
        )
      : safeEdges;
    for (const edge of eligibleEdges) {
      const start = nodeById.get(edge.fromNodeId);
      const end = nodeById.get(edge.toNodeId);
      if (!start || !end) continue;
      const projection = projectPointToSegment(
        point,
        start.coordinate.local,
        end.coordinate.local,
      );
      const distanceMeters = projection.distanceMeters;
      if (nearest && distanceMeters >= nearest.distanceMeters) continue;
      nearest = {
        edgeId: edge.id,
        distanceMeters,
        candidateNodeIds: edge.bidirectional
          ? [edge.fromNodeId, edge.toNodeId]
          : [edge.toNodeId],
        attachmentCoordinate: [
          start.coordinate.wgs84.longitude +
            projection.ratio *
              (end.coordinate.wgs84.longitude - start.coordinate.wgs84.longitude),
          start.coordinate.wgs84.latitude +
            projection.ratio *
              (end.coordinate.wgs84.latitude - start.coordinate.wgs84.latitude),
        ],
      };
    }

    if (!nearest) {
      return [{
        sourceId: feature.properties.id,
        name: feature.properties.name,
        kind,
        status: "no_eligible_edge",
        nearestEdgeId: null,
        attachmentNodeId: null,
        connectorDistanceMeters: null,
        maximumConnectorDistanceMeters,
        sourceCoordinate: [
          sourceWgs84.longitude,
          sourceWgs84.latitude,
        ],
        attachmentCoordinate: null,
      }];
    }
    const attachmentNodeId = nearest.candidateNodeIds.find((nodeId) =>
      nodesThatCanReachHoldingPoints.has(nodeId),
    ) ?? nearest.candidateNodeIds[0] ?? null;
    const status: AirportStandReachabilityStatus =
      nearest.distanceMeters > maximumConnectorDistanceMeters
        ? "connector_too_far"
        : attachmentNodeId && nodesThatCanReachHoldingPoints.has(attachmentNodeId)
          ? "reachable"
          : "network_unreachable";
    return [{
      sourceId: feature.properties.id,
      name: feature.properties.name,
      kind,
      status,
      nearestEdgeId: nearest.edgeId,
      attachmentNodeId,
      connectorDistanceMeters: nearest.distanceMeters,
      maximumConnectorDistanceMeters,
      sourceCoordinate: [
        sourceWgs84.longitude,
        sourceWgs84.latitude,
      ],
      attachmentCoordinate: nearest.attachmentCoordinate,
    }];
  });

  const countsByKind = emptyKindCounts();
  items.forEach((item) => {
    const counts = countsByKind[item.kind];
    counts.total += 1;
    if (item.status === "reachable") counts.reachable += 1;
    if (item.status === "connector_too_far") counts.connectorTooFar += 1;
    if (item.status === "network_unreachable") counts.networkUnreachable += 1;
    if (item.status === "no_eligible_edge") counts.noEligibleEdge += 1;
  });
  const reachableStandCount = items.filter((item) => item.status === "reachable").length;
  const observedDistances = items
    .map((item) => item.connectorDistanceMeters)
    .filter((distance): distance is number => distance !== null);

  return Object.freeze({
    airportIdent: readiness.airportIdent,
    authority: "validation_draft" as const,
    mayDriveSimulation: false as const,
    items: Object.freeze(items),
    report: Object.freeze({
      totalStandCount: items.length,
      reachableStandCount,
      connectorTooFarCount: items.filter((item) => item.status === "connector_too_far").length,
      networkUnreachableCount: items.filter((item) => item.status === "network_unreachable").length,
      noEligibleEdgeCount: items.filter((item) => item.status === "no_eligible_edge").length,
      coverage: items.length > 0 ? reachableStandCount / items.length : 0,
      averageConnectorDistanceMeters:
        observedDistances.length > 0
          ? observedDistances.reduce((sum, distance) => sum + distance, 0) /
            observedDistances.length
          : 0,
      maximumConnectorDistanceMeters: Math.max(0, ...observedDistances),
      countsByKind: Object.freeze(countsByKind),
    }),
  });
}
