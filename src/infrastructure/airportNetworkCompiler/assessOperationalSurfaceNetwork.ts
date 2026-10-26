import type { OperationalAirportNetworkDraft } from "./buildOperationalAirportNetworkDraft";
import type {
  CandidateAirportNetwork,
  CandidateNetworkEdge,
  CandidateNetworkNode,
} from "./types";
import type { SurfaceNetworkBreakReview } from "./auditSurfaceNetworkBreaks";

export type OperationalSurfaceNetworkReadiness = Readonly<{
  airportIdent: string;
  authority: "validation_draft";
  status:
    | "ready_for_shadow_validation"
    | "requires_manual_review"
    | "blocked";
  mayDriveSimulation: false;
  nodes: readonly CandidateNetworkNode[];
  edges: readonly CandidateNetworkEdge[];
  report: Readonly<{
    mainComponentCount: number;
    eligibleNodeCount: number;
    eligibleEdgeCount: number;
    excludedPureRunwayEdgeCount: number;
    runwayCrossingEdgeCount: number;
    connectedAnchorCount: number;
    totalAnchorCount: number;
    anchorCoverage: number;
    suspectedBreakCount: number;
    detectedBreakCount: number;
    approvedConnectionCount: number;
    confirmedTerminalCount: number;
    holdingPointCount: number;
    reviewReasons: readonly string[];
  }>;
}>;

/**
 * 从OSM候选图中分离飞机场面道路并形成核校草案。
 * 纯跑道边不会进入普通滑行草案；带跑道交叉属性的边保留但必须另行放行。
 * 本函数永远不会直接赋予运行权威，人工/影子验证完成前不得驱动仿真。
 */
export function assessOperationalSurfaceNetwork(
  network: CandidateAirportNetwork,
  operationalDraft: OperationalAirportNetworkDraft,
  breakReview: SurfaceNetworkBreakReview | null = null,
): OperationalSurfaceNetworkReadiness {
  if (network.airportIdent !== operationalDraft.airportIdent) {
    throw new Error("候选路网与运行连接草案不属于同一机场。");
  }
  const mainComponents = network.report.components.filter(
    (component) => component.classification === "main_network",
  );
  const mainNodeIds = new Set(
    mainComponents.flatMap((component) => component.nodeIds),
  );
  if (breakReview && breakReview.airportIdent !== network.airportIdent) {
    throw new Error("断点核校结论与候选路网不属于同一机场。");
  }
  const reviewedEdges = breakReview?.approvedEdges ?? [];
  const eligibleEdges = [...network.edges, ...reviewedEdges].filter((edge) => {
    if (
      !mainNodeIds.has(edge.fromNodeId) ||
      !mainNodeIds.has(edge.toNodeId)
    ) {
      return false;
    }
    return edge.kinds.some(
      (kind) =>
        kind === "taxiway" ||
        kind === "taxilane" ||
        kind === "parking_position",
    );
  });
  const eligibleNodeIds = new Set(
    eligibleEdges.flatMap((edge) => [edge.fromNodeId, edge.toNodeId]),
  );
  const eligibleNodes = network.nodes.filter((node) =>
    eligibleNodeIds.has(node.id),
  );
  const pureRunwayEdges = network.edges.filter(
    (edge) => edge.kinds.length === 1 && edge.kinds[0] === "runway",
  );
  const runwayCrossingEdgeCount = eligibleEdges.filter((edge) =>
    edge.kinds.includes("runway"),
  ).length;
  const detectedBreakCount =
    network.report.danglingNodes.suspectedBreakNodeIds.length;
  const suspectedBreakCount = breakReview
    ? breakReview.report.unresolvedCount
    : detectedBreakCount;
  const reviewReasons: string[] = [];
  if (operationalDraft.report.coverage < 1) {
    reviewReasons.push(
      `${operationalDraft.report.disconnectedAnchorCount}个运行锚点尚未连接。`,
    );
  }
  if (suspectedBreakCount > 0) {
    reviewReasons.push(`${suspectedBreakCount}个疑似路网断点需要人工核校。`);
  }
  if (runwayCrossingEdgeCount > 0) {
    reviewReasons.push(
      `${runwayCrossingEdgeCount}条滑行边涉及跑道连接，运行时必须取得跑道放行。`,
    );
  }
  if (!network.serviceRoadNetwork?.roads.length) {
    reviewReasons.push("尚无独立保障车辆道路，本草案仅适用于飞机滑行核校。");
  }

  const blocked =
    mainComponents.length === 0 ||
    eligibleEdges.length === 0 ||
    operationalDraft.report.coverage < 0.95;
  const status = blocked
    ? "blocked"
    : suspectedBreakCount > 0 || operationalDraft.report.coverage < 1
      ? "requires_manual_review"
      : "ready_for_shadow_validation";

  return Object.freeze({
    airportIdent: network.airportIdent,
    authority: "validation_draft" as const,
    status,
    mayDriveSimulation: false as const,
    nodes: Object.freeze(eligibleNodes),
    edges: Object.freeze(eligibleEdges),
    report: Object.freeze({
      mainComponentCount: mainComponents.length,
      eligibleNodeCount: eligibleNodes.length,
      eligibleEdgeCount: eligibleEdges.length,
      excludedPureRunwayEdgeCount: pureRunwayEdges.length,
      runwayCrossingEdgeCount,
      connectedAnchorCount: operationalDraft.report.connectedAnchorCount,
      totalAnchorCount: operationalDraft.report.totalAnchorCount,
      anchorCoverage: operationalDraft.report.coverage,
      suspectedBreakCount,
      detectedBreakCount,
      approvedConnectionCount:
        breakReview?.report.approvedConnectionCount ?? 0,
      confirmedTerminalCount:
        breakReview?.report.confirmedTerminalCount ?? 0,
      holdingPointCount: network.operationalPoints.filter(
        (point) => point.kind === "holding_position",
      ).length,
      reviewReasons: Object.freeze(reviewReasons),
    }),
  });
}
