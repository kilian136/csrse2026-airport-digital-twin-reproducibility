export type AgentUnitKind =
  | "airport_operations"
  | "maintenance_center"
  | "material_warehouse"
  | "aircraft"
  | "ground_vehicle"
  | "system";

export type OperationalAgent = {
  id: string;
  name: string;
  kind: AgentUnitKind;
  entityId: string | null;
  status: "空闲" | "运行中" | "等待" | "异常" | "离线";
  description: string;
};

export type DomainEventSeverity = "信息" | "提示" | "警告" | "严重";

export type DomainEvent = {
  id: string;
  sequence: number;
  simulationTime: string;
  recordedAt: string;
  eventType: string;
  severity: DomainEventSeverity;
  actorAgentId: string;
  targetAgentIds: string[];
  targetEntityIds: string[];
  workflowId: string | null;
  taskId: string | null;
  parentEventId: string | null;
  title: string;
  description: string;
  payload: Record<string, string | number | boolean | null>;
};

export type UnifiedTaskSource =
  | "maintenance"
  | "ground_movement"
  | "ground_support"
  | "material"
  | "planning";

export type UnifiedTask = {
  id: string;
  sourceTaskId: string;
  sourceType: UnifiedTaskSource;
  workflowId: string;
  name: string;
  ownerAgentId: string;
  participantAgentIds: string[];
  relatedEntityIds: string[];
  status: string;
  progress: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  createdAt: string;
  updatedAt: string;
  dependsOn: string[];
  resourceIds: string[];
  blockingReason: string | null;
};

export type SimulationClock = {
  mode: "simulation" | "realtime";
  currentTime: string;
  sequence: number;
  speed: number;
  status: "运行中" | "已暂停";
};

export type CoordinationState = {
  clock: SimulationClock;
  agents: Record<string, OperationalAgent>;
  events: DomainEvent[];
  tasks: UnifiedTask[];
};
