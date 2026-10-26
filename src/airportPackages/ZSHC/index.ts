import maintenancePackageJson from "./maintenance.json" with { type: "json" };
import networkSnapshotJson from "./osm-manifest.json" with { type: "json" };
import groundSupportPackageJson from "./ground-support.json" with { type: "json" };
import terminalPackageJson from "./terminal.json" with { type: "json" };
import t2AGatesJson from "./gates/t2-a.json" with { type: "json" };
import t2BGatesJson from "./gates/t2-b.json" with { type: "json" };
import t2CGatesJson from "./gates/t2-c.json" with { type: "json" };
import t2DGatesJson from "./gates/t2-d.json" with { type: "json" };
import {
  xiaoshanCoordinateConverter,
  xiaoshanLocalCoordinateConverter,
} from "../../airportProfiles/xiaoshan/calibration";
import {
  adaptAirportConfigurationBundle,
  type AirportConfigurationPackage,
  type AirportConfigurationSourceBundle,
  type AirportNetworkSnapshotManifest,
  type GateLayoutPackage,
} from "../../infrastructure/airportConfig";

const xiaoshanConfigurationBundle = {
  airportIdent: "ZSHC",
  featurePackages: [
    terminalPackageJson as unknown as AirportConfigurationPackage,
    maintenancePackageJson as unknown as AirportConfigurationPackage,
    groundSupportPackageJson as unknown as AirportConfigurationPackage,
  ],
  gateLayouts: [
    t2AGatesJson,
    t2BGatesJson,
    t2CGatesJson,
    t2DGatesJson,
  ].map((layout) => layout as unknown as GateLayoutPackage),
  networkSnapshot:
    networkSnapshotJson as unknown as AirportNetworkSnapshotManifest,
  networkSnapshotUrl: "/airport-data/ZSHC/osm-raw.json",
} satisfies AirportConfigurationSourceBundle;

const xiaoshanConfigurationIntegration =
  adaptAirportConfigurationBundle(xiaoshanConfigurationBundle, {
    coordinateConverter: xiaoshanCoordinateConverter,
    localCoordinateConverter: xiaoshanLocalCoordinateConverter,
  });

/**
 * 萧山WGS84运行配置。启动时必须经过候选编译、批准签名核验和受控安装，
 * 旧AirportProfile路网不再取得运行权威。
 */
export const xiaoshanGeospatialIntegration = Object.freeze({
  ...xiaoshanConfigurationIntegration,
  mode: "operational" as const,
  runtimeNetworkAuthority: "compiled_geospatial_network" as const,
  warnings: Object.freeze([
    "运行前必须通过WGS84受控路网批准签名核验。",
  ]),
});

export { xiaoshanConfigurationBundle };
