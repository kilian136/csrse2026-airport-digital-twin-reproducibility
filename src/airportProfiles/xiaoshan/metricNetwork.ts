import { createMetricOperationsNetwork } from "../networkMetricDistances";
import { xiaoshanLocalCoordinateConverter } from "./calibration";
import { xiaoshanOperationsNetwork } from "./network";

/**
 * 萧山机场真实米制路网副本。
 * 原始路网继续作为坐标和人工配置源；规划器将在分阶段验证后切换到本路网。
 */
export const xiaoshanMetricOperationsNetwork =
  createMetricOperationsNetwork(
    xiaoshanOperationsNetwork,
    xiaoshanLocalCoordinateConverter,
  );
