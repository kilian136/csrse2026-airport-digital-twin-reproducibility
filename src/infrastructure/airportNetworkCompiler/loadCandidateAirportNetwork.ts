import type { AirportGeospatialIntegration } from "../airportConfig";
import { compileOsmAirportNetwork } from "./compileOsmAirportNetwork";
import { integrateManualNetworkCalibration } from "./integrateManualNetworkCalibration";
import type { CandidateAirportNetwork, OsmSnapshot } from "./types";

const networkCache = new Map<string, Promise<CandidateAirportNetwork>>();

export function loadCandidateAirportNetwork(
  integration: AirportGeospatialIntegration,
): Promise<CandidateAirportNetwork> {
  const cached = networkCache.get(integration.airportIdent);
  if (cached) return cached;

  const pending = fetch(integration.networkSnapshotUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`OSM快照加载失败：HTTP ${response.status}`);
      }
      return response.json() as Promise<OsmSnapshot>;
    })
    .then((snapshot) => {
      const compiled = compileOsmAirportNetwork(snapshot, {
        airportIdent: integration.airportIdent,
        localCoordinateConverter: integration.localCoordinateConverter,
      });
      return integration.manualNetworkCalibration
        ? integrateManualNetworkCalibration(
            compiled,
            integration.manualNetworkCalibration,
            integration.localCoordinateConverter,
            12,
            integration.manualParkingPositionCatalog,
            integration.candidateStandClassificationCatalog,
          )
        : compiled;
    })
    .catch((error: unknown) => {
      networkCache.delete(integration.airportIdent);
      throw error;
    });
  networkCache.set(integration.airportIdent, pending);
  return pending;
}
