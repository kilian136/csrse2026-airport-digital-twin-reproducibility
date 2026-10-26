import type { PlannedGroundSupportAssignment } from "./fleet72hTaskPlanner";

export type GroundSupportEventTimeline = Readonly<{
  reserved: number;
  dispatched: number;
  arrived: number;
  serviceStarted: number;
  serviceCompleted: number;
  returned: number;
  released: number;
}>;

/** 将路网行驶、现场作业与返场三个真实排程区段转换为可回放事件。 */
export function buildGroundSupportEventTimeline(
  assignment: PlannedGroundSupportAssignment,
): GroundSupportEventTimeline {
  return Object.freeze({
    reserved: Math.max(0, assignment.startOffsetSeconds - 60),
    dispatched: assignment.startOffsetSeconds,
    arrived: assignment.arrivedOffsetSeconds,
    serviceStarted: assignment.serviceStartOffsetSeconds,
    serviceCompleted: assignment.serviceCompletedOffsetSeconds,
    returned: assignment.endOffsetSeconds,
    released: assignment.endOffsetSeconds,
  });
}
