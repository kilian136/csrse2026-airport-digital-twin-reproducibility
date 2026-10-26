import assert from "node:assert/strict";
import test from "node:test";

import { nanjingAirportState } from "../src/airportPackages/ZSNJ/airportState.ts";
import { pudongAirportState } from "../src/airportPackages/ZSPD/airportState.ts";
import { initialAirportState } from "../src/data/initialAirportState.ts";
import { runResourceConstrainedEventEngine } from "../src/application/simulation/resourceConstrainedEventEngine.ts";
import { buildSimulationInputContract } from "../src/application/simulation/simulationContract.ts";
import { projectSimulationExecutionState } from "../src/application/simulation/simulationExecutionProjection.ts";
import {
  evaluateProjectionInvariants,
  runSimulationInvariantAudit,
} from "../src/application/simulation/simulationInvariants.ts";
import { createSimulationScenarioSnapshot } from "../src/application/simulation/simulationScenarioSnapshot.ts";

function createFixture() {
  const scenario = createSimulationScenarioSnapshot([
    { airportIdent: "ZSHC", airportName: "杭州萧山国际机场", state: initialAirportState },
    { airportIdent: "ZSPD", airportName: "上海浦东国际机场", state: pudongAirportState },
    { airportIdent: "ZSNJ", airportName: "南京禄口国际机场", state: nanjingAirportState },
  ], "2026-10-23T00:00:00.000Z");
  const input = buildSimulationInputContract(scenario, {
    seed: 42,
    maximumAircraftPerAirport: scenario.fleetAircraftIds.length,
  });
  const result = runResourceConstrainedEventEngine(input);
  return { input, result };
}

test("三机场65架机队的基线72小时方案通过首批17项不变量审计", () => {
  const { input, result } = createFixture();
  assert.equal(input.airports.length, 3);
  assert.equal(input.aircraft.length, 65);
  const audit = runSimulationInvariantAudit(input, result);
  assert.equal(audit.checkpointCount, 289);
  assert.equal(audit.evaluatedRuleIds.length, 17);
  assert.equal(audit.status, "passed", JSON.stringify(audit.violations.slice(0, 10), null, 2));
  assert.equal(audit.levelACount, 0);
});

test("不变量检查器能够定位飞行中仍占机位的注入故障", () => {
  const { input, result } = createFixture();
  const projection = projectSimulationExecutionState(input, result, 0);
  const target = projection.aircraft.find((aircraft) => aircraft.currentStandId !== null);
  assert.ok(target);
  const injected = {
    ...projection,
    aircraft: projection.aircraft.map((aircraft) =>
      aircraft.id === target.id ? { ...aircraft, phase: "in_flight" as const } : aircraft
    ),
  };
  const violations = evaluateProjectionInvariants(input, injected);
  const detected = violations.find(
    (item) => item.ruleId === "A-IN-FLIGHT-NO-GROUND-OCCUPANCY",
  );
  assert.ok(detected);
  assert.equal(detected.aircraftId, target.id);
  assert.equal(detected.elapsedSeconds, 0);
});

test("不变量检查器能够定位同一飞机占用多个机位的注入故障", () => {
  const { input, result } = createFixture();
  const projection = projectSimulationExecutionState(input, result, 0);
  const occupied = Object.entries(projection.standOccupancy);
  assert.ok(occupied.length >= 2);
  const [firstStand, aircraftId] = occupied[0] ?? [];
  const [secondStand] = occupied[1] ?? [];
  assert.ok(firstStand && secondStand && aircraftId);
  const injected = {
    ...projection,
    standOccupancy: { ...projection.standOccupancy, [secondStand]: aircraftId },
  };
  const violations = evaluateProjectionInvariants(input, injected);
  const detected = violations.find(
    (item) => item.ruleId === "A-STAND-OCCUPANCY-UNIQUE",
  );
  assert.ok(detected);
  assert.equal(detected.aircraftId, aircraftId);
  assert.match(detected.evidence, new RegExp(`${firstStand}|${secondStand}`));
});
