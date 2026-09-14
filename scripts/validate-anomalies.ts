import assert from "node:assert/strict";
import { ANOMALY_DEFINITIONS, validateAnomalyDefinitions } from "../src/data/anomalies";
import { generateMap, GenerationParams } from "../src/utils/generator";
import { createPuzzle, applyPuzzleInput, encounterKind, encounterSeconds, tickAnomalyClock, fieldOutcome, rollThreeDice } from '../src/utils/anomaly-gameplay';

const errors = validateAnomalyDefinitions();
assert.deepEqual(errors, [], `Ошибки каталога аномалий:\n${errors.join("\n")}`);
assert.equal(ANOMALY_DEFINITIONS.length, 14, "Каталог должен содержать 14 аномалий ЭОН");

const fullIds = ANOMALY_DEFINITIONS.filter(item => item.encounterType === 'puzzle').map(item => item.id).sort();
assert.deepEqual(fullIds, ['crystal-resonance', 'echo-loop', 'living-track', 'static-front']);
assert.equal(ANOMALY_DEFINITIONS.filter(item => item.encounterType === 'field').length, 7);
assert.equal(ANOMALY_DEFINITIONS.filter(item => item.encounterType === 'rolls').length, 3);
for (const item of ANOMALY_DEFINITIONS) assert.equal(item.encounterType, encounterKind(item.id));

const params: GenerationParams = {
  width: 10, height: 10, artifacts: 2, stashes: 2, exits: 1, difficulty: 5,
  seed: "EON-REPRO", salt: "TRAIN", allowedAnomalies: ANOMALY_DEFINITIONS.map(item => item.id),
  radiationPercentage: 10, maxHealth: 100, maxRadiation: 100, geigerCharges: 3,
  detectorCharges: 3, detectorLevel: 2, boltCharges: 10, anomalyResolutionMode: "hybrid",
  anomalyTimerEnabled: false, anomalySpeed: 1, anomalyCriticalRollAutoSuccess: false,
  silentZoneInterfaceComms: true
};

assert.deepEqual(generateMap(params), generateMap(params), "Одинаковый seed обязан воспроизводить карту и узлы");
assert.notDeepEqual(generateMap(params), generateMap({ ...params, seed: 'OTHER' }));

for (const id of fullIds) {
  const variants = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const p = createPuzzle(id, `test-${seed}`, 4);
    assert.deepEqual(p, createPuzzle(id, `test-${seed}`, 4));
    variants.add(JSON.stringify(p));
    if (p.kind === 'wires') {
      assert.equal(new Set(p.links).size, p.left.length);
      for (let a = 0; a < p.left.length; a++) {
        const revision = p.revision;
        const status = applyPuzzleInput(p, { kind: 'wire', a, b: p.links[a], revision });
        assert.equal(status, a === p.left.length - 1 ? 'complete' : 'correct');
        assert.equal(applyPuzzleInput(p, { kind: 'wire', a, b: p.links[a], revision }), 'ignored', 'Повтор пакета не продвигает игру');
      }
    } else if (p.kind === 'sequence') {
      const expected = p.reverse ? [...p.sequence].reverse() : [...p.sequence];
      assert.equal(applyPuzzleInput(p, { kind: 'symbol', a: expected[0], revision: p.revision }), 'ignored');
      applyPuzzleInput(p, { kind: 'ready', revision: p.revision });
      assert.equal(applyPuzzleInput(p, { kind: 'symbol', a: (expected[0] + 1) % 5, revision: p.revision }), 'mistake');
      assert.equal(p.cursor, 0);
      for (let i = 0; i < expected.length; i++) assert.equal(applyPuzzleInput(p, { kind: 'symbol', a: expected[i], revision: p.revision }), i === expected.length - 1 ? 'complete' : 'correct');
    } else {
      assert.equal(applyPuzzleInput(p, { kind: 'step', a: p.goal, revision: p.revision }), 'ignored', 'Нельзя прыгнуть к выходу');
      const queue = [p.position], parent = new Map<number, number>([[p.position, -1]]);
      for (let q = 0; q < queue.length; q++) {
        const current = queue[q];
        for (const next of [current - p.size, current + p.size, current - 1, current + 1]) {
          if (next < 0 || next >= p.walls.length || p.walls[next] || parent.has(next)) continue;
          if (Math.abs(current % p.size - next % p.size) + Math.abs(Math.floor(current / p.size) - Math.floor(next / p.size)) !== 1) continue;
          parent.set(next, current); queue.push(next);
        }
      }
      assert.ok(parent.has(p.goal), 'Каждый лабиринт имеет решение');
      const route: number[] = [];
      for (let n = p.goal; n !== p.position; n = parent.get(n)!) route.unshift(n);
      for (const a of route) assert.equal(applyPuzzleInput(p, { kind: 'step', a, revision: p.revision }), a === p.goal ? 'complete' : 'correct');
    }
  }
  assert.ok(variants.size >= 90, `${id}: разные seed должны давать разные задания (${variants.size}/100)`);
  console.log(`${id}: ${variants.size}/100 различных и решаемых заданий`);
}

const outcomes = new Set<string>();
const damages = new Set<number>();
for (let i = 0; i < 100; i++) {
  const result = fieldOutcome('eon-storm', `seed-${i}`, i, Array.from({ length: 20 }, (_, n) => n), [1, 2, 3, 4]);
  assert.deepEqual(result, fieldOutcome('eon-storm', `seed-${i}`, i, Array.from({ length: 20 }, (_, n) => n), [1, 2, 3, 4]));
  assert.notEqual(result.destination, result.expansion);
  assert.ok(result.damage >= 6 && result.damage <= 18);
  outcomes.add(JSON.stringify(result)); damages.add(result.damage);
}
assert.ok(outcomes.size >= 90); assert.ok(damages.size >= 10);
const faces = Array(6).fill(0), sums = new Set<number>();
for (let i = 0; i < 2000; i++) {
  const dice = rollThreeDice('dice-test', i);
  assert.deepEqual(dice, rollThreeDice('dice-test', i));
  dice.forEach(d => { assert.ok(d >= 1 && d <= 6); faces[d - 1]++; });
  sums.add(dice.reduce((a, b) => a + b, 0));
}
assert.equal(sums.size, 16);
for (const count of faces) assert.ok(count > 800 && count < 1200, `Неравномерные кубики: ${faces}`);
for (const difficulty of [1, 2, 3, 4, 5, 10]) {
  const duration = difficulty <= 3 ? 120 : 60;
  assert.equal(encounterSeconds(difficulty), duration);
  const encounter = { timeRemaining: duration, paused: true, result: undefined as string | undefined };
  assert.equal(tickAnomalyClock(encounter, true), 'paused'); assert.equal(encounter.timeRemaining, duration);
  encounter.paused = false;
  assert.equal(tickAnomalyClock(encounter, false), 'paused');
  for (let i = 1; i < duration; i++) assert.equal(tickAnomalyClock(encounter, true), 'tick');
  assert.equal(tickAnomalyClock(encounter, true), 'expired'); assert.equal(encounter.timeRemaining, 0);
  encounter.result = 'failure'; assert.equal(tickAnomalyClock(encounter, true), 'paused');
}
console.log(`Каталог: 14 аномалий (7 полевых, 4 мини-игры, 3 на кубиках). Проверены 400 заданий, 100 полевых событий, 6000 кубиков и оба ограничения времени.`);
