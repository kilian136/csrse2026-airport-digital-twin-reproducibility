import assert from "node:assert/strict";
import test from "node:test";

import {
  DeterministicRandom,
  orderReplayEvents,
  stableStringify,
  stateFingerprint,
} from "../src/application/simulation/deterministicReplay.ts";

test("相同种子生成相同随机序列且可以从检查点恢复", () => {
  const first = new DeterministicRandom(42);
  const second = new DeterministicRandom(42);
  assert.deepEqual(
    Array.from({ length: 20 }, () => first.next()),
    Array.from({ length: 20 }, () => second.next()),
  );

  const checkpoint = first.getState();
  const expected = [first.next(), first.next(), first.next()];
  first.restore(checkpoint);
  assert.deepEqual([first.next(), first.next(), first.next()], expected);
});

test("状态指纹不受对象字段插入顺序影响", () => {
  const first = { airport: "ZSHC", aircraft: { id: "B-001", phase: "airborne" } };
  const second = { aircraft: { phase: "airborne", id: "B-001" }, airport: "ZSHC" };
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(stateFingerprint(first), stateFingerprint(second));
});

test("同一仿真时刻的事件按序号和事件编号稳定排序", () => {
  const ordered = orderReplayEvents([
    { id: "event-c", sequence: 2, simulationTimeMs: 1000, type: "C", payload: null },
    { id: "event-a", sequence: 1, simulationTimeMs: 1000, type: "A", payload: null },
    { id: "event-b", sequence: 1, simulationTimeMs: 500, type: "B", payload: null },
  ]);
  assert.deepEqual(ordered.map((event) => event.id), ["event-b", "event-a", "event-c"]);
});
