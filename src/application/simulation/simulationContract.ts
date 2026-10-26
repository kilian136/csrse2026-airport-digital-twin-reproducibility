import type { AirportOperationalPosition } from "../../domain/geo/operationalPosition";
import type { AircraftHealthProfile } from "../../domain/aircraft";
import type { AirportState } from "../../domain/state";
import { AIRLINE_FLEET_SIZE } from "../../domain/fleetIdentity";
import type { SimulationScenarioSnapshot } from "./simulationScenarioSnapshot";
import {
  inferStandOperationalRole,
  inferStandReferenceCode,
  type StandOperationalRole,
  type StandReferenceCode,
} from "../../services/standDispatchPolicy";

export const SIMULATION_CONTRACT_VERSION = "1.0" as const;
export const DEFAULT_DETAILED_AIRCRAFT_PER_AIRPORT = AIRLINE_FLEET_SIZE;

export type SimulationSourceType =
  | "realtime_snapshot"
  | "imported_plan"
  | "manual_configuration"
  | "simulation_assumption";

export type SimulationGeoPosition = Readonly<{
  longitude: number;
  latitude: number;
  eastMeters: number;
  northMeters: number;
  authority:
    | "wgs84_configuration"
    | "compiled_network"
    | "local_simulation"
    | "telemetry";
}>;

export type SimulationAircraftInput = Readonly<{
  id: string;
  model: string;
  initialAirportIdent: string;
  status: string;
  risk: "低" | "中" | "高";
  currentStandId: string | null;
  initialOperationalPhase: "ground" | "in_flight";
  flightHours: number;
  remainingFlightHours: number;
  faultType: string | null;
  maintenanceType: string | null;
  dispatchEligibility: "eligible" | "maintenance_pending" | "grounded";
  initialMaintenanceRemainingHours: number | null;
  position: SimulationGeoPosition | null;
  healthProfile: AircraftHealthProfile;
}>;

export type SimulationStandInput = Readonly<{
  id: string;
  airportIdent: string;
  areaId: string;
  kind: "boarding" | "maintenance";
  referenceCode: StandReferenceCode;
  operationalRole: StandOperationalRole;
  operationalAvailability: "active" | "candidate";
  status: string;
  aircraftId: string | null;
  reservationAircraftId: string | null;
  heading: number;
  position: SimulationGeoPosition | null;
}>;

export type SimulationMaintenanceAreaInput = Readonly<{
  id: string;
  airportIdent: string;
  name: string;
  capacity: number;
  occupied: number;
  supportedMaintenanceTypes: readonly string[];
  availablePersonnel: number;
  availableEquipment: number;
}>;

export type SimulationSupportVehicleInput = Readonly<{
  id: string;
  airportIdent: string;
  name: string;
  category: string;
  status: string;
  geospatialReadiness: "ready" | "unmapped";
  homeBaseId: string;
  energyPercent: number;
  supportedAircraftModels: readonly string[];
  canTowAircraft: boolean;
  canTransportParts: boolean;
  canPerformMaintenance: boolean;
  position: SimulationGeoPosition | null;
}>;

export type SimulationGroundSupportRoutePoint = Readonly<{
  nodeId: string | null;
  longitude: number;
  latitude: number;
  eastMeters: number;
  northMeters: number;
}>;

/**
 * 保障基地到机位的受控道路最短路。契约仅携带本行程经过的WGS84折线，
 * 而不复制整张机场路网；排程、回放和地图动画因此使用同一份权威路线。
 */
export type SimulationGroundSupportTravelRouteInput = Readonly<{
  homeBaseId: string;
  standId: string;
  outboundDistanceMeters: number;
  returnDistanceMeters: number;
  sourceAttachmentMeters: number;
  destinationAttachmentMeters: number;
  outboundAuthority:
    | "compiled_service_road"
    | "compiled_service_road_nearest_base_assumption"
    | "direct_distance_fallback";
  returnAuthority:
    | "compiled_service_road"
    | "compiled_service_road_nearest_base_assumption"
    | "direct_distance_fallback";
  outboundPath: readonly SimulationGroundSupportRoutePoint[];
  returnPath: readonly SimulationGroundSupportRoutePoint[];
  unroutableDirections: readonly ("outbound" | "return")[];
  authority:
    | "compiled_service_road"
    | "compiled_service_road_nearest_base_assumption"
    | "direct_distance_fallback";
}>;

export type SimulationRunwayInput = Readonly<{
  id: string;
  ref: string;
  lengthMeters: number;
  permittedDesignators: readonly string[];
  authority: "approved_compiled_wgs84";
}>;

export type SimulationAirportInput = Readonly<{
  ident: string;
  name: string;
  networkReference: Readonly<{
    authority: "compiled_wgs84";
    airportIdent: string;
  }>;
  stands: readonly SimulationStandInput[];
  maintenanceAreas: readonly SimulationMaintenanceAreaInput[];
  supportVehicles: readonly SimulationSupportVehicleInput[];
  groundSupportTravelRoutes: readonly SimulationGroundSupportTravelRouteInput[];
  runways: readonly SimulationRunwayInput[];
  resources: Readonly<{
    totalPersonnel: number;
    availablePersonnel: number;
    totalEquipment: number;
    availableEquipment: number;
    activeMaintenanceTaskCount: number;
  }>;
}>;

export type SimulationMissionPlanInput = Readonly<{
  id: string;
  aircraftId: string;
  sourceAirportIdent: string;
  destinationAirportIdent: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  sourceType: SimulationSourceType;
}>;

export type SimulationProvenanceRecord = Readonly<{
  scope: "scenario" | "airport" | "fleet" | "mission_plan";
  subjectId: string;
  sourceType: SimulationSourceType;
  reference: string;
  capturedAt: string;
  note: string;
}>;

/**
 * 仿真内核唯一允许读取的版本化输入。该结构必须保持JSON可序列化，
 * 以便前端基线、未来Python引擎和结果回放使用同一份场景输入。
 */
export type SimulationInputContract = Readonly<{
  schemaVersion: typeof SIMULATION_CONTRACT_VERSION;
  id: string;
  scenarioId: string;
  generatedAt: string;
  startTime: string;
  horizonHours: 72;
  seed: number;
  requiredAirportCount: 3;
  fleetSelection: Readonly<{
    policy: "full_detailed_fleet" | "deterministic_detailed_sample";
    sourceAircraftCount: number;
    selectedAircraftCount: number;
    maximumAircraftPerAirport: number;
  }>;
  airports: readonly SimulationAirportInput[];
  aircraft: readonly SimulationAircraftInput[];
  missionPlan: readonly SimulationMissionPlanInput[];
  provenance: readonly SimulationProvenanceRecord[];
  assumptions: readonly string[];
}>;

export type SimulationEventType =
  | "simulation_started"
  | "support_reserved"
  | "support_dispatched"
  | "support_arrived"
  | "support_service_started"
  | "support_service_completed"
  | "support_returned"
  | "support_released"
  | "maintenance_started"
  | "maintenance_completed"
  | "maintenance_release_issued"
  | "departure_clearance_issued"
  | "flight_departed"
  | "destination_handoff_accepted"
  | "arrival_clearance_issued"
  | "flight_arrived"
  | "fault_detected"
  | "emergency_detected"
  | "emergency_stand_blocked"
  | "emergency_response_dispatched"
  | "emergency_response_arrived"
  | "emergency_response_completed"
  | "emergency_response_released"
  | "emergency_operational_review_started"
  | "emergency_mission_delayed"
  | "emergency_stand_reassigned"
  | "emergency_ground_support_recompiled"
  | "emergency_operational_released"
  | "simulation_completed";

export type SimulationEventContract = Readonly<{
  schemaVersion: typeof SIMULATION_CONTRACT_VERSION;
  id: string;
  sequence: number;
  type: SimulationEventType;
  source: "baseline_engine";
  offsetSeconds: number;
  scheduledTime: string;
  priority: number;
  airportIdent: string | null;
  aircraftId: string | null;
  missionId: string | null;
  description: string;
  payload: Readonly<Record<string, string | number | boolean | null>>;
}>;

function toContractPosition(
  position: AirportOperationalPosition | null | undefined,
): SimulationGeoPosition | null {
  if (!position || position.authority === "legacy_projection") return null;
  return Object.freeze({
    longitude: position.wgs84.longitude,
    latitude: position.wgs84.latitude,
    eastMeters: position.local.eastMeters,
    northMeters: position.local.northMeters,
    authority: position.authority,
  });
}

function remainingMaintenanceHours(state: AirportState, aircraftId: string) {
  const task = state.maintenanceTasks.find(
    (candidate) =>
      candidate.aircraftId === aircraftId &&
      candidate.status !== "已完成" &&
      candidate.status !== "已取消",
  );
  return task ? Math.max(1, task.estimatedHours * (1 - task.progress)) : null;
}

function selectDetailedAircraft(
  state: AirportState,
  maximumAircraft: number,
) {
  const priority = (status: string) =>
    status === "停飞" ? 0 : status === "维修中" ? 1 : status === "维修完成" ? 2 : 3;
  return Object.values(state.aircraft)
    .sort(
      (left, right) =>
        priority(left.status) - priority(right.status) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, maximumAircraft);
}

function buildAircraftInputs(
  airportIdent: string,
  state: AirportState,
  maximumAircraft: number,
): SimulationAircraftInput[] {
  return selectDetailedAircraft(state, maximumAircraft)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((aircraft) => {
      const taskHours = remainingMaintenanceHours(state, aircraft.id);
      const position =
        state.groundMovement.aircraftPositions[aircraft.id]?.operationalPosition ??
        (aircraft.currentStandId
          ? state.stands[aircraft.currentStandId]?.operationalPosition
          : null);
      const dispatchEligibility = aircraft.status === "停飞"
        ? "grounded"
        : taskHours !== null || aircraft.status === "维修中"
          ? "maintenance_pending"
          : "eligible";

      return Object.freeze({
        id: aircraft.id,
        model: aircraft.model,
        initialAirportIdent: airportIdent,
        status: aircraft.status,
        risk: aircraft.risk,
        currentStandId: aircraft.currentStandId,
        initialOperationalPhase:
          !aircraft.currentStandId &&
          (aircraft.status === "离场" || aircraft.status === "转场中")
            ? "in_flight" as const
            : "ground" as const,
        flightHours: aircraft.flightHours,
        remainingFlightHours: aircraft.remainingFlightHours,
        faultType: aircraft.faultType,
        maintenanceType: aircraft.maintenanceType,
        dispatchEligibility,
        initialMaintenanceRemainingHours:
          dispatchEligibility === "maintenance_pending" ? taskHours ?? 8 : null,
        position: toContractPosition(position),
        healthProfile: aircraft.healthProfile,
      });
    });
}

function buildAirportInput(
  airportIdent: string,
  airportName: string,
  state: AirportState,
  runways: readonly SimulationRunwayInput[],
  groundSupportTravelRoutes: readonly SimulationGroundSupportTravelRouteInput[],
): SimulationAirportInput {
  const stands = Object.values(state.stands)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((stand) => Object.freeze({
      id: stand.id,
      airportIdent,
      areaId: stand.areaId,
      kind: stand.kind,
      referenceCode: inferStandReferenceCode(stand.areaId, stand.kind),
      operationalRole: inferStandOperationalRole(stand.id),
      operationalAvailability: stand.operationalAvailability ?? "active",
      status: stand.status,
      aircraftId: stand.aircraftId,
      reservationAircraftId: stand.reservationAircraftId ?? null,
      heading: stand.heading,
      position: toContractPosition(stand.operationalPosition),
    }));
  const maintenanceAreas = Object.values(state.maintenanceAprons)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((area) => Object.freeze({
      id: area.id,
      airportIdent,
      name: area.name,
      capacity: area.capacity,
      occupied: area.occupied,
      supportedMaintenanceTypes: Object.freeze([...area.supportedMaintenanceTypes]),
      availablePersonnel: area.availablePersonnel,
      availableEquipment: area.availableEquipment,
    }));
  const supportVehicles = Object.values(state.groundSupport.equipment)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((equipment) => Object.freeze({
      id: equipment.id,
      airportIdent,
      name: equipment.name,
      category: equipment.category,
      status: equipment.status,
      geospatialReadiness: equipment.geospatialReadiness,
      homeBaseId: equipment.homeBaseId,
      energyPercent: equipment.energyPercent,
      supportedAircraftModels: Object.freeze([
        ...equipment.capability.supportedAircraftModels,
      ]),
      canTowAircraft: equipment.capability.canTowAircraft,
      canTransportParts: equipment.capability.canTransportParts,
      canPerformMaintenance: equipment.capability.canPerformMaintenance,
      position: toContractPosition(equipment.position.operationalPosition),
    }));

  return Object.freeze({
    ident: airportIdent,
    name: airportName,
    networkReference: Object.freeze({
      authority: "compiled_wgs84" as const,
      airportIdent,
    }),
    stands: Object.freeze(stands),
    maintenanceAreas: Object.freeze(maintenanceAreas),
    supportVehicles: Object.freeze(supportVehicles),
    groundSupportTravelRoutes: Object.freeze(
      groundSupportTravelRoutes.map((route) => Object.freeze({
        ...route,
        outboundPath: Object.freeze(
          route.outboundPath.map((point) => Object.freeze({ ...point })),
        ),
        returnPath: Object.freeze(
          route.returnPath.map((point) => Object.freeze({ ...point })),
        ),
        unroutableDirections: Object.freeze([...route.unroutableDirections]),
      })),
    ),
    runways: Object.freeze(runways.map((runway) => Object.freeze({
      ...runway,
      permittedDesignators: Object.freeze([...runway.permittedDesignators]),
    }))),
    resources: Object.freeze({
      totalPersonnel: state.resources.totalPersonnel,
      availablePersonnel: state.resources.availablePersonnel,
      totalEquipment: state.resources.totalEquipment,
      availableEquipment: state.resources.availableEquipment,
      activeMaintenanceTaskCount: state.maintenanceTasks.filter(
        (task) => task.status !== "已完成" && task.status !== "已取消",
      ).length,
    }),
  });
}

export function assertSimulationInputContract(
  input: SimulationInputContract,
): void {
  if (input.schemaVersion !== SIMULATION_CONTRACT_VERSION) {
    throw new Error(`不支持的仿真契约版本：${input.schemaVersion}`);
  }
  if (input.horizonHours !== 72) {
    throw new Error("当前仿真契约仅支持72小时推演。 ");
  }
  if (input.airports.length < 1) {
    throw new Error("仿真契约至少需要1座已配置机场。 ");
  }
  const airportIdents = new Set(input.airports.map((airport) => airport.ident));
  if (airportIdents.size !== input.airports.length) {
    throw new Error("仿真契约存在重复机场。 ");
  }
  input.airports.forEach((airport) => {
    const standIds = new Set(airport.stands.map((stand) => stand.id));
    const supportBaseIds = new Set(
      airport.supportVehicles.map((vehicle) => vehicle.homeBaseId),
    );
    const routeKeys = new Set<string>();
    airport.groundSupportTravelRoutes.forEach((route) => {
      const key = `${route.homeBaseId}|${route.standId}`;
      if (routeKeys.has(key)) {
        throw new Error(`机场${airport.ident}存在重复保障道路行程：${key}`);
      }
      if (!supportBaseIds.has(route.homeBaseId) || !standIds.has(route.standId)) {
        throw new Error(`机场${airport.ident}的保障道路行程引用了未知基地或机位：${key}`);
      }
      if (
        !Number.isFinite(route.outboundDistanceMeters) ||
        !Number.isFinite(route.returnDistanceMeters) ||
        route.outboundDistanceMeters < 0 ||
        route.returnDistanceMeters < 0
      ) {
        throw new Error(`机场${airport.ident}的保障道路行程距离无效：${key}`);
      }
      ([
        ["去程", route.outboundPath],
        ["返程", route.returnPath],
      ] as const).forEach(([directionLabel, path]) => {
        if (path.length < 2) {
          throw new Error(
            `机场${airport.ident}的保障道路${directionLabel}折线不足两个点：${key}`,
          );
        }
        path.forEach((point) => {
          if (
            !Number.isFinite(point.longitude) ||
            !Number.isFinite(point.latitude) ||
            !Number.isFinite(point.eastMeters) ||
            !Number.isFinite(point.northMeters) ||
            point.longitude < -180 ||
            point.longitude > 180 ||
            point.latitude < -90 ||
            point.latitude > 90
          ) {
            throw new Error(
              `机场${airport.ident}的保障道路${directionLabel}折线坐标无效：${key}`,
            );
          }
        });
      });
      if (
        route.unroutableDirections.includes("outbound") !==
          (route.outboundAuthority === "direct_distance_fallback") ||
        route.unroutableDirections.includes("return") !==
          (route.returnAuthority === "direct_distance_fallback")
      ) {
        throw new Error(`机场${airport.ident}的保障道路降级方向与权威标记不一致：${key}`);
      }
      routeKeys.add(key);
    });
    const runwayIds = new Set<string>();
    airport.runways.forEach((runway) => {
      if (runwayIds.has(runway.id)) {
        throw new Error(`机场${airport.ident}存在重复跑道：${runway.id}`);
      }
      if (!Number.isFinite(runway.lengthMeters) || runway.lengthMeters <= 0) {
        throw new Error(`机场${airport.ident}的跑道${runway.id}长度无效。`);
      }
      if (runway.permittedDesignators.length === 0) {
        throw new Error(`机场${airport.ident}的跑道${runway.id}缺少允许方向。`);
      }
      runwayIds.add(runway.id);
    });
  });
  const aircraftIds = new Set<string>();
  input.aircraft.forEach((aircraft) => {
    if (aircraftIds.has(aircraft.id)) {
      throw new Error(`仿真契约存在重复飞机：${aircraft.id}`);
    }
    if (!airportIdents.has(aircraft.initialAirportIdent)) {
      throw new Error(`飞机${aircraft.id}引用了未配置机场。`);
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
    aircraft.healthProfile.components.forEach((component) => {
      if (
        component.accumulatedOperatingHours < 0 ||
        component.remainingLifeHours < 0 ||
        component.ratedLifeHours < component.accumulatedOperatingHours
      ) {
        throw new Error(`飞机${aircraft.id}的${component.name}寿命数据无效。`);
      }
    });
    aircraftIds.add(aircraft.id);
  });
  if (
    input.fleetSelection.selectedAircraftCount !== input.aircraft.length ||
    input.fleetSelection.sourceAircraftCount < input.aircraft.length
  ) {
    throw new Error("仿真契约的机队抽样统计与飞机明细不一致。 ");
  }
}

/** 将隔离快照转换成前端、Python和回放模块共同使用的稳定输入契约。 */
export type BuildSimulationInputContractOptions = Readonly<{
  seed?: number;
  maximumAircraftPerAirport?: number;
  runwayProfilesByAirport?: Readonly<Record<string, readonly SimulationRunwayInput[]>>;
  groundSupportTravelRoutesByAirport?: Readonly<
    Record<string, readonly SimulationGroundSupportTravelRouteInput[]>
  >;
}>;

export function buildSimulationInputContract(
  scenario: SimulationScenarioSnapshot,
  options: BuildSimulationInputContractOptions = {},
): SimulationInputContract {
  const readySnapshots = scenario.airportSlots.flatMap((slot) =>
    slot.status === "ready" ? [slot.snapshot] : [],
  );
  const airports = readySnapshots.map((snapshot) =>
    buildAirportInput(
      snapshot.airportIdent,
      snapshot.airportName,
      snapshot.state,
      options.runwayProfilesByAirport?.[snapshot.airportIdent] ?? [],
      options.groundSupportTravelRoutesByAirport?.[snapshot.airportIdent] ?? [],
    ),
  );
  const seed = options.seed ?? 42;
  const maximumAircraftPerAirport =
    options.maximumAircraftPerAirport ?? DEFAULT_DETAILED_AIRCRAFT_PER_AIRPORT;
  if (!Number.isInteger(maximumAircraftPerAirport) || maximumAircraftPerAirport < 1) {
    throw new Error("每座机场的详细仿真飞机数量必须是正整数。 ");
  }
  const sourceAircraftCount = readySnapshots.reduce(
    (sum, snapshot) => sum + Object.keys(snapshot.state.aircraft).length,
    0,
  );
  const aircraft = readySnapshots.flatMap((snapshot) =>
    buildAircraftInputs(
      snapshot.airportIdent,
      snapshot.state,
      maximumAircraftPerAirport,
    ),
  );
  const provenance = Object.freeze([
    Object.freeze({
      scope: "scenario" as const,
      subjectId: scenario.id,
      sourceType: "realtime_snapshot" as const,
      reference: "isolated_airport_state_snapshot",
      capturedAt: scenario.capturedAt,
      note: "实时状态的隔离副本，不允许仿真结果写回实时运行状态。",
    }),
    ...readySnapshots.map((snapshot) => Object.freeze({
      scope: "airport" as const,
      subjectId: snapshot.airportIdent,
      sourceType: "manual_configuration" as const,
      reference: `${snapshot.airportIdent}:compiled_wgs84_operational_network`,
      capturedAt: snapshot.capturedAt,
      note: "机场资源与运行位置来自机场独立配置包和已编译WGS84受控路网。",
    })),
    Object.freeze({
      scope: "fleet" as const,
      subjectId: "shared-airline-fleet",
      sourceType: "realtime_snapshot" as const,
      reference: "shared_fleet_registry",
      capturedAt: scenario.capturedAt,
      note: `${aircraft.length}架飞机在已配置机场间唯一分配。`,
    }),
    Object.freeze({
      scope: "mission_plan" as const,
      subjectId: "72h-mission-plan",
      sourceType: "simulation_assumption" as const,
      reference: "baseline_generator_pending_formal_plan",
      capturedAt: scenario.capturedAt,
      note: "尚未接入正式未来三日航班计划，资源约束计划器将按固定种子生成任务需求。",
    }),
  ]);

  const contract: SimulationInputContract = Object.freeze({
    schemaVersion: SIMULATION_CONTRACT_VERSION,
    id: `SIM-CONTRACT-${scenario.id}`,
    scenarioId: scenario.id,
    generatedAt: scenario.capturedAt,
    startTime: scenario.capturedAt,
    horizonHours: scenario.horizonHours,
    seed,
    requiredAirportCount: scenario.requiredAirportCount,
    fleetSelection: Object.freeze({
      policy: aircraft.length === sourceAircraftCount
        ? "full_detailed_fleet" as const
        : "deterministic_detailed_sample" as const,
      sourceAircraftCount,
      selectedAircraftCount: aircraft.length,
      maximumAircraftPerAirport,
    }),
    airports: Object.freeze(airports),
    aircraft: Object.freeze(aircraft),
    missionPlan: Object.freeze([]),
    provenance,
    assumptions: Object.freeze([
      "第三座机场在完整配置包接入前不参与任务生成。",
      "没有权威WGS84或局部米制坐标的对象位置保持null。",
      "当前未提供正式航班计划，任务生成规则必须在输出中标记为仿真假设。",
      "地图与仿真引擎共用飞机健康档案；当前寿命值为仿真假设，后续可由真实数据源替换。",
      "跑道性能门槛属于可替换的仿真参数，不构成制造商性能计算或适航放行依据。",
    ]),
  });
  assertSimulationInputContract(contract);
  return contract;
}
