import React, { useEffect, useRef, useState } from 'react';
import { ANOMALY_BY_ID } from '../data/anomalies';
import { GameMap } from '../utils/generator';
import { PuzzleInput, RESULT_LABELS, SKILL_LABELS, SYMBOLS } from '../utils/anomaly-gameplay';

const canonLabels = { canon: 'Канон', 'canon-compatible': 'Совместимо с каноном', recommended: 'Расширение мира' };
const modeLabels = { minigame: 'Мини-игра', 'gurps-roll': 'Проверки кубиками', hybrid: 'Мини-игра с поддержкой навыков' };
const button = 'rounded-lg border border-cyan-700 bg-cyan-950 px-4 py-3 text-white hover:bg-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40';

export function AnomalyEncounter({ map, ws, isGM }: { map: GameMap; ws: WebSocket | null; isGM: boolean }) {
  const e = map.activeAnomalyEncounter, definition = e && ANOMALY_BY_ID[e.anomalyId];
  const p = e?.puzzle;
  const [selectedWire, setSelectedWire] = useState<number | null>(null);
  const [skill, setSkill] = useState('observation');
  const [target, setTarget] = useState(12);
  const [item, setItem] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const send = (type: string, payload: object) => { if (ws?.readyState === 1) ws.send(JSON.stringify({ type, payload })); };
  const input = (value: Omit<PuzzleInput, 'revision'>) => {
    if (p && e && !e.paused && !e.result) send('ANOMALY_PUZZLE', { seed: e.seed, input: { ...value, revision: p.revision } });
  };
  useEffect(() => { setSelectedWire(null); setSkill(definition?.gurpsResolution.allowedSkillTags[0] || 'manual'); }, [e?.seed]);
  useEffect(() => { if (selectedWire !== null && p?.connected.includes(selectedWire)) setSelectedWire(null); }, [p?.revision]);
  useEffect(() => { dialog.current?.focus(); }, [e?.seed, e?.result]);
  useEffect(() => {
    if (!e) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select') || []) as HTMLElement[];
        if (!elements.length) { event.preventDefault(); return; }
        const index = elements.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); elements[elements.length - 1].focus(); }
        else if (!event.shiftKey && (index === elements.length - 1 || index < 0)) { event.preventDefault(); elements[0].focus(); }
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || e.result || e.paused || !p || event.repeat) return;
      const offsets: Record<string, number> = { ArrowUp: -p.size, ArrowDown: p.size, ArrowLeft: -1, ArrowRight: 1 };
      if (p.kind === 'maze' && event.key in offsets) { event.preventDefault(); event.stopImmediatePropagation(); input({ kind: 'step', a: p.position + offsets[event.key] }); }
      if (p.kind === 'sequence' && p.stage === 'solve' && /^[1-5]$/.test(event.key)) { event.preventDefault(); input({ kind: 'symbol', a: Number(event.key) - 1 }); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [e, ws]);
  if (!e || !definition) return null;
  const last = [...(map.anomalyJournal || [])].reverse().find(entry => entry.seed === e.seed);
  const seconds = Math.max(0, Math.ceil(e.timeRemaining ?? 60));
  const disabled = !!e.paused || ws?.readyState !== 1;
  const skillName = (tag: string) => SKILL_LABELS[tag] || 'Настраиваемый навык';

  return <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="anomaly-title" className="bg-gray-950 border border-cyan-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] overflow-y-auto p-5 space-y-4 text-gray-100">
      <header className="sticky top-0 z-10 flex justify-between gap-3 items-start bg-gray-950 py-2 border-b border-gray-800">
        <div><p className="text-xs text-cyan-400">{canonLabels[definition.canonStatus]} · {modeLabels[e.mode]}</p><h2 id="anomaly-title" className="text-2xl font-bold">{definition.name}</h2></div>
        <div className="text-right text-sm"><div>Ход: пауза ({Math.ceil(map.timerSeconds)} сек.)</div>{!e.result && <div className={seconds <= 15 ? 'text-red-300 font-bold' : 'text-amber-300'}>{map.anomalyTimerEnabled === false ? 'Без ограничения времени' : `Решение: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</div>}</div>
      </header>
      {e.result ? <div className="text-center space-y-4" role="status">
        <h3 className="text-2xl text-amber-300 font-bold">{RESULT_LABELS[e.result]}</h3>
        <p>{last?.consequences.join(' · ') || 'Сцена завершена.'}</p>
        {!!last?.rewards.length && <p className="text-green-300">Награда: {last.rewards.join(' · ')}</p>}
        {!!last?.trainChanges.length && <p>Поезд: {last.trainChanges.join(' · ')}</p>}
        <p className="text-sm text-gray-400">Нажмите «ОК», чтобы всей группой вернуться на поле. Таймер хода продолжится с {Math.ceil(map.timerSeconds)} секунд.</p>
        <button autoFocus className={button} onClick={() => send('ANOMALY_ACK', { seed: e.seed })}>ОК</button>
      </div> : <>
        <p className="text-sm text-gray-300">{definition.description}</p>
        <div className="rounded-lg bg-amber-950/40 border border-amber-800 p-3 text-sm">⚠ {definition.detection.passiveSignal}<br/>Сложность: {e.difficulty ?? definition.dangerTier}. Ошибки: {e.mistakes}/{p?.limit || definition.minigame.maxMistakes}. {p ? 'При исчерпании попыток испытание заканчивается.' : `Требуется успешных проверок: ${definition.gurpsResolution.requiredSuccesses}.`}</div>
        {e.paused && <p role="status" className="text-center text-amber-300">Ⅱ Ведущий приостановил испытание</p>}

        {p?.kind === 'wires' && <section aria-label="Соединение проводов" className="space-y-3">
          <h3 className="font-bold text-lg">Восстановите цепь заземления</h3>
          <p className="text-sm">Сверяйтесь со схемой: выберите провод слева, затем указанное для него гнездо справа. Символы пары могут отличаться. Неверная пара — одна ошибка.</p>
          <div className="flex flex-wrap gap-3 bg-gray-900 p-3 rounded" aria-label="Схема соединений">{p.left.map((symbol, i) => <span key={i} className="text-xl">{SYMBOLS[symbol]} → {SYMBOLS[p.right[p.links[i]]]}</span>)}</div>
          <div className="grid grid-cols-2 gap-8">{[0, 1].map(side => <div key={side} className="space-y-2"><h4>{side === 0 ? 'Провода' : 'Гнёзда'}</h4>{(side === 0 ? p.left : p.right).map((symbol, index) => {
            const done = side === 0 ? p.connected.includes(index) : p.connected.some(left => p.links[left] === index);
            return <button key={index} aria-label={`${side === 0 ? 'Провод' : 'Гнездо'} ${SYMBOLS[symbol]}`} aria-pressed={side === 0 ? selectedWire === index : undefined} disabled={disabled || done || (side === 1 && selectedWire === null)} style={{ padding: '6px 12px' }} className={`${button} block w-full text-xl ${selectedWire === index && side === 0 ? 'ring-2 ring-white' : ''}`} onClick={() => side === 0 ? setSelectedWire(index) : input({ kind: 'wire', a: selectedWire!, b: index })}>{done ? '✓ ' : ''}{SYMBOLS[symbol]}</button>;
          })}</div>)}</div>
          <p>Соединено: {p.connected.length}/{p.left.length}</p>
        </section>}

        {p?.kind === 'maze' && <section className="space-y-3" aria-label="Лабиринт путей">
          <h3 className="font-bold text-lg">Проведите состав до выхода</h3>
          <p className="text-sm">Вы — «●», выход — «★». Идите по свободным клеткам «·», обходя стены «■». Щёлкайте соседнюю клетку или используйте стрелки клавиатуры. Врезаться в стену — одна ошибка; возвращаться назад можно.</p>
          <div className="grid gap-1 max-w-md mx-auto" style={{ gridTemplateColumns: `repeat(${p.size}, minmax(0, 1fr))` }}>{p.walls.map((wall, index) => <button key={index} disabled={disabled} aria-label={`${index % p.size + 1}, ${Math.floor(index / p.size) + 1}: ${index === p.position ? 'отряд' : index === p.goal ? 'выход' : wall ? 'стена' : 'проход'}`} onClick={() => input({ kind: 'step', a: index })} className={`aspect-square rounded border text-lg focus-visible:ring-2 focus-visible:ring-white ${wall ? 'bg-gray-800 border-gray-600' : index === p.position ? 'bg-cyan-700 border-white' : index === p.goal ? 'bg-green-900 border-green-400' : 'bg-gray-950 border-gray-800'}`}>{index === p.position ? '●' : index === p.goal ? '★' : wall ? '■' : p.visited.includes(index) ? '○' : '·'}</button>)}</div>
        </section>}

        {p?.kind === 'sequence' && <section aria-label="Последовательность сигналов" className="space-y-3">
          <h3 className="text-lg font-bold">{p.reverse ? 'Разомкните эхо-петлю' : 'Погасите кристаллические импульсы'}</h3>
          <p>Запомните {p.sequence.length} символов. После «Начать ввод» повторите их {p.reverse ? 'в обратном порядке, справа налево' : 'слева направо'}. Ошибка сбрасывает ввод к первому символу, но не меняет задание.</p>
          {p.stage === 'study' ? <><div className="flex gap-3 justify-center text-3xl bg-gray-900 rounded p-4" aria-label="Образец сигналов">{p.sequence.map((symbol, i) => <span key={i}>{SYMBOLS[symbol]}</span>)}</div><button disabled={disabled} className={button} onClick={() => input({ kind: 'ready' })}>Начать ввод</button></> : <><p>Введено: {p.cursor}/{p.sequence.length}. Клавиши 1–5 соответствуют кнопкам ниже.</p><div className="grid grid-cols-5 gap-2">{SYMBOLS.slice(0, 5).map((symbol, i) => <button key={i} disabled={disabled} className={button} onClick={() => input({ kind: 'symbol', a: i })}><span className="text-2xl">{symbol}</span><br/><small>{i + 1}</small></button>)}</div></>}
        </section>}

        {e.mode !== 'minigame' && <section className="border border-purple-800 rounded-lg p-3 space-y-2">
          <h3 className="font-bold">{e.mode === 'hybrid' ? 'Помощь навыков: до трёх проверок' : 'Серия проверок навыков'}</h3>
          <p className="text-sm text-gray-400">{e.mode === 'hybrid' ? 'Успех добавляет 10 секунд и прощает одну ошибку. Саму задачу всё равно нужно решить.' : `Успехи: ${e.progress}/${definition.gurpsResolution.requiredSuccesses}. Не более пяти бросков на сцену.`}</p>
          <div className="flex gap-2 flex-wrap"><select aria-label="Навык" className="bg-gray-900 rounded p-2" value={skill} onChange={ev => setSkill(ev.target.value)}>{definition.gurpsResolution.allowedSkillTags.map(tag => <option key={tag} value={tag}>{skillName(tag)}</option>)}{isGM && <option value="manual">Другой навык (выбор ведущего)</option>}</select><label>Уровень <input className="w-16 bg-gray-900 p-2" type="number" min={3} max={18} value={target} onChange={ev => setTarget(Number(ev.target.value))}/></label><button className={button} disabled={disabled || (e.mode === 'hybrid' && e.rollResults.length >= 3)} onClick={() => send('ANOMALY_GURPS_ROLL', { skillTag: skill, target, foundryItemUuid: skill === 'manual' ? item.trim() : undefined })}>Бросить 3 кубика</button></div>
          {skill === 'manual' && <input aria-label="Ссылка на предмет навыка" placeholder="Ссылка или название навыка в Foundry" value={item} onChange={ev => setItem(ev.target.value)} className="w-full bg-gray-900 p-2"/>}
          {e.rollResults.map((roll, i) => <p key={i} className="text-sm">{i + 1}. {skillName(roll.skillTag)}: {roll.roll} против {roll.target} — {roll.success ? 'успех' : 'провал'}</p>)}
        </section>}
        <p className="text-xs text-gray-400">Стабильность: {e.anomalyStability}/100 · Воздействие: {e.exposure}/100 · Заражение: {e.contamination}/100 · Риск поезду: {e.trainIntegrityRisk}/100</p>
        <div className="flex justify-between gap-2"><button className={button} disabled={disabled || e.phase === 'collapse'} onClick={() => send('ANOMALY_ACTION', { actionId: 'retreat' })}>Отступить</button>{isGM && <button className={button} onClick={() => send('ANOMALY_GM_PAUSE', { paused: !e.paused })}>{e.paused ? 'Продолжить испытание' : 'Пауза ведущего'}</button>}</div>
      </>}
    </div>
  </div>;
}
