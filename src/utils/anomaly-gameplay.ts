import { createRandomGenerator, randomInt } from './random';

export type EncounterKind = 'field' | 'puzzle' | 'rolls';
export const FIELD_EFFECTS: Record<string, Array<'damage' | 'teleport' | 'spread'>> = {
  'spore-forest': ['damage', 'spread'], 'druse-growth': ['spread'],
  'gravity-fracture': ['damage', 'teleport'], 'spatial-seam': ['teleport'],
  'thermal-pocket': ['damage'], 'rust-wave': ['damage', 'spread'],
  'eon-storm': ['damage', 'teleport', 'spread']
};
export function encounterKind(id: string): EncounterKind {
  if (FIELD_EFFECTS[id]) return 'field';
  return ['crystal-resonance', 'echo-loop', 'static-front', 'living-track'].includes(id) ? 'puzzle' : 'rolls';
}
export const KIND_LABELS: Record<EncounterKind, string> = { field: 'Эффект на поле', puzzle: 'Мини-игра', rolls: 'Проверки кубиками' };
export const RESULT_LABELS = { completeSuccess: 'Полный успех', successWithCost: 'Успех с ценой', partialFailure: 'Частичная неудача', failure: 'Неудача', criticalFailure: 'Критическая неудача', retreat: 'Отступление' };
export const SKILL_LABELS: Record<string, string> = {
  observation: 'Наблюдательность', traps: 'Ловушки', survival: 'Выживание', navigation: 'Навигация',
  biology: 'Биология', chemistry: 'Химия', physics: 'Физика', 'electronics-sensors': 'Электроника: датчики',
  engineering: 'Инженерное дело', mechanic: 'Механика', 'first-aid': 'Первая помощь',
  'driving-locomotive': 'Управление локомотивом', gunner: 'Наводчик', research: 'Исследование', manual: 'Навык, выбранный ведущим'
};
export const SYMBOLS = ['●', '▲', '■', '◆', '★', '☾', '✚', '⬡'];
export function shuffle<T>(values: T[], rng: () => number): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i); [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export interface Puzzle {
  kind: 'wires' | 'maze' | 'sequence';
  stage: 'study' | 'solve';
  revision: number;
  limit: number;
  left: number[];
  right: number[];
  links: number[];
  connected: number[];
  sequence: number[];
  reverse: boolean;
  cursor: number;
  size: number;
  walls: number[];
  position: number;
  goal: number;
  visited: number[];
}
export function encounterSeconds(difficulty: number): number { return difficulty <= 3 ? 120 : 60; }
export function rollThreeDice(seed: string, index: number): number[] {
  const rng = createRandomGenerator(`${seed}:dice:${index}`);
  return Array.from({ length: 3 }, () => randomInt(rng, 1, 6));
}
export function tickAnomalyClock(encounter: { timeRemaining?: number; result?: string; paused?: boolean }, enabled: boolean): 'paused' | 'tick' | 'expired' {
  if (encounter.result || encounter.paused || !enabled) return 'paused';
  encounter.timeRemaining = Math.max(0, (encounter.timeRemaining ?? 60) - 1);
  return encounter.timeRemaining === 0 ? 'expired' : 'tick';
}
export function createPuzzle(id: string, seed: string, difficulty: number): Puzzle {
  const rng = createRandomGenerator(`${seed}:puzzle`);
  const p: Puzzle = { kind: 'sequence', stage: 'study', revision: 0, limit: 3, left: [], right: [], links: [], connected: [], sequence: [], reverse: id === 'echo-loop', cursor: 0, size: 0, walls: [], position: 0, goal: 0, visited: [] };
  if (id === 'static-front') {
    p.kind = 'wires'; p.stage = 'solve';
    const count = difficulty <= 3 ? 4 : 6;
    const symbols = shuffle(SYMBOLS.map((_, i) => i), rng).slice(0, count);
    p.left = shuffle(symbols, rng); p.right = shuffle(symbols, rng);
    p.links = shuffle(symbols.map((_, i) => i), rng);
  } else if (id === 'living-track') {
    p.kind = 'maze'; p.stage = 'solve'; p.size = difficulty <= 3 ? 7 : 9;
    p.walls = Array(p.size * p.size).fill(1);
    const corners = [p.size + 1, p.size * 2 - 2, p.size * (p.size - 2) + 1, p.size * (p.size - 2) + p.size - 2];
    const startCorner = randomInt(rng, 0, 3);
    p.position = corners[startCorner]; p.goal = corners[3 - startCorner];
    p.walls[p.position] = 0; p.visited = [p.position];
    const stack = [p.position];
    while (stack.length) {
      const current = stack[stack.length - 1], x = current % p.size, y = Math.floor(current / p.size);
      const options = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]], rng).filter(([dx, dy]) => x + dx > 0 && x + dx < p.size - 1 && y + dy > 0 && y + dy < p.size - 1 && p.walls[(y + dy) * p.size + x + dx]);
      if (!options.length) { stack.pop(); continue; }
      const [dx, dy] = options[0], next = (y + dy) * p.size + x + dx;
      p.walls[(y + dy / 2) * p.size + x + dx / 2] = 0; p.walls[next] = 0; stack.push(next);
    }
  } else {
    p.sequence = Array.from({ length: difficulty <= 3 ? 5 : 7 }, () => randomInt(rng, 0, 4));
  }
  return p;
}
export type PuzzleInput = { revision: number; kind: 'ready' | 'wire' | 'step' | 'symbol'; a?: number; b?: number };
export function applyPuzzleInput(p: Puzzle, input: PuzzleInput): 'ignored' | 'correct' | 'mistake' | 'complete' {
  if (!input || input.revision !== p.revision) return 'ignored';
  const a = input.a, b = input.b;
  let result: 'ignored' | 'correct' | 'mistake' | 'complete' = 'ignored';
  if (p.kind === 'sequence' && p.stage === 'study' && input.kind === 'ready') { p.stage = 'solve'; result = 'correct'; }
  else if (p.kind === 'sequence' && p.stage === 'solve' && input.kind === 'symbol' && Number.isInteger(a) && a! >= 0 && a! < 5) {
    const expected = p.sequence[p.reverse ? p.sequence.length - 1 - p.cursor : p.cursor];
    if (a === expected) { p.cursor++; result = p.cursor === p.sequence.length ? 'complete' : 'correct'; }
    else { p.cursor = 0; result = 'mistake'; }
  } else if (p.kind === 'wires' && input.kind === 'wire' && Number.isInteger(a) && Number.isInteger(b) && a! >= 0 && a! < p.left.length && b! >= 0 && b! < p.right.length && !p.connected.includes(a!)) {
    if (p.links[a!] === b) { p.connected.push(a!); result = p.connected.length === p.left.length ? 'complete' : 'correct'; }
    else result = 'mistake';
  } else if (p.kind === 'maze' && input.kind === 'step' && Number.isInteger(a) && a! >= 0 && a! < p.walls.length) {
    const distance = Math.abs(a! % p.size - p.position % p.size) + Math.abs(Math.floor(a! / p.size) - Math.floor(p.position / p.size));
    if (distance !== 1) return 'ignored';
    if (p.walls[a!]) result = 'mistake';
    else { p.position = a!; if (!p.visited.includes(a!)) p.visited.push(a!); result = p.position === p.goal ? 'complete' : 'correct'; }
  }
  if (result !== 'ignored') p.revision++;
  return result;
}

/** Field randomness has its own stream: re-entering changes the event, replaying the same visit does not. */
export function fieldOutcome(id: string, seed: string, visit: number, safeCells: number[], expandableCells: number[]) {
  const rng = createRandomGenerator(`${seed}:field:${visit}`), effects = FIELD_EFFECTS[id] || [];
  const damage = effects.includes('damage') ? randomInt(rng, 6, 18) : 0;
  const destination = effects.includes('teleport') && safeCells.length ? safeCells[randomInt(rng, 0, safeCells.length - 1)] : null;
  const candidates = expandableCells.filter(index => index !== destination);
  return {
    damage, destination,
    expansion: effects.includes('spread') && candidates.length ? candidates[randomInt(rng, 0, candidates.length - 1)] : null
  };
}
