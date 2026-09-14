import { createRandomGenerator, randomInt, randomChoice } from './random';
import { ANOMALY_IDS, AnomalyPhaseId, EncounterResult, ResolutionMode } from '../data/anomalies';
import type { Puzzle } from './anomaly-gameplay';

export type CellType = 'empty' | 'entrance' | 'exit' | 'stash' | 'artifact' | 'anomaly';
export type AnomalyType = string | null;

export interface AnomalyEncounterState {
  puzzle?: Puzzle;
  timeRemaining?: number;
  difficulty?: number;
  anomalyId: string;
  seed: string;
  mode: ResolutionMode;
  phase: AnomalyPhaseId;
  anomalyStability: number;
  exposure: number;
  contamination: number;
  trainIntegrityRisk: number;
  discoveredClues: string[];
  mistakes: number;
  elapsedRounds: number;
  progress: number;
  sequence: string[];
  sequenceIndex: number;
  preparedActions: string[];
  usedSkills: string[];
  rollResults: Array<{ skillTag: string; foundryItemUuid?: string; target: number; roll: number; margin: number; success: boolean; critical: boolean }>;
  decisions: string[];
  participants: string[];
  result?: EncounterResult;
  paused?: boolean;
}

export interface AnomalyJournalEntry {
  anomalyId: string;
  seed: string;
  mode: ResolutionMode | 'field';
  participants: string[];
  usedSkills: string[];
  rollResults: AnomalyEncounterState['rollResults'];
  decisions: string[];
  mistakes: number;
  result: EncounterResult;
  consequences: string[];
  rewards: string[];
  trainChanges: string[];
  completedAt: string;
}

export interface Cell {
  x: number;
  y: number;
  type: CellType;
  anomalyType: AnomalyType;
  radiationLevel: number;
  isRevealed: boolean;
  isScannedForArtifact: boolean;
  isScannedForRadiation: boolean;
  isScannedByBolt: boolean;
  hasExpanded?: boolean;
  anomalySeed?: string;
  anomalyResolved?: boolean;
  fieldWarned?: boolean;
  fieldVisits?: number;
  isApproximateLocation?: boolean;
  isOutOfBounds?: boolean;
}

export interface GameMap {
  difficulty?: number;
  width: number;
  height: number;
  grid: Cell[][];
  entrance: {x: number, y: number};
  maxHealth: number;
  health: number;
  maxRadiation: number;
  radiation: number;
  geigerCharges: number;
  detectorCharges: number;
  detectorLevel: number;
  timerSeconds: number;
  boltCharges: number;
  playerPos?: {x: number, y: number};
  activeDirectionHighlight?: string | null;
  inventory?: string[];
  seed: string;
  anomalyResolutionMode: ResolutionMode;
  anomalyTimerEnabled: boolean;
  anomalySpeed: number;
  anomalyCriticalRollAutoSuccess: boolean;
  silentZoneInterfaceComms: boolean;
  activeAnomalyEncounter?: AnomalyEncounterState | null;
  anomalyJournal?: AnomalyJournalEntry[];
}

export interface GenerationParams {
  width: number;
  height: number;
  artifacts: number;
  stashes: number;
  exits: number;
  difficulty: number; // 1 to 10
  seed: string;
  salt: string;
  allowedAnomalies: AnomalyType[];
  radiationPercentage: number;
  maxHealth: number;
  maxRadiation: number;
  geigerCharges: number;
  detectorCharges: number;
  detectorLevel: number;
  boltCharges: number;
  anomalyResolutionMode: ResolutionMode;
  anomalyTimerEnabled: boolean;
  anomalySpeed: number;
  anomalyCriticalRollAutoSuccess: boolean;
  silentZoneInterfaceComms: boolean;
}

export function generateMap(params: GenerationParams): GameMap {
  const rng = createRandomGenerator(params.seed + params.salt);
  const grid: Cell[][] = [];

  for (let y = 0; y < params.height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < params.width; x++) {
      row.push({
        x, y,
        type: 'empty',
        anomalyType: null,
        radiationLevel: 0,
        isRevealed: false,
        isScannedForArtifact: false,
        isScannedForRadiation: false,
        isScannedByBolt: false,
      });
    }
    grid.push(row);
  }

  // 1. Entrance (South)
  const entranceX = randomInt(rng, 0, params.width - 1);
  const entranceY = params.height - 1;
  grid[entranceY][entranceX].type = 'entrance';
  grid[entranceY][entranceX].isRevealed = true;

  // 2. Exits
  const exits: {x: number, y: number}[] = [];
  for (let i = 0; i < params.exits; i++) {
    let ex, ey;
    const side = randomInt(rng, 0, 2); // 0: North, 1: East, 2: West
    if (side === 0) {
      ex = randomInt(rng, 0, params.width - 1);
      ey = 0;
    } else if (side === 1) {
      ex = params.width - 1;
      ey = randomInt(rng, 0, params.height - 2);
    } else {
      ex = 0;
      ey = randomInt(rng, 0, params.height - 2);
    }
    grid[ey][ex].type = 'exit';
    exits.push({x: ex, y: ey});
  }

  if (exits.length === 0) {
    const fallbackExitX = randomInt(rng, 0, params.width - 1);
    grid[0][fallbackExitX].type = 'exit';
    exits.push({x: fallbackExitX, y: 0});
  }

  // 3. Safe Path
  const safePath = new Set<string>();
  const targetExit = randomChoice(rng, exits);
  let cx = entranceX;
  let cy = entranceY;
  safePath.add(`${cx},${cy}`);

  while (cx !== targetExit.x || cy !== targetExit.y) {
    const moves = [];
    if (cx < targetExit.x) moves.push({dx: 1, dy: 0});
    if (cx > targetExit.x) moves.push({dx: -1, dy: 0});
    if (cy < targetExit.y) moves.push({dx: 0, dy: 1});
    if (cy > targetExit.y) moves.push({dx: 0, dy: -1});

    if (moves.length > 0) {
      const move = randomChoice(rng, moves);
      cx += move.dx;
      cy += move.dy;
      safePath.add(`${cx},${cy}`);
    } else {
      break;
    }
  }

  // 4. Stashes & Artifacts
  const placeRandomly = (type: CellType, count: number) => {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < 1000) {
      const rx = randomInt(rng, 0, params.width - 1);
      const ry = randomInt(rng, 0, params.height - 1);
      if (grid[ry][rx].type === 'empty') {
        grid[ry][rx].type = type;
        placed++;
      }
      attempts++;
    }
  };

  placeRandomly('stash', params.stashes);
  placeRandomly('artifact', params.artifacts);

  // 5. Anomalies
  const anomalyTypes: AnomalyType[] = params.allowedAnomalies && params.allowedAnomalies.length > 0
    ? params.allowedAnomalies
    : ANOMALY_IDS;
  const totalCells = params.width * params.height;
  const anomalyCount = Math.floor(totalCells * (params.difficulty * 0.03));

  let anomaliesPlaced = 0;
  let attempts = 0;
  while (anomaliesPlaced < anomalyCount && attempts < 2000) {
    const rx = randomInt(rng, 0, params.width - 1);
    const ry = randomInt(rng, 0, params.height - 1);

    if (!safePath.has(`${rx},${ry}`) && grid[ry][rx].type === 'empty') {
      grid[ry][rx].type = 'anomaly';
      grid[ry][rx].anomalyType = randomChoice(rng, anomalyTypes);
      grid[ry][rx].anomalySeed = `${params.seed}:${params.salt}:${rx}:${ry}:${grid[ry][rx].anomalyType}`;
      anomaliesPlaced++;
    }
    attempts++;
  }

  // 6. Radiation
  const maxRadiationZones = Math.floor(totalCells * 0.15);
  const radiationZones = Math.floor(maxRadiationZones * (params.radiationPercentage / 100));
  for (let i = 0; i < radiationZones; i++) {
    const rx = randomInt(rng, 0, params.width - 1);
    const ry = randomInt(rng, 0, params.height - 1);
    const strength = randomInt(rng, 1, 3);

    for (let dy = -strength; dy <= strength; dy++) {
      for (let dx = -strength; dx <= strength; dx++) {
        const nx = rx + dx;
        const ny = ry + dy;
        if (nx >= 0 && nx < params.width && ny >= 0 && ny < params.height) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const rad = Math.max(0, strength - dist + 1);
          if (rad > grid[ny][nx].radiationLevel) {
            grid[ny][nx].radiationLevel = rad;
          }
        }
      }
    }
  }

  // 7. Clear Safe Path from Radiation
  safePath.forEach(pos => {
    const [sx, sy] = pos.split(',').map(Number);
    grid[sy][sx].radiationLevel = 0;
  });

  return {
    width: params.width,
    height: params.height,
    grid,
    entrance: {x: entranceX, y: entranceY},
    maxHealth: params.maxHealth,
    health: params.maxHealth,
    maxRadiation: params.maxRadiation,
    radiation: 0,
    geigerCharges: params.geigerCharges,
    detectorCharges: params.detectorCharges,
    detectorLevel: params.detectorLevel,
    timerSeconds: 60,
    difficulty: params.difficulty,
    boltCharges: params.boltCharges,
    inventory: []
    ,seed: params.seed + params.salt
    ,anomalyResolutionMode: params.anomalyResolutionMode
    ,anomalyTimerEnabled: params.anomalyTimerEnabled
    ,anomalySpeed: params.anomalySpeed
    ,anomalyCriticalRollAutoSuccess: params.anomalyCriticalRollAutoSuccess
    ,silentZoneInterfaceComms: params.silentZoneInterfaceComms
    ,activeAnomalyEncounter: null
    ,anomalyJournal: []
  };
}
