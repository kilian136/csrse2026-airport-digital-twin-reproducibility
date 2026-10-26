import type {
  GroundMovementState,
  RestrictedZone,
  TaxiEdge,
  TaxiNode,
} from "../types/airport";

export const AIRPORT_NETWORK_VERSION = "0.3.0";

function createEdge(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  distance: number,
  options?: Partial<TaxiEdge>,
): TaxiEdge {
  return {
    id,
    fromNodeId,
    toNodeId,
    distance,
    bidirectional: true,
    status: "open",
    speedLimit: 15,
    requiresClearance: true,
    crossesRunway: false,
    allowedModes: ["tow", "taxi"],
    /*
     * 公共滑行通道细分为60米交通块：保障车辆只占自身附近的块，
     * 飞机则凭借更长的车体与前视距离连续占用多个块。
     */
    trafficBlockLengthMeters: 60,
    trafficFlowMode: "single_lane",
    ...options,
  };
}

export const taxiNodes: TaxiNode[] = [
  // ============================================================
  // 维修区出口
  // ============================================================

  {
    id: "MA-EXIT",
    name: "MA大型维修机坪出口",
    type: "maintenance_entry",
    areaId: "MA",
    x: 19.7,
    y: 19.2,
    heading: 90,
  },
  {
    id: "MB-EXIT",
    name: "MB小型维修机坪出口",
    type: "maintenance_entry",
    areaId: "MB",
    x: 28.2,
    y: 22.8,
    heading: 90,
  },

  // ============================================================
  // 北侧滑行主干
  // ============================================================

  {
    id: "N-WEST",
    name: "北侧西部滑行节点",
    type: "intersection",
    areaId: "NORTH",
    x: 29.2,
    y: 14.5,
  },
  {
    id: "N-A",
    name: "A区北侧汇入点",
    type: "intersection",
    areaId: "NORTH",
    x: 37.8,
    y: 14.5,
  },
  {
    id: "N-B",
    name: "B区北侧汇入点",
    type: "intersection",
    areaId: "NORTH",
    x: 45.4,
    y: 14.5,
  },
  {
    id: "N-C",
    name: "C区北侧汇入点",
    type: "intersection",
    areaId: "NORTH",
    x: 51.8,
    y: 14.5,
  },
  {
    id: "N-EAST",
    name: "北侧东部滑行节点",
    type: "intersection",
    areaId: "NORTH",
    x: 64.7,
    y: 14.5,
  },

  // ============================================================
  // A～C 区域出口
  // 这是区域汇总出口，之后再连接每个具体停机位
  // ============================================================

  {
    id: "A-EXIT",
    name: "A区机坪出口",
    type: "stand_exit",
    areaId: "A",
    x: 37.8,
    y: 20.4,
    heading: 180,
  },
  {
    id: "B-EXIT",
    name: "B区机坪出口",
    type: "stand_exit",
    areaId: "B",
    x: 45.4,
    y: 20.4,
    heading: 180,
  },
  {
    id: "C-EXIT",
    name: "C区机坪出口",
    type: "stand_exit",
    areaId: "C",
    x: 51.8,
    y: 20.4,
    heading: 180,
  },

  // ============================================================
  // 东侧主干和 D～G 区域出口
  // ============================================================

  {
    id: "EAST-D",
    name: "D区东侧滑行节点",
    type: "intersection",
    areaId: "EAST",
    x: 64.7,
    y: 25,
  },
  {
    id: "D-EXIT",
    name: "D区机坪出口",
    type: "stand_exit",
    areaId: "D",
    x: 62.6,
    y: 25,
    heading: 90,
  },

  {
    id: "EAST-E",
    name: "E区东侧滑行节点",
    type: "intersection",
    areaId: "EAST",
    x: 64.7,
    y: 48,
  },
  {
    id: "E-EXIT",
    name: "E区机坪出口",
    type: "stand_exit",
    areaId: "E",
    x: 62.5,
    y: 48,
    heading: 90,
  },

  {
    id: "EAST-F",
    name: "F区东侧滑行节点",
    type: "intersection",
    areaId: "EAST",
    x: 64.7,
    y: 62.5,
  },
  {
    id: "F-EXIT",
    name: "F区机坪出口",
    type: "stand_exit",
    areaId: "F",
    x: 60,
    y: 62.5,
    heading: 90,
  },

  {
    id: "EAST-G",
    name: "G区东侧滑行节点",
    type: "intersection",
    areaId: "EAST",
    x: 64.7,
    y: 78,
  },
  {
    id: "G-EXIT",
    name: "G区机坪出口",
    type: "stand_exit",
    areaId: "G",
    x: 60.2,
    y: 78,
    heading: 90,
  },

  {
    id: "E-SOUTH",
    name: "东南滑行节点",
    type: "intersection",
    areaId: "SOUTH",
    x: 64.7,
    y: 85,
  },

  // ============================================================
  // 南侧滑行主干
  // ============================================================

  {
    id: "S-EAST",
    name: "南侧滑行道东段",
    type: "taxiway",
    areaId: "SOUTH",
    x: 57,
    y: 85,
  },
  {
    id: "S-CENTER",
    name: "南侧滑行道中段",
    type: "intersection",
    areaId: "SOUTH",
    x: 48,
    y: 85,
  },
  {
    id: "S-WEST",
    name: "南侧滑行道西段",
    type: "taxiway",
    areaId: "SOUTH",
    x: 37,
    y: 85,
  },

  // ============================================================
  // 跑道等待点
  // ============================================================

  {
    id: "RWY-N-HOLD-W",
    name: "北跑道西等待点",
    type: "holding_point",
    areaId: "RWY-NORTH",
    x: 29.2,
    y: 9.6,
  },
  {
    id: "RWY-N-HOLD-E",
    name: "北跑道东等待点",
    type: "holding_point",
    areaId: "RWY-NORTH",
    x: 64.7,
    y: 9.6,
  },
  {
    id: "RWY-S-HOLD-W",
    name: "南跑道西等待点",
    type: "holding_point",
    areaId: "RWY-SOUTH",
    x: 37,
    y: 90.3,
  },
  {
    id: "RWY-S-HOLD-E",
    name: "南跑道东等待点",
    type: "holding_point",
    areaId: "RWY-SOUTH",
    x: 64.7,
    y: 90.3,
  },
  {
    id: "RWY-N-ENTRY-W",
    name: "北跑道西入口",
    type: "runway_entry",
    areaId: "RWY-NORTH",
    x: 29.2,
    y: 5.4,
  },
  {
    id: "RWY-N-ENTRY-E",
    name: "北跑道东入口",
    type: "runway_entry",
    areaId: "RWY-NORTH",
    x: 64.7,
    y: 5.4,
  },
  {
    id: "RWY-S-ENTRY-W",
    name: "南跑道西入口",
    type: "runway_entry",
    areaId: "RWY-SOUTH",
    x: 37,
    y: 95.2,
  },
  {
    id: "RWY-S-ENTRY-E",
    name: "南跑道东入口",
    type: "runway_entry",
    areaId: "RWY-SOUTH",
    x: 64.7,
    y: 95.2,
  },
];

export const taxiEdges: TaxiEdge[] = [
  // ============================================================
  // 维修区接入北侧主干
  // ============================================================

  createEdge(
    "EDGE-MA-NW",
    "MA-EXIT",
    "N-WEST",
    720,
    {
      speedLimit: 10,
      allowedModes: ["tow"],
    },
  ),
  createEdge(
    "EDGE-MB-NW",
    "MB-EXIT",
    "N-WEST",
    510,
    {
      speedLimit: 10,
      allowedModes: ["tow"],
    },
  ),

  // ============================================================
  // 北侧主干
  // ============================================================

  createEdge(
    "EDGE-NW-NA",
    "N-WEST",
    "N-A",
    620,
  ),
  createEdge(
    "EDGE-NA-NB",
    "N-A",
    "N-B",
    550,
  ),
  createEdge(
    "EDGE-NB-NC",
    "N-B",
    "N-C",
    470,
  ),
  createEdge(
    "EDGE-NC-NE",
    "N-C",
    "N-EAST",
    940,
  ),

  // A～C 区出口接入
  createEdge(
    "EDGE-A-EXIT",
    "A-EXIT",
    "N-A",
    430,
    {
      speedLimit: 10,
    },
  ),
  createEdge(
    "EDGE-B-EXIT",
    "B-EXIT",
    "N-B",
    430,
    {
      speedLimit: 10,
    },
  ),
  createEdge(
    "EDGE-C-EXIT",
    "C-EXIT",
    "N-C",
    430,
    {
      speedLimit: 10,
    },
  ),

  // ============================================================
  // 东侧主干
  // ============================================================

  createEdge(
    "EDGE-NE-ED",
    "N-EAST",
    "EAST-D",
    760,
  ),
  createEdge(
    "EDGE-ED-EE",
    "EAST-D",
    "EAST-E",
    980,
  ),
  createEdge(
    "EDGE-EE-EF",
    "EAST-E",
    "EAST-F",
    650,
  ),
  createEdge(
    "EDGE-EF-EG",
    "EAST-F",
    "EAST-G",
    690,
  ),
  createEdge(
    "EDGE-EG-ES",
    "EAST-G",
    "E-SOUTH",
    350,
  ),

  // D～G 区出口接入
  createEdge(
    "EDGE-D-EXIT",
    "D-EXIT",
    "EAST-D",
    190,
    {
      speedLimit: 10,
    },
  ),
  createEdge(
    "EDGE-E-EXIT",
    "E-EXIT",
    "EAST-E",
    190,
    {
      speedLimit: 10,
    },
  ),
  createEdge(
    "EDGE-F-EXIT",
    "F-EXIT",
    "EAST-F",
    360,
    {
      speedLimit: 10,
    },
  ),
  createEdge(
    "EDGE-G-EXIT",
    "G-EXIT",
    "EAST-G",
    340,
    {
      speedLimit: 10,
    },
  ),

  // ============================================================
  // 南侧主干
  // ============================================================

  createEdge(
    "EDGE-ES-SE",
    "E-SOUTH",
    "S-EAST",
    560,
  ),
  createEdge(
    "EDGE-SE-SC",
    "S-EAST",
    "S-CENTER",
    690,
  ),
  createEdge(
    "EDGE-SC-SW",
    "S-CENTER",
    "S-WEST",
    830,
  ),

  // ============================================================
  // 跑道等待点
  // 普通维修转运只允许到达等待点，不能进入跑道
  // ============================================================

  createEdge(
    "EDGE-NW-RNW",
    "N-WEST",
    "RWY-N-HOLD-W",
    350,
    {
      speedLimit: 10,
      requiresClearance: true,
    },
  ),
  createEdge(
    "EDGE-NE-RNE",
    "N-EAST",
    "RWY-N-HOLD-E",
    350,
    {
      speedLimit: 10,
      requiresClearance: true,
    },
  ),
  createEdge(
    "EDGE-SW-RSW",
    "S-WEST",
    "RWY-S-HOLD-W",
    350,
    {
      speedLimit: 10,
      requiresClearance: true,
    },
  ),
  createEdge(
    "EDGE-ES-RSE",
    "E-SOUTH",
    "RWY-S-HOLD-E",
    350,
    {
      speedLimit: 10,
      requiresClearance: true,
    },
  ),
  createEdge(
    "EDGE-RNW-RUNWAY-N-W",
    "RWY-N-HOLD-W",
    "RWY-N-ENTRY-W",
    180,
    {
      speedLimit: 8,
      crossesRunway: true,
      requiresClearance: true,
      trafficFlowMode: "single_lane",
    },
  ),
  createEdge(
    "EDGE-RNE-RUNWAY-N-E",
    "RWY-N-HOLD-E",
    "RWY-N-ENTRY-E",
    180,
    {
      speedLimit: 8,
      crossesRunway: true,
      requiresClearance: true,
      trafficFlowMode: "single_lane",
    },
  ),
  createEdge(
    "EDGE-RSW-RUNWAY-S-W",
    "RWY-S-HOLD-W",
    "RWY-S-ENTRY-W",
    180,
    {
      speedLimit: 8,
      crossesRunway: true,
      requiresClearance: true,
      trafficFlowMode: "single_lane",
    },
  ),
  createEdge(
    "EDGE-RSE-RUNWAY-S-E",
    "RWY-S-HOLD-E",
    "RWY-S-ENTRY-E",
    180,
    {
      speedLimit: 8,
      crossesRunway: true,
      requiresClearance: true,
      trafficFlowMode: "single_lane",
    },
  ),
];

type ParallelCorridorConfig = {
  id: "NORTH" | "EAST" | "SOUTH";
  nodeIds: string[];
  edgeIds: string[];
  offsetX: number;
  offsetY: number;
};

/**
 * 在已经确认具备宽度的主干通道上生成三条独立路线。
 * 原路线保留为 center，并在每个既有节点通过短汇入段连接 upper/lower。
 * 这样支路仍是单线瓶颈，而主干可以让最多三条互不冲突的路线并行。
 */
function addParallelCorridor(config: ParallelCorridorConfig) {
  const baseNodes = config.nodeIds
    .map((nodeId) => taxiNodes.find((node) => node.id === nodeId))
    .filter((node): node is TaxiNode => Boolean(node));

  config.edgeIds.forEach((edgeId) => {
    const edge = taxiEdges.find((item) => item.id === edgeId);
    if (!edge) return;
    edge.parallelLane = "center";
    edge.parallelCorridorId = config.id;
  });

  (["upper", "lower"] as const).forEach((lane) => {
    const direction = lane === "upper" ? -1 : 1;
    const laneNodeIds = baseNodes.map((baseNode) => {
      const laneNodeId = `${config.id}-${lane.toUpperCase()}-${baseNode.id}`;
      taxiNodes.push({
        ...baseNode,
        id: laneNodeId,
        name: `${baseNode.name}·${lane === "upper" ? "上行并行道" : "下行并行道"}`,
        type: "taxiway",
        x: baseNode.x + config.offsetX * direction,
        y: baseNode.y + config.offsetY * direction,
      });
      taxiEdges.push(
        createEdge(
          `EDGE-${config.id}-${lane.toUpperCase()}-MERGE-${baseNode.id}`,
          baseNode.id,
          laneNodeId,
          45,
          {
            speedLimit: 8,
            trafficBlockLengthMeters: 45,
          },
        ),
      );
      return laneNodeId;
    });

    config.edgeIds.forEach((baseEdgeId, index) => {
      const baseEdge = taxiEdges.find((edge) => edge.id === baseEdgeId);
      const fromNodeId = laneNodeIds[index];
      const toNodeId = laneNodeIds[index + 1];
      if (!baseEdge || !fromNodeId || !toNodeId) return;
      taxiEdges.push(
        createEdge(
          `EDGE-${config.id}-${lane.toUpperCase()}-${index + 1}`,
          fromNodeId,
          toNodeId,
          baseEdge.distance,
          {
            speedLimit: baseEdge.speedLimit,
            trafficBlockLengthMeters: baseEdge.trafficBlockLengthMeters,
            trafficFlowMode: "single_lane",
            parallelLane: lane,
            parallelCorridorId: config.id,
          },
        ),
      );
    });
  });
}

addParallelCorridor({
  id: "NORTH",
  nodeIds: ["N-WEST", "N-A", "N-B", "N-C", "N-EAST"],
  edgeIds: ["EDGE-NW-NA", "EDGE-NA-NB", "EDGE-NB-NC", "EDGE-NC-NE"],
  offsetX: 0,
  offsetY: 0.72,
});

addParallelCorridor({
  id: "EAST",
  nodeIds: ["N-EAST", "EAST-D", "EAST-E", "EAST-F", "EAST-G", "E-SOUTH"],
  edgeIds: ["EDGE-NE-ED", "EDGE-ED-EE", "EDGE-EE-EF", "EDGE-EF-EG", "EDGE-EG-ES"],
  offsetX: 0.72,
  offsetY: 0,
});

addParallelCorridor({
  id: "SOUTH",
  nodeIds: ["E-SOUTH", "S-EAST", "S-CENTER", "S-WEST"],
  edgeIds: ["EDGE-ES-SE", "EDGE-SE-SC", "EDGE-SC-SW"],
  offsetX: 0,
  offsetY: 0.72,
});

export const restrictedZones: RestrictedZone[] = [
  {
    id: "RUNWAY-NORTH-RESTRICTED",
    name: "北侧起降跑道保护区",
    type: "runway_protection",
    polygon: [
      { x: 19.8, y: 0.2 },
      { x: 80.7, y: 0.2 },
      { x: 80.7, y: 7.2 },
      { x: 19.8, y: 7.2 },
    ],
    active: true,
    blocksRoute: true,
    requiresSpecialClearance: true,
    description:
      "起降任务专用区域，普通地面维修转运任务禁止进入。",
  },
  {
    id: "RUNWAY-SOUTH-RESTRICTED",
    name: "南侧起降跑道保护区",
    type: "runway_protection",
    polygon: [
      { x: 19.8, y: 93 },
      { x: 80.7, y: 93 },
      { x: 80.7, y: 99.8 },
      { x: 19.8, y: 99.8 },
    ],
    active: true,
    blocksRoute: true,
    requiresSpecialClearance: true,
    description:
      "起降任务专用区域，普通地面维修转运任务禁止进入。",
  },
];

export const initialGroundMovementState: GroundMovementState = {
  aircraftPositions: {},

  nodes: taxiNodes,
  edges: taxiEdges,
  restrictedZones,

  tasks: [],
  routes: [],

  runwayStopBars: {
    "STOPBAR-RWY-N-W": {
      id: "STOPBAR-RWY-N-W",
      runwayId: "RWY-NORTH",
      holdingNodeId: "RWY-N-HOLD-W",
      status: "lit",
      updatedAt: null,
      updatedBy: null,
    },
    "STOPBAR-RWY-N-E": {
      id: "STOPBAR-RWY-N-E",
      runwayId: "RWY-NORTH",
      holdingNodeId: "RWY-N-HOLD-E",
      status: "lit",
      updatedAt: null,
      updatedBy: null,
    },
    "STOPBAR-RWY-S-W": {
      id: "STOPBAR-RWY-S-W",
      runwayId: "RWY-SOUTH",
      holdingNodeId: "RWY-S-HOLD-W",
      status: "lit",
      updatedAt: null,
      updatedBy: null,
    },
    "STOPBAR-RWY-S-E": {
      id: "STOPBAR-RWY-S-E",
      runwayId: "RWY-SOUTH",
      holdingNodeId: "RWY-S-HOLD-E",
      status: "lit",
      updatedAt: null,
      updatedBy: null,
    },
  },
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

  debugLayerVisible: true,
};
