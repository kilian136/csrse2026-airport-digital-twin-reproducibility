export type AircraftSpecification = {
  model: string;
  manufacturer: "Airbus" | "Boeing" | "Unknown";
  category: "narrow_body" | "wide_body";
  lengthMeters: number;
  wingspanMeters: number;
  heightMeters: number;
  maxTakeoffWeightKg: number;
  maxPassengers: number;
  rangeKm: number;
  cruiseMach: number;
  aerodromeReferenceCode: "A" | "B" | "C" | "D" | "E" | "F";
  simulationTowSafetyMarginMeters: number;
  simulationLookAheadMeters: number;
  /**
   * 用于当前数字孪生方案筛选的保守跑道长度门槛。
   * 这是可替换的仿真参数，不是制造商性能计算或适航放行结论。
   */
  simulationRunwayRequirement: Readonly<{
    departureMeters: number;
    arrivalMeters: number;
  }>;
};

/**
 * 外形尺寸取自 Airbus/Boeing 机场规划资料。
 * safety margin 和 look-ahead 是项目仿真参数，并非制造商运行限制。
 */
export const aircraftSpecifications: Record<
  string,
  AircraftSpecification
> = {
  A320neo: {
    model: "A320neo",
    manufacturer: "Airbus",
    category: "narrow_body",
    lengthMeters: 37.57,
    wingspanMeters: 35.8,
    heightMeters: 11.76,
    maxTakeoffWeightKg: 79_000,
    maxPassengers: 194,
    rangeKm: 6_300,
    cruiseMach: 0.82,
    aerodromeReferenceCode: "C",
    simulationTowSafetyMarginMeters: 12,
    simulationLookAheadMeters: 50,
    simulationRunwayRequirement: { departureMeters: 2_200, arrivalMeters: 1_800 },
  },
  A321: {
    model: "A321",
    manufacturer: "Airbus",
    category: "narrow_body",
    lengthMeters: 44.51,
    wingspanMeters: 35.8,
    heightMeters: 11.76,
    maxTakeoffWeightKg: 97_000,
    maxPassengers: 244,
    rangeKm: 7_400,
    cruiseMach: 0.82,
    aerodromeReferenceCode: "C",
    simulationTowSafetyMarginMeters: 15,
    simulationLookAheadMeters: 55,
    simulationRunwayRequirement: { departureMeters: 2_400, arrivalMeters: 1_900 },
  },
  "B737-800": {
    model: "B737-800",
    manufacturer: "Boeing",
    category: "narrow_body",
    lengthMeters: 39.5,
    wingspanMeters: 35.8,
    heightMeters: 12.5,
    maxTakeoffWeightKg: 79_010,
    maxPassengers: 189,
    rangeKm: 5_665,
    cruiseMach: 0.785,
    aerodromeReferenceCode: "C",
    simulationTowSafetyMarginMeters: 13,
    simulationLookAheadMeters: 52,
    simulationRunwayRequirement: { departureMeters: 2_300, arrivalMeters: 1_800 },
  },
  "B737 MAX 8": {
    model: "B737 MAX 8",
    manufacturer: "Boeing",
    category: "narrow_body",
    lengthMeters: 39.47,
    wingspanMeters: 35.92,
    heightMeters: 12.3,
    maxTakeoffWeightKg: 82_640,
    maxPassengers: 210,
    rangeKm: 6_480,
    cruiseMach: 0.79,
    aerodromeReferenceCode: "C",
    simulationTowSafetyMarginMeters: 13,
    simulationLookAheadMeters: 52,
    simulationRunwayRequirement: { departureMeters: 2_400, arrivalMeters: 1_900 },
  },
  A380: {
    model: "A380",
    manufacturer: "Airbus",
    category: "wide_body",
    lengthMeters: 72.7,
    wingspanMeters: 79.8,
    heightMeters: 24.1,
    maxTakeoffWeightKg: 575_000,
    maxPassengers: 853,
    rangeKm: 15_000,
    cruiseMach: 0.85,
    aerodromeReferenceCode: "F",
    simulationTowSafetyMarginMeters: 25,
    simulationLookAheadMeters: 90,
    simulationRunwayRequirement: { departureMeters: 3_000, arrivalMeters: 2_500 },
  },
};

export const fallbackAircraftSpecification: AircraftSpecification = {
  model: "UNKNOWN-NARROWBODY",
  manufacturer: "Unknown",
  category: "narrow_body",
  lengthMeters: 45,
  wingspanMeters: 36,
  heightMeters: 13,
  maxTakeoffWeightKg: 90_000,
  maxPassengers: 220,
  rangeKm: 6_000,
  cruiseMach: 0.8,
  aerodromeReferenceCode: "C",
  simulationTowSafetyMarginMeters: 15,
  simulationLookAheadMeters: 60,
  simulationRunwayRequirement: { departureMeters: 2_500, arrivalMeters: 2_000 },
};

export function getAircraftSpecification(model: string | null | undefined) {
  if (!model) return fallbackAircraftSpecification;
  return aircraftSpecifications[model] ?? fallbackAircraftSpecification;
}
