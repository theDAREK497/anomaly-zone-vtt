import { encounterKind, EncounterKind, FIELD_EFFECTS } from '../utils/anomaly-gameplay';
export type CanonStatus = "canon" | "canon-compatible" | "recommended";
export type AnomalyFamily = "biological" | "crystalline" | "resonance" | "echo" | "reflection" | "spatial" | "gravitational" | "electrical" | "thermal" | "cognitive" | "corrosive" | "railway" | "composite";
export type SupportedMode = "exploration" | "combat" | "train-travel" | "train-combat" | "salvage" | "research";
export type ResolutionMode = "minigame" | "gurps-roll" | "hybrid";
export type EncounterResult = "completeSuccess" | "successWithCost" | "partialFailure" | "failure" | "criticalFailure" | "retreat";
export type AnomalyPhaseId = "dormant" | "warning" | "active" | "collapse" | "aftermath";

export interface AnomalyPhase {
  id: AnomalyPhaseId;
  label: string;
  description: string;
  transition: { minRounds?: number; minMistakes?: number; maxStability?: number; onResult?: EncounterResult[] };
}

export interface AnomalyAction {
  id: string;
  label: string;
  description: string;
  kind: "observe" | "interact" | "protect" | "train" | "retreat";
  clue?: string;
  skillTags?: string[];
  stabilityDelta?: number;
  exposureDelta?: number;
  contaminationDelta?: number;
  trainRiskDelta?: number;
  advances?: boolean;
}

export interface AnomalyDefinition {
  encounterType: EncounterKind;
  fieldEffects: string[];
  id: string;
  name: string;
  description: string;
  canonStatus: CanonStatus;
  family: AnomalyFamily;
  dangerTier: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  supportedModes: SupportedMode[];
  warningSigns: string[];
  detection: { skillTags: string[]; clues: string[]; passiveSignal: string };
  phases: AnomalyPhase[];
  minigame: {
    implementation: "full" | "gurps-placeholder";
    kind: "law-cycle" | "resonance-sequence" | "echo-pattern" | "network-routing" | "track-routing" | "gurps-series";
    law: string;
    actions: AnomalyAction[];
    targetProgress: number;
    maxMistakes: number;
    sequenceLength?: number;
  };
  gurpsResolution: { requiredSuccesses: number; allowedSkillTags: string[]; defaultPenalty: number; criticalSuccessMayAutoResolve: boolean };
  counters: string[];
  characterConsequences: Record<Exclude<EncounterResult, "completeSuccess" | "retreat">, string[]>;
  trainConsequences: {
    affectedTrainSystems: string[];
    affectedWagons: string[];
    speedInteraction: string;
    fuelInteraction: string;
    powerInteraction: string;
    cargoInteraction: string;
    possibleTemporaryFaults: string[];
    possiblePermanentFaults: string[];
    repairOptions: string[];
  };
  rewards: string[];
  rollTables: { complications: string[]; rewards: string[] };
  accessibility: { signals: string[]; timerOptional: boolean; gmPause: boolean; keyboard: boolean; speedControl: boolean; rollAutoResolve: boolean; skipAnimation: boolean };
  gmNotes: string[];
}

const phases: AnomalyPhase[] = [
  { id: "dormant", label: "Покой", description: "Закон проявляется только косвенными признаками.", transition: { minRounds: 1 } },
  { id: "warning", label: "Предупреждение", description: "Опасность сообщает о себе повторяемым сигналом.", transition: { minRounds: 2 } },
  { id: "active", label: "Активная", description: "Аномалия отвечает на действия экипажа.", transition: { minRounds: 3 } },
  { id: "collapse", label: "Коллапс", description: "Ошибки накоплены; отступление более недоступно.", transition: { minMistakes: 3, maxStability: 25 } },
  { id: "aftermath", label: "Последствия", description: "Закон затих, оставляя следы и добычу.", transition: { onResult: ["completeSuccess", "successWithCost", "partialFailure", "failure", "criticalFailure", "retreat"] } }
];

const accessibility = {
  signals: ["цвет", "символ", "форма", "текст", "звук при включённом аудио"], timerOptional: true, gmPause: true,
  keyboard: true, speedControl: true, rollAutoResolve: true, skipAnimation: true
};

const consequences = (theme: string): AnomalyDefinition["characterConsequences"] => ({
  successWithCost: [`Усталость, стресс или временный эффект: ${theme}.`],
  partialFailure: [`Накопленная экспозиция и помеха: ${theme}; доступно лечение или исследование.`],
  failure: [`Серьёзная, но обратимая травма либо заражение: ${theme}.`],
  criticalFailure: [`Критическое последствие после накопленных ошибок или коллапса: ${theme}.`]
});

const train = (systems: string[], theme: string): AnomalyDefinition["trainConsequences"] => ({
  affectedTrainSystems: systems,
  affectedWagons: ["локомотив или ближайший к очагу вагон", "остальные вагоны только при распространении/коллапсе"],
  speedInteraction: `Снижение скорости уменьшает риск; резкий разгон усиливает ${theme}.`,
  fuelInteraction: "Расход топлива меняется только при манёвре, обходе или аварийном торможении.",
  powerInteraction: "Систему можно обесточить и изолировать до прохождения очага.",
  cargoInteraction: "Опасный груз можно сбросить или перенести в изолированный вагон.",
  possibleTemporaryFaults: [`Временный отказ: ${theme}`, "ограничение скорости", "локальное отключение системы"],
  possiblePermanentFaults: [`Повреждение одного узла после коллапса: ${theme}`],
  repairOptions: ["изолировать вагон", "обесточить систему", "сбросить груз", "полевой ремонт: инженерное дело или механика", "отступить до коллапса"]
});

const rollActions: AnomalyAction[] = [
  { id: "observe", label: "Изучить закон", description: "Получить наблюдаемый сигнал и открыть подсказку.", kind: "observe", skillTags: ["observation", "research"], stabilityDelta: 4 },
  { id: "probe", label: "Проверить гипотезу", description: "Осторожное взаимодействие после наблюдения.", kind: "interact", skillTags: ["physics", "engineering"], advances: true, stabilityDelta: 12, exposureDelta: 5 },
  { id: "isolate", label: "Изолировать участок", description: "Защитить людей или один вагон от распространения.", kind: "protect", skillTags: ["engineering", "mechanic"], trainRiskDelta: -12 },
  { id: "retreat", label: "Отступить", description: "Покинуть область до коллапса.", kind: "retreat" }
];

function definition(input: Partial<AnomalyDefinition> & Pick<AnomalyDefinition, "id" | "name" | "description" | "canonStatus" | "family" | "dangerTier" | "warningSigns">): AnomalyDefinition {
  const skillTags = input.gurpsResolution?.allowedSkillTags || ["observation", "survival", "research"];
  return {
    encounterType: encounterKind(input.id), fieldEffects: FIELD_EFFECTS[input.id] || [],
    id: input.id, name: input.name, description: input.description, canonStatus: input.canonStatus, family: input.family, dangerTier: input.dangerTier,
    tags: input.tags || [input.family, "eon", "investigation"],
    supportedModes: input.supportedModes || ["exploration", "train-travel", "research"],
    warningSigns: input.warningSigns,
    detection: input.detection || { skillTags, clues: input.warningSigns, passiveSignal: input.warningSigns[0] },
    phases: input.phases || phases,
    minigame: input.minigame || { implementation: "gurps-placeholder", kind: "gurps-series", law: "Закон выявляется последовательным наблюдением и проверкой гипотез.", actions: rollActions, targetProgress: 3, maxMistakes: 3 },
    gurpsResolution: input.gurpsResolution || { requiredSuccesses: 3, allowedSkillTags: skillTags, defaultPenalty: -2, criticalSuccessMayAutoResolve: false },
    counters: input.counters || ["наблюдение", "изоляция", "медленный контролируемый проход", "отступление"],
    characterConsequences: input.characterConsequences || consequences(input.name),
    trainConsequences: input.trainConsequences || train(["датчики", "ходовая часть"], input.name),
    rewards: input.rewards || ["образец аномальной материи", "исследовательские данные", "временный бонус к повторному прохождению"],
    rollTables: input.rollTables || { complications: ["локальная помеха", "временная неисправность", "рост экспозиции"], rewards: ["чистый образец", "редкий компонент", "надёжная карта прохода"] },
    accessibility: input.accessibility || accessibility,
    gmNotes: input.gmNotes || ["Не скрывайте первый сигнал угрозы.", "Не меняйте подтверждённый закон в ходе сцены.", "Обычная ошибка не убивает персонажа и не уничтожает вагон."]
  };
}

const full = (id: string, name: string, status: CanonStatus, family: AnomalyFamily, dangerTier: 1|2|3|4|5, description: string, warningSigns: string[], kind: AnomalyDefinition["minigame"]["kind"], law: string, actions: AnomalyAction[], skills: string[], systems: string[]): AnomalyDefinition => definition({
  id, name, canonStatus: status, family, dangerTier, description, warningSigns,
  detection: { skillTags: skills, clues: warningSigns, passiveSignal: warningSigns[0] },
  minigame: { implementation: "full", kind, law, actions, targetProgress: 3, maxMistakes: 3, sequenceLength: kind.includes("sequence") || kind.includes("pattern") ? 3 : undefined },
  gurpsResolution: { requiredSuccesses: 3, allowedSkillTags: skills, defaultPenalty: -dangerTier + 1, criticalSuccessMayAutoResolve: false },
  trainConsequences: train(systems, name)
});

export const ANOMALY_DEFINITIONS: AnomalyDefinition[] = [
  full("spore-forest", "Споровый лес", "canon", "biological", 3, "Колония реагирует на ритм воздуха и вибрации, а не на само присутствие.", ["◉ Споры пульсируют волнами от порывов воздуха.", "△ Тихие участки мицелия втягиваются перед выбросом.", "Текст: после шума следует безопасная пауза."], "law-cycle", "После заметного вдоха колонии наступает короткое безопасное окно; огонь без изоляции вызывает общий выброс.", [
    { id:"watch-breath", label:"Наблюдать дыхание", description:"Отследить втягивание мицелия и открыть безопасное окно.", kind:"observe", clue:"Безопасное действие — движение сразу после втягивания спор.", skillTags:["observation","biology"], stabilityDelta:5 },
    { id:"seal-vents", label:"Герметизировать вентиляцию", description:"Защитить вагон и снизить заражение.", kind:"protect", skillTags:["engineering","biology"], contaminationDelta:-15, trainRiskDelta:-10 },
    { id:"cross-on-lull", label:"Пройти в паузу", description:"Двигаться только в подтверждённое тихое окно.", kind:"interact", skillTags:["survival","driving-locomotive"], advances:true, stabilityDelta:18, exposureDelta:4 },
    { id:"burn", label:"Выжечь коридор", description:"Добровольный риск: работает лишь после герметизации.", kind:"train", skillTags:["chemistry","engineering"], advances:true, stabilityDelta:25, contaminationDelta:8, trainRiskDelta:8 },
    { id:"retreat", label:"Отступить", description:"Вернуться по чистому следу до коллапса.", kind:"retreat" }
  ], ["observation","biology","survival","chemistry","engineering","first-aid","driving-locomotive"], ["вентиляция","фильтры","грузовой отсек"]),
  full("crystal-resonance", "Кристаллический резонанс", "canon", "crystalline", 3, "Кристаллы отвечают на частоты и повторяют устойчивую последовательность импульсов.", ["◇ Грани вспыхивают неслучайной трёхчастной серией.", "♪ Перед выбросом слышен совпадающий обертон.", "Текст: безопасная частота всегда повторяет предыдущий слабый импульс."], "resonance-sequence", "Слабая последовательность является подсказкой; ответ в той же частоте гасит узел, неверная частота усиливает следующий импульс.", [
    { id:"listen", label:"Записать импульс", description:"Открыть следующий символ последовательности.", kind:"observe", clue:"Повторите показанную частоту: низкая, средняя или высокая.", skillTags:["physics","electronics-sensors"], stabilityDelta:4 },
    { id:"tone-low", label:"Низкая частота ▂", description:"Ответить низким тоном.", kind:"interact", advances:true },
    { id:"tone-mid", label:"Средняя частота ▅", description:"Ответить средним тоном.", kind:"interact", advances:true },
    { id:"tone-high", label:"Высокая частота ▇", description:"Ответить высоким тоном.", kind:"interact", advances:true },
    { id:"dampen", label:"Поставить демпферы", description:"Снизить риск для корпуса при следующей ошибке.", kind:"protect", skillTags:["engineering","mechanic"], trainRiskDelta:-15 },
    { id:"retreat", label:"Отступить", description:"Выйти из резонансной зоны до коллапса.", kind:"retreat" }
  ], ["observation","physics","electronics-sensors","engineering","research"], ["корпус","стекло","датчики","крепления груза"]),
  full("echo-loop", "Эхо-петля", "canon-compatible", "echo", 3, "Пространство повторяет цепочку действий с фиксированной задержкой.", ["↻ Последний звук возвращается тем же ритмом.", "□ Следы появляются повторно в прежних местах.", "Текст: петля копирует порядок, но не намерение."], "echo-pattern", "Петля безопасно размыкается противоположной последовательностью к наблюдаемому эху.", [
    { id:"record-echo", label:"Записать эхо", description:"Показать следующий элемент повторяемого паттерна.", kind:"observe", clue:"Размыкайте петлю в обратном порядке показанных символов.", skillTags:["observation","physics"], stabilityDelta:4 },
    { id:"echo-a", label:"Сигнал ○", description:"Ввести круговой сигнал.", kind:"interact", advances:true },
    { id:"echo-b", label:"Сигнал △", description:"Ввести треугольный сигнал.", kind:"interact", advances:true },
    { id:"echo-c", label:"Сигнал □", description:"Ввести квадратный сигнал.", kind:"interact", advances:true },
    { id:"anchor", label:"Оставить якорь", description:"Простить одну ошибку последовательности.", kind:"protect", skillTags:["navigation","engineering"], exposureDelta:-10 },
    { id:"retreat", label:"Отступить", description:"Повторить исходный путь до коллапса.", kind:"retreat" }
  ], ["observation","navigation","physics","research"], ["хронометр","связь внутри поезда","навигация"]),
  full("static-front", "Статический фронт", "recommended", "electrical", 4, "Заряд идёт по наиболее проводящему непрерывному пути и заранее отмечает его коронным свечением.", ["ϟ На острых деталях возникает коронное свечение.", "⏚ Земля и мокрый металл гудят перед разрядом.", "Текст: ярче всего светится будущий путь тока."], "network-routing", "Нужно разорвать проводящий путь, заземлить фронт и провести только изолированный узел.", [
    { id:"scan-conductors", label:"Проследить фронт", description:"Показать опасный проводящий узел.", kind:"observe", clue:"Сначала изолируйте отмеченный узел, затем заземлите фронт.", skillTags:["electronics-sensors","physics"], stabilityDelta:4 },
    { id:"isolate-node", label:"Изолировать узел", description:"Разорвать подсвеченный проводящий путь.", kind:"protect", skillTags:["electronics-sensors","engineering"], advances:true, trainRiskDelta:-15 },
    { id:"ground-front", label:"Заземлить фронт", description:"Сбросить накопленный заряд после изоляции.", kind:"interact", skillTags:["electronics-sensors","engineering"], advances:true, stabilityDelta:15 },
    { id:"cross-front", label:"Провести изолированный узел", description:"Пройти фронт после разрыва пути и заземления.", kind:"train", skillTags:["driving-locomotive","engineering"], advances:true, trainRiskDelta:5 },
    { id:"power-down", label:"Обесточить вагон", description:"Уменьшить последствия ошибки ценой временного отказа.", kind:"train", trainRiskDelta:-20 },
    { id:"retreat", label:"Отступить", description:"Откатиться до границы коронного свечения.", kind:"retreat" }
  ], ["observation","physics","electronics-sensors","engineering","mechanic"], ["энергосеть","радиосвязь","управление локомотивом"]),
  full("living-track", "Живой путь", "recommended", "railway", 4, "Рельсы перестраиваются вслед за нагрузкой; свободная ветка показывает реальное направление до наезда.", ["≋ Ненагруженные рельсы медленно изгибаются.", "⇆ Стрелки дёргаются в сторону свободной ветки.", "Текст: путь меняется только после переноса веса."], "track-routing", "Разгрузите ведущую ось, зафиксируйте выбранную ветку и проходите на малой тяге без резкого торможения.", [
    { id:"inspect-switch", label:"Наблюдать стрелки", description:"Показать ветку, которая останется стабильной под нагрузкой.", kind:"observe", clue:"Сначала разгрузите ось, затем фиксируйте показанную ветку.", skillTags:["observation","mechanic","driving-locomotive"], stabilityDelta:4 },
    { id:"unload-axle", label:"Разгрузить ведущую ось", description:"Перераспределить груз перед фиксацией пути.", kind:"train", skillTags:["mechanic","engineering"], advances:true, trainRiskDelta:-10 },
    { id:"lock-switch", label:"Зафиксировать ветку", description:"Механически удержать подтверждённое направление.", kind:"interact", skillTags:["mechanic","engineering"], advances:true, stabilityDelta:16 },
    { id:"crawl", label:"Малая тяга", description:"Пройти без рывка после подготовки.", kind:"train", skillTags:["driving-locomotive"], advances:true, trainRiskDelta:4 },
    { id:"drop-cargo", label:"Сбросить груз", description:"Снизить риск ценой части груза.", kind:"protect", trainRiskDelta:-25 },
    { id:"retreat", label:"Отступить", description:"Откатиться без смены нагрузки до коллапса.", kind:"retreat" }
  ], ["observation","navigation","engineering","mechanic","driving-locomotive"], ["колёсные пары","стрелки","тормоза","сцепки"]),

  definition({ id:"druse-growth", name:"Рост друзы", description:"Кристаллическая колония наращивает массу вдоль тепловых мостов.", canonStatus:"canon-compatible", family:"crystalline", dangerTier:2, warningSigns:["◇ Иней образует ветвящийся рисунок.","Текст: рост следует к самому тёплому металлу."], gurpsResolution:{requiredSuccesses:3,allowedSkillTags:["observation","physics","chemistry","engineering"],defaultPenalty:-1,criticalSuccessMayAutoResolve:false}, trainConsequences:train(["теплотрасса","обшивка"],"рост друзы") }),
  definition({ id:"reflection-field", name:"Поле отражений", description:"Отражает направленное воздействие по наблюдаемой геометрии поверхностей.", canonStatus:"canon-compatible", family:"reflection", dangerTier:3, warningSigns:["◇ Отражения запаздывают на один жест.","Текст: матовая поверхность не даёт вторичного образа."], gurpsResolution:{requiredSuccesses:3,allowedSkillTags:["observation","physics","navigation"],defaultPenalty:-2,criticalSuccessMayAutoResolve:false}, trainConsequences:train(["оптика","прожекторы","наблюдательный пост"],"ложные отражения") }),
  definition({ id:"gravity-fracture", name:"Гравитационный разлом", description:"Вектор тяжести ступенчато меняется между видимыми слоями пыли.", canonStatus:"recommended", family:"gravitational", dangerTier:4, warningSigns:["↓ Пыль падает в разные стороны по полосам.","Текст: границы вектора неподвижны несколько минут."], gurpsResolution:{requiredSuccesses:4,allowedSkillTags:["observation","physics","engineering","driving-locomotive"],defaultPenalty:-3,criticalSuccessMayAutoResolve:false}, trainConsequences:train(["подвеска","крепления груза"],"смена вектора тяжести") }),
  definition({ id:"spatial-seam", name:"Пространственный шов", description:"Сшивает две наблюдаемые границы пространства с постоянной ориентацией.", canonStatus:"recommended", family:"spatial", dangerTier:4, warningSigns:["║ Прямые линии обрываются и продолжаются со смещением.","Текст: шов сохраняет ориентацию до коллапса."], gurpsResolution:{requiredSuccesses:4,allowedSkillTags:["observation","navigation","physics"],defaultPenalty:-3,criticalSuccessMayAutoResolve:false}, trainConsequences:train(["габарит состава","сцепки"],"пространственное смещение") }),
  definition({ id:"silent-zone", name:"Немая зона", description:"Локально подавляет сигналы интерфейса, но никогда не блокирует реальный чат Foundry.", canonStatus:"recommended", family:"resonance", dangerTier:2, warningSigns:["∅ Индикаторы связи гаснут по очереди.","Текст: механические сигналы продолжают работать."], gurpsResolution:{requiredSuccesses:3,allowedSkillTags:["observation","electronics-sensors","engineering"],defaultPenalty:-1,criticalSuccessMayAutoResolve:false}, trainConsequences:train(["внутренняя связь","датчики"],"подавление интерфейсной связи"), gmNotes:["Ограничение действует только внутри мини-игры и отключается GM.","Не блокировать чат Foundry, голос или доступность интерфейса."] }),
  definition({ id:"thermal-pocket", name:"Тепловой карман", description:"Тепло перетекает между заранее заметными холодными и горячими узлами.", canonStatus:"recommended", family:"thermal", dangerTier:3, warningSigns:["△ Конденсат образует кольца вокруг холодных узлов.","Текст: горячая зона расширяется после резкого притока воздуха."], gurpsResolution:{requiredSuccesses:3,allowedSkillTags:["observation","physics","engineering","survival"],defaultPenalty:-2,criticalSuccessMayAutoResolve:false}, trainConsequences:train(["охлаждение","котёл","топливная магистраль"],"тепловой перепад") }),
  definition({ id:"memory-haze", name:"Туман памяти", description:"Стирает краткую последовательность решений, оставляя внешние записи нетронутыми.", canonStatus:"recommended", family:"cognitive", dangerTier:3, warningSigns:["… Повторяются незаконченные фразы.","Текст: письменные метки не меняются вместе с памятью."], gurpsResolution:{requiredSuccesses:3,allowedSkillTags:["observation","research","first-aid"],defaultPenalty:-2,criticalSuccessMayAutoResolve:false}, trainConsequences:train(["вахтенный журнал","навигационные процедуры"],"потеря краткой памяти") }),
  definition({ id:"rust-wave", name:"Волна ржавчины", description:"Коррозионный фронт идёт по электрически связанному металлу.", canonStatus:"recommended", family:"corrosive", dangerTier:4, warningSigns:["≋ Окисел растёт линией от контакта к контакту.","Текст: изолирующие вставки останавливают фронт."], gurpsResolution:{requiredSuccesses:4,allowedSkillTags:["observation","chemistry","engineering","mechanic"],defaultPenalty:-3,criticalSuccessMayAutoResolve:false}, trainConsequences:train(["обшивка","тормозные магистрали","крепёж"],"ускоренная коррозия") }),
  definition({ id:"eon-storm", name:"Эоновый шторм", description:"Высокоуровневое составное событие, связывающее несколько законов ЭОН.", canonStatus:"recommended", family:"composite", dangerTier:5, warningSigns:["✦ Несколько независимых приборов повторяют один ритм.","Текст: фронт приближается стадиями и допускает подготовку."], supportedModes:["exploration","combat","train-travel","train-combat","research"], gurpsResolution:{requiredSuccesses:5,allowedSkillTags:["observation","navigation","physics","electronics-sensors","engineering","mechanic","driving-locomotive","research"],defaultPenalty:-4,criticalSuccessMayAutoResolve:false}, trainConsequences:train(["энергосеть","ходовая часть","связь","корпус"],"комплексный Эоновый шторм"), gmNotes:["Единственное базовое событие, способное затронуть несколько вагонов одновременно.","Критические последствия только после предупреждений, ошибок или добровольного риска."] })
];

export const ANOMALY_BY_ID = Object.fromEntries(ANOMALY_DEFINITIONS.map(item => [item.id, item])) as Record<string, AnomalyDefinition>;
export const ANOMALY_IDS = ANOMALY_DEFINITIONS.map(item => item.id);

export function validateAnomalyDefinitions(definitions = ANOMALY_DEFINITIONS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of definitions) {
    if (!item.id || ids.has(item.id)) errors.push(`Некорректный или повторный id: ${item.id}`);
    ids.add(item.id);
    if (item.phases.map(p => p.id).join(",") !== "dormant,warning,active,collapse,aftermath") errors.push(`${item.id}: неверный набор фаз`);
    if (!item.warningSigns.length || !item.detection.passiveSignal) errors.push(`${item.id}: отсутствует понятный сигнал`);
    if (!item.minigame.actions.some(action => action.kind === "retreat")) errors.push(`${item.id}: отсутствует отступление`);
    if (!item.gurpsResolution.allowedSkillTags.length) errors.push(`${item.id}: отсутствуют skill tags`);
    if (!item.trainConsequences.repairOptions.length) errors.push(`${item.id}: отсутствуют варианты ремонта`);
  }
  return errors;
}
