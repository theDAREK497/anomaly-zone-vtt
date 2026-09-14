import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import WebSocket from 'ws';

const temporary = mkdtempSync(path.join(tmpdir(), 'eon-anomaly-tests-'));
const reservation = createServer();
await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = (reservation.address() as { port: number }).port;
await new Promise<void>(resolve => reservation.close(() => resolve()));
const processServer = spawn(process.execPath, [fileURLToPath(new URL('../dist/server.cjs', import.meta.url))], { cwd: temporary, env: { ...process.env, NODE_ENV: 'production', PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
processServer.stdout.on('data', data => { logs += String(data); });
processServer.stderr.on('data', data => { logs += String(data); });
const sockets: WebSocket[] = [];
const events: Array<{ type: string; payload: any }> = [];
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate: (event: typeof events[number]) => boolean, after: number, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const match = events.slice(after).find(predicate);
    if (match) return match.payload;
    await pause(15);
  }
  throw new Error(`Нет ожидаемого ответа сервера. Последние ответы: ${JSON.stringify(events.slice(-3))}\n${logs}`);
}
async function connect(id: string, role: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`); sockets.push(ws);
  await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  ws.send(JSON.stringify({ type: 'JOIN', payload: { id, username: id, role } }));
  return ws;
}
function fixture(id: string, difficulty = 3, timer = false) {
  const grid = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => ({ x, y, type: 'empty', anomalyType: null as string | null, radiationLevel: 0, isRevealed: false, isScannedForArtifact: false, isScannedForRadiation: false, isScannedByBolt: false })));
  grid[4][2].type = 'entrance'; grid[0][4].type = 'exit'; grid[3][2].type = 'anomaly'; grid[3][2].anomalyType = id;
  return { width: 5, height: 5, grid, entrance: { x: 2, y: 4 }, playerPos: { x: 2, y: 4 }, health: 100, maxHealth: 100, radiation: 0, maxRadiation: 100, timerSeconds: 37, seed: 'server-test', difficulty, anomalyResolutionMode: 'minigame', anomalyTimerEnabled: timer, anomalySpeed: 2, anomalyCriticalRollAutoSuccess: false, activeAnomalyEncounter: null, anomalyJournal: [], inventory: [], boltCharges: 10, detectorCharges: 3, detectorLevel: 2, geigerCharges: 3 };
}
try {
  const deadline = Date.now() + 10000;
  while (!logs.includes('SERVER RUNNING PORT') && Date.now() < deadline) await pause(25);
  assert.ok(logs.includes('SERVER RUNNING PORT'), logs);
  const gm = await connect('ТестовыйВедущий', 'gm');
  const observer = await connect('ТестовыйИгрок', 'player');
  observer.on('message', data => events.push(JSON.parse(String(data))));
  await pause(100);
  async function command(type: string, payload: any, predicate = (event: typeof events[number]) => event.type === 'SYNC_APP_STATE') {
    const after = events.length;
    gm.send(JSON.stringify({ type, payload }));
    return waitFor(predicate, after);
  }
  async function enter(id: string, difficulty = 3, timer = false) {
    await command('SYNC_APP_STATE', { map: fixture(id, difficulty, timer), gameState: 'playing', messages: [] });
    return (await command('EXECUTE_IMMEDIATE_ACTION', { action: 'UP' })).map;
  }

  for (const id of ['crystal-resonance', 'echo-loop', 'static-front', 'living-track']) {
    let state = await enter(id);
    assert.equal(state.timerSeconds, 37, 'Вход в испытание сохраняет таймер хода');
    assert.equal(state.activeAnomalyEncounter.timeRemaining, 120);
    assert.ok(state.activeAnomalyEncounter.puzzle);
    state = (await command('EXECUTE_IMMEDIATE_ACTION', { action: 'LEFT' })).map;
    assert.deepEqual(state.playerPos, { x: 2, y: 3 }, 'Нельзя уйти с поля во время испытания');
    async function input(value: object) {
      state = (await command('ANOMALY_PUZZLE', { seed: state.activeAnomalyEncounter.seed, input: { ...value, revision: state.activeAnomalyEncounter.puzzle.revision } })).map;
    }
    const p = state.activeAnomalyEncounter.puzzle;
    if (p.kind === 'wires') {
      for (let a = 0; a < p.links.length; a++) await input({ kind: 'wire', a, b: p.links[a] });
    } else if (p.kind === 'sequence') {
      const symbols = p.reverse ? [...p.sequence].reverse() : p.sequence;
      await input({ kind: 'ready' });
      for (const a of symbols) await input({ kind: 'symbol', a });
    } else {
      const queue = [p.position], parents = new Map<number, number>([[p.position, -1]]);
      for (let q = 0; q < queue.length; q++) for (const a of [queue[q] - p.size, queue[q] + p.size, queue[q] - 1, queue[q] + 1]) {
        if (a < 0 || a >= p.walls.length || p.walls[a] || parents.has(a)) continue;
        parents.set(a, queue[q]); queue.push(a);
      }
      const route: number[] = [];
      for (let n = p.goal; n !== p.position; n = parents.get(n)!) route.unshift(n);
      for (const a of route) await input({ kind: 'step', a });
    }
    assert.equal(state.activeAnomalyEncounter.result, 'completeSuccess');
    assert.equal(state.anomalyJournal.length, 1);
    const seed = state.activeAnomalyEncounter.seed;
    state = (await command('EXECUTE_IMMEDIATE_ACTION', { action: 'LEFT' })).map;
    assert.ok(state.activeAnomalyEncounter, 'Результат остаётся до ОК');
    assert.equal(state.timerSeconds, 37);
    state = (await command('ANOMALY_ACK', { seed })).map;
    assert.equal(state.activeAnomalyEncounter, null);
    assert.equal(state.timerSeconds, 37, 'ОК не сбрасывает оставшиеся секунды');
    const after = events.length;
    const tick = await waitFor(event => event.type === 'TIMER_TICK', after);
    assert.equal(tick.timerSeconds, 36, 'После ОК таймер хода продолжает отсчёт');
  }

  let state = await enter('static-front', 4, true);
  assert.equal(state.activeAnomalyEncounter.timeRemaining, 60);
  const before = events.length;
  state = (await waitFor(event => event.type === 'SYNC_APP_STATE' && event.payload.map?.activeAnomalyEncounter?.timeRemaining === 59, before)).map;
  assert.equal(state.timerSeconds, 37, 'Таймер сцены не расходует таймер хода и не зависит от скорости анимации');
  state = (await command('ANOMALY_GM_PAUSE', { paused: true })).map;
  const remaining = state.activeAnomalyEncounter.timeRemaining;
  await pause(1150);
  state = (await command('EXECUTE_IMMEDIATE_ACTION', { action: 'LEFT' })).map;
  assert.equal(state.activeAnomalyEncounter.timeRemaining, remaining);
  state.activeAnomalyEncounter.paused = false; state.activeAnomalyEncounter.timeRemaining = 1;
  await command('SYNC_APP_STATE', { map: state });
  state = (await waitFor(event => event.type === 'SYNC_APP_STATE' && !!event.payload.map?.activeAnomalyEncounter?.result, events.length)).map;
  assert.equal(state.activeAnomalyEncounter.result, 'failure');
  assert.equal(state.activeAnomalyEncounter.timeRemaining, 0);
  assert.equal(state.timerSeconds, 37);

  state = await enter('echo-loop');
  await command('ANOMALY_PUZZLE', { seed: state.activeAnomalyEncounter.seed, input: { kind: 'ready', revision: 0 } });
  for (let i = 0; i < 3; i++) {
    const p = state.activeAnomalyEncounter.puzzle;
    state = (await command('ANOMALY_PUZZLE', { seed: state.activeAnomalyEncounter.seed, input: { kind: 'symbol', a: (p.sequence[p.sequence.length - 1] + 1) % 5, revision: i + 1 } })).map;
  }
  assert.equal(state.activeAnomalyEncounter.mistakes, 3); assert.equal(state.activeAnomalyEncounter.result, 'failure');

  state = await enter('reflection-field');
  assert.equal(state.activeAnomalyEncounter.mode, 'gurps-roll');
  assert.equal(state.activeAnomalyEncounter.puzzle, undefined);
  state = (await command('ANOMALY_ACTION', { actionId: 'retreat' })).map;
  assert.equal(state.activeAnomalyEncounter.result, 'retreat', 'Отступление доступно и в режиме кубиков');
  state = await enter('spore-forest');
  assert.equal(state.activeAnomalyEncounter, null); assert.equal(state.health, 100);
  await command('EXECUTE_IMMEDIATE_ACTION', { action: 'DOWN' });
  state = (await command('EXECUTE_IMMEDIATE_ACTION', { action: 'UP' })).map;
  assert.ok(state.health < 100 && state.health >= 82); assert.equal(state.anomalyJournal.length, 1);
  assert.equal(state.grid.flat().filter((cell: any) => cell.type === 'anomaly').length, 2);
  state = await enter('gravity-fracture');
  await command('EXECUTE_IMMEDIATE_ACTION', { action: 'DOWN' });
  state = (await command('EXECUTE_IMMEDIATE_ACTION', { action: 'UP' })).map;
  assert.notDeepEqual(state.playerPos, { x: 2, y: 3 });
  assert.equal(state.grid[state.playerPos.y][state.playerPos.x].type, 'empty');
  console.log('Серверные проверки пройдены: 4 победы, отдельные таймеры, пауза, ОК, истечение времени, лимит ошибок, отступление, кубики, урон, расширение и перемещение.');
} finally {
  sockets.forEach(ws => ws.terminate());
  processServer.kill();
  await new Promise<void>(resolve => { if (processServer.exitCode !== null) resolve(); else processServer.once('exit', () => resolve()); });
  rmSync(temporary, { recursive: true, force: true });
}
