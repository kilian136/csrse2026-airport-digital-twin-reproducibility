import type { AirportControlledIntroductionBaseline } from "../../domain/airportControlledIntroduction";

/**
 * 南京受控引入前R1冻结基线。
 * 该记录只锁定当前WGS84路网、机位连接和影子验证结果，不开放运行权威。
 */
export const nanjingControlledIntroductionBaseline = Object.freeze({
  airportIdent: "ZSNJ",
  revision: "ZSNJ-CONTROLLED-INTRODUCTION-2026-10-18-R1",
  frozenAt: "2026-10-18T00:00:00.000Z",
  authority: "shadow_validation_only" as const,
  status: "topology_shadow_validated" as const,
  mayDriveSimulation: false as const,
  fingerprints: Object.freeze({
    candidateNetwork: "fnv1a32:c3d869d8",
    standConfiguration: "fnv1a32:ae723e1c",
    standConnections: "fnv1a32:0faa4193",
  }),
  counts: Object.freeze({
    networkNodeCount: 3_764,
    networkEdgeCount: 4_213,
    runwayCount: 2,
    holdingPointCount: 12,
    activeStandCount: 138,
    reachableStandRouteCount: 138,
    unreachableStandRouteCount: 0,
    runwayIntrusionRouteCount: 0,
    serviceAnchorCount: 7,
    reachableServiceRouteCount: 7,
    unresolvedAircraftNetworkBreakCount: 0,
  }),
  remainingPrerequisites: Object.freeze([
    "97个机位仍需补充机型尺寸适配规则。",
    "保障车辆数量、维修人员与维修设备能力参数仍待配置。",
    "17架共享机队飞机已完成受控预分配；正式任务仍须等待资源能力与代表场景验收。",
    "正式接入前仍需完成代表场景人工验收，不得由本基线自动取得运行权威。",
  ]),
}) satisfies AirportControlledIntroductionBaseline;
