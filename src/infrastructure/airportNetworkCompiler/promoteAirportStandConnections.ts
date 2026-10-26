import {
  buildRepresentativeAirportStandConnectionSamples,
  createAirportStandConnectionFingerprint,
  type AirportStandConnectionBand,
  type AirportStandConnectionDraft,
  type AirportStandConnectionDraftItem,
} from "./buildAirportStandConnectionDraft";
import type { AirportStandReachabilityKind } from "./auditAirportStandReachability";

export type AirportStandConnectionApprovalSample = Readonly<{
  sourceId: string;
  kind: AirportStandReachabilityKind;
  band: AirportStandConnectionBand;
  connectorDistanceMeters: number;
  result: "passed";
}>;

export type AirportStandConnectionManualApproval = Readonly<{
  airportIdent: string;
  revision: string;
  reviewedAt: string;
  approvedBy: string;
  expectedFingerprint: string;
  expectedConnectionCount: number;
  expectedCountsByKind: Readonly<Record<AirportStandReachabilityKind, number>>;
  samples: readonly AirportStandConnectionApprovalSample[];
}>;

export type ApprovedAirportStandConnection = AirportStandConnectionDraftItem &
  Readonly<{
    authority: "approved_operational";
    allowedModes: readonly ("taxi" | "tow" | "service_vehicle")[];
  }>;

export type ApprovedAirportStandConnectionNetwork = Readonly<{
  airportIdent: string;
  authority: "approved_operational";
  status: "approved_for_controlled_simulation";
  mayDriveSimulation: true;
  connections: readonly ApprovedAirportStandConnection[];
  approval: AirportStandConnectionManualApproval;
  approvedSampleConnectionIds: readonly string[];
  safeguards: Readonly<{
    pureRunwayEdgesExcluded: true;
    allConnectionsReachHoldingPoints: true;
    representativeReviewComplete: true;
    configurationFingerprintLocked: true;
  }>;
}>;

export function promoteAirportStandConnections(
  draft: AirportStandConnectionDraft,
  approval: AirportStandConnectionManualApproval,
): ApprovedAirportStandConnectionNetwork {
  if (draft.airportIdent !== approval.airportIdent) {
    throw new Error("机位连接草案与人工批准记录不属于同一机场。");
  }
  if (
    draft.report.totalConnectionCount !== approval.expectedConnectionCount ||
    draft.report.readyForReviewCount !== draft.report.totalConnectionCount ||
    draft.report.drawableConnectionCount !== draft.report.totalConnectionCount ||
    draft.report.rejectedConnectionCount !== 0
  ) {
    throw new Error("机位连接数量或可达性已发生变化，原批准记录失效。");
  }
  if (createAirportStandConnectionFingerprint(draft) !== approval.expectedFingerprint) {
    throw new Error("机位连接全量指纹已变化，必须重新进行地图核验。");
  }
  const currentCounts = Object.fromEntries(
    (["gate", "remote_stand", "cargo_stand", "maintenance_stand"] as const).map(
      (kind) => [
        kind,
        draft.connections.filter((connection) => connection.kind === kind).length,
      ],
    ),
  ) as Record<AirportStandReachabilityKind, number>;
  (Object.keys(currentCounts) as AirportStandReachabilityKind[]).forEach((kind) => {
    if (currentCounts[kind] !== approval.expectedCountsByKind[kind]) {
      throw new Error(`${kind}机位连接数量已变化，原批准记录失效。`);
    }
  });

  const samples = buildRepresentativeAirportStandConnectionSamples(draft);
  if (samples.length === 0 || samples.length !== approval.samples.length) {
    throw new Error("机位连接人工抽检样本数量已变化。");
  }
  const approvalByKey = new Map(
    approval.samples.map((sample) => [
      `${sample.kind}:${sample.band}`,
      sample,
    ]),
  );
  samples.forEach((sample) => {
    const reviewed = approvalByKey.get(`${sample.kind}:${sample.band}`);
    if (
      !reviewed ||
      reviewed.result !== "passed" ||
      reviewed.sourceId !== sample.sourceId ||
      Math.abs(reviewed.connectorDistanceMeters - sample.connectorDistanceMeters) > 0.1
    ) {
      throw new Error(`${sample.kind}的${sample.band}连接抽检签名已失效。`);
    }
  });

  const connections = draft.connections.map(
    (connection): ApprovedAirportStandConnection => Object.freeze({
      ...connection,
      authority: "approved_operational" as const,
      allowedModes: Object.freeze(
        connection.kind === "maintenance_stand"
          ? ["tow" as const, "service_vehicle" as const]
          : ["taxi" as const, "tow" as const, "service_vehicle" as const],
      ),
    }),
  );
  return Object.freeze({
    airportIdent: draft.airportIdent,
    authority: "approved_operational" as const,
    status: "approved_for_controlled_simulation" as const,
    mayDriveSimulation: true as const,
    connections: Object.freeze(connections),
    approval,
    approvedSampleConnectionIds: Object.freeze(
      samples.map((sample) => sample.connectionId),
    ),
    safeguards: Object.freeze({
      pureRunwayEdgesExcluded: true as const,
      allConnectionsReachHoldingPoints: true as const,
      representativeReviewComplete: true as const,
      configurationFingerprintLocked: true as const,
    }),
  });
}
