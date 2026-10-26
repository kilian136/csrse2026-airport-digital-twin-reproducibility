import type { CandidateAirportNetwork } from "./types";

/**
 * 对候选路网生成稳定签名。节点、边、坐标或人工补线发生变化都会使签名失效，
 * 用于受控引入前锁定核验基线，不代表取得运行权威。
 */
export function createCandidateNetworkFingerprint(
  network: CandidateAirportNetwork,
): string {
  const nodePayload = network.nodes
    .map((node) => [
      "N",
      node.id,
      node.coordinate.wgs84.longitude.toFixed(7),
      node.coordinate.wgs84.latitude.toFixed(7),
    ].join("|"))
    .sort();
  const edgePayload = network.edges
    .map((edge) => [
      "E",
      edge.id,
      edge.fromNodeId,
      edge.toNodeId,
      edge.primaryKind,
      edge.kinds.join(","),
      edge.lengthMeters.toFixed(3),
      edge.bidirectional ? "B" : "O",
    ].join("|"))
    .sort();
  const payload = [...nodePayload, ...edgePayload].join("\n");
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
