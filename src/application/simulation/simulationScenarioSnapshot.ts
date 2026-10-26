import type { AirportState } from "../../domain/state";

export type SimulationAirportSnapshotSummary = Readonly<{
  aircraftCount: number;
  standCount: number;
  occupiedStandCount: number;
  maintenanceApronCount: number;
  supportVehicleCount: number;
  activeTaskCount: number;
}>;

export type SimulationAirportSnapshot = Readonly<{
  airportIdent: string;
  airportName: string;
  capturedAt: string;
  state: AirportState;
  summary: SimulationAirportSnapshotSummary;
}>;

export type SimulationAirportSlot =
  | Readonly<{
      slotId: string;
      status: "ready";
      snapshot: SimulationAirportSnapshot;
    }>
  | Readonly<{
      slotId: string;
      status: "configuration_required";
      label: string;
      reason: string;
    }>;

export type SimulationScenarioSnapshot = Readonly<{
  id: string;
  capturedAt: string;
  horizonHours: 72;
  fleetAircraftIds: readonly string[];
  airportSlots: readonly SimulationAirportSlot[];
  configuredAirportCount: number;
  requiredAirportCount: 3;
}>;

export type SimulationAirportSnapshotSource = Readonly<{
  airportIdent: string;
  airportName: string;
  state: AirportState;
}>;

function summarizeAirportState(
  state: AirportState,
): SimulationAirportSnapshotSummary {
  return Object.freeze({
    aircraftCount: Object.keys(state.aircraft).length,
    standCount: Object.keys(state.stands).length,
    occupiedStandCount: Object.values(state.stands).filter(
      (stand) => stand.status === "占用" || stand.aircraftId !== null,
    ).length,
    maintenanceApronCount: Object.keys(state.maintenanceAprons).length,
    supportVehicleCount: Object.keys(state.groundSupport.equipment).length,
    activeTaskCount: state.maintenanceTasks.filter(
      (task) => task.status !== "已完成" && task.status !== "已取消",
    ).length,
  });
}

function cloneAirportState(state: AirportState): AirportState {
  return structuredClone(state);
}

function isCompletedDepartureShadow(state: AirportState, aircraftId: string) {
  const aircraft = state.aircraft[aircraftId];
  if (
    !aircraft ||
    aircraft.status !== "离场" ||
    aircraft.currentStandId !== null ||
    state.groundMovement.aircraftPositions[aircraftId]
  ) {
    return false;
  }

  return state.groundMovement.runwayOperations.some(
    (operation) =>
      operation.aircraftId === aircraftId &&
      operation.operationType === "departure" &&
      operation.status === "completed",
  );
}

/**
 * 跨机场到达采用“目的机场先登记、全球域随后完成交接”的安全顺序。
 * 因此飞机落地后，出发机场仍可能保留一条已经完成起飞的历史影子记录。
 * 该记录用于实时运行审计，不再代表飞机归属；仿真快照必须在边界处将其
 * 从出发机场副本中清退，同时把原飞机的健康档案连续传递给目的机场副本。
 */
function reconcileCompletedTransfers(
  sources: readonly SimulationAirportSnapshotSource[],
): SimulationAirportSnapshotSource[] {
  const clonedSources = sources.map((source) => ({
    ...source,
    state: cloneAirportState(source.state),
  }));
  const assignments = new Map<
    string,
    Array<{ source: SimulationAirportSnapshotSource; shadow: boolean }>
  >();

  clonedSources.forEach((source) => {
    Object.keys(source.state.aircraft).forEach((aircraftId) => {
      const current = assignments.get(aircraftId) ?? [];
      current.push({
        source,
        shadow: isCompletedDepartureShadow(source.state, aircraftId),
      });
      assignments.set(aircraftId, current);
    });
  });

  assignments.forEach((entries, aircraftId) => {
    if (entries.length < 2) return;
    const authoritative = entries.filter((entry) => !entry.shadow);
    const shadows = entries.filter((entry) => entry.shadow);
    if (authoritative.length !== 1 || shadows.length !== entries.length - 1) {
      throw new Error(`共享机队飞机${aircraftId}被重复分配到多个机场。`);
    }

    const destinationAircraft = authoritative[0].source.state.aircraft[aircraftId];
    const departureAircraft = shadows[0].source.state.aircraft[aircraftId];
    authoritative[0].source.state.aircraft[aircraftId] = {
      ...destinationAircraft,
      model: departureAircraft.model,
      risk: departureAircraft.risk,
      flightHours: departureAircraft.flightHours,
      remainingFlightHours: departureAircraft.remainingFlightHours,
      healthProfile: structuredClone(departureAircraft.healthProfile),
      faultType: departureAircraft.faultType,
      maintenanceType: departureAircraft.maintenanceType,
    };
    shadows.forEach((entry) => {
      delete entry.source.state.aircraft[aircraftId];
    });
  });

  return clonedSources;
}

/**
 * 从实时运行状态生成完全隔离的仿真初始快照。
 * 同一架航司机队飞机不得同时归属两个机场，否则拒绝建立场景。
 */
export function createSimulationScenarioSnapshot(
  sources: readonly SimulationAirportSnapshotSource[],
  capturedAt = new Date().toISOString(),
): SimulationScenarioSnapshot {
  if (sources.length > 3) {
    throw new Error("72小时试验场景最多允许配置3座机场。");
  }

  const reconciledSources = reconcileCompletedTransfers(sources);
  const fleetAircraftIds = new Set<string>();
  const readySlots = reconciledSources.map((source, index): SimulationAirportSlot => {
    if (source.state.airportIdent !== source.airportIdent) {
      throw new Error(
        `机场状态归属不一致：${source.airportIdent}读取到${source.state.airportIdent}状态。`,
      );
    }

    Object.keys(source.state.aircraft).forEach((aircraftId) => {
      if (fleetAircraftIds.has(aircraftId)) {
        throw new Error(`共享机队飞机${aircraftId}被重复分配到多个机场。`);
      }
      fleetAircraftIds.add(aircraftId);
    });

    const isolatedState = source.state;
    return Object.freeze({
      slotId: `airport-${index + 1}`,
      status: "ready" as const,
      snapshot: Object.freeze({
        airportIdent: source.airportIdent,
        airportName: source.airportName,
        capturedAt,
        state: isolatedState,
        summary: summarizeAirportState(isolatedState),
      }),
    });
  });

  const missingSlots: SimulationAirportSlot[] = Array.from(
    { length: Math.max(0, 3 - readySlots.length) },
    (_, index) => Object.freeze({
      slotId: `airport-${readySlots.length + index + 1}`,
      status: "configuration_required" as const,
      label: `第${readySlots.length + index + 1}座机场`,
      reason: "尚未选择具备完整运行资源和受控WGS84路网的机场配置包。",
    }),
  );

  return Object.freeze({
    id: `SIM-72H-${Date.parse(capturedAt)}`,
    capturedAt,
    horizonHours: 72 as const,
    fleetAircraftIds: Object.freeze([...fleetAircraftIds].sort()),
    airportSlots: Object.freeze([...readySlots, ...missingSlots]),
    configuredAirportCount: readySlots.length,
    requiredAirportCount: 3 as const,
  });
}
