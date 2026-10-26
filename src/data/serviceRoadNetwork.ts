import type {
  GroundEquipmentCategory,
  ServiceRoadEdge,
  ServiceRoadNode,
  SupportBaseId,
} from "../domain/groundSupport";

export type {
  ServiceRoadEdge,
  ServiceRoadEdgeStatus,
  ServiceRoadNode,
  ServiceRoadNodeType,
} from "../domain/groundSupport";

/* =========================
   通用车辆类型
========================= */

const allVehicleCategories:
  GroundEquipmentCategory[] = [
  "standard_tug",
  "heavy_tug",
  "line_maintenance_vehicle",
  "heavy_maintenance_vehicle",
  "parts_transport_vehicle",
  "mobile_platform",
  "ground_power_vehicle",
  "follow_me_vehicle",
  "inspection_vehicle",
  "fuel_vehicle",
  "rescue_vehicle",
];

/* =========================
   节点
========================= */

export const serviceRoadNodes:
  ServiceRoadNode[] = [
  // 保障基地
  {
    id: "BASE-GSE-W",
    name: "西部车辆待命点内部汇合点",
    type: "support_base",
    x: 23,
    y: 37.5,
    baseId: "GSE-W",
    serviceAreaId: null,
  },
  {
    id: "BASE-GSE-W-NORTH-GATE",
    name: "西部车辆待命点北侧道路闸口",
    type: "intersection",
    x: 23,
    y: 31,
    baseId: "GSE-W",
    serviceAreaId: null,
  },
  {
    id: "BASE-GSE-C",
    name: "中央车辆待命点出口",
    type: "support_base",
    x: 48,
    y: 66,
    baseId: "GSE-C",
    serviceAreaId: null,
  },
  {
    id: "BASE-GSE-E",
    name: "东部车辆待命点出口",
    type: "support_base",
    x: 74,
    y: 54,
    baseId: "GSE-E",
    serviceAreaId: null,
  },
  {
    id: "BASE-FUEL",
    name: "航油车辆驻点出口",
    type: "support_base",
    x: 14,
    y: 71,
    baseId: "FUEL",
    serviceAreaId: null,
  },
  {
    id: "BASE-ARFF",
    name: "消防救援驻点出口",
    type: "support_base",
    x: 85,
    y: 69,
    baseId: "ARFF",
    serviceAreaId: null,
  },

  // 西侧及北部服务道路
  {
    id: "SR-WEST-MAINT",
    name: "西侧维修保障路口",
    type: "intersection",
    x: 29,
    y: 31,
    baseId: null,
    serviceAreaId: null,
  },
  {
    id: "SR-MAINT-GATE",
    name: "维修机坪南侧共用闸口",
    type: "intersection",
    x: 29,
    y: 27,
    baseId: null,
    serviceAreaId: null,
  },
  {
    id: "SR-WEST-CENTER",
    name: "西侧中央保障路口",
    type: "intersection",
    x: 29,
    y: 42,
    baseId: null,
    serviceAreaId: null,
  },
  {
    id: "SR-A",
    name: "A区服务道路节点",
    type: "service_road",
    x: 34.2,
    y: 42,
    baseId: null,
    serviceAreaId: "A",
  },
  {
    id: "SR-B",
    name: "B区服务道路节点",
    type: "service_road",
    x: 42.2,
    y: 42,
    baseId: null,
    serviceAreaId: "B",
  },
  {
    id: "SR-C",
    name: "C区服务道路节点",
    type: "service_road",
    x: 54.5,
    y: 42,
    baseId: null,
    serviceAreaId: "C",
  },

  // 东侧纵向服务道路
  {
    id: "SR-EAST-D",
    name: "东侧D区服务道路节点",
    type: "intersection",
    x: 66,
    y: 35,
    baseId: null,
    serviceAreaId: "D",
  },
  {
    id: "SR-EAST-E",
    name: "东侧E区服务道路节点",
    type: "intersection",
    x: 66,
    y: 51,
    baseId: null,
    serviceAreaId: "E",
  },
  {
    id: "SR-EAST-F",
    name: "东侧F区服务道路节点",
    type: "intersection",
    x: 66,
    y: 65,
    baseId: null,
    serviceAreaId: "F",
  },
  {
    id: "SR-EAST-G",
    name: "东侧G区服务道路节点",
    type: "intersection",
    x: 66,
    y: 81,
    baseId: null,
    serviceAreaId: "G",
  },

  // 南侧服务道路
  {
    id: "SR-SOUTH-WEST",
    name: "南侧西部服务道路节点",
    type: "intersection",
    x: 29,
    y: 73,
    baseId: null,
    serviceAreaId: null,
  },
  {
    id: "SR-SOUTH-CENTER",
    name: "南侧中央服务道路节点",
    type: "intersection",
    x: 48,
    y: 73,
    baseId: null,
    serviceAreaId: null,
  },
  {
    id: "SR-SOUTH-EAST",
    name: "南侧东部服务道路节点",
    type: "intersection",
    x: 66,
    y: 73,
    baseId: null,
    serviceAreaId: null,
  },

  // 作业等待点
  {
    id: "WAIT-MA",
    name: "MA维修保障等待区",
    type: "waiting_area",
    x: 19.8,
    y: 27,
    baseId: null,
    serviceAreaId: "MA",
  },
  {
    id: "WAIT-MB",
    name: "MB维修保障等待区",
    type: "waiting_area",
    x: 28.4,
    y: 27,
    baseId: null,
    serviceAreaId: "MB",
  },
  {
    id: "WAIT-A",
    name: "A区保障等待区",
    type: "waiting_area",
    x: 34.2,
    y: 42,
    baseId: null,
    serviceAreaId: "A",
  },
  {
    id: "WAIT-B",
    name: "B区保障等待区",
    type: "waiting_area",
    x: 42.2,
    y: 42,
    baseId: null,
    serviceAreaId: "B",
  },
  {
    id: "WAIT-C",
    name: "C区保障等待区",
    type: "waiting_area",
    x: 54.5,
    y: 42,
    baseId: null,
    serviceAreaId: "C",
  },
  {
    id: "WAIT-D",
    name: "D区保障等待区",
    type: "waiting_area",
    x: 63,
    y: 35,
    baseId: null,
    serviceAreaId: "D",
  },
  {
    id: "WAIT-E",
    name: "E区保障等待区",
    type: "waiting_area",
    x: 63,
    y: 51,
    baseId: null,
    serviceAreaId: "E",
  },
  {
    id: "WAIT-F",
    name: "F区保障等待区",
    type: "waiting_area",
    x: 61.5,
    y: 65,
    baseId: null,
    serviceAreaId: "F",
  },
  {
    id: "WAIT-G",
    name: "G区保障等待区",
    type: "waiting_area",
    x: 61.5,
    y: 81,
    baseId: null,
    serviceAreaId: "G",
  },
];

/* =========================
   道路生成工具
========================= */

function findNode(
  nodeId: string,
): ServiceRoadNode {
  const node =
    serviceRoadNodes.find(
      (item) =>
        item.id === nodeId,
    );

  if (!node) {
    throw new Error(
      `服务道路节点不存在：${nodeId}`,
    );
  }

  return node;
}

function calculateDistance(
  fromNodeId: string,
  toNodeId: string,
): number {
  const fromNode =
    findNode(fromNodeId);

  const toNode =
    findNode(toNodeId);

  const deltaX =
    toNode.x - fromNode.x;

  const deltaY =
    toNode.y - fromNode.y;

  /*
   * 转换为近似米数。
   * 后期接入真实空间数据后替换。
   */
  return Math.round(
    Math.sqrt(
      deltaX * deltaX +
        deltaY * deltaY,
    ) * 65,
  );
}

function createServiceRoadEdge(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  options?: Partial<ServiceRoadEdge>,
): ServiceRoadEdge {
  return {
    id,
    fromNodeId,
    toNodeId,

    distance:
      calculateDistance(
        fromNodeId,
        toNodeId,
      ),

    bidirectional: true,
    status: "open",

    speedLimit: 25,
    requiresClearance: false,

    allowedCategories:
      allVehicleCategories,

    /* 主干保障道路按较短交通块管理，允许多车保持间距同行。 */
    trafficBlockLengthMeters: 35,
    trafficFlowMode: "separated_bidirectional",

    description:
      `${fromNodeId}至${toNodeId}保障车辆通道。`,

    ...options,
  };
}

/* =========================
   服务道路连线
========================= */

export const serviceRoadEdges:
  ServiceRoadEdge[] = [
  // 西部基地及维修区
  createServiceRoadEdge(
    "SR-EDGE-GSEW-NORTH-GATE",
    "BASE-GSE-W",
    "BASE-GSE-W-NORTH-GATE",
    {
      speedLimit: 10,
      requiresClearance: true,
      trafficFlowMode: "single_lane",
    },
  ),
  createServiceRoadEdge(
    "SR-EDGE-GSEW-WEST-MAINT",
    "BASE-GSE-W-NORTH-GATE",
    "SR-WEST-MAINT",
    {
      speedLimit: 10,
      requiresClearance: true,
      trafficFlowMode: "single_lane",
    },
  ),
  createServiceRoadEdge(
    "SR-EDGE-WEST-MAINT",
    "SR-WEST-CENTER",
    "SR-WEST-MAINT",
    {
      speedLimit: 15,
      requiresClearance: true,
    },
  ),
  createServiceRoadEdge(
    "SR-EDGE-MA-GATE",
    "WAIT-MA",
    "SR-MAINT-GATE",
    {
      speedLimit: 10,
      requiresClearance: true,
      trafficFlowMode: "single_lane",
    },
  ),
  createServiceRoadEdge(
    "SR-EDGE-MB-GATE",
    "WAIT-MB",
    "SR-MAINT-GATE",
    {
      speedLimit: 10,
      requiresClearance: true,
      trafficFlowMode: "single_lane",
    },
  ),
  createServiceRoadEdge(
    "SR-EDGE-MAINT-GATE",
    "SR-MAINT-GATE",
    "SR-WEST-MAINT",
    {
      speedLimit: 10,
      requiresClearance: true,
      trafficFlowMode: "single_lane",
    },
  ),

  // A、B、C区横向服务道路
  createServiceRoadEdge(
    "SR-EDGE-WEST-A",
    "SR-WEST-CENTER",
    "SR-A",
  ),
  createServiceRoadEdge(
    "SR-EDGE-A-B",
    "SR-A",
    "SR-B",
  ),
  createServiceRoadEdge(
    "SR-EDGE-B-C",
    "SR-B",
    "SR-C",
  ),

  createServiceRoadEdge(
    "SR-EDGE-WAIT-A",
    "SR-A",
    "WAIT-A",
    {
      speedLimit: 10,
      trafficFlowMode: "single_lane",
    },
  ),
  createServiceRoadEdge(
    "SR-EDGE-WAIT-B",
    "SR-B",
    "WAIT-B",
    {
      speedLimit: 10,
      trafficFlowMode: "single_lane",
    },
  ),
  createServiceRoadEdge(
    "SR-EDGE-WAIT-C",
    "SR-C",
    "WAIT-C",
    {
      speedLimit: 10,
      trafficFlowMode: "single_lane",
    },
  ),

  // C区连接东侧主干
  createServiceRoadEdge(
    "SR-EDGE-C-EAST-D",
    "SR-C",
    "SR-EAST-D",
  ),

  // 东侧D至G纵向道路
  createServiceRoadEdge(
    "SR-EDGE-D-E",
    "SR-EAST-D",
    "SR-EAST-E",
  ),
  createServiceRoadEdge(
    "SR-EDGE-E-F",
    "SR-EAST-E",
    "SR-EAST-F",
  ),
  createServiceRoadEdge(
    "SR-EDGE-F-SOUTH-EAST",
    "SR-EAST-F",
    "SR-SOUTH-EAST",
  ),
  createServiceRoadEdge(
    "SR-EDGE-SOUTH-EAST-G",
    "SR-SOUTH-EAST",
    "SR-EAST-G",
  ),

  // D至G等待点
  createServiceRoadEdge(
    "SR-EDGE-WAIT-D",
    "SR-EAST-D",
    "WAIT-D",
    {
      speedLimit: 10,
      trafficFlowMode: "single_lane",
    },
  ),
  createServiceRoadEdge(
    "SR-EDGE-WAIT-E",
    "SR-EAST-E",
    "WAIT-E",
    {
      speedLimit: 10,
      trafficFlowMode: "single_lane",
    },
  ),
  createServiceRoadEdge(
    "SR-EDGE-WAIT-F",
    "SR-EAST-F",
    "WAIT-F",
    {
      speedLimit: 10,
      trafficFlowMode: "single_lane",
    },
  ),
  createServiceRoadEdge(
    "SR-EDGE-WAIT-G",
    "SR-EAST-G",
    "WAIT-G",
    {
      speedLimit: 10,
      trafficFlowMode: "single_lane",
    },
  ),

  // 东部基地
  createServiceRoadEdge(
    "SR-EDGE-GSEE-EAST-E",
    "BASE-GSE-E",
    "SR-EAST-E",
    {
      trafficFlowMode: "single_lane",
    },
  ),

  // 南侧保障道路
  createServiceRoadEdge(
    "SR-EDGE-WEST-SOUTH",
    "SR-WEST-CENTER",
    "SR-SOUTH-WEST",
  ),
  createServiceRoadEdge(
    "SR-EDGE-SOUTH-WC",
    "SR-SOUTH-WEST",
    "SR-SOUTH-CENTER",
  ),
  createServiceRoadEdge(
    "SR-EDGE-SOUTH-CE",
    "SR-SOUTH-CENTER",
    "SR-SOUTH-EAST",
  ),

  // 中央基地
  createServiceRoadEdge(
    "SR-EDGE-GSEC-SOUTH",
    "BASE-GSE-C",
    "SR-SOUTH-CENTER",
    {
      trafficFlowMode: "single_lane",
    },
  ),

  // 航油驻点
  createServiceRoadEdge(
    "SR-EDGE-FUEL-SOUTH-W",
    "BASE-FUEL",
    "SR-SOUTH-WEST",
    {
      speedLimit: 20,
      trafficFlowMode: "single_lane",
    },
  ),

  // 消防救援驻点
  createServiceRoadEdge(
    "SR-EDGE-ARFF-SOUTH-E",
    "BASE-ARFF",
    "SR-SOUTH-EAST",
    {
      speedLimit: 35,
      trafficFlowMode: "single_lane",
    },
  ),
];

/* =========================
   基地与区域节点索引
========================= */

export const supportBaseNodeIds:
  Record<SupportBaseId, string> = {
  "GSE-W": "BASE-GSE-W",
  "GSE-C": "BASE-GSE-C",
  "GSE-E": "BASE-GSE-E",
  FUEL: "BASE-FUEL",
  ARFF: "BASE-ARFF",
};

export const supportAreaWaitingNodeIds:
  Record<string, string> = {
  A: "WAIT-A",
  B: "WAIT-B",
  C: "WAIT-C",
  D: "WAIT-D",
  E: "WAIT-E",
  F: "WAIT-F",
  G: "WAIT-G",
  MA: "WAIT-MA",
  MB: "WAIT-MB",
};
