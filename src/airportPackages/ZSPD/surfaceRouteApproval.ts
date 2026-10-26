import type { SurfaceRouteManualApproval } from "../../infrastructure/airportNetworkCompiler";

/**
 * 浦东T1-A、T1-B指廊代表路线。
 * R3统一使用廊桥末端推算的机身中心作为滑行起点。
 */
export const pudongSurfaceRouteApproval = Object.freeze({
  airportIdent: "ZSPD",
  revision: "ZSPD-SURFACE-ROUTES-2026-10-19-R4",
  reviewedAt: "2026-10-19",
  approvedBy: "用户批准浦东全量机位OSM端点转换",
  scope: Object.freeze({
    sourceGroups: Object.freeze(["T1-A", "T1-B"]),
    unreviewedSources: "candidate_only" as const,
  }),
  samples: Object.freeze([
    Object.freeze({
      label: "T1-A近",
      sourceName: "T1-A-G35",
      destinationName: "等待点AH08",
      distanceMeters: 134,
      result: "passed" as const,
    }),
    Object.freeze({
      label: "T1-A中",
      sourceName: "T1-A-G18",
      destinationName: "等待点HP02",
      distanceMeters: 311,
      result: "passed" as const,
    }),
    Object.freeze({
      label: "T1-A远",
      sourceName: "T1-A-G01",
      destinationName: "等待点AH01",
      distanceMeters: 681,
      result: "passed" as const,
    }),
    Object.freeze({
      label: "T1-B近",
      sourceName: "T1-B-G08",
      destinationName: "等待点AH08",
      distanceMeters: 277,
      result: "passed" as const,
    }),
    Object.freeze({
      label: "T1-B中",
      sourceName: "T1-B-G23",
      destinationName: "OSM跑道等待点",
      distanceMeters: 663,
      result: "passed" as const,
    }),
    Object.freeze({
      label: "T1-B远",
      sourceName: "T1-B-G01",
      destinationName: "OSM跑道等待点",
      distanceMeters: 1_134,
      result: "passed" as const,
    }),
  ]),
} satisfies SurfaceRouteManualApproval);
