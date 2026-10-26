import type { SurfaceNetworkBreakDecision } from "../../infrastructure/airportNetworkCompiler";

/**
 * 南京候选飞机滑行路网内部端点人工核校结论。
 * 用户于2026-10-18以修正坐标确认两处短缺口可以接入邻近路段；
 * 其余候选继续保持未决，不自动判定为道路终点。
 */
export const nanjingSurfaceBreakDecisions = Object.freeze([
  Object.freeze({
    nodeId: "ZSNJ-OSM-N-2988620927-1217336301",
    decision: "connect" as const,
    evidence: "user_visual_review" as const,
    note: "修正核校坐标31.7336218, 118.8621240；确认可接入邻近路段。",
  }),
  Object.freeze({
    nodeId: "ZSNJ-OSM-N-2988625155-1217330682",
    decision: "connect" as const,
    evidence: "user_visual_review" as const,
    note: "修正核校坐标31.7330566, 118.8625212；确认可接入邻近路段。",
  }),
  ...[
    "ZSNJ-OSM-N-2988781820-1217441949",
    "ZSNJ-OSM-N-2988736762-1217346716",
    "ZSNJ-OSM-N-2988682121-1217316157",
    "ZSNJ-OSM-N-2988703765-1217416785",
    "ZSNJ-OSM-N-2988816694-1217488639",
  ].map((nodeId) => Object.freeze({
    nodeId,
    decision: "terminal" as const,
    evidence: "user_visual_review" as const,
    note: "人工核校确认为正常道路终点，不创建连接。",
  })),
]) satisfies readonly SurfaceNetworkBreakDecision[];
