import type { AircraftHealthRisk } from "../../domain/aircraft";
import type { ResourceConstrainedEventEngineResult } from "./resourceConstrainedEventEngine";
import type { SimulationInputContract } from "./simulationContract";
import { buildGroundSupportEventTimeline } from "./groundSupportEventTimeline";

export type SimulationAircraftPhase =
  | "ground_ready"
  | "ground_turnaround"
  | "in_flight"
  | "maintenance"
  | "emergency_response"
  | "airworthiness_review"
  | "grounded";

export type SimulationEmergencyPhase =
  | "planned"
  | "detected"
  | "dispatching"
  | "on_scene"
  | "returning"
  | "airworthiness_review"
  | "resolved";

export type ProjectedSimulationEmergencyIncident = Readonly<{
  id: string;
  label: string;
  responseLevel: "一级" | "二级" | "三级";
  airportIdent: string;
  aircraftId: string;
  occupiedStandId: string;
  phase: SimulationEmergencyPhase;
  active: boolean;
  standBlocked: boolean;
  assignedVehicleIds: readonly string[];
  affectedMissionCount: number;
  standReassignmentCount: number;
  groundSupportRecompileCount: number;
  nextTransitionOffsetSeconds: number | null;
}>;

export type ProjectedSimulationAircraft = Readonly<{
  id: string;
  model: string;
  phase: SimulationAircraftPhase;
  currentAirportIdent: string | null;
  currentStandId: string | null;
  activeMissionId: string | null;
  routeLabel: string;
  completedMissionCount: number;
  completedMaintenanceCount: number;
  restoredComponentLifeHours: number;
  latestMaintenanceComponent: string | null;
  accumulatedFlightHours: number;
  addedFlightHours: number;
  remainingFlightHours: number;
  leftEngineUsedHours: number;
  leftEngineRemainingHours: number;
  rightEngineUsedHours: number;
  rightEngineRemainingHours: number;
  healthRisk: AircraftHealthRisk;
}>;

export type ProjectedAirportExecution = Readonly<{
  airportIdent: string;
  aircraftOnGround: number;
  aircraftInFlightToAirport: number;
  occupiedStandCount: number;
  activeMaintenanceCount: number;
}>;

export type SimulationSupportVehiclePhase =
  | "standby"
  | "dispatching"
  | "servicing"
  | "returning";

export type ProjectedSimulationSupportVehicle = Readonly<{
  id: string;
  airportIdent: string;
  category: string;
  phase: SimulationSupportVehiclePhase;
  activeMissionId: string | null;
  assignedAircraftId: string | null;
  activeRoleLabel: string | null;
  completedTaskCount: number;
  utilizationSeconds: number;
  utilizationRate: number;
  waitingSeconds: number;
}>;

export type ProjectedAirportSupportExecution = Readonly<{
  airportIdent: string;
  vehicleCount: number;
  activeVehicleCount: number;
  completedTaskCount: number;
  utilizationRate: number;
  waitingMinutes: number;
  bottleneckRoleLabel: string;
}>;

export type SimulationExecutionProjection = Readonly<{
  elapsedSeconds: number;
  aircraft: readonly ProjectedSimulationAircraft[];
  airports: readonly ProjectedAirportExecution[];
  supportVehicles: readonly ProjectedSimulationSupportVehicle[];
  airportSupport: readonly ProjectedAirportSupportExecution[];
  emergencyIncidents: readonly ProjectedSimulationEmergencyIncident[];
  blockedStandIds: readonly string[];
  standOccupancy: Readonly<Record<string, string>>;
  completedMissionCount: number;
  activeFlightCount: number;
  activeMaintenanceCount: number;
  activeSupportVehicleCount: number;
  completedSupportTaskCount: number;
  supportWaitingMinutes: number;
  activeEmergencyCount: number;
  activeEmergencyVehicleCount: number;
}>;

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function deriveRisk(remainingValues: readonly number[]): AircraftHealthRisk {
  const minimum = Math.min(...remainingValues);
  if (minimum <= 0) return "critical";
  if (minimum <= 120) return "urgent";
  if (minimum <= 240) return "watch";
  return "normal";
}

function projectEmergencyPhase(
  incident: ResourceConstrainedEventEngineResult["emergencyIncidents"][number],
  elapsedSeconds: number,
): Pick<
  ProjectedSimulationEmergencyIncident,
  "phase" | "active" | "standBlocked" | "nextTransitionOffsetSeconds"
> {
  if (elapsedSeconds < incident.detectedOffsetSeconds) {
    return {
      phase: "planned",
      active: false,
      standBlocked: false,
      nextTransitionOffsetSeconds: incident.detectedOffsetSeconds,
    };
  }
  if (elapsedSeconds < incident.dispatchOffsetSeconds) {
    return { phase: "detected", active: true, standBlocked: true, nextTransitionOffsetSeconds: incident.dispatchOffsetSeconds };
  }
  if (elapsedSeconds < incident.arrivalOffsetSeconds) {
    return { phase: "dispatching", active: true, standBlocked: true, nextTransitionOffsetSeconds: incident.arrivalOffsetSeconds };
  }
  if (elapsedSeconds < incident.serviceCompletedOffsetSeconds) {
    return { phase: "on_scene", active: true, standBlocked: true, nextTransitionOffsetSeconds: incident.serviceCompletedOffsetSeconds };
  }
  if (elapsedSeconds < incident.releasedOffsetSeconds) {
    return { phase: "returning", active: true, standBlocked: true, nextTransitionOffsetSeconds: incident.releasedOffsetSeconds };
  }
  if (elapsedSeconds < incident.operationalReleaseOffsetSeconds) {
    return { phase: "airworthiness_review", active: true, standBlocked: true, nextTransitionOffsetSeconds: incident.operationalReleaseOffsetSeconds };
  }
  return { phase: "resolved", active: false, standBlocked: false, nextTransitionOffsetSeconds: null };
}

/**
 * 将不可变的初始输入和72小时任务计划投影到任意仿真时刻。
 * 该函数不修改实时机场状态，也不修改仿真输入，便于暂停、快进和结果回放。
 */
export function projectSimulationExecutionState(
  input: SimulationInputContract,
  result: ResourceConstrainedEventEngineResult,
  requestedElapsedSeconds: number,
): SimulationExecutionProjection {
  const elapsedSeconds = Math.max(
    0,
    Math.min(input.horizonHours * 3600, requestedElapsedSeconds),
  );
  const missionsByAircraft = new Map<string, typeof result.missions>();
  result.missions.forEach((mission) => {
    missionsByAircraft.set(mission.aircraftId, [
      ...(missionsByAircraft.get(mission.aircraftId) ?? []),
      mission,
    ]);
  });

  const projectedAircraft = input.aircraft.map((aircraft) => {
    const missions = [...(missionsByAircraft.get(aircraft.id) ?? [])].sort(
      (left, right) => left.departureOffsetSeconds - right.departureOffsetSeconds,
    );
    const completedMissions = missions.filter(
      (mission) => mission.arrivalOffsetSeconds <= elapsedSeconds,
    );
    const activeMission = missions.find(
      (mission) =>
        mission.departureOffsetSeconds <= elapsedSeconds &&
        mission.arrivalOffsetSeconds > elapsedSeconds,
    ) ?? null;
    const lastCompleted = completedMissions.at(-1) ?? null;
    const nextMission = missions.find(
      (mission) => mission.departureOffsetSeconds > elapsedSeconds,
    ) ?? null;
    const activeMaintenance = result.maintenanceWindows.find(
      (window) =>
        window.aircraftId === aircraft.id &&
        window.startOffsetSeconds <= elapsedSeconds &&
        (window.endOffsetSeconds === null || window.endOffsetSeconds > elapsedSeconds),
    ) ?? null;
    const completedWorkOrders = result.maintenanceWorkOrders.filter(
      (workOrder) =>
        workOrder.aircraftId === aircraft.id &&
        workOrder.endOffsetSeconds !== null &&
        workOrder.endOffsetSeconds <= elapsedSeconds,
    );
    const activeEmergency = result.emergencyIncidents.find(
      (incident) =>
        incident.aircraftId === aircraft.id &&
        incident.detectedOffsetSeconds <= elapsedSeconds &&
        incident.operationalReleaseOffsetSeconds > elapsedSeconds,
    ) ?? null;

    let addedFlightHours = completedMissions.reduce(
      (sum, mission) => sum + mission.plannedDurationHours,
      0,
    );
    if (activeMission) {
      addedFlightHours += Math.min(
        activeMission.plannedDurationHours,
        Math.max(0, elapsedSeconds - activeMission.departureOffsetSeconds) / 3600,
      );
    }

    const leftEngine = aircraft.healthProfile.components.find(
      (component) => component.category === "engine" && component.position === "left",
    );
    const rightEngine = aircraft.healthProfile.components.find(
      (component) => component.category === "engine" && component.position === "right",
    );
    if (!leftEngine || !rightEngine) {
      throw new Error(`飞机${aircraft.id}缺少左右发动机健康档案。`);
    }

    const remainsInInitialFlight =
      aircraft.initialOperationalPhase === "in_flight" &&
      !activeMission &&
      !lastCompleted;
    const currentAirportIdent = activeMission || remainsInInitialFlight
      ? null
      : lastCompleted?.destinationAirportIdent ?? aircraft.initialAirportIdent;
    const currentStandId = activeMission || remainsInInitialFlight
      ? null
      : lastCompleted?.destinationStandId ?? aircraft.currentStandId;
    const phase: SimulationAircraftPhase = activeMission
      ? "in_flight"
      : remainsInInitialFlight
        ? "in_flight"
      : activeEmergency && elapsedSeconds < activeEmergency.releasedOffsetSeconds
        ? "emergency_response"
        : activeEmergency
          ? "airworthiness_review"
      : activeMaintenance?.trigger === "initial_grounded"
        ? "grounded"
        : activeMaintenance
          ? "maintenance"
          : lastCompleted && nextMission
            ? "ground_turnaround"
            : aircraft.dispatchEligibility === "grounded"
              ? "grounded"
              : "ground_ready";
    const initialMaintenanceRestoredLife = completedWorkOrders
      .filter((workOrder) => result.maintenanceWindows.some(
        (window) =>
          window.id === workOrder.maintenanceWindowId &&
          window.trigger === "initial_pending",
      ))
      .reduce((sum, workOrder) => sum + workOrder.restoredLifeHours, 0);
    const airframeRemaining = Math.max(
      0,
      Math.min(
        aircraft.healthProfile.airframe.ratedLifeHours,
        aircraft.healthProfile.airframe.remainingLifeHours +
          initialMaintenanceRestoredLife -
          addedFlightHours,
      ),
    );
    const leftRestoredLife = completedWorkOrders
      .filter((workOrder) => workOrder.componentId === leftEngine.id)
      .reduce((sum, workOrder) => sum + workOrder.restoredLifeHours, 0);
    const rightRestoredLife = completedWorkOrders
      .filter((workOrder) => workOrder.componentId === rightEngine.id)
      .reduce((sum, workOrder) => sum + workOrder.restoredLifeHours, 0);
    const restoredComponentLifeHours = completedWorkOrders.reduce(
      (sum, workOrder) => sum + workOrder.restoredLifeHours,
      0,
    );
    const leftRemaining = Math.max(
      0,
      Math.min(
        leftEngine.ratedLifeHours,
        leftEngine.remainingLifeHours - addedFlightHours + leftRestoredLife,
      ),
    );
    const rightRemaining = Math.max(
      0,
      Math.min(
        rightEngine.ratedLifeHours,
        rightEngine.remainingLifeHours - addedFlightHours + rightRestoredLife,
      ),
    );

    return Object.freeze({
      id: aircraft.id,
      model: aircraft.model,
      phase,
      currentAirportIdent,
      currentStandId,
      activeMissionId: activeMission?.id ?? null,
      routeLabel: activeMission
        ? `${activeMission.sourceAirportIdent} → ${activeMission.destinationAirportIdent}`
        : remainsInInitialFlight
          ? `${aircraft.initialAirportIdent} → 跨机场航段`
          : activeEmergency
            ? `${activeEmergency.airportIdent} · ${activeEmergency.occupiedStandId} · ${activeEmergency.label}`
            : currentAirportIdent ?? "位置未知",
      completedMissionCount: completedMissions.length,
      completedMaintenanceCount: completedWorkOrders.length,
      restoredComponentLifeHours: round(restoredComponentLifeHours),
      latestMaintenanceComponent: completedWorkOrders.at(-1)?.componentName ?? null,
      accumulatedFlightHours: round(
        aircraft.healthProfile.airframe.accumulatedFlightHours + addedFlightHours,
      ),
      addedFlightHours: round(addedFlightHours, 2),
      remainingFlightHours: round(airframeRemaining),
      leftEngineUsedHours: round(leftEngine.accumulatedOperatingHours + addedFlightHours),
      leftEngineRemainingHours: round(leftRemaining),
      rightEngineUsedHours: round(rightEngine.accumulatedOperatingHours + addedFlightHours),
      rightEngineRemainingHours: round(rightRemaining),
      healthRisk: deriveRisk([airframeRemaining, leftRemaining, rightRemaining]),
    });
  });

  const standOccupancy: Record<string, string> = {};
  projectedAircraft.forEach((aircraft) => {
    if (aircraft.currentStandId && aircraft.currentAirportIdent) {
      standOccupancy[aircraft.currentStandId] = aircraft.id;
    }
  });
  const airports = input.airports.map((airport) => Object.freeze({
    airportIdent: airport.ident,
    aircraftOnGround: projectedAircraft.filter(
      (aircraft) => aircraft.currentAirportIdent === airport.ident,
    ).length,
    aircraftInFlightToAirport: projectedAircraft.filter((aircraft) => {
      if (!aircraft.activeMissionId) return false;
      return result.missions.find((mission) => mission.id === aircraft.activeMissionId)
        ?.destinationAirportIdent === airport.ident;
    }).length,
    occupiedStandCount: projectedAircraft.filter(
      (aircraft) =>
        aircraft.currentAirportIdent === airport.ident && aircraft.currentStandId !== null,
    ).length,
    activeMaintenanceCount: projectedAircraft.filter(
      (aircraft) =>
        aircraft.currentAirportIdent === airport.ident && aircraft.phase === "maintenance",
    ).length,
  }));

  const supportAssignments = result.missions.flatMap((mission) =>
    mission.groundSupportPackage.map((assignment) => Object.freeze({
      ...assignment,
      missionId: mission.id,
      aircraftId: mission.aircraftId,
      airportIdent: mission.sourceAirportIdent,
    })),
  );
  const projectedEmergencyIncidents = result.emergencyIncidents.map((incident) => {
    const state = projectEmergencyPhase(incident, elapsedSeconds);
    const affectedAircraftIds = new Set(
      result.missions
        .filter((mission) => incident.standReassignedMissionIds.includes(mission.id))
        .map((mission) => mission.aircraftId),
    );
    const groundSupportRecompileCount = result.missions.filter(
      (mission) =>
        affectedAircraftIds.has(mission.aircraftId) &&
        mission.groundSupportRouteRecompiledByEmergency,
    ).length;
    return Object.freeze({
      id: incident.id,
      label: incident.label,
      responseLevel: incident.responseLevel,
      airportIdent: incident.airportIdent,
      aircraftId: incident.aircraftId,
      occupiedStandId: incident.occupiedStandId,
      phase: state.phase,
      active: state.active,
      standBlocked: state.standBlocked,
      assignedVehicleIds: incident.assignedVehicleIds,
      affectedMissionCount: incident.affectedMissionIds.length,
      standReassignmentCount: incident.standReassignedMissionIds.length,
      groundSupportRecompileCount,
      nextTransitionOffsetSeconds: state.nextTransitionOffsetSeconds,
    });
  });
  const projectedSupportVehicles = input.airports.flatMap((airport) =>
    airport.supportVehicles.map((vehicle) => {
      const assignments = supportAssignments
        .filter((assignment) => assignment.vehicleId === vehicle.id)
        .sort((left, right) => left.startOffsetSeconds - right.startOffsetSeconds);
      const activeAssignment = assignments.find(
        (assignment) =>
          assignment.startOffsetSeconds <= elapsedSeconds &&
          assignment.endOffsetSeconds > elapsedSeconds,
      ) ?? null;
      const completedTaskCount = assignments.filter(
        (assignment) => assignment.endOffsetSeconds <= elapsedSeconds,
      ).length + result.emergencyIncidents.filter(
        (incident) =>
          incident.assignedVehicleIds.includes(vehicle.id) &&
          incident.releasedOffsetSeconds <= elapsedSeconds,
      ).length;
      const emergencyUtilizationSeconds = result.emergencyIncidents
        .filter((incident) => incident.assignedVehicleIds.includes(vehicle.id))
        .reduce(
          (sum, incident) =>
            sum + Math.max(
              0,
              Math.min(elapsedSeconds, incident.releasedOffsetSeconds) -
                incident.dispatchOffsetSeconds,
            ),
          0,
        );
      const utilizationSeconds = emergencyUtilizationSeconds + assignments.reduce((sum, assignment) => {
        const occupiedUntil = Math.min(elapsedSeconds, assignment.endOffsetSeconds);
        return sum + Math.max(0, occupiedUntil - assignment.startOffsetSeconds);
      }, 0);
      const waitingSeconds = assignments
        .filter((assignment) => assignment.startOffsetSeconds <= elapsedSeconds)
        .reduce(
          (sum, assignment) =>
            sum + Math.max(
              0,
              assignment.startOffsetSeconds - assignment.requestedStartOffsetSeconds,
            ),
          0,
        );
      let phase: SimulationSupportVehiclePhase = "standby";
      const activeEmergency = result.emergencyIncidents.find(
        (incident) =>
          incident.assignedVehicleIds.includes(vehicle.id) &&
          incident.dispatchOffsetSeconds <= elapsedSeconds &&
          incident.releasedOffsetSeconds > elapsedSeconds,
      ) ?? null;
      if (activeEmergency) {
        phase = elapsedSeconds < activeEmergency.arrivalOffsetSeconds
          ? "dispatching"
          : elapsedSeconds < activeEmergency.serviceCompletedOffsetSeconds
            ? "servicing"
            : "returning";
      } else if (activeAssignment) {
        const timeline = buildGroundSupportEventTimeline(activeAssignment);
        phase = elapsedSeconds < timeline.arrived
          ? "dispatching"
          : elapsedSeconds < timeline.serviceCompleted
            ? "servicing"
            : "returning";
      }
      return Object.freeze({
        id: vehicle.id,
        airportIdent: airport.ident,
        category: vehicle.category,
        phase,
        activeMissionId: activeEmergency?.sourceMissionId ?? activeAssignment?.missionId ?? null,
        assignedAircraftId: activeEmergency?.aircraftId ?? activeAssignment?.aircraftId ?? null,
        activeRoleLabel: activeEmergency
          ? `${activeEmergency.label}应急响应`
          : activeAssignment?.roleLabel ?? null,
        completedTaskCount,
        utilizationSeconds: Math.round(utilizationSeconds),
        utilizationRate: round(
          elapsedSeconds > 0 ? utilizationSeconds / elapsedSeconds : 0,
          3,
        ),
        waitingSeconds: Math.round(waitingSeconds),
      });
    }),
  );
  const airportSupport = input.airports.map((airport) => {
    const vehicles = projectedSupportVehicles.filter(
      (vehicle) => vehicle.airportIdent === airport.ident,
    );
    const airportAssignments = supportAssignments.filter(
      (assignment) => assignment.airportIdent === airport.ident,
    );
    const roleWaiting = new Map<string, number>();
    airportAssignments
      .filter((assignment) => assignment.startOffsetSeconds <= elapsedSeconds)
      .forEach((assignment) => {
        roleWaiting.set(
          assignment.roleLabel,
          (roleWaiting.get(assignment.roleLabel) ?? 0) + Math.max(
            0,
            assignment.startOffsetSeconds - assignment.requestedStartOffsetSeconds,
          ),
        );
      });
    const bottleneck = [...roleWaiting.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )[0];
    const totalUtilizationSeconds = vehicles.reduce(
      (sum, vehicle) => sum + vehicle.utilizationSeconds,
      0,
    );
    const totalWaitingSeconds = vehicles.reduce(
      (sum, vehicle) => sum + vehicle.waitingSeconds,
      0,
    );
    return Object.freeze({
      airportIdent: airport.ident,
      vehicleCount: vehicles.length,
      activeVehicleCount: vehicles.filter((vehicle) => vehicle.phase !== "standby").length,
      completedTaskCount: vehicles.reduce(
        (sum, vehicle) => sum + vehicle.completedTaskCount,
        0,
      ),
      utilizationRate: round(
        elapsedSeconds > 0 && vehicles.length > 0
          ? totalUtilizationSeconds / (elapsedSeconds * vehicles.length)
          : 0,
        3,
      ),
      waitingMinutes: Math.round(totalWaitingSeconds / 60),
      bottleneckRoleLabel:
        bottleneck && bottleneck[1] > 0 ? bottleneck[0] : "无明显瓶颈",
    });
  });

  return Object.freeze({
    elapsedSeconds,
    aircraft: Object.freeze(projectedAircraft),
    airports: Object.freeze(airports),
    supportVehicles: Object.freeze(projectedSupportVehicles),
    airportSupport: Object.freeze(airportSupport),
    emergencyIncidents: Object.freeze(projectedEmergencyIncidents),
    blockedStandIds: Object.freeze(
      projectedEmergencyIncidents
        .filter((incident) => incident.standBlocked)
        .map((incident) => incident.occupiedStandId),
    ),
    standOccupancy: Object.freeze(standOccupancy),
    completedMissionCount: result.missions.filter(
      (mission) => mission.arrivalOffsetSeconds <= elapsedSeconds,
    ).length,
    activeFlightCount: projectedAircraft.filter(
      (aircraft) => aircraft.phase === "in_flight",
    ).length,
    activeMaintenanceCount: projectedAircraft.filter(
      (aircraft) => aircraft.phase === "maintenance",
    ).length,
    activeSupportVehicleCount: projectedSupportVehicles.filter(
      (vehicle) => vehicle.phase !== "standby",
    ).length,
    completedSupportTaskCount: projectedSupportVehicles.reduce(
      (sum, vehicle) => sum + vehicle.completedTaskCount,
      0,
    ),
    supportWaitingMinutes: Math.round(
      projectedSupportVehicles.reduce(
        (sum, vehicle) => sum + vehicle.waitingSeconds,
        0,
      ) / 60,
    ),
    activeEmergencyCount: projectedEmergencyIncidents.filter(
      (incident) => incident.active,
    ).length,
    activeEmergencyVehicleCount: projectedSupportVehicles.filter(
      (vehicle) => vehicle.activeRoleLabel?.includes("应急响应"),
    ).length,
  });
}
