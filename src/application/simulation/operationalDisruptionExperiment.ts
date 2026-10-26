import { runPreparedResourceConstrainedEventEngine } from "./resourceConstrainedEventEngine";
import {
  prepareSimulationDataset,
  type PrepareSimulationDatasetOptions,
} from "./simulationDataSimulator";
import type {
  SimulationDisturbanceDataSourceAdapters,
  SimulationDisturbanceAdapterContext,
  SimulationEquipmentOutage,
  SimulationRunwayClosure,
  SimulationWeatherWindow,
} from "./simulationDisturbanceDataSources";
import { runSimulationEndToEndAcceptance } from "./simulationEndToEndAcceptance";
import { runSimulationInvariantAudit } from "./simulationInvariants";
import {
  DEFAULT_SIMULATION_PLANNER_CONFIGURATION,
  type SimulationPlannerConfiguration,
} from "./simulationPlannerConfiguration";
import {
  compareSimulationReplayAudits,
  createSimulationReplayAudit,
} from "./simulationReplayAudit";
import type { SimulationScenarioSnapshot } from "./simulationScenarioSnapshot";
import { auditPlannedTransitionGuards } from "./simulationTransitionGuard";

export const OPERATIONAL_DISRUPTION_EXPERIMENT_VERSION = "1.0" as const;

export type OperationalDisruptionCaseId =
  | "baseline"
  | "weather_only"
  | "runway_closure_only"
  | "equipment_outage_only"
  | "combined";

export type OperationalDisruptionCaseResult = Readonly<{
  caseId: OperationalDisruptionCaseId;
  label: string;
  seed: number;
  plannedMissionCount: number;
  completedMissionCount: number;
  completionRate: number;
  operationallyDelayedMissionCount: number;
  operationalDelayRate: number;
  resourceDelayHours: number;
  averageResourceWaitMinutes: number;
  p95ResourceWaitMinutes: number;
  fleetUtilizationRate: number;
  weatherAffectedMissionCount: number;
  runwayClosureAffectedMissionCount: number;
  runwayReassignmentCount: number;
  runwayClosureDelayHours: number;
  equipmentOutageAffectedMissionCount: number;
  equipmentReassignmentCount: number;
  equipmentOutageDelayHours: number;
  acceptanceStatus: "accepted" | "review_required" | "rejected";
  acceptanceScore: number;
  invariantStatus: "passed" | "warning" | "failed";
  invariantViolationCount: number;
  transitionGuardStatus: "passed" | "failed";
  transitionRejectionCount: number;
  transitionRejectionEvidence: readonly string[];
  reproducible: boolean | null;
  replayCheckpointCount: number;
  eventLogFingerprint: string;
  missionCountDeltaFromBaseline: number;
  delayHoursDeltaFromBaseline: number;
}>;

export type OperationalDisruptionExperimentReport = Readonly<{
  schemaVersion: typeof OPERATIONAL_DISRUPTION_EXPERIMENT_VERSION;
  id: string;
  scenarioId: string;
  generatedAt: string;
  seed: number;
  airportCount: number;
  fleetSize: number;
  horizonHours: 72;
  caseCount: number;
  allCasesReproducible: boolean | null;
  allCasesOperationallyValid: boolean;
  cases: readonly OperationalDisruptionCaseResult[];
}>;

export type OperationalDisruptionExperimentOptions = Readonly<{
  seed?: number;
  plannerConfiguration?: SimulationPlannerConfiguration;
  contractOptions?: PrepareSimulationDatasetOptions["contractOptions"];
  verifyReplay?: boolean;
}>;

type DisruptionFlags = Readonly<{
  weather: boolean;
  runwayClosure: boolean;
  equipmentOutage: boolean;
}>;

const CASES: readonly Readonly<{
  id: OperationalDisruptionCaseId;
  label: string;
  flags: DisruptionFlags;
}>[] = Object.freeze([
  Object.freeze({
    id: "baseline" as const,
    label: "正常运行",
    flags: Object.freeze({ weather: false, runwayClosure: false, equipmentOutage: false }),
  }),
  Object.freeze({
    id: "weather_only" as const,
    label: "天气运行限制",
    flags: Object.freeze({ weather: true, runwayClosure: false, equipmentOutage: false }),
  }),
  Object.freeze({
    id: "runway_closure_only" as const,
    label: "跑道临时关闭",
    flags: Object.freeze({ weather: false, runwayClosure: true, equipmentOutage: false }),
  }),
  Object.freeze({
    id: "equipment_outage_only" as const,
    label: "保障车辆故障",
    flags: Object.freeze({ weather: false, runwayClosure: false, equipmentOutage: true }),
  }),
  Object.freeze({
    id: "combined" as const,
    label: "组合运行异常",
    flags: Object.freeze({ weather: true, runwayClosure: true, equipmentOutage: true }),
  }),
]);

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function createAdapters(flags: DisruptionFlags): SimulationDisturbanceDataSourceAdapters {
  return Object.freeze({
    weather: Object.freeze({
      id: flags.weather ? "paper_weather_restriction_v1" : "paper_weather_baseline_v1",
      version: "1.0.0",
      sourceType: "synthetic" as const,
      load: ({ inputContract }: SimulationDisturbanceAdapterContext) => Object.freeze(
        flags.weather
          ? inputContract.airports.map((airport): SimulationWeatherWindow => Object.freeze({
              id: `PAPER-WEATHER-${airport.ident}`,
              airportIdent: airport.ident,
              startOffsetSeconds: 0,
              endOffsetSeconds: 18 * 3_600,
              condition: "low_visibility" as const,
              severity: "severe" as const,
              runwayCapacityFactor: 0.6,
              groundSpeedFactor: 0.65,
            }))
          : [],
      ),
    }),
    traffic: Object.freeze({
      id: "paper_traffic_constant_v1",
      version: "1.0.0",
      sourceType: "synthetic" as const,
      load: () => Object.freeze([]),
    }),
    externalEquipment: Object.freeze({
      id: flags.equipmentOutage
        ? "paper_equipment_outage_v1"
        : "paper_equipment_baseline_v1",
      version: "1.0.0",
      sourceType: "synthetic" as const,
      load: ({ inputContract }: SimulationDisturbanceAdapterContext) => Object.freeze(
        flags.equipmentOutage
          ? inputContract.airports.flatMap((airport) => {
              const firstByCategory = new Map<string, typeof airport.supportVehicles[number]>();
              [...airport.supportVehicles]
                .filter((vehicle) => vehicle.status === "可用")
                .sort((left, right) => left.id.localeCompare(right.id))
                .forEach((vehicle) => {
                  if (!firstByCategory.has(vehicle.category)) {
                    firstByCategory.set(vehicle.category, vehicle);
                  }
                });
              return [...firstByCategory.values()].map(
                (vehicle): SimulationEquipmentOutage => Object.freeze({
                  id: `PAPER-EQUIPMENT-${airport.ident}-${vehicle.id}`,
                  airportIdent: airport.ident,
                  equipmentId: vehicle.id,
                  equipmentCategory: vehicle.category,
                  startOffsetSeconds: 0,
                  endOffsetSeconds: 14 * 3_600,
                  reason: "simulated_failure" as const,
                }),
              );
            })
          : [],
      ),
    }),
    runwayOperations: Object.freeze({
      id: flags.runwayClosure
        ? "paper_runway_closure_v1"
        : "paper_runway_baseline_v1",
      version: "1.0.0",
      sourceType: "synthetic" as const,
      load: ({ inputContract }: SimulationDisturbanceAdapterContext) => Object.freeze(
        flags.runwayClosure
          ? inputContract.airports.map((airport): SimulationRunwayClosure => {
              const runway = [...airport.runways].sort(
                (left, right) =>
                  left.lengthMeters - right.lengthMeters || left.id.localeCompare(right.id),
              )[0];
              if (!runway) {
                throw new Error(`论文异常实验要求机场${airport.ident}具有正式跑道档案。`);
              }
              return Object.freeze({
                id: `PAPER-RUNWAY-CLOSURE-${airport.ident}-${runway.id}`,
                airportIdent: airport.ident,
                runwayId: runway.id,
                startOffsetSeconds: 4 * 3_600,
                endOffsetSeconds: 14 * 3_600,
                reason: "inspection" as const,
              });
            })
          : [],
      ),
    }),
  });
}

function runCase(
  scenario: SimulationScenarioSnapshot,
  configuration: SimulationPlannerConfiguration,
  contractOptions: PrepareSimulationDatasetOptions["contractOptions"],
  definition: typeof CASES[number],
  verifyReplay: boolean,
) {
  const disturbanceAdapters = createAdapters(definition.flags);
  const prepare = () => prepareSimulationDataset(scenario, {
    plannerConfiguration: configuration,
    contractOptions,
    disturbanceAdapters,
  });
  const dataset = prepare();
  const result = runPreparedResourceConstrainedEventEngine(
    dataset.inputContract,
    dataset.taskPlan,
    dataset.plannerOptions,
  );
  const acceptance = runSimulationEndToEndAcceptance(dataset.inputContract, result);
  const invariants = runSimulationInvariantAudit(dataset.inputContract, result);
  const transitionGuards = auditPlannedTransitionGuards(dataset.inputContract, result);
  const replay = createSimulationReplayAudit(dataset.inputContract, result);

  const replayComparison = verifyReplay
    ? (() => {
        const repeatedDataset = prepare();
        const repeatedResult = runPreparedResourceConstrainedEventEngine(
          repeatedDataset.inputContract,
          repeatedDataset.taskPlan,
          repeatedDataset.plannerOptions,
        );
        return compareSimulationReplayAudits(
          replay,
          createSimulationReplayAudit(repeatedDataset.inputContract, repeatedResult),
        );
      })()
    : null;
  const completedMissionIds = new Set(
    result.events
      .filter((event) => event.type === "flight_arrived" && event.missionId)
      .map((event) => event.missionId as string),
  );
  const missionCount = result.metrics.plannedMissionCount;
  const runwayClosureAffected = result.missions.filter((mission) =>
    mission.constraintReasons.includes("runway_closure")
  );
  const equipmentAffected = result.missions.filter((mission) =>
    mission.disturbanceImpact.equipmentOutageReassignmentCount > 0 ||
    mission.disturbanceImpact.equipmentOutageDelaySeconds > 0
  );
  return {
    definition,
    scenario: dataset.inputContract,
    summary: {
      caseId: definition.id,
      label: definition.label,
      seed: configuration.seed,
      plannedMissionCount: missionCount,
      completedMissionCount: completedMissionIds.size,
      completionRate: round(completedMissionIds.size / Math.max(1, missionCount)),
      operationallyDelayedMissionCount:
        result.operationalTiming.operationallyDelayedMissionCount,
      operationalDelayRate: round(
        result.operationalTiming.operationallyDelayedMissionCount / Math.max(1, missionCount),
      ),
      resourceDelayHours: result.operationalTiming.totalResourceWaitHours,
      averageResourceWaitMinutes: result.operationalTiming.averageResourceWaitMinutes,
      p95ResourceWaitMinutes: result.operationalTiming.p95ResourceWaitMinutes,
      fleetUtilizationRate: result.metrics.fleetUtilizationRate,
      weatherAffectedMissionCount: result.missions.filter((mission) =>
        mission.disturbanceImpact.departureRunwayCapacityFactor < 1 ||
        mission.disturbanceImpact.arrivalRunwayCapacityFactor < 1 ||
        mission.disturbanceImpact.groundSpeedFactor < 1
      ).length,
      runwayClosureAffectedMissionCount: runwayClosureAffected.length,
      runwayReassignmentCount: result.missions.filter(
        (mission) => mission.disturbanceImpact.runwayReassignedByClosure,
      ).length,
      runwayClosureDelayHours: round(result.missions.reduce(
        (sum, mission) => sum +
          mission.disturbanceImpact.departureRunwayClosureDelaySeconds +
          mission.disturbanceImpact.arrivalRunwayClosureDelaySeconds,
        0,
      ) / 3_600),
      equipmentOutageAffectedMissionCount: equipmentAffected.length,
      equipmentReassignmentCount: result.missions.reduce(
        (sum, mission) =>
          sum + mission.disturbanceImpact.equipmentOutageReassignmentCount,
        0,
      ),
      equipmentOutageDelayHours: round(result.missions.reduce(
        (sum, mission) =>
          sum + mission.disturbanceImpact.equipmentOutageDelaySeconds,
        0,
      ) / 3_600),
      acceptanceStatus: acceptance.status,
      acceptanceScore: acceptance.score,
      invariantStatus: invariants.status,
      invariantViolationCount: invariants.violationCount,
      transitionGuardStatus: transitionGuards.status,
      transitionRejectionCount: transitionGuards.rejectedTransitionCount,
      transitionRejectionEvidence: Object.freeze(
        transitionGuards.rejected.flatMap((item) =>
          item.decision.rejections.map(
            (rejection) =>
              `${item.eventId}@${item.offsetSeconds}s ${rejection.ruleId}: ${rejection.message}`,
          )
        ).slice(0, 10),
      ),
      reproducible: replayComparison?.reproducible ?? null,
      replayCheckpointCount: replay.checkpointCount,
      eventLogFingerprint: replay.eventLogFingerprint,
      missionCountDeltaFromBaseline: 0,
      delayHoursDeltaFromBaseline: 0,
    },
  } as const;
}

/**
 * 在同一机场快照、机队、任务参数和随机种子下执行五组对照试验。
 * 唯一变化量是外部运行异常，适用于论文消融与鲁棒性实验。
 */
export function runOperationalDisruptionExperimentMatrix(
  scenario: SimulationScenarioSnapshot,
  options: OperationalDisruptionExperimentOptions = {},
): OperationalDisruptionExperimentReport {
  const missingRunwayProfiles = scenario.airportSlots
    .filter((slot) => slot.status === "ready")
    .map((slot) => slot.snapshot.airportIdent)
    .filter(
      (airportIdent) =>
        (options.contractOptions?.runwayProfilesByAirport?.[airportIdent]?.length ?? 0) === 0,
    );
  if (missingRunwayProfiles.length > 0) {
    throw new Error(
      `论文异常实验要求机场${missingRunwayProfiles.join("、")}具有正式跑道档案。`,
    );
  }
  const seed = options.seed ?? options.plannerConfiguration?.seed ??
    DEFAULT_SIMULATION_PLANNER_CONFIGURATION.seed;
  const configuration = Object.freeze({
    ...(options.plannerConfiguration ?? DEFAULT_SIMULATION_PLANNER_CONFIGURATION),
    seed,
  });
  const runs = CASES.map((definition) => runCase(
    scenario,
    configuration,
    options.contractOptions,
    definition,
    options.verifyReplay ?? true,
  ));
  const baseline = runs.find((run) => run.definition.id === "baseline");
  if (!baseline) throw new Error("异常实验矩阵缺少基准组。 ");
  const cases = runs.map(({ summary }) => Object.freeze({
    ...summary,
    missionCountDeltaFromBaseline:
      summary.plannedMissionCount - baseline.summary.plannedMissionCount,
    delayHoursDeltaFromBaseline: round(
      summary.resourceDelayHours - baseline.summary.resourceDelayHours,
    ),
  }));
  return Object.freeze({
    schemaVersion: OPERATIONAL_DISRUPTION_EXPERIMENT_VERSION,
    id: `OPERATIONAL-DISRUPTION-${scenario.id}-SEED-${seed}`,
    scenarioId: scenario.id,
    generatedAt: scenario.capturedAt,
    seed,
    airportCount: baseline.scenario.airports.length,
    fleetSize: baseline.scenario.aircraft.length,
    horizonHours: 72 as const,
    caseCount: cases.length,
    allCasesReproducible: cases.every((item) => item.reproducible !== null)
      ? cases.every((item) => item.reproducible === true)
      : null,
    allCasesOperationallyValid: cases.every(
      (item) =>
        item.acceptanceStatus === "accepted" &&
        item.invariantStatus === "passed" &&
        item.transitionGuardStatus === "passed",
    ),
    cases: Object.freeze(cases),
  });
}

function csvCell(value: string | number | boolean | null) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function operationalDisruptionExperimentToCsv(
  report: OperationalDisruptionExperimentReport,
) {
  const columns = [
    "case_id",
    "label",
    "seed",
    "planned_missions",
    "completed_missions",
    "completion_rate",
    "operational_delay_rate",
    "resource_delay_hours",
    "fleet_utilization_rate",
    "weather_affected_missions",
    "runway_affected_missions",
    "runway_reassignments",
    "runway_closure_delay_hours",
    "equipment_affected_missions",
    "equipment_reassignments",
    "equipment_outage_delay_hours",
    "invariant_violations",
    "transition_rejections",
    "reproducible",
  ] as const;
  const rows = report.cases.map((item) => [
    item.caseId,
    item.label,
    item.seed,
    item.plannedMissionCount,
    item.completedMissionCount,
    item.completionRate,
    item.operationalDelayRate,
    item.resourceDelayHours,
    item.fleetUtilizationRate,
    item.weatherAffectedMissionCount,
    item.runwayClosureAffectedMissionCount,
    item.runwayReassignmentCount,
    item.runwayClosureDelayHours,
    item.equipmentOutageAffectedMissionCount,
    item.equipmentReassignmentCount,
    item.equipmentOutageDelayHours,
    item.invariantViolationCount,
    item.transitionRejectionCount,
    item.reproducible,
  ]);
  return [columns, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}
