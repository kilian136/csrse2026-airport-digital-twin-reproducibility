import terminalPackageJson from "./terminal.json" with { type: "json" };
import groundSupportPackageJson from "./ground-support.json" with { type: "json" };
import cargoPackageJson from "./cargo.json" with { type: "json" };
import remoteStandsPackageJson from "./remote-stands.json" with { type: "json" };
import maintenancePackageJson from "./maintenance.json" with { type: "json" };
import networkSnapshotJson from "./osm-manifest.json" with { type: "json" };
import t1AGatesJson from "./gates/t1-a.json" with { type: "json" };
import t1BGatesJson from "./gates/t1-b.json" with { type: "json" };
import t2AGatesJson from "./gates/t2-a.json" with { type: "json" };
import t2BGatesJson from "./gates/t2-b.json" with { type: "json" };
import t2CGatesJson from "./gates/t2-c.json" with { type: "json" };
import {
  adaptAirportConfigurationBundle,
  type AirportConfigurationPackage,
  type AirportConfigurationSourceBundle,
  type AirportNetworkSnapshotManifest,
  type GateLayoutPackage,
} from "../../infrastructure/airportConfig";
import {
  pudongCoordinateConverter,
  pudongLocalCoordinateConverter,
} from "./calibration";

const pudongConfigurationBundle = {
  airportIdent: "ZSPD",
  featurePackages: [
    terminalPackageJson as unknown as AirportConfigurationPackage,
    groundSupportPackageJson as unknown as AirportConfigurationPackage,
    cargoPackageJson as unknown as AirportConfigurationPackage,
    remoteStandsPackageJson as unknown as AirportConfigurationPackage,
    maintenancePackageJson as unknown as AirportConfigurationPackage,
  ],
  gateLayouts: [
    t1AGatesJson,
    t1BGatesJson,
    t2AGatesJson,
    t2BGatesJson,
    t2CGatesJson,
  ].map(
    (layout) => layout as unknown as GateLayoutPackage,
  ),
  networkSnapshot:
    networkSnapshotJson as unknown as AirportNetworkSnapshotManifest,
  networkSnapshotUrl: "/airport-data/ZSPD/osm-raw.json",
} satisfies AirportConfigurationSourceBundle;

const pudongConfigurationIntegration = adaptAirportConfigurationBundle(
  pudongConfigurationBundle,
  {
    coordinateConverter: pudongCoordinateConverter,
    localCoordinateConverter: pudongLocalCoordinateConverter,
  },
);

/** 浦东WGS84运行配置；仅经批准的受控范围可以驱动场面运行。 */
export const pudongGeospatialIntegration = Object.freeze({
  ...pudongConfigurationIntegration,
  mode: "operational" as const,
  runtimeNetworkAuthority: "compiled_geospatial_network" as const,
  warnings: Object.freeze([
    "运行前必须通过WGS84受控路网批准签名核验。",
  ]),
});

export { pudongConfigurationBundle };
