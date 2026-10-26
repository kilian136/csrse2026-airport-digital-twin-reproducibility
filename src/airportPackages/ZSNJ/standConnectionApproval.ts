import type { AirportStandConnectionManualApproval } from "../../infrastructure/airportNetworkCompiler";

/** 南京四类138个运行机位与受控路网端点的冻结核验记录。 */
export const nanjingStandConnectionApproval = Object.freeze({
  airportIdent: "ZSNJ",
  revision: "ZSNJ-STAND-CONNECTIONS-2026-10-19-R1",
  reviewedAt: "2026-10-19",
  approvedBy: "用户批准按已核对的南京机位分类与冻结WGS84路网推进受控安装",
  expectedFingerprint: "fnv1a32:0faa4193",
  expectedConnectionCount: 138,
  expectedCountsByKind: Object.freeze({ gate: 61, remote_stand: 15, cargo_stand: 21, maintenance_stand: 41 }),
  samples: Object.freeze([
    { sourceId: "ZSNJ-CAND-STAND-01", kind: "gate", band: "near", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-7076501361", kind: "gate", band: "middle", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-7076644917", kind: "gate", band: "far", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-12260782352", kind: "remote_stand", band: "near", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-12260782359", kind: "remote_stand", band: "middle", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-12260782366", kind: "remote_stand", band: "far", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-7074122084", kind: "cargo_stand", band: "near", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-7074122297", kind: "cargo_stand", band: "middle", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-7074122372", kind: "cargo_stand", band: "far", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-10021717936", kind: "maintenance_stand", band: "near", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-2533331347", kind: "maintenance_stand", band: "middle", connectorDistanceMeters: 0, result: "passed" as const },
    { sourceId: "ZSNJ-OSM-P-7987914547", kind: "maintenance_stand", band: "far", connectorDistanceMeters: 0, result: "passed" as const },
  ]),
} satisfies AirportStandConnectionManualApproval);
