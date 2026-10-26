import type {
  AirportLocalCoordinateConverter,
  Wgs84Coordinate,
} from "../../domain/geo";
import type { ProjectedAirportCoordinate } from "../airportConfig";
import type {
  CandidateAirportNetwork,
  CandidateNetworkComponentSummary,
  CandidateNetworkEdge,
  CandidateNetworkKind,
  CandidateNetworkKindSummary,
  CandidateNetworkNode,
  CandidateOperationalPoint,
  CandidateServiceRoad,
  CandidateServiceRoadReviewStatus,
  OsmSnapshot,
} from "./types";

type CompilerDependencies = Readonly<{
  airportIdent: string;
  localCoordinateConverter: AirportLocalCoordinateConverter;
}>;

type MutableNode = {
  id: string;
  coordinate: ProjectedAirportCoordinate;
  adjacentNodeIds: Set<string>;
};

type MutableEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  primaryKind: CandidateNetworkKind;
  kinds: Set<CandidateNetworkKind>;
  refs: Set<string>;
  sourceWayIds: Set<number>;
  lengthMeters: number;
  bidirectional: boolean;
};

const ALLOWED_KINDS = new Set<CandidateNetworkKind>([
  "runway",
  "taxiway",
  "taxilane",
  "parking_position",
]);

const KIND_PRIORITY: Record<CandidateNetworkKind, number> = {
  runway: 4,
  taxiway: 3,
  taxilane: 2,
  parking_position: 1,
};

function coordinateKey(longitude: number, latitude: number): string {
  return `${longitude.toFixed(7)},${latitude.toFixed(7)}`;
}

function createNodeId(
  airportIdent: string,
  longitude: number,
  latitude: number,
): string {
  const longitudeCode = Math.round((longitude + 180) * 10_000_000);
  const latitudeCode = Math.round((latitude + 90) * 10_000_000);
  return `${airportIdent}-OSM-N-${longitudeCode}-${latitudeCode}`;
}

function projectCoordinate(
  longitude: number,
  latitude: number,
  dependencies: CompilerDependencies,
): ProjectedAirportCoordinate {
  const wgs84: Wgs84Coordinate = { longitude, latitude };
  return Object.freeze({
    wgs84: Object.freeze(wgs84),
    local: Object.freeze(
      dependencies.localCoordinateConverter.wgs84ToLocal(wgs84),
    ),
  });
}

function calculateLocalDistance(
  first: ProjectedAirportCoordinate,
  second: ProjectedAirportCoordinate,
): number {
  return Math.hypot(
    second.local.eastMeters - first.local.eastMeters,
    second.local.northMeters - first.local.northMeters,
  );
}

function classifyServiceRoad(
  tags: Readonly<Record<string, string>> | undefined,
): CandidateServiceRoadReviewStatus {
  const access = tags?.access;
  const service = tags?.service;
  if (
    access === "no" ||
    access === "customers" ||
    service === "parking_aisle" ||
    service === "driveway"
  ) {
    return "excluded";
  }
  return access === "private" ? "likely_airside" : "requires_review";
}

function compileServiceRoads(
  snapshot: OsmSnapshot,
  dependencies: CompilerDependencies,
) {
  const roads: CandidateServiceRoad[] = [];
  const statusCounts: Record<CandidateServiceRoadReviewStatus, number> = {
    likely_airside: 0,
    requires_review: 0,
    excluded: 0,
  };
  let totalLengthMeters = 0;
  let oneWayCount = 0;

  snapshot.elements.forEach((element) => {
    if (
      element.type !== "way" ||
      element.tags?.highway !== "service" ||
      !element.geometry ||
      element.geometry.length < 2
    ) {
      return;
    }
    const coordinates = element.geometry.map((point) =>
      projectCoordinate(point.lon, point.lat, dependencies),
    );
    const lengthMeters = coordinates.slice(1).reduce(
      (total, coordinate, index) =>
        total + calculateLocalDistance(coordinates[index], coordinate),
      0,
    );
    const reviewStatus = classifyServiceRoad(element.tags);
    const oneWay = element.tags.oneway === "yes";
    statusCounts[reviewStatus] += 1;
    totalLengthMeters += lengthMeters;
    if (oneWay) oneWayCount += 1;
    roads.push(
      Object.freeze({
        id: `${dependencies.airportIdent}-OSM-SERVICE-${element.id}`,
        sourceWayId: element.id,
        coordinates: Object.freeze(coordinates),
        lengthMeters,
        access: element.tags.access?.trim() || null,
        service: element.tags.service?.trim() || null,
        oneWay,
        reviewStatus,
      }),
    );
  });

  return Object.freeze({
    authority: "candidate_only" as const,
    source: "OpenStreetMap" as const,
    importedWayCount: roads.length,
    totalLengthMeters,
    oneWayCount,
    statusCounts: Object.freeze(statusCounts),
    roads: Object.freeze(roads),
  });
}

function createEmptyKindSummary(): Record<
  CandidateNetworkKind,
  { wayCount: number; edgeCount: number; lengthMeters: number }
> {
  return {
    runway: { wayCount: 0, edgeCount: 0, lengthMeters: 0 },
    taxiway: { wayCount: 0, edgeCount: 0, lengthMeters: 0 },
    taxilane: { wayCount: 0, edgeCount: 0, lengthMeters: 0 },
    parking_position: { wayCount: 0, edgeCount: 0, lengthMeters: 0 },
  };
}

export function deriveTopologyReport(
  nodes: readonly CandidateNetworkNode[],
  edges: readonly CandidateNetworkEdge[],
): {
  components: CandidateNetworkComponentSummary[];
  runwayEndNodeIds: string[];
  parkingGuideEndNodeIds: string[];
  perimeterOperationalEndNodeIds: string[];
  suspectedBreakNodeIds: string[];
} {
  const adjacent = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const edgesByNodeId = new Map(
    nodes.map((node) => [node.id, [] as CandidateNetworkEdge[]]),
  );
  edges.forEach((edge) => {
    adjacent.get(edge.fromNodeId)?.push(edge.toNodeId);
    adjacent.get(edge.toNodeId)?.push(edge.fromNodeId);
    edgesByNodeId.get(edge.fromNodeId)?.push(edge);
    edgesByNodeId.get(edge.toNodeId)?.push(edge);
  });
  const visited = new Set<string>();
  const rawComponents: Array<{ nodeIds: string[]; edgeIds: Set<string> }> = [];
  nodes.forEach((node) => {
    if (visited.has(node.id)) return;
    const nodeIds: string[] = [];
    const edgeIds = new Set<string>();
    const pending = [node.id];
    visited.add(node.id);
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current) continue;
      nodeIds.push(current);
      (edgesByNodeId.get(current) ?? []).forEach((edge) => edgeIds.add(edge.id));
      (adjacent.get(current) ?? []).forEach((neighbor) => {
        if (visited.has(neighbor)) return;
        visited.add(neighbor);
        pending.push(neighbor);
      });
    }
    rawComponents.push({ nodeIds, edgeIds });
  });
  rawComponents.sort((first, second) => second.nodeIds.length - first.nodeIds.length);

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edgesById = new Map(edges.map((edge) => [edge.id, edge]));
  const components = rawComponents.map(
    (component, index): CandidateNetworkComponentSummary => {
      const componentNodes = component.nodeIds
        .map((nodeId) => nodesById.get(nodeId))
        .filter((node): node is CandidateNetworkNode => Boolean(node));
      const componentEdges = [...component.edgeIds]
        .map((edgeId) => edgesById.get(edgeId))
        .filter((edge): edge is CandidateNetworkEdge => Boolean(edge));
      const kinds: Record<CandidateNetworkKind, number> = {
        runway: 0,
        taxiway: 0,
        taxilane: 0,
        parking_position: 0,
      };
      componentEdges.forEach((edge) => {
        kinds[edge.primaryKind] += 1;
      });
      const allParkingGuidance = componentEdges.every((edge) =>
        edge.kinds.includes("parking_position"),
      );
      return Object.freeze({
        id: `COMPONENT-${String(index + 1).padStart(3, "0")}`,
        classification:
          index === 0
            ? "main_network"
            : allParkingGuidance
              ? "isolated_parking_guidance"
              : "isolated_operational_fragment",
        nodeIds: Object.freeze([...component.nodeIds]),
        nodeCount: component.nodeIds.length,
        edgeCount: component.edgeIds.size,
        centerLocalCoordinate: Object.freeze({
          eastMeters:
            componentNodes.reduce(
              (total, item) => total + item.coordinate.local.eastMeters,
              0,
            ) / componentNodes.length,
          northMeters:
            componentNodes.reduce(
              (total, item) => total + item.coordinate.local.northMeters,
              0,
            ) / componentNodes.length,
        }),
        kinds: Object.freeze(kinds),
      });
    },
  );

  const runwayEndNodeIds: string[] = [];
  const parkingGuideEndNodeIds: string[] = [];
  const perimeterOperationalEndNodeIds: string[] = [];
  const suspectedBreakNodeIds: string[] = [];
  const eastValues = nodes.map((node) => node.coordinate.local.eastMeters);
  const northValues = nodes.map((node) => node.coordinate.local.northMeters);
  const localEnvelope = {
    minimumEast: eastValues.length > 0 ? Math.min(...eastValues) : 0,
    maximumEast: eastValues.length > 0 ? Math.max(...eastValues) : 0,
    minimumNorth: northValues.length > 0 ? Math.min(...northValues) : 0,
    maximumNorth: northValues.length > 0 ? Math.max(...northValues) : 0,
  };
  const eastMargin = Math.max(
    25,
    (localEnvelope.maximumEast - localEnvelope.minimumEast) * 0.05,
  );
  const northMargin = Math.max(
    25,
    (localEnvelope.maximumNorth - localEnvelope.minimumNorth) * 0.05,
  );
  nodes
    .filter((node) => node.degree === 1)
    .forEach((node) => {
      const incidentEdge = edgesByNodeId.get(node.id)?.[0];
      if (!incidentEdge) return;
      if (incidentEdge.kinds.includes("parking_position")) {
        parkingGuideEndNodeIds.push(node.id);
      } else if (incidentEdge.kinds.includes("runway")) {
        runwayEndNodeIds.push(node.id);
      } else if (
        node.coordinate.local.eastMeters <=
          localEnvelope.minimumEast + eastMargin ||
        node.coordinate.local.eastMeters >=
          localEnvelope.maximumEast - eastMargin ||
        node.coordinate.local.northMeters <=
          localEnvelope.minimumNorth + northMargin ||
        node.coordinate.local.northMeters >=
          localEnvelope.maximumNorth - northMargin
      ) {
        perimeterOperationalEndNodeIds.push(node.id);
      } else {
        suspectedBreakNodeIds.push(node.id);
      }
    });

  return {
    components,
    runwayEndNodeIds,
    parkingGuideEndNodeIds,
    perimeterOperationalEndNodeIds,
    suspectedBreakNodeIds,
  };
}

/**
 * 把OSM机场线要素编译为候选图。第一版按共享WGS84顶点建立拓扑；没有共享
 * 顶点的几何交叉、跨桥和隧道关系留待下一阶段校核，不能直接作为运行路网。
 */
export function compileOsmAirportNetwork(
  snapshot: OsmSnapshot,
  dependencies: CompilerDependencies,
): CandidateAirportNetwork {
  if (!Array.isArray(snapshot.elements)) {
    throw new Error("OSM快照缺少elements数组。");
  }

  const nodesByCoordinate = new Map<string, MutableNode>();
  const edgesByEndpoints = new Map<string, MutableEdge>();
  const kindSummary = createEmptyKindSummary();
  let compiledWayCount = 0;
  let skippedElementCount = 0;
  const sourceOperationalPoints: CandidateOperationalPoint[] = [];

  snapshot.elements.forEach((element) => {
    const kind = element.tags?.aeroway;
    if (
      element.type !== "node" ||
      (kind !== "parking_position" && kind !== "holding_position") ||
      !Number.isFinite(element.lon) ||
      !Number.isFinite(element.lat)
    ) {
      return;
    }
    const longitude = element.lon as number;
    const latitude = element.lat as number;
    sourceOperationalPoints.push(
      Object.freeze({
        id: `${dependencies.airportIdent}-OSM-P-${element.id}`,
        sourceElementId: element.id,
        kind,
        ref: element.tags?.ref?.trim() || null,
        coordinate: projectCoordinate(longitude, latitude, dependencies),
        networkNodeId: createNodeId(
          dependencies.airportIdent,
          longitude,
          latitude,
        ),
      }),
    );
  });

  function getOrCreateNode(longitude: number, latitude: number): MutableNode {
    const key = coordinateKey(longitude, latitude);
    const existing = nodesByCoordinate.get(key);
    if (existing) return existing;
    const created: MutableNode = {
      id: createNodeId(dependencies.airportIdent, longitude, latitude),
      coordinate: projectCoordinate(longitude, latitude, dependencies),
      adjacentNodeIds: new Set(),
    };
    nodesByCoordinate.set(key, created);
    return created;
  }

  snapshot.elements.forEach((element) => {
    const kind = element.tags?.aeroway as CandidateNetworkKind | undefined;
    const geometry = element.geometry;
    if (
      element.type !== "way" ||
      !kind ||
      !ALLOWED_KINDS.has(kind) ||
      !geometry ||
      geometry.length < 2
    ) {
      skippedElementCount += 1;
      return;
    }
    const validGeometry = geometry.every(
      (point: Readonly<{ lat: number; lon: number }>) =>
        Number.isFinite(point.lon) && Number.isFinite(point.lat),
    );
    if (!validGeometry) {
      skippedElementCount += 1;
      return;
    }

    compiledWayCount += 1;
    kindSummary[kind].wayCount += 1;
    const bidirectional = element.tags?.oneway !== "yes";
    const ref = element.tags?.ref?.trim();

    for (let index = 0; index < geometry.length - 1; index += 1) {
      const fromPoint = geometry[index];
      const toPoint = geometry[index + 1];
      const fromNode = getOrCreateNode(fromPoint.lon, fromPoint.lat);
      const toNode = getOrCreateNode(toPoint.lon, toPoint.lat);
      if (fromNode.id === toNode.id) continue;

      const endpointKey = [fromNode.id, toNode.id].sort().join("|");
      const distance = calculateLocalDistance(
        fromNode.coordinate,
        toNode.coordinate,
      );
      const existing = edgesByEndpoints.get(endpointKey);
      if (existing) {
        existing.kinds.add(kind);
        existing.sourceWayIds.add(element.id);
        if (ref) existing.refs.add(ref);
        existing.bidirectional = existing.bidirectional && bidirectional;
        if (KIND_PRIORITY[kind] > KIND_PRIORITY[existing.primaryKind]) {
          existing.primaryKind = kind;
        }
        continue;
      }

      fromNode.adjacentNodeIds.add(toNode.id);
      toNode.adjacentNodeIds.add(fromNode.id);
      edgesByEndpoints.set(endpointKey, {
        id: `${dependencies.airportIdent}-OSM-E-${element.id}-${index + 1}`,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        primaryKind: kind,
        kinds: new Set([kind]),
        refs: new Set(ref ? [ref] : []),
        sourceWayIds: new Set([element.id]),
        lengthMeters: distance,
        bidirectional,
      });
    }
  });

  const nodes = [...nodesByCoordinate.values()].map(
    (node): CandidateNetworkNode =>
      Object.freeze({
        id: node.id,
        coordinate: node.coordinate,
        degree: node.adjacentNodeIds.size,
      }),
  );
  const edges = [...edgesByEndpoints.values()].map(
    (edge): CandidateNetworkEdge =>
      Object.freeze({
        id: edge.id,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        primaryKind: edge.primaryKind,
        kinds: Object.freeze([...edge.kinds]),
        refs: Object.freeze([...edge.refs]),
        sourceWayIds: Object.freeze([...edge.sourceWayIds]),
        lengthMeters: edge.lengthMeters,
        bidirectional: edge.bidirectional,
      }),
  );

  edges.forEach((edge) => {
    kindSummary[edge.primaryKind].edgeCount += 1;
    kindSummary[edge.primaryKind].lengthMeters += edge.lengthMeters;
  });
  const topologyReport = deriveTopologyReport(nodes, edges);
  const kindsByNodeId = new Map<string, Set<CandidateNetworkKind>>();
  nodes.forEach((node) => kindsByNodeId.set(node.id, new Set()));
  edges.forEach((edge) => {
    edge.kinds.forEach((kind) => {
      kindsByNodeId.get(edge.fromNodeId)?.add(kind);
      kindsByNodeId.get(edge.toNodeId)?.add(kind);
    });
  });
  const runwayConnectionPoints: CandidateOperationalPoint[] = nodes
    .filter((node) => {
      const kinds = kindsByNodeId.get(node.id);
      return (
        kinds?.has("runway") &&
        (kinds.has("taxiway") || kinds.has("taxilane"))
      );
    })
    .map((node, index) =>
      Object.freeze({
        id: `${dependencies.airportIdent}-RUNWAY-CONNECTION-${String(index + 1).padStart(2, "0")}`,
        sourceElementId: null,
        kind: "runway_connection" as const,
        ref: null,
        coordinate: node.coordinate,
        networkNodeId: node.id,
      }),
    );
  const nodeIds = new Set(nodes.map((node) => node.id));
  const operationalPoints = [...sourceOperationalPoints, ...runwayConnectionPoints].map(
    (point) =>
      point.networkNodeId && !nodeIds.has(point.networkNodeId)
        ? Object.freeze({ ...point, networkNodeId: null })
        : point,
  );
  const danglingNodeCount = nodes.filter((node) => node.degree === 1).length;
  const warnings = [
    "第一版仅按OSM共享顶点建立拓扑，尚未处理无共享顶点的几何交叉。",
    ...(topologyReport.components.length > 1
      ? [`候选路网包含${topologyReport.components.length}个连通分量，需要继续连接和清理。`]
      : []),
  ];
  const frozenKindSummary = Object.fromEntries(
    Object.entries(kindSummary).map(([kind, summary]) => [
      kind,
      Object.freeze({ ...summary }),
    ]),
  ) as Record<CandidateNetworkKind, CandidateNetworkKindSummary>;
  const serviceRoadNetwork = compileServiceRoads(snapshot, dependencies);

  return Object.freeze({
    schemaVersion: "1.0.0" as const,
    airportIdent: dependencies.airportIdent,
    authority: "candidate_only" as const,
    source: "OpenStreetMap" as const,
    compiledAt: new Date().toISOString(),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    operationalPoints: Object.freeze(operationalPoints),
    serviceRoadNetwork,
    report: Object.freeze({
      sourceElementCount: snapshot.elements.length,
      compiledWayCount,
      skippedElementCount,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      connectedComponentCount: topologyReport.components.length,
      largestComponentNodeCount: topologyReport.components[0]?.nodeCount ?? 0,
      danglingNodeCount,
      danglingNodes: Object.freeze({
        runwayEndNodeIds: Object.freeze(topologyReport.runwayEndNodeIds),
        parkingGuideEndNodeIds: Object.freeze(
          topologyReport.parkingGuideEndNodeIds,
        ),
        perimeterOperationalEndNodeIds: Object.freeze(
          topologyReport.perimeterOperationalEndNodeIds,
        ),
        suspectedBreakNodeIds: Object.freeze(
          topologyReport.suspectedBreakNodeIds,
        ),
      }),
      components: Object.freeze(topologyReport.components),
      kinds: Object.freeze(frozenKindSummary),
      warnings: Object.freeze(warnings),
    }),
  });
}
