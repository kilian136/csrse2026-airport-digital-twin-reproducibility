import type {
  AirportSpatialCoordinate,
} from "../airportConfig";
import type { ServiceRoadConnectionDraft } from "./buildServiceRoadConnectionDraft";
import type {
  ServiceRoadTopologyDraft,
  ServiceRoadTopologyEdge,
} from "./auditServiceRoadTopology";

export type ServiceRoadShadowRoute = Readonly<{
  id: string;
  anchorConnectionId: string;
  anchorName: string;
  destinationInterfaceId: string | null;
  componentId: string | null;
  status: "ready_for_validation" | "requires_review" | "unreachable";
  nodeIds: readonly string[];
  edgeIds: readonly string[];
  coordinates: readonly AirportSpatialCoordinate[];
  distanceMeters: number | null;
  sourceAttachmentMeters: number | null;
  destinationAttachmentMeters: number | null;
  reviewRequiredEdgeCount: number;
  usesApprovedGap: boolean;
}>;

export type ServiceRoadRoutingShadowAudit = Readonly<{
  authority: "shadow_only";
  routes: readonly ServiceRoadShadowRoute[];
  report: Readonly<{
    totalAnchorCount: number;
    reachableAnchorCount: number;
    unreachableAnchorCount: number;
    readyForValidationCount: number;
    reviewRequiredCount: number;
    routesUsingApprovedGapCount: number;
    maximumRouteDistanceMeters: number;
  }>;
}>;

export type ServiceRoadShadowPath = Readonly<{
  authority: "shadow_only";
  status: "ready_for_validation" | "requires_review";
  componentId: string;
  nodeIds: readonly string[];
  edgeIds: readonly string[];
  coordinates: readonly Readonly<{ longitude: number; latitude: number }>[];
  distanceMeters: number;
  sourceAttachmentMeters: number;
  destinationAttachmentMeters: number;
  reviewRequiredEdgeCount: number;
  usesApprovedGap: boolean;
}>;

export type ServiceRoadShadowPathOptions = Readonly<{
  /**
   * 仅在影子规划中视为不可通行的边。用于模拟临时封路、车辆冲突或
   * 道路维护；不会修改候选路网，也不会写入正式交通管控状态。
   */
  blockedEdgeIds?: readonly string[];
  /** 将任务起点吸附到已核验的保障道路组，避免邻近道路误吸附。 */
  sourceEdgeIdPrefixes?: readonly string[];
  /** 将任务终点吸附到已核验的保障道路组，避免邻近道路误吸附。 */
  destinationEdgeIdPrefixes?: readonly string[];
}>;

const MAXIMUM_ATTACHMENT_DISTANCE_METERS = 180;

function distanceMeters(
  first: AirportSpatialCoordinate,
  second: AirportSpatialCoordinate,
) {
  return Math.hypot(
    first.local.eastMeters - second.local.eastMeters,
    first.local.northMeters - second.local.northMeters,
  );
}

function wgs84DistanceMeters(
  first: Readonly<{ longitude: number; latitude: number }>,
  second: Readonly<{ longitude: number; latitude: number }>,
) {
  const latitudeRadians = ((first.latitude + second.latitude) / 2) * (Math.PI / 180);
  return Math.hypot(
    (second.longitude - first.longitude) * 111_320 * Math.cos(latitudeRadians),
    (second.latitude - first.latitude) * 111_320,
  );
}

type EdgeAttachment = Readonly<{
  edge: ServiceRoadTopologyEdge;
  ratio: number;
  coordinate: Readonly<{ longitude: number; latitude: number }>;
  distanceMeters: number;
}>;

type AttachmentEndpoint = Readonly<{
  nodeId: string;
  edgeIds: readonly string[];
  roadDistanceMeters: number;
}>;

type EdgeAttachmentRouteCandidate = Readonly<{
  path: Readonly<{
    nodeIds: readonly string[];
    edgeIds: readonly string[];
    distanceMeters: number;
  }>;
  edgeIds: readonly string[];
  sourceEndpoint: AttachmentEndpoint | null;
  destinationEndpoint: AttachmentEndpoint | null;
  totalDistance: number;
}>;

function nearestEdgeAttachment(
  topology: ServiceRoadTopologyDraft,
  componentNodeIds: ReadonlySet<string>,
  coordinate: Readonly<{ longitude: number; latitude: number }>,
  edgeIdPrefixes: readonly string[] = [],
) {
  const nodeById = new Map(topology.nodes.map((node) => [node.id, node]));
  return topology.edges.reduce<EdgeAttachment | null>((best, edge) => {
    if (
      !componentNodeIds.has(edge.fromNodeId) ||
      !componentNodeIds.has(edge.toNodeId) ||
      (edgeIdPrefixes.length > 0 &&
        !edgeIdPrefixes.some((prefix) => edge.id.startsWith(prefix)))
    ) return best;
    const from = nodeById.get(edge.fromNodeId)?.coordinate.wgs84;
    const to = nodeById.get(edge.toNodeId)?.coordinate.wgs84;
    if (!from || !to) return best;
    const latitudeRadians =
      ((from.latitude + to.latitude + coordinate.latitude) / 3) *
      (Math.PI / 180);
    const longitudeScale = 111_320 * Math.cos(latitudeRadians);
    const latitudeScale = 111_320;
    const dx = (to.longitude - from.longitude) * longitudeScale;
    const dy = (to.latitude - from.latitude) * latitudeScale;
    const px = (coordinate.longitude - from.longitude) * longitudeScale;
    const py = (coordinate.latitude - from.latitude) * latitudeScale;
    const denominator = dx * dx + dy * dy;
    const ratio = denominator === 0
      ? 0
      : Math.max(0, Math.min(1, (px * dx + py * dy) / denominator));
    const projected = Object.freeze({
      longitude: from.longitude + ratio * (to.longitude - from.longitude),
      latitude: from.latitude + ratio * (to.latitude - from.latitude),
    });
    const distance = wgs84DistanceMeters(coordinate, projected);
    if (best && best.distanceMeters <= distance) return best;
    return Object.freeze({ edge, ratio, coordinate: projected, distanceMeters: distance });
  }, null);
}

function attachmentEndpoints(
  attachment: EdgeAttachment,
  role: "source" | "destination",
  blockedEdgeIds: ReadonlySet<string>,
) {
  const { edge, ratio } = attachment;
  const epsilon = 1e-6;
  const canTraverseEdge = !blockedEdgeIds.has(edge.id);
  const endpoints: AttachmentEndpoint[] = [];
  const add = (nodeId: string, fraction: number) => {
    const roadDistanceMeters = Math.max(0, fraction * edge.lengthMeters);
    if (roadDistanceMeters > epsilon && !canTraverseEdge) return;
    endpoints.push(Object.freeze({
      nodeId,
      edgeIds: roadDistanceMeters > epsilon ? Object.freeze([edge.id]) : Object.freeze([]),
      roadDistanceMeters,
    }));
  };
  if (role === "source") {
    if (!edge.oneWay || ratio <= epsilon) add(edge.fromNodeId, ratio);
    add(edge.toNodeId, 1 - ratio);
  } else {
    add(edge.fromNodeId, ratio);
    if (!edge.oneWay || ratio >= 1 - epsilon) add(edge.toNodeId, 1 - ratio);
  }
  return endpoints;
}

type QueueItem = Readonly<{ nodeId: string; cost: number }>;

class MinQueue {
  private readonly items: QueueItem[] = [];

  push(item: QueueItem) {
    this.items.push(item);
    this.items.sort((left, right) => left.cost - right.cost);
  }

  pop() {
    return this.items.shift() ?? null;
  }

  get size() {
    return this.items.length;
  }
}

function shortestPath(
  topology: ServiceRoadTopologyDraft,
  componentNodeIds: ReadonlySet<string>,
  startNodeId: string,
  destinationNodeId: string,
  blockedEdgeIds: ReadonlySet<string> = new Set(),
) {
  const adjacency = new Map<
    string,
    Array<{ nodeId: string; edge: ServiceRoadTopologyEdge }>
  >([...componentNodeIds].map((nodeId) => [nodeId, []]));
  topology.edges.forEach((edge) => {
    if (
      !componentNodeIds.has(edge.fromNodeId) ||
      !componentNodeIds.has(edge.toNodeId) ||
      blockedEdgeIds.has(edge.id)
    ) {
      return;
    }
    adjacency.get(edge.fromNodeId)?.push({ nodeId: edge.toNodeId, edge });
    if (!edge.oneWay) {
      adjacency.get(edge.toNodeId)?.push({ nodeId: edge.fromNodeId, edge });
    }
  });
  const costs = new Map([[startNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edgeId: string }>();
  const queue = new MinQueue();
  queue.push({ nodeId: startNodeId, cost: 0 });
  while (queue.size > 0) {
    const current = queue.pop();
    if (!current) break;
    if (current.cost !== costs.get(current.nodeId)) continue;
    if (current.nodeId === destinationNodeId) break;
    (adjacency.get(current.nodeId) ?? []).forEach((step) => {
      const nextCost = current.cost + step.edge.lengthMeters;
      if (nextCost >= (costs.get(step.nodeId) ?? Number.POSITIVE_INFINITY)) return;
      costs.set(step.nodeId, nextCost);
      previous.set(step.nodeId, { nodeId: current.nodeId, edgeId: step.edge.id });
      queue.push({ nodeId: step.nodeId, cost: nextCost });
    });
  }
  if (!costs.has(destinationNodeId)) return null;
  const nodeIds = [destinationNodeId];
  const edgeIds: string[] = [];
  let currentNodeId = destinationNodeId;
  while (currentNodeId !== startNodeId) {
    const step = previous.get(currentNodeId);
    if (!step) return null;
    nodeIds.unshift(step.nodeId);
    edgeIds.unshift(step.edgeId);
    currentNodeId = step.nodeId;
  }
  return { nodeIds, edgeIds, distanceMeters: costs.get(destinationNodeId) ?? 0 };
}

function nearestNode(
  nodeById: ReadonlyMap<string, ServiceRoadTopologyDraft["nodes"][number]>,
  componentNodeIds: readonly string[],
  coordinate: AirportSpatialCoordinate,
) {
  return componentNodeIds.reduce<{
    nodeId: string;
    distanceMeters: number;
  } | null>((best, nodeId) => {
    const node = nodeById.get(nodeId);
    if (!node) return best;
    const distance = distanceMeters(coordinate, node.coordinate);
    return !best || distance < best.distanceMeters
      ? { nodeId, distanceMeters: distance }
      : best;
  }, null);
}

/** 对单个实际车辆任务计算新版保障道路影子路线。 */
export function planServiceRoadShadowPath(
  topology: ServiceRoadTopologyDraft,
  source: Readonly<{ longitude: number; latitude: number }>,
  destination: Readonly<{ longitude: number; latitude: number }>,
  options: ServiceRoadShadowPathOptions = {},
): ServiceRoadShadowPath | null {
  const nodeById = new Map(topology.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(topology.edges.map((edge) => [edge.id, edge]));
  const blockedEdgeIds = new Set(options.blockedEdgeIds ?? []);
  const candidates = topology.components.flatMap((component) => {
    const componentNodeIds = new Set(component.nodeIds);
    const sourceAttachment = nearestEdgeAttachment(
      topology,
      componentNodeIds,
      source,
      options.sourceEdgeIdPrefixes,
    );
    const destinationAttachment = nearestEdgeAttachment(
      topology,
      componentNodeIds,
      destination,
      options.destinationEdgeIdPrefixes,
    );
    if (
      !sourceAttachment ||
      !destinationAttachment ||
      sourceAttachment.distanceMeters > MAXIMUM_ATTACHMENT_DISTANCE_METERS ||
      destinationAttachment.distanceMeters > MAXIMUM_ATTACHMENT_DISTANCE_METERS
    ) {
      return [];
    }
    const endpointCandidates: EdgeAttachmentRouteCandidate[] = attachmentEndpoints(
      sourceAttachment,
      "source",
      blockedEdgeIds,
    ).flatMap((sourceEndpoint) =>
      attachmentEndpoints(
        destinationAttachment,
        "destination",
        blockedEdgeIds,
      ).flatMap((destinationEndpoint) => {
        const path = shortestPath(
          topology,
          componentNodeIds,
          sourceEndpoint.nodeId,
          destinationEndpoint.nodeId,
          blockedEdgeIds,
        );
        if (!path) return [];
        const edgeIds = Object.freeze([
          ...sourceEndpoint.edgeIds,
          ...path.edgeIds,
          ...destinationEndpoint.edgeIds,
        ]);
        return [{
          path,
          edgeIds,
          sourceEndpoint,
          destinationEndpoint,
          totalDistance:
            sourceAttachment.distanceMeters +
            sourceEndpoint.roadDistanceMeters +
            path.distanceMeters +
            destinationEndpoint.roadDistanceMeters +
            destinationAttachment.distanceMeters,
        }];
      }),
    );
    if (
      sourceAttachment.edge.id === destinationAttachment.edge.id &&
      !blockedEdgeIds.has(sourceAttachment.edge.id) &&
      (!sourceAttachment.edge.oneWay ||
        sourceAttachment.ratio <= destinationAttachment.ratio)
    ) {
      endpointCandidates.push({
        path: { nodeIds: [], edgeIds: [], distanceMeters: 0 },
        edgeIds: Object.freeze([sourceAttachment.edge.id]),
        sourceEndpoint: null,
        destinationEndpoint: null,
        totalDistance:
          sourceAttachment.distanceMeters +
          Math.abs(destinationAttachment.ratio - sourceAttachment.ratio) *
            sourceAttachment.edge.lengthMeters +
          destinationAttachment.distanceMeters,
      });
    }
    endpointCandidates.sort((left, right) => left.totalDistance - right.totalDistance);
    const selected = endpointCandidates[0];
    if (!selected) return [];
    const edgeIds = Object.freeze(selected.edgeIds);
    const reviewRequiredEdgeCount = [...new Set(edgeIds)].filter(
      (edgeId) => edgeById.get(edgeId)?.reviewStatus === "requires_review",
    ).length;
    const projectionNodeId = (role: "SOURCE" | "DESTINATION", attachment: EdgeAttachment) =>
      `SERVICE-PROJECTION:${role}:${attachment.edge.id}:${attachment.ratio.toFixed(8)}`;
    let nodeIds: readonly string[];
    let nodeCoordinates: readonly Readonly<{ longitude: number; latitude: number }>[];
    if (!selected.sourceEndpoint || !selected.destinationEndpoint) {
      nodeIds = Object.freeze([
        projectionNodeId("SOURCE", sourceAttachment),
        projectionNodeId("DESTINATION", destinationAttachment),
      ]);
      nodeCoordinates = Object.freeze([
        sourceAttachment.coordinate,
        destinationAttachment.coordinate,
      ]);
    } else {
      const mutableNodeIds = [...selected.path.nodeIds];
      const mutableNodeCoordinates = selected.path.nodeIds.map((nodeId) =>
        Object.freeze({ ...nodeById.get(nodeId)!.coordinate.wgs84 }),
      );
      if (selected.sourceEndpoint.roadDistanceMeters > 1e-6) {
        mutableNodeIds.unshift(projectionNodeId("SOURCE", sourceAttachment));
        mutableNodeCoordinates.unshift(sourceAttachment.coordinate);
      }
      if (selected.destinationEndpoint.roadDistanceMeters > 1e-6) {
        mutableNodeIds.push(projectionNodeId("DESTINATION", destinationAttachment));
        mutableNodeCoordinates.push(destinationAttachment.coordinate);
      }
      nodeIds = Object.freeze(mutableNodeIds);
      nodeCoordinates = Object.freeze(mutableNodeCoordinates);
    }
    return [{
      component,
      sourceAttachment,
      destinationAttachment,
      nodeIds,
      nodeCoordinates,
      edgeIds,
      reviewRequiredEdgeCount,
      totalDistance: selected.totalDistance,
    }];
  });
  candidates.sort((left, right) => left.totalDistance - right.totalDistance);
  const selected = candidates[0];
  if (!selected) return null;
  return Object.freeze({
    authority: "shadow_only" as const,
    // 当前项目口径：所有进入可显示拓扑的保障道路均已确认可运行。
    // reviewRequiredEdgeCount 仅保留为 OSM 来源标签统计，不再阻断正式准入。
    status: "ready_for_validation" as const,
    componentId: selected.component.id,
    nodeIds: selected.nodeIds,
    edgeIds: selected.edgeIds,
    coordinates: Object.freeze([
      Object.freeze({ ...source }),
      ...selected.nodeCoordinates,
      Object.freeze({ ...destination }),
    ]),
    distanceMeters: selected.totalDistance,
    sourceAttachmentMeters: selected.sourceAttachment.distanceMeters,
    destinationAttachmentMeters: selected.destinationAttachment.distanceMeters,
    reviewRequiredEdgeCount: selected.reviewRequiredEdgeCount,
    usesApprovedGap: selected.edgeIds.some((edgeId) =>
      edgeId.startsWith("APPROVED-SERVICE-GAP-"),
    ),
  });
}

/**
 * 用已核校保障道路进行只读影子寻路。结果只用于比较和核校，
 * 不会替换当前车辆任务或写入交通协调器。
 */
export function buildServiceRoadRoutingShadowAudit(
  topology: ServiceRoadTopologyDraft,
  connections: ServiceRoadConnectionDraft,
): ServiceRoadRoutingShadowAudit {
  const nodeById = new Map(topology.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(topology.edges.map((edge) => [edge.id, edge]));
  const usableAnchors = connections.anchorConnections.filter(
    (connection) =>
      connection.roadCoordinate &&
      (connection.status === "connected" || connection.status === "review_required"),
  );

  const routes = usableAnchors.map((anchor): ServiceRoadShadowRoute => {
    const candidates = connections.apronInterfaces.flatMap((apronInterface) =>
      topology.components.flatMap((component) => {
        const sourceAttachment = nearestNode(
          nodeById,
          component.nodeIds,
          anchor.roadCoordinate!,
        );
        const destinationAttachment = nearestNode(
          nodeById,
          component.nodeIds,
          apronInterface.roadCoordinate,
        );
        if (
          !sourceAttachment ||
          !destinationAttachment ||
          sourceAttachment.distanceMeters > MAXIMUM_ATTACHMENT_DISTANCE_METERS ||
          destinationAttachment.distanceMeters > MAXIMUM_ATTACHMENT_DISTANCE_METERS
        ) {
          return [];
        }
        const componentNodeIds = new Set(component.nodeIds);
        const path = shortestPath(
          topology,
          componentNodeIds,
          sourceAttachment.nodeId,
          destinationAttachment.nodeId,
        );
        if (!path) return [];
        const reviewRequiredEdgeCount = path.edgeIds.filter(
          (edgeId) => edgeById.get(edgeId)?.reviewStatus === "requires_review",
        ).length;
        const totalDistance =
          sourceAttachment.distanceMeters +
          path.distanceMeters +
          destinationAttachment.distanceMeters;
        return [{
          apronInterface,
          component,
          sourceAttachment,
          destinationAttachment,
          path,
          reviewRequiredEdgeCount,
          totalDistance,
        }];
      }),
    );
    candidates.sort((left, right) => left.totalDistance - right.totalDistance);
    const selected = candidates[0];
    if (!selected) {
      return Object.freeze({
        id: `SERVICE-SHADOW:${anchor.id}`,
        anchorConnectionId: anchor.id,
        anchorName: anchor.name,
        destinationInterfaceId: null,
        componentId: null,
        status: "unreachable" as const,
        nodeIds: Object.freeze([]),
        edgeIds: Object.freeze([]),
        coordinates: Object.freeze([]),
        distanceMeters: null,
        sourceAttachmentMeters: null,
        destinationAttachmentMeters: null,
        reviewRequiredEdgeCount: 0,
        usesApprovedGap: false,
      });
    }
    const pathCoordinates = selected.path.nodeIds
      .map((nodeId) => nodeById.get(nodeId)?.coordinate)
      .filter((coordinate) => coordinate !== undefined);
    const usesApprovedGap = selected.path.edgeIds.some((edgeId) =>
      edgeId.startsWith("APPROVED-SERVICE-GAP-"),
    );
    return Object.freeze({
      id: `SERVICE-SHADOW:${anchor.id}`,
      anchorConnectionId: anchor.id,
      anchorName: anchor.name,
      destinationInterfaceId: selected.apronInterface.id,
      componentId: selected.component.id,
      status: "ready_for_validation" as const,
      nodeIds: Object.freeze(selected.path.nodeIds),
      edgeIds: Object.freeze(selected.path.edgeIds),
      coordinates: Object.freeze([
        anchor.sourceCoordinate,
        ...pathCoordinates,
        selected.apronInterface.aircraftNetworkCoordinate,
      ]),
      distanceMeters: selected.totalDistance,
      sourceAttachmentMeters: selected.sourceAttachment.distanceMeters,
      destinationAttachmentMeters: selected.destinationAttachment.distanceMeters,
      reviewRequiredEdgeCount: selected.reviewRequiredEdgeCount,
      usesApprovedGap,
    });
  });
  const reachable = routes.filter((route) => route.status !== "unreachable");
  return Object.freeze({
    authority: "shadow_only" as const,
    routes: Object.freeze(routes),
    report: Object.freeze({
      totalAnchorCount: routes.length,
      reachableAnchorCount: reachable.length,
      unreachableAnchorCount: routes.length - reachable.length,
      readyForValidationCount: routes.filter(
        (route) => route.status === "ready_for_validation",
      ).length,
      reviewRequiredCount: routes.filter(
        (route) => route.status === "requires_review",
      ).length,
      routesUsingApprovedGapCount: routes.filter((route) => route.usesApprovedGap).length,
      maximumRouteDistanceMeters: Math.max(
        0,
        ...reachable.map((route) => route.distanceMeters ?? 0),
      ),
    }),
  });
}
