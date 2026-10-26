import {
  inspectAirportOperationalResourceConfiguration,
  type AirportOperationalResourceConfiguration,
} from "../../domain/airportOperationalResources";
import { createAirportOperationalPosition } from "../../domain/geo";
import type { MaintenanceApronState } from "../../domain/maintenance";
import type {
  GroundEquipmentCapability,
  GroundEquipmentCategory,
  GroundSupportEquipment,
  GroundSupportState,
  SupportBase,
  SupportParkingSpot,
} from "../../domain/groundSupport";
import type { AirportGeoreferencedPoint } from "../../types/airport";
import type {
  AirportGeospatialIntegration,
  AirportSpatialCoordinate,
  ProjectedAirportFeature,
} from "./types";

export type MaterializedAirportOperationalResources = Readonly<{
  airportIdent: string;
  maintenanceAprons: Record<string, MaintenanceApronState>;
  groundSupport: GroundSupportState;
}>;

function featureCenter(
  feature: ProjectedAirportFeature,
): AirportSpatialCoordinate | null {
  if (feature.geometry.type === "Point") {
    return feature.geometry.coordinates;
  }
  const coordinates = feature.geometry.type === "LineString"
    ? feature.geometry.coordinates
    : feature.geometry.coordinates[0];
  if (coordinates.length === 0) return null;
  const divisor = coordinates.length;
  return {
    wgs84: {
      longitude:
        coordinates.reduce((sum, item) => sum + item.wgs84.longitude, 0) /
        divisor,
      latitude:
        coordinates.reduce((sum, item) => sum + item.wgs84.latitude, 0) /
        divisor,
    },
    local: {
      eastMeters:
        coordinates.reduce((sum, item) => sum + item.local.eastMeters, 0) /
        divisor,
      northMeters:
        coordinates.reduce((sum, item) => sum + item.local.northMeters, 0) /
        divisor,
    },
  };
}

function equipmentCapability(
  category: GroundEquipmentCategory,
): GroundEquipmentCapability {
  const base = {
    supportedAircraftModels: [],
    supportedMaintenanceTypes: [],
    maxTowWeightTons: null,
    canTowAircraft: false,
    canTransportParts: false,
    canPerformMaintenance: false,
  } satisfies GroundEquipmentCapability;
  if (category === "heavy_tug") {
    return { ...base, maxTowWeightTons: 260, canTowAircraft: true };
  }
  if (category === "standard_tug") {
    return { ...base, maxTowWeightTons: 110, canTowAircraft: true };
  }
  if (category === "heavy_maintenance_vehicle") {
    return {
      ...base,
      supportedMaintenanceTypes: ["大型维修", "小型维修", "检查"],
      canPerformMaintenance: true,
    };
  }
  if (category === "line_maintenance_vehicle") {
    return {
      ...base,
      supportedMaintenanceTypes: ["小型维修", "检查"],
      canPerformMaintenance: true,
    };
  }
  if (category === "parts_transport_vehicle") {
    return { ...base, canTransportParts: true };
  }
  return base;
}

function georeferencedPoint(
  integration: AirportGeospatialIntegration,
  coordinate: AirportSpatialCoordinate,
): AirportGeoreferencedPoint {
  const operationalPosition = createAirportOperationalPosition({
    longitude: coordinate.wgs84.longitude,
    latitude: coordinate.wgs84.latitude,
    eastMeters: coordinate.local.eastMeters,
    northMeters: coordinate.local.northMeters,
    authority: "wgs84_configuration",
  });
  const map = integration.coordinateConverter.wgs84ToMap(coordinate.wgs84);
  return {
    x: map.x,
    y: map.y,
    latitude: coordinate.wgs84.latitude,
    longitude: coordinate.wgs84.longitude,
    eastMeters: coordinate.local.eastMeters,
    northMeters: coordinate.local.northMeters,
    operationalPosition,
  };
}

/**
 * 将机场资源配置转换成共享维修/保障运行状态。只有完整度门禁通过后才会生成，
 * 因而不会把null资源或其他机场的默认值带入运行系统。
 */
export function materializeAirportOperationalResources(
  configuration: AirportOperationalResourceConfiguration,
  integration: AirportGeospatialIntegration,
): MaterializedAirportOperationalResources {
  if (configuration.airportIdent !== integration.airportIdent) {
    throw new Error("运行资源配置与地理配置不属于同一机场。");
  }
  const readiness = inspectAirportOperationalResourceConfiguration(configuration);
  if (!readiness.readyForSimulationState) {
    throw new Error(`机场运行资源尚不完整：${readiness.blockingReasons.join("；")}`);
  }

  const features = new Map(
    integration.features.map((feature) => [feature.properties.id, feature]),
  );
  const maintenanceAprons = Object.fromEntries(
    configuration.maintenanceAreas.map((area) => [
      area.id,
      {
        id: area.id,
        name: area.name,
        commandAliases: [...area.commandAliases],
        dispatchPriority: { ...area.dispatchPriority },
        tugCategoryPriority: [...area.tugCategoryPriority],
        capacity: area.standCount,
        occupied: 0,
        supportedMaintenanceTypes: [...area.supportedMaintenanceTypes],
        availablePersonnel: area.availablePersonnel!,
        availableEquipment: area.availableEquipment!,
      } satisfies MaintenanceApronState,
    ]),
  );

  const bases: Record<string, SupportBase> = {};
  const basePoints = new Map<string, AirportGeoreferencedPoint>();
  configuration.supportBases.forEach((base) => {
    const feature = features.get(base.featureId);
    const center = feature ? featureCenter(feature) : null;
    if (!feature || !center) {
      throw new Error(`${base.name}缺少可用的WGS84配置要素。`);
    }
    const point = georeferencedPoint(integration, center);
    const equipmentPoolServiceAreas = configuration.equipmentPools
      .filter((pool) => pool.homeBaseId === base.id)
      .flatMap((pool) => pool.serviceAreaIds);
    basePoints.set(base.id, point);
    bases[base.id] = {
      id: base.id,
      name: base.name,
      operationalPosition: point.operationalPosition,
      capacity: base.capacity!,
      serviceAreas: [
        ...new Set([
          ...base.serviceAreaIds,
          ...equipmentPoolServiceAreas,
        ]),
      ],
      description:
        base.evidence === "user_verified_wgs84"
          ? "用户核实的WGS84保障驻点；车辆编制为仿真规划。"
          : "仿真规划待命点，不代表现实机场部门或停车位。",
    };
  });

  const parkingSpots: Record<string, SupportParkingSpot> = {};
  const equipment: Record<string, GroundSupportEquipment> = {};
  configuration.equipmentPools.forEach((pool) => {
    if (!pool.homeBaseId || !pool.category || pool.plannedCount === null) {
      throw new Error(`${pool.name}尚不能生成仿真设备。`);
    }
    const base = bases[pool.homeBaseId];
    const point = basePoints.get(pool.homeBaseId);
    if (!base || !point) {
      throw new Error(`${pool.name}缺少有效基地位置。`);
    }
    for (let index = 1; index <= pool.plannedCount; index += 1) {
      const serial = String(index).padStart(2, "0");
      const equipmentId = `${pool.id}-${serial}`;
      const parkingSpotId = `${pool.id}-SPOT-${serial}`;
      parkingSpots[parkingSpotId] = {
        id: parkingSpotId,
        baseId: pool.homeBaseId,
        operationalPosition: point.operationalPosition,
        geospatialReadiness: "base_anchor",
        heading: 0,
        status: "占用",
        equipmentId,
        allowedCategories: [pool.category],
      };
      equipment[equipmentId] = {
        id: equipmentId,
        name: `${pool.name}${index}号`,
        category: pool.category,
        status: "可用",
        geospatialReadiness: "ready",
        homeBaseId: pool.homeBaseId,
        currentParkingSpotId: parkingSpotId,
        position: { ...point },
        heading: 0,
        speed: 0,
        energyPercent: 100,
        capability: equipmentCapability(pool.category),
        currentTaskId: null,
        description: "仿真规划设备；编号、数量和车型可在机场资源包内单独调整。",
      };
    }
  });

  return Object.freeze({
    airportIdent: configuration.airportIdent,
    maintenanceAprons,
    groundSupport: {
      bases,
      parkingSpots,
      waitingAreas: {},
      equipment,
      tasks: [],
      activeTaskId: null,
      vehicleRoutes: [],
      activeVehicleRouteId: null,
      showAllEquipment: false,
    },
  });
}
