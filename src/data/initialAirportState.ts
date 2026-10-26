import { parkingStands } from "./airportLayout";
import { initialGroundMovementState } from "./airportNetwork";

import type {
  Aircraft,
  AircraftPosition,
  AirportState,
  MaintenanceApronId,
  MaintenanceTask,
  MaintenanceType,
  RiskLevel,
  RuntimeStand,
  StandStatus,
} from "../types/airport";

import { initialGroundSupportState } from "./groundSupportEquipment";
import { activeAirportOperationsNetwork } from "../airportProfiles/activeNetwork";
import { activeAirportPositionProjector } from "../airportProfiles/activeCoordinates";
import { xiaoshanGeospatialIntegration } from "../airportPackages/ZSHC";
import { xiaoshanRuntimeStandGeospatialBindings } from "../airportPackages/ZSHC/runtimeStandGeospatialBindings";
import { xiaoshanSupportBaseGeospatialBindings } from "../airportPackages/ZSHC/supportBaseGeospatialBindings";
import { xiaoshanSupportWaitingAreaGeospatialBindings } from "../airportPackages/ZSHC/supportWaitingAreaGeospatialBindings";
import {
  resolveRuntimeStandWgs84Coordinate,
  resolveSupportBaseWgs84Coordinate,
  resolveSupportWaitingAreaWgs84Coordinate,
} from "../infrastructure/airportConfig";
import {
  createInitialCoordinationState,
} from "../services/coordinationProjector";
import {
  AIRPORT_FLEET_ALLOCATION,
  createFleetAircraftId,
} from "../domain/fleetIdentity";
import { createAssumedAircraftHealthProfile } from "../domain/aircraft";
/* =========================
   风险判断
========================= */

function getAircraftRisk(
  aircraftId: string,
): RiskLevel {
  const highRiskAircraft = [
    "B-004",
    "B-017",
    "B-038",
    "B-041",
    "B-055",
  ];

  const mediumRiskAircraft = [
    "B-007",
    "B-023",
    "B-031",
    "B-045",
    "B-051",
  ];

  if (highRiskAircraft.includes(aircraftId)) {
    return "高";
  }

  if (mediumRiskAircraft.includes(aircraftId)) {
    return "中";
  }

  return "低";
}

/* =========================
   飞机型号
========================= */

function getAircraftModel(
  aircraftId: string,
): string {
  const aircraftNumber = Number(
    aircraftId.replace(/\D/g, ""),
  );

  if (aircraftNumber % 4 === 0) {
    return "B737-800";
  }

  if (aircraftNumber % 4 === 1) {
    return "A320neo";
  }

  if (aircraftNumber % 4 === 2) {
    return "A321";
  }

  return "B737 MAX 8";
}

/* =========================
   飞机故障信息
========================= */

function getFaultType(
  aircraftId: string,
): string | null {
  const risk = getAircraftRisk(aircraftId);

  if (risk === "高") {
    return "航电系统关键参数异常";
  }

  if (risk === "中") {
    return "液压系统参数波动";
  }

  return null;
}

/* =========================
   普通停机位转换
========================= */

function resolveInitialStandOperationalPosition(standId: string) {
  const wgs84 = resolveRuntimeStandWgs84Coordinate(
    standId,
    xiaoshanGeospatialIntegration.features,
    xiaoshanRuntimeStandGeospatialBindings,
  );
  return wgs84
    ? activeAirportPositionProjector.projectWgs84(
        wgs84,
        "wgs84_configuration",
      ).operationalPosition
    : null;
}

function createRegularRuntimeStands(): Record<
  string,
  RuntimeStand
> {
  const result: Record<string, RuntimeStand> = {};

  parkingStands.forEach((stand) => {
    result[stand.id] = {
      id: stand.id,
      areaId: stand.zoneId,
      kind: "boarding",

      position: {
        x: stand.x,
        y: stand.y,
      },
      operationalPosition: resolveInitialStandOperationalPosition(stand.id),

      heading: stand.heading,

      status: stand.status as StandStatus,

      aircraftId: stand.aircraftId,

      maintenanceCapability: null,
    };
  });

  return result;
}

/* =========================
   维修机位原始数据
========================= */

type MaintenanceStandSeed = {
  id: string;
  apronId: MaintenanceApronId;

  x: number;
  y: number;
  heading: number;

  status: "占用" | "空闲";
  aircraftId: string | null;
};

function createMaintenanceStandRows(
  prefix: "MA" | "MB",
  apronId: MaintenanceApronId,
  xPositions: number[],
  yPositions: number[],
  occupiedCount: number,
  aircraftSerials: readonly number[],
): MaintenanceStandSeed[] {
  const result: MaintenanceStandSeed[] = [];
  const capacity = xPositions.length * yPositions.length;
  const occupiedIndexes = new Set(
    Array.from({ length: occupiedCount }, (_, index) =>
      occupiedCount <= 1
        ? Math.floor((capacity - 1) / 2)
        : Math.round((index * (capacity - 1)) / (occupiedCount - 1)),
    ),
  );

  let standIndex = 0;

  yPositions.forEach((y) => {
    xPositions.forEach((x) => {
      const standNumber = standIndex + 1;
      const occupied = occupiedIndexes.has(standIndex);

      result.push({
        id: `${prefix}-${String(
          standNumber,
        ).padStart(2, "0")}`,

        apronId,

        x,
        y,

        // 所有维修飞机机头朝向左侧
        heading: -90,

        status: occupied
          ? "占用"
          : "空闲",

        aircraftId: occupied
          ? createFleetAircraftId(
              aircraftSerials[result.filter((item) => item.aircraftId).length],
            )
          : null,
      });

      standIndex += 1;
    });
  });

  return result;
}

/* =========================
   MA、MB维修机位
========================= */

export const initialMaintenanceStandSeeds: MaintenanceStandSeed[] =
  [
    /*
     * MA大型维修机坪
     * 两排，每排8个
     */
    ...createMaintenanceStandRows(
      "MA",
      "MA",
      [
        8.6,
        10.05,
        11.5,
        12.95,
        14.4,
        15.85,
        17.3,
        18.75,
      ],
      [15.1, 22.5],
      2,
      AIRPORT_FLEET_ALLOCATION.ZSHC.serials.slice(11, 13),
    ),

    /*
     * MB小型维修机坪
     * 横向距离已经扩大1.8倍
     * 两排，每排6个
     */
    ...createMaintenanceStandRows(
      "MB",
      "MB",
      [
        22.32,
        23.31,
        24.3,
        25.29,
        26.28,
        27.27,
      ],
      [21.1, 24.6],
      2,
      AIRPORT_FLEET_ALLOCATION.ZSHC.serials.slice(13, 15),
    ),
  ];

/* =========================
   维修机位转换
========================= */

function createMaintenanceRuntimeStands(): Record<
  string,
  RuntimeStand
> {
  const result: Record<string, RuntimeStand> = {};

  initialMaintenanceStandSeeds.forEach(
    (stand) => {
      const maintenanceCapability: MaintenanceType[] =
        stand.apronId === "MA"
          ? [
              "大型维修",
              "小型维修",
              "检查",
            ]
          : [
              "小型维修",
              "检查",
            ];

      result[stand.id] = {
        id: stand.id,
        areaId: stand.apronId,
        kind: "maintenance",

        position: {
          x: stand.x,
          y: stand.y,
        },
        operationalPosition: resolveInitialStandOperationalPosition(stand.id),

        heading: stand.heading,
        status: stand.status,
        aircraftId: stand.aircraftId,

        maintenanceCapability,
      };
    },
  );

  return result;
}

/* =========================
   普通飞机初始数据
========================= */

function createRegularAircraft(): Record<
  string,
  Aircraft
> {
  const result: Record<string, Aircraft> = {};

  parkingStands.forEach((stand, index) => {
    if (!stand.aircraftId) {
      return;
    }

    const aircraftId = stand.aircraftId;
    const risk = getAircraftRisk(aircraftId);

    result[aircraftId] = {
      id: aircraftId,
      model: getAircraftModel(aircraftId),

      status:
        risk === "高"
          ? "停飞"
          : index % 5 === 0
            ? "过站保障"
            : "可用",

      risk,

      currentStandId: stand.id,

      flightHours:
        8200 + (index + 1) * 117,

      remainingFlightHours:
        risk === "高"
          ? 0
          : risk === "中"
            ? 36
            : 88,

      faultType:
        getFaultType(aircraftId),

      maintenanceType:
        risk === "高"
          ? "待判断"
          : null,

      description:
        risk === "高"
          ? "关键健康指标超过预警阈值，当前已经停飞并等待维修决策。"
          : risk === "中"
            ? "部分健康指标出现波动，需要持续监测并安排检查。"
            : "飞机健康状态稳定，可以执行计划内任务。",
      healthProfile: createAssumedAircraftHealthProfile({
        aircraftId,
        flightHours: 8200 + (index + 1) * 117,
        remainingFlightHours:
          risk === "高" ? 0 : risk === "中" ? 36 : 88,
        asOf: "2026-09-11 09:30",
      }),
    };
  });

  return result;
}

/* =========================
   维修飞机初始数据
========================= */

function createMaintenanceAircraft(): Record<
  string,
  Aircraft
> {
  const result: Record<string, Aircraft> = {};

  initialMaintenanceStandSeeds.forEach(
    (stand, index) => {
      if (!stand.aircraftId) {
        return;
      }

      const aircraftId = stand.aircraftId;
      const risk =
        getAircraftRisk(aircraftId);

      const maintenanceType: MaintenanceType =
        stand.apronId === "MA"
          ? "大型维修"
          : "小型维修";

      result[aircraftId] = {
        id: aircraftId,
        model: getAircraftModel(aircraftId),

        status: "维修中",
        risk,

        currentStandId: stand.id,

        flightHours:
          7600 + (index + 1) * 93,

        remainingFlightHours: 0,

        faultType:
          risk === "高"
            ? "关键部件故障"
            : risk === "中"
              ? "系统参数异常"
              : "计划维修",

        maintenanceType,

        description:
          stand.apronId === "MA"
            ? "飞机正在MA大型维修机坪执行维修任务。"
            : "飞机正在MB小型维修机坪执行航线维修任务。",
      healthProfile: createAssumedAircraftHealthProfile({
        aircraftId,
        flightHours: 7600 + (index + 1) * 93,
        remainingFlightHours: 0,
        asOf: "2026-09-11 09:30",
      }),
      };
    },
  );

  return result;
}

/* =========================
   初始维修任务
========================= */

function createInitialMaintenanceTasks(): MaintenanceTask[] {
  return initialMaintenanceStandSeeds
    .filter(
      (stand) =>
        stand.aircraftId !== null,
    )
    .map((stand, index) => {
      const maintenanceType: MaintenanceType =
        stand.apronId === "MA"
          ? "大型维修"
          : "小型维修";

      return {
        id: `TASK-${String(
          index + 1,
        ).padStart(3, "0")}`,

        aircraftId:
          stand.aircraftId ?? "B-000",

        /*
         * 这些属于页面加载前已经存在的任务，
         * 因此原机位标记为INITIAL。
         */
        sourceStandId: "INITIAL",
        targetStandId: stand.id,
        targetApron: stand.apronId,

        maintenanceType,

        priority:
          getAircraftRisk(
            stand.aircraftId ?? "",
          ) === "高"
            ? "紧急"
            : "普通",

        status: "维修中",

        progress: Math.min(
          0.9,
          0.3 + (index % 5) * 0.1,
        ),

        estimatedHours:
          stand.apronId === "MA"
            ? 12
            : 4,

        requiredPersonnel:
          stand.apronId === "MA"
            ? 4
            : 2,

        requiredEquipment:
          stand.apronId === "MA"
            ? 2
            : 1,

        requiredParts:
          stand.apronId === "MA"
            ? ["大型部件维修工具"]
            : ["航线维修工具"],

        createdAt:
          "2026-09-11 08:00",

        startedAt:
          "2026-09-11 08:30",

        completedAt: null,
      };
    });
}

/* =========================
   生成统一初始状态
========================= */

const regularStands =
  createRegularRuntimeStands();

const maintenanceStands =
  createMaintenanceRuntimeStands();

const regularAircraft =
  createRegularAircraft();

const maintenanceAircraft =
  createMaintenanceAircraft();

const allStands: Record<string, RuntimeStand> = {
  ...regularStands,
  ...maintenanceStands,
};

const allAircraft: Record<string, Aircraft> = {
  ...regularAircraft,
  ...maintenanceAircraft,
};

/**
 * 根据飞机当前机位生成初始地图位置。
 *
 * 后续接入真实经纬度时，只需要替换这些位置数据，
 * 飞机、维修任务和路径规划结构不用推倒重做。
 */
function createInitialAircraftPositions(): Record<
  string,
  AircraftPosition
> {
  const positions: Record<
    string,
    AircraftPosition
  > = {};

  Object.values(allAircraft).forEach(
    (aircraft) => {
      if (!aircraft.currentStandId) {
        return;
      }

      const stand =
        allStands[
          aircraft.currentStandId
        ];

      if (!stand) {
        return;
      }

      const resolvedPosition = stand.operationalPosition
        ? activeAirportPositionProjector.projectWgs84(
            stand.operationalPosition.wgs84,
            "wgs84_configuration",
          )
        : activeAirportPositionProjector.projectMapPoint(stand.position);

      positions[aircraft.id] = {
        ...resolvedPosition,
        aircraftId: aircraft.id,

        heading: stand.heading,
        groundSpeed: 0,

        timestamp:
          "2026-09-11 09:30",

        source: "stand",
      };
    },
  );

  return positions;
}

const georeferencedInitialSupportBases: AirportState["groundSupport"]["bases"] =
  Object.fromEntries(
    Object.entries(initialGroundSupportState.bases).map(([baseId, base]) => {
      const wgs84 = resolveSupportBaseWgs84Coordinate(
        baseId,
        xiaoshanGeospatialIntegration.features,
        xiaoshanSupportBaseGeospatialBindings,
      );
      return [
        baseId,
        {
          ...base,
          operationalPosition: wgs84
            ? activeAirportPositionProjector.projectWgs84(
                wgs84,
                "wgs84_configuration",
              ).operationalPosition
            : null,
        },
      ];
    }),
  ) as AirportState["groundSupport"]["bases"];

const georeferencedInitialGroundSupportState: AirportState["groundSupport"] = {
  ...initialGroundSupportState,
  bases: georeferencedInitialSupportBases,
  parkingSpots: Object.fromEntries(
    Object.entries(initialGroundSupportState.parkingSpots).map(
      ([parkingSpotId, parkingSpot]) => {
        const basePosition =
          georeferencedInitialSupportBases[parkingSpot.baseId]
            .operationalPosition;
        return [
          parkingSpotId,
          {
            ...parkingSpot,
            operationalPosition: basePosition,
            geospatialReadiness: basePosition
              ? "base_anchor" as const
              : "unmapped" as const,
          },
        ];
      },
    ),
  ),
  waitingAreas: Object.fromEntries(
    Object.entries(initialGroundSupportState.waitingAreas).map(
      ([waitingAreaId, waitingArea]) => {
        const wgs84 = resolveSupportWaitingAreaWgs84Coordinate(
          waitingAreaId,
          xiaoshanGeospatialIntegration.features,
          xiaoshanSupportWaitingAreaGeospatialBindings,
        );
        return [
          waitingAreaId,
          {
            ...waitingArea,
            operationalPosition: wgs84
              ? activeAirportPositionProjector.projectWgs84(
                  wgs84,
                  "wgs84_configuration",
                ).operationalPosition
              : null,
            geospatialReadiness: wgs84
              ? "ready" as const
              : "unmapped" as const,
          },
        ];
      },
    ),
  ),
  equipment: Object.fromEntries(
    Object.entries(initialGroundSupportState.equipment).map(
      ([equipmentId, equipment]) => {
        const parkingPosition = equipment.currentParkingSpotId
          ? initialGroundSupportState.parkingSpots[
              equipment.currentParkingSpotId
            ]
          : null;
        const basePosition = parkingPosition
          ? georeferencedInitialSupportBases[parkingPosition.baseId]
              .operationalPosition
          : georeferencedInitialSupportBases[equipment.homeBaseId]
              .operationalPosition;
        return [
          equipmentId,
          {
            ...equipment,
            geospatialReadiness: basePosition ? "ready" : "unmapped",
            position: basePosition
              ? activeAirportPositionProjector.projectWgs84(
                  basePosition.wgs84,
                  "wgs84_configuration",
                )
              : {
                  ...equipment.position,
                  latitude: null,
                  longitude: null,
                  eastMeters: null,
                  northMeters: null,
                  operationalPosition: null,
                },
          },
        ];
      },
    ),
  ),
};

const initialAirportStateCore: AirportState = {
  airportIdent: "ZSHC",

  aircraft: {
    ...regularAircraft,
    ...maintenanceAircraft,
  },

  stands: {
    ...regularStands,
    ...maintenanceStands,
  },

  maintenanceAprons: {
    MA: {
      id: "MA",
      name: "M-A大型维修停机坪",
      commandAliases: ["MA", "M-A", "大型维修区", "大型维修机坪"],
      dispatchPriority: {
        大型维修: 0,
        小型维修: 1,
        检查: 1,
      },
      tugCategoryPriority: ["heavy_tug"],
      capacity: 16,
      occupied: 4,
      supportedMaintenanceTypes: [
        "大型维修",
        "小型维修",
        "检查",
      ],
      availablePersonnel: 8,
      availableEquipment: 4,
    },

    MB: {
      id: "MB",
      name: "M-B小型维修停机坪",
      commandAliases: ["MB", "M-B", "小型维修区", "小型维修机坪"],
      dispatchPriority: {
        小型维修: 0,
        检查: 0,
      },
      tugCategoryPriority: ["standard_tug", "heavy_tug"],
      capacity: 12,
      occupied: 3,
      supportedMaintenanceTypes: [
        "小型维修",
        "检查",
      ],
      availablePersonnel: 6,
      availableEquipment: 5,
    },
  },

  maintenanceTasks:
    createInitialMaintenanceTasks(),

  pendingDecisions: [],

  pendingDecision: null,

  resources: {
    totalPersonnel: 36,
    availablePersonnel: 14,

    totalEquipment: 18,
    availableEquipment: 9,

    spareParts: [
      {
        id: "PART-IDG",
        name: "IDG组件",
        stock: 1,
        safetyStock: 3,
        unit: "套",
      },
      {
        id: "PART-AVIONICS",
        name: "航电测试模块",
        stock: 2,
        safetyStock: 4,
        unit: "套",
      },
      {
        id: "PART-HYDRAULIC",
        name: "液压泵组件",
        stock: 6,
        safetyStock: 3,
        unit: "套",
      },
      {
        id: "PART-BRAKE",
        name: "机轮刹车组件",
        stock: 8,
        safetyStock: 4,
        unit: "套",
      },
    ],
  },

  /*
   * 保留你已经加入的地面运行初始状态。
   */
  groundMovement: {
    ...initialGroundMovementState,
    nodes: activeAirportOperationsNetwork.taxiNetwork.nodes,
    edges: activeAirportOperationsNetwork.taxiNetwork.edges,
    restrictedZones:
      activeAirportOperationsNetwork.taxiNetwork.restrictedZones,
    aircraftPositions:
      createInitialAircraftPositions(),
  },

  /*
   * 新增：地面保障设备初始状态。
   */
  groundSupport: georeferencedInitialGroundSupportState,

  coordination: {
    clock: {
      mode: "simulation",
      currentTime: "2026-09-11 09:30",
      sequence: 0,
      speed: 1,
      status: "运行中",
    },
    agents: {},
    events: [],
    tasks: [],
  },

  operationLogs: [
    {
      id: "LOG-001",
      time: "2026-09-11 09:30",
      category: "状态变化",
      message:
        "机场动态运行状态初始化完成。",
      aircraftId: null,
      taskId: null,
    },
  ],
};

export const initialAirportState: AirportState = {
  ...initialAirportStateCore,
  coordination:
    createInitialCoordinationState(initialAirportStateCore),
};
