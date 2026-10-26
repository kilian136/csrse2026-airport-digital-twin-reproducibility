import type { MaintenanceType } from "./maintenance";
import type { GroundEquipmentCategory } from "./groundSupport";

export type OperationalResourceEvidence =
  | "user_verified_wgs84"
  | "simulation_planned"
  | "awaiting_user_input";

export type AirportMaintenanceAreaResource = Readonly<{
  id: string;
  featureId: string;
  name: string;
  standCount: number;
  supportedMaintenanceTypes: readonly MaintenanceType[];
  commandAliases: readonly string[];
  dispatchPriority: Readonly<Partial<Record<MaintenanceType, number>>>;
  tugCategoryPriority: readonly Extract<
    GroundEquipmentCategory,
    "standard_tug" | "heavy_tug"
  >[];
  /** 未核实的人员或设备数量必须为null，禁止借用其他机场数据。 */
  availablePersonnel: number | null;
  availableEquipment: number | null;
  evidence: OperationalResourceEvidence;
}>;

export type AirportSupportBaseResource = Readonly<{
  id: string;
  featureId: string;
  name: string;
  serviceAreaIds: readonly string[];
  capacity: number | null;
  evidence: OperationalResourceEvidence;
}>;

export type AirportEquipmentPoolResource = Readonly<{
  id: string;
  name: string;
  homeBaseId: string | null;
  homeAreaId: string | null;
  category: GroundEquipmentCategory | null;
  plannedCount: number | null;
  serviceAreaIds: readonly string[];
  evidence: OperationalResourceEvidence;
}>;

export type AirportOperationalResourceConfiguration = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  maintenanceAreas: readonly AirportMaintenanceAreaResource[];
  supportBases: readonly AirportSupportBaseResource[];
  equipmentPools: readonly AirportEquipmentPoolResource[];
}>;

export type AirportOperationalResourceReadiness = Readonly<{
  airportIdent: string;
  maintenanceAreaCount: number;
  maintenanceStandCount: number;
  verifiedSupportBaseCount: number;
  configuredEquipmentPoolCount: number;
  blockingReasons: readonly string[];
  readyForSimulationState: boolean;
  verifiedForRealOperations: boolean;
}>;

function assertUniqueIds(label: string, ids: readonly string[]) {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`${label}存在重复编号：${[...new Set(duplicates)].join("、")}`);
  }
}

export function inspectAirportOperationalResourceConfiguration(
  configuration: AirportOperationalResourceConfiguration,
): AirportOperationalResourceReadiness {
  if (configuration.schemaVersion !== "1.0.0" || !configuration.airportIdent.trim()) {
    throw new Error("机场运行资源配置契约无效。");
  }
  assertUniqueIds(
    "维修区域",
    configuration.maintenanceAreas.map((area) => area.id),
  );
  assertUniqueIds(
    "保障基地",
    configuration.supportBases.map((base) => base.id),
  );
  assertUniqueIds(
    "设备池",
    configuration.equipmentPools.map((pool) => pool.id),
  );

  const areaIds = new Set(configuration.maintenanceAreas.map((area) => area.id));
  const baseIds = new Set(configuration.supportBases.map((base) => base.id));
  const blockingReasons: string[] = [];

  configuration.maintenanceAreas.forEach((area) => {
    if (area.standCount <= 0 || area.supportedMaintenanceTypes.length === 0) {
      blockingReasons.push(`${area.name}缺少有效机位或维修能力配置`);
    }
    if (area.availablePersonnel === null || area.availableEquipment === null) {
      blockingReasons.push(`${area.name}的人员或维修设备数量待确认`);
    }
  });

  configuration.supportBases.forEach((base) => {
    if (base.capacity === null) {
      blockingReasons.push(`${base.name}的车辆容量待确认`);
    }
  });

  configuration.equipmentPools.forEach((pool) => {
    if (pool.homeBaseId && !baseIds.has(pool.homeBaseId)) {
      throw new Error(`${pool.name}引用了不存在的保障基地${pool.homeBaseId}。`);
    }
    if (pool.homeAreaId && !areaIds.has(pool.homeAreaId)) {
      throw new Error(`${pool.name}引用了不存在的维修区域${pool.homeAreaId}。`);
    }
    if (!pool.category || pool.plannedCount === null) {
      blockingReasons.push(`${pool.name}的车型或数量待确认`);
    }
  });

  return Object.freeze({
    airportIdent: configuration.airportIdent,
    maintenanceAreaCount: configuration.maintenanceAreas.length,
    maintenanceStandCount: configuration.maintenanceAreas.reduce(
      (sum, area) => sum + area.standCount,
      0,
    ),
    verifiedSupportBaseCount: configuration.supportBases.filter(
      (base) => base.evidence === "user_verified_wgs84",
    ).length,
    configuredEquipmentPoolCount: configuration.equipmentPools.filter(
      (pool) => pool.category !== null && pool.plannedCount !== null,
    ).length,
    blockingReasons: Object.freeze([...new Set(blockingReasons)]),
    readyForSimulationState: blockingReasons.length === 0,
    verifiedForRealOperations:
      blockingReasons.length === 0 &&
      configuration.maintenanceAreas.every(
        (area) => area.evidence === "user_verified_wgs84",
      ) &&
      configuration.supportBases.every(
        (base) => base.evidence === "user_verified_wgs84",
      ) &&
      configuration.equipmentPools.every(
        (pool) => pool.evidence === "user_verified_wgs84",
      ),
  });
}
