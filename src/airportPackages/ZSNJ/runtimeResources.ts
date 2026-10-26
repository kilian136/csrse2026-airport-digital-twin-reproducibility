import { materializeAirportOperationalResources } from "../../infrastructure/airportConfig";
import { nanjingGeospatialIntegration } from "./index";
import { nanjingOperationalResources } from "./operationalResources";

/** 南京仿真规划资源状态；真实车辆编制仍须由正式资料替换。 */
export const nanjingRuntimeResources = materializeAirportOperationalResources(
  nanjingOperationalResources,
  nanjingGeospatialIntegration,
);
