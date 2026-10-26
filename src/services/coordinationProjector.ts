import type { AirportState, OperationLog } from "../types/airport";
import type {
  CoordinationState,
  DomainEvent,
  DomainEventSeverity,
  OperationalAgent,
  UnifiedTask,
} from "../types/coordination";

type CoordinationAction = {
  type: string;
  time?: string;
  logId?: string;
  routeId?: string;
  taskId?: string;
  aircraftId?: string;
  vehicleRouteId?: string;
};

const MAX_DOMAIN_EVENTS = 2000;
const AIRPORT_OPERATIONS_AGENT_ID = "AGENT-AIRPORT-OPS";
const MAINTENANCE_CENTER_AGENT_ID = "AGENT-MAINTENANCE-CENTER";
const MATERIAL_WAREHOUSE_AGENT_ID = "AGENT-MATERIAL-WAREHOUSE";
const SYSTEM_AGENT_ID = "AGENT-SYSTEM";

function aircraftAgentId(aircraftId: string) {
  return `AGENT-AIRCRAFT-${aircraftId}`;
}

function vehicleAgentId(equipmentId: string) {
  return `AGENT-GSE-${equipmentId}`;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function projectAgents(state: AirportState) {
  const agents: Record<string, OperationalAgent> = {
    [AIRPORT_OPERATIONS_AGENT_ID]: {
      id: AIRPORT_OPERATIONS_AGENT_ID,
      name: "机场运行规划智能体",
      kind: "airport_operations",
      entityId: "AIRPORT",
      status: "运行中",
      description: "负责全场路线审批、交通资源协调和运行排序。",
    },
    [MAINTENANCE_CENTER_AGENT_ID]: {
      id: MAINTENANCE_CENTER_AGENT_ID,
      name: "维修中心智能体",
      kind: "maintenance_center",
      entityId: "MAINTENANCE-CENTER",
      status: state.maintenanceTasks.some((task) => task.status === "维修中")
        ? "运行中"
        : "空闲",
      description: "负责维修工位、人员、设备与维修任务执行。",
    },
    [MATERIAL_WAREHOUSE_AGENT_ID]: {
      id: MATERIAL_WAREHOUSE_AGENT_ID,
      name: "航材库智能体",
      kind: "material_warehouse",
      entityId: "MATERIAL-WAREHOUSE",
      status: state.resources.spareParts.some(
        (part) => part.stock < part.safetyStock,
      )
        ? "等待"
        : "空闲",
      description: "负责航材库存、锁定、出库和补货协调。",
    },
    [SYSTEM_AGENT_ID]: {
      id: SYSTEM_AGENT_ID,
      name: "系统协调器",
      kind: "system",
      entityId: null,
      status: "运行中",
      description: "维护统一模拟时钟、事件顺序和跨智能体任务投影。",
    },
  };

  Object.values(state.aircraft).forEach((aircraft) => {
    const id = aircraftAgentId(aircraft.id);
    agents[id] = {
      id,
      name: `${aircraft.id}飞机智能体`,
      kind: "aircraft",
      entityId: aircraft.id,
      status:
        aircraft.status === "停飞"
          ? "异常"
          : aircraft.status === "转场中" || aircraft.status === "维修中"
            ? "运行中"
            : aircraft.status === "等待调度" ||
                aircraft.status === "维修完成"
              ? "等待"
              : "空闲",
      description: `${aircraft.id}当前状态：${aircraft.status}。`,
    };
  });

  Object.values(state.groundSupport.equipment).forEach((equipment) => {
    const id = vehicleAgentId(equipment.id);
    agents[id] = {
      id,
      name: `${equipment.id}保障设备智能体`,
      kind: "ground_vehicle",
      entityId: equipment.id,
      status:
        equipment.status === "故障"
          ? "异常"
          : equipment.status === "可用"
            ? "空闲"
            : equipment.status === "已预留" ||
                equipment.status === "等待连接"
              ? "等待"
              : "运行中",
      description: `${equipment.name}当前状态：${equipment.status}。`,
    };
  });

  return agents;
}

export function projectUnifiedTasks(state: AirportState): UnifiedTask[] {
  const movementTasks = state.groundMovement.tasks.map((task) => {
    const route = task.routeId
      ? state.groundMovement.routes.find((item) => item.id === task.routeId)
      : null;
    const supportTask = route
      ? state.groundSupport.tasks.find(
          (item) => item.aircraftRouteId === route.id,
        )
      : null;
    const workflowId =
      task.maintenanceTaskId ?? task.maintenanceDecisionId ?? task.id;
    const blockingReason = route?.statusMessage.startsWith("分段等待：")
      ? route.statusMessage
      : null;

    return {
      id: `UNIFIED-MOVEMENT-${task.id}`,
      sourceTaskId: task.id,
      sourceType: "ground_movement" as const,
      workflowId,
      name: `${task.aircraftId}地面转场`,
      ownerAgentId: AIRPORT_OPERATIONS_AGENT_ID,
      participantAgentIds: unique([
        aircraftAgentId(task.aircraftId),
        supportTask?.assignedEquipmentIds[0]
          ? vehicleAgentId(supportTask.assignedEquipmentIds[0])
          : null,
      ]),
      relatedEntityIds: unique([
        task.aircraftId,
        task.sourceStandId,
        task.destinationStandId,
        route?.id,
      ]),
      status: task.status,
      progress: route?.progress ?? 0,
      plannedStart: task.createdAt,
      plannedEnd: null,
      actualStart: route?.startedAt ?? null,
      actualEnd: route?.completedAt ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      /* 保障任务会跨越连接、牵引和返场，不能作为整项前置任务。 */
      dependsOn: [],
      resourceIds: unique([route?.id]),
      blockingReason,
    };
  });

  const supportTasks = state.groundSupport.tasks.map((task) => {
    const vehicleRoute = task.vehicleRouteId
      ? state.groundSupport.vehicleRoutes.find(
          (item) => item.id === task.vehicleRouteId,
        )
      : null;
    const movementTask = task.aircraftRouteId
      ? state.groundMovement.tasks.find(
          (item) => item.routeId === task.aircraftRouteId,
        )
      : null;
    const workflowId =
      movementTask?.maintenanceTaskId ?? movementTask?.id ?? task.id;
    const equipmentId = task.assignedEquipmentIds[0] ?? null;

    return {
      id: `UNIFIED-SUPPORT-${task.id}`,
      sourceTaskId: task.id,
      sourceType: "ground_support" as const,
      workflowId,
      name: equipmentId
        ? `${equipmentId}保障任务`
        : `${task.aircraftId ?? "未指定飞机"}保障任务`,
      ownerAgentId: equipmentId
        ? vehicleAgentId(equipmentId)
        : AIRPORT_OPERATIONS_AGENT_ID,
      participantAgentIds: unique([
        equipmentId ? vehicleAgentId(equipmentId) : null,
        task.aircraftId ? aircraftAgentId(task.aircraftId) : null,
        AIRPORT_OPERATIONS_AGENT_ID,
      ]),
      relatedEntityIds: unique([
        task.aircraftId,
        equipmentId,
        task.sourceStandId,
        task.destinationStandId,
        vehicleRoute?.id,
      ]),
      status: task.status,
      progress: vehicleRoute?.progress ?? (task.status === "已完成" ? 1 : 0),
      plannedStart: task.createdAt,
      plannedEnd: null,
      actualStart: task.startedAt,
      actualEnd: task.completedAt,
      createdAt: task.createdAt,
      updatedAt:
        task.completedAt ?? task.startedAt ?? task.createdAt,
      dependsOn: [],
      resourceIds: unique([
        ...task.assignedEquipmentIds,
        vehicleRoute?.id,
      ]),
      blockingReason: vehicleRoute?.description.startsWith("分段等待：")
        ? vehicleRoute.description
        : null,
    };
  });

  const maintenanceTasks = state.maintenanceTasks.map((task) => {
    const movementTask = state.groundMovement.tasks.find(
      (item) => item.maintenanceTaskId === task.id,
    );
    const supportTask = movementTask?.routeId
      ? state.groundSupport.tasks.find(
          (item) => item.aircraftRouteId === movementTask.routeId,
        )
      : null;

    return {
      id: `UNIFIED-MAINTENANCE-${task.id}`,
      sourceTaskId: task.id,
      sourceType: "maintenance" as const,
      workflowId: task.id,
      name: `${task.aircraftId}${task.maintenanceType}`,
      ownerAgentId: MAINTENANCE_CENTER_AGENT_ID,
      participantAgentIds: unique([
        MAINTENANCE_CENTER_AGENT_ID,
        aircraftAgentId(task.aircraftId),
        MATERIAL_WAREHOUSE_AGENT_ID,
      ]),
      relatedEntityIds: unique([
        task.aircraftId,
        task.sourceStandId,
        task.targetStandId,
        task.targetApron,
      ]),
      status: task.status,
      progress: task.progress,
      plannedStart: task.createdAt,
      plannedEnd: null,
      actualStart: task.startedAt,
      actualEnd: task.completedAt,
      createdAt: task.createdAt,
      updatedAt:
        task.completedAt ?? task.startedAt ?? task.createdAt,
      dependsOn: unique([
        movementTask ? `UNIFIED-MOVEMENT-${movementTask.id}` : null,
        supportTask ? `UNIFIED-SUPPORT-${supportTask.id}` : null,
      ]),
      resourceIds: [
        task.targetStandId,
        ...task.requiredParts,
        `PERSONNEL:${task.requiredPersonnel}`,
        `EQUIPMENT:${task.requiredEquipment}`,
      ],
      blockingReason: null,
    };
  });

  return [...movementTasks, ...supportTasks, ...maintenanceTasks];
}

function getEventType(actionType: string, log: OperationLog) {
  const byAction: Record<string, string> = {
    PROPOSE_MAINTENANCE: "decision.maintenance_proposed",
    RESERVE_PENDING_MAINTENANCE_DECISION:
      "workflow.maintenance_resources_reserved",
    PREPARE_RESERVED_MAINTENANCE_ROUTES: "workflow.maintenance_confirmed",
    APPROVE_GROUND_ROUTE: "route.approved",
    REJECT_GROUND_ROUTE: "route.rejected",
    START_VEHICLE_ROUTE: "vehicle.departed",
    CONNECT_TUG_TO_AIRCRAFT: "vehicle.connected",
    START_AIRCRAFT_TOW: "movement.started",
    DISCONNECT_TUG_AND_RETURN: "movement.tug_disconnected",
    START_MAINTENANCE_TASK: "maintenance.started",
    PREPARE_RELEASE_TRANSFER: "release.planned",
    CANCEL_PENDING_DECISION: "workflow.cancelled",
  };

  if (
    actionType === "ADVANCE_MAINTENANCE_TASK" &&
    log.message.includes("完成")
  ) {
    return "maintenance.completed";
  }

  return (
    byAction[actionType] ??
    (log.category === "用户指令"
      ? "command.received"
      : log.category === "智能决策"
        ? "decision.created"
        : log.category === "异常提醒"
          ? "alert.raised"
          : "state.changed")
  );
}

function getSeverity(log: OperationLog): DomainEventSeverity {
  if (log.category === "异常提醒") return "警告";
  if (log.category === "智能决策") return "提示";
  return "信息";
}

function getActorAgentId(
  actionType: string,
  equipmentId: string | null,
) {
  if (
    equipmentId &&
    (actionType.includes("VEHICLE") ||
      actionType.includes("TUG"))
  ) {
    return vehicleAgentId(equipmentId);
  }
  if (
    actionType === "START_MAINTENANCE_TASK" ||
    actionType === "ADVANCE_MAINTENANCE_TASK"
  ) {
    return MAINTENANCE_CENTER_AGENT_ID;
  }
  if (
    actionType.includes("GROUND_ROUTE") ||
    actionType.includes("AIRCRAFT_TOW") ||
    actionType === "RESERVE_PENDING_MAINTENANCE_DECISION" ||
    actionType === "PREPARE_RESERVED_MAINTENANCE_ROUTES" ||
    actionType === "PREPARE_RELEASE_TRANSFER"
  ) {
    return AIRPORT_OPERATIONS_AGENT_ID;
  }
  return SYSTEM_AGENT_ID;
}

function findActionEquipmentId(
  state: AirportState,
  action: CoordinationAction,
) {
  const vehicleRouteId =
    action.vehicleRouteId ??
    (action.type.includes("VEHICLE") ? action.routeId : undefined);
  const vehicleRoute = vehicleRouteId
    ? state.groundSupport.vehicleRoutes.find(
        (route) => route.id === vehicleRouteId,
      )
    : null;

  if (vehicleRoute) return vehicleRoute.equipmentId;

  const aircraftRoute = action.routeId
    ? state.groundMovement.routes.find(
        (route) => route.id === action.routeId,
      )
    : null;
  const supportTask = aircraftRoute
    ? state.groundSupport.tasks.find(
        (task) => task.aircraftRouteId === aircraftRoute.id,
      )
    : null;

  return supportTask?.assignedEquipmentIds[0] ?? null;
}

function findParentEventId(events: DomainEvent[], workflowId: string | null) {
  if (!workflowId) return null;
  return [...events]
    .reverse()
    .find((event) => event.workflowId === workflowId)?.id ?? null;
}

function appendEvent(
  coordination: CoordinationState,
  draft: Omit<DomainEvent, "id" | "sequence" | "parentEventId">,
) {
  const sequence = coordination.clock.sequence + 1;
  const parentEventId = findParentEventId(
    coordination.events,
    draft.workflowId,
  );
  const event: DomainEvent = {
    ...draft,
    id: `EVENT-${sequence}`,
    sequence,
    parentEventId,
  };

  return {
    ...coordination,
    clock: {
      ...coordination.clock,
      currentTime: draft.simulationTime,
      sequence,
    },
    events: [...coordination.events, event].slice(-MAX_DOMAIN_EVENTS),
  };
}

function eventFromLog(
  coordination: CoordinationState,
  state: AirportState,
  action: CoordinationAction,
  log: OperationLog,
) {
  const workflowId = log.taskId ?? action.routeId ?? action.vehicleRouteId ?? null;
  const equipmentId = findActionEquipmentId(state, action);
  const maintenanceRelated =
    action.type.includes("MAINTENANCE") ||
    action.type === "PROPOSE_MAINTENANCE";
  return appendEvent(coordination, {
    simulationTime: log.time,
    recordedAt: log.time,
    eventType: getEventType(action.type, log),
    severity: getSeverity(log),
    actorAgentId: getActorAgentId(action.type, equipmentId),
    targetAgentIds: unique([
      log.aircraftId ? aircraftAgentId(log.aircraftId) : null,
      equipmentId ? vehicleAgentId(equipmentId) : null,
      maintenanceRelated ? MAINTENANCE_CENTER_AGENT_ID : null,
      maintenanceRelated ? MATERIAL_WAREHOUSE_AGENT_ID : null,
    ]),
    targetEntityIds: unique([
      log.aircraftId,
      log.taskId,
      action.routeId,
      action.vehicleRouteId,
    ]),
    workflowId,
    taskId: log.taskId,
    title: log.category,
    description: log.message,
    payload: {
      actionType: action.type,
      sourceLogId: log.id,
    },
  });
}

function appendTrafficTransitionEvents(
  coordination: CoordinationState,
  previous: AirportState,
  next: AirportState,
  eventTime: string,
) {
  let result = coordination;

  next.groundMovement.routes.forEach((route) => {
    const previousRoute = previous.groundMovement.routes.find(
      (item) => item.id === route.id,
    );
    if (!previousRoute) return;

    const wasWaiting = previousRoute.statusMessage.startsWith("分段等待：");
    const isWaiting = route.statusMessage.startsWith("分段等待：");
    if (wasWaiting === isWaiting && previousRoute.statusMessage === route.statusMessage) {
      return;
    }

    if (isWaiting || wasWaiting) {
      result = appendEvent(result, {
        simulationTime: eventTime,
        recordedAt: eventTime,
        eventType: isWaiting
          ? "traffic.segment_waiting"
          : "traffic.segment_clearance_granted",
        severity: isWaiting ? "提示" : "信息",
        actorAgentId: AIRPORT_OPERATIONS_AGENT_ID,
        targetAgentIds: [aircraftAgentId(route.aircraftId)],
        targetEntityIds: [route.aircraftId, route.id],
        workflowId: route.id,
        taskId: null,
        title: isWaiting ? "交通块等待" : "交通块放行",
        description: isWaiting
          ? route.statusMessage
          : `${route.aircraftId}已获得下一交通块通行许可。`,
        payload: {
          routeId: route.id,
          aircraftId: route.aircraftId,
        },
      });
    }
  });

  next.groundSupport.vehicleRoutes.forEach((route) => {
    const previousRoute = previous.groundSupport.vehicleRoutes.find(
      (item) => item.id === route.id,
    );
    if (!previousRoute) return;

    const wasWaiting = previousRoute.description.startsWith("分段等待：");
    const isWaiting = route.description.startsWith("分段等待：");
    if (wasWaiting === isWaiting && previousRoute.description === route.description) {
      return;
    }

    if (isWaiting || wasWaiting) {
      result = appendEvent(result, {
        simulationTime: eventTime,
        recordedAt: eventTime,
        eventType: isWaiting
          ? "traffic.segment_waiting"
          : "traffic.segment_clearance_granted",
        severity: isWaiting ? "提示" : "信息",
        actorAgentId: AIRPORT_OPERATIONS_AGENT_ID,
        targetAgentIds: [vehicleAgentId(route.equipmentId)],
        targetEntityIds: unique([
          route.equipmentId,
          route.aircraftId,
          route.id,
        ]),
        workflowId: route.supportTaskId,
        taskId: route.supportTaskId,
        title: isWaiting ? "保障车辆等待" : "保障车辆放行",
        description: isWaiting
          ? route.description
          : `${route.equipmentId}已获得下一交通块通行许可。`,
        payload: {
          vehicleRouteId: route.id,
          equipmentId: route.equipmentId,
        },
      });
    }
  });

  return result;
}

export function createInitialCoordinationState(
  state: AirportState,
): CoordinationState {
  const initialTime =
    state.operationLogs.at(-1)?.time ?? "2026-09-11 09:30";
  let coordination: CoordinationState = {
    clock: {
      mode: "simulation",
      currentTime: initialTime,
      sequence: 0,
      speed: 1,
      status: "运行中",
    },
    agents: {},
    events: [],
    tasks: [],
  };

  state.operationLogs.forEach((log) => {
    coordination = eventFromLog(
      coordination,
      state,
      { type: "INITIALIZE" },
      log,
    );
  });

  return {
    ...coordination,
    agents: projectAgents(state),
    tasks: projectUnifiedTasks(state),
  };
}

export function projectCoordinationTransition(
  previous: AirportState,
  next: AirportState,
  action: CoordinationAction,
): AirportState {
  if (next === previous) return previous;

  let coordination = next.coordination;
  const newLogs = next.operationLogs.slice(previous.operationLogs.length);
  newLogs.forEach((log) => {
    coordination = eventFromLog(coordination, next, action, log);
  });

  const eventTime =
    action.time ??
    newLogs.at(-1)?.time ??
    coordination.clock.currentTime;
  coordination = appendTrafficTransitionEvents(
    coordination,
    previous,
    next,
    eventTime,
  );

  return {
    ...next,
    coordination: {
      ...coordination,
      agents: projectAgents(next),
      tasks: projectUnifiedTasks(next),
    },
  };
}
