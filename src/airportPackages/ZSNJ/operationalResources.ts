import {
  inspectAirportOperationalResourceConfiguration,
  type AirportOperationalResourceConfiguration,
} from "../../domain/airportOperationalResources";

const passengerAreaIds = [
  "T1",
  "T2",
] as const;

const allOperationalAreaIds = [
  ...passengerAreaIds,
  "ZSNJ",
  "ZSNJ-MAINTENANCE-AREA",
] as const;

const tugBases = [
  ["ZSNJ-TUG-01", "ZSNJ-TUG-BASE-01", "牵引车停驻点一", allOperationalAreaIds],
  ["ZSNJ-TUG-02", "ZSNJ-TUG-BASE-02", "牵引车停驻点二", allOperationalAreaIds],
  ["ZSNJ-TUG-03", "ZSNJ-TUG-BASE-03", "牵引车停驻点三", allOperationalAreaIds],
  ["ZSNJ-TUG-04", "ZSNJ-TUG-BASE-04", "牵引车停驻点四", allOperationalAreaIds],
] as const;

/**
 * 南京独立运行资源配置。
 * 驻点与区域坐标来自用户核实的WGS84数据；人员、车辆和设备编制仅用于
 * 72小时仿真规划，不代表现实机场的正式编制。
 */
export const nanjingOperationalResources: AirportOperationalResourceConfiguration =
  Object.freeze({
    schemaVersion: "1.0.0",
    airportIdent: "ZSNJ",
    maintenanceAreas: Object.freeze([
      Object.freeze({
        id: "ZSNJ-MAINTENANCE-AREA",
        featureId: "ZSNJ-MAINTENANCE-AREA",
        name: "南京维修区",
        standCount: 41,
        supportedMaintenanceTypes: ["大型维修", "小型维修", "检查"] as const,
        commandAliases: ["南京维修区", "维修区", "南京机务区"],
        dispatchPriority: { 大型维修: 0, 小型维修: 0, 检查: 0 },
        tugCategoryPriority: ["heavy_tug", "standard_tug"] as const,
        availablePersonnel: 10,
        availableEquipment: 5,
        evidence: "simulation_planned" as const,
      }),
    ]),
    supportBases: Object.freeze([
      ...tugBases.map(([id, featureId, name, serviceAreaIds]) =>
        Object.freeze({
          id,
          featureId,
          name,
          serviceAreaIds: Object.freeze([...serviceAreaIds]),
          capacity: 2,
          evidence: "user_verified_wgs84" as const,
        }),
      ),
      Object.freeze({
        id: "ZSNJ-MAINT-BASE",
        featureId: "ZSNJ-MAINTENANCE-AREA",
        name: "南京维修车辆待命点（维修区中心）",
        serviceAreaIds: Object.freeze(["ZSNJ-MAINTENANCE-AREA"]),
        capacity: 4,
        evidence: "simulation_planned" as const,
      }),
      Object.freeze({
        id: "ZSNJ-FUEL",
        featureId: "ZSNJ-FUEL-BASE",
        name: "南京航油车辆驻点",
        serviceAreaIds: Object.freeze([...allOperationalAreaIds]),
        capacity: 3,
        evidence: "user_verified_wgs84" as const,
      }),
      Object.freeze({
        id: "ZSNJ-ARFF",
        featureId: "ZSNJ-ARFF-BASE",
        name: "南京消防救援驻点",
        serviceAreaIds: Object.freeze([...allOperationalAreaIds]),
        capacity: 4,
        evidence: "user_verified_wgs84" as const,
      }),
    ]),
    equipmentPools: Object.freeze([
      ...tugBases.map(([id, , name], index) =>
        Object.freeze({
          id: `${id}-AIRCRAFT-TUG-POOL`,
          name: `${name}牵引车资源池`,
          homeBaseId: id,
          homeAreaId: null,
          category: index === 0 ? "heavy_tug" as const : "standard_tug" as const,
          plannedCount: 1,
          serviceAreaIds: Object.freeze([...tugBases[index][3]]),
          evidence: "simulation_planned" as const,
        }),
      ),
      Object.freeze({
        id: "ZSNJ-MAINT-VEHICLE-POOL",
        name: "南京维修车辆资源池",
        homeBaseId: "ZSNJ-MAINT-BASE",
        homeAreaId: "ZSNJ-MAINTENANCE-AREA",
        category: "heavy_maintenance_vehicle" as const,
        plannedCount: 3,
        serviceAreaIds: Object.freeze(["ZSNJ-MAINTENANCE-AREA"]),
        evidence: "simulation_planned" as const,
      }),
      Object.freeze({
        id: "ZSNJ-GPU-POOL",
        name: "南京地面电源车资源池",
        homeBaseId: "ZSNJ-TUG-02",
        homeAreaId: null,
        category: "ground_power_vehicle" as const,
        plannedCount: 3,
        serviceAreaIds: Object.freeze([...passengerAreaIds]),
        evidence: "simulation_planned" as const,
      }),
      Object.freeze({
        id: "ZSNJ-FUEL-POOL",
        name: "南京航空加油车资源池",
        homeBaseId: "ZSNJ-FUEL",
        homeAreaId: null,
        category: "fuel_vehicle" as const,
        plannedCount: 3,
        serviceAreaIds: Object.freeze([...allOperationalAreaIds]),
        evidence: "simulation_planned" as const,
      }),
      Object.freeze({
        id: "ZSNJ-ARFF-POOL",
        name: "南京航空消防救援车资源池",
        homeBaseId: "ZSNJ-ARFF",
        homeAreaId: null,
        category: "rescue_vehicle" as const,
        plannedCount: 4,
        serviceAreaIds: Object.freeze([...allOperationalAreaIds]),
        evidence: "simulation_planned" as const,
      }),
      Object.freeze({
        id: "ZSNJ-FOLLOW-ME-POOL",
        name: "南京航空器引导车资源池",
        homeBaseId: "ZSNJ-TUG-04",
        homeAreaId: null,
        category: "follow_me_vehicle" as const,
        plannedCount: 2,
        serviceAreaIds: Object.freeze([...allOperationalAreaIds]),
        evidence: "simulation_planned" as const,
      }),
    ]),
  });

export const nanjingOperationalResourceReadiness =
  inspectAirportOperationalResourceConfiguration(nanjingOperationalResources);
