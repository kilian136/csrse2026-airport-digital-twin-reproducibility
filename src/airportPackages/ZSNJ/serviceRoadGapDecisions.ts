import type { ServiceRoadGapRepairDecision } from "../../infrastructure/airportNetworkCompiler";

/** 南京东北侧保障道路17.45米OSM分段缺口，按用户确认接通。 */
export const nanjingServiceRoadGapDecisions = Object.freeze([
  Object.freeze({
    fromNodeId: "ZSNJ-SERVICE-N-118.8795386,31.7539292",
    toNodeId: "ZSNJ-SERVICE-N-118.8796915,31.7540169",
    decision: "approved",
    evidence: "user_confirmation",
    note: "用户于2026-10-19确认连接该保障道路候选缝隙；仅批准此17.45米端点对，不放宽全机场补缝阈值。",
  }),
  Object.freeze({
    fromNodeId: "ZSNJ-SERVICE-N-118.8481239,31.7298116",
    toNodeId: "ZSNJ-SERVICE-N-118.8472358,31.7310157",
    decision: "approved",
    evidence: "user_confirmation",
    note: "用户于2026-10-19确认南京航油驻点至西侧维修机位保障道路在此连续；仅批准该157.82米端点对，不放宽全机场补缝阈值。",
  }),
  Object.freeze({
    fromNodeId: "ZSNJ-SERVICE-N-118.8660107,31.7386872",
    toNodeId: "ZSNJ-SERVICE-N-118.8647462,31.7380396",
    decision: "approved",
    evidence: "user_confirmation",
    note: "用户于2026-10-20确认远机位51—57使用SRD-004、58—65使用SRD-003；批准两条既有保障道路所在分量与主网之间139.69米的唯一交接，不采用随后绘制的草稿线。",
  }),
] satisfies readonly ServiceRoadGapRepairDecision[]);
