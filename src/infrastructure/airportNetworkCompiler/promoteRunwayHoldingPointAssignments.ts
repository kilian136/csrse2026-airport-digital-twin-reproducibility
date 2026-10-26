import type {
  CandidateRunwayCatalog,
  CandidateRunwayHoldingPointAssignment,
} from "./deriveCandidateRunwayCatalog";

export type RunwayHoldingPointManualAssignment = Readonly<{
  holdingPointId: string;
  runwayRef: string;
  permittedDesignators: readonly string[];
}>;

export type RunwayHoldingPointManualApproval = Readonly<{
  airportIdent: string;
  revision: string;
  reviewedAt: string;
  approvedBy: string;
  expectedFingerprint: string;
  assignments: readonly RunwayHoldingPointManualAssignment[];
  notes: readonly string[];
}>;

function fnv1a32(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/** 锁定跑道编号、端点方向和等待点全集；任一OSM快照变化都会使批准失效。 */
export function createRunwayHoldingPointFingerprint(
  catalog: CandidateRunwayCatalog,
) {
  const signature = JSON.stringify({
    airportIdent: catalog.airportIdent,
    runways: [...catalog.runways]
      .sort((left, right) => left.ref.localeCompare(right.ref))
      .map((runway) => ({
        ref: runway.ref,
        ends: [...runway.ends]
          .sort((left, right) => left.designator.localeCompare(right.designator))
          .map((end) => ({ designator: end.designator, nodeId: end.nodeId })),
      })),
    holdingPointIds: [...catalog.unassignedHoldingPointIds].sort(),
  });
  return fnv1a32(signature);
}

/**
 * 把人工复核后的等待点归属安装到跑道目录。等待点与跑道必须一一覆盖；
 * “方向”表示它可服务的跑道方向，实际放行仍必须经过塔台许可与停止排灯。
 */
export function promoteRunwayHoldingPointAssignments(
  catalog: CandidateRunwayCatalog,
  approval: RunwayHoldingPointManualApproval,
): CandidateRunwayCatalog {
  if (catalog.airportIdent !== approval.airportIdent) {
    throw new Error("跑道目录与等待点批准记录不属于同一机场。");
  }
  if (
    createRunwayHoldingPointFingerprint(catalog) !==
    approval.expectedFingerprint
  ) {
    throw new Error("跑道或等待点指纹已变化，原等待点归属批准记录失效。");
  }

  const expectedPointIds = new Set(catalog.unassignedHoldingPointIds);
  const assignedPointIds = new Set<string>();
  const runwayByRef = new Map(catalog.runways.map((runway) => [runway.ref, runway]));
  const assignments = approval.assignments.map(
    (assignment): CandidateRunwayHoldingPointAssignment => {
      if (!expectedPointIds.has(assignment.holdingPointId)) {
        throw new Error(`等待点${assignment.holdingPointId}不在当前候选目录中。`);
      }
      if (assignedPointIds.has(assignment.holdingPointId)) {
        throw new Error(`等待点${assignment.holdingPointId}存在重复归属。`);
      }
      const runway = runwayByRef.get(assignment.runwayRef);
      if (!runway || runway.status !== "endpoints_resolved") {
        throw new Error(`等待点${assignment.holdingPointId}指向未识别的跑道。`);
      }
      const actualDesignators = new Set(runway.ends.map((end) => end.designator));
      if (
        assignment.permittedDesignators.length === 0 ||
        assignment.permittedDesignators.some(
          (designator) => !actualDesignators.has(designator),
        )
      ) {
        throw new Error(`等待点${assignment.holdingPointId}的跑道方向无效。`);
      }
      assignedPointIds.add(assignment.holdingPointId);
      return Object.freeze({
        holdingPointId: assignment.holdingPointId,
        runwayRef: assignment.runwayRef,
        permittedDesignators: Object.freeze([...assignment.permittedDesignators]),
      });
    },
  );
  if (assignedPointIds.size !== expectedPointIds.size) {
    const missing = [...expectedPointIds].filter((id) => !assignedPointIds.has(id));
    throw new Error(`等待点归属未全量覆盖：${missing.join("、")}`);
  }

  const runways = catalog.runways.map((runway) => {
    const holdingPointIds = assignments
      .filter((assignment) => assignment.runwayRef === runway.ref)
      .map((assignment) => assignment.holdingPointId);
    return Object.freeze({
      ...runway,
      holdingPointAssignment:
        holdingPointIds.length > 0
          ? "approved" as const
          : runway.holdingPointAssignment,
      holdingPointIds: Object.freeze(holdingPointIds),
    });
  });
  return Object.freeze({
    ...catalog,
    authority: "approved_operational" as const,
    mayDriveSimulation: true,
    runways: Object.freeze(runways),
    holdingPointAssignments: Object.freeze(assignments),
    unassignedHoldingPointIds: Object.freeze([]),
    report: Object.freeze({
      ...catalog.report,
      assignedHoldingPointCount: assignments.length,
    }),
  });
}
