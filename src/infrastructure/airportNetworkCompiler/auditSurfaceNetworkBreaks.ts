import type {
  CandidateAirportNetwork,
  CandidateNetworkEdge,
  CandidateNetworkKind,
} from "./types";

export type SurfaceNetworkBreakAssessment =
  | "probable_unshared_intersection"
  | "probable_runway_connection"
  | "probable_short_gap"
  | "likely_normal_endpoint"
  | "needs_visual_review";

export type SurfaceNetworkBreakCandidate = Readonly<{
  nodeId: string;
  incidentEdgeId: string;
  incidentKinds: readonly CandidateNetworkKind[];
  incidentRefs: readonly string[];
  nearestEdgeId: string | null;
  nearestKinds: readonly CandidateNetworkKind[];
  nearestRefs: readonly string[];
  nearestDistanceMeters: number | null;
  assessment: SurfaceNetworkBreakAssessment;
  assessmentLabel: string;
  rationale: string;
  requiresManualReview: true;
}>;

export type SurfaceNetworkBreakAudit = Readonly<{
  airportIdent: string;
  authority: "validation_draft";
  candidates: readonly SurfaceNetworkBreakCandidate[];
  report: Readonly<{
    totalCount: number;
    assessmentCounts: Readonly<Record<SurfaceNetworkBreakAssessment, number>>;
  }>;
}>;

export type SurfaceNetworkBreakDecision = Readonly<{
  nodeId: string;
  decision: "connect" | "terminal";
  evidence: "user_visual_review" | "survey" | "official_chart";
  note: string;
}>;

export type SurfaceNetworkBreakReview = Readonly<{
  airportIdent: string;
  authority: "human_reviewed_draft";
  approvedEdges: readonly CandidateNetworkEdge[];
  confirmedTerminalNodeIds: readonly string[];
  unresolvedNodeIds: readonly string[];
  report: Readonly<{
    detectedCount: number;
    reviewedCount: number;
    approvedConnectionCount: number;
    confirmedTerminalCount: number;
    unresolvedCount: number;
  }>;
}>;

const ASSESSMENT_LABELS: Readonly<Record<SurfaceNetworkBreakAssessment, string>> = {
  probable_unshared_intersection: "疑似未共享交点",
  probable_runway_connection: "疑似跑道连接点",
  probable_short_gap: "疑似短距离缺口",
  likely_normal_endpoint: "可能为正常终点",
  needs_visual_review: "需要目视核校",
};

function distanceToEdge(
  point: Readonly<{ eastMeters: number; northMeters: number }>,
  start: Readonly<{ eastMeters: number; northMeters: number }>,
  end: Readonly<{ eastMeters: number; northMeters: number }>,
): Readonly<{ distanceMeters: number; projection: number }> {
  const eastDelta = end.eastMeters - start.eastMeters;
  const northDelta = end.northMeters - start.northMeters;
  const squaredLength = eastDelta ** 2 + northDelta ** 2;
  const rawProjection = squaredLength === 0
    ? 0
    : (
        (point.eastMeters - start.eastMeters) * eastDelta +
        (point.northMeters - start.northMeters) * northDelta
      ) / squaredLength;
  const projection = Math.max(0, Math.min(1, rawProjection));
  const projectedEast = start.eastMeters + projection * eastDelta;
  const projectedNorth = start.northMeters + projection * northDelta;
  return {
    distanceMeters: Math.hypot(
      point.eastMeters - projectedEast,
      point.northMeters - projectedNorth,
    ),
    projection,
  };
}

function classifyCandidate(
  incidentEdge: CandidateNetworkEdge,
  nearestEdge: CandidateNetworkEdge | null,
  nearestDistanceMeters: number | null,
  projection: number | null,
): Readonly<{
  assessment: SurfaceNetworkBreakAssessment;
  rationale: string;
}> {
  if (!nearestEdge || nearestDistanceMeters === null) {
    return {
      assessment: "needs_visual_review",
      rationale: "附近未找到可直接比较的其他滑行边，需要结合卫星图目视判断。",
    };
  }
  if (nearestDistanceMeters <= 3 && nearestEdge.kinds.includes("runway")) {
    return {
      assessment: "probable_runway_connection",
      rationale: `端点距跑道边约${nearestDistanceMeters.toFixed(1)}米，可能是未共享节点的跑道连接；必须人工确认并保留跑道放行约束。`,
    };
  }
  if (
    nearestDistanceMeters <= 3 &&
    projection !== null &&
    projection > 0.05 &&
    projection < 0.95
  ) {
    return {
      assessment: "probable_unshared_intersection",
      rationale: `端点距另一条道路中段约${nearestDistanceMeters.toFixed(1)}米，疑似几何相交但未共享OSM节点。`,
    };
  }
  if (nearestDistanceMeters <= 20) {
    return {
      assessment: "probable_short_gap",
      rationale: `端点距另一条道路约${nearestDistanceMeters.toFixed(1)}米，属于可疑短缺口，需核对卫星图后决定是否连接。`,
    };
  }
  if (
    incidentEdge.refs.some((ref) => /^L0\d/i.test(ref)) &&
    nearestEdge.kinds.includes("parking_position") &&
    nearestDistanceMeters <= 80
  ) {
    return {
      assessment: "likely_normal_endpoint",
      rationale: `端点靠近停机位引导线且相距约${nearestDistanceMeters.toFixed(1)}米，初步判断可能是机坪滑行线正常终点。`,
    };
  }
  return {
    assessment: "needs_visual_review",
    rationale: `最近其他道路仍相距约${nearestDistanceMeters.toFixed(1)}米，不能仅凭几何关系判定是否应连接。`,
  };
}

/**
 * 对编译器发现的内部度为1节点做只读初筛。结果仅用于减少人工核校范围，
 * 不会改变候选图、自动补线或取得运行权威。
 */
export function auditSurfaceNetworkBreaks(
  network: CandidateAirportNetwork,
): SurfaceNetworkBreakAudit {
  const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
  const edgesByNodeId = new Map<string, CandidateNetworkEdge[]>();
  network.edges.forEach((edge) => {
    [edge.fromNodeId, edge.toNodeId].forEach((nodeId) => {
      const incidentEdges = edgesByNodeId.get(nodeId) ?? [];
      incidentEdges.push(edge);
      edgesByNodeId.set(nodeId, incidentEdges);
    });
  });

  const candidates = network.report.danglingNodes.suspectedBreakNodeIds.flatMap(
    (nodeId): SurfaceNetworkBreakCandidate[] => {
      const node = nodeById.get(nodeId);
      const incidentEdge = edgesByNodeId.get(nodeId)?.[0];
      if (!node || !incidentEdge) return [];
      const incidentWayIds = new Set(incidentEdge.sourceWayIds);
      const nearest = network.edges
        .filter(
          (edge) =>
            edge.id !== incidentEdge.id &&
            !edge.sourceWayIds.some((wayId) => incidentWayIds.has(wayId)),
        )
        .flatMap((edge) => {
          const start = nodeById.get(edge.fromNodeId);
          const end = nodeById.get(edge.toNodeId);
          if (!start || !end) return [];
          return [{
            edge,
            ...distanceToEdge(
              node.coordinate.local,
              start.coordinate.local,
              end.coordinate.local,
            ),
          }];
        })
        .sort((left, right) => left.distanceMeters - right.distanceMeters)[0];
      const classification = classifyCandidate(
        incidentEdge,
        nearest?.edge ?? null,
        nearest?.distanceMeters ?? null,
        nearest?.projection ?? null,
      );
      return [{
        nodeId,
        incidentEdgeId: incidentEdge.id,
        incidentKinds: incidentEdge.kinds,
        incidentRefs: incidentEdge.refs,
        nearestEdgeId: nearest?.edge.id ?? null,
        nearestKinds: nearest?.edge.kinds ?? [],
        nearestRefs: nearest?.edge.refs ?? [],
        nearestDistanceMeters: nearest?.distanceMeters ?? null,
        assessment: classification.assessment,
        assessmentLabel: ASSESSMENT_LABELS[classification.assessment],
        rationale: classification.rationale,
        requiresManualReview: true,
      }];
    },
  );

  const assessmentCounts: Record<SurfaceNetworkBreakAssessment, number> = {
    probable_unshared_intersection: 0,
    probable_runway_connection: 0,
    probable_short_gap: 0,
    likely_normal_endpoint: 0,
    needs_visual_review: 0,
  };
  candidates.forEach((candidate) => {
    assessmentCounts[candidate.assessment] += 1;
  });

  return Object.freeze({
    airportIdent: network.airportIdent,
    authority: "validation_draft" as const,
    candidates: Object.freeze(candidates),
    report: Object.freeze({
      totalCount: candidates.length,
      assessmentCounts: Object.freeze(assessmentCounts),
    }),
  });
}

/** 把机场配置包中的人工结论应用为只读核校草案，不修改原始OSM快照。 */
export function applySurfaceNetworkBreakDecisions(
  network: CandidateAirportNetwork,
  decisions: readonly SurfaceNetworkBreakDecision[],
): SurfaceNetworkBreakReview {
  const audit = auditSurfaceNetworkBreaks(network);
  const candidateByNodeId = new Map(
    audit.candidates.map((candidate) => [candidate.nodeId, candidate]),
  );
  const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(network.edges.map((edge) => [edge.id, edge]));
  const decisionByNodeId = new Map<string, SurfaceNetworkBreakDecision>();
  decisions.forEach((decision) => {
    if (!candidateByNodeId.has(decision.nodeId)) {
      throw new Error(`断点核校结论引用了不存在的候选节点：${decision.nodeId}`);
    }
    if (decisionByNodeId.has(decision.nodeId)) {
      throw new Error(`断点核校结论重复：${decision.nodeId}`);
    }
    decisionByNodeId.set(decision.nodeId, decision);
  });

  const approvedEdges: CandidateNetworkEdge[] = [];
  const confirmedTerminalNodeIds: string[] = [];
  audit.candidates.forEach((candidate) => {
    const decision = decisionByNodeId.get(candidate.nodeId);
    if (!decision) return;
    if (decision.decision === "terminal") {
      confirmedTerminalNodeIds.push(candidate.nodeId);
      return;
    }
    const sourceNode = nodeById.get(candidate.nodeId);
    const incidentEdge = edgeById.get(candidate.incidentEdgeId);
    const nearestEdge = candidate.nearestEdgeId
      ? edgeById.get(candidate.nearestEdgeId)
      : null;
    if (!sourceNode || !incidentEdge || !nearestEdge) {
      throw new Error(`批准连接缺少可用的邻近道路：${candidate.nodeId}`);
    }
    const targetNodes = [
      nodeById.get(nearestEdge.fromNodeId),
      nodeById.get(nearestEdge.toNodeId),
    ].filter((node): node is NonNullable<typeof node> => Boolean(node));
    const targetNode = targetNodes.sort(
      (left, right) =>
        Math.hypot(
          left.coordinate.local.eastMeters - sourceNode.coordinate.local.eastMeters,
          left.coordinate.local.northMeters - sourceNode.coordinate.local.northMeters,
        ) -
        Math.hypot(
          right.coordinate.local.eastMeters - sourceNode.coordinate.local.eastMeters,
          right.coordinate.local.northMeters - sourceNode.coordinate.local.northMeters,
        ),
    )[0];
    if (!targetNode) {
      throw new Error(`批准连接无法解析目标节点：${candidate.nodeId}`);
    }
    const kinds = [...new Set([...incidentEdge.kinds, ...nearestEdge.kinds])];
    const refs = [...new Set([...incidentEdge.refs, ...nearestEdge.refs])];
    const sourceWayIds = [
      ...new Set([...incidentEdge.sourceWayIds, ...nearestEdge.sourceWayIds]),
    ];
    approvedEdges.push(Object.freeze({
      id: `${network.airportIdent}-REVIEWED-CONNECTION-${candidate.nodeId}`,
      fromNodeId: candidate.nodeId,
      toNodeId: targetNode.id,
      primaryKind: incidentEdge.primaryKind,
      kinds: Object.freeze(kinds),
      refs: Object.freeze(refs),
      sourceWayIds: Object.freeze(sourceWayIds),
      lengthMeters: Math.hypot(
        targetNode.coordinate.local.eastMeters - sourceNode.coordinate.local.eastMeters,
        targetNode.coordinate.local.northMeters - sourceNode.coordinate.local.northMeters,
      ),
      bidirectional: true,
    }));
  });

  const unresolvedNodeIds = audit.candidates
    .map((candidate) => candidate.nodeId)
    .filter((nodeId) => !decisionByNodeId.has(nodeId));
  return Object.freeze({
    airportIdent: network.airportIdent,
    authority: "human_reviewed_draft" as const,
    approvedEdges: Object.freeze(approvedEdges),
    confirmedTerminalNodeIds: Object.freeze(confirmedTerminalNodeIds),
    unresolvedNodeIds: Object.freeze(unresolvedNodeIds),
    report: Object.freeze({
      detectedCount: audit.candidates.length,
      reviewedCount: decisionByNodeId.size,
      approvedConnectionCount: approvedEdges.length,
      confirmedTerminalCount: confirmedTerminalNodeIds.length,
      unresolvedCount: unresolvedNodeIds.length,
    }),
  });
}
