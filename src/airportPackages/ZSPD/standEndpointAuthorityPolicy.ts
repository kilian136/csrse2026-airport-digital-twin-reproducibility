import type { StandEndpointAuthorityPolicy } from "../../infrastructure/airportNetworkCompiler";

/** 浦东客运、远机位、货运与维修机位全部由OSM引导线末端接管运行坐标。 */
export const pudongStandEndpointAuthorityPolicy = Object.freeze({
  airportIdent: "ZSPD",
  revision: "ZSPD-STAND-ENDPOINT-AUTHORITY-2026-10-19-R1",
  reviewedAt: "2026-10-19",
  approvedBy: "用户批准：浦东全部机位转OSM停机位引导线末端",
  eligibleKinds: Object.freeze(["gate", "remote_stand", "cargo_stand", "stand"]),
  expectedMigratedStandCount: 275,
} satisfies StandEndpointAuthorityPolicy);
