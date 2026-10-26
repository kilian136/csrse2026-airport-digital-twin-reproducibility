import type { RunwayHoldingPointManualApproval } from "../../infrastructure/airportNetworkCompiler";

const pointsByRunway = Object.freeze({
  "16L/34R": Object.freeze([
    "ZSPD-OSM-P-11747025227", "ZSPD-OSM-P-11747025229", "ZSPD-OSM-P-11747025232",
    "ZSPD-OSM-P-11747025233", "ZSPD-OSM-P-11747067832", "ZSPD-OSM-P-11747067835",
    "ZSPD-OSM-P-11747067836", "ZSPD-OSM-P-11747067844", "ZSPD-OSM-P-11747067845",
    "ZSPD-OSM-P-11747075395",
  ]),
  "16R/34L": Object.freeze([
    "ZSPD-OSM-P-3325444346", "ZSPD-OSM-P-3325444485", "ZSPD-OSM-P-3751929672",
    "ZSPD-OSM-P-3751929673", "ZSPD-OSM-P-3751929674", "ZSPD-OSM-P-3758110887",
    "ZSPD-OSM-P-3758110888", "ZSPD-OSM-P-3758110889", "ZSPD-OSM-P-3758110890",
    "ZSPD-OSM-P-3758110891", "ZSPD-OSM-P-3758110892", "ZSPD-OSM-P-3758110893",
    "ZSPD-OSM-P-3758110894", "ZSPD-OSM-P-3758110895", "ZSPD-OSM-P-11747008035",
    "ZSPD-OSM-P-11747025228", "ZSPD-OSM-P-11747025230", "ZSPD-OSM-P-11747025231",
    "ZSPD-OSM-P-11747067831", "ZSPD-OSM-P-11747067833", "ZSPD-OSM-P-11747067834",
    "ZSPD-OSM-P-11747067837", "ZSPD-OSM-P-11747067838", "ZSPD-OSM-P-11747067839",
    "ZSPD-OSM-P-11747067840", "ZSPD-OSM-P-11747067841", "ZSPD-OSM-P-11747067842",
    "ZSPD-OSM-P-11747067843",
  ]),
  "17L/35R": Object.freeze([
    "ZSPD-OSM-P-1036600312", "ZSPD-OSM-P-1036600330", "ZSPD-OSM-P-11726796290",
    "ZSPD-OSM-P-11733544461", "ZSPD-OSM-P-11733544462", "ZSPD-OSM-P-11733544463",
    "ZSPD-OSM-P-11733544464", "ZSPD-OSM-P-11733544465", "ZSPD-OSM-P-11733544466",
    "ZSPD-OSM-P-11733544467", "ZSPD-OSM-P-11733544468", "ZSPD-OSM-P-11733564863",
  ]),
  "17R/35L": Object.freeze([
    "ZSPD-OSM-P-3325438917", "ZSPD-OSM-P-3325443327", "ZSPD-OSM-P-3325443995",
    "ZSPD-OSM-P-3334735210", "ZSPD-OSM-P-3334735831", "ZSPD-OSM-P-8034607526",
    "ZSPD-OSM-P-8034607555", "ZSPD-OSM-P-11733544454", "ZSPD-OSM-P-11733544455",
    "ZSPD-OSM-P-11733544456", "ZSPD-OSM-P-11733544457", "ZSPD-OSM-P-11733544458",
    "ZSPD-OSM-P-11733544459", "ZSPD-OSM-P-11733544460", "ZSPD-OSM-P-11733555802",
    "ZSPD-OSM-P-11733555803", "ZSPD-OSM-P-11733555804",
  ]),
});

/** 67个OSM等待点按跑道中心线与滑行道拓扑复核；最近与次近跑道最小间隔203米。 */
export const pudongRunwayHoldingPointApproval = Object.freeze({
  airportIdent: "ZSPD",
  revision: "ZSPD-RUNWAY-HOLDING-POINTS-2026-10-10-R1",
  reviewedAt: "2026-10-10",
  approvedBy: "OSM跑道中心线、等待点和滑行道拓扑分组复核",
  expectedFingerprint: "fnv1a32:99dbff73",
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
    "67个等待点已全量覆盖，未使用跨跑道最近点运行时猜测。",
    "15/33当前快照没有OSM holding_position点，不伪造等待点。",
    "方向表示等待点可服务的跑道方向，实际进入跑道仍需塔台许可并关闭停止排灯。",
  ]),
} satisfies RunwayHoldingPointManualApproval);
