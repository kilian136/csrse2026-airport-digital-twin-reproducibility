import type { ResourceConstrainedEventEngineResult } from "./resourceConstrainedEventEngine";
import type { SimulationInputContract } from "./simulationContract";
import {
  projectSimulationExecutionState,
  type SimulationExecutionProjection,
} from "./simulationExecutionProjection";

export type SimulationTransitionRequest =
  | Readonly<{
      type: "assign_stand";
      aircraftId: string;
      airportIdent: string;
      standId: string;
    }>
  | Readonly<{
      type: "flight_departure";
      aircraftId: string;
      missionId: string;
      sourceAirportIdent: string;
      sourceStandId: string | null;
      departureClearanceIssued: boolean;
    }>
  | Readonly<{
      type: "flight_arrival";
      aircraftId: string;
      missionId: string;
      destinationAirportIdent: string;
      destinationStandId: string;
      destinationHandoffAccepted: boolean;
      arrivalClearanceIssued: boolean;
    }>
  | Readonly<{
      type: "support_acquire";
      resourceId: string;
      aircraftId: string;
      missionId: string;
      airportIdent: string;
    }>
  | Readonly<{
      type: "support_release";
      resourceId: string;
      aircraftId: string;
      missionId: string;
      airportIdent: string;
    }>
  | Readonly<{
      type: "maintenance_release";
      aircraftId: string;
      airportIdent: string;
      workOrderId: string;
      maintenanceCompleted: boolean;
    }>;

export type SimulationTransitionRejection = Readonly<{
  ruleId: string;
  message: string;
  subjectId: string;
}>;

export type SimulationTransitionDecision = Readonly<{
  allowed: boolean;
  request: SimulationTransitionRequest;
  rejections: readonly SimulationTransitionRejection[];
}>;

export type PlannedTransitionGuardAudit = Readonly<{
  status: "passed" | "failed";
  checkedTransitionCount: number;
  acceptedTransitionCount: number;
  rejectedTransitionCount: number;
  rejected: readonly Readonly<{
    eventId: string;
    offsetSeconds: number;
    decision: SimulationTransitionDecision;
  }>[];
}>;

const reject = (
  ruleId: string,
  message: string,
  subjectId: string,
): SimulationTransitionRejection => Object.freeze({ ruleId, message, subjectId });

function findAircraft(
  projection: SimulationExecutionProjection,
  aircraftId: string,
) {
  return projection.aircraft.find((aircraft) => aircraft.id === aircraftId) ?? null;
}

function findResource(
  projection: SimulationExecutionProjection,
  resourceId: string,
) {
  return projection.supportVehicles.find((vehicle) => vehicle.id === resourceId) ?? null;
}

export function evaluateSimulationTransition(
  input: SimulationInputContract,
  projection: SimulationExecutionProjection,
  request: SimulationTransitionRequest,
): SimulationTransitionDecision {
  const rejections: SimulationTransitionRejection[] = [];
  const airport = input.airports.find((candidate) => {
    if (request.type === "flight_departure") return candidate.ident === request.sourceAirportIdent;
    if (request.type === "flight_arrival") return candidate.ident === request.destinationAirportIdent;
    return candidate.ident === request.airportIdent;
  });
  const aircraft = findAircraft(projection, request.aircraftId);

  if (!airport) {
    rejections.push(reject(
      "G-AIRPORT-EXISTS",
      "目标机场未配置，拒绝状态转换。",
      request.type === "flight_departure"
        ? request.sourceAirportIdent
        : request.type === "flight_arrival"
          ? request.destinationAirportIdent
          : request.airportIdent,
    ));
  }
  if (!aircraft) {
    rejections.push(reject(
      "G-AIRCRAFT-EXISTS",
      `飞机${request.aircraftId}不存在，拒绝状态转换。`,
      request.aircraftId,
    ));
  }

  if (request.type === "assign_stand") {
    const stand = airport?.stands.find((candidate) => candidate.id === request.standId);
    if (!stand) {
      rejections.push(reject(
        "G-STAND-EXISTS",
        `机位${request.standId}不属于机场${request.airportIdent}。`,
        request.standId,
      ));
    }
    const occupant = projection.standOccupancy[request.standId];
    if (occupant && occupant !== request.aircraftId) {
      rejections.push(reject(
        "G-STAND-AVAILABLE",
        `机位${request.standId}已由${occupant}占用。`,
        request.standId,
      ));
    }
    if (aircraft?.phase === "in_flight") {
      rejections.push(reject(
        "G-STAND-AIRCRAFT-ON-GROUND",
        `飞机${request.aircraftId}仍在飞行，不能直接分配地面机位。`,
        request.aircraftId,
      ));
    }
    if (
      aircraft?.currentAirportIdent &&
      aircraft.currentAirportIdent !== request.airportIdent
    ) {
      rejections.push(reject(
        "G-STAND-AIRPORT-OWNERSHIP",
        `飞机${request.aircraftId}当前归属${aircraft.currentAirportIdent}，不能占用${request.airportIdent}机位。`,
        request.aircraftId,
      ));
    }
  }

  if (request.type === "flight_departure" && aircraft) {
    if (!request.departureClearanceIssued) {
      rejections.push(reject(
        "G-DEPARTURE-CLEARANCE",
        `飞机${request.aircraftId}缺少有效起飞批准。`,
        request.missionId,
      ));
    }
    if (aircraft.phase === "in_flight" || aircraft.activeMissionId !== null) {
      rejections.push(reject(
        "G-DEPARTURE-NOT-AIRBORNE",
        `飞机${request.aircraftId}已经处于活动飞行任务。`,
        request.aircraftId,
      ));
    }
    if (aircraft.currentAirportIdent !== request.sourceAirportIdent) {
      rejections.push(reject(
        "G-DEPARTURE-SOURCE-AIRPORT",
        `飞机${request.aircraftId}不在计划出发机场${request.sourceAirportIdent}。`,
        request.aircraftId,
      ));
    }
    if (request.sourceStandId && aircraft.currentStandId !== request.sourceStandId) {
      rejections.push(reject(
        "G-DEPARTURE-SOURCE-STAND",
        `飞机${request.aircraftId}不在计划出发机位${request.sourceStandId}。`,
        request.aircraftId,
      ));
    }
    if (aircraft.phase === "grounded" || aircraft.phase === "maintenance") {
      rejections.push(reject(
        "G-DEPARTURE-DISPATCH-ELIGIBLE",
        `飞机${request.aircraftId}当前状态为${aircraft.phase}，禁止起飞。`,
        request.aircraftId,
      ));
    }
  }

  if (request.type === "flight_arrival" && aircraft) {
    if (!request.destinationHandoffAccepted) {
      rejections.push(reject(
        "G-ARRIVAL-HANDOFF",
        `目的机场尚未接管飞机${request.aircraftId}的进场任务。`,
        request.missionId,
      ));
    }
    if (!request.arrivalClearanceIssued) {
      rejections.push(reject(
        "G-ARRIVAL-CLEARANCE",
        `飞机${request.aircraftId}缺少有效降落批准。`,
        request.missionId,
      ));
    }
    if (aircraft.phase !== "in_flight" || aircraft.activeMissionId !== request.missionId) {
      rejections.push(reject(
        "G-ARRIVAL-ACTIVE-FLIGHT",
        `飞机${request.aircraftId}没有匹配的在途任务${request.missionId}。`,
        request.aircraftId,
      ));
    }
    const stand = airport?.stands.find(
      (candidate) => candidate.id === request.destinationStandId,
    );
    if (!stand) {
      rejections.push(reject(
        "G-ARRIVAL-STAND-EXISTS",
        `到达机位${request.destinationStandId}不属于${request.destinationAirportIdent}。`,
        request.destinationStandId,
      ));
    }
    const occupant = projection.standOccupancy[request.destinationStandId];
    if (occupant && occupant !== request.aircraftId) {
      rejections.push(reject(
        "G-ARRIVAL-STAND-AVAILABLE",
        `到达机位${request.destinationStandId}已由${occupant}占用。`,
        request.destinationStandId,
      ));
    }
  }

  if (request.type === "maintenance_release" && !request.maintenanceCompleted) {
    rejections.push(reject(
      "G-MAINTENANCE-RELEASE-COMPLETION",
      `维修工单${request.workOrderId}尚未完成，禁止签发适航放行。`,
      request.workOrderId,
    ));
  }

  if (request.type === "support_acquire" || request.type === "support_release") {
    const resource = findResource(projection, request.resourceId);
    if (!resource) {
      rejections.push(reject(
        "G-RESOURCE-EXISTS",
        `保障资源${request.resourceId}不存在。`,
        request.resourceId,
      ));
    } else if (resource.airportIdent !== request.airportIdent) {
      rejections.push(reject(
        "G-RESOURCE-AIRPORT-OWNERSHIP",
        `保障资源${request.resourceId}不属于机场${request.airportIdent}。`,
        request.resourceId,
      ));
    } else if (request.type === "support_acquire") {
      if (
        resource.phase !== "standby" ||
        resource.activeMissionId !== null ||
        resource.assignedAircraftId !== null
      ) {
        rejections.push(reject(
          "G-RESOURCE-AVAILABLE",
          `保障资源${request.resourceId}尚未释放，不能重复分配。`,
          request.resourceId,
        ));
      }
    } else if (
      resource.phase === "standby" ||
      resource.activeMissionId !== request.missionId ||
      resource.assignedAircraftId !== request.aircraftId
    ) {
      rejections.push(reject(
        "G-RESOURCE-RELEASE-OWNERSHIP",
        `保障资源${request.resourceId}当前占用任务与释放请求不匹配。`,
        request.resourceId,
      ));
    }
  }

  return Object.freeze({
    allowed: rejections.length === 0,
    request,
    rejections: Object.freeze(rejections),
  });
}

export function assertSimulationTransitionAllowed(
  input: SimulationInputContract,
  projection: SimulationExecutionProjection,
  request: SimulationTransitionRequest,
): void {
  const decision = evaluateSimulationTransition(input, projection, request);
  if (!decision.allowed) {
    throw new Error(
      `状态转换被拒绝：${decision.rejections.map((item) => `${item.ruleId} ${item.message}`).join("；")}`,
    );
  }
}

export function auditPlannedTransitionGuards(
  input: SimulationInputContract,
  result: ResourceConstrainedEventEngineResult,
): PlannedTransitionGuardAudit {
  const rejected: Array<{
    eventId: string;
    offsetSeconds: number;
    decision: SimulationTransitionDecision;
  }> = [];
  let checkedTransitionCount = 0;
  const projectionCache = new Map<number, SimulationExecutionProjection>();
  const resourceOwners = new Map<
    string,
    Readonly<{ missionId: string; aircraftId: string }> | null
  >();
  const departureClearances = new Set<string>();
  const arrivalClearances = new Set<string>();
  const acceptedHandoffs = new Set<string>();
  const completedWorkOrders = new Set<string>();
  input.airports.forEach((airport) => {
    airport.supportVehicles.forEach((vehicle) => resourceOwners.set(vehicle.id, null));
  });

  const projectionBefore = (offsetSeconds: number) => {
    const cacheKey = Math.max(0, offsetSeconds - 0.001);
    const cached = projectionCache.get(cacheKey);
    if (cached) return cached;
    const projection = projectSimulationExecutionState(input, result, cacheKey);
    projectionCache.set(cacheKey, projection);
    return projection;
  };

  result.events.forEach((event, eventIndex) => {
    if (event.type === "departure_clearance_issued" && event.missionId) {
      departureClearances.add(event.missionId);
      return;
    }
    if (event.type === "destination_handoff_accepted" && event.missionId) {
      acceptedHandoffs.add(event.missionId);
      return;
    }
    if (event.type === "arrival_clearance_issued" && event.missionId) {
      arrivalClearances.add(event.missionId);
      return;
    }
    if (
      event.type === "maintenance_completed" &&
      typeof event.payload.workOrderId === "string"
    ) {
      completedWorkOrders.add(event.payload.workOrderId);
      return;
    }
    const mission = event.missionId
      ? result.missions.find((candidate) => candidate.id === event.missionId)
      : null;
    let before = projectionBefore(event.offsetSeconds);
    let request: SimulationTransitionRequest | null = null;

    if (event.type === "flight_departed" && mission) {
      request = {
        type: "flight_departure",
        aircraftId: mission.aircraftId,
        missionId: mission.id,
        sourceAirportIdent: mission.sourceAirportIdent,
        sourceStandId: mission.sourceStandId,
        departureClearanceIssued: departureClearances.has(mission.id),
      };
    } else if (event.type === "flight_arrived" && mission) {
      request = {
        type: "flight_arrival",
        aircraftId: mission.aircraftId,
        missionId: mission.id,
        destinationAirportIdent: mission.destinationAirportIdent,
        destinationStandId: mission.destinationStandId,
        destinationHandoffAccepted: acceptedHandoffs.has(mission.id),
        arrivalClearanceIssued: arrivalClearances.has(mission.id),
      };
    } else if (
      event.type === "maintenance_release_issued" &&
      event.aircraftId && event.airportIdent &&
      typeof event.payload.workOrderId === "string"
    ) {
      request = {
        type: "maintenance_release",
        aircraftId: event.aircraftId,
        airportIdent: event.airportIdent,
        workOrderId: event.payload.workOrderId,
        maintenanceCompleted: completedWorkOrders.has(event.payload.workOrderId),
      };
    } else if (
      (event.type === "support_dispatched" || event.type === "support_released") &&
      event.aircraftId && event.missionId && event.airportIdent &&
      typeof event.payload.vehicleId === "string"
    ) {
      request = {
        type: event.type === "support_dispatched" ? "support_acquire" : "support_release",
        resourceId: event.payload.vehicleId,
        aircraftId: event.aircraftId,
        missionId: event.missionId,
        airportIdent: event.airportIdent,
      };
      const owner = resourceOwners.get(event.payload.vehicleId) ?? null;
      before = {
        ...before,
        supportVehicles: before.supportVehicles.map((vehicle) =>
          vehicle.id === event.payload.vehicleId
            ? {
                ...vehicle,
                phase: owner ? "returning" as const : "standby" as const,
                activeMissionId: owner?.missionId ?? null,
                assignedAircraftId: owner?.aircraftId ?? null,
              }
            : vehicle
        ),
      };
    }

    if (request?.type === "flight_departure") {
      const aircraftBefore = before.aircraft.find(
        (aircraft) => aircraft.id === request.aircraftId,
      );
      const hasSameSecondMaintenanceRelease = result.events
        .slice(0, eventIndex)
        .some(
          (candidate) =>
            candidate.offsetSeconds === event.offsetSeconds &&
            candidate.aircraftId === request.aircraftId &&
            (candidate.type === "maintenance_completed" ||
              candidate.type === "maintenance_release_issued"),
        );
      if (aircraftBefore?.phase === "maintenance" && hasSameSecondMaintenanceRelease) {
        before = {
          ...before,
          aircraft: before.aircraft.map((aircraft) =>
            aircraft.id === request.aircraftId
              ? { ...aircraft, phase: "ground_ready" as const }
              : aircraft
          ),
        };
      }
    }

    if (!request) return;
    checkedTransitionCount += 1;
    const decision = evaluateSimulationTransition(input, before, request);
    if (!decision.allowed) {
      rejected.push({ eventId: event.id, offsetSeconds: event.offsetSeconds, decision });
    } else if (request.type === "support_acquire") {
      resourceOwners.set(request.resourceId, {
        missionId: request.missionId,
        aircraftId: request.aircraftId,
      });
    } else if (request.type === "support_release") {
      resourceOwners.set(request.resourceId, null);
    }
  });

  return Object.freeze({
    status: rejected.length === 0 ? "passed" : "failed",
    checkedTransitionCount,
    acceptedTransitionCount: checkedTransitionCount - rejected.length,
    rejectedTransitionCount: rejected.length,
    rejected: Object.freeze(rejected.map((item) => Object.freeze(item))),
  });
}
