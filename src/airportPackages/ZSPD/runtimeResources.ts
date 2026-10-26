import { materializeAirportOperationalResources } from "../../infrastructure/airportConfig";
import { pudongGeospatialIntegration } from "./index";
import { pudongOperationalResources } from "./operationalResources";

/** 浦东仿真规划资源状态；不改变用户核实数据的证据等级。 */
export const pudongRuntimeResources = materializeAirportOperationalResources(
  pudongOperationalResources,
  pudongGeospatialIntegration,
);
