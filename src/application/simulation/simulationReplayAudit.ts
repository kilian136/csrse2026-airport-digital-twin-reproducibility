import { RESOURCE_CONSTRAINED_ENGINE_ID, type ResourceConstrainedEventEngineResult } from "./resourceConstrainedEventEngine";
import { SIMULATION_CONTRACT_VERSION, type SimulationInputContract } from "./simulationContract";
import { projectSimulationExecutionState } from "./simulationExecutionProjection";
import {
  stateFingerprint,
  validateExperimentManifest,
  type SimulationExperimentManifest,
} from "./deterministicReplay";

export const SIMULATION_REPLAY_AUDIT_VERSION = "1.0" as const;

export type SimulationReplayCheckpoint = Readonly<{
  elapsedSeconds: number;
  processedEventCount: number;
  fingerprint: string;
}>;

export type SimulationReplayAudit = Readonly<{
  schemaVersion: typeof SIMULATION_REPLAY_AUDIT_VERSION;
  manifest: SimulationExperimentManifest;
  checkpointIntervalSeconds: number;
  checkpointCount: number;
  eventLogFingerprint: string;
  terminalFingerprint: string;
  checkpoints: readonly SimulationReplayCheckpoint[];
}>;

export type SimulationReplayComparison = Readonly<{
  reproducible: boolean;
  comparedCheckpointCount: number;
  differences: readonly string[];
}>;

export function buildSimulationExperimentManifest(
  input: SimulationInputContract,
): SimulationExperimentManifest {
  const airportIdents = input.airports.map((airport) => airport.ident).sort();
  const manifest: SimulationExperimentManifest = {
    schemaVersion: "1.0",
    experimentId: `CSRSE2026-${input.scenarioId}-SEED-${input.seed}`,
    snapshotId: input.scenarioId,
    snapshotVersion: input.generatedAt,
    seed: input.seed,
    fixedStepMs: 1000,
    horizonMs: input.horizonHours * 60 * 60 * 1000,
    datasetVersions: {
      inputContract: SIMULATION_CONTRACT_VERSION,
      eventEngine: RESOURCE_CONSTRAINED_ENGINE_ID,
      airports: airportIdents.join(","),
      fleet: `shared-fleet-${input.aircraft.length}`,
      networkAuthority: input.airports
        .map((airport) => airport.networkReference.authority)
        .sort()
        .join(","),
    },
  };
  const errors = validateExperimentManifest(manifest);
  if (errors.length > 0) {
    throw new Error(`实验清单不完整：${errors.join("；")}`);
  }
  return manifest;
}

export function createSimulationReplayAudit(
  input: SimulationInputContract,
  result: ResourceConstrainedEventEngineResult,
  checkpointIntervalSeconds = 15 * 60,
): SimulationReplayAudit {
  if (result.inputContractId !== input.id || result.scenarioId !== input.scenarioId) {
    throw new Error("仿真结果与输入契约不匹配，不能生成重放审计。 ");
  }
  if (result.seed !== input.seed || result.horizonHours !== input.horizonHours) {
    throw new Error("仿真结果与输入契约的随机种子或时域不一致。 ");
  }
  if (!Number.isInteger(checkpointIntervalSeconds) || checkpointIntervalSeconds <= 0) {
    throw new Error("重放检查点间隔必须是正整数秒。 ");
  }

  const horizonSeconds = input.horizonHours * 60 * 60;
  const checkpoints: SimulationReplayCheckpoint[] = [];
  for (
    let elapsedSeconds = 0;
    elapsedSeconds <= horizonSeconds;
    elapsedSeconds += checkpointIntervalSeconds
  ) {
    const state = projectSimulationExecutionState(input, result, elapsedSeconds);
    checkpoints.push(Object.freeze({
      elapsedSeconds,
      processedEventCount: result.events.filter(
        (event) => event.offsetSeconds <= elapsedSeconds,
      ).length,
      fingerprint: stateFingerprint(state),
    }));
  }

  const terminalState = projectSimulationExecutionState(input, result, horizonSeconds);
  return Object.freeze({
    schemaVersion: SIMULATION_REPLAY_AUDIT_VERSION,
    manifest: Object.freeze(buildSimulationExperimentManifest(input)),
    checkpointIntervalSeconds,
    checkpointCount: checkpoints.length,
    eventLogFingerprint: stateFingerprint(result.events),
    terminalFingerprint: stateFingerprint(terminalState),
    checkpoints: Object.freeze(checkpoints),
  });
}

export function compareSimulationReplayAudits(
  left: SimulationReplayAudit,
  right: SimulationReplayAudit,
): SimulationReplayComparison {
  const differences: string[] = [];
  if (stateFingerprint(left.manifest) !== stateFingerprint(right.manifest)) {
    differences.push("实验清单不一致");
  }
  if (left.eventLogFingerprint !== right.eventLogFingerprint) {
    differences.push("事件日志指纹不一致");
  }
  if (left.terminalFingerprint !== right.terminalFingerprint) {
    differences.push("72小时终态指纹不一致");
  }
  if (left.checkpointCount !== right.checkpointCount) {
    differences.push("检查点数量不一致");
  }

  const count = Math.min(left.checkpoints.length, right.checkpoints.length);
  for (let index = 0; index < count; index += 1) {
    const first = left.checkpoints[index];
    const second = right.checkpoints[index];
    if (
      first?.elapsedSeconds !== second?.elapsedSeconds ||
      first?.processedEventCount !== second?.processedEventCount ||
      first?.fingerprint !== second?.fingerprint
    ) {
      differences.push(`检查点${index}不一致`);
      if (differences.length >= 20) break;
    }
  }

  return Object.freeze({
    reproducible: differences.length === 0,
    comparedCheckpointCount: count,
    differences: Object.freeze(differences),
  });
}
