import type { SurfaceNetworkBreakDecision } from "../../infrastructure/airportNetworkCompiler";

/**
 * 浦东滑行路网内部端点人工核校结论。
 * 两处几何连续但OSM未共享节点的道路批准连接，其余七处确认为道路终点。
 */
export const pudongSurfaceBreakDecisions = Object.freeze([
  Object.freeze({
    nodeId: "ZSPD-OSM-N-3018184977-1211594204",
    decision: "connect",
    evidence: "user_visual_review",
    note: "人工核校确认可连接至邻近H滑行道。",
  }),
  Object.freeze({
    nodeId: "ZSPD-OSM-N-3018443261-1211365166",
    decision: "connect",
    evidence: "user_visual_review",
    note: "人工核校确认可连接；该连接涉及跑道边，仍需跑道放行约束。",
  }),
  ...[
    "ZSPD-OSM-N-3017999627-1211486866",
    "ZSPD-OSM-N-3017977760-1211545811",
    "ZSPD-OSM-N-3018485220-1211092941",
    "ZSPD-OSM-N-3018067006-1211664194",
    "ZSPD-OSM-N-3018313911-1211278566",
    "ZSPD-OSM-N-3018083480-1211139223",
    "ZSPD-OSM-N-3018064630-1211135016",
  ].map((nodeId) => Object.freeze({
    nodeId,
    decision: "terminal" as const,
    evidence: "user_visual_review" as const,
    note: "人工核校确认为道路终点，不创建连接。",
  })),
] satisfies readonly SurfaceNetworkBreakDecision[]);
