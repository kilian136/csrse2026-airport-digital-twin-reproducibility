import type { SurfaceRouteManualApproval } from "../../infrastructure/airportNetworkCompiler";

/** 南京全量138个机位至跑道等待点的近、中、远代表路线冻结记录。 */
export const nanjingSurfaceRouteApproval = Object.freeze({
  airportIdent: "ZSNJ",
  revision: "ZSNJ-SURFACE-ROUTES-2026-10-19-R1",
  reviewedAt: "2026-10-19",
  approvedBy: "用户批准按冻结路网继续；138条路线已通过全量影子验证",
  scope: Object.freeze({ sourceGroups: Object.freeze(["其他"]), unreviewedSources: "candidate_only" as const }),
  samples: Object.freeze([
    { label: "其他近", sourceName: "维修机位621", destinationName: "OSM跑道等待点", distanceMeters: 394, result: "passed" as const },
    { label: "其他中", sourceName: "T1机位124", destinationName: "OSM跑道等待点", distanceMeters: 1_404, result: "passed" as const },
    { label: "其他远", sourceName: "货机位279", destinationName: "OSM跑道等待点", distanceMeters: 2_648, result: "passed" as const },
  ]),
} satisfies SurfaceRouteManualApproval);
