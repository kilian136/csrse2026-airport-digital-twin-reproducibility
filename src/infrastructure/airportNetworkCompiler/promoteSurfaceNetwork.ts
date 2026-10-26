import type { OperationalAirportNetworkDraft } from "./buildOperationalAirportNetworkDraft";
import type { OperationalSurfaceNetworkReadiness } from "./assessOperationalSurfaceNetwork";
import {
  buildRepresentativeSurfaceRouteSamples,
  resolveSurfaceRouteSourceGroup,
  type SurfaceRouteShadow,
  type SurfaceRouteShadowAudit,
} from "./validateSurfaceRouteShadows";
import type { CandidateNetworkEdge, CandidateNetworkNode } from "./types";

export type SurfaceRouteApprovalSample = Readonly<{
  label: string;
  sourceName: string;
  destinationName: string;
  distanceMeters: number;
  result: "passed";
}>;

export type SurfaceRouteManualApproval = Readonly<{
  airportIdent: string;
  revision: string;
  reviewedAt: string;
  approvedBy: string;
  scope: Readonly<{
    sourceGroups: readonly string[];
    unreviewedSources: "candidate_only";
  }>;
  samples: readonly SurfaceRouteApprovalSample[];
}>;

export type ControlledOperationalSurfaceNetwork = Readonly<{
  airportIdent: string;
  authority: "controlled_operational";
  status: "approved_for_controlled_simulation";
  mayDriveSimulation: true;
  nodes: readonly CandidateNetworkNode[];
  edges: readonly CandidateNetworkEdge[];
  routes: readonly SurfaceRouteShadow[];
  approval: SurfaceRouteManualApproval;
  approvedSampleRouteIds: readonly string[];
  safeguards: Readonly<{
    pureRunwayEdgesExcluded: true;
    stopAtHoldingPoint: true;
    runwayControlledEdgeRequiresClearance: true;
  }>;
}>;

/**
 * 将已完成断点、算法和人工代表路线核校的草案提升为受控运行路网。
 * 配置或路网发生变化时，样本签名不再匹配，提升会自动失败。
 */
export function promoteSurfaceNetworkForControlledSimulation(
  readiness: OperationalSurfaceNetworkReadiness,
  shadowAudit: SurfaceRouteShadowAudit,
  operationalDraft: OperationalAirportNetworkDraft,
  approval: SurfaceRouteManualApproval,
): ControlledOperationalSurfaceNetwork {
  if (
    readiness.airportIdent !== shadowAudit.airportIdent ||
    readiness.airportIdent !== operationalDraft.airportIdent ||
    readiness.airportIdent !== approval.airportIdent
  ) {
    throw new Error("滑行路网、影子验证和人工核校结论不属于同一机场。");
  }
  if (readiness.status !== "ready_for_shadow_validation") {
    throw new Error("滑行路网尚未完成断点核校，不能取得运行权威。");
  }
  if (
    shadowAudit.status !== "ready_for_manual_scenario_test" ||
    shadowAudit.report.unreachableRouteCount > 0 ||
    shadowAudit.report.routesUsingRunwayControlledEdge > 0
  ) {
    throw new Error("影子路线尚未满足运行安全条件。");
  }

  const samples = buildRepresentativeSurfaceRouteSamples(
    shadowAudit,
    operationalDraft,
    { sourceGroups: approval.scope.sourceGroups },
  );
  if (samples.length === 0 || approval.samples.length !== samples.length) {
    throw new Error("人工核校样本数量与当前代表路线不一致。");
  }
  const approvalByLabel = new Map(
    approval.samples.map((sample) => [sample.label, sample]),
  );
  samples.forEach((sample) => {
    const reviewed = approvalByLabel.get(sample.label);
    if (
      !reviewed ||
      reviewed.result !== "passed" ||
      reviewed.sourceName !== sample.sourceName ||
      reviewed.destinationName !== sample.destinationName ||
      Math.abs(reviewed.distanceMeters - Math.round(sample.distanceMeters)) > 1
    ) {
      throw new Error(`代表路线${sample.label}的人工核校签名已失效。`);
    }
  });

  const anchorById = new Map(
    operationalDraft.anchors.map((anchor) => [anchor.id, anchor]),
  );
  const approvedSourceGroups = new Set(approval.scope.sourceGroups);
  const approvedRoutes = shadowAudit.routes.filter((route) => {
    const sourceName =
      anchorById.get(route.sourceAnchorId)?.name ?? route.sourceAnchorId;
    return approvedSourceGroups.has(resolveSurfaceRouteSourceGroup(sourceName));
  });

  return Object.freeze({
    airportIdent: readiness.airportIdent,
    authority: "controlled_operational" as const,
    status: "approved_for_controlled_simulation" as const,
    mayDriveSimulation: true as const,
    nodes: readiness.nodes,
    edges: readiness.edges,
    routes: Object.freeze(approvedRoutes),
    approval,
    approvedSampleRouteIds: Object.freeze(
      samples.map((sample) => sample.routeId),
    ),
    safeguards: Object.freeze({
      pureRunwayEdgesExcluded: true as const,
      stopAtHoldingPoint: true as const,
      runwayControlledEdgeRequiresClearance: true as const,
    }),
  });
}
