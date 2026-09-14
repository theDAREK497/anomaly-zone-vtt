import React, { useState, useEffect } from 'react';
import { GameMap, Cell } from '../utils/generator';
import { ChatMessage } from './Chat';
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  Scan, 
  Radio, 
  Target, 
  Flame, 
  Wind, 
  Zap, 
  RotateCw, 
  Hourglass, 
  LogIn, 
  LogOut, 
  Package, 
  Gem, 
  Users, 
  Activity, 
  Skull, 
  ShieldAlert, 
  Compass, 
  Sparkles,
  Check,
  RefreshCw,
  Info
} from 'lucide-react';
import { LootItem } from '../App';
import { AnomalyEncounter } from './AnomalyEncounter';
import { ANOMALY_BY_ID } from '../data/anomalies';
import { RESULT_LABELS, SKILL_LABELS } from '../utils/anomaly-gameplay';

interface GameProps {
  initialMap: GameMap;
  onAddMessage: (msg: Omit<ChatMessage, 'id'>) => void;
  onEndGame: () => void;
  stashLoot: LootItem[];
  artifactLoot: LootItem[];
  isGM?: boolean;
  onUpdateMap?: (newMap: GameMap) => void;
  
  // Real-time server votes parameters
  activeVotes?: Record<string, { username: string; action: string }>;
  activePlayersCount?: number;
  onSubmitVote?: (action: string) => void;
  onResetVotes?: () => void;
  onExecuteImmediateAction?: (action: string) => void;
  username?: string;
  userId?: string;
  ws?: WebSocket | null;
}

export function Game({ 
  initialMap, 
  onAddMessage, 
  onEndGame, 
  stashLoot, 
  artifactLoot, 
  isGM = false, 
  onUpdateMap,
  activeVotes = {},
  activePlayersCount = 0,
  onSubmitVote,
  onResetVotes,
  onExecuteImmediateAction,
  username = '',
  userId = '',
  ws = null
}: GameProps) {
  const map = initialMap;

  // Sync player position from the authoritative server map object
  const playerPos = map.playerPos || { x: map.entrance.x, y: map.entrance.y };

  // Confirmation state
  const [skipConfirm, setSkipConfirm] = useState<boolean>(() => {
    return localStorage.getItem('anomaly_skip_vote_confirm') === 'true';
  });
  const [voteToConfirm, setVoteToConfirm] = useState<string | null>(null);
  const [pickingBoltDirection, setPickingBoltDirection] = useState<boolean>(false);

  const handleModifyCharges = (field: 'boltCharges' | 'geigerCharges' | 'detectorCharges', delta: number) => {
    if (!onUpdateMap) return;
    const currentVal = map[field] !== undefined ? map[field] : 10;
    const newVal = Math.max(0, currentVal + delta);
    const updatedMap = {
      ...map,
      [field]: newVal
    };
    onUpdateMap(updatedMap);
  };

  // Keyboard controls for easier gameplay (only if they are GM, or if player skips confirm, we can let them key-press votes!)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (map.activeAnomalyEncounter || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      let action: string | null = null;
      switch (e.key) {
        case 'ArrowUp': action = 'UP'; break;
        case 'ArrowDown': action = 'DOWN'; break;
        case 'ArrowLeft': action = 'LEFT'; break;
        case 'ArrowRight': action = 'RIGHT'; break;
      }

      if (!action) return;

      if (isGM) {
        if (onExecuteImmediateAction) onExecuteImmediateAction(action);
      } else {
        triggerActionVote(action);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGM, onExecuteImmediateAction, skipConfirm, map.activeAnomalyEncounter]);

  // Submit action after option confirmation checks completed
  const triggerActionVote = (action: string) => {
    if (skipConfirm) {
      if (onSubmitVote) onSubmitVote(action);
    } else {
      setVoteToConfirm(action);
    }
  };

  const confirmPendingVote = () => {
    if (voteToConfirm) {
      if (onSubmitVote) onSubmitVote(voteToConfirm);
      setVoteToConfirm(null);
    }
  };

  const handleSkipConfirmToggle = (checked: boolean) => {
    setSkipConfirm(checked);
    localStorage.setItem('anomaly_skip_vote_confirm', checked ? 'true' : 'false');
  };

  // Helper mapping names for UI
  const getActionName = (act: string) => {
    switch (act) {
      case 'UP': return 'Шаг Вверх ▲';
      case 'DOWN': return 'Шаг Вниз ▼';
      case 'LEFT': return 'Шаг Влево ◀';
      case 'RIGHT': return 'Шаг Вправо ▶';
      case 'BOLT': return 'Бросить Болт 🔩';
      case 'BOLT_UP': return 'Бросить Болт Вверх ⬆️🔩';
      case 'BOLT_DOWN': return 'Бросить Болт Вниз ⬇️🔩';
      case 'BOLT_LEFT': return 'Бросить Болт Влево ⬅️🔩';
      case 'BOLT_RIGHT': return 'Бросить Болт Вправо ➡️🔩';
      case 'GEIGER': return 'Включить Гейгер 📡';
      case 'SCAN': return 'Детектор Артефактов 🔮';
      default: return act;
    }
  };

  // SVG representation for anomalies & objects to bypass browser emoji support gaps
  const renderCellIcon = (cell: Cell) => {
    const isPlayerHere = playerPos.x === cell.x && playerPos.y === cell.y;
    
    // Player indicator gets drawn in absolute layer, avoid crowding
    if (isPlayerHere) return null;

    if (cell.type === 'entrance') {
      return <LogIn size={18} className="text-blue-400 absolute animate-pulse" />;
    }
    if (cell.type === 'exit') {
      return <LogOut size={18} className="text-emerald-400 absolute" />;
    }
    if (cell.type === 'stash') {
      return <Package size={16} className="text-amber-400 absolute" />;
    }
    if (cell.type === 'artifact') {
      return <Gem size={16} className="text-purple-400 absolute animate-bounce" />;
    }

    if (cell.type === 'anomaly') {
      switch (cell.anomalyType) {
        case 'spore-forest': return <Sparkles size={18} className="text-lime-400 absolute" />;
        case 'crystal-resonance': return <Gem size={18} className="text-cyan-300 absolute" />;
        case 'echo-loop': return <RotateCw size={18} className="text-indigo-300 absolute" />;
        case 'static-front': return <Zap size={18} className="text-blue-300 absolute" />;
        case 'living-track': return <Compass size={18} className="text-amber-300 absolute" />;
        default:
          return <ShieldAlert size={18} className="text-red-500 absolute" />;
      }
    }
    return null;
  };

  // Detector direction highlights semi-circle overlay
  const renderDirectionOverlay = (isPlayerHere: boolean) => {
    if (!isPlayerHere || !map.activeDirectionHighlight) return null;
    const highlight = map.activeDirectionHighlight;

    let borderClass = '';
    if (highlight === 'N') borderClass = 'border-t-purple-500 border-l-purple-500/20 border-r-purple-500/20 border-b-purple-500/20 rounded-t-full scale-150';
    else if (highlight === 'S') borderClass = 'border-b-purple-500 border-l-purple-500/20 border-r-purple-500/20 border-t-purple-500/20 rounded-b-full scale-150';
    else if (highlight === 'W') borderClass = 'border-l-purple-500 border-t-purple-500/20 border-b-purple-500/20 border-r-purple-500/20 rounded-l-full scale-150';
    else if (highlight === 'E') borderClass = 'border-r-purple-500 border-t-purple-500/20 border-b-purple-500/20 border-l-purple-500/20 rounded-r-full scale-150';
    else if (highlight.includes('N') && highlight.includes('W')) borderClass = 'border-t-purple-500 border-l-purple-500 rounded-tl-full scale-150';
    else if (highlight.includes('N') && highlight.includes('E')) borderClass = 'border-t-purple-500 border-r-purple-500 rounded-tr-full scale-150';
    else if (highlight.includes('S') && highlight.includes('W')) borderClass = 'border-b-purple-500 border-l-purple-500 rounded-bl-full scale-150';
    else if (highlight.includes('S') && highlight.includes('E')) borderClass = 'border-b-purple-500 border-r-purple-500 rounded-br-full scale-150';

    return (
      <div className={`absolute inset-0 border-4 animate-pulse pointer-events-none z-30 ${borderClass}`} />
    );
  };

  const getCellAppearance = (cell: Cell) => {
    if (cell.isOutOfBounds) {
      return (
        <div 
          key={`${cell.x}-${cell.y}`}
          className="w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 shrink-0 border border-zinc-950 bg-gray-950 opacity-40 flex items-center justify-center relative cursor-not-allowed select-none"
        >
          <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
        </div>
      );
    }

    const isVisible = cell.isRevealed || isGM;
    
    let bgClass = 'bg-gray-800';
    let borderClass = 'border-gray-800/40';

    if (!isVisible) {
      bgClass = 'bg-gray-950 hover:bg-gray-900';
      if (cell.isScannedByBolt) {
        bgClass = 'bg-gray-900 text-gray-500 border-dashed border-gray-800';
      }
    } else {
      switch (cell.type) {
        case 'empty': bgClass = 'bg-zinc-800'; break;
        case 'entrance': bgClass = 'bg-blue-950/40 border-blue-800/60'; break;
        case 'exit': bgClass = 'bg-emerald-950/40 border-emerald-800/60'; break;
        case 'stash': bgClass = 'bg-amber-950/30 border-amber-800/60'; break;
        case 'artifact': bgClass = 'bg-purple-950/30 border-purple-800/60'; break;
        case 'anomaly': bgClass = 'bg-red-950/50 border-red-800/60'; break;
      }
    }

    // Highlight scanned fields (approximate level 3 scan)
    if (!isVisible && cell.isScannedForArtifact) {
      borderClass = 'border-purple-600 border-2';
      bgClass = 'bg-purple-950/10';
      if (cell.isApproximateLocation) {
        bgClass = 'bg-purple-950/30 animate-pulse';
      }
    }
    
    const showRadiation = (isVisible || cell.isScannedForRadiation) && cell.radiationLevel > 0;
    
    if (showRadiation && cell.type === 'empty' && isVisible) {
      if (cell.radiationLevel === 1) bgClass = 'bg-lime-950/50 border-lime-800/30';
      if (cell.radiationLevel === 2) bgClass = 'bg-yellow-950/50 border-yellow-800/30';
      if (cell.radiationLevel === 3) bgClass = 'bg-orange-950/50 border-orange-800/30';
    }

    const isPlayerHere = playerPos.x === cell.x && playerPos.y === cell.y;

    return (
      <div 
        key={`${cell.x}-${cell.y}`}
        className={`w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 shrink-0 border ${borderClass} ${bgClass} flex items-center justify-center relative transition-all duration-300 group`}
      >
        {/* Render Vector SVGs */}
        {isVisible && renderCellIcon(cell)}

        {/* Radiation marker tag */}
        {showRadiation && (
          <div className="absolute top-0.5 right-0.5 text-[8px] sm:text-[10px] bg-yellow-400 text-black px-1 font-extrabold rounded-sm z-10 leading-none">
            {cell.radiationLevel}☢
          </div>
        )}

        {/* Player icon token */}
        {isPlayerHere && (
          <div className="absolute inset-0 flex items-center justify-center z-20 overflow-visible">
            <div className="relative">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20 animate-ping" />
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white border-2 border-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,1)] flex items-center justify-center text-[10px] text-green-700 font-bold">
                🪖
              </div>
            </div>
          </div>
        )}

        {/* Aura highlighted directions */}
        {renderDirectionOverlay(isPlayerHere)}

        {/* Hover coordinate overlays useful for table players */}
        <div className="absolute inset-0 bg-transparent text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 flex items-end justify-center pointer-events-none transition-opacity">
          {cell.x},{cell.y}
        </div>
      </div>
    );
  };

  // Generating a 7x7 grid centered on the player's position
  const getViewportGrid = (): Cell[][] => {
    const px = playerPos.x;
    const py = playerPos.y;
    
    const gridRows: Cell[][] = [];
    
    for (let dy = -3; dy <= 3; dy++) {
      const y = py + dy;
      const rowCells: Cell[] = [];
      for (let dx = -3; dx <= 3; dx++) {
        const x = px + dx;
        
        if (y >= 0 && y < map.height && x >= 0 && x < map.width) {
          const cell = map.grid[y]?.[x];
          if (cell) {
            rowCells.push(cell);
          } else {
            rowCells.push({
              x,
              y,
              type: 'empty',
              anomalyType: null,
              radiationLevel: 0,
              isRevealed: false,
              isScannedForArtifact: false,
              isScannedForRadiation: false,
              isScannedByBolt: false,
              isOutOfBounds: true
            });
          }
        } else {
          rowCells.push({
            x,
            y,
            type: 'empty',
            anomalyType: null,
            radiationLevel: 0,
            isRevealed: false,
            isScannedForArtifact: false,
            isScannedForRadiation: false,
            isScannedByBolt: false,
            isOutOfBounds: true
          });
        }
      }
      gridRows.push(rowCells);
    }
    return gridRows;
  };

  // Safe variables for HUD stats calculation
  const hpPercent = Math.max(0, Math.min(100, (map.health / map.maxHealth) * 100));
  const radPercent = Math.max(0, Math.min(100, (map.radiation / map.maxRadiation) * 100));

  // Count active player votes per action type
  const voteTallies: Record<string, number> = {};
  const votersPerAction: Record<string, string[]> = {};
  Object.entries(activeVotes).forEach(([pid, vote]) => {
    voteTallies[vote.action] = (voteTallies[vote.action] || 0) + 1;
    if (!votersPerAction[vote.action]) votersPerAction[vote.action] = [];
    votersPerAction[vote.action].push(vote.username);
  });

  // Check if current user already submitted a vote
  const hasVoted = Object.keys(activeVotes).some(pid => {
    // Check key
    for (const [vId, p] of Object.entries(activeVotes)) {
      if (vId === userId || p.username === username) return true;
    }
    return false;
  });
  const myVoteAction = Object.entries(activeVotes).find(([vId, p]) => vId === userId || p.username === username)?.[1]?.action;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* 1. TOP DEXTEROUS HUD PANEL STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {/* HP INDICATOR */}
        <div className="bg-gray-900 border border-gray-800 p-3.5 rounded-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5 uppercase">
              <Activity className="text-green-500" size={14} /> Здоровье Отряда
            </span>
            <span className="text-sm font-bold font-mono text-green-400">{map.health}/{map.maxHealth} ОЗ</span>
          </div>
          <div className="w-full bg-gray-950 h-3 rounded-full overflow-hidden border border-gray-800">
            <div 
              className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-green-500 transition-all duration-300"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* RADIATION INDICATOR */}
        <div className="bg-gray-900 border border-gray-800 p-3.5 rounded-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5 uppercase">
              <Skull className="text-yellow-500" size={14} /> ФОНОВОЕ ЗАРАЖЕНИЕ
            </span>
            <span className="text-sm font-bold font-mono text-yellow-400">{map.radiation}/{map.maxRadiation} ед.</span>
          </div>
          <div className="w-full bg-gray-950 h-3 rounded-full overflow-hidden border border-gray-800">
            <div 
              className="h-full bg-yellow-500 animate-pulse transition-all duration-300"
              style={{ width: `${radPercent}%` }}
            />
          </div>
        </div>

        {/* ACTIVE MODULE CHARGES STATUS */}
        <div className="bg-gray-900 border border-gray-800 p-3.5 rounded-lg grid grid-cols-3 gap-2.5 text-xs font-mono text-gray-400">
          <div>
            <div className="text-[9px] text-gray-500 uppercase leading-normal">Датчики Гейгера</div>
            <div className="text-sm font-extrabold text-lime-400 flex items-center gap-1">
              <Radio size={14} /> {map.geigerCharges} шт.
            </div>
          </div>
          <div>
            <div className="text-[9px] text-gray-500 uppercase leading-normal">Детектор (ур. {map.detectorLevel})</div>
            <div className="text-sm font-extrabold text-purple-400 flex items-center gap-1">
              <Sparkles size={14} /> {map.detectorCharges} шт.
            </div>
          </div>
          <div>
            <div className="text-[9px] text-gray-500 uppercase leading-normal">Запас болтов</div>
            <div className="text-sm font-extrabold text-cyan-400 flex items-center gap-1">
              <Compass size={14} /> {map.boltCharges !== undefined ? map.boltCharges : 10} шт.
            </div>
          </div>
        </div>
      </div>

      {map.activeAnomalyEncounter && <AnomalyEncounter map={map} ws={ws} isGM={isGM} />}

      {/* 2. THE DYNAMIC FLEX GRID SIZING AREA WITH MAX AREA SPACE */}
      <div className="flex-1 bg-gray-950 rounded-lg border border-gray-800 overflow-hidden relative p-4 lg:p-6 flex flex-col items-center justify-center min-h-[350px]">
        {/* Floating coordinates header */}
        <div className="sticky top-0 left-0 right-0 w-full mb-4 flex flex-wrap justify-between gap-2 z-10 shrink-0 text-xs font-mono text-gray-400 bg-gray-950/90 py-1 px-2 rounded backdrop-blur">
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-emerald-500" /> Координаты Сталкеров: <span className="text-emerald-400 font-bold">{playerPos.x}, {playerPos.y}</span>
          </div>
          {isGM ? (
            <div className="text-amber-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <Info size={12} /> Режим Куратора (Все тайны видны)
            </div>
          ) : (
            <div className="text-indigo-400 flex items-center gap-2">
              <Users size={12} /> Голосование: <span className="font-bold text-white">{Object.keys(activeVotes).length}</span> из <span className="font-bold text-white">{activePlayersCount || 1}</span> исследователей
            </div>
          )}
        </div>
        
        {/* Dynamic map viewport container */}
        <div className="flex-1 overflow-hidden w-full flex items-center justify-center">
          <div 
            className="grid gap-px bg-gray-900 border-2 border-zinc-700/60 p-1 rounded shrink-0 shadow-[0_0_35px_rgba(0,0,0,0.8)] relative"
            style={{ gridTemplateColumns: `repeat(7, max-content)` }}
          >
            {getViewportGrid().map(row => row.map(cell => getCellAppearance(cell)))}
          </div>
        </div>
      </div>

      {/* 3. BOTH MASTER AND PLAYER NAVIGATION & DECISION POLL BENTO BOXES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
        
        {/* VOTING OPTIONS AND CONTROL BUTTONS (GM EXECUTES DIRECTLY, PLAYERS CAST CO-OP VOTES) */}
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-lg shadow-xl lg:col-span-8 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold font-mono text-gray-200 tracking-wide uppercase flex items-center gap-2">
                <Users size={14} className="text-emerald-500" /> 
                {isGM ? 'ПРИНУДИТЕЛЬНОЕ УПРАВЛЕНИЕ АКТИВНО' : 'КОЛЛЕКТИВНОЕ ГОЛОСОВАНИЕ И ОПРОСЫ'}
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {isGM ? 'Вы управляете группой мгновенными импульсами.' : 'Решение принимается большинством голосов.'}
              </p>
            </div>

            {/* Turn limit countdown clock indicator */}
            <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 py-1 px-3 rounded text-xs font-mono">
              <Hourglass size={14} className="text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
              Таймер хода: <span className={`font-bold ${map.timerSeconds <= 15 ? 'text-red-500 animate-pulse' : 'text-amber-400'}`}>{Math.ceil(map.timerSeconds ?? 60)}с {map.activeAnomalyEncounter ? '· ПАУЗА' : ''}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* DIRECTIONAL D-PAD BOARD */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="grid grid-cols-3 gap-2 w-full max-w-[180px]">
                <div />
                <button 
                  onClick={() => isGM ? (onExecuteImmediateAction && onExecuteImmediateAction('UP')) : triggerActionVote('UP')} 
                  className={`p-3.5 rounded flex justify-center text-white transition-all border-b-2 border-black font-bold cursor-pointer ${
                    myVoteAction === 'UP' ? 'bg-emerald-600 border-emerald-950 text-black' : 'bg-gray-800 hover:bg-gray-700 active:scale-95'
                  }`}
                  title="Шаг вверх"
                >
                  <ArrowUp size={20} />
                </button>
                <div />

                <button 
                  onClick={() => isGM ? (onExecuteImmediateAction && onExecuteImmediateAction('LEFT')) : triggerActionVote('LEFT')}
                  className={`p-3.5 rounded flex justify-center text-white transition-all border-b-2 border-black font-bold cursor-pointer ${
                    myVoteAction === 'LEFT' ? 'bg-emerald-600 border-emerald-950 text-black' : 'bg-gray-800 hover:bg-gray-700 active:scale-95'
                  }`}
                  title="Шаг влево"
                >
                  <ArrowLeft size={20} />
                </button>
                <button 
                  disabled
                  className="bg-gray-950 text-gray-700 p-3.5 rounded flex justify-center border border-gray-800 cursor-not-allowed select-none"
                >
                  🧭
                </button>
                <button 
                  onClick={() => isGM ? (onExecuteImmediateAction && onExecuteImmediateAction('RIGHT')) : triggerActionVote('RIGHT')}
                  className={`p-3.5 rounded flex justify-center text-white transition-all border-b-2 border-black font-bold cursor-pointer ${
                    myVoteAction === 'RIGHT' ? 'bg-emerald-600 border-emerald-950 text-black' : 'bg-gray-800 hover:bg-gray-700 active:scale-95'
                  }`}
                  title="Шаг вправо"
                >
                  <ArrowRight size={20} />
                </button>

                <div />
                <button 
                  onClick={() => isGM ? (onExecuteImmediateAction && onExecuteImmediateAction('DOWN')) : triggerActionVote('DOWN')}
                  className={`p-3.5 rounded flex justify-center text-white transition-all border-b-2 border-black font-bold cursor-pointer ${
                    myVoteAction === 'DOWN' ? 'bg-emerald-600 border-emerald-950 text-black' : 'bg-gray-800 hover:bg-gray-700 active:scale-95'
                  }`}
                  title="Шаг вниз"
                >
                  <ArrowDown size={20} />
                </button>
                <div />
              </div>
            </div>

            {/* ACTION TRIGGERS IN BULK */}
            <div className="md:col-span-7 flex flex-col gap-2.5">
              {pickingBoltDirection ? (
                <div className="p-3 bg-gray-950 rounded border border-cyan-800/40 flex flex-col gap-2">
                  <div className="text-[10px] font-mono text-cyan-400 flex justify-between items-center">
                    <span>🎯 Куда запустить болт (скан до 3х кл. вперёд)?</span>
                    <button 
                      onClick={() => setPickingBoltDirection(false)}
                      className="text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-400 py-0.5 px-1.5 rounded cursor-pointer uppercase font-bold"
                    >
                      Отмена ×
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button 
                      onClick={() => {
                        setPickingBoltDirection(false);
                        isGM ? (onExecuteImmediateAction && onExecuteImmediateAction('BOLT_UP')) : triggerActionVote('BOLT_UP');
                      }}
                      className="py-2.5 bg-gray-900 hover:bg-cyan-950 hover:border-cyan-800 text-xs text-white rounded font-bold transition-all border border-gray-800/80 flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowUp size={14} className="text-cyan-400" />
                      <span className="text-[9px]">Вверх</span>
                    </button>

                    <button 
                      onClick={() => {
                        setPickingBoltDirection(false);
                        isGM ? (onExecuteImmediateAction && onExecuteImmediateAction('BOLT_DOWN')) : triggerActionVote('BOLT_DOWN');
                      }}
                      className="py-2.5 bg-gray-900 hover:bg-cyan-950 hover:border-cyan-800 text-xs text-white rounded font-bold transition-all border border-gray-800/80 flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowDown size={14} className="text-cyan-400" />
                      <span className="text-[9px]">Вниз</span>
                    </button>

                    <button 
                      onClick={() => {
                        setPickingBoltDirection(false);
                        isGM ? (onExecuteImmediateAction && onExecuteImmediateAction('BOLT_LEFT')) : triggerActionVote('BOLT_LEFT');
                      }}
                      className="py-2.5 bg-gray-900 hover:bg-cyan-950 hover:border-cyan-800 text-xs text-white rounded font-bold transition-all border border-gray-800/80 flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft size={14} className="text-cyan-400" />
                      <span className="text-[9px]">Влево</span>
                    </button>

                    <button 
                      onClick={() => {
                        setPickingBoltDirection(false);
                        isGM ? (onExecuteImmediateAction && onExecuteImmediateAction('BOLT_RIGHT')) : triggerActionVote('BOLT_RIGHT');
                      }}
                      className="py-2.5 bg-gray-900 hover:bg-cyan-950 hover:border-cyan-800 text-xs text-white rounded font-bold transition-all border border-gray-800/80 flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowRight size={14} className="text-cyan-400" />
                      <span className="text-[9px]">Вправо</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setPickingBoltDirection(true)}
                  className={`w-full py-3.5 px-4 rounded font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-black ${
                    myVoteAction && myVoteAction.startsWith('BOLT') ? 'bg-cyan-600 text-black font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                  disabled={map.boltCharges <= 0 && !isGM}
                >
                  <Target size={16} className={map.boltCharges > 0 ? "text-cyan-400 animate-pulse" : "text-gray-500"} /> 
                  Бросить Болт 🔩 (выбрать направление)
                </button>
              )}

              <button 
                onClick={() => isGM ? (onExecuteImmediateAction && onExecuteImmediateAction('GEIGER')) : triggerActionVote('GEIGER')}
                className={`w-full py-3.5 px-4 rounded font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-black ${
                  myVoteAction === 'GEIGER' ? 'bg-emerald-600 text-black font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                disabled={map.geigerCharges <= 0 && !isGM}
              >
                <Radio size={16} className={map.geigerCharges > 0 ? "text-lime-400" : "text-gray-500"} />
                Запустить датчики Гейгера (Зарядов: {map.geigerCharges})
              </button>

              <button 
                onClick={() => isGM ? (onExecuteImmediateAction && onExecuteImmediateAction('SCAN')) : triggerActionVote('SCAN')}
                className={`w-full py-3.5 px-4 rounded font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-black ${
                  myVoteAction === 'SCAN' ? 'bg-emerald-600 text-black font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                disabled={map.detectorCharges <= 0 && !isGM}
              >
                <Scan size={16} className={map.detectorCharges > 0 ? "text-purple-400" : "text-gray-500"} />
                Поиск Сверхпроводников / Арт. (Зарядов: {map.detectorCharges})
              </button>

              {/* GM-specific reset votes controller to allow game mastery bypass */}
              {isGM && (
                <div className="space-y-3 mt-3">
                  <button 
                    onClick={() => onResetVotes && onResetVotes()}
                    className="w-full bg-rose-950/40 hover:bg-rose-900 border border-rose-900/60 text-rose-300 py-2 rounded text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={14} /> СБРОСИТЬ ТЕКУЩИЕ ГОЛОСА ИГРОКОВ
                  </button>
                  
                  <div className="p-3 bg-gray-950/70 rounded border border-amber-500/20 font-mono text-xs">
                    <div className="text-amber-400 font-bold mb-2 uppercase tracking-wide flex items-center gap-1.5 text-[10px]">
                      <span>🛠️ Снабжение отряда (Панель Куратора):</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[9px] text-gray-400">
                      <div className="flex flex-col gap-1 items-center bg-gray-900 p-1.5 rounded border border-gray-800">
                        <span className="text-gray-500">🔩 Болты</span>
                        <div className="text-xs font-bold text-cyan-400">{map.boltCharges !== undefined ? map.boltCharges : 10} шт</div>
                        <div className="flex gap-1 mt-0.5">
                          <button onClick={() => handleModifyCharges('boltCharges', -1)} className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-red-400 font-bold">-</button>
                          <button onClick={() => handleModifyCharges('boltCharges', 1)} className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-green-400 font-bold">+</button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-center bg-gray-900 p-1.5 rounded border border-gray-800">
                        <span className="text-gray-500">📡 Гейгер</span>
                        <div className="text-xs font-bold text-lime-400">{map.geigerCharges} шт</div>
                        <div className="flex gap-1 mt-0.5">
                          <button onClick={() => handleModifyCharges('geigerCharges', -1)} className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-red-400 font-bold">-</button>
                          <button onClick={() => handleModifyCharges('geigerCharges', 1)} className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-green-400 font-bold">+</button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-center bg-gray-900 p-1.5 rounded border border-gray-800">
                        <span className="text-gray-500">🔮 Скан Арт</span>
                        <div className="text-xs font-bold text-purple-400">{map.detectorCharges} шт</div>
                        <div className="flex gap-1 mt-0.5">
                          <button onClick={() => handleModifyCharges('detectorCharges', -1)} className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-red-400 font-bold">-</button>
                          <button onClick={() => handleModifyCharges('detectorCharges', 1)} className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-green-400 font-bold">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DETAILED STATS, VOTES BAR, AND MAP LEGEND GRAPHICS */}
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-lg shadow-xl lg:col-span-4 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold font-mono text-gray-400 tracking-wider mb-2.5 uppercase flex items-center gap-1.5">
              <Check className="text-emerald-500" size={14} /> ТЕКУЩИЙ СГОВОР (ГОЛОСА ГРУППЫ)
            </h4>
            
            {Object.keys(activeVotes).length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-xs font-mono border border-dashed border-gray-800 rounded">
                Нет активных голосов.<br />Выберите действие на панели слева.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(voteTallies).map(([action, count]) => {
                  const voters = votersPerAction[action] || [];
                  const percent = activePlayersCount > 0 ? (count / activePlayersCount) * 100 : 100;
                  return (
                    <div key={action} className="bg-gray-950 border border-gray-800 p-2 rounded text-xs font-mono">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-emerald-400 font-bold">{getActionName(action)}</span>
                        <span className="text-white text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-sm">{count} {count === 1 ? 'голос' : 'голоса'}</span>
                      </div>
                      
                      <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
                      </div>
                      
                      <div className="text-[9px] text-gray-500 leading-none">
                        Голосовали: {voters.join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800/80 space-y-2 text-xs text-gray-500">
            <p className="flex items-center"><span className="shrink-0 w-3 h-3 bg-blue-600/30 border border-blue-500/40 mr-2.5 rounded-sm"></span> Вход в Зону</p>
            <p className="flex items-center"><span className="shrink-0 w-3 h-3 bg-emerald-600/30 border border-emerald-500/40 mr-2.5 rounded-sm"></span> Точка Эвакуации</p>
            <p className="flex items-center"><span className="shrink-0 w-3 h-3 bg-amber-600/30 border border-amber-500/40 mr-2.5 rounded-sm"></span> Заброшенный схрон (хабар)</p>
            <p className="flex items-center"><span className="shrink-0 w-3 h-3 bg-purple-600/30 border border-purple-500/40 mr-2.5 rounded-sm"></span> Ценный артефакт</p>
            <p className="flex items-center"><span className="shrink-0 w-3 h-3 bg-red-600/30 border border-red-500/40 mr-2.5 rounded-sm text-center flex items-center justify-center font-bold text-[8px] text-red-400">◆</span> Аномалия ЭОН (сначала наблюдайте закон)</p>
          </div>
        </div>

      </div>

      {isGM && (map.anomalyJournal?.length || 0) > 0 && (
        <details className="bg-gray-900 border border-gray-800 rounded-lg p-4 shrink-0">
          <summary className="cursor-pointer text-xs font-bold text-amber-400 uppercase">Закрытый журнал GM · аномалии ({map.anomalyJournal?.length})</summary>
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
            {[...(map.anomalyJournal || [])].reverse().map((entry, index) => (
              <div key={`${entry.seed}-${index}`} className="bg-gray-950 border border-gray-800 rounded p-3 text-[11px] font-mono">
                <div className="font-bold text-cyan-300">{ANOMALY_BY_ID[entry.anomalyId]?.name || entry.anomalyId} · {RESULT_LABELS[entry.result]}</div>
                <div className="text-gray-400 mt-1">Ключ: {entry.seed} · способ: {entry.mode === 'field' ? 'эффект на поле' : entry.mode === 'gurps-roll' ? 'кубики' : entry.mode === 'hybrid' ? 'мини-игра с навыками' : 'мини-игра'} · ошибки: {entry.mistakes}</div>
                <div className="text-gray-500">Участники: {entry.participants.join(', ') || 'не указаны'} · навыки: {entry.usedSkills.map(skill => SKILL_LABELS[skill] || 'Выбор ведущего').join(', ') || 'нет'}</div>
                <div className="text-gray-500">Броски: {entry.rollResults.map(roll => `${roll.skillTag}${roll.foundryItemUuid ? ` [${roll.foundryItemUuid}]` : ''}: ${roll.roll}/${roll.target}, маржа ${roll.margin}`).join(' · ') || 'нет'}</div>
                <div className="text-gray-500">Решения: {entry.decisions.join(' → ') || 'нет'} </div>
                {(entry.consequences.length > 0 || entry.rewards.length > 0 || entry.trainChanges.length > 0) && <div className="mt-1 text-amber-300">Последствия: {[...entry.consequences, ...entry.trainChanges].join('; ') || 'нет'} · Награды: {entry.rewards.join('; ') || 'нет'}</div>}
                <div className="text-gray-600 mt-1">Завершено: {entry.completedAt}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* 4. CHAT-THEMATIC RADAR CONFIRMATION DIALOG MODAL Overlay */}
      {voteToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-gray-900 border border-emerald-900/60 rounded-lg shadow-2xl p-6 relative">
            <div className="text-center mb-4">
              <span className="inline-flex items-center justify-center p-3 bg-emerald-950/50 rounded-full border border-emerald-800/40 text-emerald-400 mb-2">
                <ShieldAlert size={24} />
              </span>
              <h3 className="text-lg font-bold text-gray-100 uppercase tracking-wide">Подтверждение голоса</h3>
              <p className="text-xs text-gray-400 mt-1 font-mono">
                Вы отправляете приказ отряду:
              </p>
              <p className="bg-gray-950 border border-gray-800 py-2.5 px-4 rounded text-sm text-emerald-300 tracking-wider font-extrabold font-mono mt-2 uppercase shadow">
                {getActionName(voteToConfirm)}
              </p>
            </div>

            <p className="text-xs text-center text-gray-500 mb-5 leading-normal">
              Голосование игроков окончательно зафиксирует это действие, как только наберется нужный кворум на сервере.
            </p>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={skipConfirm}
                  onChange={(e) => handleSkipConfirmToggle(e.target.checked)}
                  className="rounded bg-gray-950 border-gray-800 text-emerald-600 focus:ring-emerald-700 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-mono text-gray-400">Больше не спрашивать</span>
              </label>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => setVoteToConfirm(null)}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 px-4 rounded text-xs uppercase cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={confirmPendingVote}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold py-2.5 px-4 rounded text-xs uppercase cursor-pointer shadow-[0_0_15px_rgba(5,150,105,0.4)]"
                >
                  Уверен!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
