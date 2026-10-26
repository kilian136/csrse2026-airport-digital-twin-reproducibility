import assert from "node:assert/strict";
import test from "node:test";

import { nanjingAirportState } from "../src/airportPackages/ZSNJ/airportState.ts";
import { pudongAirportState } from "../src/airportPackages/ZSPD/airportState.ts";
import { initialAirportState } from "../src/data/initialAirportState.ts";
import { runResourceConstrainedEventEngine } from "../src/application/simulation/resourceConstrainedEventEngine.ts";
import { buildSimulationInputContract } from "../src/application/simulation/simulationContract.ts";
import {
  compareSimulationReplayAudits,
  createSimulationReplayAudit,
} from "../src/application/simulation/simulationReplayAudit.ts";
import { createSimulationScenarioSnapshot } from "../src/application/simulation/simulationScenarioSnapshot.ts";

function createInput(seed = 42) {
  const scenario = createSimulationScenarioSnapshot([
    { airportIdent: "ZSHC", airportName: "杭州萧山国际机场", state: initialAirportState },
    { airportIdent: "ZSPD", airportName: "上海浦东国际机场", state: pudongAirportState },
    { airportIdent: "ZSNJ", airportName: "南京禄口国际机场", state: nanjingAirportState },
  ], "2026-10-23T00:00:00.000Z");
  return buildSimulationInputContract(scenario, {
    seed,
    maximumAircraftPerAirport: scenario.fleetAircraftIds.length,
  });
}

test("三机场65架机队的72小时方案可得到完全一致的重放指纹", () => {
  const input = createInput();
  assert.equal(input.airports.length, 3);
  assert.equal(input.aircraft.length, 65);

  const first = createSimulationReplayAudit(
    input,
    runResourceConstrainedEventEngine(input),
  );
  const second = createSimulationReplayAudit(
    input,
    runResourceConstrainedEventEngine(input),
  );
  const comparison = compareSimulationReplayAudits(first, second);

  assert.equal(first.checkpointCount, 289);
  assert.equal(first.manifest.seed, 42);
  assert.equal(comparison.reproducible, true, JSON.stringify(comparison, null, 2));
  assert.equal(comparison.comparedCheckpointCount, 289);
  assert.deepEqual(comparison.differences, []);
});

test("重放审计拒绝不同输入契约的结果", () => {
  const firstInput = createInput(42);
  const secondInput = createInput(43);
  const result = runResourceConstrainedEventEngine(firstInput);
  assert.throws(
    () => createSimulationReplayAudit(secondInput, result),
    /不匹配|不一致/,
  );
});
