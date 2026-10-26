import type {
  AirportStandReachabilityAudit,
  AirportStandReachabilityKind,
  AirportStandReachabilityStatus,
} from "./auditAirportStandReachability";

export type AirportStandConnectionBand = "near" | "middle" | "far";

export type AirportStandConnectionDraftItem = Readonly<{
  id: string;
  sourceId: string;
  sourceName: string;
  kind: AirportStandReachabilityKind;
  status: AirportStandReachabilityStatus;
  nearestEdgeId: string | null;
  attachmentNodeId: string | null;
  connectorDistanceMeters: number | null;
  coordinates: readonly (
    readonly [longitude: number, latitude: number]
  )[];
}>;

export type AirportStandConnectionDraft = Readonly<{
  airportIdent: string;
  authority: "validation_draft";
  mayDriveSimulation: false;
  connections: readonly AirportStandConnectionDraftItem[];
  report: Readonly<{
    totalConnectionCount: number;
    drawableConnectionCount: number;
    readyForReviewCount: number;
    rejectedConnectionCount: number;
  }>;
}>;

export type AirportStandConnectionSample = Readonly<{
  connectionId: string;
  sourceId: string;
  sourceName: string;
  kind: AirportStandReachabilityKind;
  band: AirportStandConnectionBand;
  connectorDistanceMeters: number;
  coordinates: AirportStandConnectionDraftItem["coordinates"];
}>;

export function buildAirportStandConnectionDraft(
  audit: AirportStandReachabilityAudit,
): AirportStandConnectionDraft {
  const connections = audit.items.map((item): AirportStandConnectionDraftItem => ({
    id: `STAND-CONNECTION:${item.sourceId}`,
    sourceId: item.sourceId,
    sourceName: item.name,
    kind: item.kind,
    status: item.status,
    nearestEdgeId: item.nearestEdgeId,
    attachmentNodeId: item.attachmentNodeId,
    connectorDistanceMeters: item.connectorDistanceMeters,
    coordinates: item.attachmentCoordinate
      ? [item.sourceCoordinate, item.attachmentCoordinate]
      : [],
  }));
  return Object.freeze({
    airportIdent: audit.airportIdent,
    authority: "validation_draft" as const,
    mayDriveSimulation: false as const,
    connections: Object.freeze(connections),
    report: Object.freeze({
      totalConnectionCount: connections.length,
      drawableConnectionCount: connections.filter(
        (connection) => connection.coordinates.length === 2,
      ).length,
      readyForReviewCount: connections.filter(
        (connection) => connection.status === "reachable",
      ).length,
      rejectedConnectionCount: connections.filter(
        (connection) => connection.status !== "reachable",
      ).length,
    }),
  });
}

/** 全量连接签名；任一机位、目标路段、接入节点或坐标改变都会导致批准失效。 */
export function createAirportStandConnectionFingerprint(
  draft: AirportStandConnectionDraft,
): string {
  const payload = draft.connections
    .map((connection) => [
      connection.id,
      connection.kind,
      connection.status,
      connection.nearestEdgeId ?? "",
      connection.attachmentNodeId ?? "",
      connection.connectorDistanceMeters?.toFixed(3) ?? "",
      connection.coordinates
        .map((coordinate) => `${coordinate[0].toFixed(7)},${coordinate[1].toFixed(7)}`)
        .join(">"),
    ].join("|"))
    .sort()
    .join("\n");
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/** 每类机位各取最近、中位、最远三条连接，避免一次性在地图上叠加全部草案。 */
export function buildRepresentativeAirportStandConnectionSamples(
  draft: AirportStandConnectionDraft,
): readonly AirportStandConnectionSample[] {
  const kinds: readonly AirportStandReachabilityKind[] = [
    "gate",
    "remote_stand",
    "cargo_stand",
    "maintenance_stand",
  ];
  const bands: readonly AirportStandConnectionBand[] = ["near", "middle", "far"];
  return Object.freeze(
    kinds.flatMap((kind) => {
      const connections = draft.connections
        .filter(
          (connection) =>
            connection.kind === kind &&
            connection.status === "reachable" &&
            connection.connectorDistanceMeters !== null &&
            connection.coordinates.length === 2,
        )
        .sort(
          (left, right) => {
            const distanceDelta =
              left.connectorDistanceMeters! - right.connectorDistanceMeters!;
            return Math.abs(distanceDelta) > 0.001
              ? distanceDelta
              : left.sourceId.localeCompare(right.sourceId, "en");
          },
        );
      if (connections.length === 0) return [];
      const indexes = [
        0,
        Math.floor((connections.length - 1) / 2),
        connections.length - 1,
      ];
      return indexes.flatMap((index, bandIndex) => {
        const connection = connections[index];
        if (!connection) return [];
        return [{
          connectionId: connection.id,
          sourceId: connection.sourceId,
          sourceName: connection.sourceName,
          kind,
          band: bands[bandIndex],
          connectorDistanceMeters: connection.connectorDistanceMeters!,
          coordinates: connection.coordinates,
        }];
      });
    }),
  );
}
