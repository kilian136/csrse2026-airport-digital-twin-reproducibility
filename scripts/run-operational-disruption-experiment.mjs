import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { getAirportViewerPackage } from "../src/airportPackages/registry.ts";
import { nanjingAirportState } from "../src/airportPackages/ZSNJ/airportState.ts";
import { pudongAirportState } from "../src/airportPackages/ZSPD/airportState.ts";
import { initialAirportState } from "../src/data/initialAirportState.ts";
import { compileGroundSupportTravelRoutes } from "../src/application/simulation/compileGroundSupportTravelRoutes.ts";
import {
  operationalDisruptionExperimentToCsv,
  runOperationalDisruptionExperimentMatrix,
} from "../src/application/simulation/operationalDisruptionExperiment.ts";
import {
  operationalDisruptionBatchToCsv,
  runOperationalDisruptionBatchExperiment,
} from "../src/application/simulation/operationalDisruptionBatchExperiment.ts";
import { createSimulationScenarioSnapshot } from "../src/application/simulation/simulationScenarioSnapshot.ts";
import {
  applyServiceRoadGapRepairDecisions,
  auditServiceRoadTopology,
  buildServiceRoadConnectionDraft,
  compileOsmAirportNetwork,
  deriveCandidateRunwayCatalog,
  integrateManualNetworkCalibration,
  promoteRunwayHoldingPointAssignments,
  proposeServiceRoadGapRepairs,
} from "../src/infrastructure/airportNetworkCompiler/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "artifacts", "csrse2026");
const seed = Number.parseInt(process.argv[2] ?? "42", 10);
const runsPerCase = Number.parseInt(process.argv[3] ?? "1", 10);
if (!Number.isInteger(seed) || seed < 1) {
  throw new Error("实验种子必须是大于0的整数。");
}
if (!Number.isInteger(runsPerCase) || runsPerCase < 1 || runsPerCase > 30) {
  throw new Error("实验轮数必须是1至30之间的整数。");
}

const sources = [
  { airportIdent: "ZSHC", airportName: "杭州萧山国际机场", state: initialAirportState },
  { airportIdent: "ZSPD", airportName: "上海浦东国际机场", state: pudongAirportState },
  { airportIdent: "ZSNJ", airportName: "南京禄口国际机场", state: nanjingAirportState },
];

const runwayProfilesByAirport = {};
const groundSupportTravelRoutesByAirport = {};
for (const source of sources) {
  const airportPackage = getAirportViewerPackage(source.airportIdent);
  if (!airportPackage) throw new Error(`缺少机场包${source.airportIdent}。`);
  const snapshotPath = path.join(
    root,
    "public",
    "airport-data",
    source.airportIdent,
    "osm-raw.json",
  );
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const compiled = compileOsmAirportNetwork(snapshot, {
    airportIdent: source.airportIdent,
    localCoordinateConverter: airportPackage.integration.localCoordinateConverter,
  });
  const network = airportPackage.integration.manualNetworkCalibration
    ? integrateManualNetworkCalibration(
        compiled,
        airportPackage.integration.manualNetworkCalibration,
        airportPackage.integration.localCoordinateConverter,
        12,
        airportPackage.integration.manualParkingPositionCatalog,
        airportPackage.integration.candidateStandClassificationCatalog,
      )
    : compiled;
  const connectionDraft = buildServiceRoadConnectionDraft(
    network,
    airportPackage.integration.features,
  );
  const baseTopology = auditServiceRoadTopology(network, connectionDraft);
  const repairProposal = applyServiceRoadGapRepairDecisions(
    proposeServiceRoadGapRepairs(baseTopology),
    airportPackage.serviceRoadGapDecisions ?? [],
    baseTopology,
  );
  const topology = auditServiceRoadTopology(
    network,
    connectionDraft,
    repairProposal.candidates,
  );
  groundSupportTravelRoutesByAirport[source.airportIdent] =
    compileGroundSupportTravelRoutes(source.state, topology);

  const candidateCatalog = deriveCandidateRunwayCatalog(network);
  const runwayCatalog = airportPackage.runwayHoldingPointApproval
    ? promoteRunwayHoldingPointAssignments(
        candidateCatalog,
        airportPackage.runwayHoldingPointApproval,
      )
    : candidateCatalog;
  runwayProfilesByAirport[source.airportIdent] = runwayCatalog.runways.map((runway) => ({
    id: airportPackage.runwayBindings?.[runway.ref] ?? runway.ref,
    ref: runway.ref,
    lengthMeters: runway.lengthMeters,
    permittedDesignators: runway.ends.map((end) => end.designator),
    authority: "approved_compiled_wgs84",
  }));
}

const scenario = createSimulationScenarioSnapshot(
  sources,
  "2026-10-23T00:00:00.000Z",
);
const contractOptions = {
  maximumAircraftPerAirport: scenario.fleetAircraftIds.length,
  runwayProfilesByAirport,
  groundSupportTravelRoutesByAirport,
};
const report = runsPerCase === 1
  ? runOperationalDisruptionExperimentMatrix(scenario, {
      seed,
      contractOptions,
    })
  : runOperationalDisruptionBatchExperiment(scenario, {
      firstSeed: seed,
      runsPerCase,
      contractOptions,
    });

await mkdir(outputDirectory, { recursive: true });
const baseName = runsPerCase === 1
  ? `operational-disruption-seed-${seed}`
  : `operational-disruption-batch-seeds-${seed}-${seed + runsPerCase - 1}`;
const jsonPath = path.join(outputDirectory, `${baseName}.json`);
const csvPath = path.join(outputDirectory, `${baseName}.csv`);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(
  csvPath,
  `${runsPerCase === 1
    ? operationalDisruptionExperimentToCsv(report)
    : operationalDisruptionBatchToCsv(report)}\n`,
  "utf8",
);

console.log(JSON.stringify({
  jsonPath,
  csvPath,
  caseCount: report.caseCount,
  runsPerCase,
  reproducible: runsPerCase === 1
    ? report.allCasesReproducible
    : report.deterministicReplayVerified,
  operationallyValid: runsPerCase === 1
    ? report.allCasesOperationallyValid
    : report.allRunsOperationallyValid,
}, null, 2));
