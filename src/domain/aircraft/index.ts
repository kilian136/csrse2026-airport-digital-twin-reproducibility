/** 飞机领域的稳定公共类型入口。 */
export type {
  Aircraft,
  AircraftPosition,
  AircraftStatus,
  PositionSource,
  RiskLevel,
} from "../../types/airport";
export type {
  AircraftComponentHealth,
  AircraftHealthProfile,
  AircraftHealthRisk,
} from "./health";
export {
  createAssumedAircraftHealthProfile,
  findAircraftEngine,
} from "./health";
