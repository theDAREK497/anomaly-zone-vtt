import React, { useState } from 'react';
import { GenerationParams, AnomalyType } from '../utils/generator';
import { LootItem } from '../App';
import { ANOMALY_DEFINITIONS } from '../data/anomalies';
import { KIND_LABELS } from '../utils/anomaly-gameplay';

interface SetupProps {
  onGenerate: (params: GenerationParams) => void;
  stashLoot: LootItem[];
  setStashLoot: React.Dispatch<React.SetStateAction<LootItem[]>>;
  artifactLoot: LootItem[];
  setArtifactLoot: React.Dispatch<React.SetStateAction<LootItem[]>>;
}

export function Setup({ onGenerate, stashLoot, setStashLoot, artifactLoot, setArtifactLoot }: SetupProps) {
  const [activeTab, setActiveTab] = useState<'map' | 'loot'>('map');
  const [params, setParams] = useState<GenerationParams>({
    width: 15,
    height: 15,
    artifacts: 3,
    stashes: 4,
    exits: 2,
    difficulty: 5,
    seed: Math.random().toString(36).substring(2, 8).toUpperCase(),
    salt: 'STALKER',
    allowedAnomalies: ANOMALY_DEFINITIONS.map(item => item.id),
    radiationPercentage: 30,
    maxHealth: 100,
    maxRadiation: 100,
    geigerCharges: 3,
    detectorCharges: 3,
    detectorLevel: 2,
    boltCharges: 10,
    anomalyResolutionMode: 'hybrid',
    anomalyTimerEnabled: true,
    anomalySpeed: 1,
    anomalyCriticalRollAutoSuccess: false,
    silentZoneInterfaceComms: true,
  });

  const handleAnomalyToggle = (id: AnomalyType) => {
    setParams(prev => {
      const allowed = prev.allowedAnomalies.includes(id)
        ? prev.allowedAnomalies.filter(a => a !== id)
        : [...prev.allowedAnomalies, id];
      return { ...prev, allowedAnomalies: allowed };
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setParams(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : type === 'number' || name === 'detectorLevel' || name === 'maxHealth' || name === 'maxRadiation' || name === 'geigerCharges' || name === 'detectorCharges' || name === 'boltCharges' || name === 'anomalySpeed' ? Number(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(params);
  };

  const handleLootChange = (list: LootItem[], setList: React.Dispatch<React.SetStateAction<LootItem[]>>, id: string, field: keyof LootItem, value: string | number) => {
    setList(list.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addLootItem = (list: LootItem[], setList: React.Dispatch<React.SetStateAction<LootItem[]>>) => {
    setList([...list, { id: Math.random().toString(36).substring(2, 9), name: 'Новый предмет', weight: 10 }]);
  };

  const removeLootItem = (list: LootItem[], setList: React.Dispatch<React.SetStateAction<LootItem[]>>, id: string) => {
    setList(list.filter(item => item.id !== id));
  };

  const renderLootEditor = (title: string, items: LootItem[], setItems: React.Dispatch<React.SetStateAction<LootItem[]>>) => (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-green-400 mb-3">{title}</h3>
      <div className="flex gap-2 mb-2 text-xs text-gray-400 font-bold uppercase">
        <div className="flex-1">Название</div>
        <div className="w-20 text-center">Шанс (вес)</div>
        <div className="w-8"></div>
      </div>
      {items.map(item => (
        <div key={item.id} className="flex gap-2 mb-2">
          <input 
            type="text" 
            value={item.name} 
            onChange={(e) => handleLootChange(items, setItems, item.id, 'name', e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-green-500"
          />
          <input 
            type="number" 
            value={item.weight} 
            onChange={(e) => handleLootChange(items, setItems, item.id, 'weight', Number(e.target.value))}
            min="1"
            className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-green-500 text-center"
          />
          <button 
            type="button"
            onClick={() => removeLootItem(items, setItems, item.id)}
            className="w-8 bg-red-900 hover:bg-red-800 text-white rounded flex items-center justify-center font-bold"
          >
            ×
          </button>
        </div>
      ))}
      <button 
        type="button"
        onClick={() => addLootItem(items, setItems)}
        className="mt-2 text-sm text-green-400 hover:text-green-300 border border-green-800 hover:border-green-600 rounded px-3 py-1 transition-colors"
      >
        + Добавить предмет
      </button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 text-gray-100">
      <h2 className="text-2xl font-bold mb-4 text-center text-green-400">Настройка Аномальной Зоны</h2>
      
      <div className="flex mb-6 border-b border-gray-700">
        <button 
          className={`flex-1 py-2 text-sm font-bold transition-colors ${activeTab === 'map' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300'}`}
          onClick={() => setActiveTab('map')}
        >
          Генерация
        </button>
        <button 
          className={`flex-1 py-2 text-sm font-bold transition-colors ${activeTab === 'loot' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300'}`}
          onClick={() => setActiveTab('loot')}
        >
          Лут и Артефакты
        </button>
      </div>

      {activeTab === 'map' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Ширина, клеток</label>
            <input type="number" name="width" value={params.width} onChange={handleChange} min="5" max="30" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Высота, клеток</label>
            <input type="number" name="height" value={params.height} onChange={handleChange} min="5" max="30" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Артефакты</label>
            <input type="number" name="artifacts" value={params.artifacts} onChange={handleChange} min="0" max="20" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Схроны</label>
            <input type="number" name="stashes" value={params.stashes} onChange={handleChange} min="0" max="20" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Выходы</label>
            <input type="number" name="exits" value={params.exits} onChange={handleChange} min="1" max="10" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Сложность аномалий (1-10)</label>
            <input type="number" name="difficulty" value={params.difficulty} onChange={handleChange} min="1" max="10" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Заражение радиацией: {params.radiationPercentage}%
          </label>
          <input 
            type="range" 
            name="radiationPercentage" 
            value={params.radiationPercentage} 
            onChange={handleChange} 
            min="0" 
            max="100" 
            className="w-full accent-green-500" 
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-emerald-500 mb-1">⚡ Здоровье отряда (ОЗ)</label>
            <input type="number" name="maxHealth" value={params.maxHealth} onChange={handleChange} min="10" max="500" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500 text-sm font-bold" />
          </div>
          <div>
            <label className="block text-xs font-mono text-yellow-500 mb-1">☣️ Лимит радиации</label>
            <input type="number" name="maxRadiation" value={params.maxRadiation} onChange={handleChange} min="10" max="500" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500 text-sm font-bold" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-mono text-lime-400 mb-1 leading-tight">📡 Заряды Гейгера</label>
            <input type="number" name="geigerCharges" value={params.geigerCharges} onChange={handleChange} min="0" max="50" className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white focus:outline-none focus:border-green-500 text-xs font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-purple-400 mb-1 leading-tight">🔮 Поиск Арт.</label>
            <input type="number" name="detectorCharges" value={params.detectorCharges} onChange={handleChange} min="0" max="50" className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white focus:outline-none focus:border-green-500 text-xs font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-cyan-400 mb-1 leading-tight">🔩 Запас болтов</label>
            <input type="number" name="boltCharges" value={params.boltCharges} onChange={handleChange} min="0" max="100" className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white focus:outline-none focus:border-green-500 text-xs font-bold" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-emerald-400 mb-1">🛠️ Начальная модель детектора артефактов</label>
          <select 
            name="detectorLevel" 
            value={params.detectorLevel} 
            onChange={handleChange}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500 text-sm"
          >
            <option value="1">Уровень 1: Простой (звуковой лог "Рядом есть артефакт!")</option>
            <option value="2">Уровень 2: Направление (веерный радар-радиальный полукруг)</option>
            <option value="3">Уровень 3: Секторный (выделяет приблизительную сетку 3x3)</option>
            <option value="4">У0вень 4: Точный (сканирует и полностью раскрывает ячейку)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Ключ генерации</label>
            <input type="text" name="seed" value={params.seed} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Модификатор ключа</label>
            <input type="text" name="salt" value={params.salt} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Аномалии ЭОН</label>
          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto bg-gray-900/50 p-3 rounded border border-gray-700">
            {ANOMALY_DEFINITIONS.map(anomaly => (
              <label key={anomaly.id} className="flex items-center text-sm text-gray-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={params.allowedAnomalies.includes(anomaly.id as AnomalyType)}
                  onChange={() => handleAnomalyToggle(anomaly.id as AnomalyType)}
                  className="mr-2"
                />
                <span><b>{anomaly.name}</b> <span className="text-[10px] text-gray-500">({KIND_LABELS[anomaly.encounterType]}, опасность {anomaly.dangerTier})</span></span>
              </label>
            ))}
          </div>
        </div>

        <div className="border border-cyan-900/50 bg-cyan-950/10 rounded p-3 space-y-3">
          <div className="text-xs font-bold uppercase text-cyan-400">Разрешение аномалий</div>
          <select name="anomalyResolutionMode" value={params.anomalyResolutionMode} onChange={handleChange} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm">
            <option value="minigame">Мини-игра</option>
            <option value="gurps-roll">Серия бросков GURPS</option>
            <option value="hybrid">Гибрид: броски дают преимущества</option>
          </select>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="anomalyTimerEnabled" checked={params.anomalyTimerEnabled} onChange={handleChange} /> Таймер испытания: {params.difficulty <= 3 ? '2 минуты' : '1 минута'} (ведущий может приостановить)</label>
          <p className="text-xs text-gray-400">Режим разрешения применяется к мини-играм. Полевые эффекты срабатывают на карте, а аномалии с проверками кубиками всегда используют навыки. Таймер хода заморожен до кнопки «ОК».</p>
          <label className="text-xs block">Скорость интерфейса: {params.anomalySpeed}×<input type="range" name="anomalySpeed" min="0.5" max="2" step="0.25" value={params.anomalySpeed} onChange={handleChange} className="w-full" /></label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="anomalyCriticalRollAutoSuccess" checked={params.anomalyCriticalRollAutoSuccess} onChange={handleChange} /> Критический бросок может завершить сцену автоматически</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="silentZoneInterfaceComms" checked={params.silentZoneInterfaceComms} onChange={handleChange} /> Ограничение связи «Немой зоны» внутри мини-игры (чат Foundry не затрагивается)</label>
        </div>

        <button type="submit" className="w-full mt-6 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded transition-colors">
          Сгенерировать Зону
        </button>
      </form>
      ) : (
        <div>
          {renderLootEditor('Содержимое схронов', stashLoot, setStashLoot)}
          {renderLootEditor('Список артефактов', artifactLoot, setArtifactLoot)}
        </div>
      )}
      
      <p className="text-xs text-gray-500 mt-4 text-center">
        Это веб-приложение можно использовать параллельно с Foundry VTT (например, через iframe или в отдельной вкладке).
      </p>
    </div>
  );
}
