import type {
  RestrictedZone,
  RunwayId,
  TaxiEdge,
  TaxiNode,
} from "../domain/groundTraffic";
import type {
  ServiceRoadEdge,
  ServiceRoadNode,
} from "../domain/groundSupport";
import type { MaintenanceApronId } from "../domain/maintenance";
export type RunwayProfile = {
  id: RunwayId;
  name: string;
  restrictedZoneId: string;
  westHoldingNodeId: string;
  eastHoldingNodeId: string;
  westEntryNodeId: string;
  eastEntryNodeId: string;
};

export type AirportOperationsNetwork = {
  routing: {
    zoneExitNodeIds: Record<string, string>;
    maintenanceEntryNodeIds: Record<MaintenanceApronId, string>;
    runwayEntryNodeIds: Record<RunwayId, { W: string; E: string }>;
  };
  taxiNetwork: {
    version: string;
    runways: RunwayProfile[];
    nodes: TaxiNode[];
    edges: TaxiEdge[];
    restrictedZones: RestrictedZone[];
  };
  serviceRoadNetwork: {
    nodes: ServiceRoadNode[];
    edges: ServiceRoadEdge[];
    supportBaseNodeIds: Record<string, string>;
    supportAreaWaitingNodeIds: Record<string, string>;
  };
};

export type AirportProfile = AirportOperationsNetwork & {
  identity: {
    id: string;
    icaoCode: string;
    iataCode: string;
    name: string;
    city: string;
    countryCode: string;
  };
};
