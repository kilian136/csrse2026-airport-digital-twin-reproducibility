import type { OperationalAirportNetworkDraft } from "./buildOperationalAirportNetworkDraft";
import type { OperationalSurfaceNetworkReadiness } from "./assessOperationalSurfaceNetwork";

export type SurfaceRouteShadow = Readonly<{
  id: string;
  sourceAnchorId: string;
  destinationHoldingAnchorId: string | null;
  status: "reachable" | "unreachable";
  distanceMeters: number | null;
  nodeIds: readonly string[];
  edgeIds: readonly string[];
  usesRunwayControlledEdge: false;
}>;

export type SurfaceRouteShadowAudit = Readonly<{
  airportIdent: string;
  authority: "shadow_validation";
  mayDriveSimulation: false;
  status: "ready_for_manual_scenario_test" | "requires_review" | "blocked";
  routes: readonly SurfaceRouteShadow[];
  report: Readonly<{
    sourceAnchorCount: number;
    holdingPointAnchorCount: number;
    reachableRouteCount: number;
    unreachableRouteCount: number;
    runwayProtectedRouteCount: number;
    routesUsingRunwayControlledEdge: 0;
    runwayControlledEdgeCount: number;
    averageDistanceMeters: number;
    maximumDistanceMeters: number;
  }>;
}>;

export type SurfaceRouteShadowSample = Readonly<{
  routeId: string;
  group: string;
  band: "near" | "middle" | "far";
  label: string;
  sourceName: string;
  destinationName: string;
  distanceMeters: number;
}>;

export type RepresentativeSurfaceRouteSampleOptions = Readonly<{
  /**
   * 仅为已经完成人工核校的航站楼-指廊生成样本，例如 T1-A、T1-B。
   * 新增但尚未核校的区域仍可显示和参与影子验证，不会被自动纳入既有批准。
   */
  sourceGroups?: readonly string[];
}>;

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

/**
 * 只读验证机位/登机口到任一跑道等待点的可达性。寻路主动排除所有带
 * runway属性的边，因此影子路线只能停在跑道前，不会把跑道当普通滑行路。
 */
export function validateSurfaceRouteShadows(
  readiness: OperationalSurfaceNetworkReadiness,
  operationalDraft: OperationalAirportNetworkDraft,
): SurfaceRouteShadowAudit {
  if (readiness.airportIdent !== operationalDraft.airportIdent) {
    throw new Error("影子寻路草案与运行锚点不属于同一机场。");
  }
  const sourceAnchors = operationalDraft.anchors.filter(
    (anchor) =>
      (anchor.kind === "gate" || anchor.kind === "stand") &&
      anchor.connectionStatus === "connected" &&
      anchor.connectedNodeId,
  );
  const holdingAnchors = operationalDraft.anchors.filter(
    (anchor) =>
      anchor.kind === "holding_point" &&
      anchor.connectionStatus === "connected" &&
      anchor.connectedNodeId,
  );
  const holdingAnchorByNodeId = new Map(
    holdingAnchors.map((anchor) => [anchor.connectedNodeId!, anchor]),
  );
  const eligibleNodeIds = new Set(readiness.nodes.map((node) => node.id));
  const safeEdges = readiness.edges.filter(
    (edge) =>
      !edge.kinds.includes("runway") &&
      eligibleNodeIds.has(edge.fromNodeId) &&
      eligibleNodeIds.has(edge.toNodeId),
  );
  const adjacency = new Map<
    string,
    Array<Readonly<{ nodeId: string; edgeId: string; lengthMeters: number }>>
  >();
  readiness.nodes.forEach((node) => adjacency.set(node.id, []));
  safeEdges.forEach((edge) => {
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

  const routes = sourceAnchors.map((anchor): SurfaceRouteShadow => {
    const sourceNodeId = anchor.connectedNodeId!;
    const costs = new Map([[sourceNodeId, 0]]);
    const previous = new Map<
      string,
      Readonly<{ nodeId: string; edgeId: string }>
    >();
    const queue = new MinQueue();
    queue.push({ nodeId: sourceNodeId, cost: 0 });
    let destinationNodeId: string | null = null;
    while (queue.size > 0) {
      const current = queue.pop();
      if (!current || current.cost !== costs.get(current.nodeId)) continue;
      if (holdingAnchorByNodeId.has(current.nodeId)) {
        destinationNodeId = current.nodeId;
        break;
      }
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
    if (!destinationNodeId) {
      return Object.freeze({
        id: `SHADOW:${anchor.id}`,
        sourceAnchorId: anchor.id,
        destinationHoldingAnchorId: null,
        status: "unreachable" as const,
        distanceMeters: null,
        nodeIds: Object.freeze([]),
        edgeIds: Object.freeze([]),
        usesRunwayControlledEdge: false as const,
      });
    }
    const nodeIds = [destinationNodeId];
    const edgeIds: string[] = [];
    let currentNodeId = destinationNodeId;
    while (currentNodeId !== sourceNodeId) {
      const step = previous.get(currentNodeId);
      if (!step) break;
      nodeIds.unshift(step.nodeId);
      edgeIds.unshift(step.edgeId);
      currentNodeId = step.nodeId;
    }
    return Object.freeze({
      id: `SHADOW:${anchor.id}`,
      sourceAnchorId: anchor.id,
      destinationHoldingAnchorId:
        holdingAnchorByNodeId.get(destinationNodeId)?.id ?? null,
      status: "reachable" as const,
      distanceMeters: costs.get(destinationNodeId) ?? 0,
      nodeIds: Object.freeze(nodeIds),
      edgeIds: Object.freeze(edgeIds),
      usesRunwayControlledEdge: false as const,
    });
  });
  const reachableRoutes = routes.filter((route) => route.status === "reachable");
  const distances = reachableRoutes
    .map((route) => route.distanceMeters)
    .filter((distance): distance is number => distance !== null);
  const unreachableRouteCount = routes.length - reachableRoutes.length;
  const status = routes.length === 0 || holdingAnchors.length === 0
    ? "blocked"
    : unreachableRouteCount > 0
      ? "requires_review"
      : "ready_for_manual_scenario_test";
  return Object.freeze({
    airportIdent: readiness.airportIdent,
    authority: "shadow_validation" as const,
    mayDriveSimulation: false as const,
    status,
    routes: Object.freeze(routes),
    report: Object.freeze({
      sourceAnchorCount: sourceAnchors.length,
      holdingPointAnchorCount: holdingAnchors.length,
      reachableRouteCount: reachableRoutes.length,
      unreachableRouteCount,
      runwayProtectedRouteCount: reachableRoutes.length,
      routesUsingRunwayControlledEdge: 0 as const,
      runwayControlledEdgeCount: readiness.edges.filter((edge) =>
        edge.kinds.includes("runway"),
      ).length,
      averageDistanceMeters:
        distances.length > 0
          ? distances.reduce((sum, distance) => sum + distance, 0) /
            distances.length
          : 0,
      maximumDistanceMeters: Math.max(0, ...distances),
    }),
  });
}

export function resolveSurfaceRouteSourceGroup(sourceName: string): string {
  const match = sourceName.match(/^(T\d+)-([A-Z])-/i);
  return match
    ? `${match[1].toUpperCase()}-${match[2].toUpperCase()}`
    : "其他";
}

/** 每个航站楼-指廊各选近、中、远三条路线，供人工快速抽检。 */
export function buildRepresentativeSurfaceRouteSamples(
  audit: SurfaceRouteShadowAudit,
  operationalDraft: OperationalAirportNetworkDraft,
  options: RepresentativeSurfaceRouteSampleOptions = {},
): readonly SurfaceRouteShadowSample[] {
  const anchorById = new Map(
    operationalDraft.anchors.map((anchor) => [anchor.id, anchor]),
  );
  const grouped = new Map<
    string,
    Array<Readonly<{
      route: SurfaceRouteShadow;
      sourceName: string;
      destinationName: string;
      distanceMeters: number;
    }>>
  >();
  audit.routes
    .filter(
      (route) => route.status === "reachable" && route.distanceMeters !== null,
    )
    .forEach((route) => {
      const sourceName =
        anchorById.get(route.sourceAnchorId)?.name ?? route.sourceAnchorId;
      const destinationName = route.destinationHoldingAnchorId
        ? anchorById.get(route.destinationHoldingAnchorId)?.name ??
          route.destinationHoldingAnchorId
        : "未知等待点";
      const group = resolveSurfaceRouteSourceGroup(sourceName);
      if (
        options.sourceGroups &&
        !options.sourceGroups.includes(group)
      ) {
        return;
      }
      const items = grouped.get(group) ?? [];
      items.push({
        route,
        sourceName,
        destinationName,
        distanceMeters: route.distanceMeters!,
      });
      grouped.set(group, items);
    });

  const bands = [
    { band: "near" as const, label: "近", index: () => 0 },
    {
      band: "middle" as const,
      label: "中",
      index: (length: number) => Math.floor((length - 1) / 2),
    },
    {
      band: "far" as const,
      label: "远",
      index: (length: number) => length - 1,
    },
  ];
  return Object.freeze(
    [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
      .flatMap(([group, items]) => {
        const sorted = [...items].sort(
          (left, right) => left.distanceMeters - right.distanceMeters,
        );
        const usedRouteIds = new Set<string>();
        return bands.flatMap((band): SurfaceRouteShadowSample[] => {
          const item = sorted[band.index(sorted.length)];
          if (!item || usedRouteIds.has(item.route.id)) return [];
          usedRouteIds.add(item.route.id);
          return [{
            routeId: item.route.id,
            group,
            band: band.band,
            label: `${group}${band.label}`,
            sourceName: item.sourceName,
            destinationName: item.destinationName,
            distanceMeters: item.distanceMeters,
          }];
        });
      }),
  );
}
