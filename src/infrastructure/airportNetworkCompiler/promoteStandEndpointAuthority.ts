import type { AirportFeatureKind, ProjectedAirportFeature } from "../airportConfig";
import type { CandidateAirportNetwork } from "./types";

export type StandEndpointAuthorityPolicy = Readonly<{
  airportIdent: string;
  revision: string;
  reviewedAt: string;
  approvedBy: string;
  eligibleKinds: readonly AirportFeatureKind[];
  expectedMigratedStandCount: number;
}>;

export type StandEndpointAuthorityResult = Readonly<{
  features: readonly ProjectedAirportFeature[];
  bindings: Readonly<Record<string, string>>;
  report: Readonly<{
    migratedStandCount: number;
    retainedManualStandCount: number;
    endpointCandidateCount: number;
    maximumLegacyOffsetMeters: number;
  }>;
}>;

function featureCoordinate(feature: ProjectedAirportFeature) {
  return feature.geometry.type === "Point" ? feature.geometry.coordinates : null;
}

/** Rectangular minimum-cost assignment; rows must not exceed columns. */
function assign(costs: readonly (readonly number[])[]) {
  const rowCount = costs.length;
  const columnCount = costs[0]?.length ?? 0;
  if (rowCount > columnCount) {
    throw new Error("OSM停机位引导线末端数量不足，拒绝机位权威转换。");
  }
  const u = Array(rowCount + 1).fill(0);
  const v = Array(columnCount + 1).fill(0);
  const p = Array(columnCount + 1).fill(0);
  const way = Array(columnCount + 1).fill(0);
  for (let i = 1; i <= rowCount; i += 1) {
    p[0] = i;
    let column = 0;
    const minimum = Array(columnCount + 1).fill(Number.POSITIVE_INFINITY);
    const used = Array(columnCount + 1).fill(false);
    do {
      used[column] = true;
      const row = p[column];
      let delta = Number.POSITIVE_INFINITY;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) continue;
        const current = costs[row - 1]![candidate - 1]! - u[row] - v[candidate];
        if (current < minimum[candidate]) {
          minimum[candidate] = current;
          way[candidate] = column;
        }
        if (minimum[candidate] < delta) {
          delta = minimum[candidate];
          nextColumn = candidate;
        }
      }
      for (let candidate = 0; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) {
          u[p[candidate]] += delta;
          v[candidate] -= delta;
        } else {
          minimum[candidate] -= delta;
        }
      }
      column = nextColumn;
    } while (p[column] !== 0);
    do {
      const previous = way[column];
      p[column] = p[previous];
      column = previous;
    } while (column !== 0);
  }
  const result = Array(rowCount).fill(-1);
  for (let column = 1; column <= columnCount; column += 1) {
    if (p[column] > 0) result[p[column] - 1] = column - 1;
  }
  return result;
}

/**
 * 将获批范围内的人工机位运行坐标迁移到OSM停机位引导线末端。
 * 原要素编号、名称、登机口和廊桥展示均保留，仅替换运行坐标权威。
 */
export function promoteStandEndpointAuthority(
  network: CandidateAirportNetwork,
  features: readonly ProjectedAirportFeature[],
  policy: StandEndpointAuthorityPolicy,
): StandEndpointAuthorityResult {
  if (network.airportIdent !== policy.airportIdent) {
    throw new Error("机位端点转换策略与候选路网不属于同一机场。");
  }
  const eligibleKinds = new Set(policy.eligibleKinds);
  const stands = features.filter(
    (feature) =>
      feature.properties.airportIdent === policy.airportIdent &&
      eligibleKinds.has(feature.properties.kind) &&
      feature.geometry.type === "Point",
  );
  if (stands.length !== policy.expectedMigratedStandCount) {
    throw new Error(
      `${policy.airportIdent}待转换机位数量${stands.length}与批准数量${policy.expectedMigratedStandCount}不一致。`,
    );
  }
  const mainNodeIds = new Set(
    network.report.components
      .filter((component) => component.classification === "main_network")
      .flatMap((component) => component.nodeIds),
  );
  const endpointIds = new Set(network.report.danglingNodes.parkingGuideEndNodeIds);
  const endpoints = network.nodes
    .filter((node) => endpointIds.has(node.id) && mainNodeIds.has(node.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const costs = stands.map((stand) => {
    const coordinate = featureCoordinate(stand)!;
    return endpoints.map((endpoint) => Math.hypot(
      coordinate.local.eastMeters - endpoint.coordinate.local.eastMeters,
      coordinate.local.northMeters - endpoint.coordinate.local.northMeters,
    ));
  });
  const assignment = assign(costs);
  const bindings = Object.freeze(Object.fromEntries(
    stands.map((feature, index) => [feature.properties.id, endpoints[assignment[index]!]!.id]),
  ));
  const nodeById = new Map(endpoints.map((node) => [node.id, node]));
  const migratedIds = new Set(Object.keys(bindings));
  const migratedFeatures = features.map((feature): ProjectedAirportFeature => {
    const nodeId = bindings[feature.properties.id];
    const node = nodeId ? nodeById.get(nodeId) : null;
    if (!node || feature.geometry.type !== "Point") return feature;
    return Object.freeze({
      ...feature,
      properties: Object.freeze({
        ...feature.properties,
        runtimePositionAuthority: "compiled_parking_endpoint" as const,
      }),
      geometry: Object.freeze({
        type: "Point" as const,
        coordinates: node.coordinate,
      }),
    });
  });
  const offsets = stands.map((_feature, index) => costs[index]![assignment[index]!]!);
  return Object.freeze({
    features: Object.freeze(migratedFeatures),
    bindings,
    report: Object.freeze({
      migratedStandCount: stands.length,
      retainedManualStandCount: features.filter(
        (feature) => feature.properties.kind === "stand" && !migratedIds.has(feature.properties.id),
      ).length,
      endpointCandidateCount: endpoints.length,
      maximumLegacyOffsetMeters: Math.max(0, ...offsets),
    }),
  });
}
