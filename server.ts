import express from "express";
import path from "path";
import http from "http";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { ANOMALY_BY_ID, AnomalyAction, EncounterResult } from "./src/data/anomalies";
import { createRandomGenerator } from './src/utils/random';
import { encounterKind, createPuzzle, applyPuzzleInput, encounterSeconds, tickAnomalyClock, fieldOutcome, rollThreeDice, RESULT_LABELS } from './src/utils/anomaly-gameplay';

interface Player {
  id: string;
  username: string;
  role: "player" | "gm";
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = parseInt(process.env.PORT || "3000", 10);

// In-Memory Database State
let gameState: string = "setup";
let map: any = null;
let messages: any[] = [];
let stashLoot: any[] = [
  { id: "1", name: "Аптечка", weight: 10 },
  { id: "2", name: "Патроны", weight: 20 },
  { id: "3", name: "Антирад", weight: 15 },
  { id: "4", name: "Тушенка", weight: 30 },
  { id: "5", name: "Пусто", weight: 25 },
];
let artifactLoot: any[] = [
  { id: "1", name: "Капля", weight: 20 },
  { id: "2", name: "Кровь камня", weight: 15 },
  { id: "3", name: "Слизь", weight: 25 },
  { id: "4", name: "Колючка", weight: 10 },
  { id: "5", name: "Медуза", weight: 30 },
];

// Active Player voting pool tracking
let activeVotes: Record<string, { username: string; action: string }> = {};

// Connected Sockets
const clients = new Map<WebSocket, Player>();

function broadcast(type: string, payload: any, excludeSocket?: WebSocket) {
  const data = JSON.stringify({ type, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeSocket) {
      client.send(data);
    }
  });
}

function getActiveGMId(): string | null {
  for (const [ws, player] of clients.entries()) {
    if (player.role === "gm" && ws.readyState === WebSocket.OPEN) {
      return player.id;
    }
  }
  return null;
}

function getActivePlayersCount(): number {
  return Array.from(clients.values()).filter(p => p.role === "player").length;
}

function appendSystemMessage(text: string, type: string = "info") {
  const msgObj = {
    id: Math.random().toString(36).substring(2, 9),
    sender: "СИСТЕМА",
    text,
    type,
    timestamp: new Date().toLocaleTimeString(),
  };
  messages.push(msgObj);
}

function getWeightedLoot(lootTable: any[]) {
  if (lootTable.length === 0) return "Ничего";
  const totalWeight = lootTable.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of lootTable) {
    random -= item.weight;
    if (random <= 0) return item.name;
  }
  return lootTable[lootTable.length - 1].name;
}

// Check survival parameters (rad limit or health zero)
function checkGameLossSurvival() {
  if (!map) return;
  if (map.health <= 0) {
    appendSystemMessage("💀 ГРУППА ПОГИБЛА! Очки здоровья полностью иссякли в аномалии!", "danger");
    gameState = "ended";
  }
  if (map.radiation >= map.maxRadiation) {
    appendSystemMessage("💀 ГРУППА ПОГИБЛА! Набор критической радиации привел к лучевой смерти всего отряда!", "danger");
    gameState = "ended";
  }
}

// Handle artifact scans based on level
function resolveArtifactDetectionByLevel(px: number, py: number) {
  let artifacts: { x: number; y: number; dist: number }[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.grid[y][x].type === "artifact") {
        const dist = Math.max(Math.abs(x - px), Math.abs(y - py));
        if (dist <= 3) {
          artifacts.push({ x, y, dist });
        }
      }
    }
  }

  // Sort closest
  artifacts.sort((a, b) => a.dist - b.dist);

  // Scan radius 3 cells
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
        map.grid[ny][nx].isScannedForArtifact = true;
      }
    }
  }

  if (artifacts.length === 0) {
    appendSystemMessage("🔮 Анализатор артефактов молчит. В радиусе 3х клеток пусто.", "info");
    map.activeDirectionHighlight = null;
    return;
  }

  const closest = artifacts[0];
  const level = map.detectorLevel;

  if (level === 1) {
    appendSystemMessage("🔮 УРОВЕНЬ 1 (ПРОСТОЙ): Детектор мерно пищит. Поблизости есть артефакт!", "loot");
    map.activeDirectionHighlight = null;
  } else if (level === 2) {
    let dirY = "";
    let dirX = "";
    if (closest.y < py) dirY = "СЕВЕР";
    else if (closest.y > py) dirY = "ЮГ";

    if (closest.x < px) dirX = "ЗАПАД";
    else if (closest.x > px) dirX = "ВОСТОК";

    const directionText = [dirY, dirX].filter(Boolean).join("-");
    appendSystemMessage(`🔮 УРОВЕНЬ 2 (НАПРАВЛЕНИЕ): Радар фиксирует излучение в направлении: ${directionText}!`, "loot");

    let code = "";
    if (closest.y < py) code += "N";
    if (closest.y > py) code += "S";
    if (closest.x < px) code += "W";
    if (closest.x > px) code += "E";
    map.activeDirectionHighlight = code;
  } else if (level === 3) {
    appendSystemMessage("🔮 УРОВЕНЬ 3 (ОБЛАСТЬ): Прибор локализовал артефакт в приблизительном квадрате 3x3!", "loot");
    map.activeDirectionHighlight = null;
    
    // Highlight a 3x3 centered around the artifact
    const ax = closest.x;
    const ay = closest.y;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const hx = ax + dx;
        const hy = ay + dy;
        if (hx >= 0 && hx < map.width && hy >= 0 && hy < map.height) {
          map.grid[hy][hx].isScannedForArtifact = true;
          map.grid[hy][hx].isApproximateLocation = true;
        }
      }
    }
  } else if (level === 4) {
    appendSystemMessage("🔮 УРОВЕНЬ 4 (ТОЧНЫЙ): Координаты артефакта полностью рассекречены!", "loot");
    map.activeDirectionHighlight = null;
    map.grid[closest.y][closest.x].isRevealed = true;
    map.grid[closest.y][closest.x].isScannedForArtifact = true;
  }
}

// Process Cell entry
function resolveCellEnter(nx: number, ny: number) {
  map.grid[ny][nx].isRevealed = true;
  const cell = map.grid[ny][nx];

  // 1. Radiation Check
  if (cell.radiationLevel > 0) {
    const dose = cell.radiationLevel * 8;
    map.radiation = Math.min(map.maxRadiation, map.radiation + dose);
    appendSystemMessage(`☣️ Внимание! Доза облучения: +${dose} рад (Тек: ${map.radiation}/${map.maxRadiation})!`, "warning");

    const radDmg = cell.radiationLevel * 6;
    map.health = Math.max(0, map.health - radDmg);
    appendSystemMessage(`💔 Здоровье отряда снизилось на ${radDmg} ОЗ из-за фонирующих очагов радиации.`, "danger");
  }

  // 2. Safe / exit check
  if (cell.type === "exit") {
    appendSystemMessage("🏆 Поздравляем! Группа успешно преодолела кордоны и покинула аномальную зону!", "success");
    gameState = "ended";
    return;
  }

  // 3. Stash check
  if (cell.type === "stash") {
    const loot = getWeightedLoot(stashLoot);
    appendSystemMessage(`📦 Найден заброшенный схрон! Получено: "${loot}"`, "loot");
    if (!map.inventory) map.inventory = [];
    if (loot && loot !== "Ничего" && loot !== "Пусто") {
      map.inventory.push(loot);
    }
    map.grid[ny][nx].type = "empty";
  }

  // 4. Artifact entry
  if (cell.type === "artifact") {
    const loot = getWeightedLoot(artifactLoot);
    appendSystemMessage(`💎 УРА! Вы подобрали ценный артефакт: "${loot}"`, "loot");
    if (!map.inventory) map.inventory = [];
    if (loot && loot !== "Ничего" && loot !== "Пусто") {
      map.inventory.push(loot);
    }
    map.grid[ny][nx].type = "empty";
  }

  // 5. Anomaly triggering
  if (cell.type === "anomaly") {
    if (!cell.anomalyResolved) startAnomalyEncounter(cell);
  }
}

function getAnomalyRussianName(type: string | null): string {
  return type ? ANOMALY_BY_ID[type]?.name || type : "Неизвестная аномалия";
}

function seededNumber(seed: string, index = 0): number {
  return createRandomGenerator(`${seed}:${index}`)();
}

function encounterSequence(anomalyId: string, seed: string): string[] {
  const pools: Record<string, string[]> = {
    "crystal-resonance": ["tone-low", "tone-mid", "tone-high"],
    "echo-loop": ["echo-a", "echo-b", "echo-c"]
  };
  const pool = pools[anomalyId];
  if (!pool) return [];
  const original = Array.from({ length: 3 }, (_, index) => pool[Math.floor(seededNumber(seed, index) * pool.length)]);
  return anomalyId === "echo-loop" ? original.reverse() : original;
}

function startAnomalyEncounter(cell: any) {
  const definition = ANOMALY_BY_ID[cell.anomalyType];
  if (!definition || map.activeAnomalyEncounter) return;
  const seed = cell.anomalySeed || `${map.seed || "EON"}:${cell.x}:${cell.y}:${cell.anomalyType}`;
  const kind = encounterKind(definition.id);
  if (kind === 'field') {
    if (!cell.fieldWarned) {
      cell.fieldWarned = true;
      appendSystemMessage(`⚠️ ${definition.name}: ${definition.detection.passiveSignal} Первый контакт безопасен. Повторный вход вызовет эффект аномалии: обойдите очаг или исследуйте его болтом.`, 'warning');
      return;
    }
    const visit = cell.fieldVisits || 0;
    const safe: number[] = [], expandable: number[] = [];
    for (const row of map.grid) for (const candidate of row) {
      if (candidate.type !== 'empty' || candidate.radiationLevel > 0) continue;
      const index = candidate.y * map.width + candidate.x;
      safe.push(index);
      if (Math.abs(candidate.x - cell.x) + Math.abs(candidate.y - cell.y) === 1) expandable.push(index);
    }
    const effect = fieldOutcome(definition.id, seed, visit, safe, expandable);
    cell.fieldVisits = visit + 1;
    const damage = Math.min(effect.damage, Math.max(0, map.health - 1));
    map.health -= damage;
    const consequences: string[] = [];
    if (damage) consequences.push(`Здоровье −${damage}`);
    if (effect.expansion !== null) {
      const x = effect.expansion % map.width, y = Math.floor(effect.expansion / map.width);
      Object.assign(map.grid[y][x], { type: 'anomaly', anomalyType: definition.id, anomalySeed: `${seed}:growth:${visit}`, isRevealed: true, fieldWarned: false });
      consequences.push(`Очаг расширился в клетку ${x}, ${y}; новый край даёт предупреждение перед воздействием`);
    }
    if (effect.destination !== null) {
      const x = effect.destination % map.width, y = Math.floor(effect.destination / map.width);
      map.playerPos = { x, y }; map.grid[y][x].isRevealed = true;
      consequences.push(`Отряд перемещён в безопасную клетку ${x}, ${y}`);
    }
    map.anomalyJournal ||= [];
    map.anomalyJournal.push({ anomalyId: definition.id, seed: `${seed}:field:${visit}`, mode: 'field', participants: [...new Set([...clients.values()].map(p => p.username))], usedSkills: [], rollResults: [], decisions: ['Повторный вход после предупреждения'], mistakes: 0, result: 'successWithCost', consequences, rewards: [], trainChanges: [], completedAt: new Date().toISOString() });
    appendSystemMessage(`◆ ${definition.name}: ${consequences.join('; ') || 'Очаг затих, доступных клеток для воздействия нет'}.`, 'warning');
    return;
  }
  const difficulty = map.difficulty ?? definition.dangerTier;
  const mode = kind === 'rolls' ? 'gurps-roll' : map.anomalyResolutionMode || 'hybrid';
  map.activeAnomalyEncounter = {
    anomalyId: definition.id, seed, mode, phase: "warning", difficulty,
    timeRemaining: encounterSeconds(difficulty),
    puzzle: mode !== 'gurps-roll' ? createPuzzle(definition.id, seed, difficulty) : undefined,
    anomalyStability: 70, exposure: 0, contamination: 0, trainIntegrityRisk: 0,
    discoveredClues: [definition.detection.passiveSignal], mistakes: 0, elapsedRounds: 0, progress: 0,
    sequence: encounterSequence(definition.id, seed), sequenceIndex: 0, preparedActions: [], usedSkills: [], rollResults: [],
    decisions: [], participants: [], paused: false
  };
  appendSystemMessage(`⚠️ Обнаружена аномалия «${definition.name}». Наблюдаемый сигнал: ${definition.detection.passiveSignal}`, "warning");
}

function updateEncounterPhase(encounter: any, definition: any) {
  const matches = (phaseId: string) => {
    const transition = definition.phases.find((phase: any) => phase.id === phaseId)?.transition || {};
    if (transition.onResult) return encounter.result && transition.onResult.includes(encounter.result);
    const checks: boolean[] = [];
    if (transition.minRounds !== undefined) checks.push(encounter.elapsedRounds >= transition.minRounds);
    if (transition.minMistakes !== undefined) checks.push(encounter.mistakes >= transition.minMistakes);
    if (transition.maxStability !== undefined) checks.push(encounter.anomalyStability <= transition.maxStability);
    return checks.length > 0 && checks.some(Boolean);
  };
  const phaseOrder = ["dormant", "warning", "active", "collapse", "aftermath"];
  let nextPhase = "dormant";
  if (matches("aftermath")) nextPhase = "aftermath";
  else if (matches("collapse")) nextPhase = "collapse";
  else if (matches("active")) nextPhase = "active";
  else if (matches("warning")) nextPhase = "warning";
  if (phaseOrder.indexOf(nextPhase) >= phaseOrder.indexOf(encounter.phase)) encounter.phase = nextPhase;
}

function finishEncounter(result: EncounterResult) {
  const encounter = map.activeAnomalyEncounter;
  const definition = encounter && ANOMALY_BY_ID[encounter.anomalyId];
  if (!encounter || !definition || encounter.result) return;
  encounter.result = result;
  encounter.phase = "aftermath";
  const consequencePool = result === "completeSuccess" || result === "retreat" ? [] : definition.characterConsequences[result] || [];
  const consequence = consequencePool.length ? consequencePool[Math.floor(seededNumber(encounter.seed, 90 + encounter.mistakes) * consequencePool.length)] : null;
  const rewards = result === "completeSuccess" || result === "successWithCost"
    ? [definition.rewards[Math.floor(seededNumber(encounter.seed, 120) * definition.rewards.length)]] : [];
  const trainChanges = encounter.trainIntegrityRisk >= 60 ? [definition.trainConsequences.possiblePermanentFaults[0]]
    : encounter.trainIntegrityRisk >= 25 ? [definition.trainConsequences.possibleTemporaryFaults[0]] : [];
  const hpLoss = result === "criticalFailure" ? 20 : result === "failure" ? 12 : result === "partialFailure" ? 6 : result === "successWithCost" ? 3 : 0;
  map.health = Math.max(0, map.health - hpLoss);
  if (rewards.length) {
    if (!map.inventory) map.inventory = [];
    map.inventory.push(...rewards);
  }
  const pos = map.playerPos;
  const cell = pos && map.grid[pos.y]?.[pos.x];
  if (cell?.anomalyType === encounter.anomalyId) cell.anomalyResolved = result !== "retreat";
  if (result === "retreat") map.playerPos = { ...map.entrance };
  if (!map.anomalyJournal) map.anomalyJournal = [];
  map.anomalyJournal.push({
    anomalyId: encounter.anomalyId, seed: encounter.seed, mode: encounter.mode, participants: encounter.participants,
    usedSkills: encounter.usedSkills, rollResults: encounter.rollResults, decisions: encounter.decisions, mistakes: encounter.mistakes,
    result, consequences: consequence ? [consequence] : [], rewards, trainChanges, completedAt: new Date().toISOString()
  });
  appendSystemMessage(`◆ «${definition.name}»: ${RESULT_LABELS[result]}. ${consequence || "Экипаж сохранил контроль над ситуацией."}`, result === "completeSuccess" ? "success" : "warning");
}

function applyEncounterAction(action: AnomalyAction, username: string) {
  const encounter = map?.activeAnomalyEncounter;
  if (!encounter || encounter.result || encounter.paused || action.kind !== 'retreat' || encounter.phase === 'collapse') return;
  if (!encounter.participants.includes(username)) encounter.participants.push(username);
  encounter.decisions.push(`${username}: отступление`);
  finishEncounter('retreat');
}

function resolveGurpsRoll(skillTag: string, target: number, username: string, foundryItemUuid?: string) {
  const encounter = map.activeAnomalyEncounter;
  const definition = encounter && ANOMALY_BY_ID[encounter.anomalyId];
  if (!encounter || !definition || encounter.result || encounter.paused) return;
  if (!definition.gurpsResolution.allowedSkillTags.includes(skillTag) && skillTag !== "manual") return;
  const safeTarget = Math.max(3, Math.min(18, Math.floor(target)));
  const index = encounter.rollResults.length;
  const dice = rollThreeDice(encounter.seed, index);
  const roll = dice.reduce((sum, die) => sum + die, 0);
  const effectiveTarget = safeTarget + definition.gurpsResolution.defaultPenalty;
  const criticalSuccess = roll <= 4 || (roll === 5 && effectiveTarget >= 15) || (roll === 6 && effectiveTarget >= 16);
  const criticalFailure = roll === 18 || (roll === 17 && effectiveTarget <= 15) || roll - effectiveTarget >= 10;
  const success = criticalSuccess || (roll < 17 && roll <= effectiveTarget);
  const critical = criticalSuccess || criticalFailure;
  const resolvedSkill = skillTag === "manual" && foundryItemUuid ? `manual:${foundryItemUuid}` : skillTag;
  encounter.rollResults.push({ skillTag, foundryItemUuid, target: effectiveTarget, roll, margin: effectiveTarget - roll, success, critical });
  encounter.usedSkills.push(resolvedSkill);
  if (!encounter.participants.includes(username)) encounter.participants.push(username);
  encounter.elapsedRounds++;
  if (success) {
    if (encounter.mode === "gurps-roll") encounter.progress++;
    else {
      encounter.preparedActions.push('hybrid-forgiveness');
      encounter.timeRemaining += 10;
      encounter.discoveredClues.push('Успешная проверка: +10 секунд и защита от одной ошибки.');
      const clue = definition.detection.clues[Math.min(encounter.discoveredClues.length, definition.detection.clues.length - 1)];
      if (clue && !encounter.discoveredClues.includes(clue)) encounter.discoveredClues.push(clue);
    }
    encounter.anomalyStability = Math.min(100, encounter.anomalyStability + 10);
    if (critical && map.anomalyCriticalRollAutoSuccess) return finishEncounter("completeSuccess");
  } else {
    encounter.mistakes++;
    encounter.exposure = Math.min(100, encounter.exposure + (critical ? 20 : 10));
    encounter.anomalyStability = Math.max(0, encounter.anomalyStability - (critical ? 25 : 12));
  }
  updateEncounterPhase(encounter, definition);
  if (encounter.mode === "gurps-roll" && encounter.progress >= definition.gurpsResolution.requiredSuccesses) finishEncounter(encounter.mistakes ? "successWithCost" : "completeSuccess");
  else if (encounter.phase === "collapse" && encounter.mistakes >= definition.minigame.maxMistakes + 1) finishEncounter("criticalFailure");
}

// Centralized Action Execution (re-used for both voting consensus and GM immediate clicks)
function executeGameAction(action: string) {
  if (!map) return;
  if (map.activeAnomalyEncounter) {
    appendSystemMessage("⚠️ Сначала разрешите текущую аномалию или отступите.", "warning");
    return;
  }
  if (!map.playerPos) {
    map.playerPos = { x: map.entrance.x, y: map.entrance.y };
  }

  const px = map.playerPos.x;
  const py = map.playerPos.y;

  let dx = 0;
  let dy = 0;

  if (action === "UP") dy = -1;
  else if (action === "DOWN") dy = 1;
  else if (action === "LEFT") dx = -1;
  else if (action === "RIGHT") dx = 1;

  if (dx !== 0 || dy !== 0) {
    const nx = px + dx;
    const ny = py + dy;
    if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
      map.playerPos = { x: nx, y: ny };
      resolveCellEnter(nx, ny);
    } else {
      appendSystemMessage("⛔ Командир передумал: движение за границы изученного сектора заблокировано!");
    }
  } else if (action.startsWith("BOLT")) {
    // Validate custom bolt charges (as configured by setup, defaults to 10)
    if (map.boltCharges === undefined) map.boltCharges = 10;
    
    if (map.boltCharges <= 0) {
      appendSystemMessage("❌ Невозможно бросить болт: закончился запас в рюкзаке!", "warning");
      return;
    }
    map.boltCharges--;

    // Determine direction
    let boltDir = "UP";
    if (action.includes("_")) {
      boltDir = action.split("_")[1];
    }
    
    let bdx = 0;
    let bdy = 0;
    let directionName = "";

    if (boltDir === "UP") { bdy = -1; directionName = "вверх (на СЕВЕР) ⬆️"; }
    else if (boltDir === "DOWN") { bdy = 1; directionName = "вниз (на ЮГ) ⬇️"; }
    else if (boltDir === "LEFT") { bdx = -1; directionName = "влево (на ЗАПАД) ⬅️"; }
    else if (boltDir === "RIGHT") { bdx = 1; directionName = "вправо (на ВОСТОК) ➡️"; }

    appendSystemMessage(`🔩 Брошен болт в направлении: ${directionName}! Осталось болтов: ${map.boltCharges}`);

    let anomalyDetected = false;
    // Scan up to 3 cells along the specified vector direction
    for (let step = 1; step <= 3; step++) {
      const targetX = px + bdx * step;
      const targetY = py + bdy * step;

      if (targetX >= 0 && targetX < map.width && targetY >= 0 && targetY < map.height) {
        map.grid[targetY][targetX].isScannedByBolt = true;
        
        if (map.grid[targetY][targetX].type === "anomaly") {
          anomalyDetected = true;
          map.grid[targetY][targetX].isRevealed = true;
          const translatedName = getAnomalyRussianName(map.grid[targetY][targetX].anomalyType);
          appendSystemMessage(`💥 Болт детонировал аномалию на расстоянии ${step} кл. под воздействием очага: "${translatedName}"!`, "danger");
          break; // Bolt path blocked
        }
      } else {
        break; // Flyout of bounds
      }
    }

    if (!anomalyDetected) {
      appendSystemMessage(`🟢 Болт пролетел путь по направлению ${directionName} и упал без шума. Опасности впереди нет.`, "success");
    }
  } else if (action === "GEIGER") {
    if (map.geigerCharges <= 0) {
      appendSystemMessage("❌ Невозможно запустить счетчик Гейгера: разряжены аккумуляторы!", "warning");
      return;
    }
    map.geigerCharges--;
    appendSystemMessage(`📡 Активирован счетчик Гейгера (Зарядов осталось: ${map.geigerCharges})`);
    let foundRad = false;
    for (let gdy = -2; gdy <= 2; gdy++) {
      for (let gdx = -2; gdx <= 2; gdx++) {
        const nx = px + gdx;
        const ny = py + gdy;
        if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
          map.grid[ny][nx].isScannedForRadiation = true;
          if (map.grid[ny][nx].radiationLevel > 0) foundRad = true;
        }
      }
    }
    if (foundRad) {
      appendSystemMessage("⚠️ Предупреждение! Рядом обнаружены очаги жесткой радиации!", "warning");
    } else {
      appendSystemMessage("🟢 Радиационный фон вокруг отряда в пределах нормы.", "success");
    }
  } else if (action === "SCAN") {
    if (map.detectorCharges <= 0) {
      appendSystemMessage("❌ Поиск сорван: детектор артефактов полностью разряжен!", "warning");
      return;
    }
    map.detectorCharges--;
    appendSystemMessage(`🔮 Запущен детектор артефактов (Уровень Детектора: ${map.detectorLevel}, зарядов: ${map.detectorCharges})`);
    resolveArtifactDetectionByLevel(px, py);
  }

  // Clear directional semi-circle highlights on movement
  if (action === "UP" || action === "DOWN" || action === "LEFT" || action === "RIGHT") {
    map.activeDirectionHighlight = null;
  }

  // Reset timer to 60s
  if (!map.activeAnomalyEncounter) map.timerSeconds = 60;

  // Audit survival bounds
  checkGameLossSurvival();
}

// One global server-side interval ticker for active synchronized turn count
let serverClockInterval: any = null;
function initTurnTimerClock() {
  if (serverClockInterval) clearInterval(serverClockInterval);
  serverClockInterval = setInterval(() => {
    if (gameState === "playing" && map?.activeAnomalyEncounter) {
      const encounter = map.activeAnomalyEncounter;
      const tick = tickAnomalyClock(encounter, map.anomalyTimerEnabled !== false);
      if (tick === 'paused') return;
      if (tick === 'expired') {
        encounter.decisions.push('Истекло время решения');
        finishEncounter(encounter.progress > 0 ? 'partialFailure' : 'failure');
      }
      broadcast('SYNC_APP_STATE', { map, gameState, messages });
    } else if (gameState === "playing" && map && !map.activeAnomalyEncounter) {
      if (map.timerSeconds > 0) {
        map.timerSeconds--;
        broadcast("TIMER_TICK", { timerSeconds: map.timerSeconds });
      } else {
        // Penalty dose
        map.timerSeconds = 60;
        const radPenalty = 15;
        map.radiation = Math.min(map.maxRadiation, map.radiation + radPenalty);
        appendSystemMessage(`⚠️ ВРЕМЯ ХОДА ИСТЕКЛО! Пребывание без движения облучает отряд (+${radPenalty} рад)!`, "danger");
        
        // Take small health damage too
        map.health = Math.max(0, map.health - 10);
        
        checkGameLossSurvival();
        
        // Reset active votes on timeout
        activeVotes = {};
        broadcast("VOTES_UPDATE", { activeVotes, activePlayersCount: getActivePlayersCount() });
        broadcast("SYNC_APP_STATE", { map, gameState, messages });
      }
    }
  }, 1000);
}

// Start immediately
initTurnTimerClock();

// ==========================================
// 🍺 ТАВЕРНА, КОШЕЛЕК И МИНИ-ИГРЫ СЕРВЕРА 🍺
// ==========================================
const PLAYER_DB_FILE = path.join(process.cwd(), "db_players.json");
let playerDb: Record<string, {
  userName?: string;
  balance: number;
  unlockedCards: string[];
  pazaakDeck: string[];
}> = {};

try {
  if (fs.existsSync(PLAYER_DB_FILE)) {
    playerDb = JSON.parse(fs.readFileSync(PLAYER_DB_FILE, "utf-8"));
  }
} catch (e) {
  console.error("Ошибка загрузки db_players.json, создаем новый:", e);
}

function savePlayerDb() {
  try {
    fs.writeFileSync(PLAYER_DB_FILE, JSON.stringify(playerDb, null, 2), "utf-8");
  } catch (e) {
    console.error("Ошибка сохранения db_players.json:", e);
  }
}

const SHOP_ITEMS_FILE = path.join(process.cwd(), "db_shop_items.json");
interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: "med" | "weapon" | "ammo" | "armor" | "art" | "misc";
  description: string;
}
let shopItems: ShopItem[] = [];

try {
  if (fs.existsSync(SHOP_ITEMS_FILE)) {
    shopItems = JSON.parse(fs.readFileSync(SHOP_ITEMS_FILE, "utf-8"));
  } else {
    shopItems = [
      { id: "s1", name: "Аптечка первой помощи", price: 150, type: "med", description: "Быстро восстанавливает здоровье отряда." },
      { id: "s2", name: "Антирадиационный шприц", price: 100, type: "med", description: "Выводит 150 рад тяжелых изотопов." },
      { id: "s3", name: "Экзоскелет Монолита", price: 1500, type: "armor", description: "Превосходная броня." },
      { id: "s4", name: "Научная аптечка", price: 250, type: "med", description: "Премиальный сталкерский медикамент." },
      { id: "s5", name: "Детектор 'Отклик'", price: 300, type: "misc", description: "Простой детектор артефактов." }
    ];
    fs.writeFileSync(SHOP_ITEMS_FILE, JSON.stringify(shopItems, null, 2), "utf-8");
  }
} catch (e) {
  console.error("Ошибка загрузки db_shop_items.json:", e);
}

function saveShopItems() {
  try {
    fs.writeFileSync(SHOP_ITEMS_FILE, JSON.stringify(shopItems, null, 2), "utf-8");
  } catch (e) {
    console.error("Ошибка сохранения db_shop_items.json:", e);
  }
}

const TAVERN_SETTINGS_FILE = path.join(process.cwd(), "db_tavern_settings.json");
interface TavernSettings {
  tavernName: string;
  merchantName: string;
  enabledGames: {
    trades: boolean;
    pazaak: boolean;
    dice: boolean;
    races: boolean;
    slots: boolean;
    roulette: boolean;
    shooting: boolean;
    thimblerig: boolean;
    svinya: boolean;
  };
}
let tavernSettings: TavernSettings = {
  tavernName: "Бар «100 Рентген»",
  merchantName: "Сидорович",
  enabledGames: {
    trades: true,
    pazaak: true,
    dice: true,
    races: true,
    slots: true,
    roulette: true,
    shooting: true,
    thimblerig: true,
    svinya: true
  }
};

try {
  if (fs.existsSync(TAVERN_SETTINGS_FILE)) {
    tavernSettings = JSON.parse(fs.readFileSync(TAVERN_SETTINGS_FILE, "utf-8"));
    if (!tavernSettings.merchantName) {
      tavernSettings.merchantName = "Сидорович";
    }
  } else {
    fs.writeFileSync(TAVERN_SETTINGS_FILE, JSON.stringify(tavernSettings, null, 2), "utf-8");
  }
} catch (e) {
  console.error("Ошибка загрузки db_tavern_settings.json, создаем дефолт:", e);
}

function saveTavernSettings() {
  try {
    fs.writeFileSync(TAVERN_SETTINGS_FILE, JSON.stringify(tavernSettings, null, 2), "utf-8");
  } catch (e) {
    console.error("Ошибка сохранения db_tavern_settings.json:", e);
  }
}

function formatCredits(amount: number): string {
  const lastDigit = amount % 10;
  const lastTwoDigits = amount % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return `${amount} кредитов`;
  }
  if (lastDigit === 1) {
    return `${amount} кредит`;
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${amount} кредита`;
  }
  return `${amount} кредитов`;
}

function initPlayerProfile(id: string, username: string) {
  if (!playerDb[id]) {
    playerDb[id] = {
      userName: username,
      balance: 1000,
      unlockedCards: ["+1", "-1", "+2", "-2", "+3", "-3", "+4", "-4", "+5", "-5"],
      pazaakDeck: []
    };
    savePlayerDb();
    appendSystemMessage(`👤 База Данных: Сформирован кошелек в КПК-сети для сталкера "${username}" (+1000 кр.).`, "info");
  } else if (!playerDb[id].userName) {
    playerDb[id].userName = username;
    savePlayerDb();
  }
  return playerDb[id];
}

function broadcastTavernGames() {
  broadcast("SYNC_TAVERN_GAMES", { pazaakLobbies, playerDb, activeRace, shopItems, tavernSettings });
}

// ПАЗААК ЛОББИ И РУЛЕТКА
let pazaakLobbies: Record<string, any> = {};
let activeSvinyaBets: Record<string, number> = {};
let activeDiceGames: Record<string, {
  bet: number;
  botDice: number[];
  playerDice: number[];
  rerollStep: 1 | 2;
}> = {};

const SELF_ID_FIELDS: Record<string, "playerId" | "creatorId" | "opponentId"> = {
  PAZAAK_BUY_BOOSTER: "playerId",
  PAZAAK_SAVE_DECK: "playerId",
  PAZAAK_CREATE_LOBBY: "creatorId",
  PAZAAK_JOIN_LOBBY: "opponentId",
  PAZAAK_PLAY_CARD: "playerId",
  PAZAAK_END_TURN: "playerId",
  PAZAAK_STAND: "playerId",
  PAZAAK_CONCEDE: "playerId",
  DICE_PLAY_BOT: "playerId",
  DICE_REROLL: "playerId",
  RACE_PLACE_BET: "playerId",
  BAR_SELL_ITEM: "playerId",
  BUY_SHOP_ITEM: "playerId",
  SLOTS_SPIN: "playerId",
  ROULETTE_SPIN: "playerId",
  SHOOTING_RANGE_FINISH: "playerId",
  THIMBLERIG_PLAY: "playerId",
  SVINYA_START: "playerId",
  SVINYA_FINISH: "playerId"
};

const BET_FIELDS: Record<string, "bet" | "betAmount"> = {
  PAZAAK_CREATE_LOBBY: "bet",
  DICE_PLAY_BOT: "bet",
  RACE_PLACE_BET: "betAmount",
  SLOTS_SPIN: "bet",
  ROULETTE_SPIN: "betAmount",
  SHOOTING_RANGE_FINISH: "bet",
  THIMBLERIG_PLAY: "bet",
  SVINYA_START: "bet"
};

const BAR_ACTIVITY_COMMANDS = new Set([
  "PAZAAK_BUY_BOOSTER",
  "PAZAAK_SAVE_DECK",
  "PAZAAK_CREATE_LOBBY",
  "PAZAAK_JOIN_LOBBY",
  "PAZAAK_PLAY_CARD",
  "PAZAAK_END_TURN",
  "PAZAAK_STAND",
  "PAZAAK_CONCEDE",
  "DICE_PLAY_BOT",
  "DICE_REROLL",
  "RACE_PLACE_BET",
  "BAR_SELL_ITEM",
  "BUY_SHOP_ITEM",
  "SLOTS_SPIN",
  "ROULETTE_SPIN",
  "SHOOTING_RANGE_FINISH",
  "THIMBLERIG_PLAY",
  "SVINYA_START",
  "SVINYA_FINISH"
]);

function sendError(ws: WebSocket, text: string) {
  ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text, type: "danger" } }));
}

function isPositiveCreditAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 1_000_000;
}

function isValidPlayerIdentity(id: unknown, username: unknown): id is string {
  return typeof id === "string"
    && typeof username === "string"
    && id === username
    && id.trim() === id
    && id.length >= 1
    && id.length <= 40
    && id !== "__proto__"
    && id !== "prototype"
    && id !== "constructor"
    && !/[\u0000-\u001f\u007f]/.test(id);
}

// АНОМАЛЬНЫЕ СКАЧКИ ОДДС
let activeRace: {
  status: "none" | "betting" | "running" | "finished";
  contestants: { name: string; position: number; odds: number; color: string; type: "favorite" | "balanced" | "underdog" }[];
  bets: { playerId: string; username: string; contestantName: string; betAmount: number }[];
  winner: string | null;
  log: string[];
  tickCount: number;
} = {
  status: "none",
  contestants: [
    { name: "Буян 🐎", position: 0, odds: 1.4, color: "text-amber-500", type: "favorite" },
    { name: "Шустрый 🐜", position: 0, odds: 2.0, color: "text-emerald-500", type: "balanced" },
    { name: "Усач Сидоровича 🪳", position: 0, odds: 2.6, color: "text-yellow-500", type: "balanced" },
    { name: "Ржавый Болт 🚗", position: 0, odds: 4.0, color: "text-cyan-500", type: "underdog" }
  ],
  bets: [],
  winner: null,
  log: [],
  tickCount: 0
};
let activeRaceInterval: ReturnType<typeof setInterval> | null = null;

function rollPazaakStep(lobby: any) {
  if (lobby.status !== "playing") return;

  const currentTurn = lobby.turn;
  const isA = currentTurn === lobby.creatorId;
  const stand = isA ? lobby.playerAStand : lobby.playerBStand;
  
  if (stand) {
    if (lobby.playerAStand && lobby.playerBStand) {
      checkPazaakRoundEnd(lobby);
      return;
    }
    lobby.turn = isA ? lobby.opponentId : lobby.creatorId;
    rollPazaakStep(lobby);
    return;
  }

  // Draw table card 1-10
  const drawn = Math.floor(Math.random() * 10) + 1;
  if (isA) {
    lobby.playerABoard.push(drawn);
    lobby.playerAScore = lobby.playerABoard.reduce((sum: number, b: number) => sum + b, 0);
    lobby.log.push(`${lobby.creatorName} тянет карту: ${drawn}. Счет: ${lobby.playerAScore}`);
    
    if (lobby.playerAScore > 20) {
      lobby.statusMessage = `${lobby.creatorName} решает что делать с перебором (${lobby.playerAScore})...`;
    } else {
      lobby.statusMessage = `Ход ${lobby.creatorName} (${lobby.playerAScore}). Сыграйте карту КПК или пасуйте.`;
    }
  } else {
    lobby.playerBBoard.push(drawn);
    lobby.playerBScore = lobby.playerBBoard.reduce((sum: number, b: number) => sum + b, 0);
    lobby.log.push(`${lobby.opponentName} тянет карту: ${drawn}. Счет: ${lobby.playerBScore}`);
    
    if (lobby.playerBScore > 20) {
      lobby.statusMessage = `${lobby.opponentName} решает что делать с перебором (${lobby.playerBScore})...`;
    } else {
      lobby.statusMessage = `Ход ${lobby.opponentName} (${lobby.playerBScore}). Сыграйте карту КПК или пасуйте.`;
    }
  }

  if (lobby.opponentId === "BOT_BAR" && lobby.turn === "BOT_BAR" && !lobby.playerBStand) {
    runPazaakBotTurn(lobby);
  }
}

function runPazaakBotTurn(lobby: any) {
  setTimeout(() => {
    if (lobby.status !== "playing" || lobby.turn !== "BOT_BAR") return;

    let playedCard = false;
    let score = lobby.playerBScore;

    for (let i = 0; i < lobby.playerBHands.length; i++) {
      const card = lobby.playerBHands[i];
      if (!card) continue;
      
      let val = 0;
      if (card.startsWith("+/-")) {
        const amt = parseInt(card.replace("+/-", ""), 10);
        if (score + amt === 20) val = amt;
        else if (score - amt === 20) val = -amt;
        else if (score > 20 && score - amt <= 20) val = -amt;
      } else if (card.startsWith("+")) {
        const amt = parseInt(card.replace("+", ""), 10);
        if (score + amt === 20) val = amt;
      } else if (card.startsWith("-")) {
        const amt = parseInt(card.replace("-", ""), 10);
        if (score - amt === 20 || (score > 20 && score - amt <= 20)) val = -amt;
      } else if (card === "D") {
        const last = lobby.playerBBoard[lobby.playerBBoard.length - 1] || 0;
        if (score + last === 20) val = last;
      }

      if (val !== 0) {
        lobby.playerBBoard.push(val);
        lobby.playerBScore = lobby.playerBBoard.reduce((sum: number, b: number) => sum + b, 0);
        lobby.log.push(`🤖 Харон сыграл карту [${card}] (эффект: ${val > 0 ? '+' : ''}${val}). Счет: ${lobby.playerBScore}`);
        lobby.playerBHands[i] = null;
        playedCard = true;
        break;
      }
    }

    score = lobby.playerBScore;

    if (score === 20 || (score >= 18 && score >= lobby.playerAScore && lobby.playerAStand) || (score >= 18 && !lobby.playerAStand)) {
      lobby.playerBStand = true;
      lobby.log.push(`🤖 Харон объявил STAND (фиксация) на ${score}`);
    } else if (score > 20) {
      lobby.log.push(`🤖 Харон смирился с перебором в ${score} очков.`);
    } else {
      lobby.log.push(`🤖 Харон завершил ход на счете ${score}`);
    }

    checkPazaakRoundEnd(lobby);
    
    if (lobby.status === "playing") {
      if (!lobby.playerAStand) {
        lobby.turn = lobby.creatorId;
        rollPazaakStep(lobby);
      } else if (!lobby.playerBStand) {
        rollPazaakStep(lobby);
      }
    }

    broadcastTavernGames();
  }, 900);
}

function checkPazaakRoundEnd(lobby: any) {
  const pAOver = lobby.playerAScore > 20;
  const pBOver = lobby.playerBScore > 20;

  const bothStood = lobby.playerAStand && lobby.playerBStand;
  const nineCardsA = lobby.playerABoard.filter((c: number) => c > 0).length >= 9;
  const nineCardsB = lobby.playerBBoard.filter((c: number) => c > 0).length >= 9;

  let roundWinner: "A" | "B" | "TIE" | null = null;

  if (pAOver && pBOver) {
    roundWinner = "TIE";
  } else if (pAOver) {
    roundWinner = "B";
  } else if (pBOver) {
    roundWinner = "A";
  } else if (nineCardsA) {
    roundWinner = "A";
  } else if (nineCardsB) {
    roundWinner = "B";
  } else if (bothStood) {
    if (lobby.playerAScore > lobby.playerBScore) {
      roundWinner = "A";
    } else if (lobby.playerAScore < lobby.playerBScore) {
      roundWinner = "B";
    } else {
      const playsATie = lobby.playerABoard.includes("T");
      const playsBTie = lobby.playerBBoard.includes("T");
      if (playsATie && !playsBTie) roundWinner = "A";
      else if (playsBTie && !playsATie) roundWinner = "B";
      else roundWinner = "TIE";
    }
  }

  if (roundWinner) {
    if (roundWinner === "A") {
      lobby.roundsWonA++;
      lobby.log.push(`🏁 Раунд выиграл ${lobby.creatorName} (${lobby.playerAScore} против ${lobby.playerBScore})!`);
    } else if (roundWinner === "B") {
      lobby.roundsWonB++;
      lobby.log.push(`🏁 Раунд выиграл ${lobby.opponentName} (${lobby.playerAScore} против ${lobby.playerBScore})!`);
    } else {
      lobby.log.push(`🏁 Раунд завершился МИРНОЙ НИЧЬЕЙ на счете ${lobby.playerAScore}!`);
    }

    lobby.playerABoard = [];
    lobby.playerBBoard = [];
    lobby.playerAScore = 0;
    lobby.playerBScore = 0;
    lobby.playerAStand = false;
    lobby.playerBStand = false;

    if (lobby.roundsWonA >= 3) {
      lobby.status = "finished";
      lobby.winner = lobby.creatorId;
      lobby.statusMessage = `Победный финал! ${lobby.creatorName} разгромил оппонента ${lobby.roundsWonA}:${lobby.roundsWonB}!`;
      lobby.log.push(`🏆 ${lobby.creatorName} забирает все! Выигрыш: +${formatCredits(lobby.bet)}`);
      
      if (playerDb[lobby.creatorId]) {
        playerDb[lobby.creatorId].balance += lobby.bet * 2;
      }
      savePlayerDb();
    } else if (lobby.roundsWonB >= 3) {
      lobby.status = "finished";
      lobby.winner = lobby.opponentId;
      lobby.statusMessage = `Победный финал! ${lobby.opponentName} разгромил оппонента ${lobby.roundsWonB}:${lobby.roundsWonA}!`;
      lobby.log.push(`🏆 ${lobby.opponentName} одержал окончательную победу!`);
      
      if (lobby.opponentId !== "BOT_BAR" && playerDb[lobby.opponentId]) {
        playerDb[lobby.opponentId].balance += lobby.bet * 2;
      } else if (lobby.opponentId === "BOT_BAR") {
        lobby.log.push(`💸 Сталкер ${lobby.creatorName} оставляет ставку ${formatCredits(lobby.bet)} у бармена.`);
      }
      savePlayerDb();
    } else {
      lobby.statusMessage = `Раунд позади! Счет во встречах ${lobby.roundsWonA}:${lobby.roundsWonB}. Следующий раунд уже в раздаче!`;
      lobby.turn = lobby.creatorId;
      rollPazaakStep(lobby);
    }
  }
}

// РЕЙТИНГ ДЛЯ АНОМАЛЬНЫХ КОСТЕЙ
function evaluateDiceHand(dice: number[]) {
  const counts: Record<number, number> = {};
  dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
  const values = Object.values(counts).sort((a,b) => b-a);
  const keys = Object.keys(counts).map(Number).sort((a,b) => b-a);
  const totalSum = dice.reduce((a,b)=>a+b, 0);

  const uniqueCount = Object.keys(counts).length;
  const isStraight = uniqueCount === 5 && (Math.max(...dice) - Math.min(...dice) === 4);

  if (values[0] === 5) return { rank: 8, name: "ПЯТЕРКА (ПОКЕР ЗОНЫ) 🌌", score: 5000 + keys[0] };
  if (values[0] === 4) return { rank: 7, name: "КАРЕ (Четыре одинаковых) ⚡", score: 4000 + keys[0] * 10 };
  if (values[0] === 3 && values[1] === 2) {
    const tripVal = Number(Object.keys(counts).find(k => counts[Number(k)] === 3));
    return { rank: 6, name: "ФУЛЛ-ХАУС (Три + Пара) 🏠", score: 3000 + tripVal * 10 };
  }
  if (isStraight) return { rank: 5, name: "СТРИТ (Последовательность) 📏", score: 2000 + Math.max(...dice) };
  if (values[0] === 3) return { rank: 4, name: "ТРОЙКА (Три кости) 🕒", score: 1000 + keys[0] };
  if (values[0] === 2 && values[1] === 2) {
    const pairs = Object.keys(counts).filter(k => counts[Number(k)] === 2).map(Number).sort((a,b) => b-a);
    return { rank: 3, name: "ДВЕ ПАРЫ 👥", score: 500 + pairs[0] * 10 + pairs[1] };
  }
  if (values[0] === 2) {
    const pairVal = Number(Object.keys(counts).find(k => counts[Number(k)] === 2));
    return { rank: 2, name: "ПАРА (Две одинаковых) 🤝", score: 200 + pairVal * 10 };
  }
  return { rank: 1, name: "СТАРШАЯ КОСТЬ 🎲", score: totalSum };
}

wss.on("connection", (ws) => {
  console.log("Новое сокет-подключение.");

  ws.on("message", (messageStr) => {
    try {
      const parsedMessage = JSON.parse(messageStr.toString());
      const type = parsedMessage?.type;
      const payload = parsedMessage?.payload ?? {};

      if (typeof type !== "string" || typeof payload !== "object" || Array.isArray(payload)) {
        sendError(ws, "Некорректный формат команды.");
        return;
      }

      if (gameState === "playing" && BAR_ACTIVITY_COMMANDS.has(type)) {
        sendError(ws, "Бар недоступен во время активной экспедиции.");
        return;
      }

      const selfIdField = SELF_ID_FIELDS[type];
      if (selfIdField) {
        const player = clients.get(ws);
        if (!player || payload[selfIdField] !== player.id) {
          sendError(ws, "Операция отклонена: профиль отправителя не совпадает с профилем операции.");
          return;
        }
        if ("username" in payload) payload.username = player.username;
        if ("creatorName" in payload) payload.creatorName = player.username;
        if ("opponentName" in payload) payload.opponentName = player.username;
      }

      const betField = BET_FIELDS[type];
      if (betField && !isPositiveCreditAmount(payload[betField])) {
        sendError(ws, "Ставка должна быть целым положительным числом не более 1 000 000.");
        return;
      }

      switch (type) {
        case "JOIN": {
          const { id, username, role } = payload;

          if (!isValidPlayerIdentity(id, username) || (role !== "player" && role !== "gm")) {
            sendError(ws, "Некорректное имя профиля или роль.");
            ws.close();
            return;
          }
          
          if (role === "gm") {
            const activeGMId = getActiveGMId();
            if (activeGMId && activeGMId !== id) {
              ws.send(JSON.stringify({
                type: "JOIN_REJECTED",
                payload: { reason: "GM_ALREADY_EXISTS" }
              }));
              return;
            }
          }

          // Инициализация кошелька / КПК профиля
          initPlayerProfile(id, username);

          clients.set(ws, { id, username, role });
          console.log(`Пользователь ${username} вошел как ${role}`);

          ws.send(JSON.stringify({
            type: "INIT_STATE",
            payload: {
              gameState,
              map,
              messages,
              stashLoot,
              artifactLoot,
              hasActiveGM: getActiveGMId() !== null,
              activeVotes,
              activePlayersCount: getActivePlayersCount(),
              playerDb,
              pazaakLobbies,
              activeRace
            }
          }));

          broadcastPlayersList();
          // Также шлем СИНХРОНИЗАЦИЮ профилей всем
          broadcastTavernGames();
          // Sync votes immediately to any joining user
          ws.send(JSON.stringify({ type: "VOTES_UPDATE", payload: { activeVotes, activePlayersCount: getActivePlayersCount() } }));
          break;
        }

        case "SYNC_APP_STATE": {
          const clientData = clients.get(ws);
          if (!clientData || clientData.role !== "gm") {
            sendError(ws, "Только куратор может изменять состояние экспедиции.");
            return;
          }

          if (payload.gameState !== undefined) gameState = payload.gameState;
          if (payload.map !== undefined) {
            map = payload.map;
            if (map && !map.playerPos) {
              map.playerPos = { x: map.entrance.x, y: map.entrance.y };
            }
          }
          if (payload.messages !== undefined) messages = payload.messages;
          if (payload.stashLoot !== undefined) stashLoot = payload.stashLoot;
          if (payload.artifactLoot !== undefined) artifactLoot = payload.artifactLoot;

          // Clear votes if starting/ended or resetting
          if (payload.gameState === "playing" || payload.gameState === "setup") {
            activeVotes = {};
            broadcast("VOTES_UPDATE", { activeVotes, activePlayersCount: getActivePlayersCount() });
          }

          broadcast("SYNC_APP_STATE", payload, ws);
          break;
        }

        case "FORCE_CLAIM_GM": {
          const { id, username } = payload;
          if (!isValidPlayerIdentity(id, username)) {
            sendError(ws, "Некорректное имя профиля.");
            ws.close();
            return;
          }
          initPlayerProfile(id, username);
          for (const [socket, player] of clients.entries()) {
            if (player.role === "gm" && player.id !== id) {
              player.role = "player";
              socket.send(JSON.stringify({
                type: "ROLE_KICKED",
                payload: { newRole: "player", message: "Ваши полномочия GM были перехвачены другим участником." }
              }));
            }
          }
          clients.set(ws, { id, username, role: "gm" });
          ws.send(JSON.stringify({ type: "INIT_STATE", payload: { gameState, map, messages, stashLoot, artifactLoot, hasActiveGM: true } }));
          broadcastPlayersList();
          break;
        }

        case "REQUEST_STATE": {
          ws.send(JSON.stringify({
            type: "INIT_STATE",
            payload: {
              gameState,
              map,
              messages,
              stashLoot,
              artifactLoot,
              hasActiveGM: getActiveGMId() !== null,
              activeVotes,
              activePlayersCount: getActivePlayersCount()
            }
          }));
          break;
        }

        case "SUBMIT_VOTE": {
          const player = clients.get(ws);
          if (!player || player.role !== "player") return;

          const { action } = payload;
          const allowedActions = new Set(["UP", "DOWN", "LEFT", "RIGHT", "BOLT_UP", "BOLT_DOWN", "BOLT_LEFT", "BOLT_RIGHT", "GEIGER", "SCAN"]);
          if (!allowedActions.has(action)) {
            sendError(ws, "Неизвестное действие голосования.");
            return;
          }
          // Track choice
          activeVotes[player.id] = { username: player.username, action };

          // Determine majority or unanimous status
          const activePlayersCount = getActivePlayersCount();
          const votesCastKeys = Object.keys(activeVotes);
          const totalVotesCast = votesCastKeys.length;

          // Sum votes per action type
          const counts: Record<string, number> = {};
          Object.values(activeVotes).forEach(v => {
            counts[v.action] = (counts[v.action] || 0) + 1;
          });

          // Check if any option has > 50% of the active player list
          let winningAction: string | null = null;
          for (const [act, cnt] of Object.entries(counts)) {
            if (cnt > activePlayersCount / 2) {
              winningAction = act;
              break;
            }
          }

          // Alternatively, if everyone cast a vote but NO action has absolute > 50% majority (e.g. tie or split)
          const allPlayersVoted = totalVotesCast >= activePlayersCount && activePlayersCount > 0;
          if (!winningAction && allPlayersVoted) {
            let maxVotes = -1;
            for (const [act, cnt] of Object.entries(counts)) {
              if (cnt > maxVotes) {
                maxVotes = cnt;
                winningAction = act;
              }
            }
          }

          // If action was executed, reset vote collection
          if (winningAction) {
            executeGameAction(winningAction);
            activeVotes = {};
            broadcast("VOTES_UPDATE", { activeVotes, activePlayersCount });
            broadcast("SYNC_APP_STATE", { map, gameState, messages });
          } else {
            // Still waiting, just broadcast choices
            broadcast("VOTES_UPDATE", { activeVotes, activePlayersCount });
          }
          break;
        }

        case "RESET_VOTES": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;
          activeVotes = {};
          broadcast("VOTES_UPDATE", { activeVotes, activePlayersCount: getActivePlayersCount() });
          break;
        }

        case "EXECUTE_IMMEDIATE_ACTION": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          const { action } = payload;
          executeGameAction(action);

          // Force broadcast updated state
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          break;
        }

        case 'ANOMALY_ACK': {
          const encounter = map?.activeAnomalyEncounter;
          if (!clients.has(ws) || !encounter?.result || payload.seed !== encounter.seed) return;
          map.activeAnomalyEncounter = null;
          checkGameLossSurvival();
          broadcast('SYNC_APP_STATE', { map, gameState, messages });
          break;
        }
        case 'ANOMALY_PUZZLE': {
          const player = clients.get(ws), encounter = map?.activeAnomalyEncounter;
          if (!player || !encounter?.puzzle || encounter.result || encounter.paused || payload.seed !== encounter.seed) return;
          const status = applyPuzzleInput(encounter.puzzle, payload.input);
          if (status === 'ignored') return;
          if (!encounter.participants.includes(player.username)) encounter.participants.push(player.username);
          encounter.elapsedRounds++;
          encounter.decisions.push(`${player.username}: ${JSON.stringify(payload.input)} — ${status === 'mistake' ? 'ошибка' : 'верно'}`);
          if (status === 'mistake') {
            const protection = encounter.preparedActions.indexOf('hybrid-forgiveness');
            if (protection >= 0) encounter.preparedActions.splice(protection, 1);
            else { encounter.mistakes++; encounter.exposure = Math.min(100, encounter.exposure + 15); encounter.anomalyStability = Math.max(0, encounter.anomalyStability - 20); }
          } else {
            const puzzle = encounter.puzzle;
            encounter.progress = puzzle.kind === 'wires' ? puzzle.connected.length : puzzle.kind === 'sequence' ? puzzle.cursor : puzzle.visited.length - 1;
          }
          updateEncounterPhase(encounter, ANOMALY_BY_ID[encounter.anomalyId]);
          if (status === 'complete') finishEncounter(encounter.mistakes ? 'successWithCost' : 'completeSuccess');
          else if (encounter.mistakes >= encounter.puzzle.limit) finishEncounter(encounter.progress ? 'partialFailure' : 'failure');
          broadcast('SYNC_APP_STATE', { map, gameState, messages });
          break;
        }
        case "ANOMALY_ACTION": {
          const player = clients.get(ws);
          const encounter = map?.activeAnomalyEncounter;
          const definition = encounter && ANOMALY_BY_ID[encounter.anomalyId];
          if (!player || !encounter || !definition) return;
          if (payload.actionId !== 'retreat') {
            sendError(ws, "В режиме GURPS используйте серию проверок навыков.");
            return;
          }
          const action = definition.minigame.actions.find(
            (candidate: AnomalyAction) => candidate.id === payload.actionId,
          );
          if (!action) {
            sendError(ws, "Неизвестное действие аномалии.");
            return;
          }
          applyEncounterAction(action, player.username);
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          break;
        }

        case "ANOMALY_GURPS_ROLL": {
          const player = clients.get(ws);
          const encounter = map?.activeAnomalyEncounter;
          if (!player || !encounter) return;
          if (encounter.mode === "minigame") {
            sendError(ws, "Проверки GURPS отключены в режиме чистой мини-игры.");
            return;
          }
          const target = Number(payload.target);
          if (String(payload.skillTag || 'manual') === 'manual' && player.role !== 'gm') {
            sendError(ws, 'Произвольный навык выбирает ведущий.'); return;
          }
          if (encounter.mode === 'hybrid' && encounter.rollResults.length >= 3) {
            sendError(ws, 'В гибридном режиме доступны три вспомогательные проверки на сцену.'); return;
          }
          if (!Number.isFinite(target)) {
            sendError(ws, "Укажите целевое значение навыка.");
            return;
          }
          resolveGurpsRoll(String(payload.skillTag || "manual"), target, player.username, payload.foundryItemUuid ? String(payload.foundryItemUuid) : undefined);
          const current = map.activeAnomalyEncounter;
          const definition = current && ANOMALY_BY_ID[current.anomalyId];
          if (current && definition && current.mode === "gurps-roll" && current.rollResults.length >= 5 && !current.result) {
            finishEncounter(current.progress >= 2 ? "partialFailure" : "failure");
          }
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          break;
        }

        case "ANOMALY_GM_PAUSE": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm" || !map?.activeAnomalyEncounter) return;
          map.activeAnomalyEncounter.paused = Boolean(payload.paused);
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          break;
        }

        case "ANOMALY_GM_RESOLVE": {
          const player = clients.get(ws);
          const allowedResults: EncounterResult[] = ["completeSuccess", "successWithCost", "partialFailure", "failure", "criticalFailure", "retreat"];
          if (!player || player.role !== "gm" || !map?.activeAnomalyEncounter || !allowedResults.includes(payload.result)) return;
          finishEncounter(payload.result);
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          break;
        }

        // ==========================================
//         ТАВЕРНА И МИНИ-ИГРЫ КПК
// ==========================================
        case "TAVERN_PREPARE": {
          ws.send(JSON.stringify({
            type: "SYNC_TAVERN_GAMES",
            payload: { pazaakLobbies, playerDb, activeRace, shopItems, tavernSettings }
          }));
          break;
        }

        case "PAZAAK_BUY_BOOSTER": {
          if (!tavernSettings.enabledGames.pazaak) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Торговля картами Паазак временно заблокирована куратором!", type: "danger" } }));
              return;
            }
          }
          const { playerId, username } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (profile.balance < 300) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на балансе КПК! Бустер стоит 300 кредитов.", type: "danger" } }));
            return;
          }
          profile.balance -= 300;
          
          const premiumPool = ["+/-1", "+/-2", "+/-3", "+/-4", "+/-5", "+/-6", "D", "T", "+/-1 or 2", "2&4", "3&6"];
          const pulled: string[] = [];
          for (let i = 0; i < 3; i++) {
            pulled.push(premiumPool[Math.floor(Math.random() * premiumPool.length)]);
          }
          profile.unlockedCards = [...profile.unlockedCards, ...pulled];
          savePlayerDb();
          
          ws.send(JSON.stringify({
            type: "BOOSTER_PULLED_SUCCESS",
            payload: { pulled, profile }
          }));
          
          appendSystemMessage(`🃏 ${username} приобрел бустер Паазака за 300 кредитов и вытащил: [${pulled.join(", ")}]!`, "loot");
          broadcastTavernGames();
          break;
        }

        case "PAZAAK_SAVE_DECK": {
          const { playerId, deck } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          const availableCards = [...profile.unlockedCards];
          const ownsEveryCard = Array.isArray(deck) && deck.every((card: unknown) => {
            if (typeof card !== "string") return false;
            const ownedIndex = availableCards.indexOf(card);
            if (ownedIndex < 0) return false;
            availableCards.splice(ownedIndex, 1);
            return true;
          });
          if (Array.isArray(deck) && deck.length === 8 && ownsEveryCard) {
            profile.pazaakDeck = deck;
            savePlayerDb();
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "✅ Колода Паазака успешно сохранена!", type: "success" } }));
            broadcastTavernGames();
          } else {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Ошибка: колода должна содержать ровно 8 карт!", type: "danger" } }));
          }
          break;
        }

        case "PAZAAK_CREATE_LOBBY": {
          if (!tavernSettings.enabledGames.pazaak) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Дуэльный стол Паазака временно закрыт куратором!", type: "danger" } }));
              return;
            }
          }
          const { creatorId, creatorName, opponentId, bet } = payload;
          const profile = playerDb[creatorId];
          if (!profile) return;

          const creatorDeck = [...(profile.pazaakDeck || [])];
          if (creatorDeck.length < 8) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Ошибка: У вас выбрано меньше 8 карт! Сначала сохраните колоду.", type: "danger" } }));
            return;
          }

          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на КПК для совершения ставки!", type: "danger" } }));
            return;
          }

          const lobbyId = "pz_" + Math.random().toString(36).substring(2, 9);
          profile.balance -= bet;
          savePlayerDb();

          // Shuffled sub-array of 4 cards picked for matches
          const getRandomSubarray = (arr: any[], size: number) => {
            const shuffled = [...arr].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, size);
          };

          const playerAHands = getRandomSubarray(creatorDeck, 4);

          // For bar bot, construct a baseline 8-card deck and select 4 random
          const botDeckPool = ["+1", "-1", "+2", "-2", "+3", "-3", "+/-1", "+/-2", "D", "T"];
          const botDeck8 = getRandomSubarray(botDeckPool, 8);
          const playerBHands = opponentId === "BOT_BAR" ? getRandomSubarray(botDeck8, 4) : [];

          const newLobby = {
            id: lobbyId,
            creatorId,
            creatorName,
            creatorDeck: creatorDeck,
            opponentId: opponentId,
            opponentName: opponentId === "BOT_BAR" ? "Харон (Бармен)" : null,
            opponentDeck: opponentId === "BOT_BAR" ? botDeck8 : [],
            bet,
            status: opponentId === "BOT_BAR" ? "playing" : "waiting",
            turn: creatorId,
            playerAScore: 0,
            playerBScore: 0,
            playerAHands,
            playerBHands,
            playerAStand: false,
            playerBStand: false,
            playerABoard: [],
            playerBBoard: [],
            roundsWonA: 0,
            roundsWonB: 0,
            log: [`Начата встреча Паазак между ${creatorName} со ставкой ${formatCredits(bet)}.`],
            statusMessage: opponentId === "BOT_BAR" ? "Игра началась!" : "Ожидаем оппонента...",
            winner: null
          };

          pazaakLobbies[lobbyId] = newLobby;
          
          if (opponentId === "BOT_BAR") {
            rollPazaakStep(newLobby);
          }

          appendSystemMessage(`🎲 Сталкер ${creatorName} открыл стол Паазак со ставкой ${formatCredits(bet)}.`, "info");
          broadcastTavernGames();
          break;
        }

        case "PAZAAK_JOIN_LOBBY": {
          if (!tavernSettings.enabledGames.pazaak) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Дуэльный стол Паазака временно закрыт куратором!", type: "danger" } }));
              return;
            }
          }
          const { lobbyId, opponentId, opponentName } = payload;
          const lobby = pazaakLobbies[lobbyId];
          if (!lobby || lobby.status !== "waiting") return;

          const profile = playerDb[opponentId];
          if (!profile) return;

          const oppDeck = [...(profile.pazaakDeck || [])];
          if (oppDeck.length < 8) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Ошибка: У вас выбрано меньше 8 карт! Сначала сохраните колоду.", type: "danger" } }));
            return;
          }

          if (profile.balance < lobby.bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на балансе КПК!", type: "danger" } }));
            return;
          }

          profile.balance -= lobby.bet;
          savePlayerDb();

          const getRandomSubarray = (arr: any[], size: number) => {
            const shuffled = [...arr].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, size);
          };

          lobby.opponentId = opponentId;
          lobby.opponentName = opponentName;
          lobby.opponentDeck = oppDeck;
          lobby.playerBHands = getRandomSubarray(oppDeck, 4);
          lobby.status = "playing";
          lobby.statusMessage = "Оппонент подключился! Сдача первого раунда...";
          lobby.log.push(`${opponentName} зашел во встречу. Ставки пополнены.`);

          appendSystemMessage(`⚔️ Сталкер ${opponentName} принял дуэль в Паазак от ${lobby.creatorName} на ${formatCredits(lobby.bet)}!`, "warning");
          rollPazaakStep(lobby);
          
          broadcastTavernGames();
          break;
        }

        case "PAZAAK_PLAY_CARD": {
          const { lobbyId, playerId, cardIndex } = payload;
          const lobby = pazaakLobbies[lobbyId];
          if (!lobby || lobby.status !== "playing") return;
          if (lobby.turn !== playerId) return;

          const isA = playerId === lobby.creatorId;
          const hand = isA ? lobby.playerAHands : lobby.playerBHands;
          const card = hand[cardIndex];
          if (!card) return;

          let val = 0;
          if (card.startsWith("+/-")) {
            val = parseInt(card.replace("+/-", ""), 10) * (payload.useNegative ? -1 : 1);
          } else if (card.startsWith("+")) {
            val = parseInt(card.replace("+", ""), 10);
          } else if (card.startsWith("-")) {
            val = -parseInt(card.replace("-", ""), 10);
          } else if (card === "D") {
            const board = isA ? lobby.playerABoard : lobby.playerBBoard;
            const last = board[board.length - 1] || 0;
            val = last;
          } else if (card === "T") {
            val = 0;
          }

          if (isA) {
            lobby.playerABoard.push(val);
            if (card === "T") lobby.playerABoard.push("T");
            lobby.playerAScore = lobby.playerABoard.filter((c: any) => typeof c === 'number').reduce((sum: number, b: number) => sum + b, 0);
            lobby.playerAHands[cardIndex] = null;
            lobby.log.push(`${lobby.creatorName} сыграл карту [${card}] (эффект: ${val > 0 ? '+' : ''}${val}). Счет: ${lobby.playerAScore}`);
          } else {
            lobby.playerBBoard.push(val);
            if (card === "T") lobby.playerBBoard.push("T");
            lobby.playerBScore = lobby.playerBBoard.filter((c: any) => typeof c === 'number').reduce((sum: number, b: number) => sum + b, 0);
            lobby.playerBHands[cardIndex] = null;
            lobby.log.push(`${lobby.opponentName} сыграл карту [${card}] (эффект: ${val > 0 ? '+' : ''}${val}). Счет: ${lobby.playerBScore}`);
          }

          broadcastTavernGames();
          break;
        }

        case "PAZAAK_END_TURN": {
          const { lobbyId, playerId } = payload;
          const lobby = pazaakLobbies[lobbyId];
          if (!lobby || lobby.status !== "playing") return;
          if (lobby.turn !== playerId) return;

          const isA = playerId === lobby.creatorId;
          const nextPlayerId = isA ? lobby.opponentId : lobby.creatorId;
          
          lobby.turn = nextPlayerId;
          lobby.log.push(`${isA ? lobby.creatorName : lobby.opponentName} завершает ход.`);

          checkPazaakRoundEnd(lobby);

          if (lobby.status === "playing") {
            rollPazaakStep(lobby);
          }

          broadcastTavernGames();
          break;
        }

        case "PAZAAK_STAND": {
          const { lobbyId, playerId } = payload;
          const lobby = pazaakLobbies[lobbyId];
          if (!lobby || lobby.status !== "playing") return;
          if (lobby.turn !== playerId) return;

          const isA = playerId === lobby.creatorId;
          if (isA) {
            lobby.playerAStand = true;
            lobby.log.push(`${lobby.creatorName} зафиксировал счет на STAND (${lobby.playerAScore})`);
          } else {
            lobby.playerBStand = true;
            lobby.log.push(`${lobby.opponentName} зафиксировал счет на STAND (${lobby.playerBScore})`);
          }

          checkPazaakRoundEnd(lobby);

          if (lobby.status === "playing") {
            lobby.turn = isA ? lobby.opponentId : lobby.creatorId;
            rollPazaakStep(lobby);
          }

          broadcastTavernGames();
          break;
        }

        case "PAZAAK_CONCEDE": {
          const { lobbyId, playerId } = payload;
          const lobby = pazaakLobbies[lobbyId];
          if (!lobby || lobby.status !== "playing") return;

          const isA = playerId === lobby.creatorId;
          lobby.status = "finished";
          lobby.winner = isA ? lobby.opponentId : lobby.creatorId;
          lobby.statusMessage = `${isA ? lobby.creatorName : lobby.opponentName} признал поражение сдачей.`;
          lobby.log.push(`⚠️ ${isA ? lobby.creatorName : lobby.opponentName} капитулировал.`);

          if (lobby.winner !== "BOT_BAR") {
            if (playerDb[lobby.winner]) {
              playerDb[lobby.winner].balance += lobby.bet * 2;
            }
          }
          savePlayerDb();

          broadcastTavernGames();
          break;
        }

        case "DICE_PLAY_BOT": {
          if (!tavernSettings.enabledGames.dice) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Игра в кости на КПК временно закрыта куратором!", type: "danger" } }));
              return;
            }
          }
          const { playerId, username, bet } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на балансе КПК!", type: "danger" } }));
            return;
          }

          profile.balance -= bet;
          savePlayerDb();

          const botDice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
          const playerDice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);

          const botHand = evaluateDiceHand(botDice);
          const playerHand = evaluateDiceHand(playerDice);
          activeDiceGames[playerId] = { bet, botDice, playerDice, rerollStep: 1 };

          ws.send(JSON.stringify({
            type: "DICE_STATE_SYNC",
            payload: {
              active: true,
              bet,
              botDice,
              playerDice,
              botHand,
              playerHand,
              rerollStep: 1,
              lockedIndexes: [false, false, false, false, false]
            }
          }));

          appendSystemMessage(`🎲 Сталкер ${username} бросает кости против бармена на ${formatCredits(bet)}.`, "info");
          break;
        }

        case "DICE_REROLL": {
          const { playerId } = payload;
          const username = clients.get(ws)?.username || "Сталкер";
          const profile = playerDb[playerId];
          const game = activeDiceGames[playerId];
          if (!profile || !game) {
            sendError(ws, "Активная партия в кости не найдена.");
            return;
          }
          const bet = game.bet;
          const playerDice = game.playerDice;
          const botDice = game.botDice;
          const lockedIndexes = Array.isArray(payload.lockedIndexes) && payload.lockedIndexes.length === 5
            ? payload.lockedIndexes.map(Boolean)
            : [false, false, false, false, false];

          // Perform reroll on the user's unlocked dice
          const finalPlayerDice = playerDice.map((val: number, i: number) => {
            return lockedIndexes[i] ? val : Math.floor(Math.random() * 6) + 1;
          });

          // Perform reroll on the chatbot's unlocked dice
          const botCounts: Record<number, number> = {};
          botDice.forEach((d: number) => botCounts[d] = (botCounts[d] || 0) + 1);
          const botMaxCount = Math.max(...Object.values(botCounts));
          const targetToLock = Number(Object.keys(botCounts).find(k => botCounts[Number(k)] === botMaxCount));
          
          const finalBotDice = botDice.map((val: number) => {
            if (botMaxCount > 1 && val === targetToLock) return val;
            if (botMaxCount === 1 && val === Math.max(...botDice)) return val;
            return Math.floor(Math.random() * 6) + 1;
          });

          const currentStep = game.rerollStep;

          if (currentStep === 1) {
            activeDiceGames[playerId] = {
              bet,
              botDice: finalBotDice,
              playerDice: finalPlayerDice,
              rerollStep: 2
            };
            // First reroll completed. Move to step 2, keep game active, clear user locks for the next decision
            ws.send(JSON.stringify({
              type: "DICE_STATE_SYNC",
              payload: {
                active: true,
                bet,
                botDice: finalBotDice,
                playerDice: finalPlayerDice,
                botHand: evaluateDiceHand(finalBotDice),
                playerHand: evaluateDiceHand(finalPlayerDice),
                rerollStep: 2,
                lockedIndexes: [false, false, false, false, false]
              }
            }));
            appendSystemMessage(`🎲 Сталкер ${username} совершил первый переброс костей. Ожидается финальный ход.`, "info");
          } else {
            delete activeDiceGames[playerId];
            // Second reroll completed. Proceed to final round evaluation (step 3)
            const finalBotHand = evaluateDiceHand(finalBotDice);
            const finalPlayerHand = evaluateDiceHand(finalPlayerDice);

            let result: "win" | "lose" | "tie" = "lose";
            let prize = 0;
            let message = "";

            if (finalPlayerHand.rank > finalBotHand.rank) {
              result = "win";
            } else if (finalPlayerHand.rank < finalBotHand.rank) {
              result = "lose";
            } else {
              if (finalPlayerHand.score > finalBotHand.score) {
                result = "win";
              } else if (finalPlayerHand.score < finalBotHand.score) {
                result = "lose";
              } else {
                result = "tie";
              }
            }

            if (result === "win") {
              prize = bet * 2;
              profile.balance += prize;
              message = `🎉 ВЫ ВЫИГРАЛИ! Ваши [${finalPlayerHand.name}] уделали кости бармена [${finalBotHand.name}]! +${formatCredits(bet)}!`;
              appendSystemMessage(`🎉 Сталкер ${username} выиграл +${formatCredits(bet)} у бармена в Кости со счетом [${finalPlayerHand.name}]!`, "success");
            } else if (result === "lose") {
              prize = 0;
              message = `💸 Увы! Бармен обыграл вас своей рукой [${finalBotHand.name}] против ваших [${finalPlayerHand.name}].`;
              appendSystemMessage(`💸 Сталкер ${username} проиграл ставку в кости бармену (проиграл с ${finalPlayerHand.name} против ${finalBotHand.name}).`, "info");
            } else {
              prize = bet;
              profile.balance += prize;
              message = `🤝 Ничья! Кости сошлись в комбинации [${finalPlayerHand.name}]. Ставка возвращена.`;
            }

            savePlayerDb();

            ws.send(JSON.stringify({
              type: "DICE_STATE_SYNC",
              payload: {
                active: true,
                bet,
                botDice: finalBotDice,
                playerDice: finalPlayerDice,
                botHand: finalBotHand,
                playerHand: finalPlayerHand,
                rerollStep: 3,
                result,
                message,
                lockedIndexes
              }
            }));

            broadcastTavernGames();
          }
          break;
        }

        case "RACE_PLACE_BET": {
          if (!tavernSettings.enabledGames.races) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Тотализатор скачек временно заблокирован куратором бара!", type: "danger" } }));
              return;
            }
          }
          const { playerId, username, contestantName, betAmount } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (!activeRace.contestants.some(contestant => contestant.name === contestantName)) {
            sendError(ws, "Выбранный участник забега не найден.");
            return;
          }

          if (activeRace.status !== "betting" && activeRace.status !== "none") {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Ставки на этот заезд уже закрыты!", type: "danger" } }));
            return;
          }

          if (profile.balance < betAmount) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на КПК!", type: "danger" } }));
            return;
          }

          activeRace.status = "betting";
          profile.balance -= betAmount;
          savePlayerDb();

          activeRace.bets.push({ playerId, username, contestantName, betAmount });
          activeRace.log.push(`📝 Ставка: ${username} зарядил ${formatCredits(betAmount)} на "${contestantName}"`);

          broadcastTavernGames();
          break;
        }

        case "RACE_SET_CONTESTANTS": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          const { names } = payload;
          if (Array.isArray(names) && names.length >= 2) {
            activeRace.contestants = names.map((name, i) => {
              const types: ("favorite"|"balanced"|"underdog")[] = ["favorite", "balanced", "balanced", "underdog"];
              const muls = [1.8, 3.4, 4.8, 9.5];
              return {
                name,
                position: 0,
                odds: muls[i % muls.length],
                color: ["text-amber-500", "text-emerald-500", "text-yellow-500", "text-cyan-500"][i % 4],
                type: types[i % types.length]
              };
            });
            activeRace.log.push(`🛠️ Куратор обновил список участников забегов!`);
            broadcastTavernGames();
          }
          break;
        }

        case "RACE_START_GM": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          if (activeRace.status !== "betting" || activeRace.bets.length === 0) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Нет принятых ставок для начала забега!", type: "danger" } }));
            return;
          }

          activeRace.status = "running";
          activeRace.winner = null;
          activeRace.tickCount = 0;
          activeRace.contestants.forEach(c => c.position = 0);
          activeRace.log = [`🏁 КУРАТОР ДАЛ СТАРТ ЗАБЕГУ! Звери ринулись вперед!`];
          appendSystemMessage(`🏁 НАЧАЛИСЬ ПОДПОЛЬНЫЕ СКАЧКИ ТАВЕРНЫ! Твари пущены!`, "warning");

          broadcastTavernGames();

          activeRaceInterval = setInterval(() => {
            activeRace.tickCount++;
            let finishReached = false;

            activeRace.contestants.forEach(c => {
              let delta = 0;
              let eventMsg = "";
              
              if (c.type === "favorite") {
                delta = Math.floor(Math.random() * 3) + 2; // 2-4
                if (Math.random() < 0.20) {
                  delta += 2;
                  if (Math.random() < 0.15) eventMsg = `🔥 ${c.name} почуял азарт и прибавил ходу!`;
                }
                if (Math.random() < 0.15) {
                  delta -= 1;
                  if (Math.random() < 0.15) eventMsg = `💨 ${c.name} попал в пылевой вихрь.`;
                }
              } else if (c.type === "balanced") {
                delta = Math.floor(Math.random() * 3) + 1; // 1-3
                if (Math.random() < 0.35) {
                  delta += 3;
                  if (Math.random() < 0.20) eventMsg = `⚡ ${c.name} совершает отличный рывок!`;
                }
                if (Math.random() < 0.15) {
                  delta -= 1;
                  if (Math.random() < 0.15) eventMsg = `⚠️ ${c.name} притормозил перед воронкой.`;
                }
              } else if (c.type === "underdog") {
                delta = Math.floor(Math.random() * 2) + 1; // 1-2
                if (Math.random() < 0.45) {
                  delta += 4;
                  if (Math.random() < 0.25) eventMsg = `🚀 АНОМАЛЬНЫЙ УСКОРИТЕЛЬ! ${c.name} буквально летит вперед!`;
                }
                if (Math.random() < 0.20) {
                  delta -= 2;
                  if (Math.random() < 0.20) eventMsg = `🐾 ${c.name} споткнулся и замедлился.`;
                }
              }

              delta = Math.max(0, delta);
              c.position = Math.min(100, c.position + delta);

              if (eventMsg && activeRace.tickCount % 2 === 0) {
                activeRace.log.push(eventMsg);
              }

              if (c.position >= 100) {
                finishReached = true;
              }
            });

            const sorted = [...activeRace.contestants].sort((a,b) => b.position - a.position);
            if (activeRace.tickCount % 3 === 0) {
              activeRace.log.push(`🏃 Лидер забега: "${sorted[0].name}" (пройдено ${sorted[0].position}%)`);
            }

            if (finishReached) {
              if (activeRaceInterval) {
                clearInterval(activeRaceInterval);
                activeRaceInterval = null;
              }
              const finalSorted = [...activeRace.contestants].sort((a,b) => b.position - a.position);
              const winner = finalSorted[0];
              activeRace.winner = winner.name;
              activeRace.status = "finished";
              activeRace.log.push(`🏆 ПОБЕДИТЕЛЬ ЗАБЕГА: "${winner.name}"!`);
              appendSystemMessage(`🏁 Скачки: Победил "${winner.name}"!`, "success");

              activeRace.bets.forEach(b => {
                if (b.contestantName === winner.name) {
                  const winnings = Math.floor(b.betAmount * winner.odds);
                  if (playerDb[b.playerId]) {
                    playerDb[b.playerId].balance += winnings;
                    activeRace.log.push(`💰 ${b.username} забирает выплату: +${formatCredits(winnings)} (кэф ${winner.odds}x)!`);
                    appendSystemMessage(`💰 Сталкер ${b.username} сорвал куш в ${formatCredits(winnings)} на "${winner.name}"!`, "loot");
                  }
                } else {
                  activeRace.log.push(`🥀 ${b.username} проиграл свою ставку на ${b.contestantName}`);
                }
              });

              savePlayerDb();
            }

            broadcastTavernGames();
          }, 700);
          break;
        }

        case "RACE_RESET_GM": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          if (activeRaceInterval) {
            clearInterval(activeRaceInterval);
            activeRaceInterval = null;
          }
          activeRace.status = "none";
          activeRace.bets = [];
          activeRace.winner = null;
          activeRace.log = ["Заезд очищен и готов к новым ставкам."];
          activeRace.contestants.forEach(c => c.position = 0);
          
          broadcastTavernGames();
          break;
        }

        case "BAR_SELL_ITEM": {
          if (!tavernSettings.enabledGames.trades) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: `❌ Скупка у торговца ${tavernSettings.merchantName || "Сидорович"} временно приостановлена куратором!`, type: "danger" } }));
              return;
            }
          }
          const { playerId, username, itemIndex } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (!map || !map.inventory || !map.inventory[itemIndex]) return;

          const itemName = map.inventory[itemIndex];
          
          let price = 200;
          const matchingShopItem = shopItems.find(item => item.name === itemName);
          const artifactNames = ["Капля", "Кровь камня", "Слизь", "Колючка", "Медуза", "Вспышка", "Кристалл", "Бенгальский огонь", "Ночной Светоч"];
          const isArtifact = artifactNames.some(art => itemName.includes(art));
          if (matchingShopItem) {
            price = Math.max(1, Math.floor(matchingShopItem.price * 0.5));
          } else if (isArtifact) {
            price = Math.floor(Math.random() * 400) + 600;
          } else {
            price = Math.floor(Math.random() * 100) + 150;
          }

          profile.balance += price;
          savePlayerDb();

          map.inventory.splice(itemIndex, 1);

          appendSystemMessage(`🤝 Сталкер ${username} сдал торговцу ${tavernSettings.merchantName || "Сидорович"} хабар: "${itemName}" за ${formatCredits(price)}!`, "loot");
          
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          broadcastTavernGames();
          break;
        }

        case "GM_MODIFY_BALANCE": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          const { targetPlayerId, delta } = payload;
          const profile = playerDb[targetPlayerId];
          if (profile) {
            profile.balance = Math.max(0, profile.balance + delta);
            savePlayerDb();
            appendSystemMessage(`⚙️ Система: Баланс игрока был отрегулирован куратором на ${delta > 0 ? '+' : ''}${formatCredits(Math.abs(delta))}.`, "info");
            broadcastTavernGames();
          }
          break;
        }

        case "GM_SET_PLAYER_BALANCE": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          const { targetPlayerId, balance } = payload;
          const profile = playerDb[targetPlayerId];
          if (profile) {
            profile.balance = Math.max(0, parseInt(balance, 10) || 0);
            savePlayerDb();
            appendSystemMessage(`🛡️ База данных: Куратор установил баланс у игрока в размере ${formatCredits(profile.balance)}.`, "info");
            broadcastTavernGames();
          }
          break;
        }

        case "GM_UNLOCK_PLAYER_CARDS": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          const { targetPlayerId, card } = payload;
          const profile = playerDb[targetPlayerId];
          if (profile && card) {
            if (!profile.unlockedCards.includes(card)) {
              profile.unlockedCards.push(card);
              savePlayerDb();
              appendSystemMessage(`🛡️ База данных: Куратор открыл карту [${card}] игроку.`, "info");
              broadcastTavernGames();
            }
          }
          break;
        }

         case "GM_RESET_PLAYER_PROFILE": {
           const player = clients.get(ws);
           if (!player || player.role !== "gm") return;

           const { targetPlayerId } = payload;
           if (playerDb[targetPlayerId]) {
             const oldName = playerDb[targetPlayerId]?.userName;
             playerDb[targetPlayerId] = {
               userName: oldName,
               balance: 1000,
               unlockedCards: ["+1", "-1", "+2", "-2", "+3", "-3", "+4", "-4", "+5", "-5"],
               pazaakDeck: []
             };
             savePlayerDb();
             appendSystemMessage(`🛡️ База данных: Куратор сбросил профиль игрока к начальным значениям!`, "info");
             broadcastTavernGames();
           }
           break;
         }

        case "GM_ADD_SHOP_ITEM": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          const { name, price, type, description } = payload;
          const parsedPrice = Number(price);
          if (typeof name !== "string" || !name.trim() || !isPositiveCreditAmount(parsedPrice)) {
            sendError(ws, "Название товара и положительная целая цена обязательны.");
            return;
          }
          const newItem = {
            id: "item_" + Math.random().toString(36).substring(2, 9),
            name: name.trim().slice(0, 100),
            price: parsedPrice,
            type: type || "misc",
            description: description || "Специальный заказ КПК"
          };
          shopItems.push(newItem);
          saveShopItems();
          appendSystemMessage(`🛒 Торговля: Куратор добавил новый товар на прилавок ${tavernSettings.merchantName || "Сидорович"}: "${name}" за ${formatCredits(newItem.price)}!`, "info");
          broadcastTavernGames();
          break;
        }

        case "GM_DELETE_SHOP_ITEM": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          const { itemId } = payload;
          const found = shopItems.find(i => i.id === itemId);
          if (found) {
            shopItems = shopItems.filter(i => i.id !== itemId);
            saveShopItems();
            appendSystemMessage(`🗑️ Торговля: Куратор убрал товар "${found.name}" с прилавка ${tavernSettings.merchantName || "Сидорович"}.`, "info");
            broadcastTavernGames();
          }
          break;
        }

        case "GM_UPDATE_TAVERN_SETTINGS": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          const { tavernName, merchantName, enabledGames } = payload;
          if (tavernName !== undefined) {
            tavernSettings.tavernName = tavernName;
            appendSystemMessage(`⚙️ Заведение: Бар переименован в "${tavernName}"`, "warning");
          }
          if (merchantName !== undefined) {
            tavernSettings.merchantName = merchantName;
            appendSystemMessage(`⚙️ Заведение: Торговец переименован в "${merchantName}"`, "warning");
          }
          if (enabledGames !== undefined) {
            tavernSettings.enabledGames = enabledGames;
            appendSystemMessage(`⚙️ Заведение: Куратор переключил правила доступности игр Зоны.`, "info");
          }
          
          saveTavernSettings();
          broadcastTavernGames();
          break;
        }

        case "BUY_SHOP_ITEM": {
          if (!tavernSettings.enabledGames.trades) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: `❌ Торговая лавка ${tavernSettings.merchantName || "Сидоровича"} временно закрыта куратором!`, type: "danger" } }));
              return;
            }
          }
          const { playerId, username, itemId } = payload;
          const profile = playerDb[playerId];
          const item = shopItems.find(i => i.id === itemId);
          if (!profile || !item) return;
          if (!isPositiveCreditAmount(item.price)) {
            sendError(ws, "У товара указана некорректная цена.");
            return;
          }

          if (profile.balance < item.price) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на счете КПК!", type: "danger" } }));
            return;
          }

          if (!map) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Ошибка: Экспедиция еще не запущена! В рюкзак отряда сейчас положить нельзя.", type: "danger" } }));
            return;
          }

          profile.balance -= item.price;
          savePlayerDb();

          if (!map.inventory) {
            map.inventory = [];
          }
          map.inventory.push(item.name);

          appendSystemMessage(`🛒 Сталкер ${username} купил у ${tavernSettings.merchantName || "Сидоровича"}: "${item.name}" за ${formatCredits(item.price)}!`, "loot");
          
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          broadcastTavernGames();
          break;
        }

        case "GM_ADD_TO_INVENTORY": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;

          const { itemName } = payload;
          if (!map) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Экспедиция не запущена!", type: "danger" } }));
            return;
          }
          if (!map.inventory) {
            map.inventory = [];
          }
          map.inventory.push(itemName);
          appendSystemMessage(`📦 Рюкзак: Куратор напрямую добавил "${itemName}" в рюкзак отряда!`, "loot");
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          break;
        }

        case "SLOTS_SPIN": {
          if (!tavernSettings.enabledGames.slots) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Игровой автомат 'Реактор-Слот' временно отключен куратором!", type: "danger" } }));
              return;
            }
          }
          const { playerId, bet } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          const activeClient = clients.get(ws);
          const activeUsername = activeClient ? activeClient.username : "Сталкер";
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на балансе КПК!", type: "danger" } }));
            return;
          }

          profile.balance -= bet;

          const symbols = ["⚙️", "⚙️", "⚙️", "🥫", "🥫", "🍾", "🍾", "💎", "☢️", "💀"];
          const r1 = symbols[Math.floor(Math.random() * symbols.length)];
          const r2 = symbols[Math.floor(Math.random() * symbols.length)];
          const r3 = symbols[Math.floor(Math.random() * symbols.length)];
          const reels = [r1, r2, r3];

          let winMultiplier = 0;
          let combinationName = "Без совпадений";

          if (r1 === r2 && r2 === r3) {
            if (r1 === "☢️") {
              winMultiplier = 15;
              combinationName = "ТРИ РАДИАЦИИ (Генератор Сверхпроводников!) ☢️☢️☢️";
            } else if (r1 === "💎") {
              winMultiplier = 10;
              combinationName = "ТРИ ЗОЛОТЫХ АРТЕФАКТА! 💎💎💎";
            } else if (r1 === "🍾") {
              winMultiplier = 6;
              combinationName = "БАТАРЕЯ ВОДКИ «КАЗАКИ» 🍾🍾🍾";
            } else if (r1 === "🥫") {
              winMultiplier = 4;
              combinationName = "АРМЕЙСКИЙ ЗАПАС СУХПАЙКА 🥫🥫🥫";
            } else if (r1 === "⚙️") {
              winMultiplier = 3;
              combinationName = "НАБОР ОПОРНЫХ БОЛТОВ ⚙️⚙️⚙️";
            } else if (r1 === "💀") {
              winMultiplier = 2.5;
              combinationName = "МЕРТВАЯ ПЕТЛЯ ХАРОНА 💀💀💀";
            }
          } else if (r1 === r2 || r2 === r3 || r1 === r3) {
            const pairSymbol = (r1 === r2 || r1 === r3) ? r1 : r2;
            if (pairSymbol === "☢️") {
              winMultiplier = 1.8;
              combinationName = "Двойная Радиация ☢️";
            } else if (pairSymbol === "💎") {
              winMultiplier = 1.5;
              combinationName = "Два Артефакта 💎";
            } else if (pairSymbol === "🍾") {
              winMultiplier = 1.3;
              combinationName = "Пара Бутылок Водки";
            } else {
              winMultiplier = 1.1;
              combinationName = "Скромная Пара";
            }
          }

          const winAmount = Math.floor(bet * winMultiplier);
          if (winAmount > 0) {
            profile.balance += winAmount;
          }
          savePlayerDb();

          ws.send(JSON.stringify({
            type: "SLOTS_RESULT",
            payload: {
              reels,
              winAmount,
              message: winAmount > 0 
                ? `🎉 ПОБЕДА! Вы выбили [${combinationName}] и выиграли +${formatCredits(winAmount)}!`
                : `💸 Увы! Выпало: ${reels.join(" | ")}. Ни единой зацепки. Попробуйте еще раз!`
            }
          }));

          if (winAmount >= bet * 5) {
            appendSystemMessage(`🎰 Слот-Машина: Сталкер ${activeUsername} сорвал куш в размере ${formatCredits(winAmount)} на автомате («${combinationName}»)!`, "success");
          }

          broadcastTavernGames();
          break;
        }

        case "ROULETTE_SPIN": {
          if (!tavernSettings.enabledGames.roulette) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Военная радар-рулетка временно отключена куратором!", type: "danger" } }));
              return;
            }
          }
          const { playerId, betAmount, betType, betValue } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          const validRouletteBet = (betType === "number" && Number.isInteger(Number(betValue)) && Number(betValue) >= 0 && Number(betValue) <= 36)
            || (betType === "color" && ["red", "black"].includes(betValue))
            || (betType === "parity" && ["even", "odd"].includes(betValue));
          if (!validRouletteBet) {
            sendError(ws, "Некорректный тип или значение ставки в рулетке.");
            return;
          }
          const activeClient = clients.get(ws);
          const activeUsername = activeClient ? activeClient.username : "Сталкер";
          if (profile.balance < betAmount) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на балансе КПК!", type: "danger" } }));
            return;
          }

          profile.balance -= betAmount;

          const winningNumber = Math.floor(Math.random() * 37);
          const getReds = () => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
          const color = winningNumber === 0 ? "green" : getReds().includes(winningNumber) ? "red" : "black";

          let isWin = false;
          let winMultiplier = 0;

          if (betType === "number") {
            if (winningNumber === parseInt(betValue)) {
              isWin = true;
              winMultiplier = 35;
            }
          } else if (betType === "color") {
            if (color === betValue) {
              isWin = true;
              winMultiplier = 2;
            }
          } else if (betType === "parity") {
            if (winningNumber !== 0) {
              const isEven = winningNumber % 2 === 0;
              if (betValue === "even" && isEven) {
                isWin = true;
                winMultiplier = 2;
              } else if (betValue === "odd" && !isEven) {
                isWin = true;
                winMultiplier = 2;
              }
            }
          }

          const winAmount = isWin ? Math.floor(betAmount * winMultiplier) : 0;
          if (winAmount > 0) {
            profile.balance += winAmount;
          }
          savePlayerDb();

          const colorLabel = winningNumber === 0 ? "🟢 ЗЕРО (0)" : color === "red" ? `🔴 КРАСНОЕ (${winningNumber})` : `⚫ ЧЕРНОЕ (${winningNumber})`;
          
          ws.send(JSON.stringify({
            type: "ROULETTE_RESULT",
            payload: {
              winningNumber,
              winningColor: color,
              winAmount,
              message: winAmount > 0 
                ? `🎯 ВЫИГРЫШ! Выпало ${colorLabel}. Ваша ставка принесла вам +${formatCredits(winAmount)}!`
                : `💸 ПРОИГРЫШ! Выпало ${colorLabel}. Удача ускользнула глубоко под радар.`
            }
          }));

          if (winAmount >= betAmount * 5) {
            appendSystemMessage(`🎡 Рулетка: Сталкер ${activeUsername} поставил на "${betValue}" и поднял +${formatCredits(winAmount)} на радар-рулетке! Выпало: ${colorLabel}`, "success");
          }

          broadcastTavernGames();
          break;
        }

        case "SHOOTING_RANGE_FINISH": {
          if (!tavernSettings.enabledGames.shooting) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Стрелковый тир временно опечатан куратором!", type: "danger" } }));
              return;
            }
          }
          const { playerId, bet, score } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (!Number.isSafeInteger(score) || score < 0 || score > 10_000) {
            sendError(ws, "Некорректный результат стрельбы.");
            return;
          }
          const activeClient = clients.get(ws);
          const activeUsername = activeClient ? activeClient.username : "Сталкер";
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на балансе КПК!", type: "danger" } }));
            return;
          }

          profile.balance -= bet;

           let mult = 0;
           let rank = "Новичок";
           if (score >= 250) {
             mult = 1.8;
             rank = "🏆 Легендарный Стрелок";
           } else if (score >= 150) {
             mult = 1.2;
             rank = "🎯 Снайпер Зоны";
           } else if (score >= 80) {
             mult = 0.8;
             rank = "🔫 Меткий Стрелок";
           } else {
             mult = 0;
             rank = "Слепой Окорок (Потренируйтесь ещё!)";
           }

          const winAmount = Math.floor(bet * mult);
          if (winAmount > 0) {
            profile.balance += winAmount;
          }
          savePlayerDb();

          ws.send(JSON.stringify({
            type: "SHOOTING_RANGE_RESULT",
            payload: {
              winAmount,
              message: winAmount > 0
                ? `🎖️ РЕЗУЛЬТАТ: Набрано ${score} очков (Звание: ${rank}). Вы получили выплату +${formatCredits(winAmount)}!`
                : `❌ РЕЗУЛЬТАТ: Набрано ${score} очков. Слишком много промахов (Звание: ${rank}). Ставка ушла бармену.`
            }
          }));

          if (winAmount >= bet * 1.5) {
            appendSystemMessage(`🎯 Тир: Сталкер ${activeUsername} прошел боевую тренировку в Тире с рангом [${rank}] и выиграл +${formatCredits(winAmount)}!`, "success");
          }

          broadcastTavernGames();
          break;
        }

        case "THIMBLERIG_PLAY": {
          if (!tavernSettings.enabledGames.thimblerig) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Напёрстки временно отключены куратором!", type: "danger" } }));
            return;
          }
          const { playerId, bet, chosenCup } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (!Number.isInteger(chosenCup) || chosenCup < 0 || chosenCup > 2) {
            sendError(ws, "Выберите один из трёх напёрстков.");
            return;
          }
          const activeClient = clients.get(ws);
          const activeUsername = activeClient ? activeClient.username : "Сталкер";
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на балансе КПК!", type: "danger" } }));
            return;
          }

          profile.balance -= bet;
          const winningCup = Math.floor(Math.random() * 3);
          const win = chosenCup === winningCup;
          const winAmount = win ? Math.floor(bet * 2.8) : 0;
          if (winAmount > 0) {
            profile.balance += winAmount;
          }
          savePlayerDb();

          ws.send(JSON.stringify({
            type: "THIMBLERIG_RESULT",
            payload: {
              winningCup,
              chosenCup,
              winAmount,
              message: winAmount > 0
                ? `🎉 Кураж! Напёрсточник недоглядел! Шарик под стаканом #${winningCup + 1}. Вы подняли +${formatCredits(winAmount)}!`
                : `💸 Увы! Пусто! Шарик оказался под стаканом #${winningCup + 1}. Попробуйте ещё раз!`
            }
          }));

          if (winAmount >= bet * 2) {
            appendSystemMessage(`🤹 Напёрстки: Сталкер ${activeUsername} обыграл напёрсточника и унёс +${formatCredits(winAmount)}!`, "success");
          }
          broadcastTavernGames();
          break;
        }

        case "SVINYA_START": {
          if (!tavernSettings.enabledGames.svinya) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Карточная игра Свинья временно отключена куратором!", type: "danger" } }));
            return;
          }
          const { playerId, bet } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (activeSvinyaBets[playerId] !== undefined) {
            sendError(ws, "Партия в «Свинью» уже запущена.");
            return;
          }
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "❌ Недостаточно средств на балансе КПК!", type: "danger" } }));
            return;
          }

          profile.balance -= bet;
          activeSvinyaBets[playerId] = bet;
          savePlayerDb();

          ws.send(JSON.stringify({
            type: "SVINYA_START_RESPONSE",
            payload: {
              success: true,
              balance: profile.balance
            }
          }));
          broadcastTavernGames();
          break;
        }

        case "SVINYA_FINISH": {
          const { playerId, result } = payload;
          const profile = playerDb[playerId];
          if (!profile || !["win", "tie", "lose"].includes(result)) return;
          const activeClient = clients.get(ws);
          const activeUsername = activeClient ? activeClient.username : "Сталкер";
          const bet = activeSvinyaBets[playerId];
          if (bet === undefined) {
            sendError(ws, "Активная партия в «Свинью» не найдена.");
            return;
          }

          let winAmount = 0;
          if (result === "win") {
            winAmount = bet * 2;
          } else if (result === "tie") {
            winAmount = bet;
          }

          if (winAmount > 0) {
            profile.balance += winAmount;
          }
          delete activeSvinyaBets[playerId];
          savePlayerDb();

          ws.send(JSON.stringify({
            type: "SVINYA_FINISH_RESPONSE",
            payload: {
              winAmount,
              result,
              balance: profile.balance,
              message: result === "win"
                ? `🏆 Вы обыграли в «Свинью» и забрали +${formatCredits(winAmount)}!`
                : result === "tie"
                ? `🤝 Ничья в «Свинью»! Возвращено ${formatCredits(winAmount)}.`
                : `💸 Вы закончили партию в «Свинью» проигрышем. Ставка ушла бармену.`
            }
          }));

          if (result === "win") {
            appendSystemMessage(`🐷 Свинья: Сталкер ${activeUsername} разложил карты кругом, обыграл Харона и заработал +${formatCredits(winAmount)}!`, "success");
          } else if (result === "lose") {
            appendSystemMessage(`🐷 Свинья: Сталкер ${activeUsername} остался «Свиньёй» в карточной партии и потерял свои ${formatCredits(bet)}.`, "info");
          }

          broadcastTavernGames();
          break;
        }
      }
    } catch (err) {
      console.error("Ошибка при обработке сообщения сокета:", err);
    }
  });

  ws.on("close", () => {
    const player = clients.get(ws);
    if (player) {
      console.log(`Пользователь ${player.username} отключился.`);
      clients.delete(ws);
      delete activeVotes[player.id];
      broadcast("VOTES_UPDATE", { activeVotes, activePlayersCount: getActivePlayersCount() });
      broadcastPlayersList();
    }
  });
});

function broadcastPlayersList() {
  const list = Array.from(clients.values());
  const hasActiveGM = getActiveGMId() !== null;
  broadcast("PLAYERS_UPDATE", { players: list, hasActiveGM });
}

// Set up server assets / Dev server
async function startServer() {
  app.get("/api/profiles", (req, res) => {
    res.json(Object.keys(playerDb));
  });

  // Vite dev server mounting in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n======================================================`);
    console.log(`⭐ STANDALONE ANOMALY ZONE SERVER RUNNING PORT: ${PORT}`);
    console.log(`👉 Access locally inside development preview`);
    console.log(`👉 Access on local network at http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

startServer();
