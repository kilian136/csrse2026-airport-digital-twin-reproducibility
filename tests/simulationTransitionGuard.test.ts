import assert from "node:assert/strict";
import test from "node:test";

import { nanjingAirportState } from "../src/airportPackages/ZSNJ/airportState.ts";
import { pudongAirportState } from "../src/airportPackages/ZSPD/airportState.ts";
import { initialAirportState } from "../src/data/initialAirportState.ts";
import { runResourceConstrainedEventEngine } from "../src/application/simulation/resourceConstrainedEventEngine.ts";
import { buildSimulationInputContract } from "../src/application/simulation/simulationContract.ts";
import { projectSimulationExecutionState } from "../src/application/simulation/simulationExecutionProjection.ts";
import { createSimulationScenarioSnapshot } from "../src/application/simulation/simulationScenarioSnapshot.ts";
import {
  assertSimulationTransitionAllowed,
  auditPlannedTransitionGuards,
  evaluateSimulationTransition,
} from "../src/application/simulation/simulationTransitionGuard.ts";

function createFixture(seed = 42) {
  const scenario = createSimulationScenarioSnapshot([
    { airportIdent: "ZSHC", airportName: "杭州萧山国际机场", state: initialAirportState },
    { airportIdent: "ZSPD", airportName: "上海浦东国际机场", state: pudongAirportState },
    { airportIdent: "ZSNJ", airportName: "南京禄口国际机场", state: nanjingAirportState },
  ], "2026-10-23T00:00:00.000Z");
  const input = buildSimulationInputContract(scenario, {
    seed,
    maximumAircraftPerAirport: scenario.fleetAircraftIds.length,
  });
  const result = runResourceConstrainedEventEngine(input);
  return { input, result };
}

test("三机场72小时计划中的起飞到达及保障转换全部通过前置守卫", () => {
  const { input, result } = createFixture();
  const audit = auditPlannedTransitionGuards(input, result);
  assert.ok(audit.checkedTransitionCount > 0);
  assert.equal(audit.status, "passed", JSON.stringify(audit.rejected.slice(0, 5), null, 2));
  assert.equal(audit.rejectedTransitionCount, 0);
  assert.equal(audit.acceptedTransitionCount, audit.checkedTransitionCount);
});

test("同秒维修完成与自动放行先于起飞时守卫按事件序列判定", () => {
  const { input, result } = createFixture();
  const workOrder = result.maintenanceWorkOrders.find((candidate) =>
    candidate.endOffsetSeconds !== null && result.events.some(
      (event) =>
        event.type === "flight_departed" &&
        event.aircraftId === candidate.aircraftId &&
        event.offsetSeconds > candidate.endOffsetSeconds!,
    )
  );
  assert.ok(workOrder?.endOffsetSeconds);
  const departure = result.events.find(
    (event) =>
      event.type === "flight_departed" &&
      event.aircraftId === workOrder.aircraftId &&
      event.offsetSeconds > workOrder.endOffsetSeconds!,
  );
  assert.ok(departure);
  const events = result.events
    .map((event) =>
      (event.type === "maintenance_completed" ||
        event.type === "maintenance_release_issued") &&
      event.payload.workOrderId === workOrder.id
        ? { ...event, offsetSeconds: departure.offsetSeconds }
        : event
    )
    .sort(
      (left, right) =>
        left.offsetSeconds - right.offsetSeconds ||
        left.priority - right.priority ||
        left.id.localeCompare(right.id),
    )
    .map((event, sequence) => ({ ...event, sequence }));
  const maintenanceWindows = result.maintenanceWindows.map((window) =>
    window.id === workOrder.maintenanceWindowId
      ? { ...window, endOffsetSeconds: departure.offsetSeconds }
      : window
  );
  const audit = auditPlannedTransitionGuards(input, {
    ...result,
    events,
    maintenanceWindows,
  });
  assert.equal(audit.status, "passed", JSON.stringify(audit.rejected, null, 2));
  assert.equal(audit.rejectedTransitionCount, 0);
});

test("已占用机位不能分配给另一架飞机", () => {
  const { input, result } = createFixture();
  const projection = projectSimulationExecutionState(input, result, 0);
  const [standId, occupantId] = Object.entries(projection.standOccupancy)[0] ?? [];
  const anotherAircraft = projection.aircraft.find(
    (aircraft) => aircraft.id !== occupantId && aircraft.currentAirportIdent !== null,
  );
  assert.ok(standId && occupantId && anotherAircraft?.currentAirportIdent);
  const decision = evaluateSimulationTransition(input, projection, {
    type: "assign_stand",
    aircraftId: anotherAircraft.id,
    airportIdent: anotherAircraft.currentAirportIdent,
    standId,
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.rejections.some((item) => item.ruleId === "G-STAND-AVAILABLE"));
});

test("飞机不在计划出发机场时起飞请求在改变状态前被拒绝", () => {
  const { input, result } = createFixture();
  const projection = projectSimulationExecutionState(input, result, 0);
  const aircraft = projection.aircraft.find((candidate) => candidate.currentAirportIdent);
  assert.ok(aircraft?.currentAirportIdent);
  const wrongAirport = input.airports.find(
    (airport) => airport.ident !== aircraft.currentAirportIdent,
  );
  assert.ok(wrongAirport);
  assert.throws(
    () => assertSimulationTransitionAllowed(input, projection, {
      type: "flight_departure",
      aircraftId: aircraft.id,
      missionId: "TEST-INVALID-DEPARTURE",
      sourceAirportIdent: wrongAirport.ident,
      sourceStandId: aircraft.currentStandId,
      departureClearanceIssued: false,
    }),
    /G-DEPARTURE-SOURCE-AIRPORT/,
  );
});

test("地面飞机不能伪造到达事件直接接管另一机场机位", () => {
  const { input, result } = createFixture();
  const projection = projectSimulationExecutionState(input, result, 0);
  const aircraft = projection.aircraft.find((candidate) => candidate.currentAirportIdent);
  const destination = input.airports.find(
    (airport) => airport.ident !== aircraft?.currentAirportIdent,
  );
  const stand = destination?.stands.find(
    (candidate) => projection.standOccupancy[candidate.id] === undefined,
  );
  assert.ok(aircraft && destination && stand);
  const decision = evaluateSimulationTransition(input, projection, {
    type: "flight_arrival",
    aircraftId: aircraft.id,
    missionId: "TEST-INVALID-ARRIVAL",
    destinationAirportIdent: destination.ident,
    destinationStandId: stand.id,
    destinationHandoffAccepted: false,
    arrivalClearanceIssued: false,
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.rejections.some((item) => item.ruleId === "G-ARRIVAL-ACTIVE-FLIGHT"));
});

test("正在执行任务的保障车辆不能被另一任务重复取得", () => {
  const { input, result } = createFixture();
  const dispatch = result.events.find((event) => event.type === "support_dispatched");
  assert.ok(
    dispatch?.aircraftId && dispatch.missionId && dispatch.airportIdent &&
    typeof dispatch.payload.vehicleId === "string",
  );
  const projection = projectSimulationExecutionState(
    input,
    result,
    dispatch.offsetSeconds + 0.001,
  );
  const decision = evaluateSimulationTransition(input, projection, {
    type: "support_acquire",
    resourceId: dispatch.payload.vehicleId,
    aircraftId: dispatch.aircraftId,
    missionId: `${dispatch.missionId}-CONFLICT`,
    airportIdent: dispatch.airportIdent,
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.rejections.some((item) => item.ruleId === "G-RESOURCE-AVAILABLE"));
});

test("维修未完成时不能签发适航放行", () => {
  const { input, result } = createFixture();
  const projection = projectSimulationExecutionState(input, result, 0);
  const aircraft = projection.aircraft.find((candidate) => candidate.currentAirportIdent);
  assert.ok(aircraft?.currentAirportIdent);
  const decision = evaluateSimulationTransition(input, projection, {
    type: "maintenance_release",
    aircraftId: aircraft.id,
    airportIdent: aircraft.currentAirportIdent,
    workOrderId: "WO-UNFINISHED",
    maintenanceCompleted: false,
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.rejections.some(
    (item) => item.ruleId === "G-MAINTENANCE-RELEASE-COMPLETION",
  ));
});

test("删除自动起飞批准后计划守卫拒绝对应起飞事件", () => {
  const { input, result } = createFixture();
  const mission = result.missions[0];
  assert.ok(mission);
  const invalidResult = {
    ...result,
    events: result.events.filter((event) => !(
      event.missionId === mission.id && event.type === "departure_clearance_issued"
    )),
  };
  const audit = auditPlannedTransitionGuards(input, invalidResult);
  assert.equal(audit.status, "failed");
  assert.ok(audit.rejected.some((item) =>
    item.decision.request.type === "flight_departure" &&
    item.decision.request.missionId === mission.id &&
    item.decision.rejections.some((reason) => reason.ruleId === "G-DEPARTURE-CLEARANCE")
  ));
});

test("删除目的机场接管或降落批准后计划守卫拒绝对应到达事件", () => {
  const { input, result } = createFixture();
  const mission = result.missions[0];
  assert.ok(mission);
  for (const removedType of [
    "destination_handoff_accepted",
    "arrival_clearance_issued",
  ] as const) {
    const invalidResult = {
      ...result,
      events: result.events.filter((event) => !(
        event.missionId === mission.id && event.type === removedType
      )),
    };
    const audit = auditPlannedTransitionGuards(input, invalidResult);
    assert.equal(audit.status, "failed");
    assert.ok(audit.rejected.some((item) =>
      item.decision.request.type === "flight_arrival" &&
      item.decision.request.missionId === mission.id
    ));
  }
});

test("删除维修完成记录后适航放行被守卫拒绝", () => {
  const { input, result } = createFixture();
  const release = result.events.find(
    (event) => event.type === "maintenance_release_issued" &&
      typeof event.payload.workOrderId === "string",
  );
  assert.ok(release && typeof release.payload.workOrderId === "string");
  const invalidResult = {
    ...result,
    events: result.events.filter((event) => !(
      event.type === "maintenance_completed" &&
      event.payload.workOrderId === release.payload.workOrderId
    )),
  };
  const audit = auditPlannedTransitionGuards(input, invalidResult);
  assert.equal(audit.status, "failed");
  assert.ok(audit.rejected.some((item) =>
    item.decision.request.type === "maintenance_release" &&
    item.decision.request.workOrderId === release.payload.workOrderId &&
    item.decision.rejections.some(
      (reason) => reason.ruleId === "G-MAINTENANCE-RELEASE-COMPLETION",
    )
  ));
});
