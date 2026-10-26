export type AircraftHealthRisk =
  | "normal"
  | "watch"
  | "urgent"
  | "critical";

export type AircraftComponentHealth = Readonly<{
  id: string;
  name: string;
  category:
    | "engine"
    | "avionics"
    | "flight_control"
    | "hydraulic"
    | "landing_gear"
    | "electrical"
    | "fuel";
  position: "left" | "right" | "center";
  serialNumber: string;
  accumulatedOperatingHours: number;
  ratedLifeHours: number;
  remainingLifeHours: number;
  healthIndex: number;
  risk: AircraftHealthRisk;
  sourceType: "simulation_assumption" | "imported_plan" | "telemetry";
}>;

export type AircraftHealthProfile = Readonly<{
  asOf: string;
  sourceType: "simulation_assumption" | "imported_plan" | "telemetry";
  airframe: Readonly<{
    accumulatedFlightHours: number;
    remainingLifeHours: number;
    ratedLifeHours: number;
    accumulatedCycles: number;
    remainingCycles: number;
    healthIndex: number;
    risk: AircraftHealthRisk;
  }>;
  components: readonly AircraftComponentHealth[];
}>;

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function healthRisk(
  remainingLifeHours: number,
  lowerLimitHours: number,
): AircraftHealthRisk {
  if (remainingLifeHours <= 0) return "critical";
  if (remainingLifeHours <= lowerLimitHours) return "urgent";
  if (remainingLifeHours <= lowerLimitHours * 1.75) return "watch";
  return "normal";
}

const COMPONENT_CATALOG = Object.freeze([
  { name: "左发动机", category: "engine", position: "left", lower: 120, span: 1380, usageFactor: 1.02 },
  { name: "右发动机", category: "engine", position: "right", lower: 120, span: 1380, usageFactor: 1.04 },
  { name: "航电任务计算机", category: "avionics", position: "center", lower: 180, span: 720, usageFactor: 0.72 },
  { name: "飞控执行组件", category: "flight_control", position: "center", lower: 160, span: 690, usageFactor: 0.66 },
  { name: "液压泵组件", category: "hydraulic", position: "center", lower: 100, span: 550, usageFactor: 0.58 },
  { name: "起落架作动筒", category: "landing_gear", position: "center", lower: 120, span: 640, usageFactor: 0.48 },
  { name: "机载电源模块", category: "electrical", position: "center", lower: 140, span: 560, usageFactor: 0.55 },
  { name: "燃油泵", category: "fuel", position: "center", lower: 80, span: 440, usageFactor: 0.44 },
  { name: "燃油滤芯", category: "fuel", position: "center", lower: 60, span: 300, usageFactor: 0.36 },
] as const);

/**
 * 在真实机载台账接入前生成可复现的健康档案。所有生成值都显式标记为
 * simulation_assumption，禁止作为真实适航或维修结论使用。
 */
export function createAssumedAircraftHealthProfile(input: {
  aircraftId: string;
  flightHours: number;
  remainingFlightHours: number;
  asOf: string;
  seed?: number;
}): AircraftHealthProfile {
  const seed = input.seed ?? 42;
  const airframeAccumulated = Math.max(0, input.flightHours);
  const airframeRemaining = Math.max(0, input.remainingFlightHours);
  const airframeRated = Math.max(
    airframeAccumulated + airframeRemaining,
    airframeAccumulated + 1,
  );
  const components = COMPONENT_CATALOG.map((component, index) => {
    const hash = hashText(
      `${seed}|${input.aircraftId}|${component.name}|health-v1`,
    );
    const accumulatedOperatingHours = round(
      Math.max(
        0,
        airframeAccumulated * component.usageFactor + (hash % 37),
      ),
    );
    const remainingLifeHours = round(
      component.lower + ((hash >>> 8) % Math.max(1, component.span)),
    );
    const ratedLifeHours = round(
      accumulatedOperatingHours + remainingLifeHours,
    );

    return Object.freeze({
      id: `${input.aircraftId}-COMP-${String(index + 1).padStart(2, "0")}`,
      name: component.name,
      category: component.category,
      position: component.position,
      serialNumber: `${input.aircraftId}-${component.category.toUpperCase()}-${String(
        (hash % 9999) + 1,
      ).padStart(4, "0")}`,
      accumulatedOperatingHours,
      ratedLifeHours,
      remainingLifeHours,
      healthIndex: round(remainingLifeHours / ratedLifeHours, 4),
      risk: healthRisk(remainingLifeHours, component.lower),
      sourceType: "simulation_assumption" as const,
    });
  });

  return Object.freeze({
    asOf: input.asOf,
    sourceType: "simulation_assumption" as const,
    airframe: Object.freeze({
      accumulatedFlightHours: round(airframeAccumulated),
      remainingLifeHours: round(airframeRemaining),
      ratedLifeHours: round(airframeRated),
      accumulatedCycles: Math.round(airframeAccumulated / 2.3),
      remainingCycles: Math.round(airframeRemaining / 2.3),
      healthIndex: round(airframeRemaining / airframeRated, 4),
      risk: healthRisk(airframeRemaining, 120),
    }),
    components: Object.freeze(components),
  });
}

export function findAircraftEngine(
  profile: AircraftHealthProfile,
  position: "left" | "right",
) {
  return profile.components.find(
    (component) =>
      component.category === "engine" && component.position === position,
  ) ?? null;
}
