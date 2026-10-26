export type AirportControlledIntroductionBaseline = Readonly<{
  airportIdent: string;
  revision: string;
  frozenAt: string;
  authority: "shadow_validation_only";
  status: "topology_shadow_validated";
  mayDriveSimulation: false;
  fingerprints: Readonly<{
    candidateNetwork: string;
    standConfiguration: string;
    standConnections: string;
  }>;
  counts: Readonly<{
    networkNodeCount: number;
    networkEdgeCount: number;
    runwayCount: number;
    holdingPointCount: number;
    activeStandCount: number;
    reachableStandRouteCount: number;
    unreachableStandRouteCount: number;
    runwayIntrusionRouteCount: number;
    serviceAnchorCount: number;
    reachableServiceRouteCount: number;
    unresolvedAircraftNetworkBreakCount: number;
  }>;
  remainingPrerequisites: readonly string[];
}>;
