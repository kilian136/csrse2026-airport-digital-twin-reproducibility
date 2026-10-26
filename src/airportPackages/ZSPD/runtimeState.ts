import { createAirportSurfaceRuntimeState } from "../../infrastructure/airportConfig";
import { pudongGeospatialIntegration } from "./index";
import {
  AIRPORT_FLEET_ALLOCATION,
  FLEET_NUMBERING,
} from "../../domain/fleetIdentity";

/**
 * 浦东已开放受控飞机滑行；维修区和T1牵引车驻点已标定，
 * 车辆车型/数量及维修人员设备库存当前使用独立的仿真规划配置；真实参数仍待确认。
 */
export const pudongSurfaceRuntimeState = createAirportSurfaceRuntimeState({
  airportIdent: "ZSPD",
  configurationFeatures: pudongGeospatialIntegration.features,
  aircraftSerialStart: FLEET_NUMBERING.pudongInitialStart,
  aircraftSerials: AIRPORT_FLEET_ALLOCATION.ZSPD.serials,
  generatedAt: "2026-10-04T00:00:00.000Z",
  targetOccupancyRatio: 0.55,
  maximumOccupiedStandCount: AIRPORT_FLEET_ALLOCATION.ZSPD.count,
  commandDispatch: true,
});
