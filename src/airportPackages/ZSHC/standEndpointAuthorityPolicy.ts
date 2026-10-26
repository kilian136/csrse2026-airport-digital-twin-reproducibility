import type { StandEndpointAuthorityPolicy } from "../../infrastructure/airportNetworkCompiler";

/** 仅转换82个客运登机口；43个萧山维修机位继续使用人工WGS84标定。 */
export const xiaoshanStandEndpointAuthorityPolicy = Object.freeze({
  airportIdent: "ZSHC",
  revision: "ZSHC-STAND-ENDPOINT-AUTHORITY-2026-10-19-R1",
  reviewedAt: "2026-10-19",
  approvedBy: "用户批准：客运机位转OSM末端，维修机位保留人工标定",
  eligibleKinds: Object.freeze(["gate"]),
  expectedMigratedStandCount: 82,
} satisfies StandEndpointAuthorityPolicy);
