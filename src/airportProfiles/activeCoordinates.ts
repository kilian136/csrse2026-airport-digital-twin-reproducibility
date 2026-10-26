import { createAirportPositionProjector } from "../domain/geo";
import {
  xiaoshanCoordinateConverter,
  xiaoshanLocalCoordinateConverter,
} from "./xiaoshan/calibration";

/** 更换机场时只需要在此处替换坐标投影器。 */
export const activeAirportPositionProjector =
  createAirportPositionProjector(
    xiaoshanCoordinateConverter,
    xiaoshanLocalCoordinateConverter,
  );

/** 运行决策只使用局部米制坐标；更换机场时与投影器一并替换。 */
export const activeAirportLocalCoordinateConverter =
  xiaoshanLocalCoordinateConverter;
