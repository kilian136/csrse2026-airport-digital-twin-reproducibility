import type { PlannedFlightMission } from "./fleet72hTaskPlanner";

export const OPERATIONAL_DELAY_THRESHOLD_SECONDS = 15 * 60;

export type SimulationDelayCategory =
  | "ground_support_queue"
  | "departure_runway_queue"
  | "arrival_stand_queue"
  | "arrival_runway_queue"
  | "emergency_operational_hold";

export type SimulationDelayCategorySummary = Readonly<{
  category: SimulationDelayCategory;
  label: string;
  affectedMissionCount: number;
  totalHours: number;
  averageMinutesPerAffectedMission: number;
}>;

export type MissionOperationalTimingBreakdown = Readonly<{
  missionId: string;
  aircraftId: string;
  plannedOperationSeconds: number;
  departureWaitSeconds: number;
  arrivalWaitSeconds: number;
  totalResourceWaitSeconds: number;
  operationallyDelayed: boolean;
  categorySeconds: Readonly<Record<SimulationDelayCategory, number>>;
}>;

export type SimulationOperationalTimeMetrics = Readonly<{
  contractVersion: "operational_time_v1";
  delayThresholdMinutes: 15;
  missionCount: number;
  constrainedMissionCount: number;
  operationallyDelayedMissionCount: number;
  totalResourceWaitHours: number;
  departureWaitHours: number;
  arrivalWaitHours: number;
  averageResourceWaitMinutes: number;
  p95ResourceWaitMinutes: number;
  averageDepartureWaitMinutes: number;
  p95DepartureWaitMinutes: number;
  categories: readonly SimulationDelayCategorySummary[];
  missions: readonly MissionOperationalTimingBreakdown[];
}>;

const CATEGORY_LABELS: Readonly<Record<SimulationDelayCategory, string>> = Object.freeze({
  ground_support_queue: "地面保障等待",
  departure_runway_queue: "离场跑道等待",
  arrival_stand_queue: "到达机位等待",
  arrival_runway_queue: "进场跑道等待",
  emergency_operational_hold: "应急处置与适航复核",
});

const CATEGORIES = Object.freeze(Object.keys(CATEGORY_LABELS) as SimulationDelayCategory[]);

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentile95(values: readonly number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

/**
 * 统一运行时间契约：正常飞行、正常保障和计划过站时间属于计划作业；
 * 只有资源不可用、时隙冲突、机位占用及应急传播造成的额外等待才进入资源等待。
 */
export function classifyMissionOperationalTiming(
  mission: PlannedFlightMission,
): MissionOperationalTimingBreakdown {
  const categorySeconds: Record<SimulationDelayCategory, number> = {
    ground_support_queue: Math.max(0, mission.groundSupportHoldSeconds ?? 0),
    departure_runway_queue: Math.max(0, mission.departureRunwayHoldSeconds ?? 0),
    arrival_stand_queue: Math.max(0, mission.arrivalStandHoldSeconds ?? 0),
    arrival_runway_queue: Math.max(0, mission.arrivalRunwayHoldSeconds ?? 0),
    emergency_operational_hold: Math.max(0, mission.emergencyOperationalHoldSeconds ?? 0),
  };
  const departureWaitSeconds =
    categorySeconds.ground_support_queue +
    categorySeconds.departure_runway_queue +
    categorySeconds.emergency_operational_hold;
  const arrivalWaitSeconds =
    categorySeconds.arrival_stand_queue + categorySeconds.arrival_runway_queue;
  const totalResourceWaitSeconds = departureWaitSeconds + arrivalWaitSeconds;
  return Object.freeze({
    missionId: mission.id,
    aircraftId: mission.aircraftId,
    plannedOperationSeconds: Math.max(
      0,
      Math.round(mission.plannedDurationHours * 3600 - arrivalWaitSeconds),
    ),
    departureWaitSeconds,
    arrivalWaitSeconds,
    totalResourceWaitSeconds,
    operationallyDelayed: totalResourceWaitSeconds >= OPERATIONAL_DELAY_THRESHOLD_SECONDS,
    categorySeconds: Object.freeze(categorySeconds),
  });
}

export function summarizeOperationalTiming(
  missions: readonly PlannedFlightMission[],
): SimulationOperationalTimeMetrics {
  const breakdowns = missions.map(classifyMissionOperationalTiming);
  const totalWaits = breakdowns.map((item) => item.totalResourceWaitSeconds);
  const departureWaits = breakdowns.map((item) => item.departureWaitSeconds);
  const totalResourceWaitSeconds = totalWaits.reduce((sum, value) => sum + value, 0);
  const totalDepartureWaitSeconds = departureWaits.reduce((sum, value) => sum + value, 0);
  const totalArrivalWaitSeconds = breakdowns.reduce(
    (sum, item) => sum + item.arrivalWaitSeconds,
    0,
  );
  const categories = CATEGORIES.map((category) => {
    const affected = breakdowns.filter((item) => item.categorySeconds[category] > 0);
    const seconds = affected.reduce(
      (sum, item) => sum + item.categorySeconds[category],
      0,
    );
    return Object.freeze({
      category,
      label: CATEGORY_LABELS[category],
      affectedMissionCount: affected.length,
      totalHours: round(seconds / 3600),
      averageMinutesPerAffectedMission: round(
        affected.length > 0 ? seconds / affected.length / 60 : 0,
        1,
      ),
    });
  });
  return Object.freeze({
    contractVersion: "operational_time_v1" as const,
    delayThresholdMinutes: 15 as const,
    missionCount: missions.length,
    constrainedMissionCount: breakdowns.filter((item) => item.totalResourceWaitSeconds > 0).length,
    operationallyDelayedMissionCount: breakdowns.filter((item) => item.operationallyDelayed).length,
    totalResourceWaitHours: round(totalResourceWaitSeconds / 3600),
    departureWaitHours: round(totalDepartureWaitSeconds / 3600),
    arrivalWaitHours: round(totalArrivalWaitSeconds / 3600),
    averageResourceWaitMinutes: round(
      breakdowns.length > 0 ? totalResourceWaitSeconds / breakdowns.length / 60 : 0,
      1,
    ),
    p95ResourceWaitMinutes: round(percentile95(totalWaits) / 60, 1),
    averageDepartureWaitMinutes: round(
      breakdowns.length > 0 ? totalDepartureWaitSeconds / breakdowns.length / 60 : 0,
      1,
    ),
    p95DepartureWaitMinutes: round(percentile95(departureWaits) / 60, 1),
    categories: Object.freeze(categories),
    missions: Object.freeze(breakdowns),
  });
}

