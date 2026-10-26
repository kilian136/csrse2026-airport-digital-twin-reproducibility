import type {
  AirportCoordinateConverter,
  AirportLocalCoordinateConverter,
  Wgs84Coordinate,
} from "../../domain/geo";

export type AirportFeatureKind =
  | "reference_point"
  | "runway"
  | "taxiway"
  | "taxilane"
  | "service_road"
  | "stand"
  | "apron"
  | "terminal"
  | "concourse"
  | "gate"
  | "holding_point"
  | "boarding_bridge"
  | "hangar"
  | "maintenance_department"
  | "maintenance_area"
  | "cargo_facility"
  | "cargo_stand"
  | "remote_stand"
  | "ground_support_base"
  | "ground_support_waiting_area"
  | "fuel_facility"
  | "fire_station"
  | "restricted_area";

export type GeoJsonPosition = readonly [longitude: number, latitude: number];

export type AirportPointGeometry = Readonly<{
  type: "Point";
  coordinates: GeoJsonPosition;
}>;

export type AirportLineGeometry = Readonly<{
  type: "LineString";
  coordinates: readonly GeoJsonPosition[];
}>;

export type AirportPolygonGeometry = Readonly<{
  type: "Polygon";
  coordinates: readonly (readonly GeoJsonPosition[])[];
}>;

export type AirportFeatureGeometry =
  | AirportPointGeometry
  | AirportLineGeometry
  | AirportPolygonGeometry;

export type AirportFeatureProperties = Readonly<{
  id: string;
  airportIdent: string;
  kind: AirportFeatureKind;
  name: string;
  createdAt: string;
  parentZoneId?: string;
  parentTerminalId?: string;
  parentConcourseId?: string;
  parentGateId?: string;
  /** 与运行态保障基地建立稳定语义绑定，禁止使用旧底图坐标猜测。 */
  supportBaseId?: string;
  /** 与运行态保障等待区建立稳定语义绑定。 */
  supportWaitingAreaId?: string;
  facilityStatus?: "simulation_planned" | "verified_real";
  standNumber?: number;
  gateNumber?: number;
  bridgePosition?: "inner" | "outer";
  aircraftSizeCategory?: "small" | "medium" | "large";
  preferredAircraftSizeCategory?: "small" | "medium" | "large";
  compatibleAircraftSizeCategories?: readonly (
    | "small"
    | "medium"
    | "large"
  )[];
  facilityFunctions?: readonly (
    | "cargo_handling"
    | "uld_staging"
    | "cargo_loading_support"
  )[];
  /** 机场配置包自定义的航站楼/指廊归属，不在共享契约中枚举。 */
  terminalAffinity?: string;
  remoteStandPurpose?:
    | "remote_passenger"
    | "overnight"
    | "overflow"
    | "unconfirmed";
  boardingMode?: "bus" | "none" | "bus_or_unconfirmed";
  activationStatus?: "candidate" | "active";
  orientationMode?: "nose_out_tail_in" | "nose_in_tail_out";
  plannedStandCount?: number;
  mappedStandCount?: number;
  dataStatus?: "partial" | "complete";
  source?: "user_wgs84" | "manual_editor" | "openstreetmap";
  operational?: boolean;
  /** 运行坐标已由编译路网停机位引导线末端接管，廊桥只保留展示语义。 */
  runtimePositionAuthority?: "compiled_parking_endpoint";
}>;

export type AirportConfigurationFeature = Readonly<{
  type: "Feature";
  properties: AirportFeatureProperties;
  geometry: AirportFeatureGeometry;
}>;

export type AirportConfigurationPackage = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  coordinateSystem: "WGS84";
  geoJsonCoordinateOrder: "longitude_latitude";
  updatedAt: string;
  features: Readonly<{
    type: "FeatureCollection";
    features: readonly AirportConfigurationFeature[];
  }>;
}>;

export type BoardingBridgePosition = Readonly<{
  position?: "inner" | "outer";
  coordinate: GeoJsonPosition;
}>;

export type GateLayoutPackage = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  terminalId: string;
  concourseId: string;
  gatePrefix: string;
  source: "user_wgs84" | "manual_editor";
  gates: readonly Readonly<{
    number: number;
    coordinate: GeoJsonPosition;
    bridges: readonly BoardingBridgePosition[];
  }>[];
}>;

export type AirportNetworkSnapshotManifest = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  source: string;
  license: string;
  capturedAt: string;
  center: Readonly<{
    latitude: number;
    longitude: number;
  }>;
  radiusMeters: number;
  rawElementCount: number;
  counts: Readonly<{
    runway: number | null;
    taxiway: number | null;
    taxilane: number | null;
    apron: number | null;
    parking_position: number | null;
    gate: number | null;
    terminal: number | null;
    holding_position: number | null;
    hangar: number | null;
    service_road?: number | null;
  }>;
  incompleteKinds?: readonly string[];
}>;

export type AirportConfigurationSourceBundle = Readonly<{
  airportIdent: string;
  featurePackages: readonly AirportConfigurationPackage[];
  gateLayouts: readonly GateLayoutPackage[];
  networkSnapshot: AirportNetworkSnapshotManifest;
  networkSnapshotUrl: string;
  manualNetworkCalibration?: AirportManualNetworkCalibrationSnapshot;
  manualParkingPositionCatalog?: AirportManualParkingPositionCatalog;
  candidateStandClassificationCatalog?: AirportCandidateStandClassificationCatalog;
}>;

export type AirportManualNetworkCalibrationSegment = Readonly<{
  id: string;
  name: string;
  kind: "taxiway" | "taxilane" | "parking_position" | "service_road";
  createdAt: string;
  coordinates: readonly (readonly [longitude: number, latitude: number])[];
}>;

export type AirportManualNetworkCalibrationSnapshot = Readonly<{
  schemaVersion: string;
  airportIdent: string;
  coordinateSystem: "WGS84";
  authority: "manual_calibration_draft";
  exportedAt: string;
  segments: readonly AirportManualNetworkCalibrationSegment[];
}>;

export type AirportManualParkingPositionDesignation = Readonly<{
  id: string;
  corridorId: string;
  sequence: number;
  displayName: string;
  mapLabel: string;
  classification: "candidate_unclassified";
}>;

export type AirportManualParkingPositionCatalog = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  authority: "candidate_designation";
  designationBasis: "clockwise_from_north";
  createdAt: string;
  positions: readonly AirportManualParkingPositionDesignation[];
}>;

export type AirportCandidateStandRole =
  | "passenger_gate"
  | "remote_passenger"
  | "cargo"
  | "maintenance";

export type AirportCandidateStandSizeProfile =
  | "unclassified"
  | "small"
  | "medium"
  | "medium_large"
  | "large";

export type AirportCandidateStandClassificationGroup = Readonly<{
  id: string;
  name: string;
  pointRefs?: readonly string[];
  pointIds?: readonly string[];
  role: AirportCandidateStandRole;
  terminalAffinity?: string;
  sizeProfile: AirportCandidateStandSizeProfile;
}>;

export type AirportCandidateStandClassificationCatalog = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  authority: "user_confirmed_candidate_classification";
  updatedAt: string;
  defaultStatus: "temporarily_abandoned";
  notes: readonly string[];
  groups: readonly AirportCandidateStandClassificationGroup[];
}>;

/**
 * 机场配置要素的权威空间坐标。配置数据不再携带旧底图百分比投影；
 * 百分比坐标只允许由需要兼容显示的边界适配器临时生成。
 */
export type AirportSpatialCoordinate = Readonly<{
  wgs84: Wgs84Coordinate;
  local: Readonly<{
    eastMeters: number;
    northMeters: number;
  }>;
}>;

/** @deprecated 候选路网坐标现与权威空间坐标一致，不再包含旧百分比投影。 */
export type ProjectedAirportCoordinate = AirportSpatialCoordinate;

export type ProjectedAirportGeometry =
  | Readonly<{
      type: "Point";
      coordinates: AirportSpatialCoordinate;
    }>
  | Readonly<{
      type: "LineString";
      coordinates: readonly AirportSpatialCoordinate[];
    }>
  | Readonly<{
      type: "Polygon";
      coordinates: readonly (readonly AirportSpatialCoordinate[])[];
    }>;

export type ProjectedAirportFeature = Readonly<{
  properties: AirportFeatureProperties;
  geometry: ProjectedAirportGeometry;
}>;

export type AirportGeospatialIntegration = Readonly<{
  airportIdent: string;
  mode: "read_only_pilot" | "operational";
  runtimeNetworkAuthority: "legacy_airport_profile" | "compiled_geospatial_network";
  coordinateConverter: AirportCoordinateConverter;
  localCoordinateConverter: AirportLocalCoordinateConverter;
  features: readonly ProjectedAirportFeature[];
  featuresByKind: ReadonlyMap<
    AirportFeatureKind,
    readonly ProjectedAirportFeature[]
  >;
  networkSnapshot: AirportNetworkSnapshotManifest;
  networkSnapshotUrl: string;
  manualNetworkCalibration?: AirportManualNetworkCalibrationSnapshot;
  manualParkingPositionCatalog?: AirportManualParkingPositionCatalog;
  candidateStandClassificationCatalog?: AirportCandidateStandClassificationCatalog;
  serviceRoadStandBindings?: readonly Readonly<{
    standId: string;
    edgeIdPrefixes: readonly string[];
  }>[];
  warnings: readonly string[];
}>;
