import { createAirportStateFromConfiguration } from "../../infrastructure/airportConfig";
import { createInitialCoordinationState } from "../../services/coordinationProjector";
import { pudongGeospatialIntegration } from "./index";
import { pudongRuntimeResources } from "./runtimeResources";
import { pudongSurfaceRuntimeState } from "./runtimeState";

const pudongAirportStateCore = createAirportStateFromConfiguration({
  integration: pudongGeospatialIntegration,
  surfaceRuntimeState: pudongSurfaceRuntimeState,
  operationalResources: pudongRuntimeResources,
});

/**
 * 上海浦东独立完整状态。机场专属数据全部来自ZSPD配置包；共享业务模块
 * 只通过AirportState契约读取，不继承萧山的机位、部门或车辆。
 */
export const pudongAirportState = {
  ...pudongAirportStateCore,
  coordination: createInitialCoordinationState(pudongAirportStateCore),
};
