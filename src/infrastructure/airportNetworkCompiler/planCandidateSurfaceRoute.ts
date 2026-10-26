import type { CandidateRunwayCatalog } from "./deriveCandidateRunwayCatalog";
import type { CandidateAirportNetwork } from "./types";

export type Wgs84Tuple = readonly [longitude: number, latitude: number];

export type CandidateSurfaceRoute = Readonly<{
  coordinates: readonly Wgs84Tuple[];
  nodeIds: readonly string[];
  edgeIds: readonly string[];
  distanceMeters: number;
}>;

export type CandidateRunwayPosition = "north" | "south";
export type CandidateRunwaySide = "W" | "E";

const MAXIMUM_ATTACHMENT_DISTANCE_METERS = 180;

function distanceMeters(first: Wgs84Tuple, second: Wgs84Tuple) {
  const latitudeRadians = ((first[1] + second[1]) / 2) * (Math.PI / 180);
  return Math.hypot(
    (second[0] - first[0]) * 111_320 * Math.cos(latitudeRadians),
    (second[1] - first[1]) * 111_320,
  );
}

function measurePathMeters(path: readonly Wgs84Tuple[]) {
  return path.slice(1).reduce(
    (total, point, index) => total + distanceMeters(path[index], point),
    0,
  );
}

type QueueItem = Readonly<{ nodeId: string; cost: number }>;

class MinQueue {
  private readonly items: QueueItem[] = [];

  push(item: QueueItem) {
    this.items.push(item);
    this.items.sort((first, second) => first.cost - second.cost);
  }

  pop() {
    return this.items.shift() ?? null;
  }

  get size() {
    return this.items.length;
  }
}

/**
 * 选择指定跑道和方向的真实滑行道接入口。跑道南北归属由跑道组
 * 平均纬度确定，东西端由接入口经度确定，不依赖旧图片坐标。
 */
export function findCandidateRunwayAccessCoordinate(
  network: CandidateAirportNetwork,
  runwayPosition: CandidateRunwayPosition | string,
  side: CandidateRunwaySide,
  approvedRunwayCatalog?: CandidateRunwayCatalog,
): Wgs84Tuple | null {
  const runwayEdges = network.edges.filter(
    (edge) => edge.primaryKind === "runway",
  );
  const groups = new Map<string, typeof runwayEdges>();
  runwayEdges.forEach((edge) => {
    const key = edge.refs[0] ?? `UNNAMED:${edge.sourceWayIds[0] ?? edge.id}`;
    const current = groups.get(key) ?? [];
    current.push(edge);
    groups.set(key, current);
  });
  const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
  const runwayGroups = [...groups.entries()].map(([ref, edges]) => {
    const nodeIds = new Set(edges.flatMap((edge) => [
      edge.fromNodeId,
      edge.toNodeId,
    ]));
    const nodes = [...nodeIds]
      .map((nodeId) => nodeById.get(nodeId))
      .filter((node) => node !== undefined);
    return {
      ref,
      nodeIds,
      averageLatitude:
        nodes.reduce(
          (total, node) => total + node.coordinate.wgs84.latitude,
          0,
        ) / Math.max(1, nodes.length),
    };
  }).sort((first, second) => first.averageLatitude - second.averageLatitude);
  const exactRunwayGroup = runwayGroups.find(
    (candidate) => candidate.ref === runwayPosition,
  );
  const group = exactRunwayGroup ?? (runwayPosition === "north"
    ? runwayGroups.at(-1) ?? null
    : runwayPosition === "south"
      ? runwayGroups[0] ?? null
      : null);
  if (!group) return null;
  if (approvedRunwayCatalog) {
    if (
      approvedRunwayCatalog.airportIdent !== network.airportIdent ||
      approvedRunwayCatalog.authority !== "approved_operational" ||
      !approvedRunwayCatalog.mayDriveSimulation
    ) {
      return null;
    }
    const approvedRunway = approvedRunwayCatalog.runways.find(
      (runway) => runway.ref === group.ref,
    );
    if (!approvedRunway || approvedRunway.holdingPointIds.length === 0) {
      return null;
    }
    const selectedEnd = [...approvedRunway.ends].sort(
      (left, right) =>
        left.coordinate.wgs84.longitude - right.coordinate.wgs84.longitude,
    )[side === "W" ? 0 : approvedRunway.ends.length - 1];
    if (
      !selectedEnd ||
      !approvedRunwayCatalog.holdingPointAssignments.some(
        (assignment) =>
          assignment.runwayRef === approvedRunway.ref &&
          assignment.permittedDesignators.includes(selectedEnd.designator),
      )
    ) {
      return null;
    }
  }
  const access = network.operationalPoints
    .filter(
      (point) =>
        point.kind === "runway_connection" &&
        point.networkNodeId !== null &&
        group.nodeIds.has(point.networkNodeId),
    )
    .sort((first, second) => {
      const difference =
        first.coordinate.wgs84.longitude - second.coordinate.wgs84.longitude;
      return side === "W" ? difference : -difference;
    })[0];
  return access
    ? [access.coordinate.wgs84.longitude, access.coordinate.wgs84.latitude]
    : null;
}

/**
 * 将业务语义端点接入候选滑行路网。只使用主连通分量中的非跑道边，
 * 因而地面滑行和牵引不会把跑道中心线当作普通捷径。
 */
export function planCandidateSurfaceRoute(
  network: CandidateAirportNetwork,
  source: Wgs84Tuple,
  destination: Wgs84Tuple,
  options: Readonly<{
    blockedEdgeIds?: readonly string[];
    blockedNodeIds?: readonly string[];
    sourceAttachmentNodeId?: string | null;
    destinationAttachmentNodeId?: string | null;
  }> = {},
): CandidateSurfaceRoute | null {
  const blockedEdgeIds = new Set(options.blockedEdgeIds ?? []);
  const blockedNodeIds = new Set(options.blockedNodeIds ?? []);
  const mainNodeIds = new Set(
    network.report.components.find(
      (component) => component.classification === "main_network",
    )?.nodeIds ?? network.nodes.map((node) => node.id),
  );
  const eligibleNodeIds = new Set<string>();
  network.edges.forEach((edge) => {
    if (
      edge.primaryKind === "runway" ||
      blockedEdgeIds.has(edge.id) ||
      blockedNodeIds.has(edge.fromNodeId) ||
      blockedNodeIds.has(edge.toNodeId)
    ) return;
    if (mainNodeIds.has(edge.fromNodeId)) eligibleNodeIds.add(edge.fromNodeId);
    if (mainNodeIds.has(edge.toNodeId)) eligibleNodeIds.add(edge.toNodeId);
  });
  const eligibleNodes = network.nodes.filter((node) =>
    eligibleNodeIds.has(node.id),
  );
  if (eligibleNodes.length === 0) return null;

  const nearestNode = (coordinate: Wgs84Tuple) => eligibleNodes.reduce(
    (best, node) => {
      const candidate: Wgs84Tuple = [
        node.coordinate.wgs84.longitude,
        node.coordinate.wgs84.latitude,
      ];
      const distance = distanceMeters(coordinate, candidate);
      return distance < best.distance
        ? { nodeId: node.id, distance }
        : best;
    },
    { nodeId: eligibleNodes[0].id, distance: Number.POSITIVE_INFINITY },
  );
  const forcedAttachment = (
    nodeId: string | null | undefined,
    coordinate: Wgs84Tuple,
  ) => {
    if (!nodeId || !eligibleNodeIds.has(nodeId)) return null;
    const node = network.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return null;
    return {
      nodeId,
      distance: distanceMeters(coordinate, [
        node.coordinate.wgs84.longitude,
        node.coordinate.wgs84.latitude,
      ]),
    };
  };
  const sourceAttachment =
    forcedAttachment(options.sourceAttachmentNodeId, source) ?? nearestNode(source);
  const destinationAttachment =
    forcedAttachment(options.destinationAttachmentNodeId, destination) ??
    nearestNode(destination);
  if (
    sourceAttachment.distance > MAXIMUM_ATTACHMENT_DISTANCE_METERS ||
    destinationAttachment.distance > MAXIMUM_ATTACHMENT_DISTANCE_METERS
  ) return null;

  const adjacency = new Map<
    string,
    Array<{ nodeId: string; edgeId: string; lengthMeters: number }>
  >();
  eligibleNodes.forEach((node) => adjacency.set(node.id, []));
  network.edges.forEach((edge) => {
    if (
      edge.primaryKind === "runway" ||
      blockedEdgeIds.has(edge.id) ||
      blockedNodeIds.has(edge.fromNodeId) ||
      blockedNodeIds.has(edge.toNodeId) ||
      !eligibleNodeIds.has(edge.fromNodeId) ||
      !eligibleNodeIds.has(edge.toNodeId)
    ) return;
    adjacency.get(edge.fromNodeId)?.push({
      nodeId: edge.toNodeId,
      edgeId: edge.id,
      lengthMeters: edge.lengthMeters,
    });
    if (edge.bidirectional) {
      adjacency.get(edge.toNodeId)?.push({
        nodeId: edge.fromNodeId,
        edgeId: edge.id,
        lengthMeters: edge.lengthMeters,
      });
    }
  });

  const costs = new Map([[sourceAttachment.nodeId, 0]]);
  const previous = new Map<
    string,
    Readonly<{ nodeId: string; edgeId: string }>
  >();
  const queue = new MinQueue();
  queue.push({ nodeId: sourceAttachment.nodeId, cost: 0 });
  while (queue.size > 0) {
    const current = queue.pop();
    if (!current) break;
    if (current.cost !== costs.get(current.nodeId)) continue;
    if (current.nodeId === destinationAttachment.nodeId) break;
    (adjacency.get(current.nodeId) ?? []).forEach((step) => {
      const nextCost = current.cost + step.lengthMeters;
      if (nextCost >= (costs.get(step.nodeId) ?? Number.POSITIVE_INFINITY)) {
        return;
      }
      costs.set(step.nodeId, nextCost);
      previous.set(step.nodeId, {
        nodeId: current.nodeId,
        edgeId: step.edgeId,
      });
      queue.push({ nodeId: step.nodeId, cost: nextCost });
    });
  }
  if (!costs.has(destinationAttachment.nodeId)) return null;

  const nodeIds = [destinationAttachment.nodeId];
  const edgeIds: string[] = [];
  let currentNodeId = destinationAttachment.nodeId;
  while (currentNodeId !== sourceAttachment.nodeId) {
    const step = previous.get(currentNodeId);
    if (!step) return null;
    nodeIds.unshift(step.nodeId);
    edgeIds.unshift(step.edgeId);
    currentNodeId = step.nodeId;
  }
  const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
  const coordinates: Wgs84Tuple[] = [
    source,
    ...nodeIds.map((nodeId): Wgs84Tuple => {
      const coordinate = nodeById.get(nodeId)!.coordinate.wgs84;
      return [coordinate.longitude, coordinate.latitude];
    }),
    destination,
  ];
  return Object.freeze({
    coordinates: Object.freeze(coordinates),
    nodeIds: Object.freeze(nodeIds),
    edgeIds: Object.freeze(edgeIds),
    distanceMeters: measurePathMeters(coordinates),
  });
}
