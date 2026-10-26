import {
  type SimulationEventContract,
  type SimulationEventType,
  type SimulationInputContract,
} from "./simulationContract";
import {
  createFleet72hTaskPlan,
  type AirportPlanningConstraint,
  type DailyOperationPlan,
  type Fleet72hTaskPlan,
  type Fleet72hTaskPlannerOptions,
  type PlannedFlightMission,
  type PlannedMaintenanceWindow,
} from "./fleet72hTaskPlanner";
import { buildGroundSupportEventTimeline } from "./groundSupportEventTimeline";
import { selectStandByUnifiedPolicy } from "../../services/standDispatchPolicy";
import {
  summarizeOperationalTiming,
  type SimulationOperationalTimeMetrics,
} from "./operationalTimeClassification";

export const RESOURCE_CONSTRAINED_ENGINE_ID = "airport_72h_resource_engine_v1";

export type PlannedMaintenanceWorkOrder = Readonly<{
  id: string;
  maintenanceWindowId: string;
  aircraftId: string;
  airportIdent: string;
  componentId: string;
  componentName: string;
  componentCategory: string;
  componentPosition: "left" | "right" | "center";
  faultCode: string;
  maintenanceAction: string;
  maintenanceAreaId: string;
  personnelRequired: number;
  equipmentRequired: number;
  supportVehicleId: string | null;
  sparePartId: string;
  startOffsetSeconds: number;
  endOffsetSeconds: number | null;
  restoredLifeHours: number;
  releasePolicy: "automatic_after_completion" | "manual_engineering_release";
}>;

export type SimulatedEmergencyIncidentType =
  | "engine_fire"
  | "fuel_leak"
  | "landing_gear_overheat";

export type SimulatedEmergencyIncident = Readonly<{
  id: string;
  type: SimulatedEmergencyIncidentType;
  label: string;
  responseLevel: "一级" | "二级" | "三级";
  airportIdent: string;
  aircraftId: string;
  sourceMissionId: string;
  occupiedStandId: string;
  requiredVehicleCount: number;
  assignedVehicleIds: readonly string[];
  detectedOffsetSeconds: number;
  dispatchOffsetSeconds: number;
  arrivalOffsetSeconds: number;
  serviceCompletedOffsetSeconds: number;
  releasedOffsetSeconds: number;
  operationalReleaseOffsetSeconds: number;
  responseDelaySeconds: number;
  onSceneDurationSeconds: number;
  affectedMissionIds: readonly string[];
  propagatedDelaySeconds: number;
  standReassignedMissionIds: readonly string[];
  standWaitingMissionIds: readonly string[];
}>;

export type ResourceConstrainedSimulationMetrics = Readonly<{
  fleetSize: number;
  initiallyDispatchableAircraft: number;
  plannedMissionCount: number;
  plannedFlightHours: number;
  delayedMissionCount: number;
  resourceDelayHours: number;
  simulatedFaultCount: number;
  emergencyIncidentCount: number;
  levelThreeEmergencyCount: number;
  emergencyResponseDelayHours: number;
  emergencyDelayedMissionCount: number;
  emergencyPropagatedDelayHours: number;
  emergencyCanceledMissionCount: number;
  emergencyStandReassignmentCount: number;
  emergencyStandWaitingMissionCount: number;
  emergencyGroundSupportRouteRecompileCount: number;
  maintenanceWindowCount: number;
  maintenanceWorkOrderCount: number;
  automaticallyRecoverableWorkOrderCount: number;
  turnaroundTaskCount: number;
  fleetUtilizationRate: number;
}>;

export type ResourceConstrainedEventEngineResult = Readonly<{
  engineId: typeof RESOURCE_CONSTRAINED_ENGINE_ID;
  maturity: "resource_constrained_v1";
  seed: number;
  horizonHours: 72;
  generatedAt: string;
  scenarioId: string;
  inputContractId: string;
  events: readonly SimulationEventContract[];
  missions: readonly PlannedFlightMission[];
  maintenanceWindows: readonly PlannedMaintenanceWindow[];
  maintenanceWorkOrders: readonly PlannedMaintenanceWorkOrder[];
  emergencyIncidents: readonly SimulatedEmergencyIncident[];
  airportConstraints: readonly AirportPlanningConstraint[];
  dailyPlans: readonly DailyOperationPlan[];
  metrics: ResourceConstrainedSimulationMetrics;
  operationalTiming: SimulationOperationalTimeMetrics;
  assumptions: readonly string[];
}>;

const EVENT_PRIORITIES: Record<SimulationEventType, number> = {
  simulation_started: 0,
  support_reserved: 5,
  maintenance_completed: 10,
  maintenance_release_issued: 11,
  support_dispatched: 15,
  fault_detected: 20,
  support_arrived: 25,
  support_service_started: 26,
  destination_handoff_accepted: 27,
  arrival_clearance_issued: 28,
  flight_arrived: 30,
  support_service_completed: 35,
  maintenance_started: 40,
  // 同一车辆可以在上一任务结束的同一秒承接下一任务；必须先记录返场与释放，
  // 再记录新任务出发，避免事件日志出现瞬时重复占用。
  support_returned: 13,
  support_released: 14,
  emergency_detected: 18,
  emergency_stand_blocked: 18,
  emergency_response_dispatched: 19,
  emergency_response_arrived: 24,
  emergency_response_completed: 34,
  emergency_response_released: 47,
  emergency_operational_review_started: 48,
  emergency_mission_delayed: 20,
  emergency_stand_reassigned: 21,
  emergency_ground_support_recompiled: 22,
  emergency_operational_released: 49,
  departure_clearance_issued: 49,
  flight_departed: 50,
  simulation_completed: 100,
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const EMERGENCY_DEFINITIONS = Object.freeze([
  Object.freeze({
    type: "engine_fire" as const,
    label: "发动机火警",
    responseLevel: "三级" as const,
    requiredVehicleCount: 3,
    onSceneDurationSeconds: 45 * 60,
    operationalRecoverySeconds: 12 * 3600,
  }),
  Object.freeze({
    type: "fuel_leak" as const,
    label: "燃油泄漏",
    responseLevel: "二级" as const,
    requiredVehicleCount: 2,
    onSceneDurationSeconds: 30 * 60,
    operationalRecoverySeconds: 9 * 3600,
  }),
  Object.freeze({
    type: "landing_gear_overheat" as const,
    label: "起落架过热",
    responseLevel: "一级" as const,
    requiredVehicleCount: 1,
    onSceneDurationSeconds: 20 * 60,
    operationalRecoverySeconds: 6 * 3600,
  }),
]);

function createEmergencyIncidents(
  input: SimulationInputContract,
  missions: readonly PlannedFlightMission[],
  probability: number,
): readonly SimulatedEmergencyIncident[] {
  const horizonSeconds = input.horizonHours * 3600;
  const vehicleAvailableAt = new Map<string, number>();
  input.airports.forEach((airport) => {
    airport.supportVehicles
      .filter(
        (vehicle) =>
          vehicle.category === "rescue_vehicle" &&
          vehicle.geospatialReadiness === "ready",
      )
      .forEach((vehicle) => vehicleAvailableAt.set(vehicle.id, 0));
  });
  const incidents: SimulatedEmergencyIncident[] = [];
  missions.forEach((mission) => {
    const hash = hashText(`${input.seed}|${mission.id}|emergency-v1`);
    if (hash / 4_294_967_296 >= probability) return;
    const definition = EMERGENCY_DEFINITIONS[(hash >>> 8) % EMERGENCY_DEFINITIONS.length];
    if (!definition) return;
    const detectedOffsetSeconds = Math.round(mission.arrivalOffsetSeconds + 5 * 60);
    if (detectedOffsetSeconds >= horizonSeconds) return;
    const airport = input.airports.find(
      (candidate) => candidate.ident === mission.destinationAirportIdent,
    );
    const candidates = (airport?.supportVehicles ?? [])
      .filter(
        (vehicle) =>
          vehicle.category === "rescue_vehicle" &&
          vehicle.geospatialReadiness === "ready",
      )
      .sort(
        (left, right) =>
          (vehicleAvailableAt.get(left.id) ?? 0) -
            (vehicleAvailableAt.get(right.id) ?? 0) ||
          left.id.localeCompare(right.id),
      )
      .slice(0, definition.requiredVehicleCount);
    if (candidates.length < definition.requiredVehicleCount) return;
    const dispatchOffsetSeconds = Math.max(
      detectedOffsetSeconds,
      ...candidates.map((vehicle) => vehicleAvailableAt.get(vehicle.id) ?? 0),
    );
    const travelSeconds = 8 * 60;
    const arrivalOffsetSeconds = dispatchOffsetSeconds + travelSeconds;
    const serviceCompletedOffsetSeconds =
      arrivalOffsetSeconds + definition.onSceneDurationSeconds;
    const releasedOffsetSeconds = serviceCompletedOffsetSeconds + travelSeconds;
    if (releasedOffsetSeconds > horizonSeconds) return;
    candidates.forEach((vehicle) =>
      vehicleAvailableAt.set(vehicle.id, releasedOffsetSeconds),
    );
    incidents.push(Object.freeze({
      id: `EMG-${mission.id}`,
      ...definition,
      airportIdent: mission.destinationAirportIdent,
      aircraftId: mission.aircraftId,
      sourceMissionId: mission.id,
      occupiedStandId: mission.destinationStandId,
      assignedVehicleIds: Object.freeze(candidates.map((vehicle) => vehicle.id)),
      detectedOffsetSeconds,
      dispatchOffsetSeconds,
      arrivalOffsetSeconds,
      serviceCompletedOffsetSeconds,
      releasedOffsetSeconds,
      operationalReleaseOffsetSeconds:
        releasedOffsetSeconds + definition.operationalRecoverySeconds,
      responseDelaySeconds: dispatchOffsetSeconds - detectedOffsetSeconds,
      affectedMissionIds: Object.freeze([]),
      propagatedDelaySeconds: 0,
      standReassignedMissionIds: Object.freeze([]),
      standWaitingMissionIds: Object.freeze([]),
    }));
  });
  return Object.freeze(incidents);
}

type EmergencyPropagationResult = Readonly<{
  missions: readonly PlannedFlightMission[];
  incidents: readonly SimulatedEmergencyIncident[];
  maintenanceWindows: readonly PlannedMaintenanceWindow[];
  dailyPlans: readonly DailyOperationPlan[];
  canceledMissionCount: number;
}>;

function applyEmergencyOperationalConsequences(
  input: SimulationInputContract,
  sourceMissions: readonly PlannedFlightMission[],
  sourceIncidents: readonly SimulatedEmergencyIncident[],
  maintenanceWindows: readonly PlannedMaintenanceWindow[],
  airportConstraints: readonly AirportPlanningConstraint[],
): EmergencyPropagationResult {
  const horizonSeconds = input.horizonHours * 3600;
  const missionById = new Map(sourceMissions.map((mission) => [mission.id, mission]));
  const incidentsByAircraft = new Map<string, SimulatedEmergencyIncident[]>();
  sourceIncidents.forEach((incident) => {
    incidentsByAircraft.set(incident.aircraftId, [
      ...(incidentsByAircraft.get(incident.aircraftId) ?? []),
      incident,
    ]);
  });

  const shiftedMissions: PlannedFlightMission[] = [];
  const enrichedIncidents: SimulatedEmergencyIncident[] = [];
  const canceledMissionIds = new Set<string>();
  const missionShiftSeconds = new Map<string, number>();

  const missionsByAircraft = new Map<string, PlannedFlightMission[]>();
  sourceMissions.forEach((mission) => {
    missionsByAircraft.set(mission.aircraftId, [
      ...(missionsByAircraft.get(mission.aircraftId) ?? []),
      mission,
    ]);
  });

  missionsByAircraft.forEach((aircraftMissions, aircraftId) => {
    const ordered = [...aircraftMissions].sort(
      (left, right) => left.departureOffsetSeconds - right.departureOffsetSeconds,
    );
    const incidents = [...(incidentsByAircraft.get(aircraftId) ?? [])].sort(
      (left, right) => left.detectedOffsetSeconds - right.detectedOffsetSeconds,
    );
    let cumulativeDelaySeconds = 0;
    const sourceMissionShift = new Map<string, number>();
    const incidentContribution = new Map<string, number>();
    const incidentAffectedMissionIds = new Map<string, string[]>();
    const activeIncidentCauses = new Set<string>();

    ordered.forEach((mission) => {
      const applicableIncidents = incidents.filter((incident) => {
        const source = missionById.get(incident.sourceMissionId);
        return source && source.arrivalOffsetSeconds < mission.departureOffsetSeconds;
      });
      applicableIncidents.forEach((incident) => {
        const source = missionById.get(incident.sourceMissionId);
        if (!source) return;
        const shiftedOperationalRelease =
          incident.operationalReleaseOffsetSeconds +
          (sourceMissionShift.get(incident.sourceMissionId) ?? 0);
        const requestedDeparture = mission.departureOffsetSeconds + cumulativeDelaySeconds;
        if (shiftedOperationalRelease > requestedDeparture) {
          const addedDelay = shiftedOperationalRelease - requestedDeparture;
          cumulativeDelaySeconds += addedDelay;
          incidentContribution.set(
            incident.id,
            (incidentContribution.get(incident.id) ?? 0) + addedDelay,
          );
          activeIncidentCauses.add(incident.id);
        }
      });

      activeIncidentCauses.forEach((incidentId) => {
        incidentAffectedMissionIds.set(incidentId, [
          ...(incidentAffectedMissionIds.get(incidentId) ?? []),
          mission.id,
        ]);
      });

      const departureOffsetSeconds = mission.departureOffsetSeconds + cumulativeDelaySeconds;
      const arrivalOffsetSeconds = mission.arrivalOffsetSeconds + cumulativeDelaySeconds;
      sourceMissionShift.set(mission.id, cumulativeDelaySeconds);
      missionShiftSeconds.set(mission.id, cumulativeDelaySeconds);
      if (arrivalOffsetSeconds > horizonSeconds) {
        canceledMissionIds.add(mission.id);
        return;
      }
      shiftedMissions.push(Object.freeze({
        ...mission,
        departureOffsetSeconds,
        arrivalOffsetSeconds,
        delaySeconds: mission.delaySeconds + cumulativeDelaySeconds,
        emergencyOperationalHoldSeconds:
          mission.emergencyOperationalHoldSeconds + cumulativeDelaySeconds,
        constraintReasons: cumulativeDelaySeconds > 0
          ? Object.freeze([
              ...mission.constraintReasons,
              ...(!mission.constraintReasons.includes("emergency_operational_hold")
                ? ["emergency_operational_hold" as const]
                : []),
            ])
          : mission.constraintReasons,
      }));
    });

    incidents.forEach((incident) => {
      const affectedMissionIds = incidentAffectedMissionIds.get(incident.id) ?? [];
      const propagatedDelaySeconds = incidentContribution.get(incident.id) ?? 0;
      const sourceShift = sourceMissionShift.get(incident.sourceMissionId) ?? 0;
      enrichedIncidents.push(Object.freeze({
        ...incident,
        detectedOffsetSeconds: incident.detectedOffsetSeconds + sourceShift,
        dispatchOffsetSeconds: incident.dispatchOffsetSeconds + sourceShift,
        arrivalOffsetSeconds: incident.arrivalOffsetSeconds + sourceShift,
        serviceCompletedOffsetSeconds:
          incident.serviceCompletedOffsetSeconds + sourceShift,
        releasedOffsetSeconds: incident.releasedOffsetSeconds + sourceShift,
        operationalReleaseOffsetSeconds:
          incident.operationalReleaseOffsetSeconds + sourceShift,
        affectedMissionIds: Object.freeze(affectedMissionIds),
        propagatedDelaySeconds,
      }));
    });
  });

  const runwaySeparationByAirport = new Map(
    airportConstraints.map((constraint) => [
      constraint.airportIdent,
      constraint.runwaySeparationSeconds,
    ]),
  );
  const runwayMovements = new Map<string, number[]>();
  const aircraftAvailableAt = new Map<string, number>();
  const reserveAfter = (airportIdent: string, requested: number) => {
    const separation = runwaySeparationByAirport.get(airportIdent) ?? 180;
    const movements = runwayMovements.get(airportIdent) ?? [];
    let candidate = requested;
    let conflict = true;
    while (conflict) {
      conflict = false;
      for (const movement of movements) {
        if (Math.abs(candidate - movement) < separation) {
          candidate = movement + separation;
          conflict = true;
          break;
        }
      }
    }
    return candidate;
  };
  const normalizedMissionById = new Map<string, PlannedFlightMission>();
  const shiftPastMaintenanceWindows = (
    aircraftId: string,
    requestedDeparture: number,
    duration: number,
  ) => {
    let candidate = requestedDeparture;
    let shifted = true;
    while (shifted) {
      shifted = false;
      for (const window of maintenanceWindows) {
        if (window.aircraftId !== aircraftId || window.endOffsetSeconds === null) continue;
        const sourceMissionId = window.trigger === "simulated_fault"
          ? window.id.replace(/^MW-/, "")
          : null;
        const sourceMission = sourceMissionId ? missionById.get(sourceMissionId) : null;
        const normalizedSourceMission = sourceMissionId
          ? normalizedMissionById.get(sourceMissionId)
          : null;
        const windowShift = sourceMission && normalizedSourceMission
          ? normalizedSourceMission.arrivalOffsetSeconds - sourceMission.arrivalOffsetSeconds
          : 0;
        const start = window.startOffsetSeconds + windowShift;
        const end = window.endOffsetSeconds + windowShift;
        if (candidate < end && candidate + duration > start) {
          candidate = end;
          shifted = true;
        }
      }
    }
    return candidate;
  };
  const normalizedMissions = [...shiftedMissions]
    .sort(
      (left, right) =>
        left.departureOffsetSeconds - right.departureOffsetSeconds ||
        left.id.localeCompare(right.id),
    )
    .flatMap((mission) => {
      const duration = mission.arrivalOffsetSeconds - mission.departureOffsetSeconds;
      let departureOffsetSeconds = Math.max(
        mission.departureOffsetSeconds,
        aircraftAvailableAt.get(mission.aircraftId) ?? 0,
      );
      departureOffsetSeconds = shiftPastMaintenanceWindows(
        mission.aircraftId,
        departureOffsetSeconds,
        duration,
      );
      let arrivalOffsetSeconds = departureOffsetSeconds + duration;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const departureSlot = reserveAfter(
          mission.sourceAirportIdent,
          departureOffsetSeconds,
        );
        const arrivalSlot = reserveAfter(
          mission.destinationAirportIdent,
          departureSlot + duration,
        );
        const nextDeparture = shiftPastMaintenanceWindows(
          mission.aircraftId,
          arrivalSlot - duration,
          duration,
        );
        if (nextDeparture === departureSlot) {
          departureOffsetSeconds = departureSlot;
          arrivalOffsetSeconds = arrivalSlot;
          break;
        }
        departureOffsetSeconds = nextDeparture;
        arrivalOffsetSeconds = arrivalSlot;
      }
      if (arrivalOffsetSeconds > horizonSeconds) {
        canceledMissionIds.add(mission.id);
        return [];
      }
      runwayMovements.set(mission.sourceAirportIdent, [
        ...(runwayMovements.get(mission.sourceAirportIdent) ?? []),
        departureOffsetSeconds,
      ].sort((left, right) => left - right));
      runwayMovements.set(mission.destinationAirportIdent, [
        ...(runwayMovements.get(mission.destinationAirportIdent) ?? []),
        arrivalOffsetSeconds,
      ].sort((left, right) => left - right));
      aircraftAvailableAt.set(mission.aircraftId, arrivalOffsetSeconds);
      const addedSlotDelay = departureOffsetSeconds - mission.departureOffsetSeconds;
      const normalizedMission = Object.freeze({
        ...mission,
        departureOffsetSeconds,
        arrivalOffsetSeconds,
        delaySeconds: mission.delaySeconds + addedSlotDelay,
        departureRunwayHoldSeconds:
          mission.departureRunwayHoldSeconds + addedSlotDelay,
        constraintReasons: addedSlotDelay > 0 &&
          !mission.constraintReasons.includes("departure_runway_slot")
          ? Object.freeze([
              ...mission.constraintReasons,
              "departure_runway_slot" as const,
            ])
          : mission.constraintReasons,
      });
      normalizedMissionById.set(mission.id, normalizedMission);
      return [normalizedMission];
    });

  const shiftedMaintenanceWindows = maintenanceWindows.map((window) => {
    if (window.trigger !== "simulated_fault") return window;
    const sourceMissionId = window.id.replace(/^MW-/, "");
    const sourceMission = missionById.get(sourceMissionId);
    const normalizedSourceMission = normalizedMissionById.get(sourceMissionId);
    const shiftSeconds = sourceMission && normalizedSourceMission
      ? normalizedSourceMission.arrivalOffsetSeconds - sourceMission.arrivalOffsetSeconds
      : missionShiftSeconds.get(sourceMissionId) ?? 0;
    if (shiftSeconds === 0) return window;
    return Object.freeze({
      ...window,
      startOffsetSeconds: window.startOffsetSeconds + shiftSeconds,
      endOffsetSeconds: window.endOffsetSeconds === null
        ? null
        : window.endOffsetSeconds + shiftSeconds,
    });
  });

  type StandReservation = {
    missionId: string;
    aircraftId: string;
    start: number;
    end: number;
  };
  const standReservations = new Map<string, StandReservation[]>();
  const resolvedMissionById = new Map(
    normalizedMissions.map((mission) => [mission.id, mission]),
  );
  const missionsByAircraftAfterRunway = new Map<string, PlannedFlightMission[]>();
  normalizedMissions.forEach((mission) => {
    missionsByAircraftAfterRunway.set(mission.aircraftId, [
      ...(missionsByAircraftAfterRunway.get(mission.aircraftId) ?? []),
      mission,
    ]);
  });
  input.aircraft.forEach((aircraft) => {
    const missions = [...(missionsByAircraftAfterRunway.get(aircraft.id) ?? [])].sort(
      (left, right) => left.departureOffsetSeconds - right.departureOffsetSeconds,
    );
    if (aircraft.currentStandId) {
      const key = `${aircraft.initialAirportIdent}:${aircraft.currentStandId}`;
      standReservations.set(key, [
        ...(standReservations.get(key) ?? []),
        {
          missionId: `INITIAL-${aircraft.id}`,
          aircraftId: aircraft.id,
          start: 0,
          end: missions[0]?.departureOffsetSeconds ?? horizonSeconds,
        },
      ]);
    }
  });
  const arrivalWindows = normalizedMissions
    .map((mission) => {
      const missions = [...(missionsByAircraftAfterRunway.get(mission.aircraftId) ?? [])]
        .sort((left, right) => left.departureOffsetSeconds - right.departureOffsetSeconds);
      const index = missions.findIndex((candidate) => candidate.id === mission.id);
      return {
        mission,
        start: mission.arrivalOffsetSeconds,
        end: missions[index + 1]?.departureOffsetSeconds ?? horizonSeconds,
      };
    })
    .sort((left, right) => left.start - right.start || left.mission.id.localeCompare(right.mission.id));
  arrivalWindows.forEach(({ mission, start, end }) => {
    const airport = input.airports.find(
      (candidate) => candidate.ident === mission.destinationAirportIdent,
    );
    const aircraft = input.aircraft.find((candidate) => candidate.id === mission.aircraftId);
    if (!airport || !aircraft) return;
    const desiredKey = `${airport.ident}:${mission.destinationStandId}`;
    const desiredReservations = standReservations.get(desiredKey) ?? [];
    const hasConflict = desiredReservations.some(
      (reservation) => reservation.start < end && reservation.end > start,
    );
    let resolvedStandId = mission.destinationStandId;
    if (hasConflict) {
      const originalStand = airport.stands.find((stand) => stand.id === mission.destinationStandId);
      const candidates = airport.stands.filter((stand) => {
        if (stand.kind !== "boarding" || stand.operationalAvailability !== "active") return false;
        return (standReservations.get(`${airport.ident}:${stand.id}`) ?? []).every(
          (reservation) => reservation.end <= start || reservation.start >= end,
        );
      });
      const occupiedStandIds = new Set(
        airport.stands
          .filter((stand) => (standReservations.get(`${airport.ident}:${stand.id}`) ?? [])
            .some((reservation) => reservation.start <= start && reservation.end > start))
          .map((stand) => stand.id),
      );
      const selection = selectStandByUnifiedPolicy({
        aircraftModel: aircraft.model,
        desiredAtSeconds: start,
        occupiedStandIds,
        distanceBasisLabel: "距原计划机位",
        candidates: candidates.map((stand) => ({
          id: stand.id,
          referenceCode: stand.referenceCode,
          operationalRole: stand.operationalRole,
          availableAtSeconds: 0,
          distanceMeters: originalStand?.position && stand.position
            ? Math.hypot(
                originalStand.position.eastMeters - stand.position.eastMeters,
                originalStand.position.northMeters - stand.position.northMeters,
              )
            : null,
        })),
      });
      if (selection) {
        resolvedStandId = selection.candidate.id;
        resolvedMissionById.set(mission.id, Object.freeze({
          ...mission,
          destinationStandId: resolvedStandId,
          destinationStandOriginalId: mission.destinationStandOriginalId ?? mission.destinationStandId,
          destinationStandPreservedBuffer: selection.preservedTwoStandBuffer,
          destinationStandSelectionBasis:
            `${selection.basis} 跑道时隙调整后原计划机位发生占用重叠，已在进场前自动改配。`,
          constraintReasons: mission.constraintReasons.includes("arrival_stand_capacity")
            ? mission.constraintReasons
            : Object.freeze([...mission.constraintReasons, "arrival_stand_capacity" as const]),
        }));
      }
    }
    const resolvedKey = `${airport.ident}:${resolvedStandId}`;
    standReservations.set(resolvedKey, [
      ...(standReservations.get(resolvedKey) ?? []),
      { missionId: mission.id, aircraftId: mission.aircraftId, start, end },
    ]);
  });
  const reassignedMissionIdsByIncident = new Map<string, string[]>();
  const waitingMissionIdsByIncident = new Map<string, string[]>();
  const alreadyResolvedMissionIds = new Set<string>();
  const horizonClosedIncidents = enrichedIncidents.filter(
    (incident) => incident.operationalReleaseOffsetSeconds <= horizonSeconds,
  );
  horizonClosedIncidents.forEach((incident) => {
    const sourceMission = resolvedMissionById.get(incident.sourceMissionId);
    if (!sourceMission) return;
    const blockedKey = `${incident.airportIdent}:${incident.occupiedStandId}`;
    const blockedReservations = standReservations.get(blockedKey) ?? [];
    const blockedEnd = Math.max(
      incident.operationalReleaseOffsetSeconds,
      blockedReservations.find(
        (reservation) => reservation.missionId === incident.sourceMissionId,
      )?.end ?? incident.operationalReleaseOffsetSeconds,
    );
    const conflicts = blockedReservations.filter(
      (reservation) =>
        reservation.missionId !== incident.sourceMissionId &&
        !reservation.missionId.startsWith("INITIAL-") &&
        reservation.start < blockedEnd &&
        reservation.end > sourceMission.arrivalOffsetSeconds,
    );
    conflicts.forEach((conflict) => {
      if (alreadyResolvedMissionIds.has(conflict.missionId)) return;
      const mission = resolvedMissionById.get(conflict.missionId);
      const aircraft = input.aircraft.find(
        (candidate) => candidate.id === conflict.aircraftId,
      );
      const airport = input.airports.find(
        (candidate) => candidate.ident === incident.airportIdent,
      );
      if (!mission || !aircraft || !airport) return;
      standReservations.set(
        blockedKey,
        (standReservations.get(blockedKey) ?? []).filter(
          (reservation) => reservation.missionId !== mission.id,
        ),
      );
      const originalStand = airport.stands.find(
        (stand) => stand.id === mission.destinationStandId,
      );
      const candidates = airport.stands.filter((stand) => {
        if (
          stand.kind !== "boarding" ||
          stand.operationalAvailability !== "active" ||
          stand.id === incident.occupiedStandId
        ) return false;
        const reservations = standReservations.get(
          `${airport.ident}:${stand.id}`,
        ) ?? [];
        return reservations.every(
          (reservation) =>
            reservation.end <= conflict.start || reservation.start >= conflict.end,
        );
      });
      const occupiedStandIds = new Set(
        airport.stands
          .filter((stand) => (standReservations.get(`${airport.ident}:${stand.id}`) ?? [])
            .some(
              (reservation) =>
                reservation.start <= conflict.start && reservation.end > conflict.start,
            ))
          .map((stand) => stand.id),
      );
      const selection = selectStandByUnifiedPolicy({
        aircraftModel: aircraft.model,
        desiredAtSeconds: mission.arrivalOffsetSeconds,
        occupiedStandIds,
        distanceBasisLabel: "距原计划机位",
        candidates: candidates.map((stand) => ({
          id: stand.id,
          referenceCode: stand.referenceCode,
          operationalRole: stand.operationalRole,
          availableAtSeconds: 0,
          distanceMeters: originalStand?.position && stand.position
            ? Math.hypot(
                originalStand.position.eastMeters - stand.position.eastMeters,
                originalStand.position.northMeters - stand.position.northMeters,
              )
            : null,
        })),
      });
      if (!selection) {
        waitingMissionIdsByIncident.set(incident.id, [
          ...(waitingMissionIdsByIncident.get(incident.id) ?? []),
          mission.id,
        ]);
        standReservations.set(blockedKey, [
          ...(standReservations.get(blockedKey) ?? []),
          conflict,
        ]);
        return;
      }
      const reassignedMission = Object.freeze({
        ...mission,
        destinationStandId: selection.candidate.id,
        destinationStandOriginalId: mission.destinationStandId,
        destinationStandReassignedByEmergency: true,
        destinationStandPreservedBuffer: selection.preservedTwoStandBuffer,
        destinationStandSelectionBasis:
          `${selection.basis} 原计划机位${mission.destinationStandId}因${incident.id}封控，已自动改配。`,
        constraintReasons: mission.constraintReasons.includes("arrival_stand_capacity")
          ? mission.constraintReasons
          : Object.freeze([
              ...mission.constraintReasons,
              "arrival_stand_capacity" as const,
            ]),
      });
      resolvedMissionById.set(mission.id, reassignedMission);
      standReservations.set(`${airport.ident}:${selection.candidate.id}`, [
        ...(standReservations.get(`${airport.ident}:${selection.candidate.id}`) ?? []),
        { ...conflict },
      ]);
      reassignedMissionIdsByIncident.set(incident.id, [
        ...(reassignedMissionIdsByIncident.get(incident.id) ?? []),
        mission.id,
      ]);
      alreadyResolvedMissionIds.add(mission.id);
    });
  });

  const standResolvedMissions = [...resolvedMissionById.values()]
    .sort(
      (left, right) =>
        left.departureOffsetSeconds - right.departureOffsetSeconds ||
        left.id.localeCompare(right.id),
    );
  const standResolvedByAircraft = new Map<string, PlannedFlightMission[]>();
  standResolvedMissions.forEach((mission) => {
    standResolvedByAircraft.set(mission.aircraftId, [
      ...(standResolvedByAircraft.get(mission.aircraftId) ?? []),
      mission,
    ]);
  });
  standResolvedByAircraft.forEach((missions, aircraftId) => {
    const aircraft = input.aircraft.find((candidate) => candidate.id === aircraftId);
    let currentStandId = aircraft?.currentStandId ?? null;
    [...missions]
      .sort((left, right) => left.departureOffsetSeconds - right.departureOffsetSeconds)
      .forEach((mission) => {
        if (mission.sourceStandId !== currentStandId) {
          resolvedMissionById.set(mission.id, Object.freeze({
            ...mission,
            sourceStandId: currentStandId,
            groundSupportSelectionBasis:
              `${mission.groundSupportSelectionBasis} 应急机位改配后，保障任务跟随飞机实际机位执行。`,
          }));
        }
        currentStandId = resolvedMissionById.get(mission.id)?.destinationStandId ??
          mission.destinationStandId;
      });
  });
  const standFinalMissions = [...resolvedMissionById.values()].sort(
    (left, right) =>
      left.departureOffsetSeconds - right.departureOffsetSeconds ||
      left.id.localeCompare(right.id),
  );
  const routeRecompileMissionIds = new Set(
    standFinalMissions
      .filter(
        (mission) =>
          mission.sourceStandId !== mission.groundSupportRouteStandId,
      )
      .map((mission) => mission.id),
  );
  const vehicleReservations = new Map<
    string,
    { start: number; end: number; missionId: string }[]
  >();
  standFinalMissions.forEach((mission) => {
    if (routeRecompileMissionIds.has(mission.id)) return;
    mission.groundSupportPackage.forEach((assignment) => {
      vehicleReservations.set(assignment.vehicleId, [
        ...(vehicleReservations.get(assignment.vehicleId) ?? []),
        {
          start: assignment.startOffsetSeconds,
          end: assignment.endOffsetSeconds,
          missionId: mission.id,
        },
      ]);
    });
  });
  const supportVehicleSpeedMetersPerSecond = (category: string) => {
    if (category === "heavy_tug" || category === "standard_tug") return 15 / 3.6;
    if (category === "follow_me_vehicle") return 30 / 3.6;
    return 25 / 3.6;
  };
  const calculateTravelSeconds = (distanceMeters: number, category: string) =>
    distanceMeters <= 0
      ? 0
      : Math.max(
          30,
          Math.ceil(
            distanceMeters / supportVehicleSpeedMetersPerSecond(category),
          ),
        );
  const reserveVehicleWindow = (
    vehicleId: string,
    requestedStart: number,
    duration: number,
    missionId: string,
  ) => {
    const reservations = vehicleReservations.get(vehicleId) ?? [];
    let start = Math.max(0, requestedStart);
    let conflict = true;
    while (conflict) {
      conflict = false;
      for (const reservation of [...reservations].sort(
        (left, right) => left.start - right.start,
      )) {
        if (start < reservation.end && start + duration > reservation.start) {
          start = reservation.end;
          conflict = true;
          break;
        }
      }
    }
    reservations.push({ start, end: start + duration, missionId });
    vehicleReservations.set(vehicleId, reservations);
    return start;
  };
  const finalMissions = standFinalMissions.map((mission) => {
    if (!routeRecompileMissionIds.has(mission.id) || !mission.sourceStandId) {
      return mission;
    }
    const airport = input.airports.find(
      (candidate) => candidate.ident === mission.sourceAirportIdent,
    );
    const sourceStand = airport?.stands.find(
      (stand) => stand.id === mission.sourceStandId,
    );
    if (!airport || !sourceStand) return mission;
    const updatedAssignments: PlannedFlightMission["groundSupportPackage"][number][] = [];
    let groupOneCompletedAt = 0;
    let tugCompletedAt = 0;
    mission.groundSupportPackage.forEach((assignment) => {
      const vehicle = airport.supportVehicles.find(
        (candidate) => candidate.id === assignment.vehicleId,
      );
      if (!vehicle) {
        updatedAssignments.push(assignment);
        return;
      }
      const route = airport.groundSupportTravelRoutes.find(
        (candidate) =>
          candidate.homeBaseId === vehicle.homeBaseId &&
          candidate.standId === mission.sourceStandId,
      );
      const directDistance = vehicle.position && sourceStand.position
        ? Math.hypot(
            vehicle.position.eastMeters - sourceStand.position.eastMeters,
            vehicle.position.northMeters - sourceStand.position.northMeters,
          )
        : 0;
      const outboundDistanceMeters = Math.max(
        0,
        route?.outboundDistanceMeters ?? directDistance,
      );
      const returnDistanceMeters = Math.max(
        0,
        route?.returnDistanceMeters ?? outboundDistanceMeters,
      );
      const outboundTravelSeconds = calculateTravelSeconds(
        outboundDistanceMeters,
        assignment.vehicleCategory,
      );
      const returnTravelSeconds = calculateTravelSeconds(
        returnDistanceMeters,
        assignment.vehicleCategory,
      );
      const predecessorCompletedAt = assignment.sequenceGroup === 2
        ? groupOneCompletedAt
        : assignment.sequenceGroup === 3
          ? tugCompletedAt
          : 0;
      const requestedStart = Math.max(
        assignment.serviceStartOffsetSeconds - outboundTravelSeconds,
        predecessorCompletedAt - outboundTravelSeconds,
      );
      const occupiedDuration =
        outboundTravelSeconds + assignment.serviceDurationSeconds + returnTravelSeconds;
      const startOffsetSeconds = reserveVehicleWindow(
        assignment.vehicleId,
        requestedStart,
        occupiedDuration,
        mission.id,
      );
      const arrivedOffsetSeconds = startOffsetSeconds + outboundTravelSeconds;
      const serviceStartOffsetSeconds = Math.max(
        arrivedOffsetSeconds,
        predecessorCompletedAt,
      );
      const serviceCompletedOffsetSeconds =
        serviceStartOffsetSeconds + assignment.serviceDurationSeconds;
      const endOffsetSeconds = serviceCompletedOffsetSeconds + returnTravelSeconds;
      const routeAuthority = route?.authority ?? "direct_distance_fallback";
      const updated = Object.freeze({
        ...assignment,
        startOffsetSeconds: Math.round(startOffsetSeconds),
        arrivedOffsetSeconds: Math.round(arrivedOffsetSeconds),
        serviceStartOffsetSeconds: Math.round(serviceStartOffsetSeconds),
        serviceCompletedOffsetSeconds: Math.round(serviceCompletedOffsetSeconds),
        endOffsetSeconds: Math.round(endOffsetSeconds),
        outboundDistanceMeters: Math.round(outboundDistanceMeters),
        returnDistanceMeters: Math.round(returnDistanceMeters),
        outboundTravelSeconds,
        returnTravelSeconds,
        routeAuthority,
        outboundRouteAuthority:
          route?.outboundAuthority ?? "direct_distance_fallback",
        returnRouteAuthority:
          route?.returnAuthority ?? "direct_distance_fallback",
        outboundPath: route?.outboundPath ?? assignment.outboundPath,
        returnPath: route?.returnPath ?? assignment.returnPath,
        unroutableDirections:
          route?.unroutableDirections ?? (["outbound", "return"] as const),
        selectionBasis:
          `${assignment.selectionBasis} 飞机改配至${mission.sourceStandId}后，` +
          `${routeAuthority === "compiled_service_road" ? "已按受控保障道路" : "按直线距离降级"}` +
          `重新计算往返距离。`,
      });
      updatedAssignments.push(updated);
      if (assignment.sequenceGroup === 1) {
        groupOneCompletedAt = Math.max(
          groupOneCompletedAt,
          serviceCompletedOffsetSeconds,
        );
      } else if (assignment.sequenceGroup === 2) {
        tugCompletedAt = serviceCompletedOffsetSeconds;
      }
    });
    return Object.freeze({
      ...mission,
      groundSupportServiceStartOffsetSeconds: Math.min(
        ...updatedAssignments.map((assignment) => assignment.serviceStartOffsetSeconds),
      ),
      groundSupportServiceEndOffsetSeconds: Math.max(
        ...updatedAssignments.map((assignment) => assignment.serviceCompletedOffsetSeconds),
      ),
      groundSupportSelectionBasis:
        `${mission.groundSupportSelectionBasis} ${mission.sourceStandId}保障路网及车辆时间窗已重新编译。`,
      groundSupportRouteStandId: mission.sourceStandId,
      groundSupportRouteRecompiledByEmergency: true,
      groundSupportPackage: Object.freeze(updatedAssignments),
    });
  });
  const finalIncidents = horizonClosedIncidents.map((incident) => Object.freeze({
    ...incident,
    standReassignedMissionIds: Object.freeze(
      reassignedMissionIdsByIncident.get(incident.id) ?? [],
    ),
    standWaitingMissionIds: Object.freeze(
      waitingMissionIdsByIncident.get(incident.id) ?? [],
    ),
  }));

  const dailyPlans = ([1, 2, 3] as const).map((day) => {
    const start = (day - 1) * 24 * 3600;
    const end = day * 24 * 3600;
    const flights = finalMissions.filter(
      (mission) => mission.departureOffsetSeconds >= start && mission.departureOffsetSeconds < end,
    );
    return Object.freeze({
      day,
      flightCount: flights.length,
      delayedFlightCount: flights.filter((mission) => mission.delaySeconds > 0).length,
      plannedFlightHours: round(
        flights.reduce((sum, mission) => sum + mission.plannedDurationHours, 0),
      ),
      maintenanceWindowCount: shiftedMaintenanceWindows.filter(
        (window) => window.startOffsetSeconds >= start && window.startOffsetSeconds < end,
      ).length,
    });
  });

  return Object.freeze({
    missions: Object.freeze(finalMissions),
    incidents: Object.freeze(finalIncidents),
    maintenanceWindows: Object.freeze(shiftedMaintenanceWindows),
    dailyPlans: Object.freeze(dailyPlans),
    canceledMissionCount: canceledMissionIds.size,
  });
}

function createMaintenanceWorkOrders(
  input: SimulationInputContract,
  windows: readonly PlannedMaintenanceWindow[],
): readonly PlannedMaintenanceWorkOrder[] {
  return Object.freeze(windows.map((window, index) => {
    const aircraft = input.aircraft.find((candidate) => candidate.id === window.aircraftId);
    const airport = input.airports.find((candidate) => candidate.ident === window.airportIdent);
    if (!aircraft || !airport) {
      throw new Error(`维修窗口${window.id}引用了不存在的飞机或机场。`);
    }
    const hash = hashText(`${input.seed}|${window.id}|maintenance-v1`);
    const components = aircraft.healthProfile.components;
    const component = components[(hash + index) % components.length];
    if (!component) throw new Error(`飞机${aircraft.id}没有可维修部件。`);
    const maintenanceAreas = [...airport.maintenanceAreas].sort(
      (left, right) => left.id.localeCompare(right.id),
    );
    const maintenanceArea = maintenanceAreas[hash % Math.max(1, maintenanceAreas.length)];
    const vehicles = airport.supportVehicles.filter(
      (vehicle) =>
        vehicle.status !== "维修" &&
        (vehicle.canPerformMaintenance || vehicle.canTransportParts),
    );
    const supportVehicle = vehicles[(hash >>> 5) % Math.max(1, vehicles.length)];
    const personnelRequired = 2 + ((hash >>> 8) % 4);
    const equipmentRequired = 1 + ((hash >>> 11) % 2);
    const restoredLifeHours = window.endOffsetSeconds === null
      ? 0
      : 180 + ((hash >>> 13) % 361);
    const faultCode = window.trigger === "initial_grounded"
      ? "GROUND-ENGINEERING-HOLD"
      : window.trigger === "initial_pending"
        ? `SCHEDULED-${component.category.toUpperCase()}`
        : `SIM-${component.category.toUpperCase()}-${String((hash % 90) + 10)}`;

    return Object.freeze({
      id: `WO-${window.id.replace(/^MW-/, "")}`,
      maintenanceWindowId: window.id,
      aircraftId: window.aircraftId,
      airportIdent: window.airportIdent,
      componentId: component.id,
      componentName: component.name,
      componentCategory: component.category,
      componentPosition: component.position,
      faultCode,
      maintenanceAction: window.trigger === "initial_grounded"
        ? "工程检查与人工放行"
        : component.category === "engine"
          ? "发动机检查、排故与寿命恢复"
          : `${component.name}检查、更换与功能测试`,
      maintenanceAreaId: maintenanceArea?.id ?? `${window.airportIdent}-MAINT-UNASSIGNED`,
      personnelRequired,
      equipmentRequired,
      supportVehicleId: supportVehicle?.id ?? null,
      sparePartId: `SPARE-${component.category.toUpperCase()}-${String((hash % 12) + 1).padStart(2, "0")}`,
      startOffsetSeconds: window.startOffsetSeconds,
      endOffsetSeconds: window.endOffsetSeconds,
      restoredLifeHours,
      releasePolicy: window.endOffsetSeconds === null
        ? "manual_engineering_release"
        : "automatic_after_completion",
    });
  }));
}

function executePreparedResourceConstrainedPlan(
  input: SimulationInputContract,
  plan: Fleet72hTaskPlan,
  options: Fleet72hTaskPlannerOptions,
): ResourceConstrainedEventEngineResult {
  const emergencyIncidentProbability = Math.max(
    0,
    Math.min(0.1, options.emergencyIncidentProbability ?? 0.01),
  );
  const plannedEmergencyIncidents = createEmergencyIncidents(
    input,
    plan.missions,
    emergencyIncidentProbability,
  );
  const emergencyConsequences = applyEmergencyOperationalConsequences(
    input,
    plan.missions,
    plannedEmergencyIncidents,
    plan.maintenanceWindows,
    plan.airportConstraints,
  );
  const operationalMissions = emergencyConsequences.missions;
  const emergencyIncidents = emergencyConsequences.incidents;
  const operationalMaintenanceWindows = emergencyConsequences.maintenanceWindows;
  const maintenanceWorkOrders = createMaintenanceWorkOrders(
    input,
    operationalMaintenanceWindows,
  );
  const events: SimulationEventContract[] = [];
  const addEvent = (event: {
    type: SimulationEventType;
    offsetSeconds: number;
    airportIdent: string | null;
    aircraftId: string | null;
    missionId: string | null;
    description: string;
    payload?: Readonly<Record<string, string | number | boolean | null>>;
  }) => {
    const sequence = events.length + 1;
    const offsetSeconds = Math.round(event.offsetSeconds);
    events.push(Object.freeze({
      schemaVersion: input.schemaVersion,
      id: `RC-EVT-${sequence}`,
      sequence,
      type: event.type,
      source: "baseline_engine" as const,
      offsetSeconds,
      scheduledTime: new Date(
        Date.parse(input.startTime) + offsetSeconds * 1000,
      ).toISOString(),
      priority: EVENT_PRIORITIES[event.type],
      airportIdent: event.airportIdent,
      aircraftId: event.aircraftId,
      missionId: event.missionId,
      description: event.description,
      payload: Object.freeze(event.payload ?? {}),
    }));
  };

  addEvent({
    type: "simulation_started",
    offsetSeconds: 0,
    airportIdent: null,
    aircraftId: null,
    missionId: null,
    description: "72小时资源约束推演开始",
  });
  operationalMaintenanceWindows.forEach((window) => {
    const workOrder = maintenanceWorkOrders.find(
      (candidate) => candidate.maintenanceWindowId === window.id,
    );
    if (!workOrder) throw new Error(`维修窗口${window.id}缺少维修工单。`);
    if (window.trigger === "simulated_fault") {
      addEvent({
        type: "fault_detected",
        offsetSeconds: window.startOffsetSeconds,
        airportIdent: window.airportIdent,
        aircraftId: window.aircraftId,
        missionId: window.id.replace(/^MW-/, ""),
        description: `${window.aircraftId}落地检查发现${workOrder.componentName}模拟故障`,
        payload: {
          workOrderId: workOrder.id,
          componentId: workOrder.componentId,
          faultCode: workOrder.faultCode,
        },
      });
    }
    addEvent({
      type: "maintenance_started",
      offsetSeconds: window.startOffsetSeconds,
      airportIdent: window.airportIdent,
      aircraftId: window.aircraftId,
      missionId: null,
      description: `${window.aircraftId}进入${workOrder.maintenanceAreaId}执行${workOrder.componentName}维修`,
      payload: {
        trigger: window.trigger,
        workOrderId: workOrder.id,
        maintenanceAreaId: workOrder.maintenanceAreaId,
        supportVehicleId: workOrder.supportVehicleId,
        personnelRequired: workOrder.personnelRequired,
        equipmentRequired: workOrder.equipmentRequired,
      },
    });
    if (window.endOffsetSeconds !== null) {
      addEvent({
        type: "maintenance_completed",
        offsetSeconds: window.endOffsetSeconds,
        airportIdent: window.airportIdent,
        aircraftId: window.aircraftId,
        missionId: null,
        description: `${window.aircraftId}完成${workOrder.componentName}维修并恢复可调度状态`,
        payload: {
          workOrderId: workOrder.id,
          componentId: workOrder.componentId,
          restoredLifeHours: workOrder.restoredLifeHours,
          automaticallyReleased: true,
        },
      });
      addEvent({
        type: "maintenance_release_issued",
        offsetSeconds: window.endOffsetSeconds,
        airportIdent: window.airportIdent,
        aircraftId: window.aircraftId,
        missionId: null,
        description: `系统确认${window.aircraftId}维修闭环并自动签发适航放行`,
        payload: {
          workOrderId: workOrder.id,
          componentId: workOrder.componentId,
          automatic: true,
          releasePolicy: workOrder.releasePolicy,
        },
      });
    }
  });
  operationalMissions.forEach((mission) => {
    mission.groundSupportPackage.forEach((assignment) => {
      const timeline = buildGroundSupportEventTimeline(assignment);
      const commonPayload = {
        vehicleId: assignment.vehicleId,
        vehicleCategory: assignment.vehicleCategory,
        role: assignment.role,
        roleLabel: assignment.roleLabel,
        sequenceGroup: assignment.sequenceGroup,
        sourceStandId: mission.sourceStandId,
        routeAuthority: assignment.routeAuthority,
        outboundRouteAuthority: assignment.outboundRouteAuthority,
        returnRouteAuthority: assignment.returnRouteAuthority,
        unroutableDirections: assignment.unroutableDirections.join(","),
        outboundDistanceMeters: assignment.outboundDistanceMeters,
        returnDistanceMeters: assignment.returnDistanceMeters,
        outboundTravelSeconds: assignment.outboundTravelSeconds,
        returnTravelSeconds: assignment.returnTravelSeconds,
        serviceDurationSeconds: assignment.serviceDurationSeconds,
      } as const;
      const outboundRouteDescription =
        assignment.outboundRouteAuthority === "compiled_service_road"
          ? "沿受控保障道路"
          : assignment.outboundRouteAuthority ===
              "compiled_service_road_nearest_base_assumption"
            ? "按最近已标定基地假设沿受控保障道路"
            : "按直线距离降级";
      addEvent({
        type: "support_reserved",
        offsetSeconds: timeline.reserved,
        airportIdent: mission.sourceAirportIdent,
        aircraftId: mission.aircraftId,
        missionId: mission.id,
        description: `${assignment.vehicleId}已为${mission.aircraftId}预留，执行${assignment.roleLabel}`,
        payload: { ...commonPayload, status: "reserved" },
      });
      addEvent({
        type: "support_dispatched",
        offsetSeconds: timeline.dispatched,
        airportIdent: mission.sourceAirportIdent,
        aircraftId: mission.aircraftId,
        missionId: mission.id,
        description:
          `${assignment.vehicleId}从基地出发，${outboundRouteDescription}行驶` +
          `${assignment.outboundDistanceMeters}米前往${mission.sourceStandId ?? "飞机机位"}`,
        payload: { ...commonPayload, status: "dispatching" },
      });
      addEvent({
        type: "support_arrived",
        offsetSeconds: timeline.arrived,
        airportIdent: mission.sourceAirportIdent,
        aircraftId: mission.aircraftId,
        missionId: mission.id,
        description: `${assignment.vehicleId}已到达${mission.aircraftId}所在机位`,
        payload: { ...commonPayload, status: "arrived" },
      });
      addEvent({
        type: "support_service_started",
        offsetSeconds: timeline.serviceStarted,
        airportIdent: mission.sourceAirportIdent,
        aircraftId: mission.aircraftId,
        missionId: mission.id,
        description: `${assignment.vehicleId}开始为${mission.aircraftId}执行${assignment.roleLabel}`,
        payload: { ...commonPayload, status: "servicing" },
      });
      addEvent({
        type: "support_service_completed",
        offsetSeconds: timeline.serviceCompleted,
        airportIdent: mission.sourceAirportIdent,
        aircraftId: mission.aircraftId,
        missionId: mission.id,
        description: `${assignment.vehicleId}已完成${mission.aircraftId}的${assignment.roleLabel}`,
        payload: { ...commonPayload, status: "service_completed" },
      });
      addEvent({
        type: "support_returned",
        offsetSeconds: timeline.returned,
        airportIdent: mission.sourceAirportIdent,
        aircraftId: mission.aircraftId,
        missionId: mission.id,
        description:
          `${assignment.vehicleId}已沿保障道路返场` +
          `${assignment.returnDistanceMeters}米并到达保障基地`,
        payload: { ...commonPayload, status: "returned" },
      });
      addEvent({
        type: "support_released",
        offsetSeconds: timeline.released,
        airportIdent: mission.sourceAirportIdent,
        aircraftId: mission.aircraftId,
        missionId: mission.id,
        description: `${assignment.vehicleId}已释放并恢复可用`,
        payload: { ...commonPayload, status: "available" },
      });
    });
    addEvent({
      type: "departure_clearance_issued",
      offsetSeconds: mission.departureOffsetSeconds,
      airportIdent: mission.sourceAirportIdent,
      aircraftId: mission.aircraftId,
      missionId: mission.id,
      description: `系统完成前置条件检查，批准${mission.aircraftId}从${mission.departureRunwayRef}起飞`,
      payload: {
        automatic: true,
        runwayId: mission.departureRunwayId,
        runwayRef: mission.departureRunwayRef,
        sourceStandId: mission.sourceStandId,
      },
    });
    addEvent({
      type: "flight_departed",
      offsetSeconds: mission.departureOffsetSeconds,
      airportIdent: mission.sourceAirportIdent,
      aircraftId: mission.aircraftId,
      missionId: mission.id,
      description: `${mission.aircraftId}从${mission.sourceAirportIdent}出发，前往${mission.destinationAirportIdent}`,
      payload: {
        delaySeconds: mission.delaySeconds,
        constrained: mission.constraintReasons.length > 0,
        sourceStandId: mission.sourceStandId,
        groundSupportVehicleId: mission.groundSupportVehicleId,
        groundSupportVehicleCategory: mission.groundSupportVehicleCategory,
        groundSupportServiceStartOffsetSeconds:
          mission.groundSupportServiceStartOffsetSeconds,
        groundSupportServiceEndOffsetSeconds:
          mission.groundSupportServiceEndOffsetSeconds,
        groundSupportPackageSummary: mission.groundSupportPackage
          .map((assignment) => `${assignment.roleLabel}:${assignment.vehicleId}`)
          .join("；"),
        runwayId: mission.departureRunwayId,
        runwayRef: mission.departureRunwayRef,
        runwayLengthMarginMeters: mission.departureRunwayLengthMarginMeters,
      },
    });
    addEvent({
      type: "destination_handoff_accepted",
      offsetSeconds: mission.arrivalOffsetSeconds,
      airportIdent: mission.destinationAirportIdent,
      aircraftId: mission.aircraftId,
      missionId: mission.id,
      description: `${mission.destinationAirportIdent}自动接管${mission.aircraftId}进场任务`,
      payload: {
        automatic: true,
        sourceAirportIdent: mission.sourceAirportIdent,
        destinationAirportIdent: mission.destinationAirportIdent,
        destinationStandId: mission.destinationStandId,
      },
    });
    addEvent({
      type: "arrival_clearance_issued",
      offsetSeconds: mission.arrivalOffsetSeconds,
      airportIdent: mission.destinationAirportIdent,
      aircraftId: mission.aircraftId,
      missionId: mission.id,
      description: `系统确认跑道和机位可用，批准${mission.aircraftId}在${mission.arrivalRunwayRef}降落`,
      payload: {
        automatic: true,
        runwayId: mission.arrivalRunwayId,
        runwayRef: mission.arrivalRunwayRef,
        destinationStandId: mission.destinationStandId,
      },
    });
    addEvent({
      type: "flight_arrived",
      offsetSeconds: mission.arrivalOffsetSeconds,
      airportIdent: mission.destinationAirportIdent,
      aircraftId: mission.aircraftId,
      missionId: mission.id,
      description: `${mission.aircraftId}抵达${mission.destinationAirportIdent}`,
      payload: {
        destinationStandId: mission.destinationStandId,
        runwayId: mission.arrivalRunwayId,
        runwayRef: mission.arrivalRunwayRef,
        runwayLengthMarginMeters: mission.arrivalRunwayLengthMarginMeters,
      },
    });
  });
  emergencyIncidents.forEach((incident) => {
    const payload = {
      incidentId: incident.id,
      incidentType: incident.type,
      responseLevel: incident.responseLevel,
      requiredVehicleCount: incident.requiredVehicleCount,
      assignedVehicleIds: incident.assignedVehicleIds.join(","),
      responseDelaySeconds: incident.responseDelaySeconds,
      occupiedStandId: incident.occupiedStandId,
      operationalReleaseOffsetSeconds: incident.operationalReleaseOffsetSeconds,
      affectedMissionCount: incident.affectedMissionIds.length,
      propagatedDelaySeconds: incident.propagatedDelaySeconds,
      standReassignmentCount: incident.standReassignedMissionIds.length,
      standWaitingMissionCount: incident.standWaitingMissionIds.length,
    } as const;
    addEvent({
      type: "emergency_detected",
      offsetSeconds: incident.detectedOffsetSeconds,
      airportIdent: incident.airportIdent,
      aircraftId: incident.aircraftId,
      missionId: incident.sourceMissionId,
      description: `${incident.aircraftId}触发${incident.label}${incident.responseLevel}响应`,
      payload: { ...payload, status: "detected" },
    });
    addEvent({
      type: "emergency_stand_blocked",
      offsetSeconds: incident.detectedOffsetSeconds,
      airportIdent: incident.airportIdent,
      aircraftId: incident.aircraftId,
      missionId: incident.sourceMissionId,
      description: `${incident.occupiedStandId}因${incident.label}立即封控，禁止安排其他航空器进入`,
      payload: { ...payload, status: "stand_blocked" },
    });
    incident.affectedMissionIds.forEach((missionId) => {
      const affectedMission = operationalMissions.find(
        (mission) => mission.id === missionId,
      );
      addEvent({
        type: "emergency_mission_delayed",
        offsetSeconds: incident.detectedOffsetSeconds,
        airportIdent: affectedMission?.sourceAirportIdent ?? incident.airportIdent,
        aircraftId: affectedMission?.aircraftId ?? incident.aircraftId,
        missionId,
        description: `${missionId}受${incident.id}影响，任务时刻已联动顺延`,
        payload: { ...payload, status: "mission_delayed", affectedMissionId: missionId },
      });
    });
    incident.standReassignedMissionIds.forEach((missionId) => {
      const reassignedMission = operationalMissions.find(
        (mission) => mission.id === missionId,
      );
      if (!reassignedMission) return;
      addEvent({
        type: "emergency_stand_reassigned",
        offsetSeconds: incident.detectedOffsetSeconds,
        airportIdent: reassignedMission.destinationAirportIdent,
        aircraftId: reassignedMission.aircraftId,
        missionId,
        description:
          `${missionId}进场机位由${reassignedMission.destinationStandOriginalId ?? "原机位"}` +
          `改配至${reassignedMission.destinationStandId}`,
        payload: {
          ...payload,
          status: "stand_reassigned",
          originalStandId: reassignedMission.destinationStandOriginalId,
          reassignedStandId: reassignedMission.destinationStandId,
        },
      });
      const nextMission = operationalMissions
        .filter(
          (mission) =>
            mission.aircraftId === reassignedMission.aircraftId &&
            mission.departureOffsetSeconds > reassignedMission.departureOffsetSeconds &&
            mission.groundSupportRouteRecompiledByEmergency,
        )
        .sort(
          (left, right) => left.departureOffsetSeconds - right.departureOffsetSeconds,
        )[0];
      if (!nextMission) return;
      addEvent({
        type: "emergency_ground_support_recompiled",
        offsetSeconds: incident.detectedOffsetSeconds,
        airportIdent: nextMission.sourceAirportIdent,
        aircraftId: nextMission.aircraftId,
        missionId: nextMission.id,
        description:
          `${nextMission.id}供电、加油、牵引及引导任务已按` +
          `${nextMission.groundSupportRouteStandId}重新编译保障道路与车辆时间窗`,
        payload: {
          ...payload,
          status: "ground_support_recompiled",
          routeStandId: nextMission.groundSupportRouteStandId,
        },
      });
    });
    addEvent({
      type: "emergency_response_dispatched",
      offsetSeconds: incident.dispatchOffsetSeconds,
      airportIdent: incident.airportIdent,
      aircraftId: incident.aircraftId,
      missionId: incident.sourceMissionId,
      description: `${incident.assignedVehicleIds.join("、")}已组成${incident.label}响应编队并出发`,
      payload: { ...payload, status: "dispatched" },
    });
    addEvent({
      type: "emergency_response_arrived",
      offsetSeconds: incident.arrivalOffsetSeconds,
      airportIdent: incident.airportIdent,
      aircraftId: incident.aircraftId,
      missionId: incident.sourceMissionId,
      description: `${incident.requiredVehicleCount}辆消防救援车全部到场并开始处置`,
      payload: { ...payload, status: "on_scene" },
    });
    addEvent({
      type: "emergency_response_completed",
      offsetSeconds: incident.serviceCompletedOffsetSeconds,
      airportIdent: incident.airportIdent,
      aircraftId: incident.aircraftId,
      missionId: incident.sourceMissionId,
      description: `${incident.label}现场处置完成，消防救援编队获批返场`,
      payload: { ...payload, status: "returning" },
    });
    addEvent({
      type: "emergency_response_released",
      offsetSeconds: incident.releasedOffsetSeconds,
      airportIdent: incident.airportIdent,
      aircraftId: incident.aircraftId,
      missionId: incident.sourceMissionId,
      description: `${incident.assignedVehicleIds.join("、")}返回驻点并恢复可用`,
      payload: { ...payload, status: "released" },
    });
    addEvent({
      type: "emergency_operational_review_started",
      offsetSeconds: incident.releasedOffsetSeconds,
      airportIdent: incident.airportIdent,
      aircraftId: incident.aircraftId,
      missionId: incident.sourceMissionId,
      description: `${incident.aircraftId}转入适航复核，${incident.occupiedStandId}继续保持封控`,
      payload: { ...payload, status: "airworthiness_review" },
    });
    addEvent({
      type: "emergency_operational_released",
      offsetSeconds: incident.operationalReleaseOffsetSeconds,
      airportIdent: incident.airportIdent,
      aircraftId: incident.aircraftId,
      missionId: incident.sourceMissionId,
      description: `${incident.aircraftId}完成适航复核，${incident.occupiedStandId}解除封控并恢复运行`,
      payload: { ...payload, status: "operational_released" },
    });
  });
  addEvent({
    type: "simulation_completed",
    offsetSeconds: input.horizonHours * 3600,
    airportIdent: null,
    aircraftId: null,
    missionId: null,
    description: "72小时资源约束推演结束",
  });
  events.sort(
    (left, right) =>
      left.offsetSeconds - right.offsetSeconds ||
      left.priority - right.priority ||
      left.id.localeCompare(right.id),
  );

  const plannedFlightHours = operationalMissions.reduce(
    (sum, mission) => sum + mission.plannedDurationHours,
    0,
  );
  const delaySeconds = operationalMissions.reduce(
    (sum, mission) => sum + mission.delaySeconds,
    0,
  );
  const fleetSize = input.aircraft.length;
  const simulatedFaultCount = operationalMaintenanceWindows.filter(
    (window) => window.trigger === "simulated_fault",
  ).length;
  const operationalTiming = summarizeOperationalTiming(operationalMissions);

  return Object.freeze({
    engineId: RESOURCE_CONSTRAINED_ENGINE_ID,
    maturity: "resource_constrained_v1" as const,
    seed: plan.seed,
    horizonHours: 72 as const,
    generatedAt: input.generatedAt,
    scenarioId: input.scenarioId,
    inputContractId: input.id,
    events: Object.freeze(events),
    missions: operationalMissions,
    maintenanceWindows: operationalMaintenanceWindows,
    maintenanceWorkOrders,
    emergencyIncidents,
    airportConstraints: plan.airportConstraints,
    dailyPlans: emergencyConsequences.dailyPlans,
    operationalTiming,
    metrics: Object.freeze({
      fleetSize,
      initiallyDispatchableAircraft: input.aircraft.filter(
        (aircraft) => aircraft.dispatchEligibility === "eligible",
      ).length,
      plannedMissionCount: operationalMissions.length,
      plannedFlightHours: round(plannedFlightHours),
      delayedMissionCount: operationalMissions.filter((mission) => mission.delaySeconds > 0).length,
      resourceDelayHours: round(delaySeconds / 3600),
      simulatedFaultCount,
      emergencyIncidentCount: emergencyIncidents.length,
      levelThreeEmergencyCount: emergencyIncidents.filter(
        (incident) => incident.responseLevel === "三级",
      ).length,
      emergencyResponseDelayHours: round(
        emergencyIncidents.reduce(
          (sum, incident) => sum + incident.responseDelaySeconds,
          0,
        ) / 3600,
      ),
      emergencyDelayedMissionCount: new Set(
        emergencyIncidents.flatMap((incident) => incident.affectedMissionIds),
      ).size,
      emergencyPropagatedDelayHours: round(
        emergencyIncidents.reduce(
          (sum, incident) => sum + incident.propagatedDelaySeconds,
          0,
        ) / 3600,
      ),
      emergencyCanceledMissionCount: emergencyConsequences.canceledMissionCount,
      emergencyStandReassignmentCount: emergencyIncidents.reduce(
        (sum, incident) => sum + incident.standReassignedMissionIds.length,
        0,
      ),
      emergencyStandWaitingMissionCount: emergencyIncidents.reduce(
        (sum, incident) => sum + incident.standWaitingMissionIds.length,
        0,
      ),
      emergencyGroundSupportRouteRecompileCount: operationalMissions.filter(
        (mission) => mission.groundSupportRouteRecompiledByEmergency,
      ).length,
      maintenanceWindowCount: operationalMaintenanceWindows.length,
      maintenanceWorkOrderCount: maintenanceWorkOrders.length,
      automaticallyRecoverableWorkOrderCount: maintenanceWorkOrders.filter(
        (workOrder) => workOrder.releasePolicy === "automatic_after_completion",
      ).length,
      turnaroundTaskCount: operationalMissions.length,
      fleetUtilizationRate: round(
        fleetSize > 0 ? plannedFlightHours / (fleetSize * input.horizonHours) : 0,
        4,
      ),
    }),
    assumptions: Object.freeze([
      "当前没有正式未来三日航班计划，任务需求由固定种子规则生成。",
      `当前任务强度为单机最多${options.maximumMissionsPerAircraft ?? 5}个任务，随机种子为${plan.seed}。`,
      `模拟故障概率为${((options.simulatedFaultProbability ?? 0.025) * 100).toFixed(1)}%，跑道运行间隔为${options.runwaySeparationSeconds ?? 180}秒。`,
      `场面应急事件注入概率为${(emergencyIncidentProbability * 100).toFixed(1)}%；发动机火警、燃油泄漏、起落架过热分别按三级、二级、一级响应。`,
      `推出牵引基准时长为${Math.round((options.groundSupportServiceSeconds ?? 1800) / 60)}分钟，机场保障并行容量上限为${options.supportTeamCapacity ?? 6}。`,
      "航班先抢占保障资源、跑道时隙和维修容量，再生成事件。",
      "每个航班均保存离场与到达跑道、仿真长度余量和选择依据；当前仍按机场级跑道间隔保守限流。",
      "每个航班均落实地面供电、航空加油、推出牵引和滑行引导四阶段保障包；供电与加油可并行，牵引和引导按顺序执行，同一车辆任务不重叠。",
      "离场释放原机位，进场前按统一机位策略分配活动登机机位，机位占用随仿真时钟更新。",
      `当前在${input.airports.map((airport) => airport.name).join("、")}之间统一排班。`,
      "第三机场接入配置包后可直接加入同一计划器。",
      "模拟故障概率仅用于验证，不代表真实可靠性预测。",
      "应急事件及响应时长为固定种子仿真假设，用于验证消防车辆资源竞争，不代表真实事件发生率。",
      "应急处置结束后按事件等级追加适航复核窗口；受影响飞机持续占用到达机位，后续航班顺延，超出72小时窗口的任务不再纳入执行方案。",
      "应急封控机位与其他进场任务冲突时，优先按机型适配、用途、双空位间隔和就近原则自动改配；无可用机位时记录进场等待。",
      "应急机位改配后，飞机下一航段的供电、加油、牵引和引导任务按实际机位重新匹配受控保障道路，并重排同车时间窗。",
      "维修工单的故障部件、备件和寿命恢复值为固定种子仿真假设，不代表真实适航放行。",
      "仿真结果与实时机场运行状态隔离。",
    ]),
  });
}

/** 兼容入口：即时生成数据后运行。新页面流程应优先使用已准备数据入口。 */
export function runResourceConstrainedEventEngine(
  input: SimulationInputContract,
  options: Fleet72hTaskPlannerOptions = {},
): ResourceConstrainedEventEngineResult {
  return executePreparedResourceConstrainedPlan(
    input,
    createFleet72hTaskPlan(input, options),
    options,
  );
}

/**
 * 正式执行入口：运行内核只消费数据模拟器已经冻结的任务计划，
 * 不在执行阶段重新生成航班需求、维修窗口或资源约束样本。
 */
export function runPreparedResourceConstrainedEventEngine(
  input: SimulationInputContract,
  plan: Fleet72hTaskPlan,
  options: Fleet72hTaskPlannerOptions = {},
): ResourceConstrainedEventEngineResult {
  if (plan.horizonHours !== input.horizonHours || plan.seed !== input.seed) {
    throw new Error("已准备任务计划与仿真输入契约的时域或随机种子不一致。");
  }
  return executePreparedResourceConstrainedPlan(input, plan, options);
}
