import type {
  CandidateAirportNetwork,
  CandidateNetworkCorridor,
  CandidateNetworkEdge,
  CandidateNetworkRenderModel,
} from "./types";

function edgeSignature(edge: CandidateNetworkEdge): string {
  return [
    edge.primaryKind,
    edge.bidirectional ? "two-way" : "one-way",
    [...edge.refs].sort().join("/"),
  ].join("|");
}

function otherNodeId(edge: CandidateNetworkEdge, nodeId: string): string {
  return edge.fromNodeId === nodeId ? edge.toNodeId : edge.fromNodeId;
}

/**
 * 仅压缩候选层的绘制形态，不修改编译得到的原始节点和边。连续、同类型、
 * 同编号且方向属性一致的二度节点链会合并为一条折线；异常分量仍然保留。
 */
export function buildCandidateNetworkRenderModel(
  network: CandidateAirportNetwork,
): CandidateNetworkRenderModel {
  const edgesByNodeId = new Map<string, CandidateNetworkEdge[]>();
  network.nodes.forEach((node) => edgesByNodeId.set(node.id, []));
  network.edges.forEach((edge) => {
    edgesByNodeId.get(edge.fromNodeId)?.push(edge);
    edgesByNodeId.get(edge.toNodeId)?.push(edge);
  });

  const isolatedNodeIds = new Set(
    network.report.components
      .filter((component) => component.classification !== "main_network")
      .flatMap((component) => component.nodeIds),
  );
  const visitedEdgeIds = new Set<string>();
  const corridors: CandidateNetworkCorridor[] = [];

  function appendCorridor(firstEdge: CandidateNetworkEdge, startNodeId: string) {
    if (visitedEdgeIds.has(firstEdge.id)) return;
    const signature = edgeSignature(firstEdge);
    const nodeIds = [startNodeId];
    const sourceEdges: CandidateNetworkEdge[] = [];
    let currentEdge = firstEdge;
    let currentNodeId = startNodeId;

    while (!visitedEdgeIds.has(currentEdge.id)) {
      visitedEdgeIds.add(currentEdge.id);
      sourceEdges.push(currentEdge);
      const nextNodeId = otherNodeId(currentEdge, currentNodeId);
      nodeIds.push(nextNodeId);
      const incidentEdges = edgesByNodeId.get(nextNodeId) ?? [];
      if (incidentEdges.length !== 2) break;
      const nextEdge = incidentEdges.find(
        (edge) =>
          edge.id !== currentEdge.id &&
          !visitedEdgeIds.has(edge.id) &&
          edgeSignature(edge) === signature,
      );
      if (!nextEdge) break;
      currentNodeId = nextNodeId;
      currentEdge = nextEdge;
    }

    corridors.push(
      Object.freeze({
        id: `CORRIDOR-${sourceEdges[0].id}`,
        nodeIds: Object.freeze(nodeIds),
        sourceEdgeIds: Object.freeze(sourceEdges.map((edge) => edge.id)),
        primaryKind: firstEdge.primaryKind,
        refs: firstEdge.refs,
        lengthMeters: sourceEdges.reduce(
          (total, edge) => total + edge.lengthMeters,
          0,
        ),
        bidirectional: firstEdge.bidirectional,
        isolated: nodeIds.every((nodeId) => isolatedNodeIds.has(nodeId)),
      }),
    );
  }

  network.nodes.forEach((node) => {
    const incidentEdges = edgesByNodeId.get(node.id) ?? [];
    const isChainInterior =
      incidentEdges.length === 2 &&
      edgeSignature(incidentEdges[0]) === edgeSignature(incidentEdges[1]);
    if (isChainInterior) return;
    incidentEdges.forEach((edge) => appendCorridor(edge, node.id));
  });

  // 闭环没有端点，以上遍历不会进入；从任意未访问边开始即可完整保留。
  network.edges.forEach((edge) => appendCorridor(edge, edge.fromNodeId));

  return Object.freeze({
    corridors: Object.freeze(corridors),
    rawEdgeCount: network.edges.length,
    renderedCorridorCount: corridors.length,
    mergedEdgeCount: network.edges.length - corridors.length,
  });
}
