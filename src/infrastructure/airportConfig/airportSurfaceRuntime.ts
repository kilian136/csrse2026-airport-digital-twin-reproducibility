import type { AirportOperationalPosition } from "../../domain/geo";
import { createAirportOperationalPosition } from "../../domain/geo";
import type { ProjectedAirportFeature } from "./types";
import { createFleetAircraftId } from "../../domain/fleetIdentity";
import {
  createAssumedAircraftHealthProfile,
  type AircraftHealthProfile,
} from "../../domain/aircraft";

export type AirportSurfaceRuntimeStand = Readonly<{
  id: string;
  name: string;
  areaId: string;
  status: "空闲" | "占用";
  aircraftId: string | null;
  operationalPosition: AirportOperationalPosition;
}>;

export type AirportSurfaceRuntimeAircraft = Readonly<{
  id: string;
  model: string;
  status: "可用" | "过站保障";
  risk: "低";
  currentStandId: string;
  flightHours: number;
  remainingFlightHours: number;
  healthProfile: AircraftHealthProfile;
  description: string;
}>;

export type AirportSurfaceRuntimeState = Readonly<{
  airportIdent: string;
  generatedAt: string;
  readiness: "surface_monitoring" | "controlled_surface_operation";
  capabilities: Readonly<{
    monitoring: true;
    commandDispatch: boolean;
    maintenance: false;
    groundSupport: false;
  }>;
  occupancyPolicy: Readonly<{
    selectionMode: "ratio" | "fixed_limit";
    minimumRatio: number;
    targetRatio: number;
    maximumRatio: number;
    appliedRatio: number;
  }>;
  stands: Readonly<Record<string, AirportSurfaceRuntimeStand>>;
  aircraft: Readonly<Record<string, AirportSurfaceRuntimeAircraft>>;
}>;

type CreateAirportSurfaceRuntimeInput = Readonly<{
  airportIdent: string;
  configurationFeatures: readonly ProjectedAirportFeature[];
  aircraftSerialStart?: number;
  aircraftSerials?: readonly number[];
  generatedAt: string;
  targetOccupancyRatio?: number;
  maximumOccupiedStandCount?: number;
  aircraftModels?: readonly string[];
  commandDispatch?: boolean;
  allowCandidateStands?: boolean;
  includeAllOperationalStandKinds?: boolean;
}>;

const DEFAULT_AIRCRAFT_MODELS = Object.freeze([
  "A320neo",
  "A321",
  "B737-800",
  "B737 MAX 8",
]);

function distributeOccupiedStandIndexes(capacity: number, occupied: number) {
  if (occupied <= 0) return new Set<number>();
  if (occupied === 1) return new Set([Math.floor((capacity - 1) / 2)]);
  const canKeepTwoEmptyStandsBetweenAircraft =
    capacity >= occupied + (occupied - 1) * 2;
  return new Set(
    Array.from({ length: occupied }, (_, index) =>
      canKeepTwoEmptyStandsBetweenAircraft
        ? Math.round((index * (capacity - 1)) / (occupied - 1))
        : Math.floor((index * capacity) / occupied),
    ),
  );
}

/**
 * 从人工确认的WGS84登机口生成独立场面状态。
 * 该状态不包含旧百分比坐标，也不会凭空生成维修部门或保障车辆。
 */
export function createAirportSurfaceRuntimeState(
  input: CreateAirportSurfaceRuntimeInput,
): AirportSurfaceRuntimeState {
  const targetOccupancyRatio = input.targetOccupancyRatio ?? 0.55;
  if (targetOccupancyRatio < 0.5 || targetOccupancyRatio > 0.6) {
    throw new Error("机场初始占用率必须位于50%至60%之间。");
  }
  if (
    input.maximumOccupiedStandCount !== undefined &&
    (!Number.isInteger(input.maximumOccupiedStandCount) ||
      input.maximumOccupiedStandCount < 1)
  ) {
    throw new Error("机场固定初始飞机数必须是正整数。");
  }
  const standKinds = new Set(
    input.allowCandidateStands === true ||
      input.includeAllOperationalStandKinds === true
      ? ["gate", "stand", "remote_stand", "cargo_stand"]
      : ["gate"],
  );
  const gateFeatures = input.configurationFeatures.filter((feature) => {
    if (
      feature.properties.airportIdent !== input.airportIdent ||
      !standKinds.has(feature.properties.kind) ||
      feature.geometry.type !== "Point"
    ) {
      return false;
    }
    if (input.allowCandidateStands === true) {
      return feature.properties.operational !== false ||
        feature.properties.activationStatus === "candidate";
    }
    return feature.properties.operational === true &&
      feature.properties.activationStatus !== "candidate";
  });
  if (gateFeatures.length === 0) {
    throw new Error(`${input.airportIdent}没有可用于场面运行的WGS84登机口。`);
  }

  const ratioOccupiedCount = Math.round(
    gateFeatures.length * targetOccupancyRatio,
  );
  const requestedAircraftCount = input.aircraftSerials?.length;
  const occupiedCount = Math.min(
    gateFeatures.length,
    requestedAircraftCount ?? input.maximumOccupiedStandCount ?? ratioOccupiedCount,
  );
  if (input.aircraftSerials && new Set(input.aircraftSerials).size !== input.aircraftSerials.length) {
    throw new Error(`${input.airportIdent}初始飞机编号存在重复。`);
  }
  if (
    input.aircraftSerials &&
    input.maximumOccupiedStandCount !== undefined &&
    input.maximumOccupiedStandCount !== input.aircraftSerials.length
  ) {
    throw new Error(`${input.airportIdent}固定飞机数与编号清单长度不一致。`);
  }
  if (!input.aircraftSerials && input.aircraftSerialStart === undefined) {
    throw new Error(`${input.airportIdent}缺少初始飞机编号。`);
  }
  const occupiedStandIndexes = distributeOccupiedStandIndexes(
    gateFeatures.length,
    occupiedCount,
  );
  const aircraftModels = input.aircraftModels ?? DEFAULT_AIRCRAFT_MODELS;
  const stands: Record<string, AirportSurfaceRuntimeStand> = {};
  const aircraft: Record<string, AirportSurfaceRuntimeAircraft> = {};
  let assignedAircraftIndex = 0;

  gateFeatures.forEach((feature, gateIndex) => {
    if (feature.geometry.type !== "Point") return;
    const occupied = occupiedStandIndexes.has(gateIndex);
    const aircraftSerial = occupied
      ? input.aircraftSerials?.[assignedAircraftIndex] ??
        input.aircraftSerialStart! + assignedAircraftIndex
      : null;
    const aircraftId = aircraftSerial === null
      ? null
      : createFleetAircraftId(aircraftSerial);
    const coordinate = feature.geometry.coordinates;
    const operationalPosition = createAirportOperationalPosition({
      longitude: coordinate.wgs84.longitude,
      latitude: coordinate.wgs84.latitude,
      eastMeters: coordinate.local.eastMeters,
      northMeters: coordinate.local.northMeters,
      authority: "wgs84_configuration",
    });
    stands[feature.properties.id] = Object.freeze({
      id: feature.properties.id,
      name: feature.properties.name,
      areaId:
        feature.properties.parentConcourseId ??
        feature.properties.parentTerminalId ??
        input.airportIdent,
      status: occupied ? "占用" : "空闲",
      aircraftId,
      operationalPosition,
    });
    if (!aircraftId) return;
    const model =
      aircraftModels[
        assignedAircraftIndex % aircraftModels.length
      ];
    const localAircraftIndex = assignedAircraftIndex;
    const flightHours = 1800 + localAircraftIndex * 37;
    const remainingFlightHours = 120 + (localAircraftIndex % 8) * 18;
    aircraft[aircraftId] = Object.freeze({
      id: aircraftId,
      model,
      status: aircraftSerial! % 6 === 0 ? "过站保障" : "可用",
      risk: "低",
      currentStandId: feature.properties.id,
      flightHours,
      remainingFlightHours,
      healthProfile: createAssumedAircraftHealthProfile({
        aircraftId,
        flightHours,
        remainingFlightHours,
        asOf: input.generatedAt,
      }),
      description: `${input.airportIdent}运行初始化飞机，停放于${feature.properties.name}。`,
    });
    assignedAircraftIndex += 1;
  });

  return Object.freeze({
    airportIdent: input.airportIdent,
    generatedAt: input.generatedAt,
    readiness: input.commandDispatch
      ? "controlled_surface_operation" as const
      : "surface_monitoring" as const,
    capabilities: Object.freeze({
      monitoring: true as const,
      commandDispatch: input.commandDispatch ?? false,
      maintenance: false as const,
      groundSupport: false as const,
    }),
    occupancyPolicy: Object.freeze({
      selectionMode:
        input.maximumOccupiedStandCount === undefined && !input.aircraftSerials
        ? "ratio" as const
        : "fixed_limit" as const,
      minimumRatio: 0.5,
      targetRatio: targetOccupancyRatio,
      maximumRatio: 0.6,
      appliedRatio: occupiedCount / gateFeatures.length,
    }),
    stands: Object.freeze(stands),
    aircraft: Object.freeze(aircraft),
  });
}
