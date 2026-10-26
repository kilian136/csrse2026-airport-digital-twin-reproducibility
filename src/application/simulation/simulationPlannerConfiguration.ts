import type { Fleet72hTaskPlannerOptions } from "./fleet72hTaskPlanner";

export type SimulationPlannerConfiguration = Readonly<{
  seed: number;
  maximumMissionsPerAircraft: number;
  simulatedFaultProbability: number;
  emergencyIncidentProbability: number;
  runwaySeparationSeconds: number;
  groundSupportServiceMinutes: number;
  supportTeamCapacity: number;
}>;

export const DEFAULT_SIMULATION_PLANNER_CONFIGURATION: SimulationPlannerConfiguration =
  Object.freeze({
    seed: 42,
    maximumMissionsPerAircraft: 5,
    simulatedFaultProbability: 0.025,
    emergencyIncidentProbability: 0.01,
    runwaySeparationSeconds: 180,
    groundSupportServiceMinutes: 30,
    supportTeamCapacity: 6,
  });

export type SimulationScenarioPresetId =
  | "baseline"
  | "peak_demand"
  | "fault_pressure";

export type SimulationScenarioPreset = Readonly<{
  id: SimulationScenarioPresetId;
  label: string;
  description: string;
  configuration: SimulationPlannerConfiguration;
}>;

export const SIMULATION_SCENARIO_PRESETS: readonly SimulationScenarioPreset[] =
  Object.freeze([
    Object.freeze({
      id: "baseline" as const,
      label: "基准运行方案",
      description: "当前三机场常态资源和中等任务强度。",
      configuration: DEFAULT_SIMULATION_PLANNER_CONFIGURATION,
    }),
    Object.freeze({
      id: "peak_demand" as const,
      label: "航班高峰方案",
      description: "提高单机任务量，并投入更多保障并行资源。",
      configuration: Object.freeze({
        ...DEFAULT_SIMULATION_PLANNER_CONFIGURATION,
        maximumMissionsPerAircraft: 8,
        runwaySeparationSeconds: 150,
        groundSupportServiceMinutes: 25,
        supportTeamCapacity: 8,
      }),
    }),
    Object.freeze({
      id: "fault_pressure" as const,
      label: "故障压力方案",
      description: "提高故障概率并收紧跑道与地面保障能力。",
      configuration: Object.freeze({
        ...DEFAULT_SIMULATION_PLANNER_CONFIGURATION,
        simulatedFaultProbability: 0.15,
        emergencyIncidentProbability: 0.08,
        runwaySeparationSeconds: 240,
        groundSupportServiceMinutes: 60,
        supportTeamCapacity: 3,
      }),
    }),
  ]);

export function assertSimulationPlannerConfiguration(
  configuration: SimulationPlannerConfiguration,
) {
  const emergencyIncidentProbability =
    configuration.emergencyIncidentProbability ??
    DEFAULT_SIMULATION_PLANNER_CONFIGURATION.emergencyIncidentProbability;
  if (!Number.isInteger(configuration.seed) || configuration.seed < 1) {
    throw new Error("随机种子必须是大于0的整数。");
  }
  if (
    !Number.isInteger(configuration.maximumMissionsPerAircraft) ||
    configuration.maximumMissionsPerAircraft < 1 ||
    configuration.maximumMissionsPerAircraft > 12
  ) {
    throw new Error("单机任务上限必须是1至12之间的整数。");
  }
  if (
    !Number.isFinite(configuration.simulatedFaultProbability) ||
    configuration.simulatedFaultProbability < 0 ||
    configuration.simulatedFaultProbability > 0.25
  ) {
    throw new Error("模拟故障概率必须位于0%至25%之间。");
  }
  if (
    !Number.isFinite(emergencyIncidentProbability) ||
    emergencyIncidentProbability < 0 ||
    emergencyIncidentProbability > 0.1
  ) {
    throw new Error("应急事件概率必须位于0%至10%之间。");
  }
  if (
    !Number.isInteger(configuration.runwaySeparationSeconds) ||
    configuration.runwaySeparationSeconds < 60 ||
    configuration.runwaySeparationSeconds > 600
  ) {
    throw new Error("跑道运行间隔必须是60至600秒之间的整数。");
  }
  if (
    !Number.isInteger(configuration.groundSupportServiceMinutes) ||
    configuration.groundSupportServiceMinutes < 10 ||
    configuration.groundSupportServiceMinutes > 180
  ) {
    throw new Error("单次保障服务时长必须是10至180分钟之间的整数。");
  }
  if (
    !Number.isInteger(configuration.supportTeamCapacity) ||
    configuration.supportTeamCapacity < 1 ||
    configuration.supportTeamCapacity > 12
  ) {
    throw new Error("保障并行容量必须是1至12之间的整数。");
  }
}

export function toFleet72hTaskPlannerOptions(
  configuration: SimulationPlannerConfiguration,
): Fleet72hTaskPlannerOptions {
  assertSimulationPlannerConfiguration(configuration);
  return Object.freeze({
    seed: configuration.seed,
    maximumMissionsPerAircraft: configuration.maximumMissionsPerAircraft,
    simulatedFaultProbability: configuration.simulatedFaultProbability,
    emergencyIncidentProbability:
      configuration.emergencyIncidentProbability ??
      DEFAULT_SIMULATION_PLANNER_CONFIGURATION.emergencyIncidentProbability,
    runwaySeparationSeconds: configuration.runwaySeparationSeconds,
    groundSupportServiceSeconds:
      configuration.groundSupportServiceMinutes * 60,
    supportTeamCapacity: configuration.supportTeamCapacity,
  });
}
