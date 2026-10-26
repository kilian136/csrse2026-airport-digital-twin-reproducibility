import {
  createAirportOperationalPosition,
  type AirportOperationalPosition,
} from "../../domain/geo";
import type { ProjectedAirportFeature } from "../airportConfig";
import { resolveGateAircraftCenterCoordinate } from "../airportConfig/runtimePositionResolver";
import type {
  CandidateAirportNetwork,
  CandidateNetworkKind,
  CandidateNetworkNode,
} from "./types";

export type OperationalNetworkAnchorKind =
  | "gate"
  | "stand"
  | "maintenance_area"
  | "holding_point"
  | "ground_support_base";

export type OperationalNetworkAnchor = Readonly<{
  id: string;
  sourceId: string;
  name: string;
  kind: OperationalNetworkAnchorKind;
  position: AirportOperationalPosition;
  connectionStatus: "connected" | "too_far" | "no_eligible_node";
  connectedNodeId: string | null;
  connectorDistanceMeters: number | null;
  maximumConnectorDistanceMeters: number;
}>;

export type OperationalNetworkConnector = Readonly<{
  id: string;
  anchorId: string;
  networkNodeId: string;
  lengthMeters: number;
  allowedModes: readonly ("taxi" | "tow" | "service_vehicle")[];
}>;

export type OperationalNetworkDraftReport = Readonly<{
  totalAnchorCount: number;
  connectedAnchorCount: number;
  disconnectedAnchorCount: number;
  coverage: number;
  anchorCountByKind: Readonly<Record<OperationalNetworkAnchorKind, number>>;
  disconnectedAnchorIds: readonly string[];
  excludedRunwayOnlyNodeCount: number;
  maximumObservedConnectorDistanceMeters: number;
  averageConnectedConnectorDistanceMeters: number;
  maximumObservedDistanceByKind: Readonly<
    Record<OperationalNetworkAnchorKind, number>
  >;
}>;

export type OperationalAirportNetworkDraft = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  authority: "validation_draft";
  sourceNetworkAuthority: "candidate_only";
  nodes: CandidateAirportNetwork["nodes"];
  edges: CandidateAirportNetwork["edges"];
  anchors: readonly OperationalNetworkAnchor[];
  connectors: readonly OperationalNetworkConnector[];
  report: OperationalNetworkDraftReport;
}>;

type BuildOperationalAirportNetworkDraftOptions = Readonly<{
  network: CandidateAirportNetwork;
  configurationFeatures: readonly ProjectedAirportFeature[];
  /** 运行态基地编号到人工配置要素编号的明确绑定。 */
  supportBaseBindings?: Readonly<Partial<Record<string, string>>>;
  /** 人工确认的机位到专属停机位引导线ref绑定；存在绑定时禁止吸附相邻机位。 */
  standGuidanceBindings?: Readonly<Partial<Record<string, readonly string[]>>>;
}>;

const MAXIMUM_CONNECTOR_DISTANCE_METERS: Readonly<
  Record<OperationalNetworkAnchorKind, number>
> = Object.freeze({
  gate: 250,
  stand: 250,
  maintenance_area: 400,
  holding_point: 60,
  ground_support_base: 600,
});

function toOperationalPosition(
  coordinate: ProjectedAirportFeature["geometry"] extends never
    ? never
    : {
        wgs84: { longitude: number; latitude: number };
        local: { eastMeters: number; northMeters: number };
      },
  authority: "wgs84_configuration" | "compiled_network",
): AirportOperationalPosition {
  return createAirportOperationalPosition({
    longitude: coordinate.wgs84.longitude,
    latitude: coordinate.wgs84.latitude,
    eastMeters: coordinate.local.eastMeters,
    northMeters: coordinate.local.northMeters,
    authority,
  });
}

function featureCenter(feature: ProjectedAirportFeature) {
  if (feature.geometry.type === "Point") return feature.geometry.coordinates;
  const coordinates =
    feature.geometry.type === "LineString"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates[0] ?? [];
  const usableCoordinates =
    coordinates.length > 1 &&
    coordinates[0]?.wgs84.longitude === coordinates.at(-1)?.wgs84.longitude &&
    coordinates[0]?.wgs84.latitude === coordinates.at(-1)?.wgs84.latitude
      ? coordinates.slice(0, -1)
      : coordinates;
  if (usableCoordinates.length === 0) return null;
  const longitude =
    usableCoordinates.reduce(
      (total, coordinate) => total + coordinate.wgs84.longitude,
      0,
    ) / usableCoordinates.length;
  const latitude =
    usableCoordinates.reduce(
      (total, coordinate) => total + coordinate.wgs84.latitude,
      0,
    ) / usableCoordinates.length;
  const eastMeters =
    usableCoordinates.reduce(
      (total, coordinate) => total + coordinate.local.eastMeters,
      0,
    ) / usableCoordinates.length;
  const northMeters =
    usableCoordinates.reduce(
      (total, coordinate) => total + coordinate.local.northMeters,
      0,
    ) / usableCoordinates.length;
  return {
    wgs84: { longitude, latitude },
    local: { eastMeters, northMeters },
  };
}

function distanceMeters(
  first: AirportOperationalPosition,
  second: CandidateNetworkNode,
) {
  return Math.hypot(
    first.local.eastMeters - second.coordinate.local.eastMeters,
    first.local.northMeters - second.coordinate.local.northMeters,
  );
}

function buildNodeKinds(network: CandidateAirportNetwork) {
  const nodeKinds = new Map<string, Set<CandidateNetworkKind>>();
  network.edges.forEach((edge) => {
    [edge.fromNodeId, edge.toNodeId].forEach((nodeId) => {
      const kinds = nodeKinds.get(nodeId) ?? new Set<CandidateNetworkKind>();
      edge.kinds.forEach((kind) => kinds.add(kind));
      nodeKinds.set(nodeId, kinds);
    });
  });
  return nodeKinds;
}

function createConfigurationAnchors(
  features: readonly ProjectedAirportFeature[],
  supportBaseBindings: Readonly<Partial<Record<string, string>>>,
) {
  const supportedKinds = new Set([
    "gate",
    "stand",
    "remote_stand",
    "cargo_stand",
    "maintenance_area",
    "holding_point",
    "ground_support_base",
  ]);
  const anchors: Array<{
    id: string;
    sourceId: string;
    name: string;
    kind: OperationalNetworkAnchorKind;
    position: AirportOperationalPosition;
  }> = [];
  const anchorIds = new Set<string>();

  features.forEach((feature) => {
    if (!supportedKinds.has(feature.properties.kind)) return;
    const center =
      feature.properties.kind === "gate"
        ? resolveGateAircraftCenterCoordinate(feature, features)
        : featureCenter(feature);
    if (!center) return;
    const kind =
      feature.properties.kind === "remote_stand" ||
      feature.properties.kind === "cargo_stand"
        ? "stand" as const
        : feature.properties.kind as OperationalNetworkAnchorKind;
    const id =
      kind === "ground_support_base"
        ? `SUPPORT:${feature.properties.supportBaseId ?? feature.properties.id}`
        : `CONFIG:${feature.properties.id}`;
    if (anchorIds.has(id)) return;
    anchorIds.add(id);
    anchors.push({
      id,
      sourceId: feature.properties.id,
      name: feature.properties.name,
      kind,
      position: toOperationalPosition(center, "wgs84_configuration"),
    });
  });

  Object.entries(supportBaseBindings).forEach(([baseId, featureId]) => {
    if (!featureId) return;
    const id = `SUPPORT:${baseId}`;
    if (anchorIds.has(id)) return;
    const feature = features.find(
      (candidate) => candidate.properties.id === featureId,
    );
    const center = feature ? featureCenter(feature) : null;
    if (!feature || !center) return;
    anchorIds.add(id);
    anchors.push({
      id,
      sourceId: featureId,
      name: `${baseId}保障驻点`,
      kind: "ground_support_base",
      position: toOperationalPosition(center, "wgs84_configuration"),
    });
  });
  return anchors;
}

export function buildOperationalAirportNetworkDraft({
  network,
  configurationFeatures,
  supportBaseBindings = {},
  standGuidanceBindings = {},
}: BuildOperationalAirportNetworkDraftOptions): OperationalAirportNetworkDraft {
  const nodeKinds = buildNodeKinds(network);
  const mainNodeIds = new Set(
    network.report.components
      .filter((component) => component.classification === "main_network")
      .flatMap((component) => component.nodeIds),
  );
  const runwayOnlyNodeIds = new Set(
    network.nodes
      .filter((node) => {
        const kinds = nodeKinds.get(node.id);
        return kinds?.size === 1 && kinds.has("runway");
      })
      .map((node) => node.id),
  );
  const eligibleNodes = network.nodes.filter(
    (node) =>
      mainNodeIds.has(node.id) &&
      !runwayOnlyNodeIds.has(node.id) &&
      (nodeKinds.get(node.id)?.has("taxiway") ||
        nodeKinds.get(node.id)?.has("taxilane") ||
        nodeKinds.get(node.id)?.has("parking_position")),
  );
  const guidanceNodeIdsByRef = new Map<string, Set<string>>();
  network.edges
    .filter((edge) => edge.kinds.includes("parking_position"))
    .forEach((edge) => {
      edge.refs.forEach((ref) => {
        const nodeIds = guidanceNodeIdsByRef.get(ref) ?? new Set<string>();
        nodeIds.add(edge.fromNodeId);
        nodeIds.add(edge.toNodeId);
        guidanceNodeIdsByRef.set(ref, nodeIds);
      });
    });

  const pendingAnchors = createConfigurationAnchors(
    configurationFeatures,
    supportBaseBindings,
  );
  network.operationalPoints
    .filter((point) => point.kind === "holding_position")
    .forEach((point) => {
      pendingAnchors.push({
        id: `OSM-HOLD:${point.id}`,
        sourceId: point.id,
        name: point.ref ? `等待点${point.ref}` : "OSM跑道等待点",
        kind: "holding_point",
        position: toOperationalPosition(point.coordinate, "compiled_network"),
      });
    });

  const connectors: OperationalNetworkConnector[] = [];
  const anchors = pendingAnchors.map((anchor): OperationalNetworkAnchor => {
    const exactHoldingNode =
      anchor.kind === "holding_point" && anchor.id.startsWith("OSM-HOLD:")
        ? network.operationalPoints.find(
            (point) => `OSM-HOLD:${point.id}` === anchor.id,
          )?.networkNodeId ?? null
        : null;
    const boundGuidanceRefs = standGuidanceBindings[anchor.sourceId] ?? [];
    const boundGuidanceNodeIds = new Set(
      boundGuidanceRefs.flatMap((ref) => [
        ...(guidanceNodeIdsByRef.get(ref) ?? []),
      ]),
    );
    const anchorEligibleNodes = boundGuidanceRefs.length > 0
      ? eligibleNodes.filter((node) => boundGuidanceNodeIds.has(node.id))
      : eligibleNodes;
    let nearestNode = exactHoldingNode
      ? anchorEligibleNodes.find((node) => node.id === exactHoldingNode) ?? null
      : null;
    let nearestDistance = nearestNode ? 0 : Number.POSITIVE_INFINITY;
    if (!nearestNode) {
      anchorEligibleNodes.forEach((node) => {
        const distance = distanceMeters(anchor.position, node);
        if (distance < nearestDistance) {
          nearestNode = node;
          nearestDistance = distance;
        }
      });
    }
    const maximumConnectorDistanceMeters =
      MAXIMUM_CONNECTOR_DISTANCE_METERS[anchor.kind];
    const connectionStatus = !nearestNode
      ? "no_eligible_node"
      : nearestDistance > maximumConnectorDistanceMeters
        ? "too_far"
        : "connected";
    if (connectionStatus === "connected" && nearestNode) {
      connectors.push(
        Object.freeze({
          id: `CONNECTOR:${anchor.id}:${nearestNode.id}`,
          anchorId: anchor.id,
          networkNodeId: nearestNode.id,
          lengthMeters: nearestDistance,
          allowedModes: Object.freeze(
            anchor.kind === "ground_support_base"
              ? ["service_vehicle" as const]
              : ["taxi" as const, "tow" as const, "service_vehicle" as const],
          ),
        }),
      );
    }
    return Object.freeze({
      ...anchor,
      connectionStatus,
      connectedNodeId:
        connectionStatus === "connected" && nearestNode ? nearestNode.id : null,
      connectorDistanceMeters: Number.isFinite(nearestDistance)
        ? nearestDistance
        : null,
      maximumConnectorDistanceMeters,
    });
  });

  const anchorCountByKind = Object.fromEntries(
    ([
      "gate",
      "stand",
      "maintenance_area",
      "holding_point",
      "ground_support_base",
    ] as const).map((kind) => [
      kind,
      anchors.filter((anchor) => anchor.kind === kind).length,
    ]),
  ) as Record<OperationalNetworkAnchorKind, number>;
  const disconnectedAnchorIds = anchors
    .filter((anchor) => anchor.connectionStatus !== "connected")
    .map((anchor) => anchor.id);
  const connectedAnchorCount = anchors.length - disconnectedAnchorIds.length;
  const observedDistances = anchors
    .map((anchor) => anchor.connectorDistanceMeters)
    .filter((distance): distance is number => distance !== null);
  const connectedDistances = connectors.map((connector) => connector.lengthMeters);
  const maximumObservedDistanceByKind = Object.fromEntries(
    (Object.keys(anchorCountByKind) as OperationalNetworkAnchorKind[]).map(
      (kind) => [
        kind,
        Math.max(
          0,
          ...anchors
            .filter((anchor) => anchor.kind === kind)
            .map((anchor) => anchor.connectorDistanceMeters ?? 0),
        ),
      ],
    ),
  ) as Record<OperationalNetworkAnchorKind, number>;

  return Object.freeze({
    schemaVersion: "1.0.0" as const,
    airportIdent: network.airportIdent,
    authority: "validation_draft" as const,
    sourceNetworkAuthority: network.authority,
    nodes: network.nodes,
    edges: network.edges,
    anchors: Object.freeze(anchors),
    connectors: Object.freeze(connectors),
    report: Object.freeze({
      totalAnchorCount: anchors.length,
      connectedAnchorCount,
      disconnectedAnchorCount: disconnectedAnchorIds.length,
      coverage: anchors.length > 0 ? connectedAnchorCount / anchors.length : 0,
      anchorCountByKind: Object.freeze(anchorCountByKind),
      disconnectedAnchorIds: Object.freeze(disconnectedAnchorIds),
      excludedRunwayOnlyNodeCount: runwayOnlyNodeIds.size,
      maximumObservedConnectorDistanceMeters: Math.max(0, ...observedDistances),
      averageConnectedConnectorDistanceMeters:
        connectedDistances.length > 0
          ? connectedDistances.reduce((total, distance) => total + distance, 0) /
            connectedDistances.length
          : 0,
      maximumObservedDistanceByKind: Object.freeze(
        maximumObservedDistanceByKind,
      ),
    }),
  });
}
