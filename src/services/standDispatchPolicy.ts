import { getAircraftSpecification } from "../data/aircraftSpecifications";

export type StandReferenceCode = "A" | "B" | "C" | "D" | "E" | "F";
export type StandOperationalRole =
  | "passenger_gate"
  | "remote_stand"
  | "cargo_stand"
  | "general_stand";

export type StandDispatchCandidate = Readonly<{
  id: string;
  referenceCode: StandReferenceCode;
  operationalRole: StandOperationalRole;
  availableAtSeconds: number;
  distanceMeters: number | null;
}>;

export type StandDispatchSelection = Readonly<{
  candidate: StandDispatchCandidate;
  readyAtSeconds: number;
  delayedBySeconds: number;
  preservedTwoStandBuffer: boolean;
  basis: string;
}>;

const referenceCodeRank: Record<StandReferenceCode, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
};

const roleRank: Record<StandOperationalRole, number> = {
  passenger_gate: 0,
  general_stand: 1,
  remote_stand: 2,
  cargo_stand: 3,
};

function ordinalOf(standId: string) {
  const match = /^(.*?)(\d+)$/.exec(standId);
  return match ? { group: match[1], value: Number(match[2]) } : null;
}

function hasTwoStandBuffer(candidateId: string, occupiedStandIds: ReadonlySet<string>) {
  const candidateOrdinal = ordinalOf(candidateId);
  if (!candidateOrdinal) return true;
  return [...occupiedStandIds].every((occupiedId) => {
    const occupiedOrdinal = ordinalOf(occupiedId);
    return (
      !occupiedOrdinal ||
      occupiedOrdinal.group !== candidateOrdinal.group ||
      Math.abs(occupiedOrdinal.value - candidateOrdinal.value) >= 3
    );
  });
}

export function inferStandOperationalRole(standId: string): StandOperationalRole {
  const normalized = standId.toUpperCase();
  if (normalized.includes("CARGO")) return "cargo_stand";
  if (normalized.includes("REMOTE")) return "remote_stand";
  if (normalized.includes("GATE")) return "passenger_gate";
  return "general_stand";
}

export function inferStandReferenceCode(
  areaId: string,
  kind: "boarding" | "maintenance",
): StandReferenceCode {
  if (kind === "maintenance") return "F";
  if (areaId === "G") return "F";
  if (areaId === "D" || areaId === "E") return "E";
  return "C";
}

export function canReferenceCodeAcceptAircraft(
  referenceCode: StandReferenceCode,
  aircraftModel: string,
) {
  const aircraftCode = getAircraftSpecification(aircraftModel).aerodromeReferenceCode;
  return referenceCodeRank[referenceCode] >= referenceCodeRank[aircraftCode];
}

/**
 * 实时运行与72小时仿真共用的机位决策规则。
 *
 * 先执行硬约束（机型适配、可用时间），再依次考虑业务用途、两空位间隔、
 * 距离和机位尺寸余量。货机位与远机位是容量不足时的后备资源，不会抢占
 * 可用的普通近机位。所有排序均有稳定编号兜底，便于复现与审计。
 */
export function selectStandByUnifiedPolicy(input: Readonly<{
  aircraftModel: string;
  candidates: readonly StandDispatchCandidate[];
  desiredAtSeconds: number;
  occupiedStandIds: ReadonlySet<string>;
  distanceBasisLabel: string;
}>): StandDispatchSelection | null {
  const requiredCode = getAircraftSpecification(
    input.aircraftModel,
  ).aerodromeReferenceCode;
  const compatible = input.candidates.filter((candidate) =>
    canReferenceCodeAcceptAircraft(candidate.referenceCode, input.aircraftModel),
  );
  if (compatible.length === 0) return null;

  const ready = compatible.filter(
    (candidate) => candidate.availableAtSeconds <= input.desiredAtSeconds,
  );
  const earliestReadyAt = Math.min(
    ...compatible.map((candidate) => candidate.availableAtSeconds),
  );
  const availabilityPool = ready.length > 0
    ? ready
    : compatible.filter((candidate) => candidate.availableAtSeconds === earliestReadyAt);

  const bestRoleRank = Math.min(
    ...availabilityPool.map((candidate) => roleRank[candidate.operationalRole]),
  );
  const rolePool = availabilityPool.filter(
    (candidate) => roleRank[candidate.operationalRole] === bestRoleRank,
  );
  const buffered = rolePool.filter((candidate) =>
    hasTwoStandBuffer(candidate.id, input.occupiedStandIds),
  );
  const selectionPool = buffered.length > 0 ? buffered : rolePool;
  const selected = [...selectionPool].sort((left, right) => {
    const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
    const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;
    const distanceDifference = leftDistance - rightDistance;
    if (distanceDifference !== 0) return distanceDifference;
    const sizeDifference =
      referenceCodeRank[left.referenceCode] - referenceCodeRank[right.referenceCode];
    return sizeDifference || left.id.localeCompare(right.id);
  })[0];
  if (!selected) return null;

  const readyAtSeconds = Math.max(input.desiredAtSeconds, selected.availableAtSeconds);
  const preservedTwoStandBuffer = hasTwoStandBuffer(
    selected.id,
    input.occupiedStandIds,
  );
  const roleLabel = selected.operationalRole === "passenger_gate"
    ? "普通近机位"
    : selected.operationalRole === "remote_stand"
      ? "远机位"
      : selected.operationalRole === "cargo_stand"
        ? "货机位（容量后备）"
        : "通用机位";
  const distanceText = selected.distanceMeters === null
    ? `${input.distanceBasisLabel}暂无可靠距离`
    : `${input.distanceBasisLabel}${Math.round(selected.distanceMeters)}米`;
  const basis =
    `${input.aircraftModel}要求${requiredCode}类，${selected.id}为${selected.referenceCode}类；` +
    `${roleLabel}；${preservedTwoStandBuffer ? "保留两个空机位间隔" : "容量紧张，启用间隔降级"}；` +
    `${distanceText}。`;
  return Object.freeze({
    candidate: selected,
    readyAtSeconds,
    delayedBySeconds: Math.max(0, readyAtSeconds - input.desiredAtSeconds),
    preservedTwoStandBuffer,
    basis,
  });
}
