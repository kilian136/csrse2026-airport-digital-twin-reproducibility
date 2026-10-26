import type { AirportLocalCoordinateConverter } from "../domain/geo";
import type { AirportOperationsNetwork } from "./types";

export type NetworkMetricDistanceEntry = Readonly<{
  network: "taxi" | "service_road";
  edgeId: string;
  configuredDistanceMeters: number;
  derivedDistanceMeters: number;
  differenceMeters: number;
  differenceRatio: number;
  isCoincidentNodeConnector: boolean;
}>;

export type NetworkMetricDistanceAudit = Readonly<{
  taxiEdges: readonly NetworkMetricDistanceEntry[];
  serviceRoadEdges: readonly NetworkMetricDistanceEntry[];
}>;

type MapNode = Readonly<{
  id: string;
  x: number;
  y: number;
}>;

type MapEdge = Readonly<{
  id: string;
  fromNodeId: string;
  toNodeId: string;
  distance: number;
}>;

function deriveEdgeDistances(
  networkKind: NetworkMetricDistanceEntry["network"],
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
  converter: AirportLocalCoordinateConverter,
): NetworkMetricDistanceEntry[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return edges.map((edge) => {
    const fromNode = nodeById.get(edge.fromNodeId);
    const toNode = nodeById.get(edge.toNodeId);
    if (!fromNode || !toNode) {
      throw new Error(
        `无法计算路段 ${edge.id}：缺少节点 ${!fromNode ? edge.fromNodeId : edge.toNodeId}。`,
      );
    }

    const fromLocal = converter.mapToLocal(fromNode);
    const toLocal = converter.mapToLocal(toNode);
    const derivedDistanceMeters = Math.hypot(
      toLocal.eastMeters - fromLocal.eastMeters,
      toLocal.northMeters - fromLocal.northMeters,
    );
    const differenceMeters = derivedDistanceMeters - edge.distance;
    const isCoincidentNodeConnector = derivedDistanceMeters < 0.01;

    return Object.freeze({
      network: networkKind,
      edgeId: edge.id,
      configuredDistanceMeters: edge.distance,
      derivedDistanceMeters,
      differenceMeters,
      differenceRatio:
        edge.distance > 0 ? differenceMeters / edge.distance : 0,
      isCoincidentNodeConnector,
    });
  });
}

/**
 * 只读比较路网原有距离与坐标转换得到的真实米制直线距离。
 * 本函数不修改路网，便于正式切换前审查异常路段。
 */
export function deriveNetworkMetricDistanceAudit(
  network: AirportOperationsNetwork,
  converter: AirportLocalCoordinateConverter,
): NetworkMetricDistanceAudit {
  return Object.freeze({
    taxiEdges: deriveEdgeDistances(
      "taxi",
      network.taxiNetwork.nodes,
      network.taxiNetwork.edges,
      converter,
    ),
    serviceRoadEdges: deriveEdgeDistances(
      "service_road",
      network.serviceRoadNetwork.nodes,
      network.serviceRoadNetwork.edges,
      converter,
    ),
  });
}

/**
 * 根据局部米制坐标生成运行路网副本。
 * 节点、路由映射和限制区保持不变，仅替换边的 distance 字段；原路网不被修改。
 */
export function createMetricOperationsNetwork(
  network: AirportOperationsNetwork,
  converter: AirportLocalCoordinateConverter,
): AirportOperationsNetwork {
  const audit = deriveNetworkMetricDistanceAudit(network, converter);
  const taxiDistanceByEdgeId = new Map(
    audit.taxiEdges.map((entry) => [
      entry.edgeId,
      Math.max(1, Math.round(entry.derivedDistanceMeters)),
    ]),
  );
  const serviceRoadDistanceByEdgeId = new Map(
    audit.serviceRoadEdges.map((entry) => [
      entry.edgeId,
      entry.isCoincidentNodeConnector
        ? 0
        : Math.max(1, Math.round(entry.derivedDistanceMeters)),
    ]),
  );

  return {
    ...network,
    taxiNetwork: {
      ...network.taxiNetwork,
      edges: network.taxiNetwork.edges.map((edge) => ({
        ...edge,
        distance: taxiDistanceByEdgeId.get(edge.id) ?? edge.distance,
      })),
    },
    serviceRoadNetwork: {
      ...network.serviceRoadNetwork,
      edges: network.serviceRoadNetwork.edges.map((edge) => ({
        ...edge,
        distance: serviceRoadDistanceByEdgeId.get(edge.id) ?? edge.distance,
      })),
    },
  };
}
