import { createAirportStateFromConfiguration } from "../../infrastructure/airportConfig";
import { createInitialCoordinationState } from "../../services/coordinationProjector";
import { nanjingGeospatialIntegration } from "./index";
import { nanjingRuntimeResources } from "./runtimeResources";
import { nanjingSurfaceRuntimeState } from "./runtimeState";

const nanjingAirportStateCore = createAirportStateFromConfiguration({
  integration: nanjingGeospatialIntegration,
  surfaceRuntimeState: nanjingSurfaceRuntimeState,
  operationalResources: nanjingRuntimeResources,
});

/** 南京独立机场状态，不继承萧山或浦东的机位、车辆和维修资源。 */
export const nanjingAirportState = {
  ...nanjingAirportStateCore,
  coordination: createInitialCoordinationState(nanjingAirportStateCore),
};
