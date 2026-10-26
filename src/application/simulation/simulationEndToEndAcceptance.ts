import type { ResourceConstrainedEventEngineResult } from "./resourceConstrainedEventEngine";
import type { SimulationInputContract } from "./simulationContract";
import { projectSimulationExecutionState } from "./simulationExecutionProjection";

export type SimulationAcceptanceStatus = "pass" | "warning" | "fail";

export type SimulationAcceptanceCheck = Readonly<{
  id: string;
  title: string;
  status: SimulationAcceptanceStatus;
  summary: string;
  checkedCount: number;
  issueCount: number;
  evidence: readonly string[];
}>;

export type SimulationEndToEndAcceptanceReport = Readonly<{
  status: "accepted" | "review_required" | "rejected";
  score: number;
  checkpointIntervalMinutes: number;
  checkpointCount: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  checks: readonly SimulationAcceptanceCheck[];
}>;

const CHECKPOINT_INTERVAL_SECONDS = 15 * 60;

function acceptanceCheck(
  id: string,
  title: string,
  checkedCount: number,
  issues: readonly string[],
  successSummary: string,
  failureSummary: string,
  warningOnly = false,
): SimulationAcceptanceCheck {
  return Object.freeze({
    id,
    title,
    status: issues.length === 0 ? "pass" : warningOnly ? "warning" : "fail",
    summary: issues.length === 0 ? successSummary : failureSummary,
    checkedCount,
    issueCount: issues.length,
    evidence: Object.freeze(issues.slice(0, 8)),
  });
}

function validateMissionEventClosure(result: ResourceConstrainedEventEngineResult) {
  const issues: string[] = [];
  result.missions.forEach((mission) => {
    const events = result.events.filter((event) => event.missionId === mission.id);
    const departures = events.filter((event) => event.type === "flight_departed");
    const arrivals = events.filter((event) => event.type === "flight_arrived");
    const releasedSupport = events.filter((event) => event.type === "support_released");
    if (departures.length !== 1 || departures[0]?.offsetSeconds !== mission.departureOffsetSeconds) {
      issues.push(`${mission.id}的离场事件缺失、重复或时刻不一致`);
    }
    if (arrivals.length !== 1 || arrivals[0]?.offsetSeconds !== mission.arrivalOffsetSeconds) {
      issues.push(`${mission.id}的到达事件缺失、重复或时刻不一致`);
    }
    if (releasedSupport.length !== mission.groundSupportPackage.length) {
      issues.push(`${mission.id}有${mission.groundSupportPackage.length}项保障任务，但只有${releasedSupport.length}项完成释放`);
    }
  });
  return acceptanceCheck(
    "mission_event_closure",
    "逐任务事件闭环",
    result.missions.length,
    issues,
    `${result.missions.length}个航班均具备保障释放、离场和到达事件。`,
    `发现${issues.length}个任务事件链不完整。`,
  );
}

function validateCheckpointIntegrity(
  input: SimulationInputContract,
  result: ResourceConstrainedEventEngineResult,
) {
  const issues: string[] = [];
  const horizonSeconds = input.horizonHours * 3600;
  let checkpointCount = 0;
  for (let elapsedSeconds = 0; elapsedSeconds <= horizonSeconds; elapsedSeconds += CHECKPOINT_INTERVAL_SECONDS) {
    checkpointCount += 1;
    const projection = projectSimulationExecutionState(input, result, elapsedSeconds);
    const occupiedAircraft = Object.values(projection.standOccupancy);
    if (new Set(occupiedAircraft).size !== occupiedAircraft.length) {
      issues.push(`D${Math.floor(elapsedSeconds / 86400) + 1} ${String(Math.floor(elapsedSeconds % 86400 / 3600)).padStart(2, "0")}:${String(Math.floor(elapsedSeconds % 3600 / 60)).padStart(2, "0")}存在同一飞机重复占用机位`);
    }
    projection.aircraft.forEach((aircraft) => {
      if (aircraft.phase === "in_flight" && (aircraft.currentAirportIdent || aircraft.currentStandId)) {
        issues.push(`${aircraft.id}飞行中仍占用${aircraft.currentAirportIdent ?? "未知机场"}/${aircraft.currentStandId ?? "未知机位"}`);
      }
      if (aircraft.activeMissionId && aircraft.phase !== "in_flight") {
        issues.push(`${aircraft.id}存在活动航班${aircraft.activeMissionId}但状态为${aircraft.phase}`);
      }
      if (
        aircraft.currentStandId &&
        projection.standOccupancy[aircraft.currentStandId] !== aircraft.id
      ) {
        issues.push(`${aircraft.id}的当前位置与机位占用表不一致`);
      }
      if (
        aircraft.remainingFlightHours < 0 ||
        aircraft.leftEngineRemainingHours < 0 ||
        aircraft.rightEngineRemainingHours < 0
      ) {
        issues.push(`${aircraft.id}在仿真过程中出现负寿命`);
      }
    });
    if (issues.length >= 20) break;
  }
  return acceptanceCheck(
    "checkpoint_integrity",
    "15分钟状态快照一致性",
    checkpointCount,
    issues,
    `${checkpointCount}个时钟检查点均未发现重复机位、飞行占位、状态错配或负寿命。`,
    `全过程检查发现${issues.length}项状态一致性问题。`,
  );
}

function validateAirportTransferClosure(
  input: SimulationInputContract,
  result: ResourceConstrainedEventEngineResult,
) {
  const issues: string[] = [];
  const finalProjection = projectSimulationExecutionState(
    input,
    result,
    input.horizonHours * 3600,
  );
  input.aircraft.forEach((aircraft) => {
    const lastMission = result.missions
      .filter((mission) => mission.aircraftId === aircraft.id)
      .sort((left, right) => left.arrivalOffsetSeconds - right.arrivalOffsetSeconds)
      .at(-1);
    if (!lastMission) return;
    const projected = finalProjection.aircraft.find((candidate) => candidate.id === aircraft.id);
    if (
      projected?.currentAirportIdent !== lastMission.destinationAirportIdent ||
      projected.currentStandId !== lastMission.destinationStandId
    ) {
      issues.push(`${aircraft.id}终态应位于${lastMission.destinationAirportIdent}/${lastMission.destinationStandId}，实际为${projected?.currentAirportIdent ?? "空中"}/${projected?.currentStandId ?? "无机位"}`);
    }
  });
  return acceptanceCheck(
    "airport_transfer_closure",
    "跨机场位置交接",
    input.aircraft.length,
    issues,
    "所有已执行跨场任务的飞机均落在最后到达机场及获批机位，未保留出发机场影子。",
    `发现${issues.length}架飞机的跨机场终态未正确交接。`,
  );
}

function validateTerminalRelease(
  input: SimulationInputContract,
  result: ResourceConstrainedEventEngineResult,
) {
  const finalProjection = projectSimulationExecutionState(
    input,
    result,
    input.horizonHours * 3600,
  );
  const issues: string[] = [];
  if (finalProjection.completedMissionCount !== result.missions.length) {
    issues.push(`终点仅完成${finalProjection.completedMissionCount}/${result.missions.length}个航班`);
  }
  if (finalProjection.activeFlightCount > 0) issues.push(`终点仍有${finalProjection.activeFlightCount}架飞机在途`);
  if (finalProjection.activeSupportVehicleCount > 0) issues.push(`终点仍有${finalProjection.activeSupportVehicleCount}辆保障车未释放`);
  if (finalProjection.activeEmergencyCount > 0) issues.push(`终点仍有${finalProjection.activeEmergencyCount}项应急事件未闭环`);
  if (finalProjection.blockedStandIds.length > 0) issues.push(`终点仍有${finalProjection.blockedStandIds.length}个机位处于封控状态`);
  return acceptanceCheck(
    "terminal_release",
    "72小时终态释放",
    result.missions.length + input.aircraft.length,
    issues,
    "全部航班完成到达，飞行、保障、应急和机位封控均已结束。",
    `72小时终点仍有${issues.length}类未闭环状态。`,
  );
}

function validateEventOrdering(result: ResourceConstrainedEventEngineResult) {
  const issues: string[] = [];
  for (let index = 1; index < result.events.length; index += 1) {
    const previous = result.events[index - 1];
    const current = result.events[index];
    if (!previous || !current) continue;
    if (
      current.offsetSeconds < previous.offsetSeconds ||
      (current.offsetSeconds === previous.offsetSeconds && current.priority < previous.priority)
    ) {
      issues.push(`${current.id}位于${previous.id}之后但时间或优先级逆序`);
    }
  }
  const completed = result.events.filter((event) => event.type === "simulation_completed");
  if (completed.length !== 1 || completed[0]?.offsetSeconds !== 72 * 3600) {
    issues.push("缺少唯一的72小时仿真完成事件");
  }
  return acceptanceCheck(
    "event_ordering",
    "全局事件顺序",
    result.events.length,
    issues,
    `${result.events.length}个事件按仿真时刻及同刻优先级稳定排序。`,
    `发现${issues.length}项事件顺序异常。`,
  );
}

export function runSimulationEndToEndAcceptance(
  input: SimulationInputContract,
  result: ResourceConstrainedEventEngineResult,
): SimulationEndToEndAcceptanceReport {
  const checks = Object.freeze([
    validateMissionEventClosure(result),
    validateCheckpointIntegrity(input, result),
    validateAirportTransferClosure(input, result),
    validateTerminalRelease(input, result),
    validateEventOrdering(result),
  ]);
  const failedCount = checks.filter((item) => item.status === "fail").length;
  const warningCount = checks.filter((item) => item.status === "warning").length;
  const passedCount = checks.filter((item) => item.status === "pass").length;
  return Object.freeze({
    status: failedCount > 0 ? "rejected" : warningCount > 0 ? "review_required" : "accepted",
    score: Math.max(0, 100 - failedCount * 20 - warningCount * 8),
    checkpointIntervalMinutes: CHECKPOINT_INTERVAL_SECONDS / 60,
    checkpointCount: Math.floor(input.horizonHours * 3600 / CHECKPOINT_INTERVAL_SECONDS) + 1,
    passedCount,
    warningCount,
    failedCount,
    checks,
  });
}
