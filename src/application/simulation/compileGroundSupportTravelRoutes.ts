import type { AirportState } from "../../domain/state";
import type { ServiceRoadTopologyDraft } from "../../infrastructure/airportNetworkCompiler";
import type { SimulationGroundSupportTravelRouteInput } from "./simulationContract";
import type { SimulationGroundSupportRoutePoint } from "./simulationContract";

type GraphStep = Readonly<{ nodeId: string; distanceMeters: number }>;
type QueueItem = Readonly<{ nodeId: string; distanceMeters: number }>;
type NodeAttachment = Readonly<{ nodeId: string; distanceMeters: number }>;
type RoutedDistance = Readonly<{
  distanceMeters: number;
  sourceAttachmentMeters: number;
  nodeIds: readonly string[];
}>;

const BASE_ATTACHMENT_TOLERANCE_METERS = 12;
const MAXIMUM_BASE_ATTACHMENT_DISTANCE_METERS = 180;

class MinHeap {
  private readonly values: QueueItem[] = [];

  push(item: QueueItem) {
    this.values.push(item);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].distanceMeters <= item.distanceMeters) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = item;
  }

  pop() {
    const first = this.values[0];
    const last = this.values.pop();
    if (!first || !last || this.values.length === 0) return first ?? null;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const child =
        right < this.values.length &&
        this.values[right].distanceMeters < this.values[left].distanceMeters
          ? right
          : left;
      if (this.values[child].distanceMeters >= last.distanceMeters) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = last;
    return first;
  }

  get size() {
    return this.values.length;
  }
}

function directDistance(
  first: Readonly<{ eastMeters: number; northMeters: number }>,
  second: Readonly<{ eastMeters: number; northMeters: number }>,
) {
  return Math.hypot(
    first.eastMeters - second.eastMeters,
    first.northMeters - second.northMeters,
  );
}

function nearestReachableNode(
  topology: ServiceRoadTopologyDraft,
  position: Readonly<{ eastMeters: number; northMeters: number }>,
  routes: ReadonlyMap<string, RoutedDistance>,
) {
  return topology.nodes.reduce<NodeAttachment | null>((best, node) => {
    if (!routes.has(node.id)) return best;
    const distanceMeters = directDistance(position, node.coordinate.local);
    return !best || distanceMeters < best.distanceMeters
      ? { nodeId: node.id, distanceMeters }
      : best;
  }, null);
}

function nearbyBaseAttachments(
  topology: ServiceRoadTopologyDraft,
  position: Readonly<{ eastMeters: number; northMeters: number }>,
) {
  const ranked = topology.nodes
    .map((node): NodeAttachment => ({
      nodeId: node.id,
      distanceMeters: directDistance(position, node.coordinate.local),
    }))
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
  const nearest = ranked[0];
  if (!nearest) return [];
  const maximumDistance = nearest.distanceMeters <= MAXIMUM_BASE_ATTACHMENT_DISTANCE_METERS
    ? Math.min(
        MAXIMUM_BASE_ATTACHMENT_DISTANCE_METERS,
        nearest.distanceMeters + BASE_ATTACHMENT_TOLERANCE_METERS,
      )
    : nearest.distanceMeters;
  return ranked.filter((candidate) => candidate.distanceMeters <= maximumDistance);
}

function shortestDistancesFromAttachments(
  adjacency: ReadonlyMap<string, readonly GraphStep[]>,
  attachments: readonly NodeAttachment[],
) {
  const distances = new Map<string, RoutedDistance>();
  const queue = new MinHeap();
  attachments.forEach((attachment) => {
    const existing = distances.get(attachment.nodeId);
    if (existing && existing.distanceMeters <= attachment.distanceMeters) return;
    distances.set(attachment.nodeId, {
      distanceMeters: attachment.distanceMeters,
      sourceAttachmentMeters: attachment.distanceMeters,
      nodeIds: Object.freeze([attachment.nodeId]),
    });
    queue.push({
      nodeId: attachment.nodeId,
      distanceMeters: attachment.distanceMeters,
    });
  });
  while (queue.size > 0) {
    const current = queue.pop();
    const currentRoute = current ? distances.get(current.nodeId) : null;
    if (!current || !currentRoute || current.distanceMeters !== currentRoute.distanceMeters) continue;
    (adjacency.get(current.nodeId) ?? []).forEach((step) => {
      const nextDistance = current.distanceMeters + step.distanceMeters;
      if (nextDistance >= (distances.get(step.nodeId)?.distanceMeters ?? Number.POSITIVE_INFINITY)) return;
      distances.set(step.nodeId, {
        distanceMeters: nextDistance,
        sourceAttachmentMeters: currentRoute.sourceAttachmentMeters,
        nodeIds: Object.freeze([...currentRoute.nodeIds, step.nodeId]),
      });
      queue.push({ nodeId: step.nodeId, distanceMeters: nextDistance });
    });
  }
  return distances;
}

function routePointFromPosition(
  position: Readonly<{
    wgs84: Readonly<{ longitude: number; latitude: number }>;
    local: Readonly<{ eastMeters: number; northMeters: number }>;
  }>,
  nodeId: string | null,
): SimulationGroundSupportRoutePoint {
  return Object.freeze({
    nodeId,
    longitude: position.wgs84.longitude,
    latitude: position.wgs84.latitude,
    eastMeters: position.local.eastMeters,
    northMeters: position.local.northMeters,
  });
}

function compilePath(
  topology: ServiceRoadTopologyDraft,
  startPosition: Parameters<typeof routePointFromPosition>[0],
  nodeIds: readonly string[],
  endPosition: Parameters<typeof routePointFromPosition>[0],
) {
  const nodesById = new Map(topology.nodes.map((node) => [node.id, node]));
  const points = [
    routePointFromPosition(startPosition, null),
    ...nodeIds.flatMap((nodeId) => {
      const node = nodesById.get(nodeId);
      return node ? [routePointFromPosition(node.coordinate, node.id)] : [];
    }),
    routePointFromPosition(endPosition, null),
  ];
  return Object.freeze(points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return (
      point.longitude !== previous.longitude ||
      point.latitude !== previous.latitude ||
      point.eastMeters !== previous.eastMeters ||
      point.northMeters !== previous.northMeters
    );
  }));
}

function buildAdjacency(topology: ServiceRoadTopologyDraft, reverse: boolean) {
  const adjacency = new Map<string, GraphStep[]>(
    topology.nodes.map((node) => [node.id, []]),
  );
  topology.edges.forEach((edge) => {
    const forwardFrom = reverse ? edge.toNodeId : edge.fromNodeId;
    const forwardTo = reverse ? edge.fromNodeId : edge.toNodeId;
    adjacency.get(forwardFrom)?.push({
      nodeId: forwardTo,
      distanceMeters: edge.lengthMeters,
    });
    if (!edge.oneWay) {
      adjacency.get(forwardTo)?.push({
        nodeId: forwardFrom,
        distanceMeters: edge.lengthMeters,
      });
    }
  });
  return adjacency;
}

/**
 * 将机场已核校保障道路压缩为“基地—机位”最短路矩阵。
 * 起终点不在道路上时按最近节点接入；若道路拓扑确实不可达，则保留明确标记的
 * 直线距离降级值，避免把无路径误报成零路程。
 */
export function compileGroundSupportTravelRoutes(
  state: AirportState,
  topology: ServiceRoadTopologyDraft,
): readonly SimulationGroundSupportTravelRouteInput[] {
  if (state.airportIdent !== topology.airportIdent) {
    throw new Error("保障道路拓扑与机场状态不属于同一机场。");
  }
  const forwardAdjacency = buildAdjacency(topology, false);
  const reverseAdjacency = buildAdjacency(topology, true);
  const stands = Object.values(state.stands).filter(
    (stand) => stand.operationalPosition,
  );
  const routes: SimulationGroundSupportTravelRouteInput[] = [];

  const standsServedBy = (
    base: AirportState["groundSupport"]["bases"][string],
  ) => stands.filter((stand) => base.serviceAreas.includes(stand.areaId));

  Object.values(state.groundSupport.bases)
    .filter((base) => base.operationalPosition)
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((base) => {
      const basePosition = base.operationalPosition!;
      const sourceAttachments = nearbyBaseAttachments(topology, basePosition.local);
      const nearestSourceAttachment = sourceAttachments[0] ?? null;
      const outboundNetworkDistances = shortestDistancesFromAttachments(
        forwardAdjacency,
        sourceAttachments,
      );
      const returnNetworkDistances = shortestDistancesFromAttachments(
        reverseAdjacency,
        sourceAttachments,
      );

      standsServedBy(base).forEach((stand) => {
        const standPosition = stand.operationalPosition!;
        // 机位附近可能存在尚未接入主网的孤立短支路。不能因它在几何上最近，
        // 就放弃稍远但实际可达的受控保障道路；分别在去程和回程可达分量内择近。
        const outboundDestinationAttachment = nearestReachableNode(
          topology,
          standPosition.local,
          outboundNetworkDistances,
        );
        const returnDestinationAttachment = nearestReachableNode(
          topology,
          standPosition.local,
          returnNetworkDistances,
        );
        const outboundNetworkDistance = outboundDestinationAttachment
          ? outboundNetworkDistances.get(outboundDestinationAttachment.nodeId)
          : undefined;
        const returnNetworkDistance = returnDestinationAttachment
          ? returnNetworkDistances.get(returnDestinationAttachment.nodeId)
          : undefined;
        const direct = directDistance(basePosition.local, standPosition.local);
        const hasOutboundRoute =
          nearestSourceAttachment !== null &&
          outboundDestinationAttachment !== null &&
          outboundNetworkDistance !== undefined;
        const hasReturnRoute =
          nearestSourceAttachment !== null &&
          returnDestinationAttachment !== null &&
          returnNetworkDistance !== undefined;
        const unroutableDirections = [
          ...(!hasOutboundRoute ? ["outbound" as const] : []),
          ...(!hasReturnRoute ? ["return" as const] : []),
        ];
        const outboundPath = hasOutboundRoute
          ? compilePath(
              topology,
              basePosition,
              outboundNetworkDistance.nodeIds,
              standPosition,
            )
          : compilePath(topology, basePosition, [], standPosition);
        const returnPath = hasReturnRoute
          ? compilePath(
              topology,
              standPosition,
              [...returnNetworkDistance.nodeIds].reverse(),
              basePosition,
            )
          : compilePath(topology, standPosition, [], basePosition);
        routes.push(Object.freeze({
          homeBaseId: base.id,
          standId: stand.id,
          outboundDistanceMeters: hasOutboundRoute
            ? outboundNetworkDistance.distanceMeters +
              outboundDestinationAttachment.distanceMeters
            : direct,
          returnDistanceMeters: hasReturnRoute
            ? returnNetworkDistance.distanceMeters +
              returnDestinationAttachment.distanceMeters
            : direct,
          sourceAttachmentMeters: Math.max(
            outboundNetworkDistance?.sourceAttachmentMeters ?? 0,
            returnNetworkDistance?.sourceAttachmentMeters ?? 0,
            nearestSourceAttachment?.distanceMeters ?? direct,
          ),
          destinationAttachmentMeters:
            Math.max(
              outboundDestinationAttachment?.distanceMeters ?? 0,
              returnDestinationAttachment?.distanceMeters ?? 0,
            ) || direct,
          outboundAuthority: hasOutboundRoute
            ? "compiled_service_road" as const
            : "direct_distance_fallback" as const,
          returnAuthority: hasReturnRoute
            ? "compiled_service_road" as const
            : "direct_distance_fallback" as const,
          outboundPath,
          returnPath,
          unroutableDirections: Object.freeze(unroutableDirections),
          authority: hasOutboundRoute && hasReturnRoute
            ? "compiled_service_road" as const
            : "direct_distance_fallback" as const,
        }));
      });
    });

  const mappedBaseIds = new Set(routes.map((route) => route.homeBaseId));
  Object.values(state.groundSupport.bases)
    .filter((base) => !mappedBaseIds.has(base.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((base) => {
      standsServedBy(base).forEach((stand) => {
        const nearestMappedBaseRoute = routes
          .filter(
            (route) =>
              route.standId === stand.id &&
              route.authority === "compiled_service_road",
          )
          .sort(
            (left, right) =>
              left.outboundDistanceMeters - right.outboundDistanceMeters,
          )[0];
        if (!nearestMappedBaseRoute) return;
        routes.push(Object.freeze({
          ...nearestMappedBaseRoute,
          homeBaseId: base.id,
          outboundAuthority: "compiled_service_road_nearest_base_assumption" as const,
          returnAuthority: "compiled_service_road_nearest_base_assumption" as const,
          authority: "compiled_service_road_nearest_base_assumption" as const,
        }));
      });
    });

  return Object.freeze(routes);
}
