import type { GroundSupportState } from "./groundSupport";
import type { CoordinationState } from "./coordination";
import type { AirportOperationalPosition } from "../domain/geo/operationalPosition";
import type { AircraftHealthProfile } from "../domain/aircraft/health";
/* =========================
   基础类型
========================= */

export type RiskLevel = "低" | "中" | "高";

export type AircraftStatus =
  | "可用"
  | "离场"
  | "过站保障"
  | "等待调度"
  | "转场中"
  | "维修中"
  | "维修完成"
  | "停飞";

export type StandStatus =
  | "空闲"
  | "占用"
  | "维修预留"
  | "调度预留";

export type StandKind =
  | "boarding"
  | "maintenance";

/**
 * 维修区域由机场配置包命名。共享业务代码不得假定MA、MB等具体编号。
 */
export type MaintenanceApronId = string;

export type MaintenanceType =
  | "大型维修"
  | "小型维修"
  | "检查"
  | "待判断";

export type MaintenancePriority =
  | "普通"
  | "优先"
  | "紧急";

export type MaintenanceTaskStatus =
  | "等待确认"
  | "等待执行"
  | "转场中"
  | "维修中"
  | "已完成"
  | "已取消";

export type RouteStatus =
  | "等待执行"
  | "移动中"
  | "已到达"
  | "已取消";

/* =========================
   地图坐标
========================= */

export type MapPosition = {
  x: number;
  y: number;
};

export type RoutePoint = MapPosition & {
  id: string;
  name: string;
};

/* =========================
   飞机
========================= */

export type Aircraft = {
  id: string;
  model: string;

  status: AircraftStatus;
  risk: RiskLevel;

  /*
   * 飞机当前所在的唯一机位。
   * 飞机转场时可以暂时为null。
   */
  currentStandId: string | null;

  flightHours: number;
  remainingFlightHours: number;

  faultType: string | null;
  maintenanceType: MaintenanceType | null;

  description: string;

  /** 地图、运行逻辑和仿真引擎共享的同一份逐机健康档案。 */
  healthProfile: AircraftHealthProfile;
};

/* =========================
   运行时停机位
========================= */

export type RuntimeStand = {
  id: string;

  /** 机场配置包定义的区域编号，共享逻辑只比较语义绑定，不解释具体名称。 */
  areaId: string;

  kind: StandKind;

  /**
   * candidate表示已进入机场资产清单但尚未获准自动分配；旧机场状态未配置时
   * 按active处理，以保持兼容。
   */
  operationalAvailability?: "active" | "candidate";

  position: MapPosition;
  /** 人工配置确认后的运行位置；未完成语义绑定时为null。 */
  operationalPosition: AirportOperationalPosition | null;
  heading: number;

  status: StandStatus;
  aircraftId: string | null;
  /** 调度预留的归属飞机；预留不等同于飞机已经停入该机位。 */
  reservationAircraftId?: string | null;

  /*
   * 维修机位能力。
   * 普通登机口停机位为null。
   */
  maintenanceCapability:
    | MaintenanceType[]
    | null;
};

/* =========================
   维修机坪
========================= */

export type MaintenanceApronState = {
  id: MaintenanceApronId;
  name: string;

  /** 自然语言指令可识别的机场专属别名。 */
  commandAliases: string[];

  /** 数字越小优先级越高；未配置表示不作为该维修类型的自动首选区。 */
  dispatchPriority: Partial<Record<MaintenanceType, number>>;

  /** 该区域的牵引车选择顺序，第一项为首选。 */
  tugCategoryPriority: ("standard_tug" | "heavy_tug")[];

  capacity: number;
  occupied: number;

  supportedMaintenanceTypes:
    MaintenanceType[];

  availablePersonnel: number;
  availableEquipment: number;
};

/* =========================
   维修资源
========================= */

export type SparePart = {
  id: string;
  name: string;

  stock: number;
  safetyStock: number;

  unit: string;
};

export type MaintenanceResources = {
  totalPersonnel: number;
  availablePersonnel: number;

  totalEquipment: number;
  availableEquipment: number;

  spareParts: SparePart[];
};

/* =========================
   维修决策方案
========================= */

export type MaintenanceDecision = {
  id: string;

  aircraftId: string;

  targetApron: MaintenanceApronId;
  targetStandId: string;

  maintenanceType: MaintenanceType;
  priority: MaintenancePriority;

  estimatedHours: number;
  requiredPersonnel: number;
  requiredEquipment: number;
  requiredParts: string[];

  reasons: string[];

  /*
   * true表示规则校验通过，
   * 可以等待用户确认。
   */
  executable: boolean;

  /*
   * 不可执行时保存原因。
   */
  blockingReasons: string[];
};

/* =========================
   维修任务
========================= */

export type MaintenanceTask = {
  id: string;

  aircraftId: string;

  sourceStandId: string;
  targetStandId: string;
  targetApron: MaintenanceApronId;

  maintenanceType: MaintenanceType;
  priority: MaintenancePriority;

  status: MaintenanceTaskStatus;

  /** 维修执行进度，范围0-1。 */
  progress: number;

  estimatedHours: number;
  requiredPersonnel: number;
  requiredEquipment: number;
  requiredParts: string[];

  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

/* =========================
   用户指令识别结果
========================= */

export type CommandAction =
  | "query"
  | "assign_maintenance"
  | "cancel_maintenance"
  | "confirm_decision"
  | "approve_route"
  | "reject_route"
  | "dispatch_tug"
  | "connect_tug"
  | "start_tow"
  | "disconnect_tug"
  | "start_maintenance"
  | "prepare_release"
  | "pause_workflow"
  | "resume_workflow"
  | "cancel_workflow"
  | "unknown";

export type ParsedCommand = {
  rawText: string;

  action: CommandAction;

  aircraftId: string | null;
  requestedApron: MaintenanceApronId | null;

  faultType: string | null;
  maintenanceType: MaintenanceType | null;

  /*
   * 指令信息不足时，用它保存需要追问的问题。
   */
  missingInformation: string[];
};

/* =========================
   操作日志
========================= */

export type OperationLog = {
  id: string;
  time: string;

  category:
    | "用户指令"
    | "智能决策"
    | "状态变化"
    | "异常提醒";

  message: string;

  aircraftId: string | null;
  taskId: string | null;
};

/* =========================
   机场统一状态
========================= */

export type AirportState = {
  /** 状态所属机场；用于阻止状态与另一机场的路网/策略交叉装配。 */
  airportIdent: string;

  aircraft: Record<string, Aircraft>;
  stands: Record<string, RuntimeStand>;

  maintenanceAprons: Record<
    MaintenanceApronId,
    MaintenanceApronState
  >;

  maintenanceTasks: MaintenanceTask[];

  /** 可同时等待确认的多架飞机维修方案。 */
  pendingDecisions: MaintenanceDecision[];

  /** 兼容旧界面的当前焦点方案。 */
  pendingDecision: MaintenanceDecision | null;

  resources: MaintenanceResources;

  operationLogs: OperationLog[];

  /** 多智能体共享事件账本、统一任务投影与模拟时钟。 */
  coordination: CoordinationState;

  /*
   * 飞机地面移动、路径规划和路线审批状态。
   */
  groundMovement: GroundMovementState;

  /*
   * 牵引车、维修车、设备基地和等待区状态。
   */
  groundSupport: GroundSupportState;
};

// ============================================================
// 地面运行与路径规划类型
// 第一阶段只定义数据结构，暂不改变现有维修业务逻辑
// ============================================================

/**
 * 地图上的二维坐标。
 * x、y 使用卫星地图中的百分比坐标，范围建议为 0～100。
 */
export type AirportMapPoint = {
  x: number;
  y: number;
};

/** 同时携带兼容视图、全球和机场局部坐标的位置。 */
export type AirportGeoreferencedPoint = AirportMapPoint & {
  latitude: number | null;
  longitude: number | null;
  eastMeters: number | null;
  northMeters: number | null;

  /**
   * 新版运行位置契约。非null时同时携带WGS84和机场局部米制坐标；
   * authority=legacy_projection仅用于兼容，不能驱动新版地图或运行决策。
   */
  operationalPosition: AirportOperationalPosition | null;
};

/**
 * 飞机位置数据的来源。
 *
 * stand：直接使用停机位坐标
 * simulation：前端模拟移动
 * telemetry：后台或真实经纬度数据
 */
export type PositionSource =
  | "stand"
  | "simulation"
  | "telemetry";

/**
 * 飞机当前地面位置。
 *
 * WGS84和机场局部米制坐标是新版运行权威。
 * x、y仅作为尚未迁移完成的兼容业务字段，不决定新版地图位置。
 */
export type AircraftPosition = AirportGeoreferencedPoint & {
  aircraftId: string;

  heading: number;
  groundSpeed: number;

  timestamp: string;
  source: PositionSource;
};

/**
 * 地面移动任务种类。
 */
export type GroundMissionType =
  | "maintenance_transfer"
  | "departure"
  | "arrival"
  | "stand_transfer";

/**
 * 飞机地面移动方式。
 *
 * tow：由牵引车牵引
 * taxi：飞机自主滑行
 */
export type GroundMovementMode =
  | "tow"
  | "taxi";

/**
 * 机场交通网络节点类型。
 */
export type TaxiNodeType =
  | "stand"
  | "stand_exit"
  | "taxiway"
  | "intersection"
  | "holding_point"
  | "runway_entry"
  | "runway_exit"
  | "maintenance_entry"
  | "maintenance_stand";

/**
 * 一条滑行道路的运行状态。
 */
export type TaxiEdgeStatus =
  | "open"
  | "closed"
  | "occupied"
  | "restricted";

/**
 * 机场路径规划节点。
 */
export type TaxiNode = {
  id: string;
  name: string;
  type: TaxiNodeType;

  x: number;
  y: number;

  /** 新版运行决策只读取此WGS84/局部米制位置；x/y仅供旧图投影。 */
  operationalPosition?: AirportOperationalPosition;

  /**
   * 节点所属区域。
   * 具体值由机场配置包定义，例如指廊区、维修区或滑行区编号。
   */
  areaId?: string;

  /**
   * 如果节点对应具体停机位，则填写停机位编号。
   */
  standId?: string;

  /**
   * 飞机经过节点时建议使用的机头方向。
   */
  heading?: number;
};

/**
 * 两个节点之间的一段可移动道路。
 */
export type TaxiEdge = {
  id: string;

  fromNodeId: string;
  toNodeId: string;

  /**
   * 路段长度，单位米。
   * 当前机场配置由节点的局部米制坐标自动派生。
   */
  distance: number;

  /**
   * 是否允许双向通行。
   */
  bidirectional: boolean;

  status: TaxiEdgeStatus;

  /**
   * 道路最高地面速度，单位 km/h。
   */
  speedLimit: number;

  /**
   * 是否需要地面管制许可。
   */
  requiresClearance: boolean;

  /**
   * 是否会穿越或进入跑道区域。
   */
  crossesRunway: boolean;

  /**
   * 允许的移动方式。
   */
  allowedModes: GroundMovementMode[];

  /**
   * 可选：允许通行的最大飞机等级。
   * 前期可以不填。
   */
  maxAircraftClass?: string;

  /**
   * 地面管制使用的交通块长度，单位为米。
   * 未填写时由交通协调器采用保守默认值。
   */
  trafficBlockLengthMeters?: number;

  /**
   * single_lane：同一时刻只允许一个方向获得该道路的方向锁。
   * separated_bidirectional：两个方向具有物理隔离通道，可分别放行。
   *
   * 一条普通滑行中心线应保持 single_lane；只有确认存在独立平行通道时
   * 才能配置为 separated_bidirectional。
   */
  trafficFlowMode?: "single_lane" | "separated_bidirectional";

  /**
   * 宽主干道上的并行通道。三条通道分别作为独立交通资源占用，
   * 支路和机位口仍通过中心汇入节点进入主干。
   */
  parallelLane?: "upper" | "center" | "lower";
  parallelCorridorId?: "NORTH" | "EAST" | "SOUTH";
};

/**
 * 受限制区域类型。
 */
export type RestrictedZoneType =
  | "runway"
  | "runway_protection"
  | "closed_area"
  | "construction"
  | "safety_buffer";

/**
 * 地图上的限制区域。
 *
 * polygon 中至少应包含三个坐标点。
 */
export type RestrictedZone = {
  id: string;
  name: string;
  type: RestrictedZoneType;

  polygon: AirportMapPoint[];

  active: boolean;

  /**
   * 是否完全禁止路径穿越。
   */
  blocksRoute: boolean;

  /**
   * 是否需要特别批准后才能进入。
   */
  requiresSpecialClearance: boolean;

  description: string;
};

/**
 * 路线审批状态。
 */
export type RouteApprovalStatus =
  | "系统建议"
  | "等待管制批准"
  | "已批准"
  | "已驳回"
  | "已取消";

/**
 * 路线实际执行状态。
 */
export type RouteExecutionStatus =
  | "未开始"
  | "等待推出"
  | "移动中"
  | "暂停"
  | "已到达"
  | "执行失败";

/**
 * 路线上的一个实际显示点。
 */
export type GroundRoutePoint = {
  nodeId: string;

  /** 旧图片视图使用的只读投影，不参与距离和运动计算。 */
  x: number;
  y: number;

  /** 新版路网编译后，每个运行点自带WGS84与机场局部米制坐标。 */
  operationalPosition?: AirportOperationalPosition;

  heading?: number;

  /**
   * 从路线起点到当前节点的累计距离。
   */
  accumulatedDistance: number;
};

/**
 * 路线中包含的一段道路。
 */
export type GroundRouteSegment = {
  edgeId: string;

  fromNodeId: string;
  toNodeId: string;

  distance: number;
  speedLimit: number;

  requiresClearance: boolean;
  crossesRunway: boolean;
};

/**
 * 跑道编号由机场配置包提供。共享运行逻辑不得把萧山的南、北跑道
 * 当成所有机场都具备的固定枚举。
 */
export type RunwayId = string;

export type RunwayStopBar = {
  id: string;
  runwayId: RunwayId;
  holdingNodeId: string;
  status: "lit" | "off";
  updatedAt: string | null;
  updatedBy: string | null;
};

export type RunwayAccessClearance = {
  id: string;
  runwayId: RunwayId;
  routeId: string;
  aircraftId: string;
  status: "active" | "revoked" | "used" | "expired";
  issuedAt: string;
  validUntil: string;
  issuedBy: string;
  revokedAt: string | null;
  reason: string;
};

export type RunwayOperationStatus =
  | "queued"
  | "taxiing"
  | "holding"
  | "cleared"
  | "on_runway"
  | "off_runway"
  | "completed"
  | "cancelled";

export type RunwayOperationTask = {
  id: string;
  routeId: string;
  aircraftId: string;
  runwayId: RunwayId;
  runwaySide: "W" | "E";
  operationType: "departure" | "arrival";
  status: RunwayOperationStatus;
  priority: "normal" | "priority" | "emergency";
  estimatedOccupancySeconds: number;
  /** 起飞飞机进入跑道后的可视滑跑进度，范围0-1。 */
  runwayProgress: number;
  /** 预约进港时间；普通即时任务为null。 */
  scheduledStartAt: string | null;
  /** 到达预约到点后是否由系统自动批准进入着陆动画。 */
  automaticStart: boolean;
  createdAt: string;
  updatedAt: string;
  enteredRunwayAt: string | null;
  releasedRunwayAt: string | null;
};

export type RunwayOccupancy = {
  runwayId: RunwayId;
  status: "available" | "occupied";
  operationTaskId: string | null;
  routeId: string | null;
  aircraftId: string | null;
  occupiedSince: string | null;
  expectedReleaseAt: string | null;
};

/**
 * 参与者因交通资源冲突而等待的连续记录。
 * 同一资源持续阻塞时保留 since；转为等待其他资源时重新计时。
 */
export type TrafficHold = {
  resourceId: string | null;
  since: string;
  reason: string;
};

/**
 * 人工暂停或运行异常形成的操作保持。
 * 与交通排队不同：该状态只能由人工恢复或确认终止。
 */
export type TrafficOperationalHold = {
  kind: "manual_pause" | "exception";
  since: string;
  reason: string;
  requestedBy: string;
};

/**
 * 路线冲突种类。
 */
export type RouteConflictType =
  | "runway_conflict"
  | "aircraft_conflict"
  | "closed_taxiway"
  | "occupied_stand"
  | "size_restriction"
  | "resource_conflict";

/**
 * 路线规划时发现的冲突。
 */
export type RouteConflict = {
  id: string;
  type: RouteConflictType;

  level: "提示" | "警告" | "禁止";

  message: string;

  nodeId?: string;
  edgeId?: string;
  aircraftId?: string;
};

/** 新版经纬度路线对应的跑道等待线与入口。 */
export type RunwayRouteAccess = {
  runwayId: RunwayId;
  runwaySide: "W" | "E";
  holdingNodeId: string;
  entryNodeId: string;
  holdingDistanceMeters: number;
  entryDistanceMeters: number;
  holdingCoordinate: {
    longitude: number;
    latitude: number;
  };
  entryCoordinate: {
    longitude: number;
    latitude: number;
  };
};

/**
 * 系统生成的完整地面推荐路线。
 */
export type PlannedGroundRoute = {
  id: string;

  missionType: GroundMissionType;
  aircraftId: string;

  sourceStandId: string | null;
  destinationStandId: string;

  /** 待编译路线的语义端点；不等同于中间旧合成路网节点。 */
  sourceOperationalPosition?: AirportOperationalPosition | null;
  destinationOperationalPosition?: AirportOperationalPosition | null;

  movementMode: GroundMovementMode;

  nodeIds: string[];
  segments: GroundRouteSegment[];
  points: GroundRoutePoint[];

  totalDistance: number;
  estimatedDurationSeconds: number;

  approvalStatus: RouteApprovalStatus;
  executionStatus: RouteExecutionStatus;

  /** 0-1，表示飞机沿当前路线的执行进度。 */
  progress: number;

  conflicts: RouteConflict[];

  createdAt: string;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;

  /**
   * 批准路线的人员或系统名称。
   */
  approvedBy: string | null;

  /**
   * 路线暂停、驳回或失败时的说明。
   */
  statusMessage: string;

  /** 路线的权威来源；旧记录缺省时按 legacy_airport_profile 处理。 */
  navigationSource?:
    | "legacy_airport_profile"
    | "compiled_taxiway";

  /** 与 points 相邻点段一一对应的权威路段编号。 */
  segmentEdgeIds?: string[];

  /** 新版路网中需要作为交叉口整体保护的节点。 */
  protectedNodeIds?: string[];

  /** 新地图运行使用的权威路线，不从旧百分比坐标反推。 */
  authoritativeWgs84Path?: Array<{
    longitude: number;
    latitude: number;
  }>;

  /** 新版路线对应的跑道、等待点和入口位置。 */
  runwayAccess?: RunwayRouteAccess | null;

  /**
   * 编译前保留的跑道业务意图。它只说明任务要使用哪条跑道、哪一端，
   * 不携带旧百分比路网节点；等待新版滑行路网编译后再生成 runwayAccess。
   */
  runwayIntent?: {
    runwayId: RunwayId;
    runwaySide: "W" | "E";
    operationType: "departure" | "arrival";
  } | null;

  /** OSM运行路网中对应跑道的西、东端中心线坐标。 */
  runwayCenterline?: {
    west: { longitude: number; latitude: number };
    east: { longitude: number; latitude: number };
  } | null;

  /** 操作员批准采用新版滑行路网时留下的审计信息。 */
  taxiwayApproval?: {
    approvedAt: string;
    approvedBy: string;
    previousDistanceMeters: number;
    compiledDistanceMeters: number;
  } | null;

  /** 当前没有等待时为 null 或未定义。 */
  trafficHold?: TrafficHold | null;

  /** 人工处置完成前保持当前位置和交通占用。 */
  operationalHold?: TrafficOperationalHold | null;

  /** 最近一次实际推进位置的时间，用于识别定位中断或异常占用。 */
  lastAdvancedAt?: string | null;

  /** 已执行的新版OSM飞机绕行审计。 */
  rerouteHistory?: Array<{
    blockedResourceId: string;
    previousNodeIds: string[];
    replacementNodeIds: string[];
    approvedAt: string;
    approvedBy: string;
  }>;

  /** 操作员选择继续等待的资源；资源变化后可再次建议绕行。 */
  rerouteDeclinedResourceId?: string | null;
};

/**
 * 一次地面移动任务。
 *
 * 它负责把维修决策与路径规划关联起来。
 */
export type GroundMovementTask = {
  id: string;

  aircraftId: string;
  missionType: GroundMissionType;

  maintenanceTaskId: string | null;
  maintenanceDecisionId: string | null;

  sourceStandId: string | null;
  destinationStandId: string;

  preferredMode: GroundMovementMode;

  routeId: string | null;

  status:
    | "等待规划"
    | "等待批准"
    | "等待执行"
    | "执行中"
    | "已完成"
    | "已取消"
    | "执行失败";

  createdAt: string;
  updatedAt: string;

  description: string;
};

/**
 * 地面交通系统的统一运行状态。
 *
 * 后面会把它加入 AirportState。
 */
export type GroundMovementState = {
  aircraftPositions: Record<string, AircraftPosition>;

  nodes: TaxiNode[];
  edges: TaxiEdge[];
  restrictedZones: RestrictedZone[];

  tasks: GroundMovementTask[];
  routes: PlannedGroundRoute[];

  /** 跑道入口停止排灯及塔台许可账本。 */
  runwayStopBars: Record<string, RunwayStopBar>;
  runwayClearances: RunwayAccessClearance[];
  runwayOperations: RunwayOperationTask[];
  runwayOccupancy: Record<RunwayId, RunwayOccupancy>;

  activeTaskId: string | null;
  activeRouteId: string | null;

  /** 当前场面运行条件；低能见度程序只能由运行控制席显式启停。 */
  operatingConditions: {
    visibilityMode: "normal" | "low_visibility";
    rvrMeters: number | null;
    lowVisibilityProceduresActive: boolean;
  };

  /**
   * 是否显示滑行道节点、连线和限制区调试图层。
   */
  debugLayerVisible: boolean;
};
