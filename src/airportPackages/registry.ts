import type {
  AirportGeospatialIntegration,
  AirportSurfaceRuntimeState,
} from "../infrastructure/airportConfig";
import type {
  SurfaceNetworkBreakDecision,
  SurfaceRouteManualApproval,
  AirportStandConnectionManualApproval,
  RunwayHoldingPointManualApproval,
  ServiceRoadGapRepairDecision,
  StandEndpointAuthorityPolicy,
} from "../infrastructure/airportNetworkCompiler";
import { xiaoshanGeospatialIntegration } from "./ZSHC";
import { xiaoshanServiceRoadGapDecisions } from "./ZSHC/serviceRoadGapDecisions";
import { pudongGeospatialIntegration } from "./ZSPD";
import { pudongServiceRoadGapDecisions } from "./ZSPD/serviceRoadGapDecisions";
import { pudongSurfaceRuntimeState } from "./ZSPD/runtimeState";
import { pudongSurfaceBreakDecisions } from "./ZSPD/surfaceBreakDecisions";
import { pudongSurfaceRouteApproval } from "./ZSPD/surfaceRouteApproval";
import { pudongStandConnectionApproval } from "./ZSPD/standConnectionApproval";
import { pudongRunwayHoldingPointApproval } from "./ZSPD/runwayHoldingPointApproval";
import { pudongStandGuidanceBindings } from "./ZSPD/standGuidanceBindings";
import { pudongStandEndpointAuthorityPolicy } from "./ZSPD/standEndpointAuthorityPolicy";
import { xiaoshanStandEndpointAuthorityPolicy } from "./ZSHC/standEndpointAuthorityPolicy";
import type { AirportOperationsPolicy } from "../domain/airportOperationsPolicy";
import { xiaoshanOperationsPolicy } from "./ZSHC/operationalPolicy";
import { pudongOperationsPolicy } from "./ZSPD/operationalPolicy";
import type {
  AirportOperationalResourceConfiguration,
  AirportOperationalResourceReadiness,
} from "../domain/airportOperationalResources";
import {
  pudongOperationalResources,
  pudongOperationalResourceReadiness,
} from "./ZSPD/operationalResources";
import { pudongRuntimeResources } from "./ZSPD/runtimeResources";
import type { MaterializedAirportOperationalResources } from "../infrastructure/airportConfig";
import type { AirportState } from "../types/airport";
import { pudongAirportState } from "./ZSPD/airportState";
import { nanjingGeospatialIntegration } from "./ZSNJ";
import { nanjingOperationsPolicy } from "./ZSNJ/operationalPolicy";
import { nanjingRunwayHoldingPointApproval } from "./ZSNJ/runwayHoldingPointApproval";
import { nanjingSurfaceBreakDecisions } from "./ZSNJ/surfaceBreakDecisions";
import { nanjingSurfaceRouteApproval } from "./ZSNJ/surfaceRouteApproval";
import { nanjingStandConnectionApproval } from "./ZSNJ/standConnectionApproval";
import { nanjingServiceRoadGapDecisions } from "./ZSNJ/serviceRoadGapDecisions";
import { nanjingControlledIntroductionBaseline } from "./ZSNJ/controlledIntroductionBaseline";
import { nanjingSurfaceRuntimeState } from "./ZSNJ/runtimeState";
import type { AirportControlledIntroductionBaseline } from "../domain/airportControlledIntroduction";
import {
  nanjingOperationalResources,
  nanjingOperationalResourceReadiness,
} from "./ZSNJ/operationalResources";
import { nanjingRuntimeResources } from "./ZSNJ/runtimeResources";
import { nanjingAirportState } from "./ZSNJ/airportState";

export type AirportViewerPackage = Readonly<{
  airportIdent: string;
  name: string;
  mode:
    | "operational"
    | "controlled_surface_operation"
    | "surface_monitoring"
    | "reference_only";
  integration: AirportGeospatialIntegration;
  operationsPolicy: AirportOperationsPolicy;
  operationalResources?: AirportOperationalResourceConfiguration;
  operationalResourceReadiness?: AirportOperationalResourceReadiness;
  runtimeResources?: MaterializedAirportOperationalResources;
  /** 已装配的机场独立状态；共享业务引擎可直接消费。 */
  runtimeAirportState?: AirportState;
  surfaceRuntimeState?: AirportSurfaceRuntimeState;
  surfaceBreakDecisions?: readonly SurfaceNetworkBreakDecision[];
  surfaceRouteApproval?: SurfaceRouteManualApproval;
  standConnectionApproval?: AirportStandConnectionManualApproval;
  runwayHoldingPointApproval?: RunwayHoldingPointManualApproval;
  runwayBindings?: Readonly<Partial<Record<string, string>>>;
  standGuidanceBindings?: Readonly<Partial<Record<string, readonly string[]>>>;
  serviceRoadGapDecisions?: readonly ServiceRoadGapRepairDecision[];
  controlledIntroductionBaseline?: AirportControlledIntroductionBaseline;
  standEndpointAuthorityPolicy?: StandEndpointAuthorityPolicy;
}>;

export const airportViewerPackages: readonly AirportViewerPackage[] = Object.freeze([
  Object.freeze({
    airportIdent: "ZSHC",
    name: "杭州萧山国际机场",
    mode: "operational" as const,
    integration: xiaoshanGeospatialIntegration,
    operationsPolicy: xiaoshanOperationsPolicy,
    standEndpointAuthorityPolicy: xiaoshanStandEndpointAuthorityPolicy,
    serviceRoadGapDecisions: xiaoshanServiceRoadGapDecisions,
  }),
  Object.freeze({
    airportIdent: "ZSPD",
    name: "上海浦东国际机场",
    mode: "controlled_surface_operation" as const,
    integration: pudongGeospatialIntegration,
    operationsPolicy: pudongOperationsPolicy,
    operationalResources: pudongOperationalResources,
    operationalResourceReadiness: pudongOperationalResourceReadiness,
    runtimeResources: pudongRuntimeResources,
    runtimeAirportState: pudongAirportState,
    surfaceRuntimeState: pudongSurfaceRuntimeState,
    surfaceBreakDecisions: pudongSurfaceBreakDecisions,
    surfaceRouteApproval: pudongSurfaceRouteApproval,
    standConnectionApproval: pudongStandConnectionApproval,
    runwayHoldingPointApproval: pudongRunwayHoldingPointApproval,
    runwayBindings: Object.freeze({
      "15/33": "15/33",
      "16L/34R": "16L/34R",
      "16R/34L": "16R/34L",
      "17L/35R": "17L/35R",
      "17R/35L": "17R/35L",
    }),
    standGuidanceBindings: pudongStandGuidanceBindings,
    standEndpointAuthorityPolicy: pudongStandEndpointAuthorityPolicy,
    serviceRoadGapDecisions: pudongServiceRoadGapDecisions,
  }),
  Object.freeze({
    airportIdent: "ZSNJ",
    name: "南京禄口国际机场",
    mode: "controlled_surface_operation" as const,
    integration: nanjingGeospatialIntegration,
    operationsPolicy: nanjingOperationsPolicy,
    operationalResources: nanjingOperationalResources,
    operationalResourceReadiness: nanjingOperationalResourceReadiness,
    runtimeResources: nanjingRuntimeResources,
    runtimeAirportState: nanjingAirportState,
    surfaceBreakDecisions: nanjingSurfaceBreakDecisions,
    surfaceRouteApproval: nanjingSurfaceRouteApproval,
    standConnectionApproval: nanjingStandConnectionApproval,
    runwayHoldingPointApproval: nanjingRunwayHoldingPointApproval,
    runwayBindings: Object.freeze({ "06/24": "06/24", "07/25": "07/25" }),
    surfaceRuntimeState: nanjingSurfaceRuntimeState,
    controlledIntroductionBaseline: nanjingControlledIntroductionBaseline,
    serviceRoadGapDecisions: nanjingServiceRoadGapDecisions,
  }),
]);

export function getAirportViewerPackage(airportIdent: string) {
  return airportViewerPackages.find(
    (airportPackage) => airportPackage.airportIdent === airportIdent,
  ) ?? null;
}

export const airportViewerPackageIdents = Object.freeze(
  airportViewerPackages.map((airportPackage) => airportPackage.airportIdent),
);
