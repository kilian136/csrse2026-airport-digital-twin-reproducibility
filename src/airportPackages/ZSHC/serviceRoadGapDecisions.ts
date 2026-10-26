import type { ServiceRoadGapRepairDecision } from "../../infrastructure/airportNetworkCompiler";

/**
 * 保障道路缺口人工核校结论。自动候选仍限定为小间隙；超过阈值的连接
 * 只有在明确记录端点和影像证据后才允许作为人工批准项进入拓扑。
 * 2026-09-28 对照卫星底图确认：前两处位于机场西南侧建筑环形铺装道路。
 * 2026-10-13 复核西部维修保障区：GSE-W所在片段与北侧主保障道路之间为
 * 连续铺装通道。三处均不跨越草地、围栏、水体、建筑或跑道。
 */
export const xiaoshanServiceRoadGapDecisions = Object.freeze([
  Object.freeze({
    fromNodeId: "ZSHC-SERVICE-N-120.4073479,30.2308143",
    toNodeId: "ZSHC-SERVICE-N-120.4072692,30.2307439",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "大型建筑北侧环形铺装服务道路连续，OSM仅存在约10.9米几何断点。",
  }),
  Object.freeze({
    fromNodeId: "ZSHC-SERVICE-N-120.4076790,30.2300287",
    toNodeId: "ZSHC-SERVICE-N-120.4077938,30.2300731",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "大型建筑南侧环形铺装服务道路连续，OSM仅存在约12.1米几何断点。",
  }),
  Object.freeze({
    fromNodeId: "ZSHC-SERVICE-N-120.4103375,30.2317344",
    toNodeId: "ZSHC-SERVICE-N-120.4109153,30.2323210",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "GSE-W北侧维修保障铺装通道连续，OSM缺失约85.6米连接；仅批准该明确端点对，不放宽全局20米自动补缝阈值。",
  }),
  Object.freeze({
    fromNodeId: "ZSHC-SERVICE-N-120.4252068,30.2358908",
    toNodeId: "ZSHC-SERVICE-N-120.4252951,30.2359146",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "东侧F区保障道路与主保障路网在同一铺装通道处仅缺失约8.9米拓扑连接，用于恢复GSE-E至F-04/F-05的双向受控路线。",
  }),
  Object.freeze({
    fromNodeId: "ZSHC-SERVICE-N-120.4302516,30.2346426",
    toNodeId: "ZSHC-SERVICE-N-120.4303620,30.2343272",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "东侧F区保障道路返程出口沿连续铺装区域接回主保障路网，补齐约36.5米OSM缺口；与8.9米入口共同保留原单行组织。",
  }),
  Object.freeze({
    fromNodeId: "ZSHC-SERVICE-N-120.4168865,30.2252076",
    toNodeId: "ZSHC-SERVICE-N-120.4168873,30.2250580",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "用户核实航油驻点所在保障道路与南侧主路段为连续铺装通道，补齐约16.6米OSM几何断点。",
  }),
  Object.freeze({
    fromNodeId: "ZSHC-SERVICE-N-120.4158529,30.2251226",
    toNodeId: "ZSHC-SERVICE-N-120.4159941,30.2246594",
    decision: "approved",
    evidence: "satellite_imagery",
    note: "航油驻点出口沿连续铺装通道接入机场主保障道路，补齐约53.1米OSM缺失段；与16.6米连接共同保持双向可达。",
  }),
] satisfies readonly ServiceRoadGapRepairDecision[]);
