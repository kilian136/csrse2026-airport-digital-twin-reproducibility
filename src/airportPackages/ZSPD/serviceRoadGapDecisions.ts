import type { ServiceRoadGapRepairDecision } from "../../infrastructure/airportNetworkCompiler";

/**
 * 浦东维修区保障道路缺口人工核校结论。
 * 四处端点均位于用户标定的维修保障区连续铺装范围内，仅补齐OSM道路
 * 分段造成的拓扑断点；不放宽全机场自动补缝阈值，也不跨越跑道或禁行区。
 */
export const pudongServiceRoadGapDecisions = Object.freeze([
  Object.freeze({
    fromNodeId: "ZSPD-SERVICE-N-121.8026519,31.1679325",
    toNodeId: "ZSPD-SERVICE-N-121.8026438,31.1678476",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "维修区一北段同一铺装保障通道存在约9.4米OSM断点，连接两个维修机位道路分段。",
  }),
  Object.freeze({
    fromNodeId: "ZSPD-SERVICE-N-121.8037968,31.1649013",
    toNodeId: "ZSPD-SERVICE-N-121.8039849,31.1650694",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "维修区一内部保障道路与机场主保障路网间存在约25.9米缺失连接，端点间为连续铺装区域。",
  }),
  Object.freeze({
    fromNodeId: "ZSPD-SERVICE-N-121.7929597,31.1618103",
    toNodeId: "ZSPD-SERVICE-N-121.7929490,31.1617070",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "维修区二北段同一铺装保障通道存在约11.5米OSM断点，连接两个维修机位道路分段。",
  }),
  Object.freeze({
    fromNodeId: "ZSPD-SERVICE-N-121.7904304,31.1630095",
    toNodeId: "ZSPD-SERVICE-N-121.7904023,31.1625183",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "维修区二保障道路与机场主保障路网间存在约54.5米缺失连接，端点位于连续铺装服务通道。",
  }),
] satisfies readonly ServiceRoadGapRepairDecision[]);
