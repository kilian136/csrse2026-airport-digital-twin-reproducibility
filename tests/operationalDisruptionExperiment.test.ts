import assert from "node:assert/strict";
import test from "node:test";

import { nanjingAirportState } from "../src/airportPackages/ZSNJ/airportState.ts";
import { pudongAirportState } from "../src/airportPackages/ZSPD/airportState.ts";
import { initialAirportState } from "../src/data/initialAirportState.ts";
import {
  operationalDisruptionExperimentToCsv,
  runOperationalDisruptionExperimentMatrix,
} from "../src/application/simulation/operationalDisruptionExperiment.ts";
import {
  operationalDisruptionBatchToCsv,
  runOperationalDisruptionBatchExperiment,
} from "../src/application/simulation/operationalDisruptionBatchExperiment.ts";
import { createSimulationScenarioSnapshot } from "../src/application/simulation/simulationScenarioSnapshot.ts";

const runwayProfilesByAirport = Object.freeze({
  ZSHC: Object.freeze([
    Object.freeze({ id: "ZSHC-RWY-A", ref: "07/25", lengthMeters: 3_600, permittedDesignators: ["07", "25"], authority: "approved_compiled_wgs84" as const }),
    Object.freeze({ id: "ZSHC-RWY-B", ref: "06/24", lengthMeters: 3_400, permittedDesignators: ["06", "24"], authority: "approved_compiled_wgs84" as const }),
  ]),
  ZSPD: Object.freeze([
    Object.freeze({ id: "ZSPD-RWY-A", ref: "16L/34R", lengthMeters: 4_000, permittedDesignators: ["16L", "34R"], authority: "approved_compiled_wgs84" as const }),
    Object.freeze({ id: "ZSPD-RWY-B", ref: "16R/34L", lengthMeters: 3_800, permittedDesignators: ["16R", "34L"], authority: "approved_compiled_wgs84" as const }),
  ]),
  ZSNJ: Object.freeze([
    Object.freeze({ id: "ZSNJ-RWY-A", ref: "06/24", lengthMeters: 3_600, permittedDesignators: ["06", "24"], authority: "approved_compiled_wgs84" as const }),
    Object.freeze({ id: "ZSNJ-RWY-B", ref: "07/25", lengthMeters: 3_400, permittedDesignators: ["07", "25"], authority: "approved_compiled_wgs84" as const }),
  ]),
});

function createScenario() {
  return createSimulationScenarioSnapshot([
    { airportIdent: "ZSHC", airportName: "杭州萧山国际机场", state: initialAirportState },
    { airportIdent: "ZSPD", airportName: "上海浦东国际机场", state: pudongAirportState },
    { airportIdent: "ZSNJ", airportName: "南京禄口国际机场", state: nanjingAirportState },
  ], "2026-10-23T00:00:00.000Z");
}

test("同快照同种子的五组运行异常实验形成可复现且合法的论文结果矩阵", () => {
  const report = runOperationalDisruptionExperimentMatrix(createScenario(), {
    seed: 42,
    contractOptions: {
      maximumAircraftPerAirport: 65,
      runwayProfilesByAirport,
    },
  });

  assert.equal(report.airportCount, 3);
  assert.equal(report.fleetSize, 65);
  assert.equal(report.caseCount, 5);
  assert.equal(report.allCasesReproducible, true);
  assert.equal(report.allCasesOperationallyValid, true);
  report.cases.forEach((item) => {
    assert.equal(item.completionRate, 1, `${item.caseId}任务未完全闭环`);
    assert.equal(item.invariantViolationCount, 0, `${item.caseId}存在不变量违规`);
    assert.equal(item.transitionRejectionCount, 0, `${item.caseId}存在非法转换`);
    assert.equal(item.replayCheckpointCount, 289);
  });

  const baseline = report.cases.find((item) => item.caseId === "baseline");
  const weather = report.cases.find((item) => item.caseId === "weather_only");
  const runway = report.cases.find((item) => item.caseId === "runway_closure_only");
  const equipment = report.cases.find((item) => item.caseId === "equipment_outage_only");
  const combined = report.cases.find((item) => item.caseId === "combined");
  assert.ok(baseline && weather && runway && equipment && combined);
  assert.equal(baseline.weatherAffectedMissionCount, 0);
  assert.equal(baseline.runwayClosureAffectedMissionCount, 0);
  assert.equal(baseline.equipmentOutageAffectedMissionCount, 0);
  assert.ok(weather.weatherAffectedMissionCount > 0);
  assert.ok(runway.runwayClosureAffectedMissionCount > 0);
  assert.ok(runway.runwayReassignmentCount > 0 || runway.runwayClosureDelayHours > 0);
  assert.ok(equipment.equipmentOutageAffectedMissionCount > 0);
  assert.ok(equipment.equipmentReassignmentCount > 0 || equipment.equipmentOutageDelayHours > 0);
  assert.ok(combined.weatherAffectedMissionCount > 0);
  assert.ok(combined.runwayClosureAffectedMissionCount > 0);
  assert.ok(combined.equipmentOutageAffectedMissionCount > 0);

  const csv = operationalDisruptionExperimentToCsv(report);
  assert.equal(csv.split("\n").length, 6);
  assert.match(csv, /case_id,label,seed/);
  assert.match(csv, /combined,组合运行异常/);
});

test("异常实验矩阵拒绝缺少正式跑道档案的论文场景", () => {
  assert.throws(
    () => runOperationalDisruptionExperimentMatrix(createScenario(), {
      seed: 42,
      contractOptions: { maximumAircraftPerAirport: 65 },
    }),
    /正式跑道档案/,
  );
});

test("多种子配对实验输出均值标准差置信区间与效应量", () => {
  const progress: string[] = [];
  const report = runOperationalDisruptionBatchExperiment(createScenario(), {
    firstSeed: 42,
    runsPerCase: 2,
    verifyFirstSeedReplay: false,
    contractOptions: {
      maximumAircraftPerAirport: 20,
      runwayProfilesByAirport,
    },
    onSeedCompleted: (completed, total) => progress.push(`${completed}/${total}`),
  });
  assert.equal(report.runCountPerCase, 2);
  assert.equal(report.totalRunCount, 10);
  assert.equal(report.caseCount, 5);
  assert.equal(report.allRunsOperationallyValid, true);
  assert.equal(report.deterministicReplayVerified, false);
  assert.deepEqual(progress, ["1/2", "2/2"]);
  const baseline = report.aggregates.find((item) => item.caseId === "baseline");
  const weather = report.aggregates.find((item) => item.caseId === "weather_only");
  const equipment = report.aggregates.find(
    (item) => item.caseId === "equipment_outage_only",
  );
  assert.ok(baseline && weather && equipment);
  assert.equal(baseline.resourceDelayEffectVsBaseline.meanDifference, 0);
  assert.ok(
    weather.resourceDelayEffectVsBaseline.meanDifference >= 0,
    "天气限制不应降低相对基准资源等待",
  );
  assert.ok(equipment.equipmentReassignmentCount.mean > 0);
  assert.ok(
    equipment.resourceDelayEffectVsBaseline.confidence95Lower <=
      equipment.resourceDelayEffectVsBaseline.meanDifference,
  );
  assert.ok(
    equipment.resourceDelayEffectVsBaseline.confidence95Upper >=
      equipment.resourceDelayEffectVsBaseline.meanDifference,
  );
  const csv = operationalDisruptionBatchToCsv(report);
  assert.equal(csv.split("\n").length, 6);
  assert.match(csv, /resource_delay_effect_dz/);
});
