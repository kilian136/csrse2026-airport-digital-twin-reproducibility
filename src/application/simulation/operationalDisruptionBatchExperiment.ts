import {
  runOperationalDisruptionExperimentMatrix,
  type OperationalDisruptionCaseId,
  type OperationalDisruptionCaseResult,
  type OperationalDisruptionExperimentOptions,
} from "./operationalDisruptionExperiment";
import type { SimulationScenarioSnapshot } from "./simulationScenarioSnapshot";

export const OPERATIONAL_DISRUPTION_BATCH_VERSION = "1.0" as const;

export type DescriptiveStatistic = Readonly<{
  mean: number;
  sampleStandardDeviation: number;
  confidence95Lower: number;
  confidence95Upper: number;
}>;

export type PairedEffect = Readonly<{
  meanDifference: number;
  sampleStandardDeviation: number;
  confidence95Lower: number;
  confidence95Upper: number;
  standardizedEffectDz: number;
}>;

export type OperationalDisruptionBatchAggregate = Readonly<{
  caseId: OperationalDisruptionCaseId;
  label: string;
  runCount: number;
  operationallyValidRunCount: number;
  operationalValidityRate: number;
  plannedMissionCount: DescriptiveStatistic;
  completionRate: DescriptiveStatistic;
  operationalDelayRate: DescriptiveStatistic;
  resourceDelayHours: DescriptiveStatistic;
  fleetUtilizationRate: DescriptiveStatistic;
  weatherAffectedMissionCount: DescriptiveStatistic;
  runwayReassignmentCount: DescriptiveStatistic;
  equipmentReassignmentCount: DescriptiveStatistic;
  resourceDelayEffectVsBaseline: PairedEffect;
  operationalDelayRateEffectVsBaseline: PairedEffect;
}>;

export type OperationalDisruptionBatchReport = Readonly<{
  schemaVersion: typeof OPERATIONAL_DISRUPTION_BATCH_VERSION;
  id: string;
  scenarioId: string;
  generatedAt: string;
  firstSeed: number;
  runCountPerCase: number;
  totalRunCount: number;
  caseCount: number;
  airportCount: number;
  fleetSize: number;
  allRunsOperationallyValid: boolean;
  deterministicReplayVerified: boolean;
  aggregates: readonly OperationalDisruptionBatchAggregate[];
  trials: readonly OperationalDisruptionCaseResult[];
}>;

export type OperationalDisruptionBatchOptions = Readonly<
  Omit<OperationalDisruptionExperimentOptions, "seed" | "verifyReplay"> & {
    firstSeed?: number;
    runsPerCase?: number;
    verifyFirstSeedReplay?: boolean;
    onSeedCompleted?: (completedSeedCount: number, totalSeedCount: number) => void;
  }
>;

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function sampleStandardDeviation(values: readonly number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (values.length - 1),
  );
}

const T_CRITICAL_95: readonly number[] = Object.freeze([
  0,
  12.706,
  4.303,
  3.182,
  2.776,
  2.571,
  2.447,
  2.365,
  2.306,
  2.262,
  2.228,
  2.201,
  2.179,
  2.16,
  2.145,
  2.131,
  2.12,
  2.11,
  2.101,
  2.093,
  2.086,
  2.08,
  2.074,
  2.069,
  2.064,
  2.06,
  2.056,
  2.052,
  2.048,
  2.045,
]);

function statistic(values: readonly number[]): DescriptiveStatistic {
  const mean = average(values);
  const deviation = sampleStandardDeviation(values);
  const degreesOfFreedom = Math.max(1, values.length - 1);
  const critical = T_CRITICAL_95[Math.min(29, degreesOfFreedom)] ?? 1.96;
  const margin = critical * deviation / Math.sqrt(Math.max(1, values.length));
  return Object.freeze({
    mean: round(mean),
    sampleStandardDeviation: round(deviation),
    confidence95Lower: round(mean - margin),
    confidence95Upper: round(mean + margin),
  });
}

function pairedEffect(values: readonly number[]): PairedEffect {
  const summary = statistic(values);
  return Object.freeze({
    meanDifference: summary.mean,
    sampleStandardDeviation: summary.sampleStandardDeviation,
    confidence95Lower: summary.confidence95Lower,
    confidence95Upper: summary.confidence95Upper,
    standardizedEffectDz: round(
      summary.sampleStandardDeviation > 0
        ? summary.mean / summary.sampleStandardDeviation
        : summary.mean === 0
          ? 0
          : Math.sign(summary.mean) * Number.MAX_SAFE_INTEGER,
    ),
  });
}

function isOperationallyValid(item: OperationalDisruptionCaseResult) {
  return item.acceptanceStatus === "accepted" &&
    item.invariantStatus === "passed" &&
    item.transitionGuardStatus === "passed";
}

export function runOperationalDisruptionBatchExperiment(
  scenario: SimulationScenarioSnapshot,
  options: OperationalDisruptionBatchOptions = {},
): OperationalDisruptionBatchReport {
  const firstSeed = options.firstSeed ?? 42;
  const runsPerCase = options.runsPerCase ?? 20;
  if (!Number.isInteger(firstSeed) || firstSeed < 1) {
    throw new Error("批量异常实验首个种子必须是大于0的整数。 ");
  }
  if (!Number.isInteger(runsPerCase) || runsPerCase < 2 || runsPerCase > 30) {
    throw new Error("批量异常实验每组轮数必须是2至30之间的整数。 ");
  }

  const trials: OperationalDisruptionCaseResult[] = [];
  for (let index = 0; index < runsPerCase; index += 1) {
    const matrix = runOperationalDisruptionExperimentMatrix(scenario, {
      plannerConfiguration: options.plannerConfiguration,
      contractOptions: options.contractOptions,
      seed: firstSeed + index,
      verifyReplay: false,
    });
    trials.push(...matrix.cases);
    options.onSeedCompleted?.(index + 1, runsPerCase);
  }
  const baselineBySeed = new Map(
    trials
      .filter((item) => item.caseId === "baseline")
      .map((item) => [item.seed, item]),
  );
  const caseIds = [...new Set(trials.map((item) => item.caseId))];
  const aggregates = caseIds.map((caseId) => {
    const caseTrials = trials.filter((item) => item.caseId === caseId);
    const validCount = caseTrials.filter(isOperationallyValid).length;
    const resourceDelayDifferences = caseTrials.map((item) =>
      item.resourceDelayHours - (baselineBySeed.get(item.seed)?.resourceDelayHours ?? 0)
    );
    const delayRateDifferences = caseTrials.map((item) =>
      item.operationalDelayRate -
        (baselineBySeed.get(item.seed)?.operationalDelayRate ?? 0)
    );
    return Object.freeze({
      caseId,
      label: caseTrials[0]?.label ?? caseId,
      runCount: caseTrials.length,
      operationallyValidRunCount: validCount,
      operationalValidityRate: round(validCount / Math.max(1, caseTrials.length)),
      plannedMissionCount: statistic(caseTrials.map((item) => item.plannedMissionCount)),
      completionRate: statistic(caseTrials.map((item) => item.completionRate)),
      operationalDelayRate: statistic(caseTrials.map((item) => item.operationalDelayRate)),
      resourceDelayHours: statistic(caseTrials.map((item) => item.resourceDelayHours)),
      fleetUtilizationRate: statistic(caseTrials.map((item) => item.fleetUtilizationRate)),
      weatherAffectedMissionCount: statistic(
        caseTrials.map((item) => item.weatherAffectedMissionCount),
      ),
      runwayReassignmentCount: statistic(
        caseTrials.map((item) => item.runwayReassignmentCount),
      ),
      equipmentReassignmentCount: statistic(
        caseTrials.map((item) => item.equipmentReassignmentCount),
      ),
      resourceDelayEffectVsBaseline: pairedEffect(resourceDelayDifferences),
      operationalDelayRateEffectVsBaseline: pairedEffect(delayRateDifferences),
    });
  });
  const replayVerification = options.verifyFirstSeedReplay === false
    ? null
    : runOperationalDisruptionExperimentMatrix(scenario, {
        plannerConfiguration: options.plannerConfiguration,
        contractOptions: options.contractOptions,
        seed: firstSeed,
        verifyReplay: true,
      });
  return Object.freeze({
    schemaVersion: OPERATIONAL_DISRUPTION_BATCH_VERSION,
    id: `OPERATIONAL-DISRUPTION-BATCH-${scenario.id}-${firstSeed}-${runsPerCase}`,
    scenarioId: scenario.id,
    generatedAt: scenario.capturedAt,
    firstSeed,
    runCountPerCase: runsPerCase,
    totalRunCount: trials.length,
    caseCount: aggregates.length,
    airportCount: scenario.configuredAirportCount,
    fleetSize: scenario.fleetAircraftIds.length,
    allRunsOperationallyValid: trials.every(isOperationallyValid),
    deterministicReplayVerified:
      replayVerification?.allCasesReproducible ?? false,
    aggregates: Object.freeze(aggregates),
    trials: Object.freeze(trials),
  });
}

function csvCell(value: string | number | boolean) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function operationalDisruptionBatchToCsv(
  report: OperationalDisruptionBatchReport,
) {
  const columns = [
    "case_id",
    "label",
    "runs",
    "validity_rate",
    "mission_mean",
    "completion_rate_mean",
    "delay_rate_mean",
    "delay_rate_ci95_lower",
    "delay_rate_ci95_upper",
    "resource_delay_hours_mean",
    "resource_delay_hours_sd",
    "resource_delay_hours_ci95_lower",
    "resource_delay_hours_ci95_upper",
    "resource_delay_difference_vs_baseline",
    "resource_delay_difference_ci95_lower",
    "resource_delay_difference_ci95_upper",
    "resource_delay_effect_dz",
    "weather_affected_mean",
    "runway_reassignments_mean",
    "equipment_reassignments_mean",
  ];
  const rows = report.aggregates.map((item) => [
    item.caseId,
    item.label,
    item.runCount,
    item.operationalValidityRate,
    item.plannedMissionCount.mean,
    item.completionRate.mean,
    item.operationalDelayRate.mean,
    item.operationalDelayRate.confidence95Lower,
    item.operationalDelayRate.confidence95Upper,
    item.resourceDelayHours.mean,
    item.resourceDelayHours.sampleStandardDeviation,
    item.resourceDelayHours.confidence95Lower,
    item.resourceDelayHours.confidence95Upper,
    item.resourceDelayEffectVsBaseline.meanDifference,
    item.resourceDelayEffectVsBaseline.confidence95Lower,
    item.resourceDelayEffectVsBaseline.confidence95Upper,
    item.resourceDelayEffectVsBaseline.standardizedEffectDz,
    item.weatherAffectedMissionCount.mean,
    item.runwayReassignmentCount.mean,
    item.equipmentReassignmentCount.mean,
  ]);
  return [columns, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}
