import type { SimulationInputContract } from "./simulationContract";

export type SimulationWeatherCondition =
  | "clear"
  | "rain"
  | "thunderstorm"
  | "low_visibility"
  | "strong_wind";

export type SimulationWeatherWindow = Readonly<{
  id: string;
  airportIdent: string;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
  condition: SimulationWeatherCondition;
  severity: "normal" | "moderate" | "severe";
  runwayCapacityFactor: number;
  groundSpeedFactor: number;
}>;

export type SimulationTrafficWindow = Readonly<{
  id: string;
  airportIdent: string;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
  demandLevel: "normal" | "busy" | "peak";
  demandMultiplier: number;
}>;

export type SimulationEquipmentOutage = Readonly<{
  id: string;
  airportIdent: string;
  equipmentId: string;
  equipmentCategory: string;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
  reason: "planned_maintenance" | "simulated_failure";
}>;

export type SimulationRunwayClosure = Readonly<{
  id: string;
  airportIdent: string;
  runwayId: string;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
  reason: "inspection" | "surface_contamination" | "incident";
}>;

export type SimulationDisturbanceSourceRecord = Readonly<{
  domain: "weather" | "traffic" | "external_equipment" | "runway_operations";
  adapterId: string;
  version: string;
  sourceType: "synthetic" | "external";
  note: string;
}>;

export type SimulationDisturbanceDataset = Readonly<{
  schemaVersion: "1.0";
  weatherWindows: readonly SimulationWeatherWindow[];
  trafficWindows: readonly SimulationTrafficWindow[];
  equipmentOutages: readonly SimulationEquipmentOutage[];
  runwayClosures: readonly SimulationRunwayClosure[];
  sources: readonly SimulationDisturbanceSourceRecord[];
}>;

export type SimulationDisturbanceAdapterContext = Readonly<{
  inputContract: SimulationInputContract;
  seed: number;
}>;

export type SimulationDisturbanceDataSourceAdapters = Readonly<{
  weather: Readonly<{
    id: string;
    version: string;
    sourceType: "synthetic" | "external";
    load: (context: SimulationDisturbanceAdapterContext) => readonly SimulationWeatherWindow[];
  }>;
  traffic: Readonly<{
    id: string;
    version: string;
    sourceType: "synthetic" | "external";
    load: (context: SimulationDisturbanceAdapterContext) => readonly SimulationTrafficWindow[];
  }>;
  externalEquipment: Readonly<{
    id: string;
    version: string;
    sourceType: "synthetic" | "external";
    load: (context: SimulationDisturbanceAdapterContext) => readonly SimulationEquipmentOutage[];
  }>;
  runwayOperations?: Readonly<{
    id: string;
    version: string;
    sourceType: "synthetic" | "external";
    load: (context: SimulationDisturbanceAdapterContext) => readonly SimulationRunwayClosure[];
  }>;
}>;

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number, namespace: string) {
  let state = (seed ^ hashText(namespace)) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const syntheticWeatherAdapter: SimulationDisturbanceDataSourceAdapters["weather"] =
  Object.freeze({
    id: "synthetic_airport_weather_v1",
    version: "1.0.0",
    sourceType: "synthetic" as const,
    load: ({ inputContract, seed }: SimulationDisturbanceAdapterContext) =>
      Object.freeze(inputContract.airports.flatMap((airport) => {
        const random = createRandom(seed, `weather:${airport.ident}`);
        return Array.from({ length: 3 }, (_, dayIndex) => {
          const sample = random();
          const condition: SimulationWeatherCondition = sample < 0.08
            ? "thunderstorm"
            : sample < 0.18
              ? "low_visibility"
              : sample < 0.32
                ? "rain"
                : sample < 0.4
                  ? "strong_wind"
                  : "clear";
          const severe = condition === "thunderstorm";
          const normal = condition === "clear";
          const startOffsetSeconds = dayIndex * 86_400 + Math.floor((4 + random() * 12) * 3_600);
          const durationSeconds = Math.floor((normal ? 3 + random() * 3 : 2 + random() * 4) * 3_600);
          return Object.freeze({
            id: `WEATHER-${airport.ident}-D${dayIndex + 1}`,
            airportIdent: airport.ident,
            startOffsetSeconds,
            endOffsetSeconds: Math.min(72 * 3_600, startOffsetSeconds + durationSeconds),
            condition,
            severity: severe ? "severe" as const : normal ? "normal" as const : "moderate" as const,
            runwayCapacityFactor: severe ? 0.55 : normal ? 1 : 0.78,
            groundSpeedFactor: severe ? 0.65 : normal ? 1 : 0.82,
          });
        });
      })),
  });

const syntheticTrafficAdapter: SimulationDisturbanceDataSourceAdapters["traffic"] =
  Object.freeze({
    id: "synthetic_airport_traffic_v1",
    version: "1.0.0",
    sourceType: "synthetic" as const,
    load: ({ inputContract, seed }: SimulationDisturbanceAdapterContext) =>
      Object.freeze(inputContract.airports.flatMap((airport) => {
        const random = createRandom(seed, `traffic:${airport.ident}`);
        return Array.from({ length: 3 }, (_, dayIndex) => [8, 18].map((hour, peakIndex) => {
          const peak = random() > 0.35;
          const startOffsetSeconds = dayIndex * 86_400 + hour * 3_600;
          return Object.freeze({
            id: `TRAFFIC-${airport.ident}-D${dayIndex + 1}-${peakIndex === 0 ? "AM" : "PM"}`,
            airportIdent: airport.ident,
            startOffsetSeconds,
            endOffsetSeconds: startOffsetSeconds + 2 * 3_600,
            demandLevel: peak ? "peak" as const : "busy" as const,
            demandMultiplier: round(peak ? 1.35 + random() * 0.2 : 1.15 + random() * 0.15),
          });
        })).flat();
      })),
  });

const syntheticEquipmentAdapter: SimulationDisturbanceDataSourceAdapters["externalEquipment"] =
  Object.freeze({
    id: "synthetic_external_equipment_v1",
    version: "1.0.0",
    sourceType: "synthetic" as const,
    load: ({ inputContract, seed }: SimulationDisturbanceAdapterContext) =>
      Object.freeze(inputContract.airports.flatMap((airport) => {
        const random = createRandom(seed, `equipment:${airport.ident}`);
        const eligible = airport.supportVehicles
          .filter((vehicle) => vehicle.geospatialReadiness === "ready")
          .sort((left, right) => left.id.localeCompare(right.id));
        if (eligible.length === 0 || random() > 0.6) return [];
        const vehicle = eligible[Math.floor(random() * eligible.length)];
        const startOffsetSeconds = Math.floor((6 + random() * 54) * 3_600);
        const durationSeconds = Math.floor((1 + random() * 5) * 3_600);
        return [Object.freeze({
          id: `EQUIPMENT-OUTAGE-${airport.ident}-${vehicle.id}`,
          airportIdent: airport.ident,
          equipmentId: vehicle.id,
          equipmentCategory: vehicle.category,
          startOffsetSeconds,
          endOffsetSeconds: Math.min(72 * 3_600, startOffsetSeconds + durationSeconds),
          reason: random() < 0.5 ? "planned_maintenance" as const : "simulated_failure" as const,
        })];
      })),
  });

export const DEFAULT_SIMULATION_DISTURBANCE_ADAPTERS = Object.freeze({
  weather: syntheticWeatherAdapter,
  traffic: syntheticTrafficAdapter,
  externalEquipment: syntheticEquipmentAdapter,
});

function assertSourceIdentity(
  adapter: Readonly<{ id: string; version: string }>,
  label: string,
) {
  if (!adapter.id.trim() || !adapter.version.trim()) {
    throw new Error(`${label}数据源必须提供非空ID和版本。`);
  }
}

function assertUniqueIds(records: readonly Readonly<{ id: string }>[], label: string) {
  const ids = new Set<string>();
  records.forEach((record) => {
    if (!record.id.trim() || ids.has(record.id)) {
      throw new Error(`${label}数据存在空ID或重复ID：${record.id || "<empty>"}。`);
    }
    ids.add(record.id);
  });
}

function assertWindow(
  record: Readonly<{
    id: string;
    airportIdent: string;
    startOffsetSeconds: number;
    endOffsetSeconds: number;
  }>,
  airportIdents: ReadonlySet<string>,
  horizonSeconds: number,
) {
  if (!airportIdents.has(record.airportIdent)) {
    throw new Error(`扰动${record.id}引用了未配置机场${record.airportIdent}。`);
  }
  if (
    !Number.isFinite(record.startOffsetSeconds) ||
    !Number.isFinite(record.endOffsetSeconds) ||
    record.startOffsetSeconds < 0 ||
    record.endOffsetSeconds <= record.startOffsetSeconds ||
    record.endOffsetSeconds > horizonSeconds
  ) {
    throw new Error(`扰动${record.id}的时间窗超出仿真时域或顺序无效。`);
  }
}

export function prepareSimulationDisturbanceDataset(
  inputContract: SimulationInputContract,
  seed: number,
  adapters: SimulationDisturbanceDataSourceAdapters = DEFAULT_SIMULATION_DISTURBANCE_ADAPTERS,
): SimulationDisturbanceDataset {
  const context = Object.freeze({ inputContract, seed });
  assertSourceIdentity(adapters.weather, "天气");
  assertSourceIdentity(adapters.traffic, "流量");
  assertSourceIdentity(adapters.externalEquipment, "外部设备");
  if (adapters.runwayOperations) {
    assertSourceIdentity(adapters.runwayOperations, "跑道运行");
  }
  const weatherWindows = [...adapters.weather.load(context)];
  const trafficWindows = [...adapters.traffic.load(context)];
  const equipmentOutages = [...adapters.externalEquipment.load(context)];
  const runwayClosures = [...(adapters.runwayOperations?.load(context) ?? [])];
  assertUniqueIds(weatherWindows, "天气窗口");
  assertUniqueIds(trafficWindows, "流量窗口");
  assertUniqueIds(equipmentOutages, "设备停用窗口");
  assertUniqueIds(runwayClosures, "跑道关闭窗口");
  const airportIdents = new Set(inputContract.airports.map((airport) => airport.ident));
  const horizonSeconds = inputContract.horizonHours * 3_600;
  weatherWindows.forEach((window) => {
    assertWindow(window, airportIdents, horizonSeconds);
    if (window.runwayCapacityFactor <= 0 || window.runwayCapacityFactor > 1 ||
      window.groundSpeedFactor <= 0 || window.groundSpeedFactor > 1) {
      throw new Error(`天气窗口${window.id}的容量或速度系数无效。`);
    }
  });
  trafficWindows.forEach((window) => {
    assertWindow(window, airportIdents, horizonSeconds);
    if (window.demandMultiplier < 0.5 || window.demandMultiplier > 3) {
      throw new Error(`流量窗口${window.id}的需求倍率无效。`);
    }
  });
  equipmentOutages.forEach((window) => {
    assertWindow(window, airportIdents, horizonSeconds);
    const airport = inputContract.airports.find(
      (candidate) => candidate.ident === window.airportIdent,
    );
    if (!airport?.supportVehicles.some((vehicle) => vehicle.id === window.equipmentId)) {
      throw new Error(`设备停用窗口${window.id}引用了不存在的设备${window.equipmentId}。`);
    }
  });
  runwayClosures.forEach((window) => {
    assertWindow(window, airportIdents, horizonSeconds);
    const airport = inputContract.airports.find(
      (candidate) => candidate.ident === window.airportIdent,
    );
    if (!airport?.runways.some((runway) => runway.id === window.runwayId)) {
      throw new Error(`跑道关闭窗口${window.id}引用了不存在的跑道${window.runwayId}。`);
    }
  });
  const runwayOperationSources = adapters.runwayOperations
    ? [Object.freeze({
        domain: "runway_operations" as const,
        adapterId: adapters.runwayOperations.id,
        version: adapters.runwayOperations.version,
        sourceType: adapters.runwayOperations.sourceType,
        note: "跑道临时关闭窗口已通过独立适配器载入。",
      })]
    : [];
  return Object.freeze({
    schemaVersion: "1.0" as const,
    weatherWindows: Object.freeze(weatherWindows),
    trafficWindows: Object.freeze(trafficWindows),
    equipmentOutages: Object.freeze(equipmentOutages),
    runwayClosures: Object.freeze(runwayClosures),
    sources: Object.freeze([
      Object.freeze({
        domain: "weather" as const,
        adapterId: adapters.weather.id,
        version: adapters.weather.version,
        sourceType: adapters.weather.sourceType,
        note: "三日机场天气窗口已通过独立适配器载入。",
      }),
      Object.freeze({
        domain: "traffic" as const,
        adapterId: adapters.traffic.id,
        version: adapters.traffic.version,
        sourceType: adapters.traffic.sourceType,
        note: "三日机场流量窗口已通过独立适配器载入。",
      }),
      Object.freeze({
        domain: "external_equipment" as const,
        adapterId: adapters.externalEquipment.id,
        version: adapters.externalEquipment.version,
        sourceType: adapters.externalEquipment.sourceType,
        note: "外部保障设备停用窗口已通过独立适配器载入。",
      }),
      ...runwayOperationSources,
    ]),
  });
}
