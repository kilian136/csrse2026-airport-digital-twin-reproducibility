import type {
  AirportGeoreferencedPoint,
  MaintenanceApronId,
  MaintenanceType,
  TrafficHold,
  TrafficOperationalHold,
} from "./airport";
import type { AirportOperationalPosition } from "../domain/geo/operationalPosition";

/* =========================
   保障基地
========================= */

/** 保障基地编号由机场配置包提供，共享逻辑不得枚举具体机场的基地。 */
export type SupportBaseId = string;

export type SupportBase = {
  id: SupportBaseId;
  name: string;

  /** 人工标定的基地中心；没有可靠WGS84数据时保持null。 */
  operationalPosition: AirportOperationalPosition | null;

  capacity: number;

  serviceAreas: string[];

  description: string;
};

/* =========================
   地面保障设备
========================= */

export type GroundEquipmentCategory =
  | "standard_tug"
  | "heavy_tug"
  | "line_maintenance_vehicle"
  | "heavy_maintenance_vehicle"
  | "parts_transport_vehicle"
  | "mobile_platform"
  | "ground_power_vehicle"
  | "follow_me_vehicle"
  | "inspection_vehicle"
  | "fuel_vehicle"
  | "rescue_vehicle";

export type GroundEquipmentStatus =
  | "可用"
  | "已预留"
  | "前往任务点"
  | "等待连接"
  | "执行任务"
  | "返回基地"
  | "充电中"
  | "加油中"
  | "检修中"
  | "故障";

export type GroundEquipmentGeospatialReadiness =
  | "ready"
  | "unmapped";

export type GroundEquipmentCapability = {
  supportedAircraftModels: string[];

  supportedMaintenanceTypes:
    MaintenanceType[];

  maxTowWeightTons: number | null;

  canTowAircraft: boolean;
  canTransportParts: boolean;
  canPerformMaintenance: boolean;
};

export type GroundSupportEquipment = {
  id: string;
  name: string;

  category: GroundEquipmentCategory;
  status: GroundEquipmentStatus;

  /** 是否具备可用于新版运行路网的权威WGS84驻点。 */
  geospatialReadiness: GroundEquipmentGeospatialReadiness;

  homeBaseId: SupportBaseId;

  currentParkingSpotId:
    | string
    | null;

  position: AirportGeoreferencedPoint;
  heading: number;
  speed: number;

  energyPercent: number;

  capability:
    GroundEquipmentCapability;

  currentTaskId: string | null;

  description: string;
};

/* =========================
   车辆停车位
========================= */

export type SupportParkingSpotStatus =
  | "空闲"
  | "占用"
  | "维修预留"
  | "停用";

export type StaticSupportGeospatialReadiness =
  | "base_anchor"
  | "ready"
  | "unmapped";

export type SupportParkingSpot = {
  id: string;
  baseId: SupportBaseId;

  /**
   * 运行端点。尚未逐车位测绘时，可继承所属基地的权威锚点，
   * 但必须以base_anchor标明精度，不能伪装成独立实测车位。
   */
  operationalPosition: AirportOperationalPosition | null;
  geospatialReadiness: StaticSupportGeospatialReadiness;
  heading: number;

  status: SupportParkingSpotStatus;

  equipmentId: string | null;

  allowedCategories:
    GroundEquipmentCategory[];
};

/* =========================
   作业等待区
========================= */

export type SupportWaitingArea = {
  id: string;
  name: string;

  serviceAreaId: string;

  /** 只有取得可靠WGS84标定后，等待区才可参与运行寻路。 */
  operationalPosition: AirportOperationalPosition | null;
  geospatialReadiness: Extract<StaticSupportGeospatialReadiness, "ready" | "unmapped">;

  capacity: number;

  occupiedEquipmentIds: string[];

  allowedCategories:
    GroundEquipmentCategory[];

  description: string;
};

/* =========================
   地面保障任务
========================= */

export type SupportMissionType =
  | "dispatch_tug"
  | "tow_aircraft"
  | "deliver_parts"
  | "line_maintenance"
  | "heavy_maintenance"
  | "ground_power"
  | "follow_me"
  | "inspection"
  | "fuel_service"
  | "emergency_response";

export type EmergencyIncidentType =
  | "engine_fire"
  | "fuel_leak"
  | "landing_gear_overheat"
  | "general_emergency";

export type EmergencyResponseLevel = "一级" | "二级" | "三级";

export type SupportTaskStatus =
  | "等待设备匹配"
  | "等待设备出发"
  | "设备前往飞机"
  | "设备已到达"
  | "等待连接"
  | "设备已连接"
  | "任务执行中"
  | "设备返场中"
  | "已完成"
  | "已取消"
  | "执行失败";

export type GroundSupportTask = {
  id: string;

  missionType:
    SupportMissionType;

  aircraftId: string | null;

  sourceBaseId:
    SupportBaseId | null;

  sourceStandId: string | null;
  destinationStandId: string | null;

  targetMaintenanceApron:
    MaintenanceApronId | null;

  assignedEquipmentIds: string[];

  vehicleRouteId: string | null;
  aircraftRouteId: string | null;

  status: SupportTaskStatus;

  priority:
    | "普通"
    | "优先"
    | "紧急";

  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;

  description: string;

  /** 同一应急事件可拆分为多辆车的独立可执行任务。 */
  incidentId?: string | null;
  incidentType?: EmergencyIncidentType | null;
  emergencyLevel?: EmergencyResponseLevel | null;
  onSceneDurationSeconds?: number | null;
};

/* =========================
   保障车辆路线
========================= */

export type GroundVehicleRouteStatus =
  | "等待出发"
  | "行驶中"
  | "已到达"
  | "已取消"
  | "执行失败";

export type GroundVehicleRoutePoint = {
  nodeId: string;
  name: string;

  /** 旧图片视图使用的只读投影，不参与距离和运动计算。 */
  x: number;
  y: number;

  /** 新版保障道路编译后，每个运行点自带WGS84与机场局部米制坐标。 */
  operationalPosition?: AirportOperationalPosition;

  heading: number;

  accumulatedDistance: number;
};

export type VehicleReroutePlan = {
  status: "已批准等待切换";
  networkType: "taxiway" | "service_road";
  blockedResourceId: string;
  blockedEdgeId: string | null;
  blockedNodeId: string | null;
  applyAfterNodeId: string;
  destinationNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  distanceMeters: number;
  addedDistanceMeters: number;
  requestedAt: string;
  approvedAt: string;
  approvedBy: string;
};

export type VehicleRerouteHistoryEntry = {
  blockedResourceId: string;
  applyAfterNodeId: string;
  previousNodeIds: string[];
  replacementNodeIds: string[];
  approvedAt: string;
  approvedBy: string;
  appliedAt: string;
};

export type GroundVehicleRoute = {
  id: string;

  supportTaskId: string;
  equipmentId: string;
  aircraftId: string | null;

  sourceBaseId: SupportBaseId;

  destinationAreaId: string;
  destinationStandId: string;

  /**
   * 仅保存已编译、可执行的道路节点。待编译任务必须保持空数组，
   * 其意图由下方两个语义端点表达。
   */
  nodeIds: string[];
  points: GroundVehicleRoutePoint[];

  totalDistance: number;
  estimatedDurationSeconds: number;

  /*
   * 路线执行进度，范围0～1。
   */
  progress: number;

  status: GroundVehicleRouteStatus;

  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;

  description: string;

  /** 任务语义上的权威起终点，独立于可执行路线点。 */
  sourceOperationalPosition?: AirportOperationalPosition | null;
  destinationOperationalPosition?: AirportOperationalPosition | null;

  /** 路线的权威来源；旧记录缺省时按 legacy_airport_profile 处理。 */
  navigationSource?:
    | "legacy_airport_profile"
    | "compiled_service_road";

  /** 与 points 相邻点段一一对应的权威路段编号。 */
  segmentEdgeIds?: string[];

  /** 新版路网中需要作为交叉口整体保护的节点。 */
  protectedNodeIds?: string[];

  /** 新地图和全球地图使用的权威路线，不从旧百分比坐标反推。 */
  authoritativeWgs84Path?: Array<{
    longitude: number;
    latitude: number;
  }>;

  /** 操作员批准采用新版保障道路时留下的审计信息。 */
  serviceRoadApproval?: {
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

  /** 已批准但尚未到达安全切换节点的绕行方案。 */
  pendingReroute?: VehicleReroutePlan | null;

  /** 已执行绕行的审计记录。 */
  rerouteHistory?: VehicleRerouteHistoryEntry[];

  /** 操作员选择继续等待的资源；资源变化后可重新提出绕行。 */
  rerouteDeclinedResourceId?: string | null;
};

/* =========================
   地面保障统一状态
========================= */

export type GroundSupportState = {
  bases: Record<
    SupportBaseId,
    SupportBase
  >;

  parkingSpots: Record<
    string,
    SupportParkingSpot
  >;

  waitingAreas: Record<
    string,
    SupportWaitingArea
  >;

  equipment: Record<
    string,
    GroundSupportEquipment
  >;

  tasks: GroundSupportTask[];

  activeTaskId: string | null;

  /*
   * 保障车辆行驶路线。
   */
  vehicleRoutes:
    GroundVehicleRoute[];

  activeVehicleRouteId:
    string | null;

  showAllEquipment: boolean;
};
