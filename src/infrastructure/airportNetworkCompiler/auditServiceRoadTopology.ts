import type { ProjectedAirportCoordinate } from "../airportConfig";
import type { ServiceRoadConnectionDraft } from "./buildServiceRoadConnectionDraft";
import type { ServiceRoadGapRepairCandidate } from "./proposeServiceRoadGapRepairs";
import type {
  CandidateAirportNetwork,
  CandidateServiceRoadReviewStatus,
} from "./types";

export type ServiceRoadTopologyNode = Readonly<{
  id: string;
  coordinate: ProjectedAirportCoordinate;
  degree: number;
}>;

export type ServiceRoadTopologyEdge = Readonly<{
  id: string;
  roadId: string;
  fromNodeId: string;
  toNodeId: string;
  lengthMeters: number;
  oneWay: boolean;
  reviewStatus: CandidateServiceRoadReviewStatus;
}>;

export type ServiceRoadTopologyComponent = Readonly<{
  id: string;
  classification: "main_network" | "disconnected_fragment";
  nodeIds: readonly string[];
  roadIds: readonly string[];
  nodeCount: number;
  edgeCount: number;
  lengthMeters: number;
}>;

export type ServiceRoadTopologyDraft = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  authority: "validation_draft";
  nodes: readonly ServiceRoadTopologyNode[];
  edges: readonly ServiceRoadTopologyEdge[];
  components: readonly ServiceRoadTopologyComponent[];
  report: Readonly<{
    usableRoadCount: number;
    likelyAirsideRoadCount: number;
    reviewRequiredRoadCount: number;
    oneWayRoadCount: number;
    nodeCount: number;
    edgeCount: number;
    connectedComponentCount: number;
    mainComponentRoadCount: number;
    disconnectedRoadCount: number;
    danglingNodeCount: number;
    apronInterfaceCount: number;
    mainComponentApronInterfaceCount: number;
    disconnectedApronInterfaceIds: readonly string[];
    approvedGapRepairCount: number;
  }>;
}>;

type MutableNode = {
  id: string;
  coordinate: ProjectedAirportCoordinate;
  adjacentNodeIds: Set<string>;
};

function coordinateKey(coordinate: ProjectedAirportCoordinate) {
  return `${coordinate.wgs84.longitude.toFixed(7)},${coordinate.wgs84.latitude.toFixed(7)}`;
}

function edgeLength(
  first: ProjectedAirportCoordinate,
  second: ProjectedAirportCoordinate,
) {
  return Math.hypot(
    first.local.eastMeters - second.local.eastMeters,
    first.local.northMeters - second.local.northMeters,
  );
}

/**
 * 将只读保障道路候选层编译成独立拓扑草案。这里故意不与飞机边混合，
 * 也不自动修补几何交叉；断路和交接点必须先经过人工核校。
 */
export function auditServiceRoadTopology(
  network: CandidateAirportNetwork,
  connectionDraft?: ServiceRoadConnectionDraft | null,
  reviewedGapRepairs: readonly ServiceRoadGapRepairCandidate[] = [],
): ServiceRoadTopologyDraft {
  const roads = (network.serviceRoadNetwork?.roads ?? []).filter(
    (road) => road.reviewStatus !== "excluded",
  );
  const mutableNodes = new Map<string, MutableNode>();
  const edges: ServiceRoadTopologyEdge[] = [];
  const roadIdsByNodeId = new Map<string, Set<string>>();

  function getNode(coordinate: ProjectedAirportCoordinate) {
    const key = coordinateKey(coordinate);
    const existing = mutableNodes.get(key);
    if (existing) return existing;
    const node: MutableNode = {
      id: `${network.airportIdent}-SERVICE-N-${key}`,
      coordinate,
      adjacentNodeIds: new Set(),
    };
    mutableNodes.set(key, node);
    roadIdsByNodeId.set(node.id, new Set());
    return node;
  }

  roads.forEach((road) => {
    for (let index = 0; index < road.coordinates.length - 1; index += 1) {
      const fromNode = getNode(road.coordinates[index]);
      const toNode = getNode(road.coordinates[index + 1]);
      if (fromNode.id === toNode.id) continue;
      fromNode.adjacentNodeIds.add(toNode.id);
      toNode.adjacentNodeIds.add(fromNode.id);
      roadIdsByNodeId.get(fromNode.id)?.add(road.id);
      roadIdsByNodeId.get(toNode.id)?.add(road.id);
      edges.push(Object.freeze({
        id: `${road.id}:SEGMENT-${index + 1}`,
        roadId: road.id,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        lengthMeters: edgeLength(fromNode.coordinate, toNode.coordinate),
        oneWay: road.oneWay,
        reviewStatus: road.reviewStatus,
      }));
    }
  });

  const approvedGapRepairs = reviewedGapRepairs.filter(
    (candidate) => candidate.status === "approved",
  );
  approvedGapRepairs.forEach((candidate) => {
    const fromNode = getNode(candidate.fromCoordinate);
    const toNode = getNode(candidate.toCoordinate);
    if (fromNode.id === toNode.id) return;
    fromNode.adjacentNodeIds.add(toNode.id);
    toNode.adjacentNodeIds.add(fromNode.id);
    edges.push(Object.freeze({
      id: `APPROVED-${candidate.id}`,
      roadId: candidate.id,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      lengthMeters: candidate.distanceMeters,
      oneWay: false,
      reviewStatus: "likely_airside" as const,
    }));
  });

  const nodes = [...mutableNodes.values()].map((node) => Object.freeze({
    id: node.id,
    coordinate: node.coordinate,
    degree: node.adjacentNodeIds.size,
  }));
  const edgeByNodeId = new Map(nodes.map((node) => [node.id, [] as ServiceRoadTopologyEdge[]]));
  edges.forEach((edge) => {
    edgeByNodeId.get(edge.fromNodeId)?.push(edge);
    edgeByNodeId.get(edge.toNodeId)?.push(edge);
  });

  const visited = new Set<string>();
  const rawComponents: Array<{ nodeIds: string[]; edgeIds: Set<string>; roadIds: Set<string> }> = [];
  nodes.forEach((node) => {
    if (visited.has(node.id)) return;
    const pending = [node.id];
    const nodeIds: string[] = [];
    const edgeIds = new Set<string>();
    const roadIds = new Set<string>();
    visited.add(node.id);
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current) continue;
      nodeIds.push(current);
      (roadIdsByNodeId.get(current) ?? []).forEach((roadId) => roadIds.add(roadId));
      (edgeByNodeId.get(current) ?? []).forEach((edge) => {
        edgeIds.add(edge.id);
        const next = edge.fromNodeId === current ? edge.toNodeId : edge.fromNodeId;
        if (visited.has(next)) return;
        visited.add(next);
        pending.push(next);
      });
    }
    rawComponents.push({ nodeIds, edgeIds, roadIds });
  });
  rawComponents.sort((left, right) => right.roadIds.size - left.roadIds.size);
  const edgesById = new Map(edges.map((edge) => [edge.id, edge]));
  const components = rawComponents.map((component, index) => Object.freeze({
    id: `SERVICE-COMPONENT-${String(index + 1).padStart(3, "0")}`,
    classification: index === 0 ? "main_network" as const : "disconnected_fragment" as const,
    nodeIds: Object.freeze(component.nodeIds),
    roadIds: Object.freeze([...component.roadIds]),
    nodeCount: component.nodeIds.length,
    edgeCount: component.edgeIds.size,
    lengthMeters: [...component.edgeIds].reduce(
      (total, edgeId) => total + (edgesById.get(edgeId)?.lengthMeters ?? 0),
      0,
    ),
  }));
  const mainRoadIds = new Set(components[0]?.roadIds ?? []);
  const interfaceCandidates = connectionDraft?.apronInterfaces ?? [];
  const disconnectedApronInterfaceIds = interfaceCandidates
    .filter((candidate) => !mainRoadIds.has(candidate.roadId))
    .map((candidate) => candidate.id);

  return Object.freeze({
    schemaVersion: "1.0.0" as const,
    airportIdent: network.airportIdent,
    authority: "validation_draft" as const,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    components: Object.freeze(components),
    report: Object.freeze({
      usableRoadCount: roads.length,
      likelyAirsideRoadCount: roads.filter((road) => road.reviewStatus === "likely_airside").length,
      reviewRequiredRoadCount: roads.filter((road) => road.reviewStatus === "requires_review").length,
      oneWayRoadCount: roads.filter((road) => road.oneWay).length,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      connectedComponentCount: components.length,
      mainComponentRoadCount: mainRoadIds.size,
      disconnectedRoadCount: Math.max(0, roads.length - mainRoadIds.size),
      danglingNodeCount: nodes.filter((node) => node.degree === 1).length,
      apronInterfaceCount: interfaceCandidates.length,
      mainComponentApronInterfaceCount:
        interfaceCandidates.length - disconnectedApronInterfaceIds.length,
      disconnectedApronInterfaceIds: Object.freeze(disconnectedApronInterfaceIds),
      approvedGapRepairCount: approvedGapRepairs.length,
    }),
  });
}
