import type {
  GroundEquipmentCategory,
  GroundEquipmentCapability,
  GroundEquipmentStatus,
  GroundSupportEquipment,
  GroundSupportState,
  SupportBase,
  SupportBaseId,
  SupportParkingSpot,
  SupportWaitingArea,
} from "../types/groundSupport";

/* =========================
   仿真车辆待命点位置（内部继续使用旧基地编号）
========================= */

export const supportBases: SupportBase[] = [
  {
    id: "GSE-W",
    name: "西部车辆待命点（仿真规划）",

    operationalPosition: null,

    capacity: 18,

    serviceAreas: [
      "A",
      "B",
      "MA",
      "MB",
    ],

    description:
      "仿真规划待命点，主要调度重型牵引车、大型维修车辆、航材运输车辆和移动维修平台，不代表现实机场部门。",
  },
  {
    id: "GSE-C",
    name: "中央车辆待命点（仿真规划）",

    operationalPosition: null,

    capacity: 18,

    serviceAreas: [
      "A",
      "B",
      "C",
      "E",
      "MA",
      "MB",
    ],

    description:
      "仿真规划待命点，主要调度普通牵引车、电源车、快速维修车和引导车辆，不代表现实机场部门。",
  },
  {
    id: "GSE-E",
    name: "东部车辆待命点（仿真规划）",

    operationalPosition: null,

    capacity: 24,

    serviceAreas: [
      "C",
      "D",
      "E",
      "F",
      "G",
      "MA",
      "MB",
    ],

    description:
      "仿真规划待命点，为东侧指廊提供牵引、快速维修、航材运输和引导保障，不代表现实机场部门。",
  },
  {
    id: "FUEL",
    name: "航油车辆驻点",

    operationalPosition: null,

    capacity: 8,

    serviceAreas: [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "MA",
      "MB",
    ],

    description:
      "航油车辆专用驻点，与普通维修和牵引设备分开管理。",
  },
  {
    id: "ARFF",
    name: "消防救援车辆驻点",

    operationalPosition: null,

    capacity: 10,

    serviceAreas: [
      "RUNWAY-NORTH",
      "RUNWAY-SOUTH",
      "APRON",
    ],

    description:
      "停放消防、救援和应急指挥车辆，保留独立应急通道。",
  },
];

/* =========================
   作业等待区
========================= */

const commonWaitingCategories: GroundEquipmentCategory[] =
  [
    "standard_tug",
    "heavy_tug",
    "line_maintenance_vehicle",
    "parts_transport_vehicle",
    "mobile_platform",
    "ground_power_vehicle",
    "follow_me_vehicle",
  ];

export const supportWaitingAreas: SupportWaitingArea[] =
  [
    {
      id: "WAIT-A",
      name: "A区保障等待区",
      serviceAreaId: "A",
      operationalPosition: null,
      geospatialReadiness: "unmapped",
      capacity: 5,
      occupiedEquipmentIds: [],
      allowedCategories:
        commonWaitingCategories,
      description:
        "为A区机位提供保障服务的车辆临时等待区域。",
    },
    {
      id: "WAIT-B",
      name: "B区保障等待区",
      serviceAreaId: "B",
      operationalPosition: null,
      geospatialReadiness: "unmapped",
      capacity: 5,
      occupiedEquipmentIds: [],
      allowedCategories:
        commonWaitingCategories,
      description:
        "为B区机位提供保障服务的车辆临时等待区域。",
    },
    {
      id: "WAIT-C",
      name: "C区保障等待区",
      serviceAreaId: "C",
      operationalPosition: null,
      geospatialReadiness: "unmapped",
      capacity: 5,
      occupiedEquipmentIds: [],
      allowedCategories:
        commonWaitingCategories,
      description:
        "为C区机位提供保障服务的车辆临时等待区域。",
    },
    {
      id: "WAIT-D",
      name: "D区保障等待区",
      serviceAreaId: "D",
      operationalPosition: null,
      geospatialReadiness: "unmapped",
      capacity: 5,
      occupiedEquipmentIds: [],
      allowedCategories:
        commonWaitingCategories,
      description:
        "为D区机位提供保障服务的车辆临时等待区域。",
    },
    {
      id: "WAIT-E",
      name: "E区保障等待区",
      serviceAreaId: "E",
      operationalPosition: null,
      geospatialReadiness: "unmapped",
      capacity: 4,
      occupiedEquipmentIds: [],
      allowedCategories:
        commonWaitingCategories,
      description:
        "为E区机位提供保障服务的车辆临时等待区域。",
    },
    {
      id: "WAIT-F",
      name: "F区保障等待区",
      serviceAreaId: "F",
      operationalPosition: null,
      geospatialReadiness: "unmapped",
      capacity: 4,
      occupiedEquipmentIds: [],
      allowedCategories:
        commonWaitingCategories,
      description:
        "为F区机位提供保障服务的车辆临时等待区域。",
    },
    {
      id: "WAIT-G",
      name: "G区保障等待区",
      serviceAreaId: "G",
      operationalPosition: null,
      geospatialReadiness: "unmapped",
      capacity: 4,
      occupiedEquipmentIds: [],
      allowedCategories:
        commonWaitingCategories,
      description:
        "为G区卫星厅提供保障服务的车辆临时等待区域。",
    },
    {
      id: "WAIT-MA",
      name: "MA维修保障等待区",
      serviceAreaId: "MA",
      operationalPosition: null,
      geospatialReadiness: "unmapped",
      capacity: 6,
      occupiedEquipmentIds: [],
      allowedCategories: [
        "heavy_tug",
        "heavy_maintenance_vehicle",
        "parts_transport_vehicle",
        "mobile_platform",
      ],
      description:
        "大型维修车辆进入MA维修机位前的等待区域。",
    },
    {
      id: "WAIT-MB",
      name: "MB维修保障等待区",
      serviceAreaId: "MB",
      operationalPosition: null,
      geospatialReadiness: "unmapped",
      capacity: 5,
      occupiedEquipmentIds: [],
      allowedCategories: [
        "standard_tug",
        "line_maintenance_vehicle",
        "parts_transport_vehicle",
        "ground_power_vehicle",
      ],
      description:
        "小型维修车辆进入MB维修机位前的等待区域。",
    },
  ];

/* =========================
   停车位生成
========================= */

function createParkingSpotsForBase(
  base: SupportBase,
): SupportParkingSpot[] {
  return Array.from({ length: base.capacity }, (_, index) => ({
      id:
        `${base.id}-P-${String(
          index + 1,
        ).padStart(2, "0")}`,

      baseId: base.id,

      operationalPosition: null,
      geospatialReadiness: "unmapped",

      heading: 90,

      status: "空闲",
      equipmentId: null,

      allowedCategories: [],
    }));
}

const emptyParkingSpots =
  supportBases.flatMap(
    createParkingSpotsForBase,
  );

/* =========================
   设备批量生成
========================= */

type EquipmentBatch = {
  baseId: SupportBaseId;

  idPrefix: string;
  name: string;

  category:
    GroundEquipmentCategory;

  count: number;

  capability:
    GroundEquipmentCapability;
};

const allAircraftModels = [
  "A320neo",
  "A321",
  "B737-800",
  "B737 MAX 8",
  "A380",
];

const noMaintenanceCapability: GroundEquipmentCapability =
  {
    supportedAircraftModels: [],
    supportedMaintenanceTypes: [],
    maxTowWeightTons: null,

    canTowAircraft: false,
    canTransportParts: false,
    canPerformMaintenance: false,
  };

const equipmentBatches: EquipmentBatch[] = [
  // 西部基地
  {
    baseId: "GSE-W",
    idPrefix: "HT-W",
    name: "重型飞机牵引车",
    category: "heavy_tug",
    count: 4,
    capability: {
      supportedAircraftModels:
        allAircraftModels,
      supportedMaintenanceTypes: [],
      maxTowWeightTons: 260,
      canTowAircraft: true,
      canTransportParts: false,
      canPerformMaintenance: false,
    },
  },
  {
    baseId: "GSE-W",
    idPrefix: "HMV-W",
    name: "大型维修保障车",
    category:
      "heavy_maintenance_vehicle",
    count: 3,
    capability: {
      supportedAircraftModels:
        allAircraftModels,
      supportedMaintenanceTypes: [
        "大型维修",
        "小型维修",
        "检查",
      ],
      maxTowWeightTons: null,
      canTowAircraft: false,
      canTransportParts: false,
      canPerformMaintenance: true,
    },
  },
  {
    baseId: "GSE-W",
    idPrefix: "PT-W",
    name: "航材运输车",
    category:
      "parts_transport_vehicle",
    count: 3,
    capability: {
      ...noMaintenanceCapability,
      canTransportParts: true,
    },
  },
  {
    baseId: "GSE-W",
    idPrefix: "MP-W",
    name: "移动维修升降平台",
    category: "mobile_platform",
    count: 3,
    capability:
      noMaintenanceCapability,
  },

  // 中央基地
  {
    baseId: "GSE-C",
    idPrefix: "TUG-C",
    name: "普通飞机牵引车",
    category: "standard_tug",
    count: 5,
    capability: {
      supportedAircraftModels:
        allAircraftModels,
      supportedMaintenanceTypes: [],
      maxTowWeightTons: 110,
      canTowAircraft: true,
      canTransportParts: false,
      canPerformMaintenance: false,
    },
  },
  {
    baseId: "GSE-C",
    idPrefix: "LMV-C",
    name: "快速维修车",
    category:
      "line_maintenance_vehicle",
    count: 3,
    capability: {
      supportedAircraftModels:
        allAircraftModels,
      supportedMaintenanceTypes: [
        "小型维修",
        "检查",
      ],
      maxTowWeightTons: null,
      canTowAircraft: false,
      canTransportParts: false,
      canPerformMaintenance: true,
    },
  },
  {
    baseId: "GSE-C",
    idPrefix: "GPU-C",
    name: "地面电源车",
    category:
      "ground_power_vehicle",
    count: 4,
    capability:
      noMaintenanceCapability,
  },
  {
    baseId: "GSE-C",
    idPrefix: "FOLLOW-C",
    name: "航空器引导车",
    category: "follow_me_vehicle",
    count: 2,
    capability:
      noMaintenanceCapability,
  },

  // 东部基地
  {
    baseId: "GSE-E",
    idPrefix: "TUG-E",
    name: "普通飞机牵引车",
    category: "standard_tug",
    count: 5,
    capability: {
      supportedAircraftModels:
        allAircraftModels,
      supportedMaintenanceTypes: [],
      maxTowWeightTons: 110,
      canTowAircraft: true,
      canTransportParts: false,
      canPerformMaintenance: false,
    },
  },
  {
    baseId: "GSE-E",
    idPrefix: "LMV-E",
    name: "快速维修车",
    category:
      "line_maintenance_vehicle",
    count: 4,
    capability: {
      supportedAircraftModels:
        allAircraftModels,
      supportedMaintenanceTypes: [
        "小型维修",
        "检查",
      ],
      maxTowWeightTons: null,
      canTowAircraft: false,
      canTransportParts: false,
      canPerformMaintenance: true,
    },
  },
  {
    baseId: "GSE-E",
    idPrefix: "PT-E",
    name: "航材运输车",
    category:
      "parts_transport_vehicle",
    count: 3,
    capability: {
      ...noMaintenanceCapability,
      canTransportParts: true,
    },
  },
  {
    baseId: "GSE-E",
    idPrefix: "MP-E",
    name: "移动维修升降平台",
    category: "mobile_platform",
    count: 2,
    capability:
      noMaintenanceCapability,
  },
  {
    baseId: "GSE-E",
    idPrefix: "GPU-E",
    name: "地面电源车",
    category:
      "ground_power_vehicle",
    count: 3,
    capability:
      noMaintenanceCapability,
  },
  {
    baseId: "GSE-E",
    idPrefix: "FOLLOW-E",
    name: "航空器引导车",
    category: "follow_me_vehicle",
    count: 2,
    capability:
      noMaintenanceCapability,
  },

  // 航油驻点
  {
    baseId: "FUEL",
    idPrefix: "FUEL",
    name: "航空加油车",
    category: "fuel_vehicle",
    count: 6,
    capability:
      noMaintenanceCapability,
  },

  // 消防救援驻点
  {
    baseId: "ARFF",
    idPrefix: "ARFF",
    name: "航空消防救援车",
    category: "rescue_vehicle",
    count: 6,
    capability:
      noMaintenanceCapability,
  },
];

/* =========================
   设备和停车位绑定
========================= */

function getInitialEquipmentStatus(
  serial: number,
): GroundEquipmentStatus {
  if (serial % 17 === 0) {
    return "检修中";
  }

  if (serial % 13 === 0) {
    return "充电中";
  }

  return "可用";
}

function createEquipmentInventory(): GroundSupportEquipment[] {
  const equipment: GroundSupportEquipment[] =
    [];

  const baseSpotCounters: Record<
    SupportBaseId,
    number
  > = {
    "GSE-W": 0,
    "GSE-C": 0,
    "GSE-E": 0,
    FUEL: 0,
    ARFF: 0,
  };

  let globalSerial = 1;

  equipmentBatches.forEach((batch) => {
    for (
      let index = 0;
      index < batch.count;
      index += 1
    ) {
      const baseSpots =
        emptyParkingSpots.filter(
          (spot) =>
            spot.baseId ===
            batch.baseId,
        );

      const spotIndex =
        baseSpotCounters[
          batch.baseId
        ];

      const parkingSpot =
        baseSpots[spotIndex];

      baseSpotCounters[
        batch.baseId
      ] += 1;

      if (!parkingSpot) {
        continue;
      }

      const equipmentId =
        `${batch.idPrefix}-${String(
          index + 1,
        ).padStart(2, "0")}`;

      const status =
        getInitialEquipmentStatus(
          globalSerial,
        );

      equipment.push({
        id: equipmentId,
        name:
          `${batch.name}${index + 1}号`,

        category:
          batch.category,

        status,

        geospatialReadiness: "unmapped",

        homeBaseId:
          batch.baseId,

        currentParkingSpotId:
          parkingSpot.id,

        position: {
          x: 0,
          y: 0,
          latitude: null,
          longitude: null,
          eastMeters: null,
          northMeters: null,
          operationalPosition: null,
        },

        heading:
          parkingSpot.heading,

        speed: 0,

        energyPercent:
          Math.max(
            55,
            98 -
              (globalSerial % 9) *
                4,
          ),

        capability:
          batch.capability,

        currentTaskId: null,

        description:
          `${batch.name}当前停放在${batch.baseId}车辆驻点。`,
      });

      globalSerial += 1;
    }
  });

  return equipment;
}

export const groundSupportEquipment =
  createEquipmentInventory();

const equipmentByParkingSpot =
  new Map(
    groundSupportEquipment
      .filter(
        (item) =>
          item.currentParkingSpotId !==
          null,
      )
      .map((item) => [
        item.currentParkingSpotId,
        item.id,
      ]),
  );

export const supportParkingSpots:
  SupportParkingSpot[] =
  emptyParkingSpots.map((spot) => {
    const equipmentId =
      equipmentByParkingSpot.get(
        spot.id,
      );

    return {
      ...spot,

      status: equipmentId
        ? "占用"
        : "空闲",

      equipmentId:
        equipmentId ?? null,
    };
  });

/* =========================
   初始统一状态
========================= */

export const initialGroundSupportState:
  GroundSupportState = {
  bases: Object.fromEntries(
    supportBases.map((base) => [
      base.id,
      base,
    ]),
  ) as Record<
    SupportBaseId,
    SupportBase
  >,

  parkingSpots:
    Object.fromEntries(
      supportParkingSpots.map(
        (spot) => [
          spot.id,
          spot,
        ],
      ),
    ),

  waitingAreas:
    Object.fromEntries(
      supportWaitingAreas.map(
        (area) => [
          area.id,
          area,
        ],
      ),
    ),

  equipment:
    Object.fromEntries(
      groundSupportEquipment.map(
        (item) => [
          item.id,
          item,
        ],
      ),
    ),

  tasks: [],

  activeTaskId: null,

  vehicleRoutes: [],

  activeVehicleRouteId: null,

  showAllEquipment: false,
};
