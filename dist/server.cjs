var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_http = __toESM(require("http"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_ws = require("ws");
var import_vite = require("vite");

// src/utils/random.ts
function createRandomGenerator(seedString) {
  let h = 1779033703 ^ seedString.length;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  let a = (function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  })();
  return function() {
    let t = a += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// src/utils/anomaly-gameplay.ts
var FIELD_EFFECTS = {
  "spore-forest": ["damage", "spread"],
  "druse-growth": ["spread"],
  "gravity-fracture": ["damage", "teleport"],
  "spatial-seam": ["teleport"],
  "thermal-pocket": ["damage"],
  "rust-wave": ["damage", "spread"],
  "eon-storm": ["damage", "teleport", "spread"]
};
function encounterKind(id) {
  if (FIELD_EFFECTS[id]) return "field";
  return ["crystal-resonance", "echo-loop", "static-front", "living-track"].includes(id) ? "puzzle" : "rolls";
}
var RESULT_LABELS = { completeSuccess: "\u041F\u043E\u043B\u043D\u044B\u0439 \u0443\u0441\u043F\u0435\u0445", successWithCost: "\u0423\u0441\u043F\u0435\u0445 \u0441 \u0446\u0435\u043D\u043E\u0439", partialFailure: "\u0427\u0430\u0441\u0442\u0438\u0447\u043D\u0430\u044F \u043D\u0435\u0443\u0434\u0430\u0447\u0430", failure: "\u041D\u0435\u0443\u0434\u0430\u0447\u0430", criticalFailure: "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043D\u0435\u0443\u0434\u0430\u0447\u0430", retreat: "\u041E\u0442\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435" };
var SYMBOLS = ["\u25CF", "\u25B2", "\u25A0", "\u25C6", "\u2605", "\u263E", "\u271A", "\u2B21"];
function shuffle(values, rng) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function encounterSeconds(difficulty) {
  return difficulty <= 3 ? 120 : 60;
}
function rollThreeDice(seed, index) {
  const rng = createRandomGenerator(`${seed}:dice:${index}`);
  return Array.from({ length: 3 }, () => randomInt(rng, 1, 6));
}
function tickAnomalyClock(encounter, enabled) {
  if (encounter.result || encounter.paused || !enabled) return "paused";
  encounter.timeRemaining = Math.max(0, (encounter.timeRemaining ?? 60) - 1);
  return encounter.timeRemaining === 0 ? "expired" : "tick";
}
function createPuzzle(id, seed, difficulty) {
  const rng = createRandomGenerator(`${seed}:puzzle`);
  const p = { kind: "sequence", stage: "study", revision: 0, limit: 3, left: [], right: [], links: [], connected: [], sequence: [], reverse: id === "echo-loop", cursor: 0, size: 0, walls: [], position: 0, goal: 0, visited: [] };
  if (id === "static-front") {
    p.kind = "wires";
    p.stage = "solve";
    const count = difficulty <= 3 ? 4 : 6;
    const symbols = shuffle(SYMBOLS.map((_, i) => i), rng).slice(0, count);
    p.left = shuffle(symbols, rng);
    p.right = shuffle(symbols, rng);
    p.links = shuffle(symbols.map((_, i) => i), rng);
  } else if (id === "living-track") {
    p.kind = "maze";
    p.stage = "solve";
    p.size = difficulty <= 3 ? 7 : 9;
    p.walls = Array(p.size * p.size).fill(1);
    const corners = [p.size + 1, p.size * 2 - 2, p.size * (p.size - 2) + 1, p.size * (p.size - 2) + p.size - 2];
    const startCorner = randomInt(rng, 0, 3);
    p.position = corners[startCorner];
    p.goal = corners[3 - startCorner];
    p.walls[p.position] = 0;
    p.visited = [p.position];
    const stack = [p.position];
    while (stack.length) {
      const current = stack[stack.length - 1], x = current % p.size, y = Math.floor(current / p.size);
      const options = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]], rng).filter(([dx2, dy2]) => x + dx2 > 0 && x + dx2 < p.size - 1 && y + dy2 > 0 && y + dy2 < p.size - 1 && p.walls[(y + dy2) * p.size + x + dx2]);
      if (!options.length) {
        stack.pop();
        continue;
      }
      const [dx, dy] = options[0], next = (y + dy) * p.size + x + dx;
      p.walls[(y + dy / 2) * p.size + x + dx / 2] = 0;
      p.walls[next] = 0;
      stack.push(next);
    }
  } else {
    p.sequence = Array.from({ length: difficulty <= 3 ? 5 : 7 }, () => randomInt(rng, 0, 4));
  }
  return p;
}
function applyPuzzleInput(p, input) {
  if (!input || input.revision !== p.revision) return "ignored";
  const a = input.a, b = input.b;
  let result = "ignored";
  if (p.kind === "sequence" && p.stage === "study" && input.kind === "ready") {
    p.stage = "solve";
    result = "correct";
  } else if (p.kind === "sequence" && p.stage === "solve" && input.kind === "symbol" && Number.isInteger(a) && a >= 0 && a < 5) {
    const expected = p.sequence[p.reverse ? p.sequence.length - 1 - p.cursor : p.cursor];
    if (a === expected) {
      p.cursor++;
      result = p.cursor === p.sequence.length ? "complete" : "correct";
    } else {
      p.cursor = 0;
      result = "mistake";
    }
  } else if (p.kind === "wires" && input.kind === "wire" && Number.isInteger(a) && Number.isInteger(b) && a >= 0 && a < p.left.length && b >= 0 && b < p.right.length && !p.connected.includes(a)) {
    if (p.links[a] === b) {
      p.connected.push(a);
      result = p.connected.length === p.left.length ? "complete" : "correct";
    } else result = "mistake";
  } else if (p.kind === "maze" && input.kind === "step" && Number.isInteger(a) && a >= 0 && a < p.walls.length) {
    const distance = Math.abs(a % p.size - p.position % p.size) + Math.abs(Math.floor(a / p.size) - Math.floor(p.position / p.size));
    if (distance !== 1) return "ignored";
    if (p.walls[a]) result = "mistake";
    else {
      p.position = a;
      if (!p.visited.includes(a)) p.visited.push(a);
      result = p.position === p.goal ? "complete" : "correct";
    }
  }
  if (result !== "ignored") p.revision++;
  return result;
}
function fieldOutcome(id, seed, visit, safeCells, expandableCells) {
  const rng = createRandomGenerator(`${seed}:field:${visit}`), effects = FIELD_EFFECTS[id] || [];
  const damage = effects.includes("damage") ? randomInt(rng, 6, 18) : 0;
  const destination = effects.includes("teleport") && safeCells.length ? safeCells[randomInt(rng, 0, safeCells.length - 1)] : null;
  const candidates = expandableCells.filter((index) => index !== destination);
  return {
    damage,
    destination,
    expansion: effects.includes("spread") && candidates.length ? candidates[randomInt(rng, 0, candidates.length - 1)] : null
  };
}

// src/data/anomalies.ts
var phases = [
  { id: "dormant", label: "\u041F\u043E\u043A\u043E\u0439", description: "\u0417\u0430\u043A\u043E\u043D \u043F\u0440\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u0441\u0432\u0435\u043D\u043D\u044B\u043C\u0438 \u043F\u0440\u0438\u0437\u043D\u0430\u043A\u0430\u043C\u0438.", transition: { minRounds: 1 } },
  { id: "warning", label: "\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435", description: "\u041E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0430\u0435\u0442 \u043E \u0441\u0435\u0431\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u043C\u044B\u043C \u0441\u0438\u0433\u043D\u0430\u043B\u043E\u043C.", transition: { minRounds: 2 } },
  { id: "active", label: "\u0410\u043A\u0442\u0438\u0432\u043D\u0430\u044F", description: "\u0410\u043D\u043E\u043C\u0430\u043B\u0438\u044F \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u043D\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u044D\u043A\u0438\u043F\u0430\u0436\u0430.", transition: { minRounds: 3 } },
  { id: "collapse", label: "\u041A\u043E\u043B\u043B\u0430\u043F\u0441", description: "\u041E\u0448\u0438\u0431\u043A\u0438 \u043D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u044B; \u043E\u0442\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u0431\u043E\u043B\u0435\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E.", transition: { minMistakes: 3, maxStability: 25 } },
  { id: "aftermath", label: "\u041F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u044F", description: "\u0417\u0430\u043A\u043E\u043D \u0437\u0430\u0442\u0438\u0445, \u043E\u0441\u0442\u0430\u0432\u043B\u044F\u044F \u0441\u043B\u0435\u0434\u044B \u0438 \u0434\u043E\u0431\u044B\u0447\u0443.", transition: { onResult: ["completeSuccess", "successWithCost", "partialFailure", "failure", "criticalFailure", "retreat"] } }
];
var accessibility = {
  signals: ["\u0446\u0432\u0435\u0442", "\u0441\u0438\u043C\u0432\u043E\u043B", "\u0444\u043E\u0440\u043C\u0430", "\u0442\u0435\u043A\u0441\u0442", "\u0437\u0432\u0443\u043A \u043F\u0440\u0438 \u0432\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u043E\u043C \u0430\u0443\u0434\u0438\u043E"],
  timerOptional: true,
  gmPause: true,
  keyboard: true,
  speedControl: true,
  rollAutoResolve: true,
  skipAnimation: true
};
var consequences = (theme) => ({
  successWithCost: [`\u0423\u0441\u0442\u0430\u043B\u043E\u0441\u0442\u044C, \u0441\u0442\u0440\u0435\u0441\u0441 \u0438\u043B\u0438 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u044D\u0444\u0444\u0435\u043A\u0442: ${theme}.`],
  partialFailure: [`\u041D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043D\u0430\u044F \u044D\u043A\u0441\u043F\u043E\u0437\u0438\u0446\u0438\u044F \u0438 \u043F\u043E\u043C\u0435\u0445\u0430: ${theme}; \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u043B\u0435\u0447\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435.`],
  failure: [`\u0421\u0435\u0440\u044C\u0451\u0437\u043D\u0430\u044F, \u043D\u043E \u043E\u0431\u0440\u0430\u0442\u0438\u043C\u0430\u044F \u0442\u0440\u0430\u0432\u043C\u0430 \u043B\u0438\u0431\u043E \u0437\u0430\u0440\u0430\u0436\u0435\u043D\u0438\u0435: ${theme}.`],
  criticalFailure: [`\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435 \u043F\u043E\u0441\u043B\u0435 \u043D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043D\u044B\u0445 \u043E\u0448\u0438\u0431\u043E\u043A \u0438\u043B\u0438 \u043A\u043E\u043B\u043B\u0430\u043F\u0441\u0430: ${theme}.`]
});
var train = (systems, theme) => ({
  affectedTrainSystems: systems,
  affectedWagons: ["\u043B\u043E\u043A\u043E\u043C\u043E\u0442\u0438\u0432 \u0438\u043B\u0438 \u0431\u043B\u0438\u0436\u0430\u0439\u0448\u0438\u0439 \u043A \u043E\u0447\u0430\u0433\u0443 \u0432\u0430\u0433\u043E\u043D", "\u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0432\u0430\u0433\u043E\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 \u0440\u0430\u0441\u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u0438/\u043A\u043E\u043B\u043B\u0430\u043F\u0441\u0435"],
  speedInteraction: `\u0421\u043D\u0438\u0436\u0435\u043D\u0438\u0435 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 \u0443\u043C\u0435\u043D\u044C\u0448\u0430\u0435\u0442 \u0440\u0438\u0441\u043A; \u0440\u0435\u0437\u043A\u0438\u0439 \u0440\u0430\u0437\u0433\u043E\u043D \u0443\u0441\u0438\u043B\u0438\u0432\u0430\u0435\u0442 ${theme}.`,
  fuelInteraction: "\u0420\u0430\u0441\u0445\u043E\u0434 \u0442\u043E\u043F\u043B\u0438\u0432\u0430 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 \u043C\u0430\u043D\u0451\u0432\u0440\u0435, \u043E\u0431\u0445\u043E\u0434\u0435 \u0438\u043B\u0438 \u0430\u0432\u0430\u0440\u0438\u0439\u043D\u043E\u043C \u0442\u043E\u0440\u043C\u043E\u0436\u0435\u043D\u0438\u0438.",
  powerInteraction: "\u0421\u0438\u0441\u0442\u0435\u043C\u0443 \u043C\u043E\u0436\u043D\u043E \u043E\u0431\u0435\u0441\u0442\u043E\u0447\u0438\u0442\u044C \u0438 \u0438\u0437\u043E\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0434\u043E \u043F\u0440\u043E\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u043E\u0447\u0430\u0433\u0430.",
  cargoInteraction: "\u041E\u043F\u0430\u0441\u043D\u044B\u0439 \u0433\u0440\u0443\u0437 \u043C\u043E\u0436\u043D\u043E \u0441\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0432 \u0438\u0437\u043E\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0432\u0430\u0433\u043E\u043D.",
  possibleTemporaryFaults: [`\u0412\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u043E\u0442\u043A\u0430\u0437: ${theme}`, "\u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438", "\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0435 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u044B"],
  possiblePermanentFaults: [`\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0443\u0437\u043B\u0430 \u043F\u043E\u0441\u043B\u0435 \u043A\u043E\u043B\u043B\u0430\u043F\u0441\u0430: ${theme}`],
  repairOptions: ["\u0438\u0437\u043E\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0430\u0433\u043E\u043D", "\u043E\u0431\u0435\u0441\u0442\u043E\u0447\u0438\u0442\u044C \u0441\u0438\u0441\u0442\u0435\u043C\u0443", "\u0441\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0433\u0440\u0443\u0437", "\u043F\u043E\u043B\u0435\u0432\u043E\u0439 \u0440\u0435\u043C\u043E\u043D\u0442: \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u043E\u0435 \u0434\u0435\u043B\u043E \u0438\u043B\u0438 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430", "\u043E\u0442\u0441\u0442\u0443\u043F\u0438\u0442\u044C \u0434\u043E \u043A\u043E\u043B\u043B\u0430\u043F\u0441\u0430"]
});
var rollActions = [
  { id: "observe", label: "\u0418\u0437\u0443\u0447\u0438\u0442\u044C \u0437\u0430\u043A\u043E\u043D", description: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u043C\u044B\u0439 \u0441\u0438\u0433\u043D\u0430\u043B \u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0443.", kind: "observe", skillTags: ["observation", "research"], stabilityDelta: 4 },
  { id: "probe", label: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0433\u0438\u043F\u043E\u0442\u0435\u0437\u0443", description: "\u041E\u0441\u0442\u043E\u0440\u043E\u0436\u043D\u043E\u0435 \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043F\u043E\u0441\u043B\u0435 \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u044F.", kind: "interact", skillTags: ["physics", "engineering"], advances: true, stabilityDelta: 12, exposureDelta: 5 },
  { id: "isolate", label: "\u0418\u0437\u043E\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0443\u0447\u0430\u0441\u0442\u043E\u043A", description: "\u0417\u0430\u0449\u0438\u0442\u0438\u0442\u044C \u043B\u044E\u0434\u0435\u0439 \u0438\u043B\u0438 \u043E\u0434\u0438\u043D \u0432\u0430\u0433\u043E\u043D \u043E\u0442 \u0440\u0430\u0441\u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u044F.", kind: "protect", skillTags: ["engineering", "mechanic"], trainRiskDelta: -12 },
  { id: "retreat", label: "\u041E\u0442\u0441\u0442\u0443\u043F\u0438\u0442\u044C", description: "\u041F\u043E\u043A\u0438\u043D\u0443\u0442\u044C \u043E\u0431\u043B\u0430\u0441\u0442\u044C \u0434\u043E \u043A\u043E\u043B\u043B\u0430\u043F\u0441\u0430.", kind: "retreat" }
];
function definition(input) {
  const skillTags = input.gurpsResolution?.allowedSkillTags || ["observation", "survival", "research"];
  return {
    encounterType: encounterKind(input.id),
    fieldEffects: FIELD_EFFECTS[input.id] || [],
    id: input.id,
    name: input.name,
    description: input.description,
    canonStatus: input.canonStatus,
    family: input.family,
    dangerTier: input.dangerTier,
    tags: input.tags || [input.family, "eon", "investigation"],
    supportedModes: input.supportedModes || ["exploration", "train-travel", "research"],
    warningSigns: input.warningSigns,
    detection: input.detection || { skillTags, clues: input.warningSigns, passiveSignal: input.warningSigns[0] },
    phases: input.phases || phases,
    minigame: input.minigame || { implementation: "gurps-placeholder", kind: "gurps-series", law: "\u0417\u0430\u043A\u043E\u043D \u0432\u044B\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0435\u043C \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u043E\u0439 \u0433\u0438\u043F\u043E\u0442\u0435\u0437.", actions: rollActions, targetProgress: 3, maxMistakes: 3 },
    gurpsResolution: input.gurpsResolution || { requiredSuccesses: 3, allowedSkillTags: skillTags, defaultPenalty: -2, criticalSuccessMayAutoResolve: false },
    counters: input.counters || ["\u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0435", "\u0438\u0437\u043E\u043B\u044F\u0446\u0438\u044F", "\u043C\u0435\u0434\u043B\u0435\u043D\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0438\u0440\u0443\u0435\u043C\u044B\u0439 \u043F\u0440\u043E\u0445\u043E\u0434", "\u043E\u0442\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435"],
    characterConsequences: input.characterConsequences || consequences(input.name),
    trainConsequences: input.trainConsequences || train(["\u0434\u0430\u0442\u0447\u0438\u043A\u0438", "\u0445\u043E\u0434\u043E\u0432\u0430\u044F \u0447\u0430\u0441\u0442\u044C"], input.name),
    rewards: input.rewards || ["\u043E\u0431\u0440\u0430\u0437\u0435\u0446 \u0430\u043D\u043E\u043C\u0430\u043B\u044C\u043D\u043E\u0439 \u043C\u0430\u0442\u0435\u0440\u0438\u0438", "\u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435", "\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u0431\u043E\u043D\u0443\u0441 \u043A \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u043C\u0443 \u043F\u0440\u043E\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044E"],
    rollTables: input.rollTables || { complications: ["\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u043E\u043C\u0435\u0445\u0430", "\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C", "\u0440\u043E\u0441\u0442 \u044D\u043A\u0441\u043F\u043E\u0437\u0438\u0446\u0438\u0438"], rewards: ["\u0447\u0438\u0441\u0442\u044B\u0439 \u043E\u0431\u0440\u0430\u0437\u0435\u0446", "\u0440\u0435\u0434\u043A\u0438\u0439 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442", "\u043D\u0430\u0434\u0451\u0436\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u0430 \u043F\u0440\u043E\u0445\u043E\u0434\u0430"] },
    accessibility: input.accessibility || accessibility,
    gmNotes: input.gmNotes || ["\u041D\u0435 \u0441\u043A\u0440\u044B\u0432\u0430\u0439\u0442\u0435 \u043F\u0435\u0440\u0432\u044B\u0439 \u0441\u0438\u0433\u043D\u0430\u043B \u0443\u0433\u0440\u043E\u0437\u044B.", "\u041D\u0435 \u043C\u0435\u043D\u044F\u0439\u0442\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0439 \u0437\u0430\u043A\u043E\u043D \u0432 \u0445\u043E\u0434\u0435 \u0441\u0446\u0435\u043D\u044B.", "\u041E\u0431\u044B\u0447\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u043D\u0435 \u0443\u0431\u0438\u0432\u0430\u0435\u0442 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 \u0438 \u043D\u0435 \u0443\u043D\u0438\u0447\u0442\u043E\u0436\u0430\u0435\u0442 \u0432\u0430\u0433\u043E\u043D."]
  };
}
var full = (id, name, status, family, dangerTier, description, warningSigns, kind, law, actions, skills, systems) => definition({
  id,
  name,
  canonStatus: status,
  family,
  dangerTier,
  description,
  warningSigns,
  detection: { skillTags: skills, clues: warningSigns, passiveSignal: warningSigns[0] },
  minigame: { implementation: "full", kind, law, actions, targetProgress: 3, maxMistakes: 3, sequenceLength: kind.includes("sequence") || kind.includes("pattern") ? 3 : void 0 },
  gurpsResolution: { requiredSuccesses: 3, allowedSkillTags: skills, defaultPenalty: -dangerTier + 1, criticalSuccessMayAutoResolve: false },
  trainConsequences: train(systems, name)
});
var ANOMALY_DEFINITIONS = [
  full("spore-forest", "\u0421\u043F\u043E\u0440\u043E\u0432\u044B\u0439 \u043B\u0435\u0441", "canon", "biological", 3, "\u041A\u043E\u043B\u043E\u043D\u0438\u044F \u0440\u0435\u0430\u0433\u0438\u0440\u0443\u0435\u0442 \u043D\u0430 \u0440\u0438\u0442\u043C \u0432\u043E\u0437\u0434\u0443\u0445\u0430 \u0438 \u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438, \u0430 \u043D\u0435 \u043D\u0430 \u0441\u0430\u043C\u043E \u043F\u0440\u0438\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435.", ["\u25C9 \u0421\u043F\u043E\u0440\u044B \u043F\u0443\u043B\u044C\u0441\u0438\u0440\u0443\u044E\u0442 \u0432\u043E\u043B\u043D\u0430\u043C\u0438 \u043E\u0442 \u043F\u043E\u0440\u044B\u0432\u043E\u0432 \u0432\u043E\u0437\u0434\u0443\u0445\u0430.", "\u25B3 \u0422\u0438\u0445\u0438\u0435 \u0443\u0447\u0430\u0441\u0442\u043A\u0438 \u043C\u0438\u0446\u0435\u043B\u0438\u044F \u0432\u0442\u044F\u0433\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u043F\u0435\u0440\u0435\u0434 \u0432\u044B\u0431\u0440\u043E\u0441\u043E\u043C.", "\u0422\u0435\u043A\u0441\u0442: \u043F\u043E\u0441\u043B\u0435 \u0448\u0443\u043C\u0430 \u0441\u043B\u0435\u0434\u0443\u0435\u0442 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u0430\u044F \u043F\u0430\u0443\u0437\u0430."], "law-cycle", "\u041F\u043E\u0441\u043B\u0435 \u0437\u0430\u043C\u0435\u0442\u043D\u043E\u0433\u043E \u0432\u0434\u043E\u0445\u0430 \u043A\u043E\u043B\u043E\u043D\u0438\u0438 \u043D\u0430\u0441\u0442\u0443\u043F\u0430\u0435\u0442 \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u0435 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0435 \u043E\u043A\u043D\u043E; \u043E\u0433\u043E\u043D\u044C \u0431\u0435\u0437 \u0438\u0437\u043E\u043B\u044F\u0446\u0438\u0438 \u0432\u044B\u0437\u044B\u0432\u0430\u0435\u0442 \u043E\u0431\u0449\u0438\u0439 \u0432\u044B\u0431\u0440\u043E\u0441.", [
    { id: "watch-breath", label: "\u041D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u044C \u0434\u044B\u0445\u0430\u043D\u0438\u0435", description: "\u041E\u0442\u0441\u043B\u0435\u0434\u0438\u0442\u044C \u0432\u0442\u044F\u0433\u0438\u0432\u0430\u043D\u0438\u0435 \u043C\u0438\u0446\u0435\u043B\u0438\u044F \u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0435 \u043E\u043A\u043D\u043E.", kind: "observe", clue: "\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u2014 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0441\u043B\u0435 \u0432\u0442\u044F\u0433\u0438\u0432\u0430\u043D\u0438\u044F \u0441\u043F\u043E\u0440.", skillTags: ["observation", "biology"], stabilityDelta: 5 },
    { id: "seal-vents", label: "\u0413\u0435\u0440\u043C\u0435\u0442\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u044E", description: "\u0417\u0430\u0449\u0438\u0442\u0438\u0442\u044C \u0432\u0430\u0433\u043E\u043D \u0438 \u0441\u043D\u0438\u0437\u0438\u0442\u044C \u0437\u0430\u0440\u0430\u0436\u0435\u043D\u0438\u0435.", kind: "protect", skillTags: ["engineering", "biology"], contaminationDelta: -15, trainRiskDelta: -10 },
    { id: "cross-on-lull", label: "\u041F\u0440\u043E\u0439\u0442\u0438 \u0432 \u043F\u0430\u0443\u0437\u0443", description: "\u0414\u0432\u0438\u0433\u0430\u0442\u044C\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0435 \u0442\u0438\u0445\u043E\u0435 \u043E\u043A\u043D\u043E.", kind: "interact", skillTags: ["survival", "driving-locomotive"], advances: true, stabilityDelta: 18, exposureDelta: 4 },
    { id: "burn", label: "\u0412\u044B\u0436\u0435\u0447\u044C \u043A\u043E\u0440\u0438\u0434\u043E\u0440", description: "\u0414\u043E\u0431\u0440\u043E\u0432\u043E\u043B\u044C\u043D\u044B\u0439 \u0440\u0438\u0441\u043A: \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043B\u0438\u0448\u044C \u043F\u043E\u0441\u043B\u0435 \u0433\u0435\u0440\u043C\u0435\u0442\u0438\u0437\u0430\u0446\u0438\u0438.", kind: "train", skillTags: ["chemistry", "engineering"], advances: true, stabilityDelta: 25, contaminationDelta: 8, trainRiskDelta: 8 },
    { id: "retreat", label: "\u041E\u0442\u0441\u0442\u0443\u043F\u0438\u0442\u044C", description: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u043F\u043E \u0447\u0438\u0441\u0442\u043E\u043C\u0443 \u0441\u043B\u0435\u0434\u0443 \u0434\u043E \u043A\u043E\u043B\u043B\u0430\u043F\u0441\u0430.", kind: "retreat" }
  ], ["observation", "biology", "survival", "chemistry", "engineering", "first-aid", "driving-locomotive"], ["\u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u044F", "\u0444\u0438\u043B\u044C\u0442\u0440\u044B", "\u0433\u0440\u0443\u0437\u043E\u0432\u043E\u0439 \u043E\u0442\u0441\u0435\u043A"]),
  full("crystal-resonance", "\u041A\u0440\u0438\u0441\u0442\u0430\u043B\u043B\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0440\u0435\u0437\u043E\u043D\u0430\u043D\u0441", "canon", "crystalline", 3, "\u041A\u0440\u0438\u0441\u0442\u0430\u043B\u043B\u044B \u043E\u0442\u0432\u0435\u0447\u0430\u044E\u0442 \u043D\u0430 \u0447\u0430\u0441\u0442\u043E\u0442\u044B \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0442 \u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u0443\u044E \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0438\u043C\u043F\u0443\u043B\u044C\u0441\u043E\u0432.", ["\u25C7 \u0413\u0440\u0430\u043D\u0438 \u0432\u0441\u043F\u044B\u0445\u0438\u0432\u0430\u044E\u0442 \u043D\u0435\u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E\u0439 \u0442\u0440\u0451\u0445\u0447\u0430\u0441\u0442\u043D\u043E\u0439 \u0441\u0435\u0440\u0438\u0435\u0439.", "\u266A \u041F\u0435\u0440\u0435\u0434 \u0432\u044B\u0431\u0440\u043E\u0441\u043E\u043C \u0441\u043B\u044B\u0448\u0435\u043D \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0449\u0438\u0439 \u043E\u0431\u0435\u0440\u0442\u043E\u043D.", "\u0422\u0435\u043A\u0441\u0442: \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u0430\u044F \u0447\u0430\u0441\u0442\u043E\u0442\u0430 \u0432\u0441\u0435\u0433\u0434\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u0441\u043B\u0430\u0431\u044B\u0439 \u0438\u043C\u043F\u0443\u043B\u044C\u0441."], "resonance-sequence", "\u0421\u043B\u0430\u0431\u0430\u044F \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u043E\u0439; \u043E\u0442\u0432\u0435\u0442 \u0432 \u0442\u043E\u0439 \u0436\u0435 \u0447\u0430\u0441\u0442\u043E\u0442\u0435 \u0433\u0430\u0441\u0438\u0442 \u0443\u0437\u0435\u043B, \u043D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0447\u0430\u0441\u0442\u043E\u0442\u0430 \u0443\u0441\u0438\u043B\u0438\u0432\u0430\u0435\u0442 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0438\u043C\u043F\u0443\u043B\u044C\u0441.", [
    { id: "listen", label: "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0438\u043C\u043F\u0443\u043B\u044C\u0441", description: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0441\u0438\u043C\u0432\u043E\u043B \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438.", kind: "observe", clue: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u043D\u0443\u044E \u0447\u0430\u0441\u0442\u043E\u0442\u0443: \u043D\u0438\u0437\u043A\u0430\u044F, \u0441\u0440\u0435\u0434\u043D\u044F\u044F \u0438\u043B\u0438 \u0432\u044B\u0441\u043E\u043A\u0430\u044F.", skillTags: ["physics", "electronics-sensors"], stabilityDelta: 4 },
    { id: "tone-low", label: "\u041D\u0438\u0437\u043A\u0430\u044F \u0447\u0430\u0441\u0442\u043E\u0442\u0430 \u2582", description: "\u041E\u0442\u0432\u0435\u0442\u0438\u0442\u044C \u043D\u0438\u0437\u043A\u0438\u043C \u0442\u043E\u043D\u043E\u043C.", kind: "interact", advances: true },
    { id: "tone-mid", label: "\u0421\u0440\u0435\u0434\u043D\u044F\u044F \u0447\u0430\u0441\u0442\u043E\u0442\u0430 \u2585", description: "\u041E\u0442\u0432\u0435\u0442\u0438\u0442\u044C \u0441\u0440\u0435\u0434\u043D\u0438\u043C \u0442\u043E\u043D\u043E\u043C.", kind: "interact", advances: true },
    { id: "tone-high", label: "\u0412\u044B\u0441\u043E\u043A\u0430\u044F \u0447\u0430\u0441\u0442\u043E\u0442\u0430 \u2587", description: "\u041E\u0442\u0432\u0435\u0442\u0438\u0442\u044C \u0432\u044B\u0441\u043E\u043A\u0438\u043C \u0442\u043E\u043D\u043E\u043C.", kind: "interact", advances: true },
    { id: "dampen", label: "\u041F\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0434\u0435\u043C\u043F\u0444\u0435\u0440\u044B", description: "\u0421\u043D\u0438\u0437\u0438\u0442\u044C \u0440\u0438\u0441\u043A \u0434\u043B\u044F \u043A\u043E\u0440\u043F\u0443\u0441\u0430 \u043F\u0440\u0438 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u043E\u0448\u0438\u0431\u043A\u0435.", kind: "protect", skillTags: ["engineering", "mechanic"], trainRiskDelta: -15 },
    { id: "retreat", label: "\u041E\u0442\u0441\u0442\u0443\u043F\u0438\u0442\u044C", description: "\u0412\u044B\u0439\u0442\u0438 \u0438\u0437 \u0440\u0435\u0437\u043E\u043D\u0430\u043D\u0441\u043D\u043E\u0439 \u0437\u043E\u043D\u044B \u0434\u043E \u043A\u043E\u043B\u043B\u0430\u043F\u0441\u0430.", kind: "retreat" }
  ], ["observation", "physics", "electronics-sensors", "engineering", "research"], ["\u043A\u043E\u0440\u043F\u0443\u0441", "\u0441\u0442\u0435\u043A\u043B\u043E", "\u0434\u0430\u0442\u0447\u0438\u043A\u0438", "\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u044F \u0433\u0440\u0443\u0437\u0430"]),
  full("echo-loop", "\u042D\u0445\u043E-\u043F\u0435\u0442\u043B\u044F", "canon-compatible", "echo", 3, "\u041F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442 \u0446\u0435\u043F\u043E\u0447\u043A\u0443 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 \u0441 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u043E\u0439.", ["\u21BB \u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0437\u0432\u0443\u043A \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044F \u0442\u0435\u043C \u0436\u0435 \u0440\u0438\u0442\u043C\u043E\u043C.", "\u25A1 \u0421\u043B\u0435\u0434\u044B \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u0432 \u043F\u0440\u0435\u0436\u043D\u0438\u0445 \u043C\u0435\u0441\u0442\u0430\u0445.", "\u0422\u0435\u043A\u0441\u0442: \u043F\u0435\u0442\u043B\u044F \u043A\u043E\u043F\u0438\u0440\u0443\u0435\u0442 \u043F\u043E\u0440\u044F\u0434\u043E\u043A, \u043D\u043E \u043D\u0435 \u043D\u0430\u043C\u0435\u0440\u0435\u043D\u0438\u0435."], "echo-pattern", "\u041F\u0435\u0442\u043B\u044F \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E \u0440\u0430\u0437\u043C\u044B\u043A\u0430\u0435\u0442\u0441\u044F \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u043B\u043E\u0436\u043D\u043E\u0439 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C\u044E \u043A \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u043C\u043E\u043C\u0443 \u044D\u0445\u0443.", [
    { id: "record-echo", label: "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u044D\u0445\u043E", description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u043C\u043E\u0433\u043E \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u0430.", kind: "observe", clue: "\u0420\u0430\u0437\u043C\u044B\u043A\u0430\u0439\u0442\u0435 \u043F\u0435\u0442\u043B\u044E \u0432 \u043E\u0431\u0440\u0430\u0442\u043D\u043E\u043C \u043F\u043E\u0440\u044F\u0434\u043A\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u043D\u044B\u0445 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.", skillTags: ["observation", "physics"], stabilityDelta: 4 },
    { id: "echo-a", label: "\u0421\u0438\u0433\u043D\u0430\u043B \u25CB", description: "\u0412\u0432\u0435\u0441\u0442\u0438 \u043A\u0440\u0443\u0433\u043E\u0432\u043E\u0439 \u0441\u0438\u0433\u043D\u0430\u043B.", kind: "interact", advances: true },
    { id: "echo-b", label: "\u0421\u0438\u0433\u043D\u0430\u043B \u25B3", description: "\u0412\u0432\u0435\u0441\u0442\u0438 \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u044B\u0439 \u0441\u0438\u0433\u043D\u0430\u043B.", kind: "interact", advances: true },
    { id: "echo-c", label: "\u0421\u0438\u0433\u043D\u0430\u043B \u25A1", description: "\u0412\u0432\u0435\u0441\u0442\u0438 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u044B\u0439 \u0441\u0438\u0433\u043D\u0430\u043B.", kind: "interact", advances: true },
    { id: "anchor", label: "\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u044F\u043A\u043E\u0440\u044C", description: "\u041F\u0440\u043E\u0441\u0442\u0438\u0442\u044C \u043E\u0434\u043D\u0443 \u043E\u0448\u0438\u0431\u043A\u0443 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438.", kind: "protect", skillTags: ["navigation", "engineering"], exposureDelta: -10 },
    { id: "retreat", label: "\u041E\u0442\u0441\u0442\u0443\u043F\u0438\u0442\u044C", description: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u043F\u0443\u0442\u044C \u0434\u043E \u043A\u043E\u043B\u043B\u0430\u043F\u0441\u0430.", kind: "retreat" }
  ], ["observation", "navigation", "physics", "research"], ["\u0445\u0440\u043E\u043D\u043E\u043C\u0435\u0442\u0440", "\u0441\u0432\u044F\u0437\u044C \u0432\u043D\u0443\u0442\u0440\u0438 \u043F\u043E\u0435\u0437\u0434\u0430", "\u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F"]),
  full("static-front", "\u0421\u0442\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0444\u0440\u043E\u043D\u0442", "recommended", "electrical", 4, "\u0417\u0430\u0440\u044F\u0434 \u0438\u0434\u0451\u0442 \u043F\u043E \u043D\u0430\u0438\u0431\u043E\u043B\u0435\u0435 \u043F\u0440\u043E\u0432\u043E\u0434\u044F\u0449\u0435\u043C\u0443 \u043D\u0435\u043F\u0440\u0435\u0440\u044B\u0432\u043D\u043E\u043C\u0443 \u043F\u0443\u0442\u0438 \u0438 \u0437\u0430\u0440\u0430\u043D\u0435\u0435 \u043E\u0442\u043C\u0435\u0447\u0430\u0435\u0442 \u0435\u0433\u043E \u043A\u043E\u0440\u043E\u043D\u043D\u044B\u043C \u0441\u0432\u0435\u0447\u0435\u043D\u0438\u0435\u043C.", ["\u03DF \u041D\u0430 \u043E\u0441\u0442\u0440\u044B\u0445 \u0434\u0435\u0442\u0430\u043B\u044F\u0445 \u0432\u043E\u0437\u043D\u0438\u043A\u0430\u0435\u0442 \u043A\u043E\u0440\u043E\u043D\u043D\u043E\u0435 \u0441\u0432\u0435\u0447\u0435\u043D\u0438\u0435.", "\u23DA \u0417\u0435\u043C\u043B\u044F \u0438 \u043C\u043E\u043A\u0440\u044B\u0439 \u043C\u0435\u0442\u0430\u043B\u043B \u0433\u0443\u0434\u044F\u0442 \u043F\u0435\u0440\u0435\u0434 \u0440\u0430\u0437\u0440\u044F\u0434\u043E\u043C.", "\u0422\u0435\u043A\u0441\u0442: \u044F\u0440\u0447\u0435 \u0432\u0441\u0435\u0433\u043E \u0441\u0432\u0435\u0442\u0438\u0442\u0441\u044F \u0431\u0443\u0434\u0443\u0449\u0438\u0439 \u043F\u0443\u0442\u044C \u0442\u043E\u043A\u0430."], "network-routing", "\u041D\u0443\u0436\u043D\u043E \u0440\u0430\u0437\u043E\u0440\u0432\u0430\u0442\u044C \u043F\u0440\u043E\u0432\u043E\u0434\u044F\u0449\u0438\u0439 \u043F\u0443\u0442\u044C, \u0437\u0430\u0437\u0435\u043C\u043B\u0438\u0442\u044C \u0444\u0440\u043E\u043D\u0442 \u0438 \u043F\u0440\u043E\u0432\u0435\u0441\u0442\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437\u043E\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0443\u0437\u0435\u043B.", [
    { id: "scan-conductors", label: "\u041F\u0440\u043E\u0441\u043B\u0435\u0434\u0438\u0442\u044C \u0444\u0440\u043E\u043D\u0442", description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043E\u043F\u0430\u0441\u043D\u044B\u0439 \u043F\u0440\u043E\u0432\u043E\u0434\u044F\u0449\u0438\u0439 \u0443\u0437\u0435\u043B.", kind: "observe", clue: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0438\u0437\u043E\u043B\u0438\u0440\u0443\u0439\u0442\u0435 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u044B\u0439 \u0443\u0437\u0435\u043B, \u0437\u0430\u0442\u0435\u043C \u0437\u0430\u0437\u0435\u043C\u043B\u0438\u0442\u0435 \u0444\u0440\u043E\u043D\u0442.", skillTags: ["electronics-sensors", "physics"], stabilityDelta: 4 },
    { id: "isolate-node", label: "\u0418\u0437\u043E\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0443\u0437\u0435\u043B", description: "\u0420\u0430\u0437\u043E\u0440\u0432\u0430\u0442\u044C \u043F\u043E\u0434\u0441\u0432\u0435\u0447\u0435\u043D\u043D\u044B\u0439 \u043F\u0440\u043E\u0432\u043E\u0434\u044F\u0449\u0438\u0439 \u043F\u0443\u0442\u044C.", kind: "protect", skillTags: ["electronics-sensors", "engineering"], advances: true, trainRiskDelta: -15 },
    { id: "ground-front", label: "\u0417\u0430\u0437\u0435\u043C\u043B\u0438\u0442\u044C \u0444\u0440\u043E\u043D\u0442", description: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043D\u044B\u0439 \u0437\u0430\u0440\u044F\u0434 \u043F\u043E\u0441\u043B\u0435 \u0438\u0437\u043E\u043B\u044F\u0446\u0438\u0438.", kind: "interact", skillTags: ["electronics-sensors", "engineering"], advances: true, stabilityDelta: 15 },
    { id: "cross-front", label: "\u041F\u0440\u043E\u0432\u0435\u0441\u0442\u0438 \u0438\u0437\u043E\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0443\u0437\u0435\u043B", description: "\u041F\u0440\u043E\u0439\u0442\u0438 \u0444\u0440\u043E\u043D\u0442 \u043F\u043E\u0441\u043B\u0435 \u0440\u0430\u0437\u0440\u044B\u0432\u0430 \u043F\u0443\u0442\u0438 \u0438 \u0437\u0430\u0437\u0435\u043C\u043B\u0435\u043D\u0438\u044F.", kind: "train", skillTags: ["driving-locomotive", "engineering"], advances: true, trainRiskDelta: 5 },
    { id: "power-down", label: "\u041E\u0431\u0435\u0441\u0442\u043E\u0447\u0438\u0442\u044C \u0432\u0430\u0433\u043E\u043D", description: "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u044F \u043E\u0448\u0438\u0431\u043A\u0438 \u0446\u0435\u043D\u043E\u0439 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0433\u043E \u043E\u0442\u043A\u0430\u0437\u0430.", kind: "train", trainRiskDelta: -20 },
    { id: "retreat", label: "\u041E\u0442\u0441\u0442\u0443\u043F\u0438\u0442\u044C", description: "\u041E\u0442\u043A\u0430\u0442\u0438\u0442\u044C\u0441\u044F \u0434\u043E \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u043A\u043E\u0440\u043E\u043D\u043D\u043E\u0433\u043E \u0441\u0432\u0435\u0447\u0435\u043D\u0438\u044F.", kind: "retreat" }
  ], ["observation", "physics", "electronics-sensors", "engineering", "mechanic"], ["\u044D\u043D\u0435\u0440\u0433\u043E\u0441\u0435\u0442\u044C", "\u0440\u0430\u0434\u0438\u043E\u0441\u0432\u044F\u0437\u044C", "\u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043B\u043E\u043A\u043E\u043C\u043E\u0442\u0438\u0432\u043E\u043C"]),
  full("living-track", "\u0416\u0438\u0432\u043E\u0439 \u043F\u0443\u0442\u044C", "recommended", "railway", 4, "\u0420\u0435\u043B\u044C\u0441\u044B \u043F\u0435\u0440\u0435\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0432\u0441\u043B\u0435\u0434 \u0437\u0430 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u043E\u0439; \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u0430\u044F \u0432\u0435\u0442\u043A\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0440\u0435\u0430\u043B\u044C\u043D\u043E\u0435 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0434\u043E \u043D\u0430\u0435\u0437\u0434\u0430.", ["\u224B \u041D\u0435\u043D\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0435 \u0440\u0435\u043B\u044C\u0441\u044B \u043C\u0435\u0434\u043B\u0435\u043D\u043D\u043E \u0438\u0437\u0433\u0438\u0431\u0430\u044E\u0442\u0441\u044F.", "\u21C6 \u0421\u0442\u0440\u0435\u043B\u043A\u0438 \u0434\u0451\u0440\u0433\u0430\u044E\u0442\u0441\u044F \u0432 \u0441\u0442\u043E\u0440\u043E\u043D\u0443 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0439 \u0432\u0435\u0442\u043A\u0438.", "\u0422\u0435\u043A\u0441\u0442: \u043F\u0443\u0442\u044C \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0441\u043B\u0435 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0430 \u0432\u0435\u0441\u0430."], "track-routing", "\u0420\u0430\u0437\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0432\u0435\u0434\u0443\u0449\u0443\u044E \u043E\u0441\u044C, \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u0432\u0435\u0442\u043A\u0443 \u0438 \u043F\u0440\u043E\u0445\u043E\u0434\u0438\u0442\u0435 \u043D\u0430 \u043C\u0430\u043B\u043E\u0439 \u0442\u044F\u0433\u0435 \u0431\u0435\u0437 \u0440\u0435\u0437\u043A\u043E\u0433\u043E \u0442\u043E\u0440\u043C\u043E\u0436\u0435\u043D\u0438\u044F.", [
    { id: "inspect-switch", label: "\u041D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u044C \u0441\u0442\u0440\u0435\u043B\u043A\u0438", description: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0435\u0442\u043A\u0443, \u043A\u043E\u0442\u043E\u0440\u0430\u044F \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0439 \u043F\u043E\u0434 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u043E\u0439.", kind: "observe", clue: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0440\u0430\u0437\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u043E\u0441\u044C, \u0437\u0430\u0442\u0435\u043C \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0439\u0442\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u043D\u0443\u044E \u0432\u0435\u0442\u043A\u0443.", skillTags: ["observation", "mechanic", "driving-locomotive"], stabilityDelta: 4 },
    { id: "unload-axle", label: "\u0420\u0430\u0437\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0432\u0435\u0434\u0443\u0449\u0443\u044E \u043E\u0441\u044C", description: "\u041F\u0435\u0440\u0435\u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0433\u0440\u0443\u0437 \u043F\u0435\u0440\u0435\u0434 \u0444\u0438\u043A\u0441\u0430\u0446\u0438\u0435\u0439 \u043F\u0443\u0442\u0438.", kind: "train", skillTags: ["mechanic", "engineering"], advances: true, trainRiskDelta: -10 },
    { id: "lock-switch", label: "\u0417\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0435\u0442\u043A\u0443", description: "\u041C\u0435\u0445\u0430\u043D\u0438\u0447\u0435\u0441\u043A\u0438 \u0443\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u043E\u0435 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435.", kind: "interact", skillTags: ["mechanic", "engineering"], advances: true, stabilityDelta: 16 },
    { id: "crawl", label: "\u041C\u0430\u043B\u0430\u044F \u0442\u044F\u0433\u0430", description: "\u041F\u0440\u043E\u0439\u0442\u0438 \u0431\u0435\u0437 \u0440\u044B\u0432\u043A\u0430 \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438.", kind: "train", skillTags: ["driving-locomotive"], advances: true, trainRiskDelta: 4 },
    { id: "drop-cargo", label: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0433\u0440\u0443\u0437", description: "\u0421\u043D\u0438\u0437\u0438\u0442\u044C \u0440\u0438\u0441\u043A \u0446\u0435\u043D\u043E\u0439 \u0447\u0430\u0441\u0442\u0438 \u0433\u0440\u0443\u0437\u0430.", kind: "protect", trainRiskDelta: -25 },
    { id: "retreat", label: "\u041E\u0442\u0441\u0442\u0443\u043F\u0438\u0442\u044C", description: "\u041E\u0442\u043A\u0430\u0442\u0438\u0442\u044C\u0441\u044F \u0431\u0435\u0437 \u0441\u043C\u0435\u043D\u044B \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0434\u043E \u043A\u043E\u043B\u043B\u0430\u043F\u0441\u0430.", kind: "retreat" }
  ], ["observation", "navigation", "engineering", "mechanic", "driving-locomotive"], ["\u043A\u043E\u043B\u0451\u0441\u043D\u044B\u0435 \u043F\u0430\u0440\u044B", "\u0441\u0442\u0440\u0435\u043B\u043A\u0438", "\u0442\u043E\u0440\u043C\u043E\u0437\u0430", "\u0441\u0446\u0435\u043F\u043A\u0438"]),
  definition({ id: "druse-growth", name: "\u0420\u043E\u0441\u0442 \u0434\u0440\u0443\u0437\u044B", description: "\u041A\u0440\u0438\u0441\u0442\u0430\u043B\u043B\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043A\u043E\u043B\u043E\u043D\u0438\u044F \u043D\u0430\u0440\u0430\u0449\u0438\u0432\u0430\u0435\u0442 \u043C\u0430\u0441\u0441\u0443 \u0432\u0434\u043E\u043B\u044C \u0442\u0435\u043F\u043B\u043E\u0432\u044B\u0445 \u043C\u043E\u0441\u0442\u043E\u0432.", canonStatus: "canon-compatible", family: "crystalline", dangerTier: 2, warningSigns: ["\u25C7 \u0418\u043D\u0435\u0439 \u043E\u0431\u0440\u0430\u0437\u0443\u0435\u0442 \u0432\u0435\u0442\u0432\u044F\u0449\u0438\u0439\u0441\u044F \u0440\u0438\u0441\u0443\u043D\u043E\u043A.", "\u0422\u0435\u043A\u0441\u0442: \u0440\u043E\u0441\u0442 \u0441\u043B\u0435\u0434\u0443\u0435\u0442 \u043A \u0441\u0430\u043C\u043E\u043C\u0443 \u0442\u0451\u043F\u043B\u043E\u043C\u0443 \u043C\u0435\u0442\u0430\u043B\u043B\u0443."], gurpsResolution: { requiredSuccesses: 3, allowedSkillTags: ["observation", "physics", "chemistry", "engineering"], defaultPenalty: -1, criticalSuccessMayAutoResolve: false }, trainConsequences: train(["\u0442\u0435\u043F\u043B\u043E\u0442\u0440\u0430\u0441\u0441\u0430", "\u043E\u0431\u0448\u0438\u0432\u043A\u0430"], "\u0440\u043E\u0441\u0442 \u0434\u0440\u0443\u0437\u044B") }),
  definition({ id: "reflection-field", name: "\u041F\u043E\u043B\u0435 \u043E\u0442\u0440\u0430\u0436\u0435\u043D\u0438\u0439", description: "\u041E\u0442\u0440\u0430\u0436\u0430\u0435\u0442 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u043E\u0435 \u0432\u043E\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043F\u043E \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u043C\u043E\u0439 \u0433\u0435\u043E\u043C\u0435\u0442\u0440\u0438\u0438 \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u0435\u0439.", canonStatus: "canon-compatible", family: "reflection", dangerTier: 3, warningSigns: ["\u25C7 \u041E\u0442\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0437\u0430\u043F\u0430\u0437\u0434\u044B\u0432\u0430\u044E\u0442 \u043D\u0430 \u043E\u0434\u0438\u043D \u0436\u0435\u0441\u0442.", "\u0422\u0435\u043A\u0441\u0442: \u043C\u0430\u0442\u043E\u0432\u0430\u044F \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u0434\u0430\u0451\u0442 \u0432\u0442\u043E\u0440\u0438\u0447\u043D\u043E\u0433\u043E \u043E\u0431\u0440\u0430\u0437\u0430."], gurpsResolution: { requiredSuccesses: 3, allowedSkillTags: ["observation", "physics", "navigation"], defaultPenalty: -2, criticalSuccessMayAutoResolve: false }, trainConsequences: train(["\u043E\u043F\u0442\u0438\u043A\u0430", "\u043F\u0440\u043E\u0436\u0435\u043A\u0442\u043E\u0440\u044B", "\u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043F\u043E\u0441\u0442"], "\u043B\u043E\u0436\u043D\u044B\u0435 \u043E\u0442\u0440\u0430\u0436\u0435\u043D\u0438\u044F") }),
  definition({ id: "gravity-fracture", name: "\u0413\u0440\u0430\u0432\u0438\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0440\u0430\u0437\u043B\u043E\u043C", description: "\u0412\u0435\u043A\u0442\u043E\u0440 \u0442\u044F\u0436\u0435\u0441\u0442\u0438 \u0441\u0442\u0443\u043F\u0435\u043D\u0447\u0430\u0442\u043E \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043C\u0435\u0436\u0434\u0443 \u0432\u0438\u0434\u0438\u043C\u044B\u043C\u0438 \u0441\u043B\u043E\u044F\u043C\u0438 \u043F\u044B\u043B\u0438.", canonStatus: "recommended", family: "gravitational", dangerTier: 4, warningSigns: ["\u2193 \u041F\u044B\u043B\u044C \u043F\u0430\u0434\u0430\u0435\u0442 \u0432 \u0440\u0430\u0437\u043D\u044B\u0435 \u0441\u0442\u043E\u0440\u043E\u043D\u044B \u043F\u043E \u043F\u043E\u043B\u043E\u0441\u0430\u043C.", "\u0422\u0435\u043A\u0441\u0442: \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u0432\u0435\u043A\u0442\u043E\u0440\u0430 \u043D\u0435\u043F\u043E\u0434\u0432\u0438\u0436\u043D\u044B \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442."], gurpsResolution: { requiredSuccesses: 4, allowedSkillTags: ["observation", "physics", "engineering", "driving-locomotive"], defaultPenalty: -3, criticalSuccessMayAutoResolve: false }, trainConsequences: train(["\u043F\u043E\u0434\u0432\u0435\u0441\u043A\u0430", "\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u044F \u0433\u0440\u0443\u0437\u0430"], "\u0441\u043C\u0435\u043D\u0430 \u0432\u0435\u043A\u0442\u043E\u0440\u0430 \u0442\u044F\u0436\u0435\u0441\u0442\u0438") }),
  definition({ id: "spatial-seam", name: "\u041F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u0448\u043E\u0432", description: "\u0421\u0448\u0438\u0432\u0430\u0435\u0442 \u0434\u0432\u0435 \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u043C\u044B\u0435 \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0430 \u0441 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0439 \u043E\u0440\u0438\u0435\u043D\u0442\u0430\u0446\u0438\u0435\u0439.", canonStatus: "recommended", family: "spatial", dangerTier: 4, warningSigns: ["\u2551 \u041F\u0440\u044F\u043C\u044B\u0435 \u043B\u0438\u043D\u0438\u0438 \u043E\u0431\u0440\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0438 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u044E\u0442\u0441\u044F \u0441\u043E \u0441\u043C\u0435\u0449\u0435\u043D\u0438\u0435\u043C.", "\u0422\u0435\u043A\u0441\u0442: \u0448\u043E\u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442 \u043E\u0440\u0438\u0435\u043D\u0442\u0430\u0446\u0438\u044E \u0434\u043E \u043A\u043E\u043B\u043B\u0430\u043F\u0441\u0430."], gurpsResolution: { requiredSuccesses: 4, allowedSkillTags: ["observation", "navigation", "physics"], defaultPenalty: -3, criticalSuccessMayAutoResolve: false }, trainConsequences: train(["\u0433\u0430\u0431\u0430\u0440\u0438\u0442 \u0441\u043E\u0441\u0442\u0430\u0432\u0430", "\u0441\u0446\u0435\u043F\u043A\u0438"], "\u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0435 \u0441\u043C\u0435\u0449\u0435\u043D\u0438\u0435") }),
  definition({ id: "silent-zone", name: "\u041D\u0435\u043C\u0430\u044F \u0437\u043E\u043D\u0430", description: "\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u043E \u043F\u043E\u0434\u0430\u0432\u043B\u044F\u0435\u0442 \u0441\u0438\u0433\u043D\u0430\u043B\u044B \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430, \u043D\u043E \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442 \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u0439 \u0447\u0430\u0442 Foundry.", canonStatus: "recommended", family: "resonance", dangerTier: 2, warningSigns: ["\u2205 \u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u044B \u0441\u0432\u044F\u0437\u0438 \u0433\u0430\u0441\u043D\u0443\u0442 \u043F\u043E \u043E\u0447\u0435\u0440\u0435\u0434\u0438.", "\u0422\u0435\u043A\u0441\u0442: \u043C\u0435\u0445\u0430\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0441\u0438\u0433\u043D\u0430\u043B\u044B \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u044E\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C."], gurpsResolution: { requiredSuccesses: 3, allowedSkillTags: ["observation", "electronics-sensors", "engineering"], defaultPenalty: -1, criticalSuccessMayAutoResolve: false }, trainConsequences: train(["\u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u0441\u0432\u044F\u0437\u044C", "\u0434\u0430\u0442\u0447\u0438\u043A\u0438"], "\u043F\u043E\u0434\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u043D\u043E\u0439 \u0441\u0432\u044F\u0437\u0438"), gmNotes: ["\u041E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u043D\u0443\u0442\u0440\u0438 \u043C\u0438\u043D\u0438-\u0438\u0433\u0440\u044B \u0438 \u043E\u0442\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F GM.", "\u041D\u0435 \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0447\u0430\u0442 Foundry, \u0433\u043E\u043B\u043E\u0441 \u0438\u043B\u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u044C \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430."] }),
  definition({ id: "thermal-pocket", name: "\u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u043A\u0430\u0440\u043C\u0430\u043D", description: "\u0422\u0435\u043F\u043B\u043E \u043F\u0435\u0440\u0435\u0442\u0435\u043A\u0430\u0435\u0442 \u043C\u0435\u0436\u0434\u0443 \u0437\u0430\u0440\u0430\u043D\u0435\u0435 \u0437\u0430\u043C\u0435\u0442\u043D\u044B\u043C\u0438 \u0445\u043E\u043B\u043E\u0434\u043D\u044B\u043C\u0438 \u0438 \u0433\u043E\u0440\u044F\u0447\u0438\u043C\u0438 \u0443\u0437\u043B\u0430\u043C\u0438.", canonStatus: "recommended", family: "thermal", dangerTier: 3, warningSigns: ["\u25B3 \u041A\u043E\u043D\u0434\u0435\u043D\u0441\u0430\u0442 \u043E\u0431\u0440\u0430\u0437\u0443\u0435\u0442 \u043A\u043E\u043B\u044C\u0446\u0430 \u0432\u043E\u043A\u0440\u0443\u0433 \u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0445 \u0443\u0437\u043B\u043E\u0432.", "\u0422\u0435\u043A\u0441\u0442: \u0433\u043E\u0440\u044F\u0447\u0430\u044F \u0437\u043E\u043D\u0430 \u0440\u0430\u0441\u0448\u0438\u0440\u044F\u0435\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0440\u0435\u0437\u043A\u043E\u0433\u043E \u043F\u0440\u0438\u0442\u043E\u043A\u0430 \u0432\u043E\u0437\u0434\u0443\u0445\u0430."], gurpsResolution: { requiredSuccesses: 3, allowedSkillTags: ["observation", "physics", "engineering", "survival"], defaultPenalty: -2, criticalSuccessMayAutoResolve: false }, trainConsequences: train(["\u043E\u0445\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u0435", "\u043A\u043E\u0442\u0451\u043B", "\u0442\u043E\u043F\u043B\u0438\u0432\u043D\u0430\u044F \u043C\u0430\u0433\u0438\u0441\u0442\u0440\u0430\u043B\u044C"], "\u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u043F\u0435\u0440\u0435\u043F\u0430\u0434") }),
  definition({ id: "memory-haze", name: "\u0422\u0443\u043C\u0430\u043D \u043F\u0430\u043C\u044F\u0442\u0438", description: "\u0421\u0442\u0438\u0440\u0430\u0435\u0442 \u043A\u0440\u0430\u0442\u043A\u0443\u044E \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0440\u0435\u0448\u0435\u043D\u0438\u0439, \u043E\u0441\u0442\u0430\u0432\u043B\u044F\u044F \u0432\u043D\u0435\u0448\u043D\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u043D\u0435\u0442\u0440\u043E\u043D\u0443\u0442\u044B\u043C\u0438.", canonStatus: "recommended", family: "cognitive", dangerTier: 3, warningSigns: ["\u2026 \u041F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0442\u0441\u044F \u043D\u0435\u0437\u0430\u043A\u043E\u043D\u0447\u0435\u043D\u043D\u044B\u0435 \u0444\u0440\u0430\u0437\u044B.", "\u0422\u0435\u043A\u0441\u0442: \u043F\u0438\u0441\u044C\u043C\u0435\u043D\u043D\u044B\u0435 \u043C\u0435\u0442\u043A\u0438 \u043D\u0435 \u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u043F\u0430\u043C\u044F\u0442\u044C\u044E."], gurpsResolution: { requiredSuccesses: 3, allowedSkillTags: ["observation", "research", "first-aid"], defaultPenalty: -2, criticalSuccessMayAutoResolve: false }, trainConsequences: train(["\u0432\u0430\u0445\u0442\u0435\u043D\u043D\u044B\u0439 \u0436\u0443\u0440\u043D\u0430\u043B", "\u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u044B"], "\u043F\u043E\u0442\u0435\u0440\u044F \u043A\u0440\u0430\u0442\u043A\u043E\u0439 \u043F\u0430\u043C\u044F\u0442\u0438") }),
  definition({ id: "rust-wave", name: "\u0412\u043E\u043B\u043D\u0430 \u0440\u0436\u0430\u0432\u0447\u0438\u043D\u044B", description: "\u041A\u043E\u0440\u0440\u043E\u0437\u0438\u043E\u043D\u043D\u044B\u0439 \u0444\u0440\u043E\u043D\u0442 \u0438\u0434\u0451\u0442 \u043F\u043E \u044D\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u0438 \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u043E\u043C\u0443 \u043C\u0435\u0442\u0430\u043B\u043B\u0443.", canonStatus: "recommended", family: "corrosive", dangerTier: 4, warningSigns: ["\u224B \u041E\u043A\u0438\u0441\u0435\u043B \u0440\u0430\u0441\u0442\u0451\u0442 \u043B\u0438\u043D\u0438\u0435\u0439 \u043E\u0442 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430 \u043A \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0443.", "\u0422\u0435\u043A\u0441\u0442: \u0438\u0437\u043E\u043B\u0438\u0440\u0443\u044E\u0449\u0438\u0435 \u0432\u0441\u0442\u0430\u0432\u043A\u0438 \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u044E\u0442 \u0444\u0440\u043E\u043D\u0442."], gurpsResolution: { requiredSuccesses: 4, allowedSkillTags: ["observation", "chemistry", "engineering", "mechanic"], defaultPenalty: -3, criticalSuccessMayAutoResolve: false }, trainConsequences: train(["\u043E\u0431\u0448\u0438\u0432\u043A\u0430", "\u0442\u043E\u0440\u043C\u043E\u0437\u043D\u044B\u0435 \u043C\u0430\u0433\u0438\u0441\u0442\u0440\u0430\u043B\u0438", "\u043A\u0440\u0435\u043F\u0451\u0436"], "\u0443\u0441\u043A\u043E\u0440\u0435\u043D\u043D\u0430\u044F \u043A\u043E\u0440\u0440\u043E\u0437\u0438\u044F") }),
  definition({ id: "eon-storm", name: "\u042D\u043E\u043D\u043E\u0432\u044B\u0439 \u0448\u0442\u043E\u0440\u043C", description: "\u0412\u044B\u0441\u043E\u043A\u043E\u0443\u0440\u043E\u0432\u043D\u0435\u0432\u043E\u0435 \u0441\u043E\u0441\u0442\u0430\u0432\u043D\u043E\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435, \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u044E\u0449\u0435\u0435 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0437\u0430\u043A\u043E\u043D\u043E\u0432 \u042D\u041E\u041D.", canonStatus: "recommended", family: "composite", dangerTier: 5, warningSigns: ["\u2726 \u041D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u044B\u0445 \u043F\u0440\u0438\u0431\u043E\u0440\u043E\u0432 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0442 \u043E\u0434\u0438\u043D \u0440\u0438\u0442\u043C.", "\u0422\u0435\u043A\u0441\u0442: \u0444\u0440\u043E\u043D\u0442 \u043F\u0440\u0438\u0431\u043B\u0438\u0436\u0430\u0435\u0442\u0441\u044F \u0441\u0442\u0430\u0434\u0438\u044F\u043C\u0438 \u0438 \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443."], supportedModes: ["exploration", "combat", "train-travel", "train-combat", "research"], gurpsResolution: { requiredSuccesses: 5, allowedSkillTags: ["observation", "navigation", "physics", "electronics-sensors", "engineering", "mechanic", "driving-locomotive", "research"], defaultPenalty: -4, criticalSuccessMayAutoResolve: false }, trainConsequences: train(["\u044D\u043D\u0435\u0440\u0433\u043E\u0441\u0435\u0442\u044C", "\u0445\u043E\u0434\u043E\u0432\u0430\u044F \u0447\u0430\u0441\u0442\u044C", "\u0441\u0432\u044F\u0437\u044C", "\u043A\u043E\u0440\u043F\u0443\u0441"], "\u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0441\u043D\u044B\u0439 \u042D\u043E\u043D\u043E\u0432\u044B\u0439 \u0448\u0442\u043E\u0440\u043C"), gmNotes: ["\u0415\u0434\u0438\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0435 \u0431\u0430\u0437\u043E\u0432\u043E\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435, \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0435 \u0437\u0430\u0442\u0440\u043E\u043D\u0443\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0432\u0430\u0433\u043E\u043D\u043E\u0432 \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E.", "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439, \u043E\u0448\u0438\u0431\u043E\u043A \u0438\u043B\u0438 \u0434\u043E\u0431\u0440\u043E\u0432\u043E\u043B\u044C\u043D\u043E\u0433\u043E \u0440\u0438\u0441\u043A\u0430."] })
];
var ANOMALY_BY_ID = Object.fromEntries(ANOMALY_DEFINITIONS.map((item) => [item.id, item]));
var ANOMALY_IDS = ANOMALY_DEFINITIONS.map((item) => item.id);

// server.ts
var app = (0, import_express.default)();
var server = import_http.default.createServer(app);
var wss = new import_ws.WebSocketServer({ server });
var PORT = parseInt(process.env.PORT || "3000", 10);
var gameState = "setup";
var map = null;
var messages = [];
var stashLoot = [
  { id: "1", name: "\u0410\u043F\u0442\u0435\u0447\u043A\u0430", weight: 10 },
  { id: "2", name: "\u041F\u0430\u0442\u0440\u043E\u043D\u044B", weight: 20 },
  { id: "3", name: "\u0410\u043D\u0442\u0438\u0440\u0430\u0434", weight: 15 },
  { id: "4", name: "\u0422\u0443\u0448\u0435\u043D\u043A\u0430", weight: 30 },
  { id: "5", name: "\u041F\u0443\u0441\u0442\u043E", weight: 25 }
];
var artifactLoot = [
  { id: "1", name: "\u041A\u0430\u043F\u043B\u044F", weight: 20 },
  { id: "2", name: "\u041A\u0440\u043E\u0432\u044C \u043A\u0430\u043C\u043D\u044F", weight: 15 },
  { id: "3", name: "\u0421\u043B\u0438\u0437\u044C", weight: 25 },
  { id: "4", name: "\u041A\u043E\u043B\u044E\u0447\u043A\u0430", weight: 10 },
  { id: "5", name: "\u041C\u0435\u0434\u0443\u0437\u0430", weight: 30 }
];
var activeVotes = {};
var clients = /* @__PURE__ */ new Map();
function broadcast(type, payload, excludeSocket) {
  const data = JSON.stringify({ type, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === import_ws.WebSocket.OPEN && client !== excludeSocket) {
      client.send(data);
    }
  });
}
function getActiveGMId() {
  for (const [ws, player] of clients.entries()) {
    if (player.role === "gm" && ws.readyState === import_ws.WebSocket.OPEN) {
      return player.id;
    }
  }
  return null;
}
function getActivePlayersCount() {
  return Array.from(clients.values()).filter((p) => p.role === "player").length;
}
function appendSystemMessage(text, type = "info") {
  const msgObj = {
    id: Math.random().toString(36).substring(2, 9),
    sender: "\u0421\u0418\u0421\u0422\u0415\u041C\u0410",
    text,
    type,
    timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString()
  };
  messages.push(msgObj);
}
function getWeightedLoot(lootTable) {
  if (lootTable.length === 0) return "\u041D\u0438\u0447\u0435\u0433\u043E";
  const totalWeight = lootTable.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of lootTable) {
    random -= item.weight;
    if (random <= 0) return item.name;
  }
  return lootTable[lootTable.length - 1].name;
}
function checkGameLossSurvival() {
  if (!map) return;
  if (map.health <= 0) {
    appendSystemMessage("\u{1F480} \u0413\u0420\u0423\u041F\u041F\u0410 \u041F\u041E\u0413\u0418\u0411\u041B\u0410! \u041E\u0447\u043A\u0438 \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u044F \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0438\u0441\u0441\u044F\u043A\u043B\u0438 \u0432 \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u0438!", "danger");
    gameState = "ended";
  }
  if (map.radiation >= map.maxRadiation) {
    appendSystemMessage("\u{1F480} \u0413\u0420\u0423\u041F\u041F\u0410 \u041F\u041E\u0413\u0418\u0411\u041B\u0410! \u041D\u0430\u0431\u043E\u0440 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u0440\u0430\u0434\u0438\u0430\u0446\u0438\u0438 \u043F\u0440\u0438\u0432\u0435\u043B \u043A \u043B\u0443\u0447\u0435\u0432\u043E\u0439 \u0441\u043C\u0435\u0440\u0442\u0438 \u0432\u0441\u0435\u0433\u043E \u043E\u0442\u0440\u044F\u0434\u0430!", "danger");
    gameState = "ended";
  }
}
function resolveArtifactDetectionByLevel(px, py) {
  let artifacts = [];
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
  artifacts.sort((a, b) => a.dist - b.dist);
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
    appendSystemMessage("\u{1F52E} \u0410\u043D\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440 \u0430\u0440\u0442\u0435\u0444\u0430\u043A\u0442\u043E\u0432 \u043C\u043E\u043B\u0447\u0438\u0442. \u0412 \u0440\u0430\u0434\u0438\u0443\u0441\u0435 3\u0445 \u043A\u043B\u0435\u0442\u043E\u043A \u043F\u0443\u0441\u0442\u043E.", "info");
    map.activeDirectionHighlight = null;
    return;
  }
  const closest = artifacts[0];
  const level = map.detectorLevel;
  if (level === 1) {
    appendSystemMessage("\u{1F52E} \u0423\u0420\u041E\u0412\u0415\u041D\u042C 1 (\u041F\u0420\u041E\u0421\u0422\u041E\u0419): \u0414\u0435\u0442\u0435\u043A\u0442\u043E\u0440 \u043C\u0435\u0440\u043D\u043E \u043F\u0438\u0449\u0438\u0442. \u041F\u043E\u0431\u043B\u0438\u0437\u043E\u0441\u0442\u0438 \u0435\u0441\u0442\u044C \u0430\u0440\u0442\u0435\u0444\u0430\u043A\u0442!", "loot");
    map.activeDirectionHighlight = null;
  } else if (level === 2) {
    let dirY = "";
    let dirX = "";
    if (closest.y < py) dirY = "\u0421\u0415\u0412\u0415\u0420";
    else if (closest.y > py) dirY = "\u042E\u0413";
    if (closest.x < px) dirX = "\u0417\u0410\u041F\u0410\u0414";
    else if (closest.x > px) dirX = "\u0412\u041E\u0421\u0422\u041E\u041A";
    const directionText = [dirY, dirX].filter(Boolean).join("-");
    appendSystemMessage(`\u{1F52E} \u0423\u0420\u041E\u0412\u0415\u041D\u042C 2 (\u041D\u0410\u041F\u0420\u0410\u0412\u041B\u0415\u041D\u0418\u0415): \u0420\u0430\u0434\u0430\u0440 \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0435\u0442 \u0438\u0437\u043B\u0443\u0447\u0435\u043D\u0438\u0435 \u0432 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0438: ${directionText}!`, "loot");
    let code = "";
    if (closest.y < py) code += "N";
    if (closest.y > py) code += "S";
    if (closest.x < px) code += "W";
    if (closest.x > px) code += "E";
    map.activeDirectionHighlight = code;
  } else if (level === 3) {
    appendSystemMessage("\u{1F52E} \u0423\u0420\u041E\u0412\u0415\u041D\u042C 3 (\u041E\u0411\u041B\u0410\u0421\u0422\u042C): \u041F\u0440\u0438\u0431\u043E\u0440 \u043B\u043E\u043A\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043B \u0430\u0440\u0442\u0435\u0444\u0430\u043A\u0442 \u0432 \u043F\u0440\u0438\u0431\u043B\u0438\u0437\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u043C \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u0435 3x3!", "loot");
    map.activeDirectionHighlight = null;
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
    appendSystemMessage("\u{1F52E} \u0423\u0420\u041E\u0412\u0415\u041D\u042C 4 (\u0422\u041E\u0427\u041D\u042B\u0419): \u041A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u044B \u0430\u0440\u0442\u0435\u0444\u0430\u043A\u0442\u0430 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0440\u0430\u0441\u0441\u0435\u043A\u0440\u0435\u0447\u0435\u043D\u044B!", "loot");
    map.activeDirectionHighlight = null;
    map.grid[closest.y][closest.x].isRevealed = true;
    map.grid[closest.y][closest.x].isScannedForArtifact = true;
  }
}
function resolveCellEnter(nx, ny) {
  map.grid[ny][nx].isRevealed = true;
  const cell = map.grid[ny][nx];
  if (cell.radiationLevel > 0) {
    const dose = cell.radiationLevel * 8;
    map.radiation = Math.min(map.maxRadiation, map.radiation + dose);
    appendSystemMessage(`\u2623\uFE0F \u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435! \u0414\u043E\u0437\u0430 \u043E\u0431\u043B\u0443\u0447\u0435\u043D\u0438\u044F: +${dose} \u0440\u0430\u0434 (\u0422\u0435\u043A: ${map.radiation}/${map.maxRadiation})!`, "warning");
    const radDmg = cell.radiationLevel * 6;
    map.health = Math.max(0, map.health - radDmg);
    appendSystemMessage(`\u{1F494} \u0417\u0434\u043E\u0440\u043E\u0432\u044C\u0435 \u043E\u0442\u0440\u044F\u0434\u0430 \u0441\u043D\u0438\u0437\u0438\u043B\u043E\u0441\u044C \u043D\u0430 ${radDmg} \u041E\u0417 \u0438\u0437-\u0437\u0430 \u0444\u043E\u043D\u0438\u0440\u0443\u044E\u0449\u0438\u0445 \u043E\u0447\u0430\u0433\u043E\u0432 \u0440\u0430\u0434\u0438\u0430\u0446\u0438\u0438.`, "danger");
  }
  if (cell.type === "exit") {
    appendSystemMessage("\u{1F3C6} \u041F\u043E\u0437\u0434\u0440\u0430\u0432\u043B\u044F\u0435\u043C! \u0413\u0440\u0443\u043F\u043F\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u043F\u0440\u0435\u043E\u0434\u043E\u043B\u0435\u043B\u0430 \u043A\u043E\u0440\u0434\u043E\u043D\u044B \u0438 \u043F\u043E\u043A\u0438\u043D\u0443\u043B\u0430 \u0430\u043D\u043E\u043C\u0430\u043B\u044C\u043D\u0443\u044E \u0437\u043E\u043D\u0443!", "success");
    gameState = "ended";
    return;
  }
  if (cell.type === "stash") {
    const loot = getWeightedLoot(stashLoot);
    appendSystemMessage(`\u{1F4E6} \u041D\u0430\u0439\u0434\u0435\u043D \u0437\u0430\u0431\u0440\u043E\u0448\u0435\u043D\u043D\u044B\u0439 \u0441\u0445\u0440\u043E\u043D! \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E: "${loot}"`, "loot");
    if (!map.inventory) map.inventory = [];
    if (loot && loot !== "\u041D\u0438\u0447\u0435\u0433\u043E" && loot !== "\u041F\u0443\u0441\u0442\u043E") {
      map.inventory.push(loot);
    }
    map.grid[ny][nx].type = "empty";
  }
  if (cell.type === "artifact") {
    const loot = getWeightedLoot(artifactLoot);
    appendSystemMessage(`\u{1F48E} \u0423\u0420\u0410! \u0412\u044B \u043F\u043E\u0434\u043E\u0431\u0440\u0430\u043B\u0438 \u0446\u0435\u043D\u043D\u044B\u0439 \u0430\u0440\u0442\u0435\u0444\u0430\u043A\u0442: "${loot}"`, "loot");
    if (!map.inventory) map.inventory = [];
    if (loot && loot !== "\u041D\u0438\u0447\u0435\u0433\u043E" && loot !== "\u041F\u0443\u0441\u0442\u043E") {
      map.inventory.push(loot);
    }
    map.grid[ny][nx].type = "empty";
  }
  if (cell.type === "anomaly") {
    if (!cell.anomalyResolved) startAnomalyEncounter(cell);
  }
}
function getAnomalyRussianName(type) {
  return type ? ANOMALY_BY_ID[type]?.name || type : "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u044F";
}
function seededNumber(seed, index = 0) {
  return createRandomGenerator(`${seed}:${index}`)();
}
function encounterSequence(anomalyId, seed) {
  const pools = {
    "crystal-resonance": ["tone-low", "tone-mid", "tone-high"],
    "echo-loop": ["echo-a", "echo-b", "echo-c"]
  };
  const pool = pools[anomalyId];
  if (!pool) return [];
  const original = Array.from({ length: 3 }, (_, index) => pool[Math.floor(seededNumber(seed, index) * pool.length)]);
  return anomalyId === "echo-loop" ? original.reverse() : original;
}
function startAnomalyEncounter(cell) {
  const definition2 = ANOMALY_BY_ID[cell.anomalyType];
  if (!definition2 || map.activeAnomalyEncounter) return;
  const seed = cell.anomalySeed || `${map.seed || "EON"}:${cell.x}:${cell.y}:${cell.anomalyType}`;
  const kind = encounterKind(definition2.id);
  if (kind === "field") {
    if (!cell.fieldWarned) {
      cell.fieldWarned = true;
      appendSystemMessage(`\u26A0\uFE0F ${definition2.name}: ${definition2.detection.passiveSignal} \u041F\u0435\u0440\u0432\u044B\u0439 \u043A\u043E\u043D\u0442\u0430\u043A\u0442 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u0435\u043D. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0432\u0445\u043E\u0434 \u0432\u044B\u0437\u043E\u0432\u0435\u0442 \u044D\u0444\u0444\u0435\u043A\u0442 \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u0438: \u043E\u0431\u043E\u0439\u0434\u0438\u0442\u0435 \u043E\u0447\u0430\u0433 \u0438\u043B\u0438 \u0438\u0441\u0441\u043B\u0435\u0434\u0443\u0439\u0442\u0435 \u0435\u0433\u043E \u0431\u043E\u043B\u0442\u043E\u043C.`, "warning");
      return;
    }
    const visit = cell.fieldVisits || 0;
    const safe = [], expandable = [];
    for (const row of map.grid) for (const candidate of row) {
      if (candidate.type !== "empty" || candidate.radiationLevel > 0) continue;
      const index = candidate.y * map.width + candidate.x;
      safe.push(index);
      if (Math.abs(candidate.x - cell.x) + Math.abs(candidate.y - cell.y) === 1) expandable.push(index);
    }
    const effect = fieldOutcome(definition2.id, seed, visit, safe, expandable);
    cell.fieldVisits = visit + 1;
    const damage = Math.min(effect.damage, Math.max(0, map.health - 1));
    map.health -= damage;
    const consequences2 = [];
    if (damage) consequences2.push(`\u0417\u0434\u043E\u0440\u043E\u0432\u044C\u0435 \u2212${damage}`);
    if (effect.expansion !== null) {
      const x = effect.expansion % map.width, y = Math.floor(effect.expansion / map.width);
      Object.assign(map.grid[y][x], { type: "anomaly", anomalyType: definition2.id, anomalySeed: `${seed}:growth:${visit}`, isRevealed: true, fieldWarned: false });
      consequences2.push(`\u041E\u0447\u0430\u0433 \u0440\u0430\u0441\u0448\u0438\u0440\u0438\u043B\u0441\u044F \u0432 \u043A\u043B\u0435\u0442\u043A\u0443 ${x}, ${y}; \u043D\u043E\u0432\u044B\u0439 \u043A\u0440\u0430\u0439 \u0434\u0430\u0451\u0442 \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0434 \u0432\u043E\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435\u043C`);
    }
    if (effect.destination !== null) {
      const x = effect.destination % map.width, y = Math.floor(effect.destination / map.width);
      map.playerPos = { x, y };
      map.grid[y][x].isRevealed = true;
      consequences2.push(`\u041E\u0442\u0440\u044F\u0434 \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0451\u043D \u0432 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u0443\u044E \u043A\u043B\u0435\u0442\u043A\u0443 ${x}, ${y}`);
    }
    map.anomalyJournal ||= [];
    map.anomalyJournal.push({ anomalyId: definition2.id, seed: `${seed}:field:${visit}`, mode: "field", participants: [...new Set([...clients.values()].map((p) => p.username))], usedSkills: [], rollResults: [], decisions: ["\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0432\u0445\u043E\u0434 \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u044F"], mistakes: 0, result: "successWithCost", consequences: consequences2, rewards: [], trainChanges: [], completedAt: (/* @__PURE__ */ new Date()).toISOString() });
    appendSystemMessage(`\u25C6 ${definition2.name}: ${consequences2.join("; ") || "\u041E\u0447\u0430\u0433 \u0437\u0430\u0442\u0438\u0445, \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u043A\u043B\u0435\u0442\u043E\u043A \u0434\u043B\u044F \u0432\u043E\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043D\u0435\u0442"}.`, "warning");
    return;
  }
  const difficulty = map.difficulty ?? definition2.dangerTier;
  const mode = kind === "rolls" ? "gurps-roll" : map.anomalyResolutionMode || "hybrid";
  map.activeAnomalyEncounter = {
    anomalyId: definition2.id,
    seed,
    mode,
    phase: "warning",
    difficulty,
    timeRemaining: encounterSeconds(difficulty),
    puzzle: mode !== "gurps-roll" ? createPuzzle(definition2.id, seed, difficulty) : void 0,
    anomalyStability: 70,
    exposure: 0,
    contamination: 0,
    trainIntegrityRisk: 0,
    discoveredClues: [definition2.detection.passiveSignal],
    mistakes: 0,
    elapsedRounds: 0,
    progress: 0,
    sequence: encounterSequence(definition2.id, seed),
    sequenceIndex: 0,
    preparedActions: [],
    usedSkills: [],
    rollResults: [],
    decisions: [],
    participants: [],
    paused: false
  };
  appendSystemMessage(`\u26A0\uFE0F \u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0430 \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u044F \xAB${definition2.name}\xBB. \u041D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u043C\u044B\u0439 \u0441\u0438\u0433\u043D\u0430\u043B: ${definition2.detection.passiveSignal}`, "warning");
}
function updateEncounterPhase(encounter, definition2) {
  const matches = (phaseId) => {
    const transition = definition2.phases.find((phase) => phase.id === phaseId)?.transition || {};
    if (transition.onResult) return encounter.result && transition.onResult.includes(encounter.result);
    const checks = [];
    if (transition.minRounds !== void 0) checks.push(encounter.elapsedRounds >= transition.minRounds);
    if (transition.minMistakes !== void 0) checks.push(encounter.mistakes >= transition.minMistakes);
    if (transition.maxStability !== void 0) checks.push(encounter.anomalyStability <= transition.maxStability);
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
function finishEncounter(result) {
  const encounter = map.activeAnomalyEncounter;
  const definition2 = encounter && ANOMALY_BY_ID[encounter.anomalyId];
  if (!encounter || !definition2 || encounter.result) return;
  encounter.result = result;
  encounter.phase = "aftermath";
  const consequencePool = result === "completeSuccess" || result === "retreat" ? [] : definition2.characterConsequences[result] || [];
  const consequence = consequencePool.length ? consequencePool[Math.floor(seededNumber(encounter.seed, 90 + encounter.mistakes) * consequencePool.length)] : null;
  const rewards = result === "completeSuccess" || result === "successWithCost" ? [definition2.rewards[Math.floor(seededNumber(encounter.seed, 120) * definition2.rewards.length)]] : [];
  const trainChanges = encounter.trainIntegrityRisk >= 60 ? [definition2.trainConsequences.possiblePermanentFaults[0]] : encounter.trainIntegrityRisk >= 25 ? [definition2.trainConsequences.possibleTemporaryFaults[0]] : [];
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
    anomalyId: encounter.anomalyId,
    seed: encounter.seed,
    mode: encounter.mode,
    participants: encounter.participants,
    usedSkills: encounter.usedSkills,
    rollResults: encounter.rollResults,
    decisions: encounter.decisions,
    mistakes: encounter.mistakes,
    result,
    consequences: consequence ? [consequence] : [],
    rewards,
    trainChanges,
    completedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  appendSystemMessage(`\u25C6 \xAB${definition2.name}\xBB: ${RESULT_LABELS[result]}. ${consequence || "\u042D\u043A\u0438\u043F\u0430\u0436 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u043B \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u043D\u0430\u0434 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u0435\u0439."}`, result === "completeSuccess" ? "success" : "warning");
}
function applyEncounterAction(action, username) {
  const encounter = map?.activeAnomalyEncounter;
  if (!encounter || encounter.result || encounter.paused || action.kind !== "retreat" || encounter.phase === "collapse") return;
  if (!encounter.participants.includes(username)) encounter.participants.push(username);
  encounter.decisions.push(`${username}: \u043E\u0442\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435`);
  finishEncounter("retreat");
}
function resolveGurpsRoll(skillTag, target, username, foundryItemUuid) {
  const encounter = map.activeAnomalyEncounter;
  const definition2 = encounter && ANOMALY_BY_ID[encounter.anomalyId];
  if (!encounter || !definition2 || encounter.result || encounter.paused) return;
  if (!definition2.gurpsResolution.allowedSkillTags.includes(skillTag) && skillTag !== "manual") return;
  const safeTarget = Math.max(3, Math.min(18, Math.floor(target)));
  const index = encounter.rollResults.length;
  const dice = rollThreeDice(encounter.seed, index);
  const roll = dice.reduce((sum, die) => sum + die, 0);
  const effectiveTarget = safeTarget + definition2.gurpsResolution.defaultPenalty;
  const criticalSuccess = roll <= 4 || roll === 5 && effectiveTarget >= 15 || roll === 6 && effectiveTarget >= 16;
  const criticalFailure = roll === 18 || roll === 17 && effectiveTarget <= 15 || roll - effectiveTarget >= 10;
  const success = criticalSuccess || roll < 17 && roll <= effectiveTarget;
  const critical = criticalSuccess || criticalFailure;
  const resolvedSkill = skillTag === "manual" && foundryItemUuid ? `manual:${foundryItemUuid}` : skillTag;
  encounter.rollResults.push({ skillTag, foundryItemUuid, target: effectiveTarget, roll, margin: effectiveTarget - roll, success, critical });
  encounter.usedSkills.push(resolvedSkill);
  if (!encounter.participants.includes(username)) encounter.participants.push(username);
  encounter.elapsedRounds++;
  if (success) {
    if (encounter.mode === "gurps-roll") encounter.progress++;
    else {
      encounter.preparedActions.push("hybrid-forgiveness");
      encounter.timeRemaining += 10;
      encounter.discoveredClues.push("\u0423\u0441\u043F\u0435\u0448\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430: +10 \u0441\u0435\u043A\u0443\u043D\u0434 \u0438 \u0437\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u043E\u0434\u043D\u043E\u0439 \u043E\u0448\u0438\u0431\u043A\u0438.");
      const clue = definition2.detection.clues[Math.min(encounter.discoveredClues.length, definition2.detection.clues.length - 1)];
      if (clue && !encounter.discoveredClues.includes(clue)) encounter.discoveredClues.push(clue);
    }
    encounter.anomalyStability = Math.min(100, encounter.anomalyStability + 10);
    if (critical && map.anomalyCriticalRollAutoSuccess) return finishEncounter("completeSuccess");
  } else {
    encounter.mistakes++;
    encounter.exposure = Math.min(100, encounter.exposure + (critical ? 20 : 10));
    encounter.anomalyStability = Math.max(0, encounter.anomalyStability - (critical ? 25 : 12));
  }
  updateEncounterPhase(encounter, definition2);
  if (encounter.mode === "gurps-roll" && encounter.progress >= definition2.gurpsResolution.requiredSuccesses) finishEncounter(encounter.mistakes ? "successWithCost" : "completeSuccess");
  else if (encounter.phase === "collapse" && encounter.mistakes >= definition2.minigame.maxMistakes + 1) finishEncounter("criticalFailure");
}
function executeGameAction(action) {
  if (!map) return;
  if (map.activeAnomalyEncounter) {
    appendSystemMessage("\u26A0\uFE0F \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u044E \u0438\u043B\u0438 \u043E\u0442\u0441\u0442\u0443\u043F\u0438\u0442\u0435.", "warning");
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
      appendSystemMessage("\u26D4 \u041A\u043E\u043C\u0430\u043D\u0434\u0438\u0440 \u043F\u0435\u0440\u0435\u0434\u0443\u043C\u0430\u043B: \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u0437\u0430 \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u0438\u0437\u0443\u0447\u0435\u043D\u043D\u043E\u0433\u043E \u0441\u0435\u043A\u0442\u043E\u0440\u0430 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E!");
    }
  } else if (action.startsWith("BOLT")) {
    if (map.boltCharges === void 0) map.boltCharges = 10;
    if (map.boltCharges <= 0) {
      appendSystemMessage("\u274C \u041D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E \u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0431\u043E\u043B\u0442: \u0437\u0430\u043A\u043E\u043D\u0447\u0438\u043B\u0441\u044F \u0437\u0430\u043F\u0430\u0441 \u0432 \u0440\u044E\u043A\u0437\u0430\u043A\u0435!", "warning");
      return;
    }
    map.boltCharges--;
    let boltDir = "UP";
    if (action.includes("_")) {
      boltDir = action.split("_")[1];
    }
    let bdx = 0;
    let bdy = 0;
    let directionName = "";
    if (boltDir === "UP") {
      bdy = -1;
      directionName = "\u0432\u0432\u0435\u0440\u0445 (\u043D\u0430 \u0421\u0415\u0412\u0415\u0420) \u2B06\uFE0F";
    } else if (boltDir === "DOWN") {
      bdy = 1;
      directionName = "\u0432\u043D\u0438\u0437 (\u043D\u0430 \u042E\u0413) \u2B07\uFE0F";
    } else if (boltDir === "LEFT") {
      bdx = -1;
      directionName = "\u0432\u043B\u0435\u0432\u043E (\u043D\u0430 \u0417\u0410\u041F\u0410\u0414) \u2B05\uFE0F";
    } else if (boltDir === "RIGHT") {
      bdx = 1;
      directionName = "\u0432\u043F\u0440\u0430\u0432\u043E (\u043D\u0430 \u0412\u041E\u0421\u0422\u041E\u041A) \u27A1\uFE0F";
    }
    appendSystemMessage(`\u{1F529} \u0411\u0440\u043E\u0448\u0435\u043D \u0431\u043E\u043B\u0442 \u0432 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0438: ${directionName}! \u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C \u0431\u043E\u043B\u0442\u043E\u0432: ${map.boltCharges}`);
    let anomalyDetected = false;
    for (let step = 1; step <= 3; step++) {
      const targetX = px + bdx * step;
      const targetY = py + bdy * step;
      if (targetX >= 0 && targetX < map.width && targetY >= 0 && targetY < map.height) {
        map.grid[targetY][targetX].isScannedByBolt = true;
        if (map.grid[targetY][targetX].type === "anomaly") {
          anomalyDetected = true;
          map.grid[targetY][targetX].isRevealed = true;
          const translatedName = getAnomalyRussianName(map.grid[targetY][targetX].anomalyType);
          appendSystemMessage(`\u{1F4A5} \u0411\u043E\u043B\u0442 \u0434\u0435\u0442\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043B \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u044E \u043D\u0430 \u0440\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u0438 ${step} \u043A\u043B. \u043F\u043E\u0434 \u0432\u043E\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435\u043C \u043E\u0447\u0430\u0433\u0430: "${translatedName}"!`, "danger");
          break;
        }
      } else {
        break;
      }
    }
    if (!anomalyDetected) {
      appendSystemMessage(`\u{1F7E2} \u0411\u043E\u043B\u0442 \u043F\u0440\u043E\u043B\u0435\u0442\u0435\u043B \u043F\u0443\u0442\u044C \u043F\u043E \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044E ${directionName} \u0438 \u0443\u043F\u0430\u043B \u0431\u0435\u0437 \u0448\u0443\u043C\u0430. \u041E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438 \u0432\u043F\u0435\u0440\u0435\u0434\u0438 \u043D\u0435\u0442.`, "success");
    }
  } else if (action === "GEIGER") {
    if (map.geigerCharges <= 0) {
      appendSystemMessage("\u274C \u041D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0441\u0447\u0435\u0442\u0447\u0438\u043A \u0413\u0435\u0439\u0433\u0435\u0440\u0430: \u0440\u0430\u0437\u0440\u044F\u0436\u0435\u043D\u044B \u0430\u043A\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440\u044B!", "warning");
      return;
    }
    map.geigerCharges--;
    appendSystemMessage(`\u{1F4E1} \u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D \u0441\u0447\u0435\u0442\u0447\u0438\u043A \u0413\u0435\u0439\u0433\u0435\u0440\u0430 (\u0417\u0430\u0440\u044F\u0434\u043E\u0432 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C: ${map.geigerCharges})`);
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
      appendSystemMessage("\u26A0\uFE0F \u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435! \u0420\u044F\u0434\u043E\u043C \u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u044B \u043E\u0447\u0430\u0433\u0438 \u0436\u0435\u0441\u0442\u043A\u043E\u0439 \u0440\u0430\u0434\u0438\u0430\u0446\u0438\u0438!", "warning");
    } else {
      appendSystemMessage("\u{1F7E2} \u0420\u0430\u0434\u0438\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0444\u043E\u043D \u0432\u043E\u043A\u0440\u0443\u0433 \u043E\u0442\u0440\u044F\u0434\u0430 \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u043D\u043E\u0440\u043C\u044B.", "success");
    }
  } else if (action === "SCAN") {
    if (map.detectorCharges <= 0) {
      appendSystemMessage("\u274C \u041F\u043E\u0438\u0441\u043A \u0441\u043E\u0440\u0432\u0430\u043D: \u0434\u0435\u0442\u0435\u043A\u0442\u043E\u0440 \u0430\u0440\u0442\u0435\u0444\u0430\u043A\u0442\u043E\u0432 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0440\u0430\u0437\u0440\u044F\u0436\u0435\u043D!", "warning");
      return;
    }
    map.detectorCharges--;
    appendSystemMessage(`\u{1F52E} \u0417\u0430\u043F\u0443\u0449\u0435\u043D \u0434\u0435\u0442\u0435\u043A\u0442\u043E\u0440 \u0430\u0440\u0442\u0435\u0444\u0430\u043A\u0442\u043E\u0432 (\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0414\u0435\u0442\u0435\u043A\u0442\u043E\u0440\u0430: ${map.detectorLevel}, \u0437\u0430\u0440\u044F\u0434\u043E\u0432: ${map.detectorCharges})`);
    resolveArtifactDetectionByLevel(px, py);
  }
  if (action === "UP" || action === "DOWN" || action === "LEFT" || action === "RIGHT") {
    map.activeDirectionHighlight = null;
  }
  if (!map.activeAnomalyEncounter) map.timerSeconds = 60;
  checkGameLossSurvival();
}
var serverClockInterval = null;
function initTurnTimerClock() {
  if (serverClockInterval) clearInterval(serverClockInterval);
  serverClockInterval = setInterval(() => {
    if (gameState === "playing" && map?.activeAnomalyEncounter) {
      const encounter = map.activeAnomalyEncounter;
      const tick = tickAnomalyClock(encounter, map.anomalyTimerEnabled !== false);
      if (tick === "paused") return;
      if (tick === "expired") {
        encounter.decisions.push("\u0418\u0441\u0442\u0435\u043A\u043B\u043E \u0432\u0440\u0435\u043C\u044F \u0440\u0435\u0448\u0435\u043D\u0438\u044F");
        finishEncounter(encounter.progress > 0 ? "partialFailure" : "failure");
      }
      broadcast("SYNC_APP_STATE", { map, gameState, messages });
    } else if (gameState === "playing" && map && !map.activeAnomalyEncounter) {
      if (map.timerSeconds > 0) {
        map.timerSeconds--;
        broadcast("TIMER_TICK", { timerSeconds: map.timerSeconds });
      } else {
        map.timerSeconds = 60;
        const radPenalty = 15;
        map.radiation = Math.min(map.maxRadiation, map.radiation + radPenalty);
        appendSystemMessage(`\u26A0\uFE0F \u0412\u0420\u0415\u041C\u042F \u0425\u041E\u0414\u0410 \u0418\u0421\u0422\u0415\u041A\u041B\u041E! \u041F\u0440\u0435\u0431\u044B\u0432\u0430\u043D\u0438\u0435 \u0431\u0435\u0437 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F \u043E\u0431\u043B\u0443\u0447\u0430\u0435\u0442 \u043E\u0442\u0440\u044F\u0434 (+${radPenalty} \u0440\u0430\u0434)!`, "danger");
        map.health = Math.max(0, map.health - 10);
        checkGameLossSurvival();
        activeVotes = {};
        broadcast("VOTES_UPDATE", { activeVotes, activePlayersCount: getActivePlayersCount() });
        broadcast("SYNC_APP_STATE", { map, gameState, messages });
      }
    }
  }, 1e3);
}
initTurnTimerClock();
var PLAYER_DB_FILE = import_path.default.join(process.cwd(), "db_players.json");
var playerDb = {};
try {
  if (import_fs.default.existsSync(PLAYER_DB_FILE)) {
    playerDb = JSON.parse(import_fs.default.readFileSync(PLAYER_DB_FILE, "utf-8"));
  }
} catch (e) {
  console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 db_players.json, \u0441\u043E\u0437\u0434\u0430\u0435\u043C \u043D\u043E\u0432\u044B\u0439:", e);
}
function savePlayerDb() {
  try {
    import_fs.default.writeFileSync(PLAYER_DB_FILE, JSON.stringify(playerDb, null, 2), "utf-8");
  } catch (e) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F db_players.json:", e);
  }
}
var SHOP_ITEMS_FILE = import_path.default.join(process.cwd(), "db_shop_items.json");
var shopItems = [];
try {
  if (import_fs.default.existsSync(SHOP_ITEMS_FILE)) {
    shopItems = JSON.parse(import_fs.default.readFileSync(SHOP_ITEMS_FILE, "utf-8"));
  } else {
    shopItems = [
      { id: "s1", name: "\u0410\u043F\u0442\u0435\u0447\u043A\u0430 \u043F\u0435\u0440\u0432\u043E\u0439 \u043F\u043E\u043C\u043E\u0449\u0438", price: 150, type: "med", description: "\u0411\u044B\u0441\u0442\u0440\u043E \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442 \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u0435 \u043E\u0442\u0440\u044F\u0434\u0430." },
      { id: "s2", name: "\u0410\u043D\u0442\u0438\u0440\u0430\u0434\u0438\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0448\u043F\u0440\u0438\u0446", price: 100, type: "med", description: "\u0412\u044B\u0432\u043E\u0434\u0438\u0442 150 \u0440\u0430\u0434 \u0442\u044F\u0436\u0435\u043B\u044B\u0445 \u0438\u0437\u043E\u0442\u043E\u043F\u043E\u0432." },
      { id: "s3", name: "\u042D\u043A\u0437\u043E\u0441\u043A\u0435\u043B\u0435\u0442 \u041C\u043E\u043D\u043E\u043B\u0438\u0442\u0430", price: 1500, type: "armor", description: "\u041F\u0440\u0435\u0432\u043E\u0441\u0445\u043E\u0434\u043D\u0430\u044F \u0431\u0440\u043E\u043D\u044F." },
      { id: "s4", name: "\u041D\u0430\u0443\u0447\u043D\u0430\u044F \u0430\u043F\u0442\u0435\u0447\u043A\u0430", price: 250, type: "med", description: "\u041F\u0440\u0435\u043C\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u0442\u0430\u043B\u043A\u0435\u0440\u0441\u043A\u0438\u0439 \u043C\u0435\u0434\u0438\u043A\u0430\u043C\u0435\u043D\u0442." },
      { id: "s5", name: "\u0414\u0435\u0442\u0435\u043A\u0442\u043E\u0440 '\u041E\u0442\u043A\u043B\u0438\u043A'", price: 300, type: "misc", description: "\u041F\u0440\u043E\u0441\u0442\u043E\u0439 \u0434\u0435\u0442\u0435\u043A\u0442\u043E\u0440 \u0430\u0440\u0442\u0435\u0444\u0430\u043A\u0442\u043E\u0432." }
    ];
    import_fs.default.writeFileSync(SHOP_ITEMS_FILE, JSON.stringify(shopItems, null, 2), "utf-8");
  }
} catch (e) {
  console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 db_shop_items.json:", e);
}
function saveShopItems() {
  try {
    import_fs.default.writeFileSync(SHOP_ITEMS_FILE, JSON.stringify(shopItems, null, 2), "utf-8");
  } catch (e) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F db_shop_items.json:", e);
  }
}
var TAVERN_SETTINGS_FILE = import_path.default.join(process.cwd(), "db_tavern_settings.json");
var tavernSettings = {
  tavernName: "\u0411\u0430\u0440 \xAB100 \u0420\u0435\u043D\u0442\u0433\u0435\u043D\xBB",
  merchantName: "\u0421\u0438\u0434\u043E\u0440\u043E\u0432\u0438\u0447",
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
  if (import_fs.default.existsSync(TAVERN_SETTINGS_FILE)) {
    tavernSettings = JSON.parse(import_fs.default.readFileSync(TAVERN_SETTINGS_FILE, "utf-8"));
    if (!tavernSettings.merchantName) {
      tavernSettings.merchantName = "\u0421\u0438\u0434\u043E\u0440\u043E\u0432\u0438\u0447";
    }
  } else {
    import_fs.default.writeFileSync(TAVERN_SETTINGS_FILE, JSON.stringify(tavernSettings, null, 2), "utf-8");
  }
} catch (e) {
  console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 db_tavern_settings.json, \u0441\u043E\u0437\u0434\u0430\u0435\u043C \u0434\u0435\u0444\u043E\u043B\u0442:", e);
}
function saveTavernSettings() {
  try {
    import_fs.default.writeFileSync(TAVERN_SETTINGS_FILE, JSON.stringify(tavernSettings, null, 2), "utf-8");
  } catch (e) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F db_tavern_settings.json:", e);
  }
}
function formatCredits(amount) {
  const lastDigit = amount % 10;
  const lastTwoDigits = amount % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return `${amount} \u043A\u0440\u0435\u0434\u0438\u0442\u043E\u0432`;
  }
  if (lastDigit === 1) {
    return `${amount} \u043A\u0440\u0435\u0434\u0438\u0442`;
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${amount} \u043A\u0440\u0435\u0434\u0438\u0442\u0430`;
  }
  return `${amount} \u043A\u0440\u0435\u0434\u0438\u0442\u043E\u0432`;
}
function initPlayerProfile(id, username) {
  if (!playerDb[id]) {
    playerDb[id] = {
      userName: username,
      balance: 1e3,
      unlockedCards: ["+1", "-1", "+2", "-2", "+3", "-3", "+4", "-4", "+5", "-5"],
      pazaakDeck: []
    };
    savePlayerDb();
    appendSystemMessage(`\u{1F464} \u0411\u0430\u0437\u0430 \u0414\u0430\u043D\u043D\u044B\u0445: \u0421\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D \u043A\u043E\u0448\u0435\u043B\u0435\u043A \u0432 \u041A\u041F\u041A-\u0441\u0435\u0442\u0438 \u0434\u043B\u044F \u0441\u0442\u0430\u043B\u043A\u0435\u0440\u0430 "${username}" (+1000 \u043A\u0440.).`, "info");
  } else if (!playerDb[id].userName) {
    playerDb[id].userName = username;
    savePlayerDb();
  }
  return playerDb[id];
}
function broadcastTavernGames() {
  broadcast("SYNC_TAVERN_GAMES", { pazaakLobbies, playerDb, activeRace, shopItems, tavernSettings });
}
var pazaakLobbies = {};
var activeSvinyaBets = {};
var activeDiceGames = {};
var SELF_ID_FIELDS = {
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
var BET_FIELDS = {
  PAZAAK_CREATE_LOBBY: "bet",
  DICE_PLAY_BOT: "bet",
  RACE_PLACE_BET: "betAmount",
  SLOTS_SPIN: "bet",
  ROULETTE_SPIN: "betAmount",
  SHOOTING_RANGE_FINISH: "bet",
  THIMBLERIG_PLAY: "bet",
  SVINYA_START: "bet"
};
var BAR_ACTIVITY_COMMANDS = /* @__PURE__ */ new Set([
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
function sendError(ws, text) {
  ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text, type: "danger" } }));
}
function isPositiveCreditAmount(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 1e6;
}
function isValidPlayerIdentity(id, username) {
  return typeof id === "string" && typeof username === "string" && id === username && id.trim() === id && id.length >= 1 && id.length <= 40 && id !== "__proto__" && id !== "prototype" && id !== "constructor" && !/[\u0000-\u001f\u007f]/.test(id);
}
var activeRace = {
  status: "none",
  contestants: [
    { name: "\u0411\u0443\u044F\u043D \u{1F40E}", position: 0, odds: 1.4, color: "text-amber-500", type: "favorite" },
    { name: "\u0428\u0443\u0441\u0442\u0440\u044B\u0439 \u{1F41C}", position: 0, odds: 2, color: "text-emerald-500", type: "balanced" },
    { name: "\u0423\u0441\u0430\u0447 \u0421\u0438\u0434\u043E\u0440\u043E\u0432\u0438\u0447\u0430 \u{1FAB3}", position: 0, odds: 2.6, color: "text-yellow-500", type: "balanced" },
    { name: "\u0420\u0436\u0430\u0432\u044B\u0439 \u0411\u043E\u043B\u0442 \u{1F697}", position: 0, odds: 4, color: "text-cyan-500", type: "underdog" }
  ],
  bets: [],
  winner: null,
  log: [],
  tickCount: 0
};
var activeRaceInterval = null;
function rollPazaakStep(lobby) {
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
  const drawn = Math.floor(Math.random() * 10) + 1;
  if (isA) {
    lobby.playerABoard.push(drawn);
    lobby.playerAScore = lobby.playerABoard.reduce((sum, b) => sum + b, 0);
    lobby.log.push(`${lobby.creatorName} \u0442\u044F\u043D\u0435\u0442 \u043A\u0430\u0440\u0442\u0443: ${drawn}. \u0421\u0447\u0435\u0442: ${lobby.playerAScore}`);
    if (lobby.playerAScore > 20) {
      lobby.statusMessage = `${lobby.creatorName} \u0440\u0435\u0448\u0430\u0435\u0442 \u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C \u0441 \u043F\u0435\u0440\u0435\u0431\u043E\u0440\u043E\u043C (${lobby.playerAScore})...`;
    } else {
      lobby.statusMessage = `\u0425\u043E\u0434 ${lobby.creatorName} (${lobby.playerAScore}). \u0421\u044B\u0433\u0440\u0430\u0439\u0442\u0435 \u043A\u0430\u0440\u0442\u0443 \u041A\u041F\u041A \u0438\u043B\u0438 \u043F\u0430\u0441\u0443\u0439\u0442\u0435.`;
    }
  } else {
    lobby.playerBBoard.push(drawn);
    lobby.playerBScore = lobby.playerBBoard.reduce((sum, b) => sum + b, 0);
    lobby.log.push(`${lobby.opponentName} \u0442\u044F\u043D\u0435\u0442 \u043A\u0430\u0440\u0442\u0443: ${drawn}. \u0421\u0447\u0435\u0442: ${lobby.playerBScore}`);
    if (lobby.playerBScore > 20) {
      lobby.statusMessage = `${lobby.opponentName} \u0440\u0435\u0448\u0430\u0435\u0442 \u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C \u0441 \u043F\u0435\u0440\u0435\u0431\u043E\u0440\u043E\u043C (${lobby.playerBScore})...`;
    } else {
      lobby.statusMessage = `\u0425\u043E\u0434 ${lobby.opponentName} (${lobby.playerBScore}). \u0421\u044B\u0433\u0440\u0430\u0439\u0442\u0435 \u043A\u0430\u0440\u0442\u0443 \u041A\u041F\u041A \u0438\u043B\u0438 \u043F\u0430\u0441\u0443\u0439\u0442\u0435.`;
    }
  }
  if (lobby.opponentId === "BOT_BAR" && lobby.turn === "BOT_BAR" && !lobby.playerBStand) {
    runPazaakBotTurn(lobby);
  }
}
function runPazaakBotTurn(lobby) {
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
        if (score - amt === 20 || score > 20 && score - amt <= 20) val = -amt;
      } else if (card === "D") {
        const last = lobby.playerBBoard[lobby.playerBBoard.length - 1] || 0;
        if (score + last === 20) val = last;
      }
      if (val !== 0) {
        lobby.playerBBoard.push(val);
        lobby.playerBScore = lobby.playerBBoard.reduce((sum, b) => sum + b, 0);
        lobby.log.push(`\u{1F916} \u0425\u0430\u0440\u043E\u043D \u0441\u044B\u0433\u0440\u0430\u043B \u043A\u0430\u0440\u0442\u0443 [${card}] (\u044D\u0444\u0444\u0435\u043A\u0442: ${val > 0 ? "+" : ""}${val}). \u0421\u0447\u0435\u0442: ${lobby.playerBScore}`);
        lobby.playerBHands[i] = null;
        playedCard = true;
        break;
      }
    }
    score = lobby.playerBScore;
    if (score === 20 || score >= 18 && score >= lobby.playerAScore && lobby.playerAStand || score >= 18 && !lobby.playerAStand) {
      lobby.playerBStand = true;
      lobby.log.push(`\u{1F916} \u0425\u0430\u0440\u043E\u043D \u043E\u0431\u044A\u044F\u0432\u0438\u043B STAND (\u0444\u0438\u043A\u0441\u0430\u0446\u0438\u044F) \u043D\u0430 ${score}`);
    } else if (score > 20) {
      lobby.log.push(`\u{1F916} \u0425\u0430\u0440\u043E\u043D \u0441\u043C\u0438\u0440\u0438\u043B\u0441\u044F \u0441 \u043F\u0435\u0440\u0435\u0431\u043E\u0440\u043E\u043C \u0432 ${score} \u043E\u0447\u043A\u043E\u0432.`);
    } else {
      lobby.log.push(`\u{1F916} \u0425\u0430\u0440\u043E\u043D \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B \u0445\u043E\u0434 \u043D\u0430 \u0441\u0447\u0435\u0442\u0435 ${score}`);
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
function checkPazaakRoundEnd(lobby) {
  const pAOver = lobby.playerAScore > 20;
  const pBOver = lobby.playerBScore > 20;
  const bothStood = lobby.playerAStand && lobby.playerBStand;
  const nineCardsA = lobby.playerABoard.filter((c) => c > 0).length >= 9;
  const nineCardsB = lobby.playerBBoard.filter((c) => c > 0).length >= 9;
  let roundWinner = null;
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
      lobby.log.push(`\u{1F3C1} \u0420\u0430\u0443\u043D\u0434 \u0432\u044B\u0438\u0433\u0440\u0430\u043B ${lobby.creatorName} (${lobby.playerAScore} \u043F\u0440\u043E\u0442\u0438\u0432 ${lobby.playerBScore})!`);
    } else if (roundWinner === "B") {
      lobby.roundsWonB++;
      lobby.log.push(`\u{1F3C1} \u0420\u0430\u0443\u043D\u0434 \u0432\u044B\u0438\u0433\u0440\u0430\u043B ${lobby.opponentName} (${lobby.playerAScore} \u043F\u0440\u043E\u0442\u0438\u0432 ${lobby.playerBScore})!`);
    } else {
      lobby.log.push(`\u{1F3C1} \u0420\u0430\u0443\u043D\u0434 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0441\u044F \u041C\u0418\u0420\u041D\u041E\u0419 \u041D\u0418\u0427\u042C\u0415\u0419 \u043D\u0430 \u0441\u0447\u0435\u0442\u0435 ${lobby.playerAScore}!`);
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
      lobby.statusMessage = `\u041F\u043E\u0431\u0435\u0434\u043D\u044B\u0439 \u0444\u0438\u043D\u0430\u043B! ${lobby.creatorName} \u0440\u0430\u0437\u0433\u0440\u043E\u043C\u0438\u043B \u043E\u043F\u043F\u043E\u043D\u0435\u043D\u0442\u0430 ${lobby.roundsWonA}:${lobby.roundsWonB}!`;
      lobby.log.push(`\u{1F3C6} ${lobby.creatorName} \u0437\u0430\u0431\u0438\u0440\u0430\u0435\u0442 \u0432\u0441\u0435! \u0412\u044B\u0438\u0433\u0440\u044B\u0448: +${formatCredits(lobby.bet)}`);
      if (playerDb[lobby.creatorId]) {
        playerDb[lobby.creatorId].balance += lobby.bet * 2;
      }
      savePlayerDb();
    } else if (lobby.roundsWonB >= 3) {
      lobby.status = "finished";
      lobby.winner = lobby.opponentId;
      lobby.statusMessage = `\u041F\u043E\u0431\u0435\u0434\u043D\u044B\u0439 \u0444\u0438\u043D\u0430\u043B! ${lobby.opponentName} \u0440\u0430\u0437\u0433\u0440\u043E\u043C\u0438\u043B \u043E\u043F\u043F\u043E\u043D\u0435\u043D\u0442\u0430 ${lobby.roundsWonB}:${lobby.roundsWonA}!`;
      lobby.log.push(`\u{1F3C6} ${lobby.opponentName} \u043E\u0434\u0435\u0440\u0436\u0430\u043B \u043E\u043A\u043E\u043D\u0447\u0430\u0442\u0435\u043B\u044C\u043D\u0443\u044E \u043F\u043E\u0431\u0435\u0434\u0443!`);
      if (lobby.opponentId !== "BOT_BAR" && playerDb[lobby.opponentId]) {
        playerDb[lobby.opponentId].balance += lobby.bet * 2;
      } else if (lobby.opponentId === "BOT_BAR") {
        lobby.log.push(`\u{1F4B8} \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${lobby.creatorName} \u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0441\u0442\u0430\u0432\u043A\u0443 ${formatCredits(lobby.bet)} \u0443 \u0431\u0430\u0440\u043C\u0435\u043D\u0430.`);
      }
      savePlayerDb();
    } else {
      lobby.statusMessage = `\u0420\u0430\u0443\u043D\u0434 \u043F\u043E\u0437\u0430\u0434\u0438! \u0421\u0447\u0435\u0442 \u0432\u043E \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u0445 ${lobby.roundsWonA}:${lobby.roundsWonB}. \u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0440\u0430\u0443\u043D\u0434 \u0443\u0436\u0435 \u0432 \u0440\u0430\u0437\u0434\u0430\u0447\u0435!`;
      lobby.turn = lobby.creatorId;
      rollPazaakStep(lobby);
    }
  }
}
function evaluateDiceHand(dice) {
  const counts = {};
  dice.forEach((d) => counts[d] = (counts[d] || 0) + 1);
  const values = Object.values(counts).sort((a, b) => b - a);
  const keys = Object.keys(counts).map(Number).sort((a, b) => b - a);
  const totalSum = dice.reduce((a, b) => a + b, 0);
  const uniqueCount = Object.keys(counts).length;
  const isStraight = uniqueCount === 5 && Math.max(...dice) - Math.min(...dice) === 4;
  if (values[0] === 5) return { rank: 8, name: "\u041F\u042F\u0422\u0415\u0420\u041A\u0410 (\u041F\u041E\u041A\u0415\u0420 \u0417\u041E\u041D\u042B) \u{1F30C}", score: 5e3 + keys[0] };
  if (values[0] === 4) return { rank: 7, name: "\u041A\u0410\u0420\u0415 (\u0427\u0435\u0442\u044B\u0440\u0435 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0445) \u26A1", score: 4e3 + keys[0] * 10 };
  if (values[0] === 3 && values[1] === 2) {
    const tripVal = Number(Object.keys(counts).find((k) => counts[Number(k)] === 3));
    return { rank: 6, name: "\u0424\u0423\u041B\u041B-\u0425\u0410\u0423\u0421 (\u0422\u0440\u0438 + \u041F\u0430\u0440\u0430) \u{1F3E0}", score: 3e3 + tripVal * 10 };
  }
  if (isStraight) return { rank: 5, name: "\u0421\u0422\u0420\u0418\u0422 (\u041F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C) \u{1F4CF}", score: 2e3 + Math.max(...dice) };
  if (values[0] === 3) return { rank: 4, name: "\u0422\u0420\u041E\u0419\u041A\u0410 (\u0422\u0440\u0438 \u043A\u043E\u0441\u0442\u0438) \u{1F552}", score: 1e3 + keys[0] };
  if (values[0] === 2 && values[1] === 2) {
    const pairs = Object.keys(counts).filter((k) => counts[Number(k)] === 2).map(Number).sort((a, b) => b - a);
    return { rank: 3, name: "\u0414\u0412\u0415 \u041F\u0410\u0420\u042B \u{1F465}", score: 500 + pairs[0] * 10 + pairs[1] };
  }
  if (values[0] === 2) {
    const pairVal = Number(Object.keys(counts).find((k) => counts[Number(k)] === 2));
    return { rank: 2, name: "\u041F\u0410\u0420\u0410 (\u0414\u0432\u0435 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0445) \u{1F91D}", score: 200 + pairVal * 10 };
  }
  return { rank: 1, name: "\u0421\u0422\u0410\u0420\u0428\u0410\u042F \u041A\u041E\u0421\u0422\u042C \u{1F3B2}", score: totalSum };
}
wss.on("connection", (ws) => {
  console.log("\u041D\u043E\u0432\u043E\u0435 \u0441\u043E\u043A\u0435\u0442-\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435.");
  ws.on("message", (messageStr) => {
    try {
      const parsedMessage = JSON.parse(messageStr.toString());
      const type = parsedMessage?.type;
      const payload = parsedMessage?.payload ?? {};
      if (typeof type !== "string" || typeof payload !== "object" || Array.isArray(payload)) {
        sendError(ws, "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u044B.");
        return;
      }
      if (gameState === "playing" && BAR_ACTIVITY_COMMANDS.has(type)) {
        sendError(ws, "\u0411\u0430\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0439 \u044D\u043A\u0441\u043F\u0435\u0434\u0438\u0446\u0438\u0438.");
        return;
      }
      const selfIdField = SELF_ID_FIELDS[type];
      if (selfIdField) {
        const player = clients.get(ws);
        if (!player || payload[selfIdField] !== player.id) {
          sendError(ws, "\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430: \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u0435\u043B\u044F \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u043F\u0440\u043E\u0444\u0438\u043B\u0435\u043C \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438.");
          return;
        }
        if ("username" in payload) payload.username = player.username;
        if ("creatorName" in payload) payload.creatorName = player.username;
        if ("opponentName" in payload) payload.opponentName = player.username;
      }
      const betField = BET_FIELDS[type];
      if (betField && !isPositiveCreditAmount(payload[betField])) {
        sendError(ws, "\u0421\u0442\u0430\u0432\u043A\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u0446\u0435\u043B\u044B\u043C \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u043C \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 1 000 000.");
        return;
      }
      switch (type) {
        case "JOIN": {
          const { id, username, role } = payload;
          if (!isValidPlayerIdentity(id, username) || role !== "player" && role !== "gm") {
            sendError(ws, "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0438\u043C\u044F \u043F\u0440\u043E\u0444\u0438\u043B\u044F \u0438\u043B\u0438 \u0440\u043E\u043B\u044C.");
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
          initPlayerProfile(id, username);
          clients.set(ws, { id, username, role });
          console.log(`\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C ${username} \u0432\u043E\u0448\u0435\u043B \u043A\u0430\u043A ${role}`);
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
          broadcastTavernGames();
          ws.send(JSON.stringify({ type: "VOTES_UPDATE", payload: { activeVotes, activePlayersCount: getActivePlayersCount() } }));
          break;
        }
        case "SYNC_APP_STATE": {
          const clientData = clients.get(ws);
          if (!clientData || clientData.role !== "gm") {
            sendError(ws, "\u0422\u043E\u043B\u044C\u043A\u043E \u043A\u0443\u0440\u0430\u0442\u043E\u0440 \u043C\u043E\u0436\u0435\u0442 \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u044C \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u044D\u043A\u0441\u043F\u0435\u0434\u0438\u0446\u0438\u0438.");
            return;
          }
          if (payload.gameState !== void 0) gameState = payload.gameState;
          if (payload.map !== void 0) {
            map = payload.map;
            if (map && !map.playerPos) {
              map.playerPos = { x: map.entrance.x, y: map.entrance.y };
            }
          }
          if (payload.messages !== void 0) messages = payload.messages;
          if (payload.stashLoot !== void 0) stashLoot = payload.stashLoot;
          if (payload.artifactLoot !== void 0) artifactLoot = payload.artifactLoot;
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
            sendError(ws, "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0438\u043C\u044F \u043F\u0440\u043E\u0444\u0438\u043B\u044F.");
            ws.close();
            return;
          }
          initPlayerProfile(id, username);
          for (const [socket, player] of clients.entries()) {
            if (player.role === "gm" && player.id !== id) {
              player.role = "player";
              socket.send(JSON.stringify({
                type: "ROLE_KICKED",
                payload: { newRole: "player", message: "\u0412\u0430\u0448\u0438 \u043F\u043E\u043B\u043D\u043E\u043C\u043E\u0447\u0438\u044F GM \u0431\u044B\u043B\u0438 \u043F\u0435\u0440\u0435\u0445\u0432\u0430\u0447\u0435\u043D\u044B \u0434\u0440\u0443\u0433\u0438\u043C \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u043C." }
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
          const allowedActions = /* @__PURE__ */ new Set(["UP", "DOWN", "LEFT", "RIGHT", "BOLT_UP", "BOLT_DOWN", "BOLT_LEFT", "BOLT_RIGHT", "GEIGER", "SCAN"]);
          if (!allowedActions.has(action)) {
            sendError(ws, "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u043D\u0438\u044F.");
            return;
          }
          activeVotes[player.id] = { username: player.username, action };
          const activePlayersCount = getActivePlayersCount();
          const votesCastKeys = Object.keys(activeVotes);
          const totalVotesCast = votesCastKeys.length;
          const counts = {};
          Object.values(activeVotes).forEach((v) => {
            counts[v.action] = (counts[v.action] || 0) + 1;
          });
          let winningAction = null;
          for (const [act, cnt] of Object.entries(counts)) {
            if (cnt > activePlayersCount / 2) {
              winningAction = act;
              break;
            }
          }
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
          if (winningAction) {
            executeGameAction(winningAction);
            activeVotes = {};
            broadcast("VOTES_UPDATE", { activeVotes, activePlayersCount });
            broadcast("SYNC_APP_STATE", { map, gameState, messages });
          } else {
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
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          break;
        }
        case "ANOMALY_ACK": {
          const encounter = map?.activeAnomalyEncounter;
          if (!clients.has(ws) || !encounter?.result || payload.seed !== encounter.seed) return;
          map.activeAnomalyEncounter = null;
          checkGameLossSurvival();
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          break;
        }
        case "ANOMALY_PUZZLE": {
          const player = clients.get(ws), encounter = map?.activeAnomalyEncounter;
          if (!player || !encounter?.puzzle || encounter.result || encounter.paused || payload.seed !== encounter.seed) return;
          const status = applyPuzzleInput(encounter.puzzle, payload.input);
          if (status === "ignored") return;
          if (!encounter.participants.includes(player.username)) encounter.participants.push(player.username);
          encounter.elapsedRounds++;
          encounter.decisions.push(`${player.username}: ${JSON.stringify(payload.input)} \u2014 ${status === "mistake" ? "\u043E\u0448\u0438\u0431\u043A\u0430" : "\u0432\u0435\u0440\u043D\u043E"}`);
          if (status === "mistake") {
            const protection = encounter.preparedActions.indexOf("hybrid-forgiveness");
            if (protection >= 0) encounter.preparedActions.splice(protection, 1);
            else {
              encounter.mistakes++;
              encounter.exposure = Math.min(100, encounter.exposure + 15);
              encounter.anomalyStability = Math.max(0, encounter.anomalyStability - 20);
            }
          } else {
            const puzzle = encounter.puzzle;
            encounter.progress = puzzle.kind === "wires" ? puzzle.connected.length : puzzle.kind === "sequence" ? puzzle.cursor : puzzle.visited.length - 1;
          }
          updateEncounterPhase(encounter, ANOMALY_BY_ID[encounter.anomalyId]);
          if (status === "complete") finishEncounter(encounter.mistakes ? "successWithCost" : "completeSuccess");
          else if (encounter.mistakes >= encounter.puzzle.limit) finishEncounter(encounter.progress ? "partialFailure" : "failure");
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          break;
        }
        case "ANOMALY_ACTION": {
          const player = clients.get(ws);
          const encounter = map?.activeAnomalyEncounter;
          const definition2 = encounter && ANOMALY_BY_ID[encounter.anomalyId];
          if (!player || !encounter || !definition2) return;
          if (payload.actionId !== "retreat") {
            sendError(ws, "\u0412 \u0440\u0435\u0436\u0438\u043C\u0435 GURPS \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0441\u0435\u0440\u0438\u044E \u043F\u0440\u043E\u0432\u0435\u0440\u043E\u043A \u043D\u0430\u0432\u044B\u043A\u043E\u0432.");
            return;
          }
          const action = definition2.minigame.actions.find((candidate) => candidate.id === payload.actionId);
          if (!action) {
            sendError(ws, "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u0438.");
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
            sendError(ws, "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 GURPS \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B \u0432 \u0440\u0435\u0436\u0438\u043C\u0435 \u0447\u0438\u0441\u0442\u043E\u0439 \u043C\u0438\u043D\u0438-\u0438\u0433\u0440\u044B.");
            return;
          }
          const target = Number(payload.target);
          if (String(payload.skillTag || "manual") === "manual" && player.role !== "gm") {
            sendError(ws, "\u041F\u0440\u043E\u0438\u0437\u0432\u043E\u043B\u044C\u043D\u044B\u0439 \u043D\u0430\u0432\u044B\u043A \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u0432\u0435\u0434\u0443\u0449\u0438\u0439.");
            return;
          }
          if (encounter.mode === "hybrid" && encounter.rollResults.length >= 3) {
            sendError(ws, "\u0412 \u0433\u0438\u0431\u0440\u0438\u0434\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0442\u0440\u0438 \u0432\u0441\u043F\u043E\u043C\u043E\u0433\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043D\u0430 \u0441\u0446\u0435\u043D\u0443.");
            return;
          }
          if (!Number.isFinite(target)) {
            sendError(ws, "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0446\u0435\u043B\u0435\u0432\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043D\u0430\u0432\u044B\u043A\u0430.");
            return;
          }
          resolveGurpsRoll(String(payload.skillTag || "manual"), target, player.username, payload.foundryItemUuid ? String(payload.foundryItemUuid) : void 0);
          const current = map.activeAnomalyEncounter;
          const definition2 = current && ANOMALY_BY_ID[current.anomalyId];
          if (current && definition2 && current.mode === "gurps-roll" && current.rollResults.length >= 5 && !current.result) {
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
          const allowedResults = ["completeSuccess", "successWithCost", "partialFailure", "failure", "criticalFailure", "retreat"];
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
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u0422\u043E\u0440\u0433\u043E\u0432\u043B\u044F \u043A\u0430\u0440\u0442\u0430\u043C\u0438 \u041F\u0430\u0430\u0437\u0430\u043A \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!", type: "danger" } }));
              return;
            }
          }
          const { playerId, username } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (profile.balance < 300) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0435 \u041A\u041F\u041A! \u0411\u0443\u0441\u0442\u0435\u0440 \u0441\u0442\u043E\u0438\u0442 300 \u043A\u0440\u0435\u0434\u0438\u0442\u043E\u0432.", type: "danger" } }));
            return;
          }
          profile.balance -= 300;
          const premiumPool = ["+/-1", "+/-2", "+/-3", "+/-4", "+/-5", "+/-6", "D", "T", "+/-1 or 2", "2&4", "3&6"];
          const pulled = [];
          for (let i = 0; i < 3; i++) {
            pulled.push(premiumPool[Math.floor(Math.random() * premiumPool.length)]);
          }
          profile.unlockedCards = [...profile.unlockedCards, ...pulled];
          savePlayerDb();
          ws.send(JSON.stringify({
            type: "BOOSTER_PULLED_SUCCESS",
            payload: { pulled, profile }
          }));
          appendSystemMessage(`\u{1F0CF} ${username} \u043F\u0440\u0438\u043E\u0431\u0440\u0435\u043B \u0431\u0443\u0441\u0442\u0435\u0440 \u041F\u0430\u0430\u0437\u0430\u043A\u0430 \u0437\u0430 300 \u043A\u0440\u0435\u0434\u0438\u0442\u043E\u0432 \u0438 \u0432\u044B\u0442\u0430\u0449\u0438\u043B: [${pulled.join(", ")}]!`, "loot");
          broadcastTavernGames();
          break;
        }
        case "PAZAAK_SAVE_DECK": {
          const { playerId, deck } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          const availableCards = [...profile.unlockedCards];
          const ownsEveryCard = Array.isArray(deck) && deck.every((card) => {
            if (typeof card !== "string") return false;
            const ownedIndex = availableCards.indexOf(card);
            if (ownedIndex < 0) return false;
            availableCards.splice(ownedIndex, 1);
            return true;
          });
          if (Array.isArray(deck) && deck.length === 8 && ownsEveryCard) {
            profile.pazaakDeck = deck;
            savePlayerDb();
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u2705 \u041A\u043E\u043B\u043E\u0434\u0430 \u041F\u0430\u0430\u0437\u0430\u043A\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430!", type: "success" } }));
            broadcastTavernGames();
          } else {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041E\u0448\u0438\u0431\u043A\u0430: \u043A\u043E\u043B\u043E\u0434\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E 8 \u043A\u0430\u0440\u0442!", type: "danger" } }));
          }
          break;
        }
        case "PAZAAK_CREATE_LOBBY": {
          if (!tavernSettings.enabledGames.pazaak) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u0414\u0443\u044D\u043B\u044C\u043D\u044B\u0439 \u0441\u0442\u043E\u043B \u041F\u0430\u0430\u0437\u0430\u043A\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0437\u0430\u043A\u0440\u044B\u0442 \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!", type: "danger" } }));
              return;
            }
          }
          const { creatorId, creatorName, opponentId, bet } = payload;
          const profile = playerDb[creatorId];
          if (!profile) return;
          const creatorDeck = [...profile.pazaakDeck || []];
          if (creatorDeck.length < 8) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041E\u0448\u0438\u0431\u043A\u0430: \u0423 \u0432\u0430\u0441 \u0432\u044B\u0431\u0440\u0430\u043D\u043E \u043C\u0435\u043D\u044C\u0448\u0435 8 \u043A\u0430\u0440\u0442! \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u043A\u043E\u043B\u043E\u0434\u0443.", type: "danger" } }));
            return;
          }
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u041A\u041F\u041A \u0434\u043B\u044F \u0441\u043E\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0441\u0442\u0430\u0432\u043A\u0438!", type: "danger" } }));
            return;
          }
          const lobbyId = "pz_" + Math.random().toString(36).substring(2, 9);
          profile.balance -= bet;
          savePlayerDb();
          const getRandomSubarray = (arr, size) => {
            const shuffled = [...arr].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, size);
          };
          const playerAHands = getRandomSubarray(creatorDeck, 4);
          const botDeckPool = ["+1", "-1", "+2", "-2", "+3", "-3", "+/-1", "+/-2", "D", "T"];
          const botDeck8 = getRandomSubarray(botDeckPool, 8);
          const playerBHands = opponentId === "BOT_BAR" ? getRandomSubarray(botDeck8, 4) : [];
          const newLobby = {
            id: lobbyId,
            creatorId,
            creatorName,
            creatorDeck,
            opponentId,
            opponentName: opponentId === "BOT_BAR" ? "\u0425\u0430\u0440\u043E\u043D (\u0411\u0430\u0440\u043C\u0435\u043D)" : null,
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
            log: [`\u041D\u0430\u0447\u0430\u0442\u0430 \u0432\u0441\u0442\u0440\u0435\u0447\u0430 \u041F\u0430\u0430\u0437\u0430\u043A \u043C\u0435\u0436\u0434\u0443 ${creatorName} \u0441\u043E \u0441\u0442\u0430\u0432\u043A\u043E\u0439 ${formatCredits(bet)}.`],
            statusMessage: opponentId === "BOT_BAR" ? "\u0418\u0433\u0440\u0430 \u043D\u0430\u0447\u0430\u043B\u0430\u0441\u044C!" : "\u041E\u0436\u0438\u0434\u0430\u0435\u043C \u043E\u043F\u043F\u043E\u043D\u0435\u043D\u0442\u0430...",
            winner: null
          };
          pazaakLobbies[lobbyId] = newLobby;
          if (opponentId === "BOT_BAR") {
            rollPazaakStep(newLobby);
          }
          appendSystemMessage(`\u{1F3B2} \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${creatorName} \u043E\u0442\u043A\u0440\u044B\u043B \u0441\u0442\u043E\u043B \u041F\u0430\u0430\u0437\u0430\u043A \u0441\u043E \u0441\u0442\u0430\u0432\u043A\u043E\u0439 ${formatCredits(bet)}.`, "info");
          broadcastTavernGames();
          break;
        }
        case "PAZAAK_JOIN_LOBBY": {
          if (!tavernSettings.enabledGames.pazaak) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u0414\u0443\u044D\u043B\u044C\u043D\u044B\u0439 \u0441\u0442\u043E\u043B \u041F\u0430\u0430\u0437\u0430\u043A\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0437\u0430\u043A\u0440\u044B\u0442 \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!", type: "danger" } }));
              return;
            }
          }
          const { lobbyId, opponentId, opponentName } = payload;
          const lobby = pazaakLobbies[lobbyId];
          if (!lobby || lobby.status !== "waiting") return;
          const profile = playerDb[opponentId];
          if (!profile) return;
          const oppDeck = [...profile.pazaakDeck || []];
          if (oppDeck.length < 8) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041E\u0448\u0438\u0431\u043A\u0430: \u0423 \u0432\u0430\u0441 \u0432\u044B\u0431\u0440\u0430\u043D\u043E \u043C\u0435\u043D\u044C\u0448\u0435 8 \u043A\u0430\u0440\u0442! \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u043A\u043E\u043B\u043E\u0434\u0443.", type: "danger" } }));
            return;
          }
          if (profile.balance < lobby.bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0435 \u041A\u041F\u041A!", type: "danger" } }));
            return;
          }
          profile.balance -= lobby.bet;
          savePlayerDb();
          const getRandomSubarray = (arr, size) => {
            const shuffled = [...arr].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, size);
          };
          lobby.opponentId = opponentId;
          lobby.opponentName = opponentName;
          lobby.opponentDeck = oppDeck;
          lobby.playerBHands = getRandomSubarray(oppDeck, 4);
          lobby.status = "playing";
          lobby.statusMessage = "\u041E\u043F\u043F\u043E\u043D\u0435\u043D\u0442 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F! \u0421\u0434\u0430\u0447\u0430 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0440\u0430\u0443\u043D\u0434\u0430...";
          lobby.log.push(`${opponentName} \u0437\u0430\u0448\u0435\u043B \u0432\u043E \u0432\u0441\u0442\u0440\u0435\u0447\u0443. \u0421\u0442\u0430\u0432\u043A\u0438 \u043F\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u044B.`);
          appendSystemMessage(`\u2694\uFE0F \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${opponentName} \u043F\u0440\u0438\u043D\u044F\u043B \u0434\u0443\u044D\u043B\u044C \u0432 \u041F\u0430\u0430\u0437\u0430\u043A \u043E\u0442 ${lobby.creatorName} \u043D\u0430 ${formatCredits(lobby.bet)}!`, "warning");
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
            lobby.playerAScore = lobby.playerABoard.filter((c) => typeof c === "number").reduce((sum, b) => sum + b, 0);
            lobby.playerAHands[cardIndex] = null;
            lobby.log.push(`${lobby.creatorName} \u0441\u044B\u0433\u0440\u0430\u043B \u043A\u0430\u0440\u0442\u0443 [${card}] (\u044D\u0444\u0444\u0435\u043A\u0442: ${val > 0 ? "+" : ""}${val}). \u0421\u0447\u0435\u0442: ${lobby.playerAScore}`);
          } else {
            lobby.playerBBoard.push(val);
            if (card === "T") lobby.playerBBoard.push("T");
            lobby.playerBScore = lobby.playerBBoard.filter((c) => typeof c === "number").reduce((sum, b) => sum + b, 0);
            lobby.playerBHands[cardIndex] = null;
            lobby.log.push(`${lobby.opponentName} \u0441\u044B\u0433\u0440\u0430\u043B \u043A\u0430\u0440\u0442\u0443 [${card}] (\u044D\u0444\u0444\u0435\u043A\u0442: ${val > 0 ? "+" : ""}${val}). \u0421\u0447\u0435\u0442: ${lobby.playerBScore}`);
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
          lobby.log.push(`${isA ? lobby.creatorName : lobby.opponentName} \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u0435\u0442 \u0445\u043E\u0434.`);
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
            lobby.log.push(`${lobby.creatorName} \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043B \u0441\u0447\u0435\u0442 \u043D\u0430 STAND (${lobby.playerAScore})`);
          } else {
            lobby.playerBStand = true;
            lobby.log.push(`${lobby.opponentName} \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043B \u0441\u0447\u0435\u0442 \u043D\u0430 STAND (${lobby.playerBScore})`);
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
          lobby.statusMessage = `${isA ? lobby.creatorName : lobby.opponentName} \u043F\u0440\u0438\u0437\u043D\u0430\u043B \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0441\u0434\u0430\u0447\u0435\u0439.`;
          lobby.log.push(`\u26A0\uFE0F ${isA ? lobby.creatorName : lobby.opponentName} \u043A\u0430\u043F\u0438\u0442\u0443\u043B\u0438\u0440\u043E\u0432\u0430\u043B.`);
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
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u0418\u0433\u0440\u0430 \u0432 \u043A\u043E\u0441\u0442\u0438 \u043D\u0430 \u041A\u041F\u041A \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0437\u0430\u043A\u0440\u044B\u0442\u0430 \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!", type: "danger" } }));
              return;
            }
          }
          const { playerId, username, bet } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0435 \u041A\u041F\u041A!", type: "danger" } }));
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
          appendSystemMessage(`\u{1F3B2} \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${username} \u0431\u0440\u043E\u0441\u0430\u0435\u0442 \u043A\u043E\u0441\u0442\u0438 \u043F\u0440\u043E\u0442\u0438\u0432 \u0431\u0430\u0440\u043C\u0435\u043D\u0430 \u043D\u0430 ${formatCredits(bet)}.`, "info");
          break;
        }
        case "DICE_REROLL": {
          const { playerId } = payload;
          const username = clients.get(ws)?.username || "\u0421\u0442\u0430\u043B\u043A\u0435\u0440";
          const profile = playerDb[playerId];
          const game = activeDiceGames[playerId];
          if (!profile || !game) {
            sendError(ws, "\u0410\u043A\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u0430\u0440\u0442\u0438\u044F \u0432 \u043A\u043E\u0441\u0442\u0438 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430.");
            return;
          }
          const bet = game.bet;
          const playerDice = game.playerDice;
          const botDice = game.botDice;
          const lockedIndexes = Array.isArray(payload.lockedIndexes) && payload.lockedIndexes.length === 5 ? payload.lockedIndexes.map(Boolean) : [false, false, false, false, false];
          const finalPlayerDice = playerDice.map((val, i) => {
            return lockedIndexes[i] ? val : Math.floor(Math.random() * 6) + 1;
          });
          const botCounts = {};
          botDice.forEach((d) => botCounts[d] = (botCounts[d] || 0) + 1);
          const botMaxCount = Math.max(...Object.values(botCounts));
          const targetToLock = Number(Object.keys(botCounts).find((k) => botCounts[Number(k)] === botMaxCount));
          const finalBotDice = botDice.map((val) => {
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
            appendSystemMessage(`\u{1F3B2} \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${username} \u0441\u043E\u0432\u0435\u0440\u0448\u0438\u043B \u043F\u0435\u0440\u0432\u044B\u0439 \u043F\u0435\u0440\u0435\u0431\u0440\u043E\u0441 \u043A\u043E\u0441\u0442\u0435\u0439. \u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u0445\u043E\u0434.`, "info");
          } else {
            delete activeDiceGames[playerId];
            const finalBotHand = evaluateDiceHand(finalBotDice);
            const finalPlayerHand = evaluateDiceHand(finalPlayerDice);
            let result = "lose";
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
              message = `\u{1F389} \u0412\u042B \u0412\u042B\u0418\u0413\u0420\u0410\u041B\u0418! \u0412\u0430\u0448\u0438 [${finalPlayerHand.name}] \u0443\u0434\u0435\u043B\u0430\u043B\u0438 \u043A\u043E\u0441\u0442\u0438 \u0431\u0430\u0440\u043C\u0435\u043D\u0430 [${finalBotHand.name}]! +${formatCredits(bet)}!`;
              appendSystemMessage(`\u{1F389} \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${username} \u0432\u044B\u0438\u0433\u0440\u0430\u043B +${formatCredits(bet)} \u0443 \u0431\u0430\u0440\u043C\u0435\u043D\u0430 \u0432 \u041A\u043E\u0441\u0442\u0438 \u0441\u043E \u0441\u0447\u0435\u0442\u043E\u043C [${finalPlayerHand.name}]!`, "success");
            } else if (result === "lose") {
              prize = 0;
              message = `\u{1F4B8} \u0423\u0432\u044B! \u0411\u0430\u0440\u043C\u0435\u043D \u043E\u0431\u044B\u0433\u0440\u0430\u043B \u0432\u0430\u0441 \u0441\u0432\u043E\u0435\u0439 \u0440\u0443\u043A\u043E\u0439 [${finalBotHand.name}] \u043F\u0440\u043E\u0442\u0438\u0432 \u0432\u0430\u0448\u0438\u0445 [${finalPlayerHand.name}].`;
              appendSystemMessage(`\u{1F4B8} \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${username} \u043F\u0440\u043E\u0438\u0433\u0440\u0430\u043B \u0441\u0442\u0430\u0432\u043A\u0443 \u0432 \u043A\u043E\u0441\u0442\u0438 \u0431\u0430\u0440\u043C\u0435\u043D\u0443 (\u043F\u0440\u043E\u0438\u0433\u0440\u0430\u043B \u0441 ${finalPlayerHand.name} \u043F\u0440\u043E\u0442\u0438\u0432 ${finalBotHand.name}).`, "info");
            } else {
              prize = bet;
              profile.balance += prize;
              message = `\u{1F91D} \u041D\u0438\u0447\u044C\u044F! \u041A\u043E\u0441\u0442\u0438 \u0441\u043E\u0448\u043B\u0438\u0441\u044C \u0432 \u043A\u043E\u043C\u0431\u0438\u043D\u0430\u0446\u0438\u0438 [${finalPlayerHand.name}]. \u0421\u0442\u0430\u0432\u043A\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0430.`;
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
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u0422\u043E\u0442\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440 \u0441\u043A\u0430\u0447\u0435\u043A \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C \u0431\u0430\u0440\u0430!", type: "danger" } }));
              return;
            }
          }
          const { playerId, username, contestantName, betAmount } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (!activeRace.contestants.some((contestant) => contestant.name === contestantName)) {
            sendError(ws, "\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A \u0437\u0430\u0431\u0435\u0433\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.");
            return;
          }
          if (activeRace.status !== "betting" && activeRace.status !== "none") {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u0421\u0442\u0430\u0432\u043A\u0438 \u043D\u0430 \u044D\u0442\u043E\u0442 \u0437\u0430\u0435\u0437\u0434 \u0443\u0436\u0435 \u0437\u0430\u043A\u0440\u044B\u0442\u044B!", type: "danger" } }));
            return;
          }
          if (profile.balance < betAmount) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u041A\u041F\u041A!", type: "danger" } }));
            return;
          }
          activeRace.status = "betting";
          profile.balance -= betAmount;
          savePlayerDb();
          activeRace.bets.push({ playerId, username, contestantName, betAmount });
          activeRace.log.push(`\u{1F4DD} \u0421\u0442\u0430\u0432\u043A\u0430: ${username} \u0437\u0430\u0440\u044F\u0434\u0438\u043B ${formatCredits(betAmount)} \u043D\u0430 "${contestantName}"`);
          broadcastTavernGames();
          break;
        }
        case "RACE_SET_CONTESTANTS": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;
          const { names } = payload;
          if (Array.isArray(names) && names.length >= 2) {
            activeRace.contestants = names.map((name, i) => {
              const types = ["favorite", "balanced", "balanced", "underdog"];
              const muls = [1.8, 3.4, 4.8, 9.5];
              return {
                name,
                position: 0,
                odds: muls[i % muls.length],
                color: ["text-amber-500", "text-emerald-500", "text-yellow-500", "text-cyan-500"][i % 4],
                type: types[i % types.length]
              };
            });
            activeRace.log.push(`\u{1F6E0}\uFE0F \u041A\u0443\u0440\u0430\u0442\u043E\u0440 \u043E\u0431\u043D\u043E\u0432\u0438\u043B \u0441\u043F\u0438\u0441\u043E\u043A \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432 \u0437\u0430\u0431\u0435\u0433\u043E\u0432!`);
            broadcastTavernGames();
          }
          break;
        }
        case "RACE_START_GM": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;
          if (activeRace.status !== "betting" || activeRace.bets.length === 0) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0442 \u043F\u0440\u0438\u043D\u044F\u0442\u044B\u0445 \u0441\u0442\u0430\u0432\u043E\u043A \u0434\u043B\u044F \u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u0431\u0435\u0433\u0430!", type: "danger" } }));
            return;
          }
          activeRace.status = "running";
          activeRace.winner = null;
          activeRace.tickCount = 0;
          activeRace.contestants.forEach((c) => c.position = 0);
          activeRace.log = [`\u{1F3C1} \u041A\u0423\u0420\u0410\u0422\u041E\u0420 \u0414\u0410\u041B \u0421\u0422\u0410\u0420\u0422 \u0417\u0410\u0411\u0415\u0413\u0423! \u0417\u0432\u0435\u0440\u0438 \u0440\u0438\u043D\u0443\u043B\u0438\u0441\u044C \u0432\u043F\u0435\u0440\u0435\u0434!`];
          appendSystemMessage(`\u{1F3C1} \u041D\u0410\u0427\u0410\u041B\u0418\u0421\u042C \u041F\u041E\u0414\u041F\u041E\u041B\u042C\u041D\u042B\u0415 \u0421\u041A\u0410\u0427\u041A\u0418 \u0422\u0410\u0412\u0415\u0420\u041D\u042B! \u0422\u0432\u0430\u0440\u0438 \u043F\u0443\u0449\u0435\u043D\u044B!`, "warning");
          broadcastTavernGames();
          activeRaceInterval = setInterval(() => {
            activeRace.tickCount++;
            let finishReached = false;
            activeRace.contestants.forEach((c) => {
              let delta = 0;
              let eventMsg = "";
              if (c.type === "favorite") {
                delta = Math.floor(Math.random() * 3) + 2;
                if (Math.random() < 0.2) {
                  delta += 2;
                  if (Math.random() < 0.15) eventMsg = `\u{1F525} ${c.name} \u043F\u043E\u0447\u0443\u044F\u043B \u0430\u0437\u0430\u0440\u0442 \u0438 \u043F\u0440\u0438\u0431\u0430\u0432\u0438\u043B \u0445\u043E\u0434\u0443!`;
                }
                if (Math.random() < 0.15) {
                  delta -= 1;
                  if (Math.random() < 0.15) eventMsg = `\u{1F4A8} ${c.name} \u043F\u043E\u043F\u0430\u043B \u0432 \u043F\u044B\u043B\u0435\u0432\u043E\u0439 \u0432\u0438\u0445\u0440\u044C.`;
                }
              } else if (c.type === "balanced") {
                delta = Math.floor(Math.random() * 3) + 1;
                if (Math.random() < 0.35) {
                  delta += 3;
                  if (Math.random() < 0.2) eventMsg = `\u26A1 ${c.name} \u0441\u043E\u0432\u0435\u0440\u0448\u0430\u0435\u0442 \u043E\u0442\u043B\u0438\u0447\u043D\u044B\u0439 \u0440\u044B\u0432\u043E\u043A!`;
                }
                if (Math.random() < 0.15) {
                  delta -= 1;
                  if (Math.random() < 0.15) eventMsg = `\u26A0\uFE0F ${c.name} \u043F\u0440\u0438\u0442\u043E\u0440\u043C\u043E\u0437\u0438\u043B \u043F\u0435\u0440\u0435\u0434 \u0432\u043E\u0440\u043E\u043D\u043A\u043E\u0439.`;
                }
              } else if (c.type === "underdog") {
                delta = Math.floor(Math.random() * 2) + 1;
                if (Math.random() < 0.45) {
                  delta += 4;
                  if (Math.random() < 0.25) eventMsg = `\u{1F680} \u0410\u041D\u041E\u041C\u0410\u041B\u042C\u041D\u042B\u0419 \u0423\u0421\u041A\u041E\u0420\u0418\u0422\u0415\u041B\u042C! ${c.name} \u0431\u0443\u043A\u0432\u0430\u043B\u044C\u043D\u043E \u043B\u0435\u0442\u0438\u0442 \u0432\u043F\u0435\u0440\u0435\u0434!`;
                }
                if (Math.random() < 0.2) {
                  delta -= 2;
                  if (Math.random() < 0.2) eventMsg = `\u{1F43E} ${c.name} \u0441\u043F\u043E\u0442\u043A\u043D\u0443\u043B\u0441\u044F \u0438 \u0437\u0430\u043C\u0435\u0434\u043B\u0438\u043B\u0441\u044F.`;
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
            const sorted = [...activeRace.contestants].sort((a, b) => b.position - a.position);
            if (activeRace.tickCount % 3 === 0) {
              activeRace.log.push(`\u{1F3C3} \u041B\u0438\u0434\u0435\u0440 \u0437\u0430\u0431\u0435\u0433\u0430: "${sorted[0].name}" (\u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043E ${sorted[0].position}%)`);
            }
            if (finishReached) {
              if (activeRaceInterval) {
                clearInterval(activeRaceInterval);
                activeRaceInterval = null;
              }
              const finalSorted = [...activeRace.contestants].sort((a, b) => b.position - a.position);
              const winner = finalSorted[0];
              activeRace.winner = winner.name;
              activeRace.status = "finished";
              activeRace.log.push(`\u{1F3C6} \u041F\u041E\u0411\u0415\u0414\u0418\u0422\u0415\u041B\u042C \u0417\u0410\u0411\u0415\u0413\u0410: "${winner.name}"!`);
              appendSystemMessage(`\u{1F3C1} \u0421\u043A\u0430\u0447\u043A\u0438: \u041F\u043E\u0431\u0435\u0434\u0438\u043B "${winner.name}"!`, "success");
              activeRace.bets.forEach((b) => {
                if (b.contestantName === winner.name) {
                  const winnings = Math.floor(b.betAmount * winner.odds);
                  if (playerDb[b.playerId]) {
                    playerDb[b.playerId].balance += winnings;
                    activeRace.log.push(`\u{1F4B0} ${b.username} \u0437\u0430\u0431\u0438\u0440\u0430\u0435\u0442 \u0432\u044B\u043F\u043B\u0430\u0442\u0443: +${formatCredits(winnings)} (\u043A\u044D\u0444 ${winner.odds}x)!`);
                    appendSystemMessage(`\u{1F4B0} \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${b.username} \u0441\u043E\u0440\u0432\u0430\u043B \u043A\u0443\u0448 \u0432 ${formatCredits(winnings)} \u043D\u0430 "${winner.name}"!`, "loot");
                  }
                } else {
                  activeRace.log.push(`\u{1F940} ${b.username} \u043F\u0440\u043E\u0438\u0433\u0440\u0430\u043B \u0441\u0432\u043E\u044E \u0441\u0442\u0430\u0432\u043A\u0443 \u043D\u0430 ${b.contestantName}`);
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
          activeRace.log = ["\u0417\u0430\u0435\u0437\u0434 \u043E\u0447\u0438\u0449\u0435\u043D \u0438 \u0433\u043E\u0442\u043E\u0432 \u043A \u043D\u043E\u0432\u044B\u043C \u0441\u0442\u0430\u0432\u043A\u0430\u043C."];
          activeRace.contestants.forEach((c) => c.position = 0);
          broadcastTavernGames();
          break;
        }
        case "BAR_SELL_ITEM": {
          if (!tavernSettings.enabledGames.trades) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: `\u274C \u0421\u043A\u0443\u043F\u043A\u0430 \u0443 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430 ${tavernSettings.merchantName || "\u0421\u0438\u0434\u043E\u0440\u043E\u0432\u0438\u0447"} \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!`, type: "danger" } }));
              return;
            }
          }
          const { playerId, username, itemIndex } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (!map || !map.inventory || !map.inventory[itemIndex]) return;
          const itemName = map.inventory[itemIndex];
          let price = 200;
          const matchingShopItem = shopItems.find((item) => item.name === itemName);
          const artifactNames = ["\u041A\u0430\u043F\u043B\u044F", "\u041A\u0440\u043E\u0432\u044C \u043A\u0430\u043C\u043D\u044F", "\u0421\u043B\u0438\u0437\u044C", "\u041A\u043E\u043B\u044E\u0447\u043A\u0430", "\u041C\u0435\u0434\u0443\u0437\u0430", "\u0412\u0441\u043F\u044B\u0448\u043A\u0430", "\u041A\u0440\u0438\u0441\u0442\u0430\u043B\u043B", "\u0411\u0435\u043D\u0433\u0430\u043B\u044C\u0441\u043A\u0438\u0439 \u043E\u0433\u043E\u043D\u044C", "\u041D\u043E\u0447\u043D\u043E\u0439 \u0421\u0432\u0435\u0442\u043E\u0447"];
          const isArtifact = artifactNames.some((art) => itemName.includes(art));
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
          appendSystemMessage(`\u{1F91D} \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${username} \u0441\u0434\u0430\u043B \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0443 ${tavernSettings.merchantName || "\u0421\u0438\u0434\u043E\u0440\u043E\u0432\u0438\u0447"} \u0445\u0430\u0431\u0430\u0440: "${itemName}" \u0437\u0430 ${formatCredits(price)}!`, "loot");
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
            appendSystemMessage(`\u2699\uFE0F \u0421\u0438\u0441\u0442\u0435\u043C\u0430: \u0411\u0430\u043B\u0430\u043D\u0441 \u0438\u0433\u0440\u043E\u043A\u0430 \u0431\u044B\u043B \u043E\u0442\u0440\u0435\u0433\u0443\u043B\u0438\u0440\u043E\u0432\u0430\u043D \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C \u043D\u0430 ${delta > 0 ? "+" : ""}${formatCredits(Math.abs(delta))}.`, "info");
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
            appendSystemMessage(`\u{1F6E1}\uFE0F \u0411\u0430\u0437\u0430 \u0434\u0430\u043D\u043D\u044B\u0445: \u041A\u0443\u0440\u0430\u0442\u043E\u0440 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B \u0431\u0430\u043B\u0430\u043D\u0441 \u0443 \u0438\u0433\u0440\u043E\u043A\u0430 \u0432 \u0440\u0430\u0437\u043C\u0435\u0440\u0435 ${formatCredits(profile.balance)}.`, "info");
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
              appendSystemMessage(`\u{1F6E1}\uFE0F \u0411\u0430\u0437\u0430 \u0434\u0430\u043D\u043D\u044B\u0445: \u041A\u0443\u0440\u0430\u0442\u043E\u0440 \u043E\u0442\u043A\u0440\u044B\u043B \u043A\u0430\u0440\u0442\u0443 [${card}] \u0438\u0433\u0440\u043E\u043A\u0443.`, "info");
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
              balance: 1e3,
              unlockedCards: ["+1", "-1", "+2", "-2", "+3", "-3", "+4", "-4", "+5", "-5"],
              pazaakDeck: []
            };
            savePlayerDb();
            appendSystemMessage(`\u{1F6E1}\uFE0F \u0411\u0430\u0437\u0430 \u0434\u0430\u043D\u043D\u044B\u0445: \u041A\u0443\u0440\u0430\u0442\u043E\u0440 \u0441\u0431\u0440\u043E\u0441\u0438\u043B \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0438\u0433\u0440\u043E\u043A\u0430 \u043A \u043D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u043C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F\u043C!`, "info");
            broadcastTavernGames();
          }
          break;
        }
        case "GM_ADD_SHOP_ITEM": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;
          const { name, price, type: type2, description } = payload;
          const parsedPrice = Number(price);
          if (typeof name !== "string" || !name.trim() || !isPositiveCreditAmount(parsedPrice)) {
            sendError(ws, "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0442\u043E\u0432\u0430\u0440\u0430 \u0438 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0446\u0435\u043B\u0430\u044F \u0446\u0435\u043D\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B.");
            return;
          }
          const newItem = {
            id: "item_" + Math.random().toString(36).substring(2, 9),
            name: name.trim().slice(0, 100),
            price: parsedPrice,
            type: type2 || "misc",
            description: description || "\u0421\u043F\u0435\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0430\u043A\u0430\u0437 \u041A\u041F\u041A"
          };
          shopItems.push(newItem);
          saveShopItems();
          appendSystemMessage(`\u{1F6D2} \u0422\u043E\u0440\u0433\u043E\u0432\u043B\u044F: \u041A\u0443\u0440\u0430\u0442\u043E\u0440 \u0434\u043E\u0431\u0430\u0432\u0438\u043B \u043D\u043E\u0432\u044B\u0439 \u0442\u043E\u0432\u0430\u0440 \u043D\u0430 \u043F\u0440\u0438\u043B\u0430\u0432\u043E\u043A ${tavernSettings.merchantName || "\u0421\u0438\u0434\u043E\u0440\u043E\u0432\u0438\u0447"}: "${name}" \u0437\u0430 ${formatCredits(newItem.price)}!`, "info");
          broadcastTavernGames();
          break;
        }
        case "GM_DELETE_SHOP_ITEM": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;
          const { itemId } = payload;
          const found = shopItems.find((i) => i.id === itemId);
          if (found) {
            shopItems = shopItems.filter((i) => i.id !== itemId);
            saveShopItems();
            appendSystemMessage(`\u{1F5D1}\uFE0F \u0422\u043E\u0440\u0433\u043E\u0432\u043B\u044F: \u041A\u0443\u0440\u0430\u0442\u043E\u0440 \u0443\u0431\u0440\u0430\u043B \u0442\u043E\u0432\u0430\u0440 "${found.name}" \u0441 \u043F\u0440\u0438\u043B\u0430\u0432\u043A\u0430 ${tavernSettings.merchantName || "\u0421\u0438\u0434\u043E\u0440\u043E\u0432\u0438\u0447"}.`, "info");
            broadcastTavernGames();
          }
          break;
        }
        case "GM_UPDATE_TAVERN_SETTINGS": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;
          const { tavernName, merchantName, enabledGames } = payload;
          if (tavernName !== void 0) {
            tavernSettings.tavernName = tavernName;
            appendSystemMessage(`\u2699\uFE0F \u0417\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0435: \u0411\u0430\u0440 \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D \u0432 "${tavernName}"`, "warning");
          }
          if (merchantName !== void 0) {
            tavernSettings.merchantName = merchantName;
            appendSystemMessage(`\u2699\uFE0F \u0417\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0435: \u0422\u043E\u0440\u0433\u043E\u0432\u0435\u0446 \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D \u0432 "${merchantName}"`, "warning");
          }
          if (enabledGames !== void 0) {
            tavernSettings.enabledGames = enabledGames;
            appendSystemMessage(`\u2699\uFE0F \u0417\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0435: \u041A\u0443\u0440\u0430\u0442\u043E\u0440 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u043B \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u0438 \u0438\u0433\u0440 \u0417\u043E\u043D\u044B.`, "info");
          }
          saveTavernSettings();
          broadcastTavernGames();
          break;
        }
        case "BUY_SHOP_ITEM": {
          if (!tavernSettings.enabledGames.trades) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: `\u274C \u0422\u043E\u0440\u0433\u043E\u0432\u0430\u044F \u043B\u0430\u0432\u043A\u0430 ${tavernSettings.merchantName || "\u0421\u0438\u0434\u043E\u0440\u043E\u0432\u0438\u0447\u0430"} \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0437\u0430\u043A\u0440\u044B\u0442\u0430 \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!`, type: "danger" } }));
              return;
            }
          }
          const { playerId, username, itemId } = payload;
          const profile = playerDb[playerId];
          const item = shopItems.find((i) => i.id === itemId);
          if (!profile || !item) return;
          if (!isPositiveCreditAmount(item.price)) {
            sendError(ws, "\u0423 \u0442\u043E\u0432\u0430\u0440\u0430 \u0443\u043A\u0430\u0437\u0430\u043D\u0430 \u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0446\u0435\u043D\u0430.");
            return;
          }
          if (profile.balance < item.price) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u0441\u0447\u0435\u0442\u0435 \u041A\u041F\u041A!", type: "danger" } }));
            return;
          }
          if (!map) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041E\u0448\u0438\u0431\u043A\u0430: \u042D\u043A\u0441\u043F\u0435\u0434\u0438\u0446\u0438\u044F \u0435\u0449\u0435 \u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u0430! \u0412 \u0440\u044E\u043A\u0437\u0430\u043A \u043E\u0442\u0440\u044F\u0434\u0430 \u0441\u0435\u0439\u0447\u0430\u0441 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F.", type: "danger" } }));
            return;
          }
          profile.balance -= item.price;
          savePlayerDb();
          if (!map.inventory) {
            map.inventory = [];
          }
          map.inventory.push(item.name);
          appendSystemMessage(`\u{1F6D2} \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${username} \u043A\u0443\u043F\u0438\u043B \u0443 ${tavernSettings.merchantName || "\u0421\u0438\u0434\u043E\u0440\u043E\u0432\u0438\u0447\u0430"}: "${item.name}" \u0437\u0430 ${formatCredits(item.price)}!`, "loot");
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          broadcastTavernGames();
          break;
        }
        case "GM_ADD_TO_INVENTORY": {
          const player = clients.get(ws);
          if (!player || player.role !== "gm") return;
          const { itemName } = payload;
          if (!map) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u042D\u043A\u0441\u043F\u0435\u0434\u0438\u0446\u0438\u044F \u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u0430!", type: "danger" } }));
            return;
          }
          if (!map.inventory) {
            map.inventory = [];
          }
          map.inventory.push(itemName);
          appendSystemMessage(`\u{1F4E6} \u0420\u044E\u043A\u0437\u0430\u043A: \u041A\u0443\u0440\u0430\u0442\u043E\u0440 \u043D\u0430\u043F\u0440\u044F\u043C\u0443\u044E \u0434\u043E\u0431\u0430\u0432\u0438\u043B "${itemName}" \u0432 \u0440\u044E\u043A\u0437\u0430\u043A \u043E\u0442\u0440\u044F\u0434\u0430!`, "loot");
          broadcast("SYNC_APP_STATE", { map, gameState, messages });
          break;
        }
        case "SLOTS_SPIN": {
          if (!tavernSettings.enabledGames.slots) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u0418\u0433\u0440\u043E\u0432\u043E\u0439 \u0430\u0432\u0442\u043E\u043C\u0430\u0442 '\u0420\u0435\u0430\u043A\u0442\u043E\u0440-\u0421\u043B\u043E\u0442' \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!", type: "danger" } }));
              return;
            }
          }
          const { playerId, bet } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          const activeClient = clients.get(ws);
          const activeUsername = activeClient ? activeClient.username : "\u0421\u0442\u0430\u043B\u043A\u0435\u0440";
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0435 \u041A\u041F\u041A!", type: "danger" } }));
            return;
          }
          profile.balance -= bet;
          const symbols = ["\u2699\uFE0F", "\u2699\uFE0F", "\u2699\uFE0F", "\u{1F96B}", "\u{1F96B}", "\u{1F37E}", "\u{1F37E}", "\u{1F48E}", "\u2622\uFE0F", "\u{1F480}"];
          const r1 = symbols[Math.floor(Math.random() * symbols.length)];
          const r2 = symbols[Math.floor(Math.random() * symbols.length)];
          const r3 = symbols[Math.floor(Math.random() * symbols.length)];
          const reels = [r1, r2, r3];
          let winMultiplier = 0;
          let combinationName = "\u0411\u0435\u0437 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439";
          if (r1 === r2 && r2 === r3) {
            if (r1 === "\u2622\uFE0F") {
              winMultiplier = 15;
              combinationName = "\u0422\u0420\u0418 \u0420\u0410\u0414\u0418\u0410\u0426\u0418\u0418 (\u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0421\u0432\u0435\u0440\u0445\u043F\u0440\u043E\u0432\u043E\u0434\u043D\u0438\u043A\u043E\u0432!) \u2622\uFE0F\u2622\uFE0F\u2622\uFE0F";
            } else if (r1 === "\u{1F48E}") {
              winMultiplier = 10;
              combinationName = "\u0422\u0420\u0418 \u0417\u041E\u041B\u041E\u0422\u042B\u0425 \u0410\u0420\u0422\u0415\u0424\u0410\u041A\u0422\u0410! \u{1F48E}\u{1F48E}\u{1F48E}";
            } else if (r1 === "\u{1F37E}") {
              winMultiplier = 6;
              combinationName = "\u0411\u0410\u0422\u0410\u0420\u0415\u042F \u0412\u041E\u0414\u041A\u0418 \xAB\u041A\u0410\u0417\u0410\u041A\u0418\xBB \u{1F37E}\u{1F37E}\u{1F37E}";
            } else if (r1 === "\u{1F96B}") {
              winMultiplier = 4;
              combinationName = "\u0410\u0420\u041C\u0415\u0419\u0421\u041A\u0418\u0419 \u0417\u0410\u041F\u0410\u0421 \u0421\u0423\u0425\u041F\u0410\u0419\u041A\u0410 \u{1F96B}\u{1F96B}\u{1F96B}";
            } else if (r1 === "\u2699\uFE0F") {
              winMultiplier = 3;
              combinationName = "\u041D\u0410\u0411\u041E\u0420 \u041E\u041F\u041E\u0420\u041D\u042B\u0425 \u0411\u041E\u041B\u0422\u041E\u0412 \u2699\uFE0F\u2699\uFE0F\u2699\uFE0F";
            } else if (r1 === "\u{1F480}") {
              winMultiplier = 2.5;
              combinationName = "\u041C\u0415\u0420\u0422\u0412\u0410\u042F \u041F\u0415\u0422\u041B\u042F \u0425\u0410\u0420\u041E\u041D\u0410 \u{1F480}\u{1F480}\u{1F480}";
            }
          } else if (r1 === r2 || r2 === r3 || r1 === r3) {
            const pairSymbol = r1 === r2 || r1 === r3 ? r1 : r2;
            if (pairSymbol === "\u2622\uFE0F") {
              winMultiplier = 1.8;
              combinationName = "\u0414\u0432\u043E\u0439\u043D\u0430\u044F \u0420\u0430\u0434\u0438\u0430\u0446\u0438\u044F \u2622\uFE0F";
            } else if (pairSymbol === "\u{1F48E}") {
              winMultiplier = 1.5;
              combinationName = "\u0414\u0432\u0430 \u0410\u0440\u0442\u0435\u0444\u0430\u043A\u0442\u0430 \u{1F48E}";
            } else if (pairSymbol === "\u{1F37E}") {
              winMultiplier = 1.3;
              combinationName = "\u041F\u0430\u0440\u0430 \u0411\u0443\u0442\u044B\u043B\u043E\u043A \u0412\u043E\u0434\u043A\u0438";
            } else {
              winMultiplier = 1.1;
              combinationName = "\u0421\u043A\u0440\u043E\u043C\u043D\u0430\u044F \u041F\u0430\u0440\u0430";
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
              message: winAmount > 0 ? `\u{1F389} \u041F\u041E\u0411\u0415\u0414\u0410! \u0412\u044B \u0432\u044B\u0431\u0438\u043B\u0438 [${combinationName}] \u0438 \u0432\u044B\u0438\u0433\u0440\u0430\u043B\u0438 +${formatCredits(winAmount)}!` : `\u{1F4B8} \u0423\u0432\u044B! \u0412\u044B\u043F\u0430\u043B\u043E: ${reels.join(" | ")}. \u041D\u0438 \u0435\u0434\u0438\u043D\u043E\u0439 \u0437\u0430\u0446\u0435\u043F\u043A\u0438. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437!`
            }
          }));
          if (winAmount >= bet * 5) {
            appendSystemMessage(`\u{1F3B0} \u0421\u043B\u043E\u0442-\u041C\u0430\u0448\u0438\u043D\u0430: \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${activeUsername} \u0441\u043E\u0440\u0432\u0430\u043B \u043A\u0443\u0448 \u0432 \u0440\u0430\u0437\u043C\u0435\u0440\u0435 ${formatCredits(winAmount)} \u043D\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0435 (\xAB${combinationName}\xBB)!`, "success");
          }
          broadcastTavernGames();
          break;
        }
        case "ROULETTE_SPIN": {
          if (!tavernSettings.enabledGames.roulette) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u0412\u043E\u0435\u043D\u043D\u0430\u044F \u0440\u0430\u0434\u0430\u0440-\u0440\u0443\u043B\u0435\u0442\u043A\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!", type: "danger" } }));
              return;
            }
          }
          const { playerId, betAmount, betType, betValue } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          const validRouletteBet = betType === "number" && Number.isInteger(Number(betValue)) && Number(betValue) >= 0 && Number(betValue) <= 36 || betType === "color" && ["red", "black"].includes(betValue) || betType === "parity" && ["even", "odd"].includes(betValue);
          if (!validRouletteBet) {
            sendError(ws, "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0442\u0438\u043F \u0438\u043B\u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0441\u0442\u0430\u0432\u043A\u0438 \u0432 \u0440\u0443\u043B\u0435\u0442\u043A\u0435.");
            return;
          }
          const activeClient = clients.get(ws);
          const activeUsername = activeClient ? activeClient.username : "\u0421\u0442\u0430\u043B\u043A\u0435\u0440";
          if (profile.balance < betAmount) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0435 \u041A\u041F\u041A!", type: "danger" } }));
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
          const colorLabel = winningNumber === 0 ? "\u{1F7E2} \u0417\u0415\u0420\u041E (0)" : color === "red" ? `\u{1F534} \u041A\u0420\u0410\u0421\u041D\u041E\u0415 (${winningNumber})` : `\u26AB \u0427\u0415\u0420\u041D\u041E\u0415 (${winningNumber})`;
          ws.send(JSON.stringify({
            type: "ROULETTE_RESULT",
            payload: {
              winningNumber,
              winningColor: color,
              winAmount,
              message: winAmount > 0 ? `\u{1F3AF} \u0412\u042B\u0418\u0413\u0420\u042B\u0428! \u0412\u044B\u043F\u0430\u043B\u043E ${colorLabel}. \u0412\u0430\u0448\u0430 \u0441\u0442\u0430\u0432\u043A\u0430 \u043F\u0440\u0438\u043D\u0435\u0441\u043B\u0430 \u0432\u0430\u043C +${formatCredits(winAmount)}!` : `\u{1F4B8} \u041F\u0420\u041E\u0418\u0413\u0420\u042B\u0428! \u0412\u044B\u043F\u0430\u043B\u043E ${colorLabel}. \u0423\u0434\u0430\u0447\u0430 \u0443\u0441\u043A\u043E\u043B\u044C\u0437\u043D\u0443\u043B\u0430 \u0433\u043B\u0443\u0431\u043E\u043A\u043E \u043F\u043E\u0434 \u0440\u0430\u0434\u0430\u0440.`
            }
          }));
          if (winAmount >= betAmount * 5) {
            appendSystemMessage(`\u{1F3A1} \u0420\u0443\u043B\u0435\u0442\u043A\u0430: \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${activeUsername} \u043F\u043E\u0441\u0442\u0430\u0432\u0438\u043B \u043D\u0430 "${betValue}" \u0438 \u043F\u043E\u0434\u043D\u044F\u043B +${formatCredits(winAmount)} \u043D\u0430 \u0440\u0430\u0434\u0430\u0440-\u0440\u0443\u043B\u0435\u0442\u043A\u0435! \u0412\u044B\u043F\u0430\u043B\u043E: ${colorLabel}`, "success");
          }
          broadcastTavernGames();
          break;
        }
        case "SHOOTING_RANGE_FINISH": {
          if (!tavernSettings.enabledGames.shooting) {
            const player = clients.get(ws);
            if (!player || player.role !== "gm") {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u0421\u0442\u0440\u0435\u043B\u043A\u043E\u0432\u044B\u0439 \u0442\u0438\u0440 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043E\u043F\u0435\u0447\u0430\u0442\u0430\u043D \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!", type: "danger" } }));
              return;
            }
          }
          const { playerId, bet, score } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (!Number.isSafeInteger(score) || score < 0 || score > 1e4) {
            sendError(ws, "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0441\u0442\u0440\u0435\u043B\u044C\u0431\u044B.");
            return;
          }
          const activeClient = clients.get(ws);
          const activeUsername = activeClient ? activeClient.username : "\u0421\u0442\u0430\u043B\u043A\u0435\u0440";
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0435 \u041A\u041F\u041A!", type: "danger" } }));
            return;
          }
          profile.balance -= bet;
          let mult = 0;
          let rank = "\u041D\u043E\u0432\u0438\u0447\u043E\u043A";
          if (score >= 250) {
            mult = 1.8;
            rank = "\u{1F3C6} \u041B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0439 \u0421\u0442\u0440\u0435\u043B\u043E\u043A";
          } else if (score >= 150) {
            mult = 1.2;
            rank = "\u{1F3AF} \u0421\u043D\u0430\u0439\u043F\u0435\u0440 \u0417\u043E\u043D\u044B";
          } else if (score >= 80) {
            mult = 0.8;
            rank = "\u{1F52B} \u041C\u0435\u0442\u043A\u0438\u0439 \u0421\u0442\u0440\u0435\u043B\u043E\u043A";
          } else {
            mult = 0;
            rank = "\u0421\u043B\u0435\u043F\u043E\u0439 \u041E\u043A\u043E\u0440\u043E\u043A (\u041F\u043E\u0442\u0440\u0435\u043D\u0438\u0440\u0443\u0439\u0442\u0435\u0441\u044C \u0435\u0449\u0451!)";
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
              message: winAmount > 0 ? `\u{1F396}\uFE0F \u0420\u0415\u0417\u0423\u041B\u042C\u0422\u0410\u0422: \u041D\u0430\u0431\u0440\u0430\u043D\u043E ${score} \u043E\u0447\u043A\u043E\u0432 (\u0417\u0432\u0430\u043D\u0438\u0435: ${rank}). \u0412\u044B \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u0438 \u0432\u044B\u043F\u043B\u0430\u0442\u0443 +${formatCredits(winAmount)}!` : `\u274C \u0420\u0415\u0417\u0423\u041B\u042C\u0422\u0410\u0422: \u041D\u0430\u0431\u0440\u0430\u043D\u043E ${score} \u043E\u0447\u043A\u043E\u0432. \u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u043C\u0430\u0445\u043E\u0432 (\u0417\u0432\u0430\u043D\u0438\u0435: ${rank}). \u0421\u0442\u0430\u0432\u043A\u0430 \u0443\u0448\u043B\u0430 \u0431\u0430\u0440\u043C\u0435\u043D\u0443.`
            }
          }));
          if (winAmount >= bet * 1.5) {
            appendSystemMessage(`\u{1F3AF} \u0422\u0438\u0440: \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${activeUsername} \u043F\u0440\u043E\u0448\u0435\u043B \u0431\u043E\u0435\u0432\u0443\u044E \u0442\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0443 \u0432 \u0422\u0438\u0440\u0435 \u0441 \u0440\u0430\u043D\u0433\u043E\u043C [${rank}] \u0438 \u0432\u044B\u0438\u0433\u0440\u0430\u043B +${formatCredits(winAmount)}!`, "success");
          }
          broadcastTavernGames();
          break;
        }
        case "THIMBLERIG_PLAY": {
          if (!tavernSettings.enabledGames.thimblerig) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0430\u043F\u0451\u0440\u0441\u0442\u043A\u0438 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!", type: "danger" } }));
            return;
          }
          const { playerId, bet, chosenCup } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (!Number.isInteger(chosenCup) || chosenCup < 0 || chosenCup > 2) {
            sendError(ws, "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043E\u0434\u0438\u043D \u0438\u0437 \u0442\u0440\u0451\u0445 \u043D\u0430\u043F\u0451\u0440\u0441\u0442\u043A\u043E\u0432.");
            return;
          }
          const activeClient = clients.get(ws);
          const activeUsername = activeClient ? activeClient.username : "\u0421\u0442\u0430\u043B\u043A\u0435\u0440";
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0435 \u041A\u041F\u041A!", type: "danger" } }));
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
              message: winAmount > 0 ? `\u{1F389} \u041A\u0443\u0440\u0430\u0436! \u041D\u0430\u043F\u0451\u0440\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u043D\u0435\u0434\u043E\u0433\u043B\u044F\u0434\u0435\u043B! \u0428\u0430\u0440\u0438\u043A \u043F\u043E\u0434 \u0441\u0442\u0430\u043A\u0430\u043D\u043E\u043C #${winningCup + 1}. \u0412\u044B \u043F\u043E\u0434\u043D\u044F\u043B\u0438 +${formatCredits(winAmount)}!` : `\u{1F4B8} \u0423\u0432\u044B! \u041F\u0443\u0441\u0442\u043E! \u0428\u0430\u0440\u0438\u043A \u043E\u043A\u0430\u0437\u0430\u043B\u0441\u044F \u043F\u043E\u0434 \u0441\u0442\u0430\u043A\u0430\u043D\u043E\u043C #${winningCup + 1}. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437!`
            }
          }));
          if (winAmount >= bet * 2) {
            appendSystemMessage(`\u{1F939} \u041D\u0430\u043F\u0451\u0440\u0441\u0442\u043A\u0438: \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${activeUsername} \u043E\u0431\u044B\u0433\u0440\u0430\u043B \u043D\u0430\u043F\u0451\u0440\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430 \u0438 \u0443\u043D\u0451\u0441 +${formatCredits(winAmount)}!`, "success");
          }
          broadcastTavernGames();
          break;
        }
        case "SVINYA_START": {
          if (!tavernSettings.enabledGames.svinya) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041A\u0430\u0440\u0442\u043E\u0447\u043D\u0430\u044F \u0438\u0433\u0440\u0430 \u0421\u0432\u0438\u043D\u044C\u044F \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u043A\u0443\u0440\u0430\u0442\u043E\u0440\u043E\u043C!", type: "danger" } }));
            return;
          }
          const { playerId, bet } = payload;
          const profile = playerDb[playerId];
          if (!profile) return;
          if (activeSvinyaBets[playerId] !== void 0) {
            sendError(ws, "\u041F\u0430\u0440\u0442\u0438\u044F \u0432 \xAB\u0421\u0432\u0438\u043D\u044C\u044E\xBB \u0443\u0436\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u0430.");
            return;
          }
          if (profile.balance < bet) {
            ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { text: "\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0435 \u041A\u041F\u041A!", type: "danger" } }));
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
          const activeUsername = activeClient ? activeClient.username : "\u0421\u0442\u0430\u043B\u043A\u0435\u0440";
          const bet = activeSvinyaBets[playerId];
          if (bet === void 0) {
            sendError(ws, "\u0410\u043A\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u0430\u0440\u0442\u0438\u044F \u0432 \xAB\u0421\u0432\u0438\u043D\u044C\u044E\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430.");
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
              message: result === "win" ? `\u{1F3C6} \u0412\u044B \u043E\u0431\u044B\u0433\u0440\u0430\u043B\u0438 \u0432 \xAB\u0421\u0432\u0438\u043D\u044C\u044E\xBB \u0438 \u0437\u0430\u0431\u0440\u0430\u043B\u0438 +${formatCredits(winAmount)}!` : result === "tie" ? `\u{1F91D} \u041D\u0438\u0447\u044C\u044F \u0432 \xAB\u0421\u0432\u0438\u043D\u044C\u044E\xBB! \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u043E ${formatCredits(winAmount)}.` : `\u{1F4B8} \u0412\u044B \u0437\u0430\u043A\u043E\u043D\u0447\u0438\u043B\u0438 \u043F\u0430\u0440\u0442\u0438\u044E \u0432 \xAB\u0421\u0432\u0438\u043D\u044C\u044E\xBB \u043F\u0440\u043E\u0438\u0433\u0440\u044B\u0448\u0435\u043C. \u0421\u0442\u0430\u0432\u043A\u0430 \u0443\u0448\u043B\u0430 \u0431\u0430\u0440\u043C\u0435\u043D\u0443.`
            }
          }));
          if (result === "win") {
            appendSystemMessage(`\u{1F437} \u0421\u0432\u0438\u043D\u044C\u044F: \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${activeUsername} \u0440\u0430\u0437\u043B\u043E\u0436\u0438\u043B \u043A\u0430\u0440\u0442\u044B \u043A\u0440\u0443\u0433\u043E\u043C, \u043E\u0431\u044B\u0433\u0440\u0430\u043B \u0425\u0430\u0440\u043E\u043D\u0430 \u0438 \u0437\u0430\u0440\u0430\u0431\u043E\u0442\u0430\u043B +${formatCredits(winAmount)}!`, "success");
          } else if (result === "lose") {
            appendSystemMessage(`\u{1F437} \u0421\u0432\u0438\u043D\u044C\u044F: \u0421\u0442\u0430\u043B\u043A\u0435\u0440 ${activeUsername} \u043E\u0441\u0442\u0430\u043B\u0441\u044F \xAB\u0421\u0432\u0438\u043D\u044C\u0451\u0439\xBB \u0432 \u043A\u0430\u0440\u0442\u043E\u0447\u043D\u043E\u0439 \u043F\u0430\u0440\u0442\u0438\u0438 \u0438 \u043F\u043E\u0442\u0435\u0440\u044F\u043B \u0441\u0432\u043E\u0438 ${formatCredits(bet)}.`, "info");
          }
          broadcastTavernGames();
          break;
        }
      }
    } catch (err) {
      console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0441\u043E\u043A\u0435\u0442\u0430:", err);
    }
  });
  ws.on("close", () => {
    const player = clients.get(ws);
    if (player) {
      console.log(`\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C ${player.username} \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F.`);
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
async function startServer() {
  app.get("/api/profiles", (req, res) => {
    res.json(Object.keys(playerDb));
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`
======================================================`);
    console.log(`\u2B50 STANDALONE ANOMALY ZONE SERVER RUNNING PORT: ${PORT}`);
    console.log(`\u{1F449} Access locally inside development preview`);
    console.log(`\u{1F449} Access on local network at http://localhost:${PORT}`);
    console.log(`======================================================
`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
