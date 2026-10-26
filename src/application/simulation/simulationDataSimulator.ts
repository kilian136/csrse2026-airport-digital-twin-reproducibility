import {
  createFleet72hTaskPlan,
  type Fleet72hTaskPlan,
  type Fleet72hTaskPlannerOptions,
} from "./fleet72hTaskPlanner";
import {
  buildSimulationInputContract,
  type BuildSimulationInputContractOptions,
  type SimulationInputContract,
} from "./simulationContract";
import {
  toFleet72hTaskPlannerOptions,
  type SimulationPlannerConfiguration,
} from "./simulationPlannerConfiguration";
import type { SimulationScenarioSnapshot } from "./simulationScenarioSnapshot";
import {
  DEFAULT_SIMULATION_DISTURBANCE_ADAPTERS,
  prepareSimulationDisturbanceDataset,
  type SimulationDisturbanceDataset,
  type SimulationDisturbanceDataSourceAdapters,
} from "./simulationDisturbanceDataSources";

export const SIMULATION_DATA_SIMULATOR_ID = "airport_72h_data_simulator_v1";

export type PreparedSimulationDataset = Readonly<{
  schemaVersion: "1.0";
  simulatorId: typeof SIMULATION_DATA_SIMULATOR_ID;
  id: string;
  scenarioId: string;
  generatedAt: string;
  seed: number;
  inputContract: SimulationInputContract;
  plannerOptions: Fleet72hTaskPlannerOptions;
  taskPlan: Fleet72hTaskPlan;
  disturbances: SimulationDisturbanceDataset;
  provenance: readonly Readonly<{
    stage:
      | "snapshot_adapter"
      | "synthetic_demand_generator"
      | "weather_adapter"
      | "traffic_adapter"
      | "external_equipment_adapter"
      | "runway_operations_adapter";
    source: string;
    note: string;
  }>[];
}>;

export type PrepareSimulationDatasetOptions = Readonly<{
  plannerConfiguration: SimulationPlannerConfiguration;
  contractOptions?: Omit<BuildSimulationInputContractOptions, "seed">;
  disturbanceAdapters?: SimulationDisturbanceDataSourceAdapters;
}>;

/**
 * 数据模拟器只负责把隔离快照和试验参数变成可复现的输入数据集。
 * 运行内核必须消费这里冻结的taskPlan，不能在执行阶段重新抽样任务需求。
 */
export function prepareSimulationDataset(
  scenario: SimulationScenarioSnapshot,
  options: PrepareSimulationDatasetOptions,
): PreparedSimulationDataset {
  const inputContract = buildSimulationInputContract(scenario, {
    ...options.contractOptions,
    seed: options.plannerConfiguration.seed,
  });
  const disturbanceAdapters = options.disturbanceAdapters ??
    DEFAULT_SIMULATION_DISTURBANCE_ADAPTERS;
  const disturbances = prepareSimulationDisturbanceDataset(
    inputContract,
    options.plannerConfiguration.seed,
    disturbanceAdapters,
  );
  const plannerOptions = Object.freeze({
    ...toFleet72hTaskPlannerOptions(options.plannerConfiguration),
    disturbances,
  });
  const taskPlan = createFleet72hTaskPlan(inputContract, plannerOptions);
  return Object.freeze({
    schemaVersion: "1.0" as const,
    simulatorId: SIMULATION_DATA_SIMULATOR_ID,
    id: `SIM-DATASET-${scenario.id}-SEED-${options.plannerConfiguration.seed}`,
    scenarioId: scenario.id,
    generatedAt: scenario.capturedAt,
    seed: options.plannerConfiguration.seed,
    inputContract,
    plannerOptions,
    taskPlan,
    disturbances,
    provenance: Object.freeze([
      Object.freeze({
        stage: "snapshot_adapter" as const,
        source: inputContract.id,
        note: "实时状态隔离快照已转换为稳定仿真输入契约。",
      }),
      Object.freeze({
        stage: "synthetic_demand_generator" as const,
        source: taskPlan.plannerId,
        note: "当前三日任务、故障窗口与资源需求由固定种子合成；后续可替换为正式计划数据源。",
      }),
      ...disturbances.sources.map((source) => Object.freeze({
        stage: source.domain === "weather"
          ? "weather_adapter" as const
          : source.domain === "traffic"
            ? "traffic_adapter" as const
            : source.domain === "runway_operations"
              ? "runway_operations_adapter" as const
              : "external_equipment_adapter" as const,
        source: `${source.adapterId}@${source.version}`,
        note: source.note,
      })),
    ]),
  });
}

