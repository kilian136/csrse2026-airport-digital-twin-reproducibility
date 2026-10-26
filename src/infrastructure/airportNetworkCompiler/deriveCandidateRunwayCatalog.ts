import type {
  CandidateAirportNetwork,
  CandidateNetworkEdge,
  CandidateNetworkNode,
} from "./types";

export type CandidateRunwayEnd = Readonly<{
  designator: string;
  nodeId: string;
  headingDegrees: number;
  coordinate: CandidateNetworkNode["coordinate"];
}>;

export type CandidateRunwayDefinition = Readonly<{
  id: string;
  ref: string;
  status: "endpoints_resolved" | "requires_review";
  lengthMeters: number;
  edgeIds: readonly string[];
  ends: readonly CandidateRunwayEnd[];
  holdingPointAssignment: "requires_manual_confirmation" | "approved";
  holdingPointIds: readonly string[];
}>;

export type CandidateRunwayHoldingPointAssignment = Readonly<{
  holdingPointId: string;
  runwayRef: string;
  /** 等待点可服务的跑道运行方向；实际启用方向仍由塔台许可决定。 */
  permittedDesignators: readonly string[];
}>;

export type CandidateRunwayCatalog = Readonly<{
  airportIdent: string;
  authority: "candidate_only" | "approved_operational";
  mayDriveSimulation: boolean;
  runways: readonly CandidateRunwayDefinition[];
  holdingPointAssignments: readonly CandidateRunwayHoldingPointAssignment[];
  unassignedHoldingPointIds: readonly string[];
  report: Readonly<{
    runwayCount: number;
    resolvedEndpointCount: number;
    reviewRequiredCount: number;
    holdingPointCount: number;
    assignedHoldingPointCount: number;
  }>;
}>;

function normalizeDegrees(value: number) {
  return (value % 360 + 360) % 360;
}

function angularDifference(first: number, second: number) {
  const delta = Math.abs(normalizeDegrees(first) - normalizeDegrees(second));
  return Math.min(delta, 360 - delta);
}

function bearingDegrees(from: CandidateNetworkNode, to: CandidateNetworkNode) {
  const east =
    to.coordinate.local.eastMeters - from.coordinate.local.eastMeters;
  const north =
    to.coordinate.local.northMeters - from.coordinate.local.northMeters;
  return normalizeDegrees(Math.atan2(east, north) * 180 / Math.PI);
}

function designatorHeading(designator: string) {
  const match = /^(\d{2})/.exec(designator);
  return match ? (Number(match[1]) * 10) % 360 : null;
}

function deriveRunway(
  airportIdent: string,
  ref: string,
  edges: readonly CandidateNetworkEdge[],
  nodeById: ReadonlyMap<string, CandidateNetworkNode>,
): CandidateRunwayDefinition {
  const degree = new Map<string, number>();
  edges.forEach((edge) => {
    degree.set(edge.fromNodeId, (degree.get(edge.fromNodeId) ?? 0) + 1);
    degree.set(edge.toNodeId, (degree.get(edge.toNodeId) ?? 0) + 1);
  });
  const endpointIds = Array.from(degree)
    .filter(([, count]) => count === 1)
    .map(([nodeId]) => nodeId);
  const designators = ref.split("/").map((value) => value.trim());
  const endpointNodes = endpointIds
    .map((nodeId) => nodeById.get(nodeId) ?? null)
    .filter((node): node is CandidateNetworkNode => node !== null);
  const lengthMeters = edges.reduce(
    (sum, edge) => sum + edge.lengthMeters,
    0,
  );
  if (endpointNodes.length !== 2 || designators.length !== 2) {
    return Object.freeze({
      id: `${airportIdent}-RWY-${ref.replace("/", "-")}`,
      ref,
      status: "requires_review" as const,
      lengthMeters,
      edgeIds: Object.freeze(edges.map((edge) => edge.id)),
      ends: Object.freeze([]),
      holdingPointAssignment: "requires_manual_confirmation" as const,
      holdingPointIds: Object.freeze([]),
    });
  }

  const [firstNode, secondNode] = endpointNodes;
  const firstHeading = designatorHeading(designators[0]);
  const secondHeading = designatorHeading(designators[1]);
  if (firstHeading === null || secondHeading === null) {
    return Object.freeze({
      id: `${airportIdent}-RWY-${ref.replace("/", "-")}`,
      ref,
      status: "requires_review" as const,
      lengthMeters,
      edgeIds: Object.freeze(edges.map((edge) => edge.id)),
      ends: Object.freeze([]),
      holdingPointAssignment: "requires_manual_confirmation" as const,
      holdingPointIds: Object.freeze([]),
    });
  }
  const forwardBearing = bearingDegrees(firstNode, secondNode);
  const firstDesignatorStartsAtFirst =
    angularDifference(forwardBearing, firstHeading) <=
    angularDifference(forwardBearing, secondHeading);
  const nodeForFirst = firstDesignatorStartsAtFirst ? firstNode : secondNode;
  const nodeForSecond = firstDesignatorStartsAtFirst ? secondNode : firstNode;
  return Object.freeze({
    id: `${airportIdent}-RWY-${ref.replace("/", "-")}`,
    ref,
    status: "endpoints_resolved" as const,
    lengthMeters,
    edgeIds: Object.freeze(edges.map((edge) => edge.id)),
    ends: Object.freeze([
      Object.freeze({
        designator: designators[0],
        nodeId: nodeForFirst.id,
        headingDegrees: firstHeading,
        coordinate: nodeForFirst.coordinate,
      }),
      Object.freeze({
        designator: designators[1],
        nodeId: nodeForSecond.id,
        headingDegrees: secondHeading,
        coordinate: nodeForSecond.coordinate,
      }),
    ]),
    holdingPointAssignment: "requires_manual_confirmation" as const,
    holdingPointIds: Object.freeze([]),
  });
}

/**
 * 从OSM候选网络提取跑道编号和物理端点。等待点归属不会按最近距离猜测，
 * 在人工确认前目录保持candidate_only且不能驱动跑道放行。
 */
export function deriveCandidateRunwayCatalog(
  network: CandidateAirportNetwork,
): CandidateRunwayCatalog {
  const runwayEdges = network.edges.filter((edge) =>
    edge.kinds.includes("runway"),
  );
  const edgesByRef = new Map<string, CandidateNetworkEdge[]>();
  runwayEdges.forEach((edge) => {
    edge.refs.forEach((ref) => {
      if (!/^\d{2}[LRC]?\/\d{2}[LRC]?$/.test(ref)) return;
      const group = edgesByRef.get(ref) ?? [];
      group.push(edge);
      edgesByRef.set(ref, group);
    });
  });
  const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
  const runways = Array.from(edgesByRef)
    .map(([ref, edges]) =>
      deriveRunway(network.airportIdent, ref, edges, nodeById),
    )
    .sort((left, right) => left.ref.localeCompare(right.ref));
  const unassignedHoldingPointIds = network.operationalPoints
    .filter((point) => point.kind === "holding_position")
    .map((point) => point.id);
  return Object.freeze({
    airportIdent: network.airportIdent,
    authority: "candidate_only" as const,
    mayDriveSimulation: false as const,
    runways: Object.freeze(runways),
    holdingPointAssignments: Object.freeze([]),
    unassignedHoldingPointIds: Object.freeze(unassignedHoldingPointIds),
    report: Object.freeze({
      runwayCount: runways.length,
      resolvedEndpointCount: runways.filter(
        (runway) => runway.status === "endpoints_resolved",
      ).length,
      reviewRequiredCount: runways.filter(
        (runway) => runway.status === "requires_review",
      ).length,
      holdingPointCount: unassignedHoldingPointIds.length,
      assignedHoldingPointCount: 0,
    }),
  });
}
