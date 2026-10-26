import { createAirportOperationalPosition } from "../../domain/geo";
import type {
  Aircraft,
  AircraftPosition,
  AirportState,
  GroundMovementState,
  MaintenanceApronState,
  MaintenanceResources,
  RuntimeStand,
} from "../../types/airport";
import type { CoordinationState } from "../../types/coordination";
import type { GroundSupportState } from "../../types/groundSupport";
import type { AirportSurfaceRuntimeState } from "./airportSurfaceRuntime";
import type { MaterializedAirportOperationalResources } from "./operationalResourceAdapter";
import type {
  AirportGeospatialIntegration,
  ProjectedAirportFeature,
} from "./types";

export type CreateAirportStateFromConfigurationInput = Readonly<{
  integration: AirportGeospatialIntegration;
  surfaceRuntimeState: AirportSurfaceRuntimeState;
  operationalResources: MaterializedAirportOperationalResources;
  initialLogTime?: string;
}>;

const RUNTIME_STAND_KINDS = new Set([
  "gate",
  "remote_stand",
  "cargo_stand",
  "stand",
]);

function isRuntimeStandFeature(feature: ProjectedAirportFeature) {
  return (
    feature.geometry.type === "Point" &&
    RUNTIME_STAND_KINDS.has(feature.properties.kind) &&
    (feature.properties.operational !== false ||
      feature.properties.activationStatus === "candidate")
  );
}

function emptyCoordinationState(time: string): CoordinationState {
  return {
    clock: {
      mode: "simulation",
      currentTime: time,
      sequence: 0,
      speed: 1,
      status: "运行中",
    },
    agents: {},
    events: [],
    tasks: [],
  };
}

function emptyGroundMovementState(
  aircraftPositions: Record<string, AircraftPosition>,
): GroundMovementState {
  return {
    aircraftPositions,
    nodes: [],
    edges: [],
    restrictedZones: [],
    tasks: [],
    routes: [],
    runwayStopBars: {},
    runwayClearances: [],
    runwayOperations: [],
    runwayOccupancy: {
      "RWY-NORTH": {
        runwayId: "RWY-NORTH",
        status: "available",
        operationTaskId: null,
        routeId: null,
        aircraftId: null,
        occupiedSince: null,
        expectedReleaseAt: null,
      },
      "RWY-SOUTH": {
        runwayId: "RWY-SOUTH",
        status: "available",
        operationTaskId: null,
        routeId: null,
        aircraftId: null,
        occupiedSince: null,
        expectedReleaseAt: null,
      },
    },
    activeTaskId: null,
    activeRouteId: null,
    operatingConditions: {
      visibilityMode: "normal",
      rvrMeters: null,
      lowVisibilityProceduresActive: false,
    },
    debugLayerVisible: false,
  };
}

function cloneMaintenanceAprons(
  aprons: Record<string, MaintenanceApronState>,
): Record<string, MaintenanceApronState> {
  return Object.fromEntries(
    Object.values(aprons).map((apron) => [
      apron.id,
      {
        ...apron,
        commandAliases: [...apron.commandAliases],
        dispatchPriority: { ...apron.dispatchPriority },
        tugCategoryPriority: [...apron.tugCategoryPriority],
        supportedMaintenanceTypes: [...apron.supportedMaintenanceTypes],
      },
    ]),
  );
}

function cloneGroundSupport(state: GroundSupportState): GroundSupportState {
  return {
    bases: { ...state.bases },
    parkingSpots: { ...state.parkingSpots },
    waitingAreas: { ...state.waitingAreas },
    equipment: { ...state.equipment },
    tasks: [...state.tasks],
    activeTaskId: state.activeTaskId,
    vehicleRoutes: [...state.vehicleRoutes],
    activeVehicleRouteId: state.activeVehicleRouteId,
    showAllEquipment: state.showAllEquipment,
  };
}

/**
 * 把机场的WGS84设施、初始场面飞机和独立资源包装配为共享AirportState。
 * 这里只装配状态；滑行路网在机场的已批准网络编译完成后再注入，避免
 * 用另一个机场的节点、跑道或限制区填充空缺。
 */
export function createAirportStateFromConfiguration(
  input: CreateAirportStateFromConfigurationInput,
): AirportState {
  const airportIdent = input.integration.airportIdent;
  if (
    input.surfaceRuntimeState.airportIdent !== airportIdent ||
    input.operationalResources.airportIdent !== airportIdent
  ) {
    throw new Error("场面状态、运行资源与地理配置必须属于同一机场。");
  }

  const maintenanceAprons = cloneMaintenanceAprons(
    input.operationalResources.maintenanceAprons,
  );
  const surfaceStands = input.surfaceRuntimeState.stands;
  const stands: Record<string, RuntimeStand> = {};

  input.integration.features
    .filter(isRuntimeStandFeature)
    .forEach((feature) => {
      if (feature.geometry.type !== "Point") return;
      const coordinate = feature.geometry.coordinates;
      const operationalPosition = createAirportOperationalPosition({
        longitude: coordinate.wgs84.longitude,
        latitude: coordinate.wgs84.latitude,
        eastMeters: coordinate.local.eastMeters,
        northMeters: coordinate.local.northMeters,
        authority: "wgs84_configuration",
      });
      const compatibilityPoint = input.integration.coordinateConverter.wgs84ToMap(
        coordinate.wgs84,
      );
      const surfaceStand = surfaceStands[feature.properties.id];
      const areaId =
        feature.properties.parentZoneId ??
        feature.properties.parentConcourseId ??
        feature.properties.parentTerminalId ??
        feature.properties.terminalAffinity ??
        airportIdent;
      const maintenanceApron = maintenanceAprons[areaId];
      stands[feature.properties.id] = {
        id: feature.properties.id,
        areaId,
        kind: maintenanceApron ? "maintenance" : "boarding",
        operationalAvailability:
          feature.properties.activationStatus === "candidate"
            ? "candidate"
            : "active",
        position: compatibilityPoint,
        operationalPosition,
        heading: 0,
        status: surfaceStand?.status ?? "空闲",
        aircraftId: surfaceStand?.aircraftId ?? null,
        reservationAircraftId: null,
        maintenanceCapability: maintenanceApron
          ? [...maintenanceApron.supportedMaintenanceTypes]
          : null,
      };
    });

  const aircraft: Record<string, Aircraft> = Object.fromEntries(
    Object.values(input.surfaceRuntimeState.aircraft).map((item) => [
      item.id,
      {
        id: item.id,
        model: item.model,
        status: item.status,
        risk: item.risk,
        currentStandId: item.currentStandId,
        flightHours: item.flightHours,
        remainingFlightHours: item.remainingFlightHours,
        healthProfile: item.healthProfile,
        faultType: null,
        maintenanceType: null,
        description: item.description,
      } satisfies Aircraft,
    ]),
  );

  const time = input.initialLogTime ?? input.surfaceRuntimeState.generatedAt;
  const aircraftPositions: Record<string, AircraftPosition> = Object.fromEntries(
    Object.values(aircraft).map((item) => {
      const stand = item.currentStandId ? stands[item.currentStandId] : null;
      if (!stand?.operationalPosition) {
        throw new Error(`${item.id}引用了不存在或未标定的机位。`);
      }
      const position = stand.operationalPosition;
      return [
        item.id,
        {
          aircraftId: item.id,
          x: stand.position.x,
          y: stand.position.y,
          latitude: position.wgs84.latitude,
          longitude: position.wgs84.longitude,
          eastMeters: position.local.eastMeters,
          northMeters: position.local.northMeters,
          operationalPosition: position,
          heading: stand.heading,
          groundSpeed: 0,
          timestamp: time,
          source: "stand",
        } satisfies AircraftPosition,
      ];
    }),
  );

  Object.values(maintenanceAprons).forEach((apron) => {
    apron.occupied = Object.values(stands).filter(
      (stand) => stand.areaId === apron.id && stand.status === "占用",
    ).length;
  });

  const personnel = Object.values(maintenanceAprons).reduce(
    (sum, apron) => sum + apron.availablePersonnel,
    0,
  );
  const equipment = Object.values(maintenanceAprons).reduce(
    (sum, apron) => sum + apron.availableEquipment,
    0,
  );
  const resources: MaintenanceResources = {
    totalPersonnel: personnel,
    availablePersonnel: personnel,
    totalEquipment: equipment,
    availableEquipment: equipment,
    spareParts: [],
  };

  return {
    airportIdent,
    aircraft,
    stands,
    maintenanceAprons,
    maintenanceTasks: [],
    pendingDecisions: [],
    pendingDecision: null,
    resources,
    operationLogs: [
      {
        id: `LOG-${airportIdent}-INITIALIZED`,
        time,
        category: "状态变化",
        message: `${airportIdent}独立机场运行状态初始化完成。`,
        aircraftId: null,
        taskId: null,
      },
    ],
    coordination: emptyCoordinationState(time),
    groundMovement: emptyGroundMovementState(aircraftPositions),
    groundSupport: cloneGroundSupport(input.operationalResources.groundSupport),
  };
}
