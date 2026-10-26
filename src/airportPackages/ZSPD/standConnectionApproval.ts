import type { AirportStandConnectionManualApproval } from "../../infrastructure/airportNetworkCompiler";

/**
 * 四类机位近/中/远代表连接核验。
 * R3按廊桥末端推算的机身中心重新生成廊桥机位连接，纠正G01误接G02。
 */
export const pudongStandConnectionApproval = Object.freeze({
  airportIdent: "ZSPD",
  revision: "ZSPD-STAND-CONNECTIONS-2026-10-19-R4",
  reviewedAt: "2026-10-19",
  approvedBy: "用户批准：浦东全部机位由OSM停机位引导线末端接管",
  expectedFingerprint: "fnv1a32:d2a74b76",
  expectedConnectionCount: 275,
  expectedCountsByKind: Object.freeze({
    gate: 162,
    remote_stand: 40,
    cargo_stand: 22,
    maintenance_stand: 51,
  }),
  samples: Object.freeze([
    { sourceId: "ZSPD-T1-A-GATE-01", kind: "gate", band: "near", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-T2-A-GATE-08", kind: "gate", band: "middle", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-T2-C-GATE-37", kind: "gate", band: "far", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-REMOTE-T1-A-01", kind: "remote_stand", band: "near", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-REMOTE-T1-B-10", kind: "remote_stand", band: "middle", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-REMOTE-T2-C-12", kind: "remote_stand", band: "far", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-CARGO-A-STAND-01", kind: "cargo_stand", band: "near", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-CARGO-A-STAND-11", kind: "cargo_stand", band: "middle", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-CARGO-B-STAND-11", kind: "cargo_stand", band: "far", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-MAINT-01-STAND-01", kind: "maintenance_stand", band: "near", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-MAINT-02-STAND-05", kind: "maintenance_stand", band: "middle", connectorDistanceMeters: 0, result: "passed" },
    { sourceId: "ZSPD-MAINT-03-STAND-22", kind: "maintenance_stand", band: "far", connectorDistanceMeters: 0, result: "passed" },
  ]),
} satisfies AirportStandConnectionManualApproval);
