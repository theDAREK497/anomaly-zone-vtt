import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Setup } from './components/Setup';
import { Game } from './components/Game';
import { Chat, ChatMessage } from './components/Chat';
import { Tavern } from './components/Tavern';
import { generateMap, GameMap, GenerationParams } from './utils/generator';
import { Map as MapIcon, Flame, Wrench } from 'lucide-react';

type GameState = 'setup' | 'playing' | 'ended';

export interface LootItem {
  id: string;
  name: string;
  weight: number;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('setup');
  const [map, setMap] = useState<GameMap | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'map' | 'bar' | 'admin'>('map');
  const [stashLoot, setStashLoot] = useState<LootItem[]>([
    { id: '1', name: 'Аптечка', weight: 10 },
    { id: '2', name: 'Патроны', weight: 20 },
    { id: '3', name: 'Антирад', weight: 15 },
    { id: '4', name: 'Тушенка', weight: 30 },
    { id: '5', name: 'Пусто', weight: 25 },
  ]);
  const [artifactLoot, setArtifactLoot] = useState<LootItem[]>([
    { id: '1', name: 'Капля', weight: 20 },
    { id: '2', name: 'Кровь камня', weight: 15 },
    { id: '3', name: 'Слизь', weight: 25 },
    { id: '4', name: 'Колючка', weight: 10 },
    { id: '5', name: 'Медуза', weight: 30 },
  ]);

  // Auth / Connection settings
  const [userRole, setUserRole] = useState<'player' | 'gm' | null>(() => {
    const role = localStorage.getItem('anomaly_role');
    return (role === 'player' || role === 'gm') ? role : null;
  });
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('anomaly_username') || '';
  });
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem('anomaly_username') || '';
  });

  const [isConnected, setIsConnected] = useState(false);
  const [hasActiveGM, setHasActiveGM] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isProxyingAsPlayer, setIsProxyingAsPlayer] = useState(false);

  const [existingProfiles, setExistingProfiles] = useState<string[]>([]);
  const [formName, setFormName] = useState<string>(() => {
    return localStorage.getItem('anomaly_username') || '';
  });
  const [isCreatingNewProfile, setIsCreatingNewProfile] = useState<boolean>(false);

  useEffect(() => {
    if (!isConnected) {
      fetch('/api/profiles')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setExistingProfiles(data);
          }
        })
        .catch(err => console.error("Error loading profiles:", err));
    }
  }, [isConnected]);

  // Voting states from server socket
  const [activeVotes, setActiveVotes] = useState<Record<string, { username: string; action: string }>>({});
  const [activePlayersCount, setActivePlayersCount] = useState<number>(0);

  // GM variables mapped to the original design
  const actualGM = userRole === 'gm';
  const isGM = actualGM && !isProxyingAsPlayer;

  const socketRef = useRef<WebSocket | null>(null);

  // Sync / Send logic
  const syncStatePayload = useCallback((delta: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'SYNC_APP_STATE',
        payload: delta
      }));
    }
  }, []);

  const submitVote = useCallback((action: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'SUBMIT_VOTE',
        payload: { action }
      }));
    }
  }, []);

  const resetVotes = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'RESET_VOTES'
      }));
    }
  }, []);

  const executeImmediateAction = useCallback((action: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'EXECUTE_IMMEDIATE_ACTION',
        payload: { action }
      }));
    }
  }, []);

  const connectSocket = useCallback((roleToJoin: 'player' | 'gm', nameToJoin: string) => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    console.log("Anomaly Zone | Connecting WebSocket to:", wsUrl);

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setAuthError(null);
      ws.send(JSON.stringify({
        type: 'JOIN',
        payload: { id: nameToJoin, username: nameToJoin, role: roleToJoin }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);

        switch (type) {
          case 'INIT_STATE': {
            if (payload.gameState !== undefined) setGameState(payload.gameState);
            if (payload.map !== undefined) setMap(payload.map);
            if (payload.messages !== undefined) setMessages(payload.messages);
            if (payload.stashLoot !== undefined) setStashLoot(payload.stashLoot);
            if (payload.artifactLoot !== undefined) setArtifactLoot(payload.artifactLoot);
            setHasActiveGM(payload.hasActiveGM);
            if (payload.activeVotes !== undefined) setActiveVotes(payload.activeVotes);
            if (payload.activePlayersCount !== undefined) setActivePlayersCount(payload.activePlayersCount);
            break;
          }
          case 'SYNC_APP_STATE': {
            if (payload.gameState !== undefined) setGameState(payload.gameState);
            if (payload.map !== undefined) setMap(payload.map);
            if (payload.messages !== undefined) setMessages(payload.messages);
            if (payload.stashLoot !== undefined) setStashLoot(payload.stashLoot);
            if (payload.artifactLoot !== undefined) setArtifactLoot(payload.artifactLoot);
            break;
          }
          case 'PLAYERS_UPDATE': {
            setPlayers(payload.players);
            setHasActiveGM(payload.hasActiveGM);
            break;
          }
          case 'JOIN_REJECTED': {
            if (payload.reason === 'GM_ALREADY_EXISTS') {
              setAuthError('GM_ALREADY_EXISTS');
              setIsConnected(false);
              ws.close();
            }
            break;
          }
          case 'ROLE_KICKED': {
            setUserRole('player');
            localStorage.setItem('anomaly_role', 'player');
            alert(payload.message || 'Смена роли');
            break;
          }
          case 'VOTES_UPDATE': {
            setActiveVotes(payload.activeVotes || {});
            setActivePlayersCount(payload.activePlayersCount || 0);
            break;
          }
          case 'TIMER_TICK': {
            setMap(prev => prev ? { ...prev, timerSeconds: payload.timerSeconds } : null);
            break;
          }
        }
      } catch (err) {
        console.error("Error matching socket message details:", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket Connection Closed.");
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
    };
  }, []);

  // Handle auto connection
  useEffect(() => {
    if (userRole && username) {
      connectSocket(userRole, username);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [userRole, username, connectSocket]);

  const toggleGMProxy = () => {
    if (actualGM) {
      setIsProxyingAsPlayer(!isProxyingAsPlayer);
    }
  };

  useEffect(() => {
    if (!isGM && activeTab === 'admin') {
      setActiveTab('map');
    }
  }, [isGM, activeTab]);

  useEffect(() => {
    if (gameState === 'playing' && activeTab === 'bar') {
      setActiveTab('map');
    }
  }, [gameState, activeTab]);

  const syncAll = (newGameState: GameState, newMap: GameMap | null, newMessages: ChatMessage[]) => {
    setGameState(newGameState);
    setMap(newMap);
    setMessages(newMessages);
    syncStatePayload({ gameState: newGameState, map: newMap, messages: newMessages, stashLoot, artifactLoot });
  };

  const handleGenerate = (params: GenerationParams) => {
    const newMap = generateMap(params);
    const initialMsg = {
      text: `Зона сгенерирована (Размер: ${params.width}x${params.height}, Сложность: ${params.difficulty}). Куратор (${username}) готов наблюдать за вашим заходом.`,
      type: 'info' as const,
      id: Math.random().toString(36).substring(2, 9)
    };
    syncAll('playing', newMap, [...messages, initialMsg]);
  };

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    const newMsg = { ...msg, id: Math.random().toString(36).substring(2, 9) };
    const newMessages = [...messages, newMsg];
    setMessages(newMessages);
    syncStatePayload({ messages: newMessages });
  };

  const handleEndGame = () => {
    setGameState('ended');
    syncStatePayload({ gameState: 'ended' });
  };

  const resetGame = () => {
    syncAll('setup', null, []);
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    const roleInput = target.elements.namedItem('role') as HTMLInputElement;

    const chosenName = formName.trim();
    const chosenRole = roleInput.value as 'player' | 'gm';

    if (!chosenName) {
      alert("Пожалуйста, введите или выберите кличку сталкера!");
      return;
    }

    setUsername(chosenName);
    setUserId(chosenName);
    setUserRole(chosenRole);
    localStorage.setItem('anomaly_username', chosenName);
    localStorage.setItem('anomaly_role', chosenRole);

  };

  const claimForceGM = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    // Connect and force-claim
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setAuthError(null);
      ws.send(JSON.stringify({
        type: 'FORCE_CLAIM_GM',
        payload: { id: userId, username }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        if (type === 'INIT_STATE') {
          if (payload.gameState !== undefined) setGameState(payload.gameState);
          if (payload.map !== undefined) setMap(payload.map);
          if (payload.messages !== undefined) setMessages(payload.messages);
          if (payload.stashLoot !== undefined) setStashLoot(payload.stashLoot);
          if (payload.artifactLoot !== undefined) setArtifactLoot(payload.artifactLoot);
          setUserRole('gm');
          localStorage.setItem('anomaly_role', 'gm');
        }
      } catch (err) {
        console.error("Match state error:", err);
      }
    };
  };

  const handleLogout = () => {
    localStorage.removeItem('anomaly_role');
    setUserRole(null);
    setIsConnected(false);
    if (socketRef.current) {
      socketRef.current.close();
    }
  };

  // Auth gate UI rendering
  if (!isConnected || !userRole) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Atmosphere radar circle pattern behind */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_65%)] pointer-events-none" />
        
        <div className="w-full max-w-md bg-gray-900 border border-emerald-900/40 rounded-lg shadow-2xl p-6 relative z-10">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold text-emerald-500 tracking-wider flex items-center justify-center gap-2">
              <i className="fas fa-radiation animate-spin [animation-duration:12s]"></i> ANOMALY ZONE
            </h1>
            <p className="text-xs text-emerald-600 font-mono tracking-widest mt-1">ТЕРМИНАЛ СВЯЗИ С КОРДОНОМ</p>
          </div>

          {authError === 'GM_ALREADY_EXISTS' ? (
            <div className="space-y-4">
              <div className="bg-amber-950/40 border border-amber-900/50 p-4 rounded text-sm text-amber-200">
                <h3 className="font-bold mb-1 flex items-center gap-2 text-amber-400">
                  <i className="fas fa-exclamation-triangle"></i> ВНИМАНИЕ: КУРАТОР АКТИВЕН
                </h3>
                На этом сервере аномальной зоны уже присутствует активный Куратор (GM). Гейм-мастер может быть только один.
              </div>
              <p className="text-xs text-gray-400">
                Вы можете войти как обычный игрок-исследователь, либо принудительно перехватить у него роль (если это ваше зависшее окно или вы хотите сменить мастера).
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUserRole('player');
                    localStorage.setItem('anomaly_role', 'player');
                    setUsername(username || `Сталкер_${Math.floor(Math.random() * 1000)}`);
                    setAuthError(null);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded text-sm transition-colors cursor-pointer"
                >
                  Войти как игрок
                </button>
                <button
                  type="button"
                  onClick={claimForceGM}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded text-sm transition-colors cursor-pointer"
                >
                  Принудительно занять роль Куратора
                </button>
                <button
                  type="button"
                  onClick={() => setAuthError(null)}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2 px-4 rounded text-sm transition-colors cursor-pointer"
                >
                  Вернуться на экран входа
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-emerald-600 tracking-wider uppercase mb-1.5">
                  Профиль КПК Сталкера
                </label>
                
                {existingProfiles.length > 0 ? (
                  <div className="space-y-3">
                    <select
                      className="w-full bg-gray-950 border border-gray-800 focus:border-emerald-700 rounded px-3 py-2 text-emerald-300 text-sm focus:outline-none transition-colors"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__new__") {
                          setIsCreatingNewProfile(true);
                          setFormName("");
                        } else {
                          setIsCreatingNewProfile(false);
                          setFormName(val);
                        }
                      }}
                      value={isCreatingNewProfile ? "__new__" : formName}
                    >
                      <option value="">-- Выберите существующий профиль --</option>
                      {existingProfiles.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      <option value="__new__">+ Новый Сталкер (Создать профиль)...</option>
                    </select>

                    {(isCreatingNewProfile || !formName || !existingProfiles.includes(formName)) && (
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Введите кличку нового сталкера..."
                        className="w-full bg-gray-950 border border-gray-800 focus:border-emerald-700 rounded px-3 py-2 text-emerald-300 text-sm focus:outline-none transition-colors placeholder-gray-700 animate-fade-in"
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Например: Меченый, Стрелок..."
                    className="w-full bg-gray-950 border border-gray-800 focus:border-emerald-700 rounded px-3 py-2 text-emerald-300 text-sm focus:outline-none transition-colors placeholder-gray-700"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-mono text-emerald-600 tracking-wider uppercase mb-1.5">Выбор Роли в Системе</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="relative flex flex-col items-center justify-center p-3 rounded bg-gray-950 border border-gray-800 hover:border-emerald-800 cursor-pointer transition-colors group has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-950/20">
                    <input
                      type="radio"
                      name="role"
                      value="player"
                      defaultChecked={userRole !== 'gm'}
                      className="peer absolute opacity-0"
                    />
                    <div className="text-xl text-gray-500 group-hover:text-emerald-400 peer-checked:text-emerald-400 mb-1">
                      <i className="fas fa-biohazard"></i>
                    </div>
                    <span className="text-xs font-bold text-gray-400 peer-checked:text-emerald-300">ИГРОК</span>
                    <span className="text-[10px] text-gray-600 text-center mt-1">Изучает карту, собирает артефакты</span>
                  </label>

                  <label className="relative flex flex-col items-center justify-center p-3 rounded bg-gray-950 border border-gray-800 hover:border-emerald-800 cursor-pointer transition-colors group has-[:checked]:border-amber-600 has-[:checked]:bg-amber-950/20">
                    <input
                      type="radio"
                      name="role"
                      value="gm"
                      defaultChecked={userRole === 'gm'}
                      className="peer absolute opacity-0"
                    />
                    <div className="text-xl text-gray-500 group-hover:text-amber-400 peer-checked:text-amber-400 mb-1">
                      <i className="fas fa-radiation"></i>
                    </div>
                    <span className="text-xs font-bold text-gray-400 peer-checked:text-amber-300">КУРАТОР</span>
                    <span className="text-[10px] text-gray-600 text-center mt-1">Управляет аномалиями, спавнит хабар</span>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-bold py-3 px-4 rounded text-sm transition-colors cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <i className="fas fa-plug"></i> Войти в сеть Зоны
                </button>
              </div>

              <div className="text-[10px] text-gray-600 text-center font-mono pt-2">
                СЕТЕВОЙ ПРОТОКОЛ СВЯЗИ V2 • TCP/PORT LOCAL
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
        <header className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-gray-900 border border-gray-800 p-4 rounded shadow-lg">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl font-bold text-emerald-500 tracking-wider flex items-center gap-2">
              <i className="fas fa-radiation animate-pulse text-emerald-400"></i> ANOMALY ZONE
            </h1>
            <div className="flex items-center gap-2 bg-gray-950 py-1.5 px-3 rounded border border-gray-800 text-xs font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 uppercase">СВЯЗЬ АКТИВНА</span>
            </div>

            <div className="flex bg-gray-950 p-1 rounded border border-gray-800 text-xs font-mono select-none gap-0.5">
              <button
                onClick={() => setActiveTab('map')}
                className={`px-3 py-1.5 rounded transition font-bold cursor-pointer flex items-center gap-1.5 ${activeTab === 'map' ? 'bg-emerald-600 text-gray-950' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Карта Зоны</span>
              </button>
              <button
                onClick={() => setActiveTab('bar')}
                disabled={gameState === 'playing'}
                title={gameState === 'playing' ? 'Бар недоступен во время активной экспедиции' : undefined}
                className={`px-3 py-1.5 rounded transition font-bold flex items-center gap-1.5 ${
                  gameState === 'playing'
                    ? 'text-gray-700 cursor-not-allowed opacity-50'
                    : activeTab === 'bar'
                    ? 'bg-emerald-600 text-gray-950 cursor-pointer'
                    : 'text-gray-400 hover:text-gray-200 cursor-pointer'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Бар «100 Рентген»</span>
              </button>
              {isGM && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-3 py-1.5 rounded transition font-bold cursor-pointer flex items-center gap-1.5 ${activeTab === 'admin' ? 'bg-amber-600 text-gray-950' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Панель куратора</span>
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-1.5">
              {!isGM ? (
                <span className="bg-emerald-950 text-emerald-300 px-2 py-1 rounded text-xs border border-emerald-900/50">Игрок: {username}</span>
              ) : (
                <span className="bg-amber-950 text-amber-300 px-2 py-1 rounded text-xs border border-amber-900/50">Куратор: {username}</span>
              )}
              {isProxyingAsPlayer && <span className="bg-purple-950 text-purple-300 px-2 py-1 rounded text-xs border border-purple-900/50">Прокси-режим</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Show other active explorers list */}
            {players.length > 1 && (
              <div className="text-xs text-gray-400 font-mono bg-gray-950 py-1 px-3.5 rounded border border-gray-800 flex items-center gap-2">
                <i className="fas fa-users text-emerald-500"></i> В сети: {players.map(p => p.username).join(', ')}
              </div>
            )}

            {actualGM && (
              <button 
                onClick={toggleGMProxy}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors shadow cursor-pointer ${isGM ? 'bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-900/40' : 'bg-amber-700 hover:bg-amber-600 text-white'}`}
              >
                {isGM ? 'Режим игрока' : 'Режим куратора'}
              </button>
            )}
            
            {gameState !== 'setup' && isGM && (
              <button 
                onClick={resetGame}
                className="bg-red-900 hover:bg-red-800 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors shadow cursor-pointer"
              >
                Сбросить
              </button>
            )}

            <button
              onClick={handleLogout}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs font-bold transition-colors"
              title="Выйти"
            >
              Сменить Сталкера
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === 'admin' ? (
              <Tavern
                ws={socketRef.current}
                userId={userId}
                username={username}
                isGM={isGM}
                gameMap={map}
                viewMode="admin"
              />
            ) : activeTab === 'bar' ? (
              <Tavern
                ws={socketRef.current}
                userId={userId}
                username={username}
                isGM={isGM}
                gameMap={map}
                viewMode="user"
              />
            ) : (
              <>
                {gameState === 'setup' && isGM && (
                  <Setup 
                    onGenerate={handleGenerate} 
                    stashLoot={stashLoot}
                    setStashLoot={(l) => { setStashLoot(l); syncStatePayload({ stashLoot: l }); }}
                    artifactLoot={artifactLoot}
                    setArtifactLoot={(l) => { setArtifactLoot(l); syncStatePayload({ artifactLoot: l }); }}
                  />
                )}
                {gameState === 'setup' && !isGM && (
                  <div className="h-full flex flex-col items-center justify-center bg-gray-900 rounded-lg border border-gray-800 p-8">
                    <i className="fas fa-satellite-dish text-6xl text-emerald-600 mb-6 animate-pulse"></i>
                    <h2 className="text-2xl font-bold text-gray-300 mb-4 tracking-wide">ПРИНИМАЕМ ДАННЫЕ О ЗОНЕ...</h2>
                    <p className="text-gray-400 text-center max-w-md">Куратор ({players.find(p => p.role === 'gm')?.username || 'Гейм-мастер'}) настраивает аномальную зону. Ожидайте сигнал...</p>
                  </div>
                )}
                
                {gameState === 'playing' && map && (
                  <Game 
                    initialMap={map} 
                    onAddMessage={addMessage} 
                    onEndGame={handleEndGame} 
                    stashLoot={stashLoot}
                    artifactLoot={artifactLoot}
                    isGM={isGM}
                    onUpdateMap={(newMap) => {
                      setMap(newMap);
                      syncStatePayload({ map: newMap });
                    }}
                    activeVotes={activeVotes}
                    activePlayersCount={activePlayersCount}
                    onSubmitVote={submitVote}
                    onResetVotes={resetVotes}
                    onExecuteImmediateAction={executeImmediateAction}
                    username={username}
                    userId={userId}
                    ws={socketRef.current}
                  />
                )}

                {gameState === 'ended' && (
                  <div className={`h-full flex flex-col items-center justify-center bg-gray-900 rounded-lg border p-8 ${
                    map && (map.health <= 0 || map.radiation >= map.maxRadiation)
                      ? 'border-red-900/40'
                      : 'border-emerald-900/40'
                  }`}>
                    {map && (map.health <= 0 || map.radiation >= map.maxRadiation) ? (
                      <>
                        <h2 className="text-4xl font-extrabold text-red-500 mb-4 tracking-wider uppercase">ГРУППА ПОГИБЛА</h2>
                        <p className="text-gray-400 mb-8 text-center max-w-sm">
                          Связь с отрядом оборвалась. Все члены группы погибли в аномальной зоне от смертельных повреждений или критического уровня радиации.
                        </p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-4xl font-extrabold text-emerald-500 mb-4 tracking-wider uppercase">ЭВАКУАЦИЯ УСПЕШНА</h2>
                        <p className="text-gray-400 mb-8 text-center max-w-sm">
                          Группа преодолела опасности аномальной зоны и вернулась на базу с добытыми артефактами.
                        </p>
                      </>
                    )}
                    {isGM && (
                      <button 
                        onClick={resetGame}
                        className="bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-extrabold py-3 px-8 rounded transition-colors uppercase tracking-wider cursor-pointer"
                      >
                        Запустить повторную экспедицию
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="w-full lg:w-80 h-64 lg:h-full shrink-0">
            <Chat messages={messages} />
          </div>
        </main>
      </div>
    </div>
  );
}
