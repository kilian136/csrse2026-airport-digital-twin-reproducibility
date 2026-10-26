/** 仅供旧数据迁移测试使用；浏览器运行入口禁止从这里取得路网权威。 */
export {
  xiaoshanOperationsNetwork as activeAirportLegacyOperationsNetwork,
} from "./xiaoshan/network";

/** 旧百分比路网的米制转换副本，仅用于兼容回归测试。 */
export {
  xiaoshanMetricOperationsNetwork as activeAirportOperationsNetwork,
  xiaoshanMetricOperationsNetwork as activeAirportPlanningNetwork,
} from "./xiaoshan/metricNetwork";
