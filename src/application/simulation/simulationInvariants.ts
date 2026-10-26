import type { ResourceConstrainedEventEngineResult } from "./resourceConstrainedEventEngine";
import type { SimulationInputContract } from "./simulationContract";
import {
  projectSimulationExecutionState,
  type SimulationExecutionProjection,
} from "./simulationExecutionProjection";

export type SimulationInvariantLevel = "A" | "B" | "C";

export type SimulationInvariantViolation = Readonly<{
  ruleId: string;
  level: SimulationInvariantLevel;
  elapsedSeconds: number;
  airportIdent: string | null;
  aircraftId: string | null;
  resourceId: string | null;
  message: string;
  evidence: string;
}>;

export type SimulationInvariantAudit = Readonly<{
  status: "passed" | "warning" | "failed";
  checkpointIntervalSeconds: number;
  checkpointCount: number;
  evaluatedRuleIds: readonly string[];
  violationCount: number;
  levelACount: number;
  levelBCount: number;
  levelCCount: number;
  violations: readonly SimulationInvariantViolation[];
}>;

const violation = (
  ruleId: string,
  level: SimulationInvariantLevel,
  projection: SimulationExecutionProjection,
  message: string,
  details: Partial<Pick<SimulationInvariantViolation, "airportIdent" | "aircraftId" | "resourceId" | "evidence">> = {},
): SimulationInvariantViolation => Object.freeze({
  ruleId,
  level,
  elapsedSeconds: projection.elapsedSeconds,
  airportIdent: details.airportIdent ?? null,
  aircraftId: details.aircraftId ?? null,
  resourceId: details.resourceId ?? null,
  message,
  evidence: details.evidence ?? message,
});

export function evaluateProjectionInvariants(
  input: SimulationInputContract,
  projection: SimulationExecutionProjection,
): readonly SimulationInvariantViolation[] {
  const issues: SimulationInvariantViolation[] = [];
  const knownAirports = new Set(input.airports.map((airport) => airport.ident));
  const knownStands = new Set(input.airports.flatMap((airport) =>
    airport.stands.map((stand) => stand.id)
  ));
  const aircraftIds = new Set<string>();

  projection.aircraft.forEach((aircraft) => {
    if (aircraftIds.has(aircraft.id)) {
      issues.push(violation(
        "A-AIRCRAFT-IDENTITY-UNIQUE",
        "A",
        projection,
        `飞机${aircraft.id}在同一状态中出现多次。`,
        { aircraftId: aircraft.id },
      ));
    }
    aircraftIds.add(aircraft.id);

    if (
      aircraft.phase === "in_flight" &&
      (aircraft.currentAirportIdent !== null || aircraft.currentStandId !== null)
    ) {
      issues.push(violation(
        "A-IN-FLIGHT-NO-GROUND-OCCUPANCY",
        "A",
        projection,
        `飞机${aircraft.id}处于飞行状态但仍保留机场或机位。`,
        {
          aircraftId: aircraft.id,
          airportIdent: aircraft.currentAirportIdent,
          evidence: `${aircraft.currentAirportIdent ?? "无机场"}/${aircraft.currentStandId ?? "无机位"}`,
        },
      ));
    }
    if (
      aircraft.currentAirportIdent !== null &&
      !knownAirports.has(aircraft.currentAirportIdent)
    ) {
      issues.push(violation(
        "A-AIRCRAFT-AIRPORT-REFERENCE",
        "A",
        projection,
        `飞机${aircraft.id}引用了未配置机场${aircraft.currentAirportIdent}。`,
        { aircraftId: aircraft.id, airportIdent: aircraft.currentAirportIdent },
      ));
    }
    if (aircraft.currentStandId !== null && !knownStands.has(aircraft.currentStandId)) {
      issues.push(violation(
        "A-AIRCRAFT-STAND-REFERENCE",
        "A",
        projection,
        `飞机${aircraft.id}引用了未知机位${aircraft.currentStandId}。`,
        { aircraftId: aircraft.id, airportIdent: aircraft.currentAirportIdent },
      ));
    }
    if (
      aircraft.currentStandId !== null &&
      projection.standOccupancy[aircraft.currentStandId] !== aircraft.id
    ) {
      issues.push(violation(
        "A-AIRCRAFT-STAND-BIDIRECTIONAL",
        "A",
        projection,
        `飞机${aircraft.id}的位置与机位占用表不一致。`,
        {
          aircraftId: aircraft.id,
          airportIdent: aircraft.currentAirportIdent,
          evidence: `${aircraft.currentStandId}->${projection.standOccupancy[aircraft.currentStandId] ?? "空"}`,
        },
      ));
    }
    if (
      aircraft.remainingFlightHours < 0 ||
      aircraft.leftEngineRemainingHours < 0 ||
      aircraft.rightEngineRemainingHours < 0
    ) {
      issues.push(violation(
        "A-AIRCRAFT-LIFE-NONNEGATIVE",
        "A",
        projection,
        `飞机${aircraft.id}出现负剩余寿命。`,
        {
          aircraftId: aircraft.id,
          airportIdent: aircraft.currentAirportIdent,
          evidence: `机体${aircraft.remainingFlightHours}/左发${aircraft.leftEngineRemainingHours}/右发${aircraft.rightEngineRemainingHours}`,
        },
      ));
    }
  });

  const occupancyByAircraft = new Map<string, string[]>();
  Object.entries(projection.standOccupancy).forEach(([standId, aircraftId]) => {
    const stands = occupancyByAircraft.get(aircraftId) ?? [];
    stands.push(standId);
    occupancyByAircraft.set(aircraftId, stands);
    if (!knownStands.has(standId)) {
      issues.push(violation(
        "A-OCCUPANCY-STAND-REFERENCE",
        "A",
        projection,
        `占用表引用了未知机位${standId}。`,
        { aircraftId },
      ));
    }
    if (!aircraftIds.has(aircraftId)) {
      issues.push(violation(
        "A-OCCUPANCY-AIRCRAFT-REFERENCE",
        "A",
        projection,
        `机位${standId}引用了未知飞机${aircraftId}。`,
        { aircraftId },
      ));
    }
  });
  occupancyByAircraft.forEach((standIds, aircraftId) => {
    if (standIds.length > 1) {
      issues.push(violation(
        "A-STAND-OCCUPANCY-UNIQUE",
        "A",
        projection,
        `飞机${aircraftId}同时占用${standIds.length}个机位。`,
        { aircraftId, evidence: standIds.join(",") },
      ));
    }
  });

  const vehicleIds = new Set<string>();
  projection.supportVehicles.forEach((vehicle) => {
    if (vehicleIds.has(vehicle.id)) {
      issues.push(violation(
        "A-RESOURCE-IDENTITY-UNIQUE",
        "A",
        projection,
        `保障资源${vehicle.id}在同一状态中出现多次。`,
        { airportIdent: vehicle.airportIdent, resourceId: vehicle.id },
      ));
    }
    vehicleIds.add(vehicle.id);

    const hasAssignment = vehicle.activeMissionId !== null || vehicle.assignedAircraftId !== null;
    if (vehicle.phase === "standby" && hasAssignment) {
      issues.push(violation(
        "A-RESOURCE-RELEASE-CLOSURE",
        "A",
        projection,
        `保障资源${vehicle.id}已待命但仍保留任务占用。`,
        { airportIdent: vehicle.airportIdent, resourceId: vehicle.id },
      ));
    }
    if (vehicle.phase !== "standby" && !hasAssignment) {
      issues.push(violation(
        "A-RESOURCE-ACTIVE-ASSIGNMENT",
        "A",
        projection,
        `保障资源${vehicle.id}处于${vehicle.phase}但没有关联任务。`,
        { airportIdent: vehicle.airportIdent, resourceId: vehicle.id },
      ));
    }
    if (vehicle.utilizationRate < 0 || vehicle.utilizationRate > 1) {
      issues.push(violation(
        "B-RESOURCE-UTILIZATION-RANGE",
        "B",
        projection,
        `保障资源${vehicle.id}利用率超出0至1范围。`,
        {
          airportIdent: vehicle.airportIdent,
          resourceId: vehicle.id,
          evidence: String(vehicle.utilizationRate),
        },
      ));
    }
  });

  return Object.freeze(issues);
}

function evaluateEventInvariants(
  input: SimulationInputContract,
  result: ResourceConstrainedEventEngineResult,
): SimulationInvariantViolation[] {
  const terminal = projectSimulationExecutionState(
    input,
    result,
    input.horizonHours * 3600,
  );
  const issues: SimulationInvariantViolation[] = [];
  for (let index = 1; index < result.events.length; index += 1) {
    const previous = result.events[index - 1];
    const current = result.events[index];
    if (
      previous && current &&
      (current.offsetSeconds < previous.offsetSeconds ||
        (current.offsetSeconds === previous.offsetSeconds && current.priority < previous.priority))
    ) {
      issues.push(violation(
        "A-EVENT-GLOBAL-ORDER",
        "A",
        terminal,
        `事件${current.id}的仿真时间或优先级发生逆序。`,
        { evidence: `${previous.id}->${current.id}` },
      ));
    }
  }

  result.missions.forEach((mission) => {
    const events = result.events.filter((event) => event.missionId === mission.id);
    const departures = events.filter((event) => event.type === "flight_departed");
    const arrivals = events.filter((event) => event.type === "flight_arrived");
    const releases = events.filter((event) => event.type === "support_released");
    if (
      departures.length !== 1 ||
      arrivals.length !== 1 ||
      departures[0]?.offsetSeconds !== mission.departureOffsetSeconds ||
      arrivals[0]?.offsetSeconds !== mission.arrivalOffsetSeconds
    ) {
      issues.push(violation(
        "A-MISSION-FLIGHT-EVENT-CLOSURE",
        "A",
        terminal,
        `任务${mission.id}的离场或到达事件不闭合。`,
        {
          airportIdent: mission.sourceAirportIdent,
          aircraftId: mission.aircraftId,
          evidence: `departures=${departures.length},arrivals=${arrivals.length}`,
        },
      ));
    }
    if (releases.length !== mission.groundSupportPackage.length) {
      issues.push(violation(
        "A-MISSION-SUPPORT-RELEASE-CLOSURE",
        "A",
        terminal,
        `任务${mission.id}的保障资源释放事件不完整。`,
        {
          airportIdent: mission.sourceAirportIdent,
          aircraftId: mission.aircraftId,
          evidence: `expected=${mission.groundSupportPackage.length},actual=${releases.length}`,
        },
      ));
    }
  });

  if (
    terminal.activeFlightCount > 0 ||
    terminal.activeSupportVehicleCount > 0 ||
    terminal.activeEmergencyCount > 0 ||
    terminal.blockedStandIds.length > 0
  ) {
    issues.push(violation(
      "A-TERMINAL-STATE-CLOSURE",
      "A",
      terminal,
      "72小时终点仍存在未释放运行状态。",
      {
        evidence: `flight=${terminal.activeFlightCount},support=${terminal.activeSupportVehicleCount},emergency=${terminal.activeEmergencyCount},blockedStand=${terminal.blockedStandIds.length}`,
      },
    ));
  }
  return issues;
}

export function runSimulationInvariantAudit(
  input: SimulationInputContract,
  result: ResourceConstrainedEventEngineResult,
  checkpointIntervalSeconds = 15 * 60,
): SimulationInvariantAudit {
  if (result.inputContractId !== input.id || result.seed !== input.seed) {
    throw new Error("不变量审计输入与仿真结果不匹配。 ");
  }
  if (!Number.isInteger(checkpointIntervalSeconds) || checkpointIntervalSeconds <= 0) {
    throw new Error("不变量审计检查点间隔必须是正整数秒。 ");
  }

  const violations: SimulationInvariantViolation[] = [];
  let checkpointCount = 0;
  for (
    let elapsedSeconds = 0;
    elapsedSeconds <= input.horizonHours * 3600;
    elapsedSeconds += checkpointIntervalSeconds
  ) {
    checkpointCount += 1;
    violations.push(...evaluateProjectionInvariants(
      input,
      projectSimulationExecutionState(input, result, elapsedSeconds),
    ));
  }
  violations.push(...evaluateEventInvariants(input, result));

  const levelACount = violations.filter((item) => item.level === "A").length;
  const levelBCount = violations.filter((item) => item.level === "B").length;
  const levelCCount = violations.filter((item) => item.level === "C").length;
  const status = levelACount > 0 ? "failed" : levelBCount > 0 ? "warning" : "passed";
  return Object.freeze({
    status,
    checkpointIntervalSeconds,
    checkpointCount,
    evaluatedRuleIds: Object.freeze([
      "A-AIRCRAFT-IDENTITY-UNIQUE",
      "A-IN-FLIGHT-NO-GROUND-OCCUPANCY",
      "A-AIRCRAFT-AIRPORT-REFERENCE",
      "A-AIRCRAFT-STAND-REFERENCE",
      "A-AIRCRAFT-STAND-BIDIRECTIONAL",
      "A-AIRCRAFT-LIFE-NONNEGATIVE",
      "A-OCCUPANCY-STAND-REFERENCE",
      "A-OCCUPANCY-AIRCRAFT-REFERENCE",
      "A-STAND-OCCUPANCY-UNIQUE",
      "A-RESOURCE-IDENTITY-UNIQUE",
      "A-RESOURCE-RELEASE-CLOSURE",
      "A-RESOURCE-ACTIVE-ASSIGNMENT",
      "B-RESOURCE-UTILIZATION-RANGE",
      "A-EVENT-GLOBAL-ORDER",
      "A-MISSION-FLIGHT-EVENT-CLOSURE",
      "A-MISSION-SUPPORT-RELEASE-CLOSURE",
      "A-TERMINAL-STATE-CLOSURE",
    ]),
    violationCount: violations.length,
    levelACount,
    levelBCount,
    levelCCount,
    violations: Object.freeze(violations),
  });
}
