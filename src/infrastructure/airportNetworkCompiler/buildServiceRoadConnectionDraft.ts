import type {
  AirportSpatialCoordinate,
  ProjectedAirportCoordinate,
  ProjectedAirportFeature,
} from "../airportConfig";
import type {
  CandidateAirportNetwork,
  CandidateNetworkNode,
  CandidateServiceRoad,
} from "./types";

export type ServiceRoadAnchorKind =
  | "ground_support_base"
  | "maintenance_area"
  | "fuel_facility"
  | "fire_station";
export type ServiceRoadConnectionStatus =
  | "connected"
  | "review_required"
  | "too_far"
  | "no_candidate";

export type ServiceRoadAnchorConnection = Readonly<{
  id: string;
  sourceFeatureId: string;
  name: string;
  kind: ServiceRoadAnchorKind;
  sourceCoordinate: AirportSpatialCoordinate;
  roadCoordinate: ProjectedAirportCoordinate | null;
  roadId: string | null;
  distanceMeters: number | null;
  maximumDistanceMeters: number;
  status: ServiceRoadConnectionStatus;
}>;

export type ServiceRoadApronInterface = Readonly<{
  id: string;
  roadId: string;
  aircraftNetworkNodeId: string;
  roadCoordinate: ProjectedAirportCoordinate;
  aircraftNetworkCoordinate: ProjectedAirportCoordinate;
  distanceMeters: number;
  requiresReview: boolean;
}>;

export type ServiceRoadConnectionDraft = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  authority: "validation_draft";
  anchorConnections: readonly ServiceRoadAnchorConnection[];
  apronInterfaces: readonly ServiceRoadApronInterface[];
  report: Readonly<{
    totalAnchorCount: number;
    connectedAnchorCount: number;
    reviewRequiredAnchorCount: number;
    rejectedAnchorCount: number;
    apronInterfaceCount: number;
    maximumConnectionDistanceMeters: number;
  }>;
}>;

const MAXIMUM_DISTANCE: Readonly<Record<ServiceRoadAnchorKind, number>> = {
  ground_support_base: 180,
  maintenance_area: 180,
  fuel_facility: 180,
  fire_station: 180,
};
const APRON_INTERFACE_DISTANCE_METERS = 20;
const INTERFACE_DEDUPLICATION_DISTANCE_METERS = 16;

function distanceMeters(
  first: AirportSpatialCoordinate,
  second: AirportSpatialCoordinate,
) {
  return Math.hypot(
    first.local.eastMeters - second.local.eastMeters,
    first.local.northMeters - second.local.northMeters,
  );
}

function interpolateCoordinate(
  first: ProjectedAirportCoordinate,
  second: ProjectedAirportCoordinate,
  ratio: number,
): ProjectedAirportCoordinate {
  const interpolate = (start: number, end: number) => start + (end - start) * ratio;
  return Object.freeze({
    wgs84: Object.freeze({
      longitude: interpolate(first.wgs84.longitude, second.wgs84.longitude),
      latitude: interpolate(first.wgs84.latitude, second.wgs84.latitude),
    }),
    local: Object.freeze({
      eastMeters: interpolate(first.local.eastMeters, second.local.eastMeters),
      northMeters: interpolate(first.local.northMeters, second.local.northMeters),
    }),
  });
}

function nearestPointOnSegment(
  point: AirportSpatialCoordinate,
  start: ProjectedAirportCoordinate,
  end: ProjectedAirportCoordinate,
) {
  const segmentEast = end.local.eastMeters - start.local.eastMeters;
  const segmentNorth = end.local.northMeters - start.local.northMeters;
  const lengthSquared = segmentEast ** 2 + segmentNorth ** 2;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            ((point.local.eastMeters - start.local.eastMeters) * segmentEast +
              (point.local.northMeters - start.local.northMeters) * segmentNorth) /
              lengthSquared,
          ),
        );
  const coordinate = interpolateCoordinate(start, end, ratio);
  return { coordinate, distanceMeters: distanceMeters(point, coordinate) };
}

function featureAnchorCoordinates(feature: ProjectedAirportFeature) {
  if (feature.geometry.type === "Point") return [feature.geometry.coordinates];
  const coordinates =
    feature.geometry.type === "LineString"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates[0] ?? [];
  if (coordinates.length === 0) return [];
  const usable =
    coordinates.length > 1 &&
    coordinates[0].wgs84.longitude === coordinates.at(-1)?.wgs84.longitude &&
    coordinates[0].wgs84.latitude === coordinates.at(-1)?.wgs84.latitude
      ? coordinates.slice(0, -1)
      : coordinates;
  const center = Object.freeze({
    wgs84: Object.freeze({
      longitude: usable.reduce((sum, item) => sum + item.wgs84.longitude, 0) / usable.length,
      latitude: usable.reduce((sum, item) => sum + item.wgs84.latitude, 0) / usable.length,
    }),
    local: Object.freeze({
      eastMeters: usable.reduce((sum, item) => sum + item.local.eastMeters, 0) / usable.length,
      northMeters: usable.reduce((sum, item) => sum + item.local.northMeters, 0) / usable.length,
    }),
  });
  return [...usable, center];
}

function nearestRoadAttachment(
  anchorCoordinates: readonly AirportSpatialCoordinate[],
  roads: readonly CandidateServiceRoad[],
) {
  let best: {
    sourceCoordinate: AirportSpatialCoordinate;
    roadCoordinate: ProjectedAirportCoordinate;
    road: CandidateServiceRoad;
    distanceMeters: number;
  } | null = null;
  for (const sourceCoordinate of anchorCoordinates) {
    for (const road of roads) {
      for (let index = 0; index < road.coordinates.length - 1; index += 1) {
        const candidate = nearestPointOnSegment(
          sourceCoordinate,
          road.coordinates[index],
          road.coordinates[index + 1],
        );
        if (!best || candidate.distanceMeters < best.distanceMeters) {
          best = { sourceCoordinate, roadCoordinate: candidate.coordinate, road, distanceMeters: candidate.distanceMeters };
        }
      }
    }
  }
  return best;
}

function anchorKind(feature: ProjectedAirportFeature): ServiceRoadAnchorKind | null {
  if (feature.properties.kind === "ground_support_base") return "ground_support_base";
  if (feature.properties.kind === "fuel_facility") return "fuel_facility";
  if (feature.properties.kind === "fire_station") return "fire_station";
  if (
    feature.properties.kind === "maintenance_department" &&
    feature.properties.supportBaseId
  ) return "ground_support_base";
  return feature.properties.kind === "maintenance_area" ? "maintenance_area" : null;
}

function eligibleAircraftNodes(network: CandidateAirportNetwork) {
  const eligibleIds = new Set<string>();
  network.edges.forEach((edge) => {
    if (
      edge.primaryKind === "runway" ||
      !edge.kinds.some((kind) =>
        kind === "taxiway" || kind === "taxilane" || kind === "parking_position",
      )
    ) return;
    eligibleIds.add(edge.fromNodeId);
    eligibleIds.add(edge.toNodeId);
  });
  return network.nodes.filter((node) => eligibleIds.has(node.id));
}

function nearestAircraftNode(
  coordinate: ProjectedAirportCoordinate,
  nodes: readonly CandidateNetworkNode[],
) {
  return nodes.reduce<{ node: CandidateNetworkNode; distanceMeters: number } | null>(
    (best, node) => {
      const distance = distanceMeters(coordinate, node.coordinate);
      return !best || distance < best.distanceMeters ? { node, distanceMeters: distance } : best;
    },
    null,
  );
}

export function buildServiceRoadConnectionDraft(
  network: CandidateAirportNetwork,
  configurationFeatures: readonly ProjectedAirportFeature[],
): ServiceRoadConnectionDraft {
  const serviceRoads = network.serviceRoadNetwork?.roads ?? [];
  const usableRoads = serviceRoads.filter((road) => road.reviewStatus !== "excluded");
  const anchorConnections = configurationFeatures.flatMap((feature) => {
    const kind = anchorKind(feature);
    if (!kind) return [];
    const nearest = nearestRoadAttachment(featureAnchorCoordinates(feature), usableRoads);
    const maximumDistanceMeters = MAXIMUM_DISTANCE[kind];
    const status: ServiceRoadConnectionStatus = !nearest
      ? "no_candidate"
      : nearest.distanceMeters > maximumDistanceMeters
        ? "too_far"
        : nearest.road.reviewStatus === "requires_review"
          ? "review_required"
          : "connected";
    return [Object.freeze({
      id: `SERVICE-CONNECTION:${feature.properties.id}`,
      sourceFeatureId: feature.properties.id,
      name: feature.properties.name,
      kind,
      sourceCoordinate: nearest?.sourceCoordinate ?? featureAnchorCoordinates(feature)[0],
      roadCoordinate: nearest?.roadCoordinate ?? null,
      roadId: nearest?.road.id ?? null,
      distanceMeters: nearest?.distanceMeters ?? null,
      maximumDistanceMeters,
      status,
    })];
  });

  const aircraftNodes = eligibleAircraftNodes(network);
  const rawInterfaces: ServiceRoadApronInterface[] = [];
  usableRoads.forEach((road) => {
    [road.coordinates[0], road.coordinates.at(-1)].forEach((roadCoordinate) => {
      if (!roadCoordinate) return;
      const nearest = nearestAircraftNode(roadCoordinate, aircraftNodes);
      if (!nearest || nearest.distanceMeters > APRON_INTERFACE_DISTANCE_METERS) return;
      if (
        rawInterfaces.some(
          (existing) =>
            distanceMeters(existing.roadCoordinate, roadCoordinate) <
            INTERFACE_DEDUPLICATION_DISTANCE_METERS,
        )
      ) return;
      rawInterfaces.push(Object.freeze({
        id: `SERVICE-APRON-INTERFACE-${String(rawInterfaces.length + 1).padStart(2, "0")}`,
        roadId: road.id,
        aircraftNetworkNodeId: nearest.node.id,
        roadCoordinate,
        aircraftNetworkCoordinate: nearest.node.coordinate,
        distanceMeters: nearest.distanceMeters,
        requiresReview: road.reviewStatus === "requires_review",
      }));
    });
  });

  const accepted = anchorConnections.filter(
    (connection) => connection.status === "connected" || connection.status === "review_required",
  );
  return Object.freeze({
    schemaVersion: "1.0.0" as const,
    airportIdent: network.airportIdent,
    authority: "validation_draft" as const,
    anchorConnections: Object.freeze(anchorConnections),
    apronInterfaces: Object.freeze(rawInterfaces),
    report: Object.freeze({
      totalAnchorCount: anchorConnections.length,
      connectedAnchorCount: anchorConnections.filter((connection) => connection.status === "connected").length,
      reviewRequiredAnchorCount: anchorConnections.filter((connection) => connection.status === "review_required").length,
      rejectedAnchorCount: anchorConnections.filter(
        (connection) => connection.status === "too_far" || connection.status === "no_candidate",
      ).length,
      apronInterfaceCount: rawInterfaces.length,
      maximumConnectionDistanceMeters: Math.max(0, ...accepted.map((connection) => connection.distanceMeters ?? 0)),
    }),
  });
}
