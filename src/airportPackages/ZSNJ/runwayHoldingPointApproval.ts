import type { RunwayHoldingPointManualApproval } from "../../infrastructure/airportNetworkCompiler";

const pointsByRunway = Object.freeze({
  "06/24": Object.freeze([
    "ZSNJ-OSM-P-13820778490",
    "ZSNJ-OSM-P-13820778491",
    "ZSNJ-OSM-P-13820790106",
    "ZSNJ-OSM-P-13820790107",
    "ZSNJ-OSM-P-13820790108",
    "ZSNJ-OSM-P-13820790109",
    "ZSNJ-OSM-P-13820790110",
    "ZSNJ-OSM-P-13820790111",
    "ZSNJ-OSM-P-13820790112",
  ]),
  "07/25": Object.freeze([
    "ZSNJ-OSM-P-4615450607",
    "ZSNJ-OSM-P-7984737714",
    "ZSNJ-OSM-P-13820778456",
  ]),
});

/**
 * 12个OSM等待点按WGS84跑道中心线和相邻滑行道拓扑全量核校。
 * 方向保持双向可服务，实际运行方向仍由当次塔台许可决定。
 */
export const nanjingRunwayHoldingPointApproval = Object.freeze({
  airportIdent: "ZSNJ",
  revision: "ZSNJ-RUNWAY-HOLDING-POINTS-2026-10-18-R1",
  reviewedAt: "2026-10-18",
  approvedBy: "WGS84跑道中心线、OSM等待点与相邻滑行道拓扑核校",
  expectedFingerprint: "fnv1a32:903c3ac0",
  assignments: Object.freeze(
    Object.entries(pointsByRunway).flatMap(([runwayRef, holdingPointIds]) => {
      const permittedDesignators = Object.freeze(runwayRef.split("/"));
      return holdingPointIds.map((holdingPointId) => Object.freeze({
        holdingPointId,
        runwayRef,
        permittedDesignators,
      }));
    }),
  ),
  notes: Object.freeze([
    "12个OSM等待点已全量覆盖：06/24跑道9个，07/25跑道3个。",
    "每个等待点与另一条跑道的距离差均超过1.5公里，未发现跨跑道归属歧义。",
    "等待点可服务所属跑道的两个方向；实际进入跑道仍需塔台许可并关闭停止排灯。",
    "本记录与机位连接、代表路线批准签名共同生效，任何指纹变化都会安全降级。",
  ]),
} satisfies RunwayHoldingPointManualApproval);
