import {
  assertSimulationInputContract,
  type SimulationAircraftInput,
  type SimulationInputContract,
  type SimulationGroundSupportTravelRouteInput,
  type SimulationGroundSupportRoutePoint,
  type SimulationStandInput,
  type SimulationSupportVehicleInput,
} from "./simulationContract";
import { getAircraftSpecification } from "../../data/aircraftSpecifications";
import { selectStandByUnifiedPolicy } from "../../services/standDispatchPolicy";
import type { SimulationDisturbanceDataset } from "./simulationDisturbanceDataSources";

export const FLEET_72H_TASK_PLANNER_ID = "fleet_72h_task_planner_v1";

/**
 * 基准过站作业提前量。正常行驶与作业时间属于计划作业，不应被记为资源等待；
 * 该窗口覆盖供电/加油并行、推出牵引和滑行引导的标准链路。
 */
export const STANDARD_GROUND_SUPPORT_LEAD_SECONDS = 120 * 60;

export const STANDARD_GROUND_SUPPORT_SERVICE_SECONDS = Object.freeze({
  groundPower: 20 * 60,
  fuelService: 30 * 60,
  followMe: 10 * 60,
});

/** 首日把初始离场分散在01:00—12:00，避免把整支机队人为压进单一早高峰。 */
export const INITIAL_DEPARTURE_SPREAD_SECONDS = 11 * 3600;

export type PlannedFlightMission = Readonly<{
  id: string;
  aircraftId: string;
  sourceAirportIdent: string;
  destinationAirportIdent: string;
  sourceStandId: string | null;
  destinationStandId: string;
  departureRunwayId: string;
  departureRunwayRef: string;
  arrivalRunwayId: string;
  arrivalRunwayRef: string;
  departureRunwayLengthMarginMeters: number | null;
  arrivalRunwayLengthMarginMeters: number | null;
  runwaySelectionBasis: string;
  destinationStandSelectionBasis: string;
  destinationStandPreservedBuffer: boolean;
  destinationStandOriginalId: string | null;
  destinationStandReassignedByEmergency: boolean;
  arrivalStandHoldSeconds: number;
  groundSupportVehicleId: string;
  groundSupportVehicleCategory: string;
  groundSupportServiceStartOffsetSeconds: number;
  groundSupportServiceEndOffsetSeconds: number;
  groundSupportSelectionBasis: string;
  groundSupportRouteStandId: string | null;
  groundSupportRouteRecompiledByEmergency: boolean;
  groundSupportPackage: readonly PlannedGroundSupportAssignment[];
  requestedDepartureOffsetSeconds: number;
  departureOffsetSeconds: number;
  arrivalOffsetSeconds: number;
  plannedDurationHours: number;
  turnaroundHours: number;
  /** 地面保障完成晚于计划离场时刻形成的等待，不含正常保障作业时长。 */
  groundSupportHoldSeconds: number;
  /** 离场跑道时隙形成的等待。 */
  departureRunwayHoldSeconds: number;
  /** 进场跑道时隙形成的等待。 */
  arrivalRunwayHoldSeconds: number;
  /** 应急处置及适航复核向后续任务传播的等待。 */
  emergencyOperationalHoldSeconds: number;
  delaySeconds: number;
  constraintReasons: readonly (
    | "ground_support_capacity"
    | "departure_runway_slot"
    | "arrival_runway_slot"
    | "arrival_stand_capacity"
    | "runway_closure"
    | "emergency_operational_hold"
  )[];
  disturbanceImpact: Readonly<{
    departureRunwayCapacityFactor: number;
    arrivalRunwayCapacityFactor: number;
    groundSpeedFactor: number;
    trafficDemandMultiplier: number;
    equipmentOutageDelaySeconds: number;
    equipmentOutageReassignmentCount: number;
    departureRunwayClosureDelaySeconds: number;
    arrivalRunwayClosureDelaySeconds: number;
    runwayReassignedByClosure: boolean;
  }>;
}>;

export type PlannedGroundSupportRole =
  | "ground_power"
  | "fuel_service"
  | "pushback_tow"
  | "follow_me";

export type PlannedGroundSupportAssignment = Readonly<{
  role: PlannedGroundSupportRole;
  roleLabel: string;
  vehicleId: string;
  vehicleCategory: string;
  sequenceGroup: 1 | 2 | 3;
  requestedStartOffsetSeconds: number;
  startOffsetSeconds: number;
  arrivedOffsetSeconds: number;
  serviceStartOffsetSeconds: number;
  serviceCompletedOffsetSeconds: number;
  endOffsetSeconds: number;
  outboundDistanceMeters: number;
  returnDistanceMeters: number;
  outboundTravelSeconds: number;
  returnTravelSeconds: number;
  serviceDurationSeconds: number;
  routeAuthority: SimulationGroundSupportTravelRouteInput["authority"];
  outboundRouteAuthority: SimulationGroundSupportTravelRouteInput["outboundAuthority"];
  returnRouteAuthority: SimulationGroundSupportTravelRouteInput["returnAuthority"];
  outboundPath: readonly SimulationGroundSupportRoutePoint[];
  returnPath: readonly SimulationGroundSupportRoutePoint[];
  unroutableDirections: readonly ("outbound" | "return")[];
  reassignedByEquipmentOutage: boolean;
  selectionBasis: string;
}>;

export type PlannedMaintenanceWindow = Readonly<{
  id: string;
  aircraftId: string;
  airportIdent: string;
  trigger: "initial_pending" | "initial_grounded" | "simulated_fault";
  startOffsetSeconds: number;
  endOffsetSeconds: number | null;
}>;

export type AirportPlanningConstraint = Readonly<{
  airportIdent: string;
  activeStandCapacity: number;
  initialFreeStandCount: number;
  runwaySeparationSeconds: number;
  supportTeamCapacity: number;
  maintenanceBayCapacity: number;
}>;

export type DailyOperationPlan = Readonly<{
  day: 1 | 2 | 3;
  flightCount: number;
  delayedFlightCount: number;
  plannedFlightHours: number;
  maintenanceWindowCount: number;
}>;

export type Fleet72hTaskPlan = Readonly<{
  plannerId: typeof FLEET_72H_TASK_PLANNER_ID;
  seed: number;
  horizonHours: 72;
  missions: readonly PlannedFlightMission[];
  maintenanceWindows: readonly PlannedMaintenanceWindow[];
  airportConstraints: readonly AirportPlanningConstraint[];
  dailyPlans: readonly DailyOperationPlan[];
}>;

export type Fleet72hTaskPlannerOptions = Readonly<{
  seed?: number;
  maximumMissionsPerAircraft?: number;
  simulatedFaultProbability?: number;
  emergencyIncidentProbability?: number;
  runwaySeparationSeconds?: number;
  groundSupportServiceSeconds?: number;
  supportTeamCapacity?: number;
  disturbances?: SimulationDisturbanceDataset;
}>;

type AircraftPlanningContext = {
  aircraft: SimulationAircraftInput;
  random: () => number;
  currentAirportIdent: string;
  currentStandId: string | null;
  nextRequestedDeparture: number;
  missionIndex: number;
};

export type SimulationRunwaySelection = Readonly<{
  runwayId: string;
  runwayRef: string;
  requiredLengthMeters: number;
  availableLengthMeters: number | null;
  lengthMarginMeters: number | null;
  availableAtSeconds: number;
  closureDelaySeconds: number;
  reassignedByClosure: boolean;
  basis: string;
}>;

export type SimulationStandSelection = Readonly<{
  stand: SimulationStandInput;
  readyAtSeconds: number;
  preservedTwoStandBuffer: boolean;
  basis: string;
}>;

export type SimulationGroundSupportSelection = Readonly<{
  vehicle: SimulationSupportVehicleInput;
  readyAtSeconds: number;
  distanceMeters: number | null;
  travelRoute: SimulationGroundSupportTravelRouteInput | null;
  reassignedByEquipmentOutage: boolean;
  basis: string;
}>;

export type SimulationServiceVehicleSelection = SimulationGroundSupportSelection;

function distanceBetweenPositions(
  first: Readonly<{ eastMeters: number; northMeters: number }> | null,
  second: Readonly<{ eastMeters: number; northMeters: number }> | null,
) {
  if (!first || !second) return null;
  return Math.hypot(
    first.eastMeters - second.eastMeters,
    first.northMeters - second.northMeters,
  );
}

function groundSupportTravelRoute(
  airport: SimulationInputContract["airports"][number],
  vehicle: SimulationSupportVehicleInput,
  stand: SimulationStandInput | undefined,
) {
  if (!stand) return null;
  return airport.groundSupportTravelRoutes.find(
    (route) =>
      route.homeBaseId === vehicle.homeBaseId && route.standId === stand.id,
  ) ?? null;
}

function vehiclesWithAuthorizedStandAccess(
  airport: SimulationInputContract["airports"][number],
  vehicles: readonly SimulationSupportVehicleInput[],
  stand: SimulationStandInput | undefined,
) {
  if (!stand) return vehicles;
  const authorized = vehicles.filter((vehicle) =>
    groundSupportTravelRoute(airport, vehicle, stand),
  );
  return authorized.length > 0 ? authorized : vehicles;
}

function travelRouteAuthorityRank(
  route: SimulationGroundSupportTravelRouteInput | null,
) {
  if (route?.outboundAuthority === "compiled_service_road") return 0;
  if (route?.outboundAuthority === "compiled_service_road_nearest_base_assumption") return 1;
  return 2;
}

function outboundDistance(
  airport: SimulationInputContract["airports"][number],
  vehicle: SimulationSupportVehicleInput,
  stand: SimulationStandInput | undefined,
) {
  return groundSupportTravelRoute(airport, vehicle, stand)?.outboundDistanceMeters ??
    distanceBetweenPositions(stand?.position ?? null, vehicle.position);
}

function supportVehicleSpeedMetersPerSecond(category: string) {
  if (category === "heavy_tug" || category === "standard_tug") return 15 / 3.6;
  if (category === "follow_me_vehicle") return 30 / 3.6;
  return 25 / 3.6;
}

function travelSeconds(
  distanceMeters: number,
  category: string,
  groundSpeedFactor = 1,
) {
  if (distanceMeters <= 0) return 0;
  return Math.max(
    30,
    Math.ceil(
      distanceMeters /
      (supportVehicleSpeedMetersPerSecond(category) * groundSpeedFactor),
    ),
  );
}

function activeWeatherFactors(
  disturbances: SimulationDisturbanceDataset | undefined,
  airportIdent: string,
  offsetSeconds: number,
) {
  const active = disturbances?.weatherWindows.filter(
    (window) => window.airportIdent === airportIdent &&
      window.startOffsetSeconds <= offsetSeconds &&
      offsetSeconds < window.endOffsetSeconds,
  ) ?? [];
  return Object.freeze({
    runwayCapacityFactor: active.reduce(
      (minimum, window) => Math.min(minimum, window.runwayCapacityFactor),
      1,
    ),
    groundSpeedFactor: active.reduce(
      (minimum, window) => Math.min(minimum, window.groundSpeedFactor),
      1,
    ),
  });
}

function activeTrafficMultiplier(
  disturbances: SimulationDisturbanceDataset | undefined,
  airportIdent: string,
  offsetSeconds: number,
) {
  return disturbances?.trafficWindows.reduce(
    (maximum, window) =>
      window.airportIdent === airportIdent &&
      window.startOffsetSeconds <= offsetSeconds &&
      offsetSeconds < window.endOffsetSeconds
        ? Math.max(maximum, window.demandMultiplier)
        : maximum,
    1,
  ) ?? 1;
}

function shiftPastEquipmentOutages(
  disturbances: SimulationDisturbanceDataset | undefined,
  equipmentId: string,
  requestedStart: number,
  durationSeconds: number,
) {
  let start = requestedStart;
  const outages = disturbances?.equipmentOutages
    .filter((window) => window.equipmentId === equipmentId)
    .sort((left, right) => left.startOffsetSeconds - right.startOffsetSeconds) ?? [];
  outages.forEach((window) => {
    if (start < window.endOffsetSeconds && start + durationSeconds > window.startOffsetSeconds) {
      start = window.endOffsetSeconds;
    }
  });
  return start;
}

export function selectSimulationGroundSupportVehicle(input: Readonly<{
  contract: SimulationInputContract;
  airportIdent: string;
  aircraftModel: string;
  sourceStandId: string | null;
  desiredServiceStartSeconds: number;
  vehicleAvailableAt: ReadonlyMap<string, number>;
  disturbances?: SimulationDisturbanceDataset;
  serviceDurationSeconds?: number;
  groundSpeedFactor?: number;
}>): SimulationGroundSupportSelection | null {
  const airport = input.contract.airports.find(
    (candidate) => candidate.ident === input.airportIdent,
  );
  if (!airport) return null;
  const sourceStand = airport.stands.find(
    (stand) => stand.id === input.sourceStandId,
  );
  const compatible = vehiclesWithAuthorizedStandAccess(
    airport,
    airport.supportVehicles.filter(
      (vehicle) =>
        vehicle.status === "可用" &&
        vehicle.canTowAircraft &&
        vehicle.energyPercent >= 20 &&
        (vehicle.supportedAircraftModels.length === 0 ||
          vehicle.supportedAircraftModels.includes(input.aircraftModel)),
    ),
    sourceStand,
  );
  if (compatible.length === 0) return null;
  const specification = getAircraftSpecification(input.aircraftModel);
  const preferredCategory = specification.category === "wide_body"
    ? "heavy_tug"
    : "standard_tug";
  const effectiveReadyAt = (vehicle: SimulationSupportVehicleInput) => {
    const route = groundSupportTravelRoute(airport, vehicle, sourceStand);
    const distance = route?.outboundDistanceMeters ??
      outboundDistance(airport, vehicle, sourceStand) ?? 0;
    const travel = travelSeconds(
      distance,
      vehicle.category,
      input.groundSpeedFactor ?? 1,
    );
    const requested = Math.max(
      input.desiredServiceStartSeconds,
      input.vehicleAvailableAt.get(vehicle.id) ?? 0,
    );
    return shiftPastEquipmentOutages(
      input.disturbances,
      vehicle.id,
      requested,
      travel * 2 + (input.serviceDurationSeconds ?? 0),
    );
  };
  const selected = [...compatible].sort((left, right) => {
    const availabilityDifference = effectiveReadyAt(left) - effectiveReadyAt(right);
    if (availabilityDifference) return availabilityDifference;
    const categoryDifference =
      Number(right.category === preferredCategory) - Number(left.category === preferredCategory);
    if (categoryDifference) return categoryDifference;
    const geospatialDifference =
      Number(Boolean(right.geospatialReadiness === "ready" && right.position)) -
      Number(Boolean(left.geospatialReadiness === "ready" && left.position));
    if (geospatialDifference) return geospatialDifference;
    const routeDifference =
      travelRouteAuthorityRank(groundSupportTravelRoute(airport, left, sourceStand)) -
      travelRouteAuthorityRank(groundSupportTravelRoute(airport, right, sourceStand));
    if (routeDifference) return routeDifference;
    const leftDistance = outboundDistance(airport, left, sourceStand);
    const rightDistance = outboundDistance(airport, right, sourceStand);
    const distanceDifference =
      (leftDistance ?? Number.POSITIVE_INFINITY) -
      (rightDistance ?? Number.POSITIVE_INFINITY);
    return distanceDifference || right.energyPercent - left.energyPercent ||
      left.id.localeCompare(right.id);
  })[0];
  if (!selected) return null;
  const selectedEffectiveReadyAt = effectiveReadyAt(selected);
  const reassignedByEquipmentOutage = compatible.some((vehicle) => {
    const normalReadyAt = Math.max(
      input.desiredServiceStartSeconds,
      input.vehicleAvailableAt.get(vehicle.id) ?? 0,
    );
    return effectiveReadyAt(vehicle) > normalReadyAt &&
      effectiveReadyAt(vehicle) > selectedEffectiveReadyAt;
  });
  const readyAtSeconds = Math.max(
    selectedEffectiveReadyAt,
    input.desiredServiceStartSeconds,
  );
  const travelRoute = groundSupportTravelRoute(airport, selected, sourceStand);
  const distanceMeters = outboundDistance(airport, selected, sourceStand);
  const categoryBasis = selected.category === preferredCategory
    ? `采用${preferredCategory === "heavy_tug" ? "重型" : "标准"}牵引车`
    : `首选车辆繁忙，采用${selected.category}`;
  return Object.freeze({
    vehicle: selected,
    readyAtSeconds,
    distanceMeters,
    travelRoute,
    reassignedByEquipmentOutage,
    basis:
      `${input.aircraftModel}能力适配；${categoryBasis}；能源${selected.energyPercent}%；` +
      (distanceMeters === null
        ? "出发机位至驻点距离暂无可靠数据。"
        : travelRoute?.authority === "compiled_service_road"
          ? `受控保障道路距离${Math.round(distanceMeters)}米。`
          : travelRoute?.authority === "compiled_service_road_nearest_base_assumption"
            ? `专属驻点待标定，按最近已标定基地的受控保障道路距离${Math.round(distanceMeters)}米。`
          : `直线降级距离${Math.round(distanceMeters)}米。`),
  });
}

export function selectSimulationServiceVehicle(input: Readonly<{
  contract: SimulationInputContract;
  airportIdent: string;
  aircraftModel: string;
  sourceStandId: string | null;
  desiredServiceStartSeconds: number;
  vehicleAvailableAt: ReadonlyMap<string, number>;
  categories: readonly string[];
  roleLabel: string;
  disturbances?: SimulationDisturbanceDataset;
  serviceDurationSeconds?: number;
  groundSpeedFactor?: number;
}>): SimulationServiceVehicleSelection | null {
  const airport = input.contract.airports.find(
    (candidate) => candidate.ident === input.airportIdent,
  );
  if (!airport) return null;
  const sourceStand = airport.stands.find(
    (stand) => stand.id === input.sourceStandId,
  );
  const compatible = vehiclesWithAuthorizedStandAccess(
    airport,
    airport.supportVehicles.filter(
      (vehicle) =>
        input.categories.includes(vehicle.category) &&
        vehicle.status === "可用" &&
        vehicle.energyPercent >= 20 &&
        (vehicle.supportedAircraftModels.length === 0 ||
          vehicle.supportedAircraftModels.includes(input.aircraftModel)),
    ),
    sourceStand,
  );
  if (compatible.length === 0) return null;
  const effectiveReadyAt = (vehicle: SimulationSupportVehicleInput) => {
    const route = groundSupportTravelRoute(airport, vehicle, sourceStand);
    const distance = route?.outboundDistanceMeters ??
      outboundDistance(airport, vehicle, sourceStand) ?? 0;
    const travel = travelSeconds(
      distance,
      vehicle.category,
      input.groundSpeedFactor ?? 1,
    );
    const requested = Math.max(
      input.desiredServiceStartSeconds,
      input.vehicleAvailableAt.get(vehicle.id) ?? 0,
    );
    return shiftPastEquipmentOutages(
      input.disturbances,
      vehicle.id,
      requested,
      travel * 2 + (input.serviceDurationSeconds ?? 0),
    );
  };
  const selected = [...compatible].sort((left, right) => {
    const leftReady = effectiveReadyAt(left);
    const rightReady = effectiveReadyAt(right);
    const readyDifference = leftReady - rightReady;
    if (readyDifference) return readyDifference;
    const routeDifference =
      travelRouteAuthorityRank(groundSupportTravelRoute(airport, left, sourceStand)) -
      travelRouteAuthorityRank(groundSupportTravelRoute(airport, right, sourceStand));
    if (routeDifference) return routeDifference;
    const leftDistance = outboundDistance(airport, left, sourceStand);
    const rightDistance = outboundDistance(airport, right, sourceStand);
    return (
      (leftDistance ?? Number.POSITIVE_INFINITY) -
        (rightDistance ?? Number.POSITIVE_INFINITY) ||
      right.energyPercent - left.energyPercent ||
      left.id.localeCompare(right.id)
    );
  })[0];
  if (!selected) return null;
  const selectedEffectiveReadyAt = effectiveReadyAt(selected);
  const reassignedByEquipmentOutage = compatible.some((vehicle) => {
    const normalReadyAt = Math.max(
      input.desiredServiceStartSeconds,
      input.vehicleAvailableAt.get(vehicle.id) ?? 0,
    );
    return effectiveReadyAt(vehicle) > normalReadyAt &&
      effectiveReadyAt(vehicle) > selectedEffectiveReadyAt;
  });
  const readyAtSeconds = Math.max(
    selectedEffectiveReadyAt,
    input.desiredServiceStartSeconds,
  );
  const travelRoute = groundSupportTravelRoute(airport, selected, sourceStand);
  const distanceMeters = outboundDistance(airport, selected, sourceStand);
  return Object.freeze({
    vehicle: selected,
    readyAtSeconds,
    distanceMeters,
    travelRoute,
    reassignedByEquipmentOutage,
    basis:
      `${input.roleLabel}；${input.aircraftModel}能力适配；能源${selected.energyPercent}%；` +
      (distanceMeters === null
        ? "出发机位至驻点距离暂无可靠数据。"
        : travelRoute?.authority === "compiled_service_road"
          ? `受控保障道路距离${Math.round(distanceMeters)}米。`
          : travelRoute?.authority === "compiled_service_road_nearest_base_assumption"
            ? `专属驻点待标定，按最近已标定基地的受控保障道路距离${Math.round(distanceMeters)}米。`
          : `直线降级距离${Math.round(distanceMeters)}米。`),
  });
}

function distanceToNearestReadySupportVehicle(
  input: SimulationInputContract,
  airportIdent: string,
  stand: SimulationStandInput,
) {
  if (!stand.position) return null;
  const airport = input.airports.find((candidate) => candidate.ident === airportIdent);
  const distances = (airport?.supportVehicles ?? [])
    .filter(
      (vehicle) =>
        vehicle.status !== "维修" &&
        vehicle.geospatialReadiness === "ready" &&
        vehicle.position,
    )
    .map((vehicle) => Math.hypot(
      stand.position!.eastMeters - vehicle.position!.eastMeters,
      stand.position!.northMeters - vehicle.position!.northMeters,
    ));
  return distances.length > 0 ? Math.min(...distances) : null;
}

export function selectSimulationArrivalStand(input: Readonly<{
  contract: SimulationInputContract;
  airportIdent: string;
  aircraftModel: string;
  desiredArrivalSeconds: number;
  candidates: readonly SimulationStandInput[];
  standAvailableAt: ReadonlyMap<string, number>;
}>): SimulationStandSelection | null {
  const occupiedStandIds = new Set(
    input.candidates
      .filter(
        (stand) =>
          (input.standAvailableAt.get(stand.id) ?? 0) > input.desiredArrivalSeconds,
      )
      .map((stand) => stand.id),
  );
  const selection = selectStandByUnifiedPolicy({
    aircraftModel: input.aircraftModel,
    desiredAtSeconds: input.desiredArrivalSeconds,
    occupiedStandIds,
    distanceBasisLabel: "距最近可用保障车辆驻点",
    candidates: input.candidates.map((stand) => ({
      id: stand.id,
      referenceCode: stand.referenceCode,
      operationalRole: stand.operationalRole,
      availableAtSeconds: input.standAvailableAt.get(stand.id) ?? 0,
      distanceMeters: distanceToNearestReadySupportVehicle(
        input.contract,
        input.airportIdent,
        stand,
      ),
    })),
  });
  if (!selection) return null;
  const stand = input.candidates.find(
    (candidate) => candidate.id === selection.candidate.id,
  );
  return stand ? Object.freeze({
    stand,
    readyAtSeconds: selection.readyAtSeconds,
    preservedTwoStandBuffer: selection.preservedTwoStandBuffer,
    basis: selection.basis,
  }) : null;
}

export function selectSimulationRunway(
  input: SimulationInputContract,
  airportIdent: string,
  aircraftModel: string,
  operationKind: "departure" | "arrival",
): SimulationRunwaySelection {
  const airport = input.airports.find((candidate) => candidate.ident === airportIdent);
  if (!airport) throw new Error(`缺少机场${airportIdent}的仿真输入。`);
  const specification = getAircraftSpecification(aircraftModel);
  const requiredLengthMeters = operationKind === "departure"
    ? specification.simulationRunwayRequirement.departureMeters
    : specification.simulationRunwayRequirement.arrivalMeters;
  if (airport.runways.length === 0) {
    return Object.freeze({
      runwayId: `${airportIdent}-RUNWAY-UNSPECIFIED`,
      runwayRef: "待配置",
      requiredLengthMeters,
      availableLengthMeters: null,
      lengthMarginMeters: null,
      availableAtSeconds: 0,
      closureDelaySeconds: 0,
      reassignedByClosure: false,
      basis: `${airportIdent}尚未向仿真契约提供跑道档案，保留机场级跑道时隙约束。`,
    });
  }
  const eligible = airport.runways
    .filter((runway) => runway.lengthMeters >= requiredLengthMeters)
    .sort(
      (left, right) =>
        left.lengthMeters - right.lengthMeters || left.ref.localeCompare(right.ref),
    );
  const selected = eligible[0];
  if (!selected) {
    throw new Error(
      `${airportIdent}没有跑道满足${aircraftModel}${operationKind === "departure" ? "起飞" : "着陆"}` +
      `仿真长度门槛${requiredLengthMeters}米。`,
    );
  }
  const lengthMarginMeters = Math.round(selected.lengthMeters - requiredLengthMeters);
  return Object.freeze({
    runwayId: selected.id,
    runwayRef: selected.ref,
    requiredLengthMeters,
    availableLengthMeters: selected.lengthMeters,
    lengthMarginMeters,
    availableAtSeconds: 0,
    closureDelaySeconds: 0,
    reassignedByClosure: false,
    basis:
      `${aircraftModel}${operationKind === "departure" ? "起飞" : "着陆"}门槛${requiredLengthMeters}米；` +
      `${selected.ref}长度${Math.round(selected.lengthMeters)}米，余量${lengthMarginMeters}米。`,
  });
}

function nextTimeOutsideRunwayClosures(
  disturbances: SimulationDisturbanceDataset | undefined,
  airportIdent: string,
  runwayId: string,
  requestedTime: number,
) {
  let candidate = requestedTime;
  const closures = disturbances?.runwayClosures
    .filter(
      (closure) =>
        closure.airportIdent === airportIdent && closure.runwayId === runwayId,
    )
    .sort((left, right) => left.startOffsetSeconds - right.startOffsetSeconds) ?? [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const closure of closures) {
      if (
        closure.startOffsetSeconds <= candidate &&
        candidate < closure.endOffsetSeconds
      ) {
        candidate = closure.endOffsetSeconds;
        changed = true;
      }
    }
  }
  return candidate;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function reserveCapacityLane(
  laneAvailability: number[],
  requestedStart: number,
  durationSeconds: number,
) {
  let laneIndex = 0;
  for (let index = 1; index < laneAvailability.length; index += 1) {
    if (laneAvailability[index] < laneAvailability[laneIndex]) laneIndex = index;
  }
  const start = Math.max(requestedStart, laneAvailability[laneIndex]);
  laneAvailability[laneIndex] = start + durationSeconds;
  return start;
}

function reserveRunwaySlot(
  slots: number[],
  requestedTime: number,
  separationSeconds: number,
) {
  let candidate = requestedTime;
  const ordered = [...slots].sort((left, right) => left - right);
  for (const occupied of ordered) {
    if (Math.abs(candidate - occupied) < separationSeconds) {
      candidate = occupied + separationSeconds;
    }
  }
  slots.push(candidate);
  return candidate;
}

function findRunwaySlot(
  slots: readonly number[],
  requestedTime: number,
  separationSeconds: number,
) {
  let candidate = requestedTime;
  const ordered = [...slots].sort((left, right) => left - right);
  for (const occupied of ordered) {
    if (Math.abs(candidate - occupied) < separationSeconds) {
      candidate = occupied + separationSeconds;
    }
  }
  return candidate;
}

function reserveSimulationRunwayOperation(input: Readonly<{
  contract: SimulationInputContract;
  disturbances: SimulationDisturbanceDataset | undefined;
  airportIdent: string;
  aircraftModel: string;
  operationKind: "departure" | "arrival";
  requestedTime: number;
  slots: number[];
  separationSeconds: number;
}>): SimulationRunwaySelection {
  const airport = input.contract.airports.find(
    (candidate) => candidate.ident === input.airportIdent,
  );
  if (!airport) throw new Error(`缺少机场${input.airportIdent}的仿真输入。`);
  if (airport.runways.length === 0) {
    const availableAtSeconds = reserveRunwaySlot(
      input.slots,
      input.requestedTime,
      input.separationSeconds,
    );
    return Object.freeze({
      ...selectSimulationRunway(
        input.contract,
        input.airportIdent,
        input.aircraftModel,
        input.operationKind,
      ),
      availableAtSeconds,
    });
  }
  const specification = getAircraftSpecification(input.aircraftModel);
  const requiredLengthMeters = input.operationKind === "departure"
    ? specification.simulationRunwayRequirement.departureMeters
    : specification.simulationRunwayRequirement.arrivalMeters;
  const eligible = airport.runways
    .filter((runway) => runway.lengthMeters >= requiredLengthMeters)
    .sort(
      (left, right) =>
        left.lengthMeters - right.lengthMeters || left.ref.localeCompare(right.ref),
    );
  if (eligible.length === 0) {
    throw new Error(
      `${input.airportIdent}没有跑道满足${input.aircraftModel}` +
      `${input.operationKind === "departure" ? "起飞" : "着陆"}` +
      `仿真长度门槛${requiredLengthMeters}米。`,
    );
  }
  const unconstrainedSlot = findRunwaySlot(
    input.slots,
    input.requestedTime,
    input.separationSeconds,
  );
  const choices = eligible.map((runway) => {
    let candidate = unconstrainedSlot;
    let previous = -1;
    while (candidate !== previous) {
      previous = candidate;
      candidate = nextTimeOutsideRunwayClosures(
        input.disturbances,
        input.airportIdent,
        runway.id,
        candidate,
      );
      candidate = findRunwaySlot(
        input.slots,
        candidate,
        input.separationSeconds,
      );
    }
    return { runway, availableAtSeconds: candidate };
  }).sort(
    (left, right) =>
      left.availableAtSeconds - right.availableAtSeconds ||
      left.runway.lengthMeters - right.runway.lengthMeters ||
      left.runway.ref.localeCompare(right.runway.ref),
  );
  const selected = choices[0];
  input.slots.push(selected.availableAtSeconds);
  const preferred = eligible[0];
  const closureDelaySeconds = Math.max(
    0,
    selected.availableAtSeconds - unconstrainedSlot,
  );
  const reassignedByClosure = selected.runway.id !== preferred.id &&
    nextTimeOutsideRunwayClosures(
      input.disturbances,
      input.airportIdent,
      preferred.id,
      unconstrainedSlot,
    ) > unconstrainedSlot;
  const lengthMarginMeters = Math.round(
    selected.runway.lengthMeters - requiredLengthMeters,
  );
  return Object.freeze({
    runwayId: selected.runway.id,
    runwayRef: selected.runway.ref,
    requiredLengthMeters,
    availableLengthMeters: selected.runway.lengthMeters,
    lengthMarginMeters,
    availableAtSeconds: selected.availableAtSeconds,
    closureDelaySeconds,
    reassignedByClosure,
    basis:
      `${input.aircraftModel}${input.operationKind === "departure" ? "起飞" : "着陆"}` +
      `门槛${requiredLengthMeters}米；${selected.runway.ref}长度` +
      `${Math.round(selected.runway.lengthMeters)}米，余量${lengthMarginMeters}米；` +
      (reassignedByClosure
        ? `首选跑道${preferred.ref}临时关闭，已自动改派。`
        : closureDelaySeconds > 0
          ? `无可替代跑道，等待开放${closureDelaySeconds}秒。`
          : "跑道运行正常。"),
  });
}

function buildAirportConstraint(
  input: SimulationInputContract,
  airportIdent: string,
  runwaySeparationSeconds: number,
  supportTeamCapacity: number,
): AirportPlanningConstraint {
  const airport = input.airports.find((item) => item.ident === airportIdent);
  if (!airport) throw new Error(`缺少机场${airportIdent}的仿真资源配置。`);
  const activeStands = airport.stands.filter(
    (stand) => stand.operationalAvailability === "active",
  );
  const maintenanceCapacity = airport.maintenanceAreas.reduce(
    (sum, area) => sum + area.capacity,
    0,
  );
  const personnelCapacity = Math.floor(airport.resources.availablePersonnel / 2);
  const equipmentCapacity = airport.resources.availableEquipment;
  return Object.freeze({
    airportIdent,
    activeStandCapacity: activeStands.length,
    initialFreeStandCount: activeStands.filter((stand) => stand.status === "空闲").length,
    runwaySeparationSeconds,
    supportTeamCapacity: Math.max(
      1,
      Math.min(
        supportTeamCapacity,
        airport.supportVehicles.filter((vehicle) => vehicle.status !== "维修").length,
      ),
    ),
    maintenanceBayCapacity: Math.max(
      1,
      Math.min(maintenanceCapacity || 1, personnelCapacity || 1, equipmentCapacity || 1),
    ),
  });
}

export function createFleet72hTaskPlan(
  input: SimulationInputContract,
  options: Fleet72hTaskPlannerOptions = {},
): Fleet72hTaskPlan {
  assertSimulationInputContract(input);
  if (input.airports.length < 2) {
    throw new Error("未来72小时跨机场任务计划至少需要2座已配置机场。");
  }
  const seed = options.seed ?? input.seed;
  const maximumMissionsPerAircraft = options.maximumMissionsPerAircraft ?? 5;
  const simulatedFaultProbability = options.simulatedFaultProbability ?? 0.025;
  const runwaySeparationSeconds = options.runwaySeparationSeconds ?? 180;
  const groundSupportServiceSeconds = options.groundSupportServiceSeconds ?? 30 * 60;
  const supportTeamCapacity = options.supportTeamCapacity ?? 6;
  const disturbances = options.disturbances;
  if (maximumMissionsPerAircraft < 1 || maximumMissionsPerAircraft > 12) {
    throw new Error("单机最大任务数必须位于1至12之间。");
  }
  if (simulatedFaultProbability < 0 || simulatedFaultProbability > 0.25) {
    throw new Error("模拟故障概率必须位于0至0.25之间。");
  }
  if (!Number.isInteger(runwaySeparationSeconds) || runwaySeparationSeconds < 60) {
    throw new Error("跑道间隔必须是大于等于60秒的整数。");
  }
  if (!Number.isInteger(groundSupportServiceSeconds) || groundSupportServiceSeconds < 60) {
    throw new Error("保障服务时长必须是大于等于60秒的整数。");
  }
  if (!Number.isInteger(supportTeamCapacity) || supportTeamCapacity < 1) {
    throw new Error("保障并行容量必须是大于0的整数。");
  }

  const horizonSeconds = input.horizonHours * 3600;
  // 将单机任务均匀铺到完整72小时窗口，避免有限任务数在前48小时内被全部消耗。
  // 过站保障仍由 turnaroundHours 表示；额外间隔代表夜间停场、班次波峰和机组衔接。
  const plannedDepartureSpacingSeconds = Math.max(
    8 * 3600,
    horizonSeconds / (maximumMissionsPerAircraft + 1),
  );
  const airportIdents = input.airports.map((airport) => airport.ident);
  const airportConstraints = airportIdents.map((airportIdent) =>
    buildAirportConstraint(
      input,
      airportIdent,
      runwaySeparationSeconds,
      supportTeamCapacity,
    ),
  );
  const runwaySlots = new Map(airportIdents.map((ident) => [ident, [] as number[]]));
  const supportLanes = new Map(
    airportConstraints.map((constraint) => [
      constraint.airportIdent,
      Array.from({ length: constraint.supportTeamCapacity }, () => 0),
    ]),
  );
  const maintenanceLanes = new Map(
    airportConstraints.map((constraint) => [
      constraint.airportIdent,
      Array.from({ length: constraint.maintenanceBayCapacity }, () => 0),
    ]),
  );
  const maintenanceWindows: PlannedMaintenanceWindow[] = [];
  const contexts: AircraftPlanningContext[] = [];
  const boardingStands = new Map(
    input.airports.map((airport) => [
      airport.ident,
      airport.stands.filter(
        (stand) =>
          stand.kind === "boarding" &&
          stand.operationalAvailability === "active" &&
          stand.position !== null,
      ),
    ]),
  );
  const standAvailableAt = new Map<string, number>();
  const supportVehicleAvailableAt = new Map<string, number>();
  const initiallyOccupiedStandKeys = new Set(
    input.aircraft
      .filter((aircraft) => aircraft.currentStandId)
      .map(
        (aircraft) =>
          `${aircraft.initialAirportIdent}|${aircraft.currentStandId}`,
      ),
  );
  input.airports.forEach((airport) => {
    airport.stands.forEach((stand) => {
      if (
        stand.kind === "boarding" &&
        stand.operationalAvailability === "active" &&
        stand.position !== null
      ) {
        standAvailableAt.set(
          stand.id,
          initiallyOccupiedStandKeys.has(`${airport.ident}|${stand.id}`)
            ? Number.POSITIVE_INFINITY
            : 0,
        );
      }
    });
    airport.supportVehicles.forEach((vehicle) => {
      supportVehicleAvailableAt.set(
        vehicle.id,
        vehicle.status === "可用" ? 0 : Number.POSITIVE_INFINITY,
      );
    });
  });

  [...input.aircraft]
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((aircraft) => {
      const random = createRandom(hashText(`${seed}|${aircraft.id}|planner-v1`));
      if (aircraft.dispatchEligibility === "grounded") {
        maintenanceWindows.push(Object.freeze({
          id: `MW-${aircraft.id}-GROUND`,
          aircraftId: aircraft.id,
          airportIdent: aircraft.initialAirportIdent,
          trigger: "initial_grounded" as const,
          startOffsetSeconds: 0,
          endOffsetSeconds: null,
        }));
        return;
      }

      let availableAt = 0;
      if (aircraft.dispatchEligibility === "maintenance_pending") {
        const duration = (aircraft.initialMaintenanceRemainingHours ?? 8) * 3600;
        const lanes = maintenanceLanes.get(aircraft.initialAirportIdent);
        if (!lanes) throw new Error(`机场${aircraft.initialAirportIdent}缺少维修容量。`);
        const start = reserveCapacityLane(lanes, 0, duration);
        availableAt = start + duration;
        maintenanceWindows.push(Object.freeze({
          id: `MW-${aircraft.id}-INITIAL`,
          aircraftId: aircraft.id,
          airportIdent: aircraft.initialAirportIdent,
          trigger: "initial_pending" as const,
          startOffsetSeconds: Math.round(start),
          endOffsetSeconds: Math.round(availableAt),
        }));
      }

      contexts.push({
        aircraft,
        random,
        currentAirportIdent: aircraft.initialAirportIdent,
        currentStandId: aircraft.currentStandId,
        nextRequestedDeparture:
          availableAt + 3600 + random() * INITIAL_DEPARTURE_SPREAD_SECONDS,
        missionIndex: 0,
      });
    });

  const missions: PlannedFlightMission[] = [];
  while (contexts.length > 0) {
    contexts.sort(
      (left, right) =>
        left.nextRequestedDeparture - right.nextRequestedDeparture ||
        left.aircraft.id.localeCompare(right.aircraft.id),
    );
    const context = contexts.shift();
    if (!context) break;
    if (
      context.missionIndex >= maximumMissionsPerAircraft ||
      context.nextRequestedDeparture >= horizonSeconds
    ) continue;

    const source = context.currentAirportIdent;
    const sourceIndex = airportIdents.indexOf(source);
    const destinationOffset = 1 + (
      context.missionIndex % Math.max(1, airportIdents.length - 1)
    );
    const destination = airportIdents[
      (sourceIndex + destinationOffset) % airportIdents.length
    ] ?? source;
    const requestedDeparture = context.nextRequestedDeparture;
    const support = supportLanes.get(source);
    const sourceRunway = runwaySlots.get(source);
    const destinationRunway = runwaySlots.get(destination);
    if (!support || !sourceRunway || !destinationRunway) {
      throw new Error(`任务${context.aircraft.id}缺少机场资源池。`);
    }
    const packageAssignments: PlannedGroundSupportAssignment[] = [];
    let equipmentOutageDelaySeconds = 0;
    const sourceWeather = activeWeatherFactors(
      disturbances,
      source,
      requestedDeparture,
    );
    const trafficDemandMultiplier = activeTrafficMultiplier(
      disturbances,
      source,
      requestedDeparture,
    );
    const reserveServiceAssignment = (
      role: PlannedGroundSupportRole,
      roleLabel: string,
      sequenceGroup: 1 | 2 | 3,
      selection: SimulationServiceVehicleSelection,
      durationSeconds: number,
      requestedStartOffsetSeconds: number,
    ) => {
      const outboundDistanceMeters = Math.max(
        0,
        selection.travelRoute?.outboundDistanceMeters ?? selection.distanceMeters ?? 0,
      );
      const returnDistanceMeters = Math.max(
        0,
        selection.travelRoute?.returnDistanceMeters ?? outboundDistanceMeters,
      );
      const outboundTravelSeconds = travelSeconds(
        outboundDistanceMeters,
        selection.vehicle.category,
        sourceWeather.groundSpeedFactor,
      );
      const returnTravelSeconds = travelSeconds(
        returnDistanceMeters,
        selection.vehicle.category,
        sourceWeather.groundSpeedFactor,
      );
      const occupiedDurationSeconds =
        outboundTravelSeconds + durationSeconds + returnTravelSeconds;
      // 机场级并行容量代表一整套过站保障班组，而不是四项车辆作业各占一条容量。
      // 单车冲突已经由 vehicleAvailableAt 独立约束，不能在这里重复占用班组容量。
      const capacityStart = selection.readyAtSeconds;
      const start = shiftPastEquipmentOutages(
        disturbances,
        selection.vehicle.id,
        capacityStart,
        occupiedDurationSeconds,
      );
      if (start > capacityStart) {
        equipmentOutageDelaySeconds += start - capacityStart;
      }
      const arrived = start + outboundTravelSeconds;
      const serviceCompleted = arrived + durationSeconds;
      const end = serviceCompleted + returnTravelSeconds;
      supportVehicleAvailableAt.set(selection.vehicle.id, end);
      packageAssignments.push(Object.freeze({
        role,
        roleLabel,
        vehicleId: selection.vehicle.id,
        vehicleCategory: selection.vehicle.category,
        sequenceGroup,
        requestedStartOffsetSeconds: Math.round(requestedStartOffsetSeconds),
        startOffsetSeconds: Math.round(start),
        arrivedOffsetSeconds: Math.round(arrived),
        serviceStartOffsetSeconds: Math.round(arrived),
        serviceCompletedOffsetSeconds: Math.round(serviceCompleted),
        endOffsetSeconds: Math.round(end),
        outboundDistanceMeters: Math.round(outboundDistanceMeters),
        returnDistanceMeters: Math.round(returnDistanceMeters),
        outboundTravelSeconds,
        returnTravelSeconds,
        serviceDurationSeconds: durationSeconds,
        routeAuthority:
          selection.travelRoute?.authority ?? "direct_distance_fallback",
        outboundRouteAuthority:
          selection.travelRoute?.outboundAuthority ?? "direct_distance_fallback",
        returnRouteAuthority:
          selection.travelRoute?.returnAuthority ?? "direct_distance_fallback",
        outboundPath: selection.travelRoute?.outboundPath ?? Object.freeze([]),
        returnPath: selection.travelRoute?.returnPath ?? Object.freeze([]),
        unroutableDirections:
          selection.travelRoute?.unroutableDirections ??
          (["outbound", "return"] as const),
        reassignedByEquipmentOutage: selection.reassignedByEquipmentOutage,
        selectionBasis: selection.basis,
      }));
      return Object.freeze({
        serviceCompleted,
        released: end,
        queueDelaySeconds: Math.max(0, start - requestedStartOffsetSeconds),
      });
    };
    const earlyServiceStart = Math.max(
      0,
      requestedDeparture - STANDARD_GROUND_SUPPORT_LEAD_SECONDS,
    );
    const packageTeamStart = reserveCapacityLane(
      support,
      earlyServiceStart,
      STANDARD_GROUND_SUPPORT_LEAD_SECONDS,
    );
    const groundSupportTeamQueueSeconds = Math.max(
      0,
      packageTeamStart - earlyServiceStart,
    );
    const groundPowerSelection = selectSimulationServiceVehicle({
      contract: input,
      airportIdent: source,
      aircraftModel: context.aircraft.model,
      sourceStandId: context.currentStandId,
      desiredServiceStartSeconds: packageTeamStart,
      vehicleAvailableAt: supportVehicleAvailableAt,
      categories: ["ground_power_vehicle"],
      roleLabel: "地面供电",
      disturbances,
      serviceDurationSeconds: STANDARD_GROUND_SUPPORT_SERVICE_SECONDS.groundPower,
      groundSpeedFactor: sourceWeather.groundSpeedFactor,
    });
    const fuelSelection = selectSimulationServiceVehicle({
      contract: input,
      airportIdent: source,
      aircraftModel: context.aircraft.model,
      sourceStandId: context.currentStandId,
      desiredServiceStartSeconds: packageTeamStart,
      vehicleAvailableAt: supportVehicleAvailableAt,
      categories: ["fuel_vehicle"],
      roleLabel: "航空加油",
      disturbances,
      serviceDurationSeconds: STANDARD_GROUND_SUPPORT_SERVICE_SECONDS.fuelService,
      groundSpeedFactor: sourceWeather.groundSpeedFactor,
    });
    if (!groundPowerSelection || !fuelSelection) {
      throw new Error(
        `机场${source}缺少满足${context.aircraft.model}要求的地面电源车或航空加油车。`,
      );
    }
    const groundPowerTiming = reserveServiceAssignment(
      "ground_power",
      "地面供电",
      1,
      groundPowerSelection,
      STANDARD_GROUND_SUPPORT_SERVICE_SECONDS.groundPower,
      packageTeamStart,
    );
    const fuelTiming = reserveServiceAssignment(
      "fuel_service",
      "航空加油",
      1,
      fuelSelection,
      STANDARD_GROUND_SUPPORT_SERVICE_SECONDS.fuelService,
      packageTeamStart,
    );
    const parallelServiceEnd = Math.max(
      groundPowerTiming.serviceCompleted,
      fuelTiming.serviceCompleted,
    );
    const groundSupportSelection = selectSimulationGroundSupportVehicle({
      contract: input,
      airportIdent: source,
      aircraftModel: context.aircraft.model,
      sourceStandId: context.currentStandId,
      desiredServiceStartSeconds: parallelServiceEnd,
      vehicleAvailableAt: supportVehicleAvailableAt,
      disturbances,
      serviceDurationSeconds: groundSupportServiceSeconds,
      groundSpeedFactor: sourceWeather.groundSpeedFactor,
    });
    if (!groundSupportSelection) {
      throw new Error(
        `机场${source}没有满足${context.aircraft.model}能力、状态与能源要求的可用牵引车。`,
      );
    }
    const tugTiming = reserveServiceAssignment(
      "pushback_tow",
      "推出牵引",
      2,
      groundSupportSelection,
      groundSupportServiceSeconds,
      parallelServiceEnd,
    );
    const followMeSelection = selectSimulationServiceVehicle({
      contract: input,
      airportIdent: source,
      aircraftModel: context.aircraft.model,
      sourceStandId: context.currentStandId,
      desiredServiceStartSeconds: tugTiming.serviceCompleted,
      vehicleAvailableAt: supportVehicleAvailableAt,
      categories: ["follow_me_vehicle"],
      roleLabel: "滑行引导",
      disturbances,
      serviceDurationSeconds: STANDARD_GROUND_SUPPORT_SERVICE_SECONDS.followMe,
      groundSpeedFactor: sourceWeather.groundSpeedFactor,
    });
    if (!followMeSelection) {
      throw new Error(
        `机场${source}缺少满足${context.aircraft.model}要求的航空器引导车。`,
      );
    }
    const followMeTiming = reserveServiceAssignment(
      "follow_me",
      "滑行引导",
      3,
      followMeSelection,
      STANDARD_GROUND_SUPPORT_SERVICE_SECONDS.followMe,
      tugTiming.serviceCompleted,
    );
    const groundSupportQueueSeconds =
      groundSupportTeamQueueSeconds +
      Math.max(
        groundPowerTiming.queueDelaySeconds,
        fuelTiming.queueDelaySeconds,
      ) +
      tugTiming.queueDelaySeconds +
      followMeTiming.queueDelaySeconds;
    const supportStart = packageAssignments.find(
      (assignment) => assignment.role === "pushback_tow",
    )?.serviceStartOffsetSeconds ??
      tugTiming.serviceCompleted - groundSupportServiceSeconds;
    const supportedDeparture = Math.max(
      requestedDeparture,
      followMeTiming.serviceCompleted,
    );
    const departureRunwaySelection = reserveSimulationRunwayOperation({
      contract: input,
      disturbances,
      airportIdent: source,
      aircraftModel: context.aircraft.model,
      operationKind: "departure",
      requestedTime: supportedDeparture,
      slots: sourceRunway,
      separationSeconds: Math.ceil(
        runwaySeparationSeconds / sourceWeather.runwayCapacityFactor,
      ),
    });
    const departure = departureRunwaySelection.availableAtSeconds;
    const baseDurationHours = 1.6 + context.random() * 2.4;
    const requestedArrival = departure + baseDurationHours * 3600;
    const destinationStandCandidates = boardingStands.get(destination) ?? [];
    if (destinationStandCandidates.length === 0) {
      throw new Error(`机场${destination}没有可用于进场任务的活动登机机位。`);
    }
    const destinationStandSelection = selectSimulationArrivalStand({
      contract: input,
      airportIdent: destination,
      aircraftModel: context.aircraft.model,
      desiredArrivalSeconds: requestedArrival,
      candidates: destinationStandCandidates,
      standAvailableAt,
    });
    if (!destinationStandSelection) {
      throw new Error(
        `机场${destination}没有满足${context.aircraft.model}机型适配的活动登机机位。`,
      );
    }
    const destinationStand = destinationStandSelection.stand;
    const destinationStandReady = destinationStandSelection.readyAtSeconds;
    const runwayRequestedArrival = Math.max(requestedArrival, destinationStandReady);
    const arrivalWeather = activeWeatherFactors(
      disturbances,
      destination,
      runwayRequestedArrival,
    );
    const arrivalRunwaySelection = reserveSimulationRunwayOperation({
      contract: input,
      disturbances,
      airportIdent: destination,
      aircraftModel: context.aircraft.model,
      operationKind: "arrival",
      requestedTime: runwayRequestedArrival,
      slots: destinationRunway,
      separationSeconds: Math.ceil(
        runwaySeparationSeconds / arrivalWeather.runwayCapacityFactor,
      ),
    });
    const arrival = arrivalRunwaySelection.availableAtSeconds;
    if (arrival > horizonSeconds) continue;
    if (context.currentStandId && standAvailableAt.has(context.currentStandId)) {
      standAvailableAt.set(context.currentStandId, departure);
    }

    const constraintReasons: PlannedFlightMission["constraintReasons"][number][] = [];
    if (groundSupportQueueSeconds > 0) {
      constraintReasons.push("ground_support_capacity");
    }
    if (departure > supportedDeparture) constraintReasons.push("departure_runway_slot");
    if (destinationStandReady > requestedArrival) {
      constraintReasons.push("arrival_stand_capacity");
    }
    if (arrival > runwayRequestedArrival) constraintReasons.push("arrival_runway_slot");
    if (
      departureRunwaySelection.closureDelaySeconds > 0 ||
      arrivalRunwaySelection.closureDelaySeconds > 0 ||
      departureRunwaySelection.reassignedByClosure ||
      arrivalRunwaySelection.reassignedByClosure
    ) {
      constraintReasons.push("runway_closure");
    }
    const turnaroundHours = 2 + context.random() * 3;
    const missionId = `MISSION-${context.aircraft.id}-${context.missionIndex + 1}`;
    missions.push(Object.freeze({
      id: missionId,
      aircraftId: context.aircraft.id,
      sourceAirportIdent: source,
      destinationAirportIdent: destination,
      sourceStandId: context.currentStandId,
      destinationStandId: destinationStand.id,
      departureRunwayId: departureRunwaySelection.runwayId,
      departureRunwayRef: departureRunwaySelection.runwayRef,
      arrivalRunwayId: arrivalRunwaySelection.runwayId,
      arrivalRunwayRef: arrivalRunwaySelection.runwayRef,
      departureRunwayLengthMarginMeters: departureRunwaySelection.lengthMarginMeters,
      arrivalRunwayLengthMarginMeters: arrivalRunwaySelection.lengthMarginMeters,
      runwaySelectionBasis:
        `${departureRunwaySelection.basis} ${arrivalRunwaySelection.basis}`,
      destinationStandSelectionBasis: destinationStandSelection.basis,
      destinationStandPreservedBuffer:
        destinationStandSelection.preservedTwoStandBuffer,
      destinationStandOriginalId: null,
      destinationStandReassignedByEmergency: false,
      arrivalStandHoldSeconds: Math.round(
        Math.max(0, destinationStandReady - requestedArrival),
      ),
      groundSupportVehicleId: groundSupportSelection.vehicle.id,
      groundSupportVehicleCategory: groundSupportSelection.vehicle.category,
      groundSupportServiceStartOffsetSeconds: Math.round(supportStart),
      groundSupportServiceEndOffsetSeconds: Math.round(
        tugTiming.serviceCompleted,
      ),
      groundSupportSelectionBasis: groundSupportSelection.basis,
      groundSupportRouteStandId: context.currentStandId,
      groundSupportRouteRecompiledByEmergency: false,
      groundSupportPackage: Object.freeze(packageAssignments),
      requestedDepartureOffsetSeconds: Math.round(requestedDeparture),
      departureOffsetSeconds: Math.round(departure),
      arrivalOffsetSeconds: Math.round(arrival),
      plannedDurationHours: round((arrival - departure) / 3600),
      turnaroundHours: round(turnaroundHours),
      groundSupportHoldSeconds: Math.round(
        groundSupportQueueSeconds,
      ),
      departureRunwayHoldSeconds: Math.round(
        Math.max(0, departure - supportedDeparture),
      ),
      arrivalRunwayHoldSeconds: Math.round(
        Math.max(0, arrival - runwayRequestedArrival),
      ),
      emergencyOperationalHoldSeconds: 0,
      delaySeconds: Math.round(
        groundSupportQueueSeconds +
        Math.max(0, departure - supportedDeparture) +
        Math.max(0, destinationStandReady - requestedArrival) +
        Math.max(0, arrival - runwayRequestedArrival),
      ),
      constraintReasons: Object.freeze(constraintReasons),
      disturbanceImpact: Object.freeze({
        departureRunwayCapacityFactor: sourceWeather.runwayCapacityFactor,
        arrivalRunwayCapacityFactor: arrivalWeather.runwayCapacityFactor,
        groundSpeedFactor: sourceWeather.groundSpeedFactor,
        trafficDemandMultiplier,
        equipmentOutageDelaySeconds: Math.round(equipmentOutageDelaySeconds),
        equipmentOutageReassignmentCount: packageAssignments.filter(
          (assignment) => assignment.reassignedByEquipmentOutage,
        ).length,
        departureRunwayClosureDelaySeconds:
          departureRunwaySelection.closureDelaySeconds,
        arrivalRunwayClosureDelaySeconds:
          arrivalRunwaySelection.closureDelaySeconds,
        runwayReassignedByClosure:
          departureRunwaySelection.reassignedByClosure ||
          arrivalRunwaySelection.reassignedByClosure,
      }),
    }));
    standAvailableAt.set(destinationStand.id, Number.POSITIVE_INFINITY);

    let nextAvailable = arrival + turnaroundHours * 3600;
    if (context.random() < simulatedFaultProbability) {
      const repairHours = 4 + context.random() * 8;
      const lanes = maintenanceLanes.get(destination);
      if (!lanes) throw new Error(`机场${destination}缺少维修容量。`);
      const maintenanceStart = reserveCapacityLane(lanes, arrival + 60, repairHours * 3600);
      const maintenanceEnd = maintenanceStart + repairHours * 3600;
      maintenanceWindows.push(Object.freeze({
        id: `MW-${missionId}`,
        aircraftId: context.aircraft.id,
        airportIdent: destination,
        trigger: "simulated_fault" as const,
        startOffsetSeconds: Math.round(maintenanceStart),
        endOffsetSeconds: Math.round(maintenanceEnd),
      }));
      nextAvailable = Math.max(nextAvailable, maintenanceEnd + turnaroundHours * 3600);
    }

    context.currentAirportIdent = destination;
    context.currentStandId = destinationStand.id;
    const nextCadenceDeparture =
      requestedDeparture +
      plannedDepartureSpacingSeconds * (0.9 + context.random() * 0.2) /
        activeTrafficMultiplier(disturbances, destination, nextAvailable);
    context.nextRequestedDeparture = Math.max(nextAvailable, nextCadenceDeparture);
    context.missionIndex += 1;
    contexts.push(context);
  }

  const dailyPlans = ([1, 2, 3] as const).map((day) => {
    const start = (day - 1) * 24 * 3600;
    const end = day * 24 * 3600;
    const flights = missions.filter(
      (mission) => mission.departureOffsetSeconds >= start && mission.departureOffsetSeconds < end,
    );
    return Object.freeze({
      day,
      flightCount: flights.length,
      delayedFlightCount: flights.filter((mission) => mission.delaySeconds > 0).length,
      plannedFlightHours: round(
        flights.reduce((sum, mission) => sum + mission.plannedDurationHours, 0),
      ),
      maintenanceWindowCount: maintenanceWindows.filter(
        (window) => window.startOffsetSeconds >= start && window.startOffsetSeconds < end,
      ).length,
    });
  });

  return Object.freeze({
    plannerId: FLEET_72H_TASK_PLANNER_ID,
    seed,
    horizonHours: 72 as const,
    missions: Object.freeze(missions),
    maintenanceWindows: Object.freeze(maintenanceWindows),
    airportConstraints: Object.freeze(airportConstraints),
    dailyPlans: Object.freeze(dailyPlans),
  });
}
