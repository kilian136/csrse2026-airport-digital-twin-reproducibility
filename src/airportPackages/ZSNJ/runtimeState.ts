import { AIRPORT_FLEET_ALLOCATION } from "../../domain/fleetIdentity";
import {
  createAirportSurfaceRuntimeState,
} from "../../infrastructure/airportConfig";
import { nanjingGeospatialIntegration } from "./index";

/**
 * 南京运行态直接使用已批准为active的138个WGS84运行机位。
 * 17架共享机队飞机只占用其中17个机位，其余机位保持可调度，避免出现
 * “地图有机位、运行内核只有17个机位”的双重权威。
 */
export const nanjingSurfaceRuntimeState = createAirportSurfaceRuntimeState({
  airportIdent: "ZSNJ",
  configurationFeatures: nanjingGeospatialIntegration.features,
  aircraftSerials: AIRPORT_FLEET_ALLOCATION.ZSNJ.serials,
  generatedAt: "2026-10-19T00:00:00.000Z",
  targetOccupancyRatio: 0.55,
  maximumOccupiedStandCount: AIRPORT_FLEET_ALLOCATION.ZSNJ.count,
  commandDispatch: true,
  includeAllOperationalStandKinds: true,
});
