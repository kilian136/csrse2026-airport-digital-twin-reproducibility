import type { ProjectedAirportCoordinate } from "../airportConfig";

export type CandidateNetworkKind =
  | "runway"
  | "taxiway"
  | "taxilane"
  | "parking_position";

export type CandidateServiceRoadReviewStatus =
  | "likely_airside"
  | "requires_review"
  | "excluded";

export type CandidateServiceRoad = Readonly<{
  id: string;
  sourceWayId: number;
  coordinates: readonly ProjectedAirportCoordinate[];
  lengthMeters: number;
  access: string | null;
  service: string | null;
  oneWay: boolean;
  reviewStatus: CandidateServiceRoadReviewStatus;
}>;

export type CandidateServiceRoadNetwork = Readonly<{
  authority: "candidate_only";
  source: "OpenStreetMap" | "OpenStreetMap+ManualCalibration";
  importedWayCount: number;
  totalLengthMeters: number;
  oneWayCount: number;
  statusCounts: Readonly<Record<CandidateServiceRoadReviewStatus, number>>;
  roads: readonly CandidateServiceRoad[];
}>;

export type CandidateOperationalPointKind =
  | "parking_position"
  | "holding_position"
  | "runway_connection";

export type CandidateOperationalPoint = Readonly<{
  id: string;
  sourceElementId: number | null;
  kind: CandidateOperationalPointKind;
  ref: string | null;
  mapLabel?: string | null;
  sourceCorridorId?: string | null;
  standClassificationGroupId?: string | null;
  standOperationalRole?:
    | "passenger_gate"
    | "remote_passenger"
    | "cargo"
    | "maintenance"
    | null;
  terminalAffinity?: string | null;
  standSizeProfile?:
    | "unclassified"
    | "small"
    | "medium"
    | "medium_large"
    | "large"
    | null;
  standActivationStatus?: "candidate_active" | "temporarily_abandoned" | null;
  coordinate: ProjectedAirportCoordinate;
  networkNodeId: string | null;
}>;

export type CandidateNetworkNode = Readonly<{
  id: string;
  coordinate: ProjectedAirportCoordinate;
  degree: number;
}>;

export type CandidateNetworkEdge = Readonly<{
  id: string;
  fromNodeId: string;
  toNodeId: string;
  primaryKind: CandidateNetworkKind;
  kinds: readonly CandidateNetworkKind[];
  refs: readonly string[];
  sourceWayIds: readonly number[];
  lengthMeters: number;
  bidirectional: boolean;
}>;

export type CandidateNetworkCorridor = Readonly<{
  id: string;
  nodeIds: readonly string[];
  sourceEdgeIds: readonly string[];
  primaryKind: CandidateNetworkKind;
  refs: readonly string[];
  lengthMeters: number;
  bidirectional: boolean;
  isolated: boolean;
}>;

export type CandidateNetworkRenderModel = Readonly<{
  corridors: readonly CandidateNetworkCorridor[];
  rawEdgeCount: number;
  renderedCorridorCount: number;
  mergedEdgeCount: number;
}>;

export type CandidateNetworkKindSummary = Readonly<{
  wayCount: number;
  edgeCount: number;
  lengthMeters: number;
}>;

export type CandidateNetworkComponentSummary = Readonly<{
  id: string;
  classification:
    | "main_network"
    | "isolated_parking_guidance"
    | "isolated_operational_fragment";
  nodeIds: readonly string[];
  nodeCount: number;
  edgeCount: number;
  centerLocalCoordinate: Readonly<{
    eastMeters: number;
    northMeters: number;
  }>;
  kinds: Readonly<Record<CandidateNetworkKind, number>>;
}>;

export type CandidateDanglingNodeAudit = Readonly<{
  runwayEndNodeIds: readonly string[];
  parkingGuideEndNodeIds: readonly string[];
  perimeterOperationalEndNodeIds: readonly string[];
  suspectedBreakNodeIds: readonly string[];
}>;

export type CandidateNetworkValidationReport = Readonly<{
  sourceElementCount: number;
  compiledWayCount: number;
  skippedElementCount: number;
  nodeCount: number;
  edgeCount: number;
  connectedComponentCount: number;
  largestComponentNodeCount: number;
  danglingNodeCount: number;
  danglingNodes: CandidateDanglingNodeAudit;
  components: readonly CandidateNetworkComponentSummary[];
  kinds: Readonly<Record<CandidateNetworkKind, CandidateNetworkKindSummary>>;
  warnings: readonly string[];
}>;

export type CandidateAirportNetwork = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  authority: "candidate_only";
  source: "OpenStreetMap" | "OpenStreetMap+ManualCalibration";
  compiledAt: string;
  nodes: readonly CandidateNetworkNode[];
  edges: readonly CandidateNetworkEdge[];
  operationalPoints: readonly CandidateOperationalPoint[];
  manualCalibration?: CandidateManualNetworkCalibrationSummary;
  standClassification?: CandidateStandClassificationSummary;
  /** 与飞机候选路网隔离的保障车辆道路，仅用于显示与人工核校。 */
  serviceRoadNetwork?: CandidateServiceRoadNetwork;
  report: CandidateNetworkValidationReport;
}>;

export type CandidateManualNetworkCalibrationSummary = Readonly<{
  corridorIds: readonly string[];
  segmentCount: number;
  aircraftCorridorSegmentCount: number;
  serviceRoadSegmentCount: number;
  pointCount: number;
  edgeCount: number;
  parkingPositionCount: number;
  numberedParkingPositionCount: number;
  snappedEndpointCount: number;
  maximumSnapDistanceMeters: number;
  thresholdMeters: number;
  sourceExportedAt: string;
}>;

export type CandidateStandClassificationSummary = Readonly<{
  totalParkingPositionCount: number;
  activeCount: number;
  temporarilyAbandonedCount: number;
  countsByRole: Readonly<
    Record<"passenger_gate" | "remote_passenger" | "cargo" | "maintenance", number>
  >;
  countsByTerminal: Readonly<Record<string, number>>;
  countsBySizeProfile: Readonly<
    Record<
      "unclassified" | "small" | "medium" | "medium_large" | "large",
      number
    >
  >;
  sourceUpdatedAt: string;
}>;

export type OsmSnapshotElement = Readonly<{
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  geometry?: readonly Readonly<{ lat: number; lon: number }>[];
  tags?: Readonly<Record<string, string>>;
}>;

export type OsmSnapshot = Readonly<{
  version: number;
  elements: readonly OsmSnapshotElement[];
}>;
