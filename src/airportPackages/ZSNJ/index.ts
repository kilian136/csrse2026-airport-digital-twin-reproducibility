import referencePackageJson from "./reference.json" with { type: "json" };
import operationalAreasPackageJson from "./operational-areas.json" with { type: "json" };
import groundSupportPackageJson from "./ground-support.json" with { type: "json" };
import networkSnapshotJson from "./osm-manifest.json" with { type: "json" };
import manualNetworkCalibrationJson from "./manual-network-calibration.json" with { type: "json" };
import manualParkingPositionCatalogJson from "./manual-parking-position-catalog.json" with { type: "json" };
import candidateStandClassificationCatalogJson from "./candidate-stand-classification.json" with { type: "json" };
import runtimeStandPackageJson from "./runtime-stands.json" with { type: "json" };
import {
  adaptAirportConfigurationBundle,
  type AirportConfigurationPackage,
  type AirportConfigurationSourceBundle,
  type AirportCandidateStandClassificationCatalog,
  type AirportManualNetworkCalibrationSnapshot,
  type AirportManualParkingPositionCatalog,
  type AirportNetworkSnapshotManifest,
} from "../../infrastructure/airportConfig";
import {
  nanjingCoordinateConverter,
  nanjingLocalCoordinateConverter,
} from "./calibration";

export const nanjingConfigurationBundle = {
  airportIdent: "ZSNJ",
  featurePackages: [
    referencePackageJson as unknown as AirportConfigurationPackage,
    operationalAreasPackageJson as unknown as AirportConfigurationPackage,
    groundSupportPackageJson as unknown as AirportConfigurationPackage,
    runtimeStandPackageJson as unknown as AirportConfigurationPackage,
  ],
  gateLayouts: [],
  networkSnapshot:
    networkSnapshotJson as unknown as AirportNetworkSnapshotManifest,
  networkSnapshotUrl: "/airport-data/ZSNJ/osm-raw.json",
  manualNetworkCalibration:
    manualNetworkCalibrationJson as unknown as AirportManualNetworkCalibrationSnapshot,
  manualParkingPositionCatalog:
    manualParkingPositionCatalogJson as unknown as AirportManualParkingPositionCatalog,
  candidateStandClassificationCatalog:
    candidateStandClassificationCatalogJson as unknown as AirportCandidateStandClassificationCatalog,
} satisfies AirportConfigurationSourceBundle;

const nanjingConfigurationIntegration = adaptAirportConfigurationBundle(
  nanjingConfigurationBundle,
  {
    coordinateConverter: nanjingCoordinateConverter,
    localCoordinateConverter: nanjingLocalCoordinateConverter,
  },
);

const operationalStandKinds = new Set([
  "gate",
  "stand",
  "remote_stand",
  "cargo_stand",
]);
const nanjingOperationalFeatures = Object.freeze(
  nanjingConfigurationIntegration.features.map((feature) => {
    if (
      feature.geometry.type !== "Point" ||
      !operationalStandKinds.has(feature.properties.kind)
    ) {
      return feature;
    }
    return Object.freeze({
      ...feature,
      properties: Object.freeze({
        ...feature.properties,
        activationStatus: "active" as const,
        dataStatus: "complete" as const,
        operational: true,
      }),
    });
  }),
);

const serviceRoadStandBindings = Object.freeze(
  nanjingOperationalFeatures.flatMap((feature) => {
    const match = /^(远机位|维修机位)(\d+)$/.exec(feature.properties.name);
    if (!match) return [];
    const standNumber = Number(match[2]);
    const edgeIdPrefix =
      match[1] === "远机位" && standNumber >= 51 && standNumber <= 57
        ? "CORRIDOR-ZSNJ-MANUAL-E-SRD-004-1"
        : match[1] === "远机位" && standNumber >= 58 && standNumber <= 65
          ? "CORRIDOR-ZSNJ-MANUAL-E-SRD-003-1"
          : match[1] === "维修机位" && standNumber >= 644 && standNumber <= 649
            ? "CORRIDOR-ZSNJ-MANUAL-E-SRD-001-1"
            : null;
    return edgeIdPrefix
      ? [Object.freeze({
          standId: feature.properties.id,
          edgeIdPrefixes: Object.freeze([edgeIdPrefix]),
        })]
      : [];
  }),
);

/** 南京已批准WGS84运行配置；旧参考路网不再参与运行计算。 */
export const nanjingGeospatialIntegration = Object.freeze({
  ...nanjingConfigurationIntegration,
  features: nanjingOperationalFeatures,
  mode: "operational" as const,
  runtimeNetworkAuthority: "compiled_geospatial_network" as const,
  serviceRoadStandBindings,
  warnings: Object.freeze([
    "138个分类机位已提升为active运行机位，并由同一受控运行内核统一调度。",
    "南京运行资源已按用户核实驻点和仿真规划编制独立装配；真实车辆与人员编制仍待正式资料替换。",
    "保障道路东北侧17.45米OSM分段缺口已按用户确认接通；该项不进入飞机滑行路网。",
  ]),
});
