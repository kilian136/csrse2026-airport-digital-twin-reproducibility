import {
  inspectAirportOperationalResourceConfiguration,
  type AirportOperationalResourceConfiguration,
} from "../../domain/airportOperationalResources";

const maintenanceAreaIds = [
  "ZSPD-MAINTENANCE-AREA-01",
  "ZSPD-MAINTENANCE-AREA-02",
  "ZSPD-MAINTENANCE-AREA-03",
] as const;

const allOperationalAreaIds = [
  "T1-A",
  "T1-B",
  "T2-A",
  "T2-C",
  "ZSPD-CARGO-FACILITY-A",
  "ZSPD-CARGO-FACILITY-B",
  "ZSPD-MAINTENANCE-AREA-01",
  "ZSPD-MAINTENANCE-AREA-02",
  "ZSPD-MAINTENANCE-AREA-03",
  "ZSPD-T1-CONCOURSE-A",
  "ZSPD-T1-CONCOURSE-B",
  "ZSPD-T2-CONCOURSE-A",
  "ZSPD-T2-CONCOURSE-B",
  "ZSPD-T2-CONCOURSE-C",
] as const;

const supportBases = [
  ["T1A-TUG-01", "ZSPD-T1A-TUG-BASE-01", "T1A牵引车驻点一"],
  ["T1A-TUG-02", "ZSPD-T1A-TUG-BASE-02", "T1A牵引车驻点二"],
  ["T1A-TUG-03", "ZSPD-T1A-TUG-BASE-03", "T1A牵引车驻点三"],
  ["T1B-TUG-01", "ZSPD-T1B-TUG-BASE-01", "T1B牵引车驻点一"],
  ["T1B-TUG-02", "ZSPD-T1B-TUG-BASE-02", "T1B牵引车驻点二"],
  ["T1B-TUG-03", "ZSPD-T1B-TUG-BASE-03", "T1B牵引车驻点三"],
  ["T2-TUG-A", "ZSPD-T2-TUG-BASE-A", "T2航站楼牵引车驻点A"],
  ["T2-TUG-B", "ZSPD-T2-TUG-BASE-B", "T2航站楼牵引车驻点B"],
] as const;

function serviceAreasForTugBase(id: string) {
  if (id.startsWith("T2-")) {
    return [
      "ZSPD-T2-CONCOURSE-A",
      "ZSPD-T2-CONCOURSE-B",
      "ZSPD-T2-CONCOURSE-C",
    ] as const;
  }
  const terminalArea = id.startsWith("T1A")
    ? "ZSPD-T1-CONCOURSE-A"
    : "ZSPD-T1-CONCOURSE-B";
  const maintenanceArea = id === "T1A-TUG-01" || id === "T1A-TUG-02"
    ? maintenanceAreaIds[0]
    : id === "T1B-TUG-01" || id === "T1B-TUG-02"
      ? maintenanceAreaIds[1]
      : maintenanceAreaIds[2];
  return [terminalArea, maintenanceArea] as const;
}

/**
 * 浦东独立运行资源配置。
 * 坐标与设施范围使用用户确认数据；尚未提供的车辆数量、车型和维修资源
 * 保持null并由完整度门禁阻止其冒充可运行资源。
 */
export const pudongOperationalResources: AirportOperationalResourceConfiguration = Object.freeze({
  schemaVersion: "1.0.0",
  airportIdent: "ZSPD",
  maintenanceAreas: Object.freeze([
    Object.freeze({
      id: maintenanceAreaIds[0],
      featureId: maintenanceAreaIds[0],
      name: "维修区一",
      standCount: 21,
      supportedMaintenanceTypes: ["大型维修", "小型维修", "检查"] as const,
      commandAliases: ["维修区一", "浦东维修一区"],
      dispatchPriority: { 大型维修: 0, 小型维修: 1, 检查: 1 },
      tugCategoryPriority: ["heavy_tug", "standard_tug"] as const,
      availablePersonnel: 8,
      availableEquipment: 4,
      evidence: "simulation_planned",
    }),
    Object.freeze({
      id: maintenanceAreaIds[1],
      featureId: maintenanceAreaIds[1],
      name: "维修区二",
      standCount: 8,
      supportedMaintenanceTypes: ["小型维修", "检查"] as const,
      commandAliases: ["维修区二", "浦东维修二区"],
      dispatchPriority: { 小型维修: 0, 检查: 0 },
      tugCategoryPriority: ["standard_tug", "heavy_tug"] as const,
      availablePersonnel: 4,
      availableEquipment: 3,
      evidence: "simulation_planned",
    }),
    Object.freeze({
      id: maintenanceAreaIds[2],
      featureId: maintenanceAreaIds[2],
      name: "维修区三",
      standCount: 22,
      supportedMaintenanceTypes: ["大型维修", "小型维修", "检查"] as const,
      commandAliases: ["维修区三", "浦东维修三区"],
      dispatchPriority: { 大型维修: 1, 小型维修: 1, 检查: 1 },
      tugCategoryPriority: ["heavy_tug", "standard_tug"] as const,
      availablePersonnel: 8,
      availableEquipment: 4,
      evidence: "simulation_planned",
    }),
  ]),
  supportBases: Object.freeze([
    ...supportBases.map(([id, featureId, name]) =>
      Object.freeze({
        id,
        featureId,
        name,
        serviceAreaIds: Object.freeze([...serviceAreasForTugBase(id)]),
        capacity: 3,
        evidence: "user_verified_wgs84" as const,
      }),
    ),
    ...maintenanceAreaIds.map((areaId, index) =>
      Object.freeze({
        id: `ZSPD-MAINT-BASE-${String(index + 1).padStart(2, "0")}`,
        featureId: areaId,
        name: `维修区${["一", "二", "三"][index]}车辆待命点（仿真规划）`,
        serviceAreaIds: Object.freeze([areaId]),
        capacity: 4,
        evidence: "simulation_planned" as const,
      }),
    ),
    Object.freeze({
      id: "ZSPD-FUEL",
      featureId: "ZSPD-FUEL-BASE",
      name: "浦东航油车辆驻点",
      serviceAreaIds: Object.freeze([...allOperationalAreaIds]),
      capacity: 4,
      evidence: "user_verified_wgs84" as const,
    }),
    Object.freeze({
      id: "ZSPD-ARFF",
      featureId: "ZSPD-ARFF-BASE",
      name: "浦东消防救援驻点",
      serviceAreaIds: Object.freeze([...allOperationalAreaIds]),
      capacity: 6,
      evidence: "user_verified_wgs84" as const,
    }),
  ]),
  equipmentPools: Object.freeze([
    ...supportBases.map(([id, , name], index) =>
      Object.freeze({
        id: `${id}-AIRCRAFT-TUG-POOL`,
        name: `${name}牵引车资源池`,
        homeBaseId: id,
        homeAreaId: null,
        category:
          index === 0 || index === 4
            ? "heavy_tug" as const
            : "standard_tug" as const,
        plannedCount: 1,
        serviceAreaIds: Object.freeze([...serviceAreasForTugBase(id)]),
        evidence: "simulation_planned" as const,
      }),
    ),
    ...maintenanceAreaIds.map((areaId, index) =>
      Object.freeze({
        id: `ZSPD-MAINT-${String(index + 1).padStart(2, "0")}-VEHICLE-POOL`,
        name: `维修区${["一", "二", "三"][index]}维修车辆资源池`,
        homeBaseId: `ZSPD-MAINT-BASE-${String(index + 1).padStart(2, "0")}`,
        homeAreaId: areaId,
        category:
          index === 1
            ? "line_maintenance_vehicle" as const
            : "heavy_maintenance_vehicle" as const,
        plannedCount: 2,
        serviceAreaIds: Object.freeze([areaId]),
        evidence: "simulation_planned" as const,
      }),
    ),
    Object.freeze({
      id: "ZSPD-GPU-POOL",
      name: "浦东地面电源车资源池",
      homeBaseId: "T1A-TUG-02",
      homeAreaId: null,
      category: "ground_power_vehicle" as const,
      plannedCount: 4,
      serviceAreaIds: Object.freeze([
        "ZSPD-T1-CONCOURSE-A",
        "ZSPD-T1-CONCOURSE-B",
        "ZSPD-T2-CONCOURSE-A",
        "ZSPD-T2-CONCOURSE-B",
        "ZSPD-T2-CONCOURSE-C",
      ]),
      evidence: "simulation_planned" as const,
    }),
    Object.freeze({
      id: "ZSPD-FUEL-POOL",
      name: "浦东航空加油车资源池",
      homeBaseId: "ZSPD-FUEL",
      homeAreaId: null,
      category: "fuel_vehicle" as const,
      plannedCount: 4,
      serviceAreaIds: Object.freeze([...allOperationalAreaIds]),
      evidence: "user_verified_wgs84" as const,
    }),
    Object.freeze({
      id: "ZSPD-ARFF-POOL",
      name: "浦东航空消防救援车资源池",
      homeBaseId: "ZSPD-ARFF",
      homeAreaId: null,
      category: "rescue_vehicle" as const,
      plannedCount: 6,
      serviceAreaIds: Object.freeze([...allOperationalAreaIds]),
      evidence: "user_verified_wgs84" as const,
    }),
    Object.freeze({
      id: "ZSPD-FOLLOW-ME-POOL",
      name: "浦东航空器引导车资源池",
      homeBaseId: "T2-TUG-A",
      homeAreaId: null,
      category: "follow_me_vehicle" as const,
      plannedCount: 3,
      serviceAreaIds: Object.freeze([
        "ZSPD-T1-CONCOURSE-A",
        "ZSPD-T1-CONCOURSE-B",
        "ZSPD-T2-CONCOURSE-A",
        "ZSPD-T2-CONCOURSE-B",
        "ZSPD-T2-CONCOURSE-C",
      ]),
      evidence: "simulation_planned" as const,
    }),
  ]),
});

export const pudongOperationalResourceReadiness =
  inspectAirportOperationalResourceConfiguration(pudongOperationalResources);
