import type { ProjectedAirportCoordinate } from "../airportConfig";
import type {
  ServiceRoadTopologyDraft,
  ServiceRoadTopologyEdge,
} from "./auditServiceRoadTopology";

export type ServiceRoadGapRepairConfidence = "high" | "review";

export type ServiceRoadGapRepairDecision = Readonly<{
  fromNodeId: string;
  toNodeId: string;
  decision: "approved" | "rejected";
  evidence:
    | "satellite_imagery"
    | "field_verification"
    | "authoritative_data"
    | "user_confirmation";
  note: string;
}>;

export type ServiceRoadGapRepairCandidate = Readonly<{
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromCoordinate: ProjectedAirportCoordinate;
  toCoordinate: ProjectedAirportCoordinate;
  distanceMeters: number;
  fromAlignmentDegrees: number;
  toAlignmentDegrees: number;
  confidence: ServiceRoadGapRepairConfidence;
  status: "pending_manual_review" | "approved" | "rejected";
  reviewEvidence?: ServiceRoadGapRepairDecision["evidence"];
  reviewNote?: string;
}>;

export type ServiceRoadGapRepairProposal = Readonly<{
  authority: "validation_draft";
  candidates: readonly ServiceRoadGapRepairCandidate[];
  report: Readonly<{
    danglingNodeCount: number;
    highConfidenceCount: number;
    reviewCount: number;
    approvedCount: number;
    rejectedCount: number;
    pendingCount: number;
    unmatchedDanglingNodeCount: number;
    maximumCandidateDistanceMeters: number;
  }>;
}>;

const HIGH_CONFIDENCE_DISTANCE_METERS = 8;
const REVIEW_DISTANCE_METERS = 20;
const HIGH_CONFIDENCE_ALIGNMENT_DEGREES = 30;
const REVIEW_ALIGNMENT_DEGREES = 50;

function vector(
  from: ProjectedAirportCoordinate,
  to: ProjectedAirportCoordinate,
) {
  return {
    east: to.local.eastMeters - from.local.eastMeters,
    north: to.local.northMeters - from.local.northMeters,
  };
}

function vectorLength(value: Readonly<{ east: number; north: number }>) {
  return Math.hypot(value.east, value.north);
}

function angleDegrees(
  first: Readonly<{ east: number; north: number }>,
  second: Readonly<{ east: number; north: number }>,
) {
  const denominator = vectorLength(first) * vectorLength(second);
  if (denominator === 0) return 180;
  const cosine = Math.min(
    1,
    Math.max(-1, (first.east * second.east + first.north * second.north) / denominator),
  );
  return (Math.acos(cosine) * 180) / Math.PI;
}

function otherNodeId(edge: ServiceRoadTopologyEdge, nodeId: string) {
  return edge.fromNodeId === nodeId ? edge.toNodeId : edge.fromNodeId;
}

/**
 * 仅提出跨分量的小间隙连接，不改变原始拓扑。高置信候选仍必须人工批准，
 * 因为卫星图上的围栏、门禁和高差无法只靠OSM折线判断。
 */
export function proposeServiceRoadGapRepairs(
  topology: ServiceRoadTopologyDraft,
): ServiceRoadGapRepairProposal {
  const nodesById = new Map(topology.nodes.map((node) => [node.id, node]));
  const edgesByNodeId = new Map(
    topology.nodes.map((node) => [node.id, [] as ServiceRoadTopologyEdge[]]),
  );
  topology.edges.forEach((edge) => {
    edgesByNodeId.get(edge.fromNodeId)?.push(edge);
    edgesByNodeId.get(edge.toNodeId)?.push(edge);
  });
  const componentIdByNodeId = new Map<string, string>();
  topology.components.forEach((component) => {
    component.nodeIds.forEach((nodeId) => componentIdByNodeId.set(nodeId, component.id));
  });
  const dangling = topology.nodes.filter((node) => node.degree === 1);
  const rawCandidates: ServiceRoadGapRepairCandidate[] = [];

  for (let firstIndex = 0; firstIndex < dangling.length; firstIndex += 1) {
    const first = dangling[firstIndex];
    const firstEdge = edgesByNodeId.get(first.id)?.[0];
    const firstNeighbor = firstEdge
      ? nodesById.get(otherNodeId(firstEdge, first.id))
      : null;
    if (!firstNeighbor) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < dangling.length; secondIndex += 1) {
      const second = dangling[secondIndex];
      if (componentIdByNodeId.get(first.id) === componentIdByNodeId.get(second.id)) continue;
      const secondEdge = edgesByNodeId.get(second.id)?.[0];
      const secondNeighbor = secondEdge
        ? nodesById.get(otherNodeId(secondEdge, second.id))
        : null;
      if (!secondNeighbor) continue;
      const connectionVector = vector(first.coordinate, second.coordinate);
      const distanceMeters = vectorLength(connectionVector);
      if (distanceMeters > REVIEW_DISTANCE_METERS || distanceMeters === 0) continue;
      const fromAlignmentDegrees = angleDegrees(
        vector(firstNeighbor.coordinate, first.coordinate),
        connectionVector,
      );
      const toAlignmentDegrees = angleDegrees(
        vector(secondNeighbor.coordinate, second.coordinate),
        { east: -connectionVector.east, north: -connectionVector.north },
      );
      const highConfidence =
        distanceMeters <= HIGH_CONFIDENCE_DISTANCE_METERS &&
        fromAlignmentDegrees <= HIGH_CONFIDENCE_ALIGNMENT_DEGREES &&
        toAlignmentDegrees <= HIGH_CONFIDENCE_ALIGNMENT_DEGREES;
      const reviewCandidate =
        fromAlignmentDegrees <= REVIEW_ALIGNMENT_DEGREES &&
        toAlignmentDegrees <= REVIEW_ALIGNMENT_DEGREES;
      if (!highConfidence && !reviewCandidate) continue;
      rawCandidates.push(Object.freeze({
        id: `SERVICE-GAP-${rawCandidates.length + 1}`,
        fromNodeId: first.id,
        toNodeId: second.id,
        fromCoordinate: first.coordinate,
        toCoordinate: second.coordinate,
        distanceMeters,
        fromAlignmentDegrees,
        toAlignmentDegrees,
        confidence: highConfidence ? "high" : "review",
        status: "pending_manual_review" as const,
      }));
    }
  }

  rawCandidates.sort((left, right) => {
    if (left.confidence !== right.confidence) return left.confidence === "high" ? -1 : 1;
    return left.distanceMeters - right.distanceMeters;
  });
  const usedNodeIds = new Set<string>();
  const candidates = rawCandidates.filter((candidate) => {
    if (usedNodeIds.has(candidate.fromNodeId) || usedNodeIds.has(candidate.toNodeId)) return false;
    usedNodeIds.add(candidate.fromNodeId);
    usedNodeIds.add(candidate.toNodeId);
    return true;
  });

  return Object.freeze({
    authority: "validation_draft" as const,
    candidates: Object.freeze(candidates),
    report: Object.freeze({
      danglingNodeCount: dangling.length,
      highConfidenceCount: candidates.filter((candidate) => candidate.confidence === "high").length,
      reviewCount: candidates.filter((candidate) => candidate.confidence === "review").length,
      approvedCount: 0,
      rejectedCount: 0,
      pendingCount: candidates.length,
      unmatchedDanglingNodeCount: dangling.length - usedNodeIds.size,
      maximumCandidateDistanceMeters: Math.max(0, ...candidates.map((candidate) => candidate.distanceMeters)),
    }),
  });
}

function decisionKey(fromNodeId: string, toNodeId: string) {
  return [fromNodeId, toNodeId].sort().join("::");
}

/**
 * 将机场配置包中的人工核校结论应用到候选，不依赖候选生成顺序。
 * 节点坐标键比 SERVICE-GAP-1 之类的临时序号更稳定。
 */
export function applyServiceRoadGapRepairDecisions(
  proposal: ServiceRoadGapRepairProposal,
  decisions: readonly ServiceRoadGapRepairDecision[],
  topology?: ServiceRoadTopologyDraft,
): ServiceRoadGapRepairProposal {
  const decisionByEndpoints = new Map(
    decisions.map((decision) => [
      decisionKey(decision.fromNodeId, decision.toNodeId),
      decision,
    ]),
  );
  const reviewedCandidates = proposal.candidates.map((candidate) => {
    const decision = decisionByEndpoints.get(
      decisionKey(candidate.fromNodeId, candidate.toNodeId),
    );
    if (!decision) return candidate;
    return Object.freeze({
      ...candidate,
      status: decision.decision,
      reviewEvidence: decision.evidence,
      reviewNote: decision.note,
    });
  });
  const existingDecisionKeys = new Set(
    reviewedCandidates.map((candidate) =>
      decisionKey(candidate.fromNodeId, candidate.toNodeId),
    ),
  );
  const nodeById = new Map(topology?.nodes.map((node) => [node.id, node]) ?? []);
  const explicitApprovedCandidates = topology
    ? decisions.flatMap((decision, index) => {
        if (
          decision.decision !== "approved" ||
          existingDecisionKeys.has(decisionKey(decision.fromNodeId, decision.toNodeId))
        ) return [];
        const fromNode = nodeById.get(decision.fromNodeId);
        const toNode = nodeById.get(decision.toNodeId);
        if (!fromNode || !toNode) return [];
        return [Object.freeze({
          id: `SERVICE-GAP-MANUAL-${index + 1}`,
          fromNodeId: decision.fromNodeId,
          toNodeId: decision.toNodeId,
          fromCoordinate: fromNode.coordinate,
          toCoordinate: toNode.coordinate,
          distanceMeters: vectorLength(vector(fromNode.coordinate, toNode.coordinate)),
          fromAlignmentDegrees: 0,
          toAlignmentDegrees: 0,
          confidence: "review" as const,
          status: "approved" as const,
          reviewEvidence: decision.evidence,
          reviewNote: decision.note,
        })];
      })
    : [];
  const candidates = [...reviewedCandidates, ...explicitApprovedCandidates];
  const matchedDanglingNodeIds = new Set(
    candidates.flatMap((candidate) => [candidate.fromNodeId, candidate.toNodeId])
      .filter((nodeId) => nodeById.get(nodeId)?.degree === 1),
  );

  return Object.freeze({
    ...proposal,
    candidates: Object.freeze(candidates),
    report: Object.freeze({
      ...proposal.report,
      approvedCount: candidates.filter((candidate) => candidate.status === "approved").length,
      rejectedCount: candidates.filter((candidate) => candidate.status === "rejected").length,
      pendingCount: candidates.filter(
        (candidate) => candidate.status === "pending_manual_review",
      ).length,
      unmatchedDanglingNodeCount: topology
        ? Math.max(0, proposal.report.danglingNodeCount - matchedDanglingNodeIds.size)
        : proposal.report.unmatchedDanglingNodeCount,
      maximumCandidateDistanceMeters: Math.max(
        0,
        ...candidates.map((candidate) => candidate.distanceMeters),
      ),
    }),
  });
}
