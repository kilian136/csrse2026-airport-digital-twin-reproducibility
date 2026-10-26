import type { ProjectedAirportFeature } from "../airportConfig";
import type {
  CandidateAirportNetwork,
  CandidateOperationalPoint,
} from "./types";

export type CandidateStandConfigurationRole =
  | "passenger_gate"
  | "remote_passenger"
  | "cargo"
  | "maintenance";

export type CandidateStandConfigurationDraft = Readonly<{
  schemaVersion: "1.0.0";
  airportIdent: string;
  authority: "candidate_configuration_draft";
  status: "ready_for_connection_review" | "blocked";
  mayDriveSimulation: false;
  features: readonly ProjectedAirportFeature[];
  report: Readonly<{
    totalStandCount: number;
    connectedToNetworkNodeCount: number;
    temporarilyAbandonedExcludedCount: number;
    unclassifiedSizeCount: number;
    countsByRole: Readonly<Record<CandidateStandConfigurationRole, number>>;
    countsByTerminal: Readonly<Record<string, number>>;
    countsBySizeProfile: Readonly<Record<string, number>>;
    unconnectedStandIds: readonly string[];
    blockingReasons: readonly string[];
    reviewNotes: readonly string[];
    sourceUpdatedAt: string;
    configurationFingerprint: string;
  }>;
}>;

const ROLE_KINDS = {
  passenger_gate: "gate",
  remote_passenger: "remote_stand",
  cargo: "cargo_stand",
  maintenance: "stand",
} as const;

function displayName(point: CandidateOperationalPoint): string {
  const label = point.ref ?? point.mapLabel ?? point.id;
  if (point.standOperationalRole === "passenger_gate") {
    return `${point.terminalAffinity ?? "航站楼"}机位${label}`;
  }
  if (point.standOperationalRole === "remote_passenger") return `远机位${label}`;
  if (point.standOperationalRole === "cargo") return `货机位${label}`;
  if (point.standOperationalRole === "maintenance") return `维修机位${label}`;
  return `候选机位${label}`;
}

function compatibleSizeCategories(
  point: CandidateOperationalPoint,
): readonly ("small" | "medium" | "large")[] | undefined {
  if (point.standSizeProfile === "small") return ["small"];
  if (point.standSizeProfile === "medium") return ["small", "medium"];
  if (point.standSizeProfile === "medium_large") return ["medium", "large"];
  if (point.standSizeProfile === "large") return ["large"];
  return undefined;
}

function fingerprint(features: readonly ProjectedAirportFeature[]): string {
  const payload = features
    .map((feature) => {
      const coordinate = feature.geometry.type === "Point"
        ? feature.geometry.coordinates.wgs84
        : null;
      return [
        feature.properties.id,
        feature.properties.kind,
        feature.properties.terminalAffinity ?? "",
        feature.properties.compatibleAircraftSizeCategories?.join(",") ?? "",
        coordinate?.longitude.toFixed(7) ?? "",
        coordinate?.latitude.toFixed(7) ?? "",
      ].join("|");
    })
    .sort()
    .join("\n");
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * 将已分类的候选机位固化为机场配置草案。
 * 草案只为后续连接审计提供稳定输入，不注册运行态机位，也不得驱动调度。
 */
export function buildCandidateStandConfigurationDraft(
  network: CandidateAirportNetwork,
): CandidateStandConfigurationDraft {
  const activePoints = network.operationalPoints.filter(
    (point) =>
      point.kind === "parking_position" &&
      point.standActivationStatus === "candidate_active",
  );
  const features = activePoints.flatMap((point): ProjectedAirportFeature[] => {
    const role = point.standOperationalRole;
    if (!role) return [];
    const compatibleAircraftSizeCategories = compatibleSizeCategories(point);
    return [{
      properties: Object.freeze({
        id: point.id,
        airportIdent: network.airportIdent,
        kind: ROLE_KINDS[role],
        name: displayName(point),
        createdAt: network.standClassification?.sourceUpdatedAt ?? network.compiledAt,
        terminalAffinity: point.terminalAffinity ?? undefined,
        parentZoneId:
          role === "maintenance" ? `${network.airportIdent}-MAINTENANCE-AREA` : undefined,
        compatibleAircraftSizeCategories,
        activationStatus: "candidate" as const,
        dataStatus: "partial" as const,
        source: point.sourceElementId === null ? "manual_editor" as const : "openstreetmap" as const,
        operational: false,
      }),
      geometry: Object.freeze({
        type: "Point" as const,
        coordinates: point.coordinate,
      }),
    }];
  });
  const unconnectedStandIds = activePoints
    .filter((point) => !point.networkNodeId)
    .map((point) => point.id)
    .sort();
  const missingRoleCount = activePoints.length - features.length;
  const expectedCount = network.standClassification?.activeCount ?? activePoints.length;
  const blockingReasons = [
    ...(activePoints.length !== expectedCount
      ? [`启用机位数量与分类摘要不一致：${activePoints.length}/${expectedCount}`]
      : []),
    ...(missingRoleCount > 0 ? [`${missingRoleCount}个启用机位缺少运行角色`] : []),
    ...(unconnectedStandIds.length > 0
      ? [`${unconnectedStandIds.length}个启用机位缺少路网节点`]
      : []),
  ];
  const roles: CandidateStandConfigurationRole[] = [
    "passenger_gate",
    "remote_passenger",
    "cargo",
    "maintenance",
  ];
  const countsByRole = Object.fromEntries(
    roles.map((role) => [
      role,
      activePoints.filter((point) => point.standOperationalRole === role).length,
    ]),
  ) as Record<CandidateStandConfigurationRole, number>;
  const countsByTerminal = activePoints.reduce<Record<string, number>>(
    (counts, point) => {
      if (point.terminalAffinity) {
        counts[point.terminalAffinity] = (counts[point.terminalAffinity] ?? 0) + 1;
      }
      return counts;
    },
    {},
  );
  const countsBySizeProfile = activePoints.reduce<Record<string, number>>(
    (counts, point) => {
      const profile = point.standSizeProfile ?? "unclassified";
      counts[profile] = (counts[profile] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const unclassifiedSizeCount = countsBySizeProfile.unclassified ?? 0;

  return Object.freeze({
    schemaVersion: "1.0.0" as const,
    airportIdent: network.airportIdent,
    authority: "candidate_configuration_draft" as const,
    status: blockingReasons.length === 0
      ? "ready_for_connection_review" as const
      : "blocked" as const,
    mayDriveSimulation: false as const,
    features: Object.freeze(features),
    report: Object.freeze({
      totalStandCount: features.length,
      connectedToNetworkNodeCount: activePoints.length - unconnectedStandIds.length,
      temporarilyAbandonedExcludedCount:
        network.standClassification?.temporarilyAbandonedCount ?? 0,
      unclassifiedSizeCount,
      countsByRole: Object.freeze(countsByRole),
      countsByTerminal: Object.freeze(countsByTerminal),
      countsBySizeProfile: Object.freeze(countsBySizeProfile),
      unconnectedStandIds: Object.freeze(unconnectedStandIds),
      blockingReasons: Object.freeze(blockingReasons),
      reviewNotes: Object.freeze([
        "草案未注册到机场运行态，当前不会生成飞机或参与机位调度。",
        ...(unclassifiedSizeCount > 0
          ? [`${unclassifiedSizeCount}个机位仍需补充机型尺寸适配规则。`]
          : []),
        "下一阶段需完成机位到飞机路网的逐项连接审计和人工批准。",
      ]),
      sourceUpdatedAt:
        network.standClassification?.sourceUpdatedAt ?? network.compiledAt,
      configurationFingerprint: fingerprint(features),
    }),
  });
}
