import React, { useState, useEffect, useCallback } from "react";
import {
  CustomGamepad, CustomWarning, CustomRun, CustomCrown,
  CustomNote, CustomTarget, CustomGun, CustomShield,
  CustomBiohazard, CustomBug, CustomGhost, CustomRat, CustomDice,
  CustomJoker, CustomPig, CustomHeart, CustomDiamond, CustomClub, CustomSpade,
  CustomTrophy, CustomHandshake
} from "./CustomIcons";
import { 
  Coins, 
  ShoppingBag, 
  Flame, 
  Dribbble, 
  ChevronRight, 
  Play, 
  User, 
  RotateCcw, 
  Lock, 
  Unlock, 
  Sparkles, 
  Dice5, 
  ArrowRight,
  UserCheck,
  Zap,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  Wrench,
  Crosshair,
  HelpCircle,
  Beer,
  Settings,
  Cylinder,
  Wine,
  Gem,
  Skull,
  AlertTriangle,
  Circle,
  Bug,
  FlaskConical,
  PiggyBank,
  Target,
  Shield,
  Store,
  Briefcase,
  Package,
  Dices,
  Gamepad2,
  VenetianMask,
  Clock,
  Users,
  Handshake,
  Crown,
  Flag,
  Lightbulb,
  Radio,
  Award,
  Trophy,
  PartyPopper,
  Swords,
  Smile,
  Bot,
  Database,
  Building,
  Compass,
  Bomb,
  LogOut,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LANG } from "../locales/lang";

const formatCredits = (amount: number): string => {
  const absVal = Math.abs(amount);
  const mod10 = absVal % 10;
  const mod100 = absVal % 100;
  let word = "кредитов";
  if (mod100 < 11 || mod100 > 19) {
    if (mod10 === 1) {
      word = "кредит";
    } else if (mod10 >= 2 && mod10 <= 4) {
      word = "кредита";
    }
  }
  return `${amount} ${word}`;
};

interface TavernProps {
  ws: WebSocket | null;
  userId: string;
  username: string;
  isGM: boolean;
  gameMap: any;
  onAddMessage?: (message: any) => void;
  viewMode?: "user" | "admin";
}

export const Tavern: React.FC<TavernProps> = ({
  ws,
  userId,
  username,
  isGM,
  gameMap,
  onAddMessage,
  viewMode = "user"
}) => {
  // Sync states
  const [playerDb, setPlayerDb] = useState<Record<string, any>>({});
  const [pazaakLobbies, setPazaakLobbies] = useState<Record<string, any>>({});
  const [activeRace, setActiveRace] = useState<any>({
    status: "none",
    contestants: [],
    bets: [],
    winner: null,
    log: []
  });
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [tavernSettings, setTavernSettings] = useState<{
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
  }>({
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
  });
  const [gmTavernNameInput, setGmTavernNameInput] = useState<string | undefined>(undefined);
  const [gmMerchantNameInput, setGmMerchantNameInput] = useState<string | undefined>(undefined);

  // GM shop inputs
  const [gmItemName, setGmItemName] = useState("");
  const [gmItemPrice, setGmItemPrice] = useState("120");
  const [gmItemType, setGmItemType] = useState<"med" | "weapon" | "ammo" | "armor" | "art" | "misc">("misc");
  const [gmItemDesc, setGmItemDesc] = useState("");

  // GM player adjustments inputs
  const [gmSelectedPlayerId, setGmSelectedPlayerId] = useState("");
  const [gmPlayerBalanceInput, setGmPlayerBalanceInput] = useState("");
  const [gmPlayerCardToUnlock, setGmPlayerCardToUnlock] = useState("");

  // Client Dice game states
  const [diceState, setDiceState] = useState<{
    active: boolean;
    bet: number;
    botDice: number[];
    playerDice: number[];
    botHand?: { name: string; rank: number };
    playerHand?: { name: string; rank: number };
    rerollStep: number;
    lockedIndexes: boolean[];
    result?: "win" | "lose" | "tie";
    message?: string;
  }>({
    active: false,
    bet: 100,
    botDice: [],
    playerDice: [],
    rerollStep: 0,
    lockedIndexes: [false, false, false, false, false]
  });

  // Subsections inside Tavern (Bar)
  // 'trades' | 'pazaak' | 'dice' | 'races' | 'slots' | 'roulette' | 'shooting' | 'thimblerig' | 'svinya'
  const [activeSubTab, setActiveSubTab] = useState<"trades" | "pazaak" | "dice" | "races" | "slots" | "roulette" | "shooting" | "thimblerig" | "svinya">("trades");

  // Pazaak local interactions
  const [selectedDeckCards, setSelectedDeckCards] = useState<string[]>([]);
  const [isOpeningBooster, setIsOpeningBooster] = useState(false);
  const [boosterPulledCards, setBoosterPulledCards] = useState<string[] | null>(null);

  // New race creation/contestants customization
  const [customContestants, setCustomContestants] = useState<string>("");
  const [pazaakBetAmount, setPazaakBetAmount] = useState<number>(100);
  const [pazaakBotSelected, setPazaakBotSelected] = useState<boolean>(true); // play against Bot or PvP lobby
  const [activePazaakLobbyId, setActivePazaakLobbyId] = useState<string | null>(null);
  const [dualSignTriggerCard, setDualSignTriggerCard] = useState<{ idx: number; val: string } | null>(null);

  // Dice bet input
  const [diceBetInput, setDiceBetInput] = useState<number>(100);

  // Race betting input
  const [raceBetAmount, setRaceBetAmount] = useState<number>(100);
  const [selectedRaceContestant, setSelectedRaceContestant] = useState<string>("");

  // System alert notifications helper
  const [pdaAlert, setPdaAlert] = useState<{ text: string; type: "success" | "danger" | "info" } | null>(null);

  // Slots states
  const [slotsState, setSlotsState] = useState<{
    spinning: boolean;
    reels: string[];
    winAmount?: number;
    message?: string;
  }>({
    spinning: false,
    reels: ["⚙️", "⚙️", "⚙️"]
  });
  const [slotsBet, setSlotsBet] = useState<number>(100);
  const pendingSlotsResultRef = React.useRef<any>(null);

  // Roulette states
  const [rouletteState, setRouletteState] = useState<{
    spinning: boolean;
    winningNumber?: number;
    winningColor?: string;
    winAmount?: number;
    message?: string;
    radarAngle: number;
  }>({
    spinning: false,
    radarAngle: 0
  });
  const [rouletteBetType, setRouletteBetType] = useState<"number" | "color" | "parity">("number");
  const [rouletteBetValue, setRouletteBetValue] = useState<string>("7");
  const [rouletteBetAmount, setRouletteBetAmount] = useState<number>(100);
  const pendingRouletteResultRef = React.useRef<any>(null);

  // Shooting states
  const [shootingState, setShootingState] = useState<{
    active: boolean;
    saving: boolean;
    ended: boolean;
    score: number;
    ammo: number;
    maxAmmo: number;
    reloading: boolean;
    timer: number;
    weapon: "pm" | "ak" | "vintorez";
    targets: { id: number; type: "bullseye" | "snork" | "bloodsucker" | "rat" | "loner"; x: number; y: number; size: number; state: "spawning" | "idle" | "dying"; label: string; reward: number; expiresAt?: number }[];
    winAmount?: number;
    message?: string;
    bet: number;
    bulletHoles: { id: number; x: number; y: number }[];
    flashes: { id: number; x: number; y: number; size: number }[];
  }>({
    active: false,
    saving: false,
    ended: false,
    score: 0,
    ammo: 8,
    maxAmmo: 8,
    reloading: false,
    timer: 15,
    weapon: "pm",
    targets: [],
    bulletHoles: [],
    flashes: [],
    bet: 100
  });

  // Thimblerig States
  const [thimblerigState, setThimblerigState] = useState<{
    bet: number;
    active: boolean;
    shuffling: boolean;
    ballCup: number | null;
    selectedCup: number | null;
    revealed: boolean;
    winAmount?: number;
    message?: string;
    initialReveal?: boolean;
    positions: number[];
  }>({
    bet: 100,
    active: false,
    shuffling: false,
    ballCup: null,
    selectedCup: null,
    revealed: false,
    initialReveal: false,
    positions: [0, 1, 2]
  });

  // Card Game Svinya Settings & States
  interface SvinyaCard {
    suit: "hearts" | "diamonds" | "clubs" | "spades";
    value: string;
    isPig: boolean;
  }

  const [svinyaState, setSvinyaState] = useState<{
    active: boolean;
    bet: number;
    circleCards: (SvinyaCard | null)[];
    centerPile: SvinyaCard[];
    playerSty: SvinyaCard[];
    botSty: SvinyaCard[];
    turn: "player" | "bot";
    phase: "ready" | "playing" | "ended";
    result?: "win" | "lose" | "tie";
    message?: string;
    loading: boolean;
  }>({
    active: false,
    bet: 100,
    circleCards: [],
    centerPile: [],
    playerSty: [],
    botSty: [],
    turn: "player",
    phase: "ready",
    loading: false
  });

  // Listen back server replies
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "SYNC_TAVERN_GAMES") {
          const payload = data.payload;
          setPlayerDb(payload.playerDb || {});
          setPazaakLobbies(payload.pazaakLobbies || {});
          setActiveRace(payload.activeRace || {});
          if (payload.shopItems) setShopItems(payload.shopItems);
          if (payload.tavernSettings) setTavernSettings(payload.tavernSettings);
        } else if (data.type === "BOOSTER_PULLED_SUCCESS") {
          setIsOpeningBooster(false);
          setBoosterPulledCards(data.payload.pulled);
          if (data.payload.profile) {
            setPlayerDb(prev => ({
              ...prev,
              [userId]: data.payload.profile
            }));
          }
        } else if (data.type === "DICE_STATE_SYNC") {
          const state = data.payload;
          setDiceState({
            active: state.active,
            bet: state.bet,
            botDice: state.botDice,
            playerDice: state.playerDice,
            botHand: state.botHand,
            playerHand: state.playerHand,
            rerollStep: state.rerollStep,
            lockedIndexes: state.lockedIndexes,
            result: state.result,
            message: state.message
          });
        } else if (data.type === "SLOTS_RESULT") {
          pendingSlotsResultRef.current = data.payload;
        } else if (data.type === "ROULETTE_RESULT") {
          pendingRouletteResultRef.current = data.payload;
        } else if (data.type === "SHOOTING_RANGE_RESULT") {
          setShootingState(prev => ({
            ...prev,
            saving: false,
            ended: true,
            winAmount: data.payload.winAmount,
            message: data.payload.message
          }));
        } else if (data.type === "THIMBLERIG_RESULT") {
          const res = data.payload;
          setThimblerigState(prev => ({
            ...prev,
            shuffling: false,
            ballCup: res.winningCup,
            revealed: true,
            winAmount: res.winAmount,
            message: res.message
          }));
          if (res.winAmount > 0) {
            playWinSfx();
          }
        } else if (data.type === "SVINYA_START_RESPONSE") {
          if (data.payload.success) {
            const suits: ("hearts" | "diamonds" | "clubs" | "spades")[] = ["hearts", "diamonds", "clubs", "spades"];
            const values = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
            const deck: SvinyaCard[] = [];
            suits.forEach(suit => {
              values.forEach(value => {
                const isPig = suit === "spades" && value === "6";
                deck.push({ suit, value, isPig });
              });
            });

            // Shuffle deck
            for (let i = deck.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              const temp = deck[i];
              deck[i] = deck[j];
              deck[j] = temp;
            }

            const centerCard = deck.pop()!;

            setSvinyaState(prev => ({
              ...prev,
              circleCards: deck,
              centerPile: [centerCard],
              playerSty: [],
              botSty: [],
              turn: "player",
              phase: "playing",
              result: undefined,
              message: undefined,
              loading: false
            }));
          } else {
            setSvinyaState(prev => ({ ...prev, loading: false }));
          }
        } else if (data.type === "SVINYA_FINISH_RESPONSE") {
          const res = data.payload;
          setSvinyaState(prev => ({
            ...prev,
            phase: "ended",
            result: res.result,
            message: res.message,
            loading: false
          }));
          if (res.winAmount > 0) {
            playWinSfx();
          }
        } else if (data.type === "NOTIFICATION") {
          setPdaAlert({
            text: data.payload.text,
            type: data.payload.type || "info"
          });
          setTimeout(() => setPdaAlert(null), 3500);
        }
      } catch (e) {
        console.error("Error processing websocket payload in Tavern:", e);
      }
    };

    ws.addEventListener("message", handleMessage);
    // Request current state Sync
    ws.send(JSON.stringify({ type: "TAVERN_PREPARE", payload: {} }));

    return () => {
      ws.removeEventListener("message", handleMessage);
    };
  }, [ws, userId]);

  const playerProfile = playerDb[userId] || {
    balance: 1000,
    unlockedCards: ["+1", "-1", "+2", "-2", "+3", "-3", "+4", "-4", "+5", "-5"],
    pazaakDeck: []
  };

  // Sync sideboard deck selectors initially
  useEffect(() => {
    if (playerProfile && playerProfile.pazaakDeck && selectedDeckCards.length === 0) {
      setSelectedDeckCards(playerProfile.pazaakDeck);
    }
  }, [playerProfile, selectedDeckCards.length]);

  // Sell item functionality
  const handleSellItem = (index: number) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: "BAR_SELL_ITEM",
        payload: {
          playerId: userId,
          username,
          itemIndex: index
        }
      }));
    }
  };

  // Buy Booster
  const handleBuyBooster = () => {
    if (playerProfile.balance < 300) {
      setPdaAlert({ text: "❌ Недостаточно средств на балансе КПК! Нужно 300 кредитов.", type: "danger" });
      setTimeout(() => setPdaAlert(null), 3000);
      return;
    }
    setBoosterPulledCards(null);
    setIsOpeningBooster(true);
    if (ws) {
      ws.send(JSON.stringify({
        type: "PAZAAK_BUY_BOOSTER",
        payload: { playerId: userId, username }
      }));
    }
  };

  // Manage decking
  const handleToggleCardSelection = (card: string) => {
    let current = [...selectedDeckCards];
    const firstIdx = current.indexOf(card);
    
    // If already in deck, remove it
    if (firstIdx > -1) {
      current.splice(firstIdx, 1);
    } else {
      // Add to deck if size < 8
      if (current.length < 8) {
        current.push(card);
      } else {
        setPdaAlert({ text: "Максимум 8 карт в колоде!", type: "info" });
        setTimeout(() => setPdaAlert(null), 2500);
      }
    }
    setSelectedDeckCards(current);
  };

  const handleSaveDeck = () => {
    if (selectedDeckCards.length !== 8) {
      setPdaAlert({ text: "Колода обязана содержать ровно 8 карт!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 3000);
      return;
    }
    if (ws) {
      ws.send(JSON.stringify({
        type: "PAZAAK_SAVE_DECK",
        payload: { playerId: userId, deck: selectedDeckCards }
      }));
    }
  };

  // Pazaak game creators
  const handleCreatePazaakMatch = () => {
    if (!playerProfile.pazaakDeck || playerProfile.pazaakDeck.length < 8) {
      setPdaAlert({ text: "<CustomWarning />️ Сначала соберите и сохраните колоду из 8 карт в секции «Настройка Колоды»!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 4000);
      return;
    }

    if (playerProfile.balance < pazaakBetAmount) {
      setPdaAlert({ text: "Недостаточно кредитов на балансе!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 2500);
      return;
    }

    if (ws) {
      ws.send(JSON.stringify({
        type: "PAZAAK_CREATE_LOBBY",
        payload: {
          creatorId: userId,
          creatorName: username,
          opponentId: pazaakBotSelected ? "BOT_BAR" : "",
          bet: pazaakBetAmount
        }
      }));
    }
  };

  const handleJoinPazaakMatch = (lobbyId: string) => {
    if (!playerProfile.pazaakDeck || playerProfile.pazaakDeck.length < 8) {
      setPdaAlert({ text: "<CustomWarning />️ Сначала соберите и сохраните колоду из 8 карт в секции «Настройка Колоды»!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 4000);
      return;
    }

    const lobby = pazaakLobbies[lobbyId];
    // Self-combat allowed by user request
    if (playerProfile.balance < lobby.bet) {
      setPdaAlert({ text: "Недостаточно кредитов на балансе!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 2500);
      return;
    }
    if (ws) {
      ws.send(JSON.stringify({
        type: "PAZAAK_JOIN_LOBBY",
        payload: {
          lobbyId,
          opponentId: userId,
          opponentName: username
        }
      }));
      setActivePazaakLobbyId(lobbyId);
    }
  };

  // Pazaak turn moves
  const handlePazaakPlayCard = (lobbyId: string, cardIndex: number, useNegative: boolean = false) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: "PAZAAK_PLAY_CARD",
        payload: {
          lobbyId,
          playerId: userId,
          cardIndex,
          useNegative
        }
      }));
    }
    setDualSignTriggerCard(null);
  };

  const handlePazaakEndTurn = (lobbyId: string) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: "PAZAAK_END_TURN",
        payload: { lobbyId, playerId: userId }
      }));
    }
  };

  const handlePazaakStand = (lobbyId: string) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: "PAZAAK_STAND",
        payload: { lobbyId, playerId: userId }
      }));
    }
  };

  const handlePazaakConcede = (lobbyId: string) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: "PAZAAK_CONCEDE",
        payload: { lobbyId, playerId: userId }
      }));
    }
  };

  // Play Dice Match
  const handlePlayDice = () => {
    if (playerProfile.balance < diceBetInput) {
      setPdaAlert({ text: "Недостаточно кредитов для ставки!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 2500);
      return;
    }
    if (ws) {
      ws.send(JSON.stringify({
        type: "DICE_PLAY_BOT",
        payload: {
          playerId: userId,
          username,
          bet: diceBetInput
        }
      }));
    }
  };

  const handleToggleDiceLock = (index: number) => {
    const locks = [...diceState.lockedIndexes];
    locks[index] = !locks[index];
    setDiceState(prev => ({
      ...prev,
      lockedIndexes: locks
    }));
  };

  const handleDiceReroll = () => {
    if (ws) {
      ws.send(JSON.stringify({
        type: "DICE_REROLL",
        payload: {
          playerId: userId,
          username,
          bet: diceState.bet,
          botDice: diceState.botDice,
          playerDice: diceState.playerDice,
          lockedIndexes: diceState.lockedIndexes,
          rerollStep: diceState.rerollStep
        }
      }));
    }
  };

  // Races
  const handlePlaceRaceBet = () => {
    if (!selectedRaceContestant) {
      setPdaAlert({ text: "Выберите бегуна для ставки!", type: "info" });
      setTimeout(() => setPdaAlert(null), 2500);
      return;
    }
    if (playerProfile.balance < raceBetAmount) {
      setPdaAlert({ text: "Недостаточно кредитов на балансе!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 2500);
      return;
    }
    if (ws) {
      ws.send(JSON.stringify({
        type: "RACE_PLACE_BET",
        payload: {
          playerId: userId,
          username,
          contestantName: selectedRaceContestant,
          betAmount: raceBetAmount
        }
      }));
    }
  };

  const handleCustomizeContestants = () => {
    const list = customContestants.split(",").map(t => t.trim()).filter(t => t.length > 0);
    if (list.length < 2) {
      setPdaAlert({ text: "Введите как минимум 2 имени через запятую!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 3000);
      return;
    }
    if (ws) {
      ws.send(JSON.stringify({
        type: "RACE_SET_CONTESTANTS",
        payload: { names: list }
      }));
    }
  };

  const handleGMStartRace = () => {
    if (ws) {
      ws.send(JSON.stringify({ type: "RACE_START_GM", payload: {} }));
    }
  };

  const handleGMResetRace = () => {
    if (ws) {
      ws.send(JSON.stringify({ type: "RACE_RESET_GM", payload: {} }));
    }
  };

  const handleGMModifyBalanceLocal = (targetId: string, amount: number) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: "GM_MODIFY_BALANCE",
        payload: { targetPlayerId: targetId, delta: amount }
      }));
    }
  };

  // SOUND SYNTHESIS USING WEB AUDIO CLIENT CONTEXT
  const playSlotTick = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  };

  const playWinSfx = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      let time = ctx.currentTime;
      [220, 277.18, 329.63, 440, 554.37].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, time + idx * 0.08);
        gain.gain.setValueAtTime(0.03, time + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.001, time + idx * 0.08 + 0.155);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time + idx * 0.08);
        osc.stop(time + idx * 0.08 + 0.16);
      });
    } catch (e) {}
  };

  const playRadarSweep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(820, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.125);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch (e) {}
  };

  const playGunshotSfx = (type: "pm" | "ak" | "vintorez") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      if (type === "vintorez") {
        osc.frequency.setValueAtTime(250, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(10, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.015, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.065);
      } else {
        osc.frequency.setValueAtTime(type === "pm" ? 420 : 320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + (type === "pm" ? 0.18 : 0.23));
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + (type === "pm" ? 0.18 : 0.235));
        
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = "triangle";
        snapOsc.frequency.setValueAtTime(1300, ctx.currentTime);
        snapOsc.frequency.linearRampToValueAtTime(350, ctx.currentTime + 0.035);
        snapGain.gain.setValueAtTime(0.04, ctx.currentTime);
        snapGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.035);
        
        snapOsc.connect(snapGain);
        snapGain.connect(ctx.destination);
        snapOsc.start();
        snapOsc.stop(ctx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (type === "pm" ? 0.18 : 0.24));
      }
    } catch(e) {}
  };

  const playHitBellSfx = (type: "positive" | "negative") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(type === "positive" ? 980 : 130, ctx.currentTime);
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + (type === "positive" ? 0.25 : 0.18));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch (e) {}
  };

  // MINI-GAME: RECTOR-SLOTS ENGINE
  const handleSlotsSpin = () => {
    if (!ws || slotsState.spinning) return;
    if (playerProfile.balance < slotsBet) {
      setPdaAlert({ text: "❌ Недостаточно средств на балансе!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 2500);
      return;
    }

    setSlotsState({ spinning: true, reels: ["🎲", "🎲", "🎲"], winAmount: undefined, message: undefined });
    pendingSlotsResultRef.current = null;

    ws.send(JSON.stringify({
      type: "SLOTS_SPIN",
      payload: { playerId: userId, bet: slotsBet }
    }));

    let rolls = 0;
    const tickerSymbols = ["⚙️", "🥫", "🍾", "💎", "☢️", "💀"];
    
    const interval = setInterval(() => {
      rolls++;
      const result = pendingSlotsResultRef.current;
      
      setSlotsState(prev => {
        const nextReels = [...prev.reels];
        playSlotTick();

        // Stagger reel stops: Reel 1 stops at 18, Reel 2 stops at 26, Reel 3 stops at 34
        if (rolls < 18) {
          nextReels[0] = tickerSymbols[Math.floor(Math.random() * tickerSymbols.length)];
        } else if (result) {
          nextReels[0] = result.reels[0];
        }

        if (rolls < 26) {
          nextReels[1] = tickerSymbols[Math.floor(Math.random() * tickerSymbols.length)];
        } else if (result) {
          nextReels[1] = result.reels[1];
        }

        if (rolls < 34) {
          nextReels[2] = tickerSymbols[Math.floor(Math.random() * tickerSymbols.length)];
        } else if (result) {
          nextReels[2] = result.reels[2];
        }

        return {
          ...prev,
          reels: nextReels
        };
      });

      if (rolls >= 34) {
        clearInterval(interval);
        const result = pendingSlotsResultRef.current;
        if (result) {
          setSlotsState({
            spinning: false,
            reels: result.reels,
            winAmount: result.winAmount,
            message: result.message
          });
          if (result.winAmount > 0) {
            playWinSfx();
          }
        } else {
          setSlotsState(prev => ({
            ...prev,
            spinning: false,
            message: "<CustomWarning />️ Сервер не ответил вовремя. Баланс обновится автоматически."
          }));
        }
      }
    }, 110);
  };

  // MINI-GAME: RADAR-ROULETTE ENGINE
  const handleRouletteSpin = () => {
    if (!ws || rouletteState.spinning) return;
    if (playerProfile.balance < rouletteBetAmount) {
      setPdaAlert({ text: "❌ Недостаточно средств на балансе!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 2500);
      return;
    }

    setRouletteState({
      spinning: true,
      radarAngle: rouletteState.radarAngle, // start from current angle
      winAmount: undefined,
      message: undefined,
      winningNumber: undefined,
      winningColor: undefined
    });
    pendingRouletteResultRef.current = null;

    ws.send(JSON.stringify({
      type: "ROULETTE_SPIN",
      payload: {
        playerId: userId,
        betAmount: rouletteBetAmount,
        betType: rouletteBetType,
        betValue: rouletteBetValue
      }
    }));

    // Beautifully smooth decelarating auditory ticks
    let audioTicks = 0;
    let isSpinActive = true;
    const playTickAtDistance = () => {
      if (!isSpinActive) return;
      playRadarSweep();
      audioTicks++;
      if (audioTicks < 18) {
        setTimeout(playTickAtDistance, 140 + audioTicks * 15);
      } else if (audioTicks < 26) {
        setTimeout(playTickAtDistance, 350 + (audioTicks - 18) * 80);
      }
    };
    playTickAtDistance();

    // After a short delay (e.g. 150ms) to receive the result from the local/fast server, we initiate the transition of radarAngle
    setTimeout(() => {
      const result = pendingRouletteResultRef.current;
      if (result) {
        const calculatedAngle = (result.winningNumber * 360) / 37;
        // Spin at least 5 times (1800 deg) + target sector offset
        const baseOffset = Math.ceil(rouletteState.radarAngle / 360) * 360;
        const targetAngle = baseOffset + 1800 + calculatedAngle;
        
        setRouletteState(prev => ({
          ...prev,
          radarAngle: targetAngle
        }));
      }
    }, 150);

    // After 4.5 seconds (when the CSS transition of transform finishes), we clean up and finalize the result
    setTimeout(() => {
      isSpinActive = false;
      const result = pendingRouletteResultRef.current;
      if (result) {
        setRouletteState(prev => ({
          ...prev,
          spinning: false,
          winningNumber: result.winningNumber,
          winningColor: result.winningColor,
          winAmount: result.winAmount,
          message: result.message
        }));
        if (result.winAmount > 0) {
          playWinSfx();
        }
      } else {
        setRouletteState(prev => ({
          ...prev,
          spinning: false,
          message: "<CustomWarning />️ Таймаут ответа сервера рулетки."
        }));
      }
    }, 4500);
  };

  // MINI-GAME: PDA COMBAT TRAINING RANGE ENGINE
  useEffect(() => {
    if (!shootingState.active) return;

    const timerInterval = setInterval(() => {
      setShootingState(prev => {
        if (prev.timer <= 1) {
          clearInterval(timerInterval);
          if (ws) {
            ws.send(JSON.stringify({
              type: "SHOOTING_RANGE_FINISH",
              payload: { playerId: userId, bet: prev.bet, score: prev.score }
            }));
          }
          return { ...prev, timer: 0, saving: true, active: false };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);

    const targetPool: ("bullseye" | "snork" | "bloodsucker" | "rat" | "loner")[] = [
      "bullseye", "bullseye", "snork", "rat", "bloodsucker", "loner"
    ];
    
    const targetMeta = {
      bullseye: { label: "Мишень", reward: 10, size: 40, lifespan: 1800 },
      snork: { label: "Снорк", reward: 25, size: 45, lifespan: 1300 },
      bloodsucker: { label: "Кровосос", reward: 40, size: 48, lifespan: 1000 },
      rat: { label: "Тушканчик", reward: 15, size: 32, lifespan: 1500 },
      loner: { label: "Санитар (НЕ СТРЕЛЯТЬ!)", reward: -50, size: 42, lifespan: 2500 }
    };

    const targetLoop = setInterval(() => {
      const now = Date.now();
      setShootingState(prev => {
        // Handle target age expiration: convert expiring targets to dying state so they fade out
        let updated = prev.targets.map(t => {
          if (t.state === "idle" && t.expiresAt && now > t.expiresAt) {
            return { ...t, state: "dying" as const };
          }
          return t;
        });

        // Filter out those that already reached dying state in the previous tick
        updated = updated.filter(t => t.state !== "dying");

        // Spawn a brand new target occasionally to maintain target density up to 5 max
        if (updated.length < 5 && Math.random() < 0.12) {
          const type = targetPool[Math.floor(Math.random() * targetPool.length)];
          const meta = targetMeta[type];
          
          updated.push({
            id: Math.floor(Math.random() * 1000000),
            type,
            x: 8 + Math.random() * 84,
            y: 8 + Math.random() * 74,
            size: meta.size,
            state: "idle",
            label: meta.label,
            reward: meta.reward,
            expiresAt: now + meta.lifespan
          });
        }

        return {
          ...prev,
          targets: updated
        };
      });
    }, 150);

    return () => {
      clearInterval(timerInterval);
      clearInterval(targetLoop);
    };
  }, [shootingState.active, ws, userId]);

  const handleShootingClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!shootingState.active || shootingState.reloading) return;
    if (shootingState.ammo <= 0) {
      handleShootingReload();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    playGunshotSfx(shootingState.weapon);

    const holeId = Math.random();
    const flashId = Math.random();

    setShootingState(prev => {
      let hitTargetId: number | null = null;
      let scoreGain = 0;
      let targetHitType: "positive" | "negative" = "positive";

      const stepTargets = prev.targets.map(target => {
        const dist = Math.sqrt(Math.pow(target.x - mouseX, 2) + Math.pow(target.y - mouseY, 2));
        if (target.state === "idle" && dist < 12 && !hitTargetId) {
          hitTargetId = target.id;
          scoreGain = target.reward;
          targetHitType = target.reward < 0 ? "negative" : "positive";
          return { ...target, state: "dying" as const };
        }
        return target;
      });

      if (hitTargetId) {
        playHitBellSfx(targetHitType);
      }

      return {
        ...prev,
        ammo: prev.ammo - 1,
        score: Math.max(0, prev.score + scoreGain),
        targets: stepTargets,
        bulletHoles: [...prev.bulletHoles, { id: holeId, x: mouseX, y: mouseY }].slice(-15),
        flashes: [...prev.flashes, { id: flashId, x: mouseX, y: mouseY, size: 36 }]
      };
    });

    setTimeout(() => {
      setShootingState(prev => ({
        ...prev,
        flashes: prev.flashes.filter(f => f.id !== flashId)
      }));
    }, 140);
  };

  const handleShootingReload = () => {
    if (shootingState.reloading || shootingState.ammo === shootingState.maxAmmo) return;
    setShootingState(prev => ({ ...prev, reloading: true }));
    
    const reloadTimes = { pm: 900, ak: 1400, vintorez: 1100 };
    const dur = reloadTimes[shootingState.weapon];

    setTimeout(() => {
      setShootingState(prev => ({
        ...prev,
        reloading: false,
        ammo: prev.maxAmmo
      }));
    }, dur);
  };

  const handleStartShootingGame = (wep: "pm" | "ak" | "vintorez", betAmount: number) => {
    const finalBet = betAmount && betAmount >= 100 ? betAmount : 100;
    
    if (playerProfile.balance < finalBet) {
      setPdaAlert({ text: "❌ Недостаточно средств на балансе КПК!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 2500);
      return;
    }

    const configs = {
      pm: { ammoMax: 8 },
      ak: { ammoMax: 30 },
      vintorez: { ammoMax: 10 }
    };

    setShootingState({
      active: true,
      saving: false,
      ended: false,
      score: 0,
      ammo: configs[wep].ammoMax,
      maxAmmo: configs[wep].ammoMax,
      reloading: false,
      timer: 15,
      weapon: wep,
      targets: [],
      bulletHoles: [],
      flashes: [],
      bet: finalBet
    });
  };

  // ==========================================
  // THIMBLERIG HELPER IMPLEMENTATION
  // ==========================================
  const handleStartThimblerig = (betAmount: number) => {
    if (playerProfile.balance < betAmount) {
      setPdaAlert({ text: "❌ Недостаточно средств на балансе КПК!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 2500);
      return;
    }

    const initialBoltCup = Math.floor(Math.random() * 3);

    // Step 1: Initial Reveal (Show where the bolt is)
    setThimblerigState({
      bet: betAmount,
      active: true,
      shuffling: false,
      ballCup: initialBoltCup,
      selectedCup: null,
      revealed: false,
      initialReveal: true,
      message: LANG.thimblerig.remember,
      positions: [0, 1, 2]
    });

    // Step 2: Transition from Reveal to Shuffling after 1300ms
    setTimeout(() => {
      // Dynamic swap interval (ms) - higher bet means much faster swaps!
      const swapSpeed = Math.max(80, 310 - Math.min(230, Math.floor((betAmount / 1000) * 210)));
      
      // Total swaps to perform (proportional to maintain about 2-3 seconds of total shuffling time)
      const totalSwaps = Math.max(8, Math.min(18, Math.floor(2200 / swapSpeed)));

      setThimblerigState(prev => ({
        ...prev,
        initialReveal: false,
        shuffling: true,
        message: LANG.thimblerig.shuffling,
        positions: [0, 1, 2]
      }));

      // Beautiful shuffling swaps
      let swapTicks = 0;
      const swapInterval = setInterval(() => {
        setThimblerigState(prev => {
          if (!prev.shuffling) {
            clearInterval(swapInterval);
            return prev;
          }
          const nextPositions = [...prev.positions];
          const idxA = Math.floor(Math.random() * 3);
          let idxB = Math.floor(Math.random() * 3);
          while (idxA === idxB) {
            idxB = Math.floor(Math.random() * 3);
          }
          const temp = nextPositions[idxA];
          nextPositions[idxA] = nextPositions[idxB];
          nextPositions[idxB] = temp;
          return {
            ...prev,
            positions: nextPositions
          };
        });
        swapTicks++;
        if (swapTicks >= totalSwaps) {
          clearInterval(swapInterval);
        }
      }, swapSpeed);

      // Shuffling sound tick simulation matching the swap speed
      let ticks = 0;
      const playTick = () => {
        if (ticks < totalSwaps) {
          playSlotTick();
          ticks++;
          setTimeout(playTick, swapSpeed);
        }
      };
      playTick();

      // Shuffling finishes precisely after the total run time of the swaps
      setTimeout(() => {
        setThimblerigState(prev => ({
          ...prev,
          shuffling: false,
          message: LANG.thimblerig.chooseCup
        }));
      }, totalSwaps * swapSpeed + 150);

    }, 1300);
  };

  const handleChooseCup = (cupIndex: number) => {
    if (thimblerigState.shuffling || thimblerigState.selectedCup !== null || thimblerigState.revealed) return;

    if (ws) {
      ws.send(JSON.stringify({
        type: "THIMBLERIG_PLAY",
        payload: {
          playerId: userId,
          bet: thimblerigState.bet,
          chosenCup: cupIndex
        }
      }));

      setThimblerigState(prev => ({
        ...prev,
        selectedCup: cupIndex,
        message: "Куратор проверяет..."
      }));
    }
  };

  // ==========================================
  // SVINYA GAME HELPER IMPLEMENTATION
  // ==========================================
  const SVINYA_RANKS = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];

  const checkSvinyaPlayable = (card: SvinyaCard, centerCard: SvinyaCard) => {
    if (card.suit === centerCard.suit) return true;
    const idx1 = SVINYA_RANKS.indexOf(card.value);
    const idx2 = SVINYA_RANKS.indexOf(centerCard.value);
    return Math.abs(idx1 - idx2) === 1;
  };

  const handleStartSvinya = (betAmount: number) => {
    if (playerProfile.balance < betAmount) {
      setPdaAlert({ text: "❌ Недостаточно средств на балансе КПК!", type: "danger" });
      setTimeout(() => setPdaAlert(null), 2500);
      return;
    }

    setSvinyaState(prev => ({
      ...prev,
      loading: true,
      bet: betAmount,
      active: true,
      phase: "ready"
    }));

    if (ws) {
      ws.send(JSON.stringify({
        type: "SVINYA_START",
        payload: {
          playerId: userId,
          bet: betAmount
        }
      }));
    }
  };

  const handleSvinyaPlayerDraw = (circleIndex: number) => {
    if (svinyaState.phase !== "playing" || svinyaState.turn !== "player") return;
    const card = svinyaState.circleCards[circleIndex];
    if (!card) return;

    const nextCircle = [...svinyaState.circleCards];
    nextCircle[circleIndex] = null;

    const centerCard = svinyaState.centerPile[svinyaState.centerPile.length - 1];

    if (card.isPig) {
      const updatedPlayerSty = [...svinyaState.playerSty, ...svinyaState.centerPile, card];
      
      const remaining = nextCircle.filter(c => c !== null) as SvinyaCard[];
      let nextCenterCard: SvinyaCard;
      if (remaining.length > 0) {
        const randIdx = nextCircle.findIndex(c => c !== null);
        nextCenterCard = nextCircle[randIdx]!;
        nextCircle[randIdx] = null;
      } else {
        nextCenterCard = { suit: "clubs", value: "Q", isPig: false };
      }

      setSvinyaState(prev => ({
        ...prev,
        circleCards: nextCircle,
        centerPile: [nextCenterCard],
        playerSty: updatedPlayerSty,
        turn: "bot",
        message: "Хрю-хрю! Визг дикой свиньи! Вы вытащили карту Свиньи и забрали ВСЕ карты из центра!"
      }));

      playRadarSweep();
      return;
    }

    if (checkSvinyaPlayable(card, centerCard)) {
      const nextCenterPile = [...svinyaState.centerPile, card];
      setSvinyaState(prev => ({
        ...prev,
        circleCards: nextCircle,
        centerPile: nextCenterPile,
        message: `Совпадение! Вы сбросили в центр карту. Ход продолжается!`
      }));
      playSlotTick();
    } else {
      const nextPlayerSty = [...svinyaState.playerSty, card];
      setSvinyaState(prev => ({
        ...prev,
        circleCards: nextCircle,
        playerSty: nextPlayerSty,
        turn: "bot",
        message: "Карта не подошла! Добавлена в ваш загон. Ход переходит к бармену."
      }));
      playSlotTick();
    }
  };

  const handleSvinyaPlayStyBack = () => {
    if (svinyaState.phase !== "playing" || svinyaState.turn !== "player") return;
    if (svinyaState.playerSty.length === 0) return;

    const topCard = svinyaState.playerSty[svinyaState.playerSty.length - 1];
    const centerCard = svinyaState.centerPile[svinyaState.centerPile.length - 1];

    if (checkSvinyaPlayable(topCard, centerCard)) {
      const nextPlayerSty = svinyaState.playerSty.slice(0, -1);
      const nextCenterPile = [...svinyaState.centerPile, topCard];
      setSvinyaState(prev => ({
        ...prev,
        playerSty: nextPlayerSty,
        centerPile: nextCenterPile,
        message: `Вы сбросили верхнюю карту своего загона (${topCard.value}) в общую кучу!`
      }));
      playSlotTick();
    }
  };

  const handleSvinyaFinish = () => {
    if (svinyaState.phase !== "playing") return;

    let result: "win" | "lose" | "tie" = "tie";
    const pCount = svinyaState.playerSty.length;
    const bCount = svinyaState.botSty.length;

    if (pCount < bCount) {
      result = "win";
    } else if (pCount > bCount) {
      result = "lose";
    } else {
      result = "tie";
    }

    if (ws) {
      ws.send(JSON.stringify({
        type: "SVINYA_FINISH",
        payload: {
          playerId: userId,
          result
        }
      }));
    }
  };

  // Svinya CPU Bot Turn logic Effect
  useEffect(() => {
    if (svinyaState.phase !== "playing" || svinyaState.turn !== "bot") return;

    const remainingCircleCount = svinyaState.circleCards.filter(c => c !== null).length;
    if (remainingCircleCount === 0) {
      handleSvinyaFinish();
      return;
    }

    const timer = setTimeout(() => {
      const centerCard = svinyaState.centerPile[svinyaState.centerPile.length - 1];

      // 1. Can Bot play top card from botSty?
      if (svinyaState.botSty.length > 0) {
        const topStyCard = svinyaState.botSty[svinyaState.botSty.length - 1];
        if (checkSvinyaPlayable(topStyCard, centerCard)) {
          const nextBotSty = svinyaState.botSty.slice(0, -1);
          const nextCenterPile = [...svinyaState.centerPile, topStyCard];
          setSvinyaState(prev => ({
            ...prev,
            botSty: nextBotSty,
            centerPile: nextCenterPile,
            message: `Бармен сыграл карту (${topStyCard.value}) из своего загона!`
          }));
          return;
        }
      }

      // 2. Otherwise draw from circular deck
      const remainingIndexes = svinyaState.circleCards
        .map((c, i) => (c !== null ? i : -1))
        .filter(i => i !== -1);
      
      if (remainingIndexes.length === 0) {
        handleSvinyaFinish();
        return;
      }

      const randIdx = remainingIndexes[Math.floor(Math.random() * remainingIndexes.length)];
      const drawnCard = svinyaState.circleCards[randIdx]!;

      const nextCircle = [...svinyaState.circleCards];
      nextCircle[randIdx] = null;

      if (drawnCard.isPig) {
        const nextBotSty = [...svinyaState.botSty, ...svinyaState.centerPile, drawnCard];

        let nextCenterCard: SvinyaCard;
        const freshRemaining = nextCircle.filter(c => c !== null) as SvinyaCard[];
        if (freshRemaining.length > 0) {
          const firstValid = nextCircle.findIndex(c => c !== null);
          nextCenterCard = nextCircle[firstValid]!;
          nextCircle[firstValid] = null;
        } else {
          nextCenterCard = { suit: "clubs", value: "Q", isPig: false };
        }

        setSvinyaState(prev => ({
          ...prev,
          circleCards: nextCircle,
          centerPile: [nextCenterCard],
          botSty: nextBotSty,
          turn: "player",
          message: "Хрю-хрю! Бармен вытащил дикую свинью и забрал кон в свой загон!"
        }));
        playRadarSweep();
        return;
      }

      if (checkSvinyaPlayable(drawnCard, centerCard)) {
        const nextCenterPile = [...svinyaState.centerPile, drawnCard];
        setSvinyaState(prev => ({
          ...prev,
          circleCards: nextCircle,
          centerPile: nextCenterPile,
          message: `Бармен вытащил подходящую карту (${drawnCard.value}) и сбросил в кучу. Ход бармена продолжается!`
        }));
        playSlotTick();
      } else {
        const nextBotSty = [...svinyaState.botSty, drawnCard];
        setSvinyaState(prev => ({
          ...prev,
          circleCards: nextCircle,
          botSty: nextBotSty,
          turn: "player",
          message: `Бармен вытащил неподходящую карту и положил её в загон. Твой ход!`
        }));
        playSlotTick();
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [svinyaState.turn, svinyaState.phase, svinyaState.botSty, svinyaState.centerPile, svinyaState.circleCards]);

  // Find lobby user is actively playing
  const userActiveLobby: any = (Object.values(pazaakLobbies) as any[]).find(
    (l: any) => l.status === "playing" && (l.creatorId === userId || l.opponentId === userId)
  );

  const renderCuratorPane = () => {
    return (
      <div className="space-y-6">
        {/* Tavern name edit & Game toggles */}
        <div className="bg-gray-950 p-5 rounded border border-gray-850 space-y-5">
          <div className="text-amber-500 font-bold font-mono text-xs uppercase pb-1.5 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Settings className="w-4 h-4" /> 
              <span>ПАРАМЕТРЫ ЛОКАЦИИ & ДОСТУПНОСТЬ МИНИ-ИГР ЗОНЫ</span>
            </div>
            <span className="text-[9px] text-gray-550 border border-gray-800 px-2 py-0.5 rounded font-bold">GM CONTROL PANEL</span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs font-mono">
            {/* Left Column: Tavern & Merchant customizer */}
            <div className="space-y-4 border-r border-gray-905 lg:pr-6">
              
              {/* Tavern name input */}
              <div className="space-y-1.5">
                <label className="block text-gray-400 font-bold uppercase text-[10px] tracking-wider"><Store className='w-3.5 h-3.5 inline mr-1 text-amber-500' /> НАЗВАНИЕ БАРА/ТАВЕРНЫ:</label>
                <input
                  type="text"
                  value={gmTavernNameInput !== undefined ? gmTavernNameInput : tavernSettings.tavernName}
                  onChange={(e) => setGmTavernNameInput(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-bold font-mono text-gray-200 outline-none focus:border-amber-900 focus:ring-1 focus:ring-amber-900/30"
                  placeholder="Наберите название бара..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const name = gmTavernNameInput !== undefined ? gmTavernNameInput : tavernSettings.tavernName;
                      if (ws) {
                        ws.send(JSON.stringify({
                          type: "GM_UPDATE_TAVERN_SETTINGS",
                          payload: { tavernName: name }
                        }));
                        setPdaAlert({ text: "Название локации успешно узаконено!", type: "success" });
                        setTimeout(() => setPdaAlert(null), 2500);
                      }
                    }}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold py-1.5 px-2 rounded uppercase text-[10px] cursor-pointer transition-all active:scale-95 text-center"
                  >
                    Применить
                  </button>
                  <button
                    onClick={() => {
                      const T_NAMES = [
                        "Бар «100 Рентген»",
                        "Приют Сталкера",
                        "Кабак «Шестерёнка»",
                        "База куратора «Холодный Болт»",
                        "Гремучий Кисель",
                        "Аномальный Погреб",
                        "Пьяный Контроллёр",
                        "Зелёный Дракон",
                        "У Борова",
                        "Мёртвый Головастик",
                        "Кордонский подвал",
                        "Пересыльный Пункт Группировок",
                        "Форпост Долга",
                        "Станция Янов",
                        "Бар «Штиль»"
                      ];
                      const currentVal = gmTavernNameInput !== undefined ? gmTavernNameInput : tavernSettings.tavernName;
                      const filtered = T_NAMES.filter(n => n !== currentVal);
                      const randomName = filtered[Math.floor(Math.random() * filtered.length)] || T_NAMES[0];
                      setGmTavernNameInput(randomName);
                      if (ws) {
                        ws.send(JSON.stringify({
                          type: "GM_UPDATE_TAVERN_SETTINGS",
                          payload: { tavernName: randomName }
                        }));
                        setPdaAlert({ text: `Сгенерировано: ${randomName}`, type: "info" });
                        setTimeout(() => setPdaAlert(null), 2500);
                      }
                    }}
                    className="bg-gray-800 hover:bg-gray-750 text-gray-300 font-bold py-1.5 px-3 rounded uppercase text-[10px] cursor-pointer transition-all border border-gray-700 hover:border-gray-600"
                  >
                    <Dices className='w-3.5 h-3.5 inline mr-1 text-sky-400' /> Случайно
                  </button>
                </div>
              </div>

              {/* Merchant name input */}
              <div className="space-y-1.5">
                <label className="block text-gray-400 font-bold uppercase text-[10px] tracking-wider"><User className='w-3.5 h-3.5 inline mr-1 text-amber-500' /> ИМЯ СКУПЩИКА-ТОРГОВЦА:</label>
                <input
                  type="text"
                  value={gmMerchantNameInput !== undefined ? gmMerchantNameInput : tavernSettings.merchantName}
                  onChange={(e) => setGmMerchantNameInput(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-bold font-mono text-gray-200 outline-none focus:border-amber-900 focus:ring-1 focus:ring-amber-900/30"
                  placeholder="Пример: Сидорович, Сыч, Боров..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const name = gmMerchantNameInput !== undefined ? gmMerchantNameInput : tavernSettings.merchantName;
                      if (ws) {
                        ws.send(JSON.stringify({
                          type: "GM_UPDATE_TAVERN_SETTINGS",
                          payload: { merchantName: name }
                        }));
                        setPdaAlert({ text: `Скупщик переименован в "${name}"!`, type: "success" });
                        setTimeout(() => setPdaAlert(null), 2500);
                      }
                    }}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold py-1.5 px-2 rounded uppercase text-[10px] cursor-pointer transition-all active:scale-95 text-center"
                  >
                    Применить
                  </button>
                  <button
                    onClick={() => {
                      const M_NAMES = [
                        "Сидорович",
                        "Сыч",
                        "Бармен",
                        "Боров",
                        "Зулус",
                        "Гавайец",
                        "Сахаров",
                        "Ашот",
                        "Каланча",
                        "Торговец Митяй",
                        "Дядько Яр",
                        "Косой",
                        "Шустрый",
                        "Суслов",
                        "Лёлик Панадол"
                      ];
                      const currentVal = gmMerchantNameInput !== undefined ? gmMerchantNameInput : tavernSettings.merchantName;
                      const filtered = M_NAMES.filter(n => n !== currentVal);
                      const randomMerchant = filtered[Math.floor(Math.random() * filtered.length)] || M_NAMES[0];
                      setGmMerchantNameInput(randomMerchant);
                      if (ws) {
                        ws.send(JSON.stringify({
                          type: "GM_UPDATE_TAVERN_SETTINGS",
                          payload: { merchantName: randomMerchant }
                        }));
                        setPdaAlert({ text: `Сгенерирован торговец: ${randomMerchant}`, type: "info" });
                        setTimeout(() => setPdaAlert(null), 2500);
                      }
                    }}
                    className="bg-gray-800 hover:bg-gray-750 text-gray-300 font-bold py-1.5 px-3 rounded uppercase text-[10px] cursor-pointer transition-all border border-gray-700 hover:border-gray-600"
                  >
                    <Dices className='w-3.5 h-3.5 inline mr-1 text-sky-400' /> Случайно
                  </button>
                </div>
              </div>

            </div>

            {/* Right Columns: Game Toggles (Trades, Pazaak, Dice, Races, Slots, Roulette, Shooting, Thimblerig, Svinya) */}
            <div className="lg:col-span-2 space-y-2">
              <label className="block text-gray-400 font-bold text-[10px] uppercase tracking-wider"><Lock className='w-3.5 h-3.5 inline mr-1 text-sky-400' /> ПЛАШКА МИНИ-ИГР (Заблок. / Разблок. в КПК Сталкеров):</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: "trades", label: "Скупка & Торговля" },
                  { key: "pazaak", label: "Паазак" },
                  { key: "dice", label: "Кости" },
                  { key: "races", label: "Тараканьи Скачки" },
                  { key: "slots", label: "Слот-Машина" },
                  { key: "roulette", label: "Рулетка Зоны" },
                  { key: "shooting", label: "Кустарный Тир" },
                  { key: "thimblerig", label: "Напёрстки" },
                  { key: "svinya", label: "Игра «Свинья»" }
                ].map((itm) => {
                  const isEnabled = tavernSettings.enabledGames[itm.key as keyof typeof tavernSettings.enabledGames];
                  return (
                    <button
                      key={itm.key}
                      onClick={() => {
                        const newGames = { ...tavernSettings.enabledGames, [itm.key]: !isEnabled };
                        if (ws) {
                          ws.send(JSON.stringify({
                            type: "GM_UPDATE_TAVERN_SETTINGS",
                            payload: { enabledGames: newGames }
                          }));
                          setPdaAlert({ text: `Режим "${itm.label}" ${!isEnabled ? "РАЗЛОЧЕН" : "ЗАБЛОКИРОВАН"} для сталкеров`, type: "info" });
                          setTimeout(() => setPdaAlert(null), 2500);
                        }
                      }}
                      className={`py-2 px-2.5 rounded border text-[11px] uppercase font-bold text-center transition-all cursor-pointer ${
                        isEnabled
                          ? "bg-emerald-950/40 border-emerald-500/80 text-emerald-400 hover:bg-emerald-900/30"
                          : "bg-red-950/30 border-red-900/80 text-red-400 hover:bg-red-900/20 line-through"
                      }`}
                    >
                      {itm.label}: {isEnabled ? "ОТКРЫТО" : "ЗАКРЫТО"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* GM Column 1: Flea Market Catalogue Manager */}
          <div className="bg-gray-950 p-4 rounded border border-gray-800 space-y-4">
            <h5 className="font-bold font-mono text-xs text-amber-500 uppercase pb-1 border-b border-gray-850 flex items-center justify-between">
              <span><Wrench className="w-4 h-4 inline-block mr-1" /> Ассортимент товаров у {tavernSettings.merchantName || "Сидоровича"}</span>
              <span className="text-[9px] text-gray-500">БД ТОРГОВЛИ</span>
            </h5>
            
            <div className="space-y-2.5 text-xs font-mono">
              <div className="w-full overflow-x-auto pb-1 mt-1 -mb-1 scrollbar-hide">
                <div className="flex gap-2 min-w-max">
                  <span className="text-[10px] text-gray-500 uppercase flex flex-col justify-center select-none">Шаблоны:</span>
                  {[
                    { name: 'Водка «Казаки»', price: '50', type: 'med', desc: '-10 радиации, лечит душу' },
                    { name: 'Аптечка АИ-2', price: '150', type: 'med', desc: '+50 ОЗ' },
                    { name: 'Бинт', price: '30', type: 'med', desc: 'Останавливает кровотечение' },
                    { name: 'Антирад', price: '200', type: 'med', desc: '-50 радиации' },
                    { name: 'Консервы «Завтрак туриста»', price: '45', type: 'misc', desc: 'Утоляет голод' },
                    { name: 'Энергетик «Stalker»', price: '60', type: 'misc', desc: '+Выносливость' },
                    { name: 'Болты', price: '5', type: 'misc', desc: 'Для проверки аномалий' },
                    { name: 'Патроны 9x18', price: '80', type: 'ammo', desc: 'Коробка (30 шт)' },
                    { name: 'Патроны 5.45x39', price: '120', type: 'ammo', desc: 'Коробка (30 шт)' },
                    { name: 'Дробь', price: '100', type: 'ammo', desc: 'Коробка 12 калибр (10 шт)' },
                    { name: 'Пистолет ПМм', price: '450', type: 'weapon', desc: 'Стандартный ствол новичка' },
                    { name: 'Обрез ружья', price: '600', type: 'weapon', desc: 'Убойный вблизи' },
                    { name: 'АКМ 74/2', price: '2200', type: 'weapon', desc: 'Надежный штурмовой автомат' },
                    { name: 'Кожаная куртка', price: '300', type: 'armor', desc: 'Защита: слабая' },
                    { name: 'Заря', price: '1500', type: 'armor', desc: 'Костюм сталкера' },
                    { name: 'Артефакт «Медуза»', price: '800', type: 'art', desc: '-2 радиации, пулестойкость' },
                    { name: 'Артефакт «Кровь камня»', price: '1200', type: 'art', desc: '+5 ХП/сек' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setGmItemName(preset.name);
                        setGmItemPrice(preset.price);
                        setGmItemType(preset.type);
                        setGmItemDesc(preset.desc);
                      }}
                      className="bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-amber-400 border border-gray-700 hover:border-amber-900/50 rounded px-2 py-1 text-[10px] transition-colors cursor-pointer select-none"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {shopItems.length > 0 && (
                <div className="w-full overflow-x-auto pb-1 mt-1 scrollbar-hide">
                  <div className="flex gap-2 min-w-max">
                    <span className="text-[10px] text-amber-500/70 uppercase flex flex-col justify-center select-none" title="Drag & Drop!"><Store className='w-3.5 h-3.5 inline mr-1 text-amber-500' /> ИЗ БАЗЫ:</span>
                    {shopItems.map((item: any) => (
                      <div
                        key={`drag-${item.id}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/json", JSON.stringify(item));
                        }}
                        onClick={() => {
                          setGmItemName(item.name || "");
                          setGmItemPrice(item.price !== undefined && item.price !== null ? item.price.toString() : "0");
                          setGmItemType(item.type || "misc");
                          setGmItemDesc(item.description || "");
                        }}
                        className="bg-amber-950/30 hover:bg-amber-900/50 text-amber-500/80 hover:text-amber-400 border border-amber-900/30 hover:border-amber-500/50 rounded px-2 py-1 text-[10px] transition-colors cursor-grab active:cursor-grabbing select-none"
                        title="Перетащите вниз или кликните"
                      >
                        {item.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div 
                className="bg-gray-900/30 p-2 rounded border border-dashed border-gray-800 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  try {
                    const data = JSON.parse(e.dataTransfer.getData("application/json"));
                    if (data && data.name) {
                      setGmItemName(data.name || "");
                      setGmItemPrice(data.price !== undefined && data.price !== null ? data.price.toString() : "100");
                      setGmItemType(data.type || "misc");
                      setGmItemDesc(data.description || "");
                      setPdaAlert({ text: "Предмет загружен из Drag&Drop", type: "success" });
                      setTimeout(() => setPdaAlert(null), 1500);
                    }
                  } catch (err) {}
                }}
              >
                <div>
                  <label className="block text-gray-400 mb-1">Название предмета:</label>
                  <input
                    type="text"
                    placeholder="Drop data here! Или введите: Аптечка"
                    value={gmItemName}
                    onChange={(e) => setGmItemName(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-mono text-gray-200 outline-none focus:border-amber-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-gray-400 mb-1">Цена (в кр.):</label>
                    <input
                      type="number"
                      placeholder="150"
                      value={gmItemPrice}
                      onChange={(e) => setGmItemPrice(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-mono text-gray-200 outline-none focus:border-amber-900"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">Категория:</label>
                    <select
                      value={gmItemType}
                      onChange={(e: any) => setGmItemType(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-mono text-gray-205 outline-none focus:border-amber-900"
                    >
                      <option value="misc">Разное</option>
                      <option value="weapon">Оружие</option>
                      <option value="ammo">Боеприпасы</option>
                      <option value="med">Медикаменты</option>
                      <option value="armor">Защита/Броня</option>
                      <option value="art">Артефакт</option>
                    </select>
                  </div>
                </div>

                <div className="mt-2">
                  <label className="block text-gray-400 mb-1">Описание/Эффект:</label>
                  <input
                    type="text"
                    placeholder="Защищает от пси-излучения, +50 ОЗ"
                    value={gmItemDesc}
                    onChange={(e) => setGmItemDesc(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-mono text-gray-200 outline-none focus:border-amber-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => {
                    if (!gmItemName.trim()) {
                      setPdaAlert({ text: "Введите название предмета!", type: "danger" });
                      setTimeout(() => setPdaAlert(null), 2500);
                      return;
                    }
                    if (ws) {
                      ws.send(JSON.stringify({
                        type: "GM_ADD_SHOP_ITEM",
                        payload: {
                          name: gmItemName.trim(),
                          price: parseInt(gmItemPrice, 10) || 100,
                          type: gmItemType,
                          description: gmItemDesc.trim()
                        }
                      }));
                      setGmItemName("");
                      setGmItemDesc("");
                    }
                  }}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold py-2.5 rounded uppercase tracking-wider cursor-pointer text-center text-xs"
                >
                  <Plus className='w-3.5 h-3.5 inline mr-1 text-gray-950 stroke-[3]' /> Добавить на прилавок
                </button>
                
                <button
                  onClick={() => {
                    if (!gmItemName.trim()) {
                      setPdaAlert({ text: "Введите название для вброса в рюкзак отряда!", type: "danger" });
                      setTimeout(() => setPdaAlert(null), 2500);
                      return;
                    }
                    if (ws) {
                      ws.send(JSON.stringify({
                        type: "GM_ADD_TO_INVENTORY",
                        payload: { itemName: gmItemName.trim() }
                      }));
                    }
                  }}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded font-bold uppercase cursor-pointer text-xs text-center"
                  title="Выдать сразу в походный рюкзак отряда"
                >
                  В рюкзак <Briefcase className='w-3.5 h-3.5 inline ml-1 text-gray-400' />
                </button>
              </div>
            </div>

            {/* Catalogue deleter list display */}
            <div className="space-y-1.5 pt-3 border-t border-gray-850">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Текущие товары на удаление:</div>
              <div className="space-y-1 max-h-[140px] overflow-y-auto bg-gray-900/50 p-2 rounded border border-gray-850">
                {shopItems.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center bg-gray-950 px-2 py-1.5 rounded border border-gray-900 text-[11px] font-mono text-gray-300">
                    <div>
                      <span className="font-bold">{item.name}</span> • <span className="text-amber-500">{formatCredits(item.price)}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (ws) {
                          ws.send(JSON.stringify({
                            type: "GM_DELETE_SHOP_ITEM",
                            payload: { itemId: item.id }
                          }));
                        }
                      }}
                      className="text-red-400 hover:text-red-500 cursor-pointer p-0.5"
                      title="Удалить товар навсегда"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* GM Column 2: Total Player Database Control */}
          <div className="bg-gray-950 p-4 rounded border border-gray-800 space-y-4">
            <h5 className="font-bold font-mono text-xs text-amber-500 uppercase pb-1 border-b border-gray-850">
              Профайлы & База Данных КПК Сталкеров
            </h5>

            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-gray-400 mb-1">Выберите Сталкера для редактирования:</label>
                <select
                  value={gmSelectedPlayerId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGmSelectedPlayerId(val);
                    if (playerDb[val] && playerDb[val].balance !== undefined && playerDb[val].balance !== null) {
                      setGmPlayerBalanceInput(playerDb[val].balance.toString());
                    } else {
                      setGmPlayerBalanceInput("0");
                    }
                  }}
                  className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-mono text-amber-400 font-bold outline-none focus:border-amber-900"
                >
                  <option value="">-- Выберите игрока --</option>
                  {Object.keys(playerDb).map((pId) => (
                    <option key={pId} value={pId}>
                      {playerDb[pId]?.userName || pId} (Баланс: {formatCredits(playerDb[pId]?.balance || 0)})
                    </option>
                  ))}
                </select>
              </div>

              {gmSelectedPlayerId && playerDb[gmSelectedPlayerId] && (
                <div className="space-y-3.5 bg-gray-900/60 p-3 rounded border border-gray-850">
                  
                  {/* Part A: Set absolute balance */}
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div className="col-span-2">
                      <label className="block text-gray-550 mb-1 text-[10px]">Баланс на счете (в кредитах):</label>
                      <input
                        type="number"
                        value={gmPlayerBalanceInput}
                        onChange={(e) => setGmPlayerBalanceInput(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded p-1.5 text-xs text-amber-400 font-mono font-bold"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (ws && gmSelectedPlayerId) {
                          ws.send(JSON.stringify({
                            type: "GM_SET_PLAYER_BALANCE",
                            payload: { targetPlayerId: gmSelectedPlayerId, balance: gmPlayerBalanceInput }
                          }));
                          setPdaAlert({ text: `Баланс игрока изменен на ${formatCredits(parseInt(gmPlayerBalanceInput) || 0)}`, type: "success" });
                          setTimeout(() => setPdaAlert(null), 2500);
                        }
                      }}
                      className="bg-amber-600 hover:bg-amber-500 text-gray-950 py-1.5 font-bold rounded text-[11px] cursor-pointer text-center"
                    >
                      Применить
                    </button>
                  </div>

                  {/* Part B: Unlock Pazaak premium modifier cards */}
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div className="col-span-2">
                      <label className="block text-gray-550 mb-1 text-[10px]">Выдать карту Паазака:</label>
                      <select
                        value={gmPlayerCardToUnlock}
                        onChange={(e) => setGmPlayerCardToUnlock(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded p-1.5 text-[11px] font-mono text-purple-300"
                      >
                        <option value="">-- Выберите карту --</option>
                        <option value="+/-1">+/-1 (Флип)</option>
                        <option value="+/-2">+/-2 (Флип)</option>
                        <option value="+/-3">+/-3 (Флип)</option>
                        <option value="+/-4">+/-4 (Флип)</option>
                        <option value="+/-5">+/-5 (Флип)</option>
                        <option value="+/-6">+/-6 (Флип)</option>
                        <option value="D">D (Double - Удвоение)</option>
                        <option value="T">T (Tie breaker - Ничья)</option>
                        <option value="3 & 6">3 & 6 (Смена знаков 3/6)</option>
                        <option value="2 & 4">2 & 4 (Смена знаков 2/4)</option>
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        if (!gmPlayerCardToUnlock) {
                          setPdaAlert({ text: "Выберите карту для разблокировки!", type: "info" });
                          setTimeout(() => setPdaAlert(null), 2500);
                          return;
                        }
                        if (ws && gmSelectedPlayerId) {
                          ws.send(JSON.stringify({
                            type: "GM_UNLOCK_PLAYER_CARDS",
                            payload: { targetPlayerId: gmSelectedPlayerId, card: gmPlayerCardToUnlock }
                          }));
                          setPdaAlert({ text: `Игроку выдана карта [${gmPlayerCardToUnlock}]!`, type: "success" });
                          setTimeout(() => setPdaAlert(null), 2500);
                        }
                      }}
                      className="bg-purple-900 hover:bg-purple-700 text-purple-100 py-1.5 font-bold rounded text-[11px] border border-purple-700 cursor-pointer text-center"
                    >
                      Выдать
                    </button>
                  </div>

                  {/* Profile Reset action */}
                  <div className="pt-2 border-t border-gray-800">
                    <button
                      onClick={() => {
                        if (confirm("Вы на сто процентов уверены? Будет сброшен баланс до 1000 и дефолтный набор карт!") && ws && gmSelectedPlayerId) {
                          ws.send(JSON.stringify({
                            type: "GM_RESET_PLAYER_PROFILE",
                            payload: { targetPlayerId: gmSelectedPlayerId }
                          }));
                          setPdaAlert({ text: "Профиль игрока полностью сброшен!", type: "info" });
                          setTimeout(() => setPdaAlert(null), 2500);
                        }
                      }}
                      className="w-full bg-red-950 hover:bg-red-900 text-red-300 hover:text-white border border-red-900 py-2 rounded text-center font-bold text-[10px] uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      <CustomWarning />️ Полный Сброс Профиля Сталкера
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  if (viewMode === "admin") {
    return (
      <div className="h-full flex flex-col bg-gray-900 border border-gray-800 rounded-lg overflow-hidden shadow-2xl relative">
        <div className="bg-gray-950 px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-500 animate-pulse" />
            <div>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest leading-none">ПУЛЬТ КУРАТОРА ИГРЫ</div>
              <div className="font-mono text-xs font-bold text-amber-400 mt-1 uppercase">
                {tavernSettings.tavernName}
              </div>
            </div>
          </div>
          <div className="bg-amber-950 text-amber-300 px-2 py-0.5 rounded text-[10px] border border-amber-900/50 uppercase font-mono font-bold">
            Администратор Зоны
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {renderCuratorPane()}
        </div>
        {pdaAlert && (
          <div className={`p-4 text-center font-mono text-xs font-bold border-t ${
            pdaAlert.type === "success" 
              ? "bg-emerald-950/85 text-emerald-400 border-emerald-900" 
              : pdaAlert.type === "danger"
                ? "bg-red-950/85 text-red-400 border-red-900"
                : "bg-amber-950/85 text-amber-400 border-amber-900"
          }`}>
            <span>{pdaAlert.text}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 border border-gray-850 rounded-lg overflow-hidden shadow-2xl relative">
      {/* HUD Bar Wallet / КПК Счета */}
      <div className="bg-gray-950 px-4 py-3 flex flex-wrap justify-between items-center border-b border-gray-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-emerald-950 text-emerald-400 p-2 rounded-full border border-emerald-900/40">
            <Coins className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest leading-none">Личный Баланс КПК</div>
            <div className="font-mono text-base font-bold text-emerald-400 leading-none mt-1">
              {formatCredits(playerProfile.balance || 0)}
            </div>
          </div>
          {/* Dynamic Tavern name badge */}
          <div className="bg-slate-900 text-amber-500 border border-amber-900/30 px-3 py-1.5 rounded text-xs uppercase font-mono tracking-wider font-extrabold flex items-center gap-1.5 shadow-inner my-1 sm:my-0">
            <span><Beer className='w-4 h-4 text-amber-500 animate-bounce' /></span>
            <span>{tavernSettings.tavernName}</span>
          </div>
        </div>

        {/* Tab Sub-selectors */}
        <div className="flex flex-wrap bg-gray-900 p-1 rounded border border-gray-800 text-xs font-mono select-none mt-2 sm:mt-0 gap-1">
          <button
            onClick={() => setActiveSubTab("trades")}
            className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "trades" 
                ? "bg-slate-800 text-slate-200 font-bold" 
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Свалка Скупщика
          </button>
          
          {(tavernSettings.enabledGames.pazaak || isGM) && (
            <button
              onClick={() => setActiveSubTab("pazaak")}
              className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "pazaak" 
                  ? "bg-emerald-900/40 text-emerald-400 font-bold border-emerald-900" 
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Паазак
            </button>
          )}

          {(tavernSettings.enabledGames.dice || isGM) && (
            <button
              onClick={() => setActiveSubTab("dice")}
              className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "dice" 
                  ? "bg-sky-950/40 text-sky-400 font-bold" 
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Dices className="w-3.5 h-3.5" />
              Покер на Костях
            </button>
          )}

          {(tavernSettings.enabledGames.races || isGM) && (
            <button
              onClick={() => setActiveSubTab("races")}
              className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "races" 
                  ? "bg-yellow-950/40 text-yellow-500 font-bold" 
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Bug className="w-3.5 h-3.5" />
              Тараканьи Бега
            </button>
          )}

          {(tavernSettings.enabledGames.slots || isGM) && (
            <button
              onClick={() => setActiveSubTab("slots")}
              className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "slots" 
                  ? "bg-purple-950/40 text-purple-400 font-bold border-purple-900" 
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              Реактор-Слот
            </button>
          )}

          {(tavernSettings.enabledGames.roulette || isGM) && (
            <button
              onClick={() => setActiveSubTab("roulette")}
              className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "roulette" 
                  ? "bg-red-950/40 text-red-500 font-bold border-red-900" 
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
              Радар-Рулетка
            </button>
          )}

          {(tavernSettings.enabledGames.shooting || isGM) && (
            <button
              onClick={() => setActiveSubTab("shooting")}
              className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "shooting" 
                  ? "bg-orange-950/40 text-orange-500 font-bold border-orange-900" 
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              КПК-Тир
            </button>
          )}

          {(tavernSettings.enabledGames.thimblerig || isGM) && (
            <button
              onClick={() => setActiveSubTab("thimblerig")}
              className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "thimblerig" 
                  ? "bg-teal-950/40 text-teal-400 font-bold border-teal-900" 
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <VenetianMask className="w-3.5 h-3.5" />
              Напёрстки
            </button>
          )}

          {(tavernSettings.enabledGames.svinya || isGM) && (
            <button
              onClick={() => setActiveSubTab("svinya")}
              className={`px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "svinya" 
                  ? "bg-pink-950/40 text-pink-400 font-bold border-pink-900" 
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <PiggyBank className="w-3.5 h-3.5" />
              Свинья (Карты)
            </button>
          )}
        </div>
      </div>

      {/* Alert Banner System */}
      <AnimatePresence>
        {pdaAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`absolute top-16 left-4 right-4 z-50 p-3 rounded font-mono text-xs text-center border shadow-xl ${
              pdaAlert.type === "danger" 
                ? "bg-red-950/90 text-red-400 border-red-800" 
                : pdaAlert.type === "success"
                ? "bg-emerald-950/90 text-emerald-400 border-emerald-800"
                : "bg-blue-950/90 text-blue-400 border-blue-800"
            }`}
          >
            {pdaAlert.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-900/50">
        
        {/* =============== 1. TRADES TAB =============== */}
        {activeSubTab === "trades" && (
          !tavernSettings.enabledGames.trades && !isGM ? (
            <div className="text-center py-16 bg-gray-950/40 rounded border border-dashed border-red-900/40 p-8">
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
              <h3 className="text-red-400 font-bold uppercase font-mono tracking-wider text-sm">Скупка у {tavernSettings.merchantName || "Сидоровича"} приостановлена</h3>
              <p className="text-gray-400 text-xs mt-2 font-mono max-w-sm mx-auto leading-relaxed">
                Торговая лавка скупщика {tavernSettings.merchantName || "Сидоровича"} временно закрыта куратором бара. Передача хабара недоступна.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {!tavernSettings.enabledGames.trades && (
                <div className="bg-red-950/40 border border-red-900 text-red-400 text-[11px] font-mono px-3 py-2 rounded text-center uppercase font-bold tracking-wider animate-pulse">
                  ВНИМАНИЕ КУРАТОРА: Торговля временно ОТКЛЮЧЕНА для сталкеров!
                </div>
              )}
              <div className="bg-gray-950 ring-1 ring-gray-850 rounded p-4 flex flex-col md:flex-row gap-6 items-center">
              <div className="w-16 h-16 bg-amber-950/40 border border-amber-900 text-amber-500 text-2xl flex items-center justify-center rounded-full shrink-0">
                <ShoppingBag />
              </div>
              <div className="text-center md:text-left flex-1">
                <h3 className="font-bold text-amber-500 uppercase tracking-wider text-sm font-mono flex items-center justify-center md:justify-start gap-2">
                  <span>Торговая лавка {tavernSettings.merchantName || "Сидоровича"}</span>
                  <span className="text-[10px] text-gray-500 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded uppercase font-bold tracking-widest font-mono">Барахолка</span>
                </h3>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Принесли ценный хабар с Зоны? Сдайте его торговцу {tavernSettings.merchantName || "Сидоровичу"}. Артефакты ценятся дорого (600-1000+ кредитов), запчасти и консервы - подешевле. Заработанные кредиты можно потратить прямо тут на покупку снаряжения, которое зачислится прямо в текущую Экспедицию!
                </p>
              </div>
              <div className="bg-amber-950/30 border border-amber-900/50 p-2.5 rounded text-center shrink-0 min-w-[130px]">
                <div className="text-[10px] font-mono text-amber-500/80 uppercase font-semibold">Ваш счет PDA</div>
                <div className="text-sm font-mono font-black text-amber-400 mt-0.5">{formatCredits(playerProfile.balance || 0)}</div>
              </div>
            </div>

            {/* Grid layout for Inventory (Left-ish) & Shop Catalogue (Right-ish) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column: Sell Items (Group pack) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-1.5 border-b border-gray-800">
                  <h4 className="font-bold font-mono text-xs text-gray-300 uppercase tracking-widest"><Briefcase className='w-3.5 h-3.5 inline mr-1 text-gray-300' /> Рюкзак Отряда (Продажа хабара)</h4>
                  <span className="text-[10px] font-mono text-gray-500 bg-gray-950 px-2 py-0.5 rounded border border-gray-850">
                    Всего: {gameMap?.inventory?.length || 0} шт.
                  </span>
                </div>

                {!gameMap || !gameMap.inventory || gameMap.inventory.length === 0 ? (
                  <div className="border border-dashed border-gray-800/80 rounded p-6 text-center text-gray-500 text-xs font-mono bg-gray-950/30">
                    Рюкзак отряда пока пуст. Спланируйте Экспедицию, обыскивайте зараженные аномальные схроны <Package className='w-3.5 h-3.5 inline text-gray-400 mx-0.5' /> или собирайте артефакты <Gem className='w-3.5 h-3.5 inline text-cyan-400 mx-0.5' /> на карте, затем заглядывайте сюда!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {gameMap.inventory.map((item: string, idx: number) => {
                      const isArt = ["Капля", "Кровь камня", "Слизь", "Колючка", "Медуза", "Вспышка", "Кристалл", "Бенгальский", "Светоч"].some(art => item.includes(art));
                      return (
                        <div
                          key={idx}
                          className="p-3 bg-gray-950 rounded border border-gray-850 flex items-center justify-between hover:border-gray-800 transition"
                        >
                          <div className="flex gap-2.5 items-center">
                            <span className={`text-base p-1 rounded ${isArt ? "bg-cyan-950/50 text-cyan-400 border border-cyan-900" : "bg-gray-900 text-gray-400 border border-gray-800"}`}>
                              {isArt ? <Gem className='w-4 h-4 text-cyan-400' /> : <Package className='w-4 h-4 text-gray-400' />}
                            </span>
                            <div>
                              <div className={`text-xs font-mono font-bold ${isArt ? "text-cyan-400" : "text-gray-300"}`}>{item}</div>
                              <div className="text-[9px] text-gray-555 font-mono">
                                Оценка скупщика: {isArt ? "~600-1000 кр." : "~150-250 кр."}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSellItem(idx)}
                            className="bg-amber-600/20 hover:bg-amber-500 text-amber-400 hover:text-gray-950 border border-amber-900 hover:border-amber-500 text-[10px] font-mono font-bold px-3 py-1.5 rounded uppercase cursor-pointer transition-all"
                          >
                            Сдать
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Dynamic Shop Catalogue */}
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-1.5 border-b border-gray-800">
                  <h4 className="font-bold font-mono text-xs text-amber-400 uppercase tracking-widest"><Store className='w-3.5 h-3.5 inline mr-1 text-amber-400' /> Ассортимент Прилавка (Покупка снаряжения)</h4>
                  <span className="text-[10px] font-mono text-gray-500 bg-gray-950 px-2 py-0.5 rounded border border-gray-850">
                    Активно: {shopItems.length} поз.
                  </span>
                </div>

                {shopItems.length === 0 ? (
                  <div className="border border-dashed border-amber-900/45 rounded p-6 text-center text-gray-500 text-xs font-mono bg-gray-950/20">
                    На прилавке торговца кончились запасы товаров на продажу. Попросите куратора добавить предметов!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {shopItems.map((item: any) => {
                      const canAfford = playerProfile.balance >= item.price;
                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-gray-950 rounded border border-gray-850 flex items-center justify-between gap-3 hover:border-amber-950 transition"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-gray-200 truncate">{item.name}</span>
                              <span className="text-[8px] font-mono px-1.5 py-0.5 bg-gray-900 text-gray-400 rounded uppercase border border-gray-800">
                                {item.type === "weapon" ? "Оружие" :
                                 item.type === "ammo" ? "Патроны" :
                                 item.type === "med" ? "Медикаменты" :
                                 item.type === "armor" ? "Броня" :
                                 item.type === "art" ? "Артефакт" : "Разное"}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-450 font-mono mt-0.5 truncate leading-tight">
                              {item.description || "Заказ со складов зоны."}
                            </p>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-2.5">
                            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-900/60 shrink-0">
                              {formatCredits(item.price)}
                            </span>
                            <button
                              onClick={() => {
                                if (ws) {
                                  ws.send(JSON.stringify({
                                    type: "BUY_SHOP_ITEM",
                                    payload: { playerId: userId, username, itemId: item.id }
                                  }));
                                }
                              }}
                              disabled={!canAfford}
                              className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded uppercase cursor-pointer transition-all border ${
                                canAfford
                                  ? "bg-emerald-600 hover:bg-emerald-500 text-gray-950 border-emerald-500"
                                  : "bg-gray-900 text-gray-600 border-gray-850 cursor-not-allowed opacity-50"
                              }`}
                            >
                              Купить
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* CURATOR GM ADMINISTRATION PANELS BLOCK (Visible only if isGM is true) */}
            {false && (
              <div className="mt-8 border-t border-gray-850 pt-8 space-y-6">
                <div className="bg-amber-950/15 border border-amber-900/60 rounded p-4">
                  <div className="flex items-center gap-2 pb-1 text-sm font-bold font-mono text-amber-500 uppercase tracking-wider">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    <div className="flex items-center gap-1.5">
                      <Settings className="w-4 h-4" />
                      <span>АДМИН-ПАНЕЛЬ КУРАТОРА: База Сталкеров & Торговля</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs font-mono">
                    Вы авторизованы как куратор (GM). Ниже вам доступно прямое управление заведением, ручной ввод или генерация названий, переключение режима доступности мини-игр и выдача снаряжения.
                  </p>
                </div>

                {/* Tavern name edit & Game toggles */}
                <div className="bg-gray-950 p-5 rounded border border-gray-850 space-y-5">
                  <div className="text-amber-500 font-bold font-mono text-xs uppercase pb-1.5 border-b border-gray-800 flex items-center justify-between">
                    <span><Settings className="w-4 h-4 text-amber-500 inline mr-1" /> ПАРАМЕТРЫ ЛОКАЦИИ & ДОСТУПНОСТЬ МИНИ-ИГР ЗОНЫ</span>
                    <span className="text-[9px] text-gray-550 border border-gray-800 px-2 py-0.5 rounded font-bold">GM CONTROL PANEL</span>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs font-mono">
                    {/* Left Column: Tavern & Merchant customizer */}
                    <div className="space-y-4 border-r border-gray-905 lg:pr-6">
                      
                      {/* Tavern name input */}
                      <div className="space-y-1.5">
                        <label className="block text-gray-400 font-bold uppercase text-[10px] tracking-wider"><Store className='w-3.5 h-3.5 inline mr-1 text-amber-500' /> НАЗВАНИЕ БАРА/ТАВЕРНЫ:</label>
                        <input
                          type="text"
                          value={gmTavernNameInput !== undefined ? gmTavernNameInput : tavernSettings.tavernName}
                          onChange={(e) => setGmTavernNameInput(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-bold font-mono text-gray-200 outline-none focus:border-amber-900 focus:ring-1 focus:ring-amber-900/30"
                          placeholder="Наберите название бара..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const name = gmTavernNameInput !== undefined ? gmTavernNameInput : tavernSettings.tavernName;
                              if (ws) {
                                ws.send(JSON.stringify({
                                  type: "GM_UPDATE_TAVERN_SETTINGS",
                                  payload: { tavernName: name }
                                }));
                                setPdaAlert({ text: "Название локации успешно узаконено!", type: "success" });
                                setTimeout(() => setPdaAlert(null), 2500);
                              }
                            }}
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold py-1.5 px-2 rounded uppercase text-[10px] cursor-pointer transition-all active:scale-95"
                          >
                            Применить
                          </button>
                          <button
                            onClick={() => {
                              const T_NAMES = [
                                "Бар «100 Рентген»",
                                "Приют Сталкера",
                                "Кабак «Шестерёнка»",
                                "База куратора «Холодный Болт»",
                                "Гремучий Кисель",
                                "Аномальный Погреб",
                                "Пьяный Контроллёр",
                                "Зелёный Дракон",
                                "У Борова",
                                "Мёртвый Головастик",
                                "Кордонский подвал",
                                "Пересыльный Пункт Группировок",
                                "Форпост Долга",
                                "Станция Янов",
                                "Бар «Штиль»"
                              ];
                              const currentVal = gmTavernNameInput !== undefined ? gmTavernNameInput : tavernSettings.tavernName;
                              const filtered = T_NAMES.filter(n => n !== currentVal);
                              const randomName = filtered[Math.floor(Math.random() * filtered.length)] || T_NAMES[0];
                              setGmTavernNameInput(randomName);
                              if (ws) {
                                ws.send(JSON.stringify({
                                  type: "GM_UPDATE_TAVERN_SETTINGS",
                                  payload: { tavernName: randomName }
                                }));
                                setPdaAlert({ text: `Сгенерировано: ${randomName}`, type: "info" });
                                setTimeout(() => setPdaAlert(null), 2500);
                              }
                            }}
                            className="bg-gray-800 hover:bg-gray-750 text-gray-300 font-bold py-1.5 px-3 rounded uppercase text-[10px] cursor-pointer transition-all border border-gray-700 hover:border-gray-600"
                          >
                            <Dices className='w-3.5 h-3.5 inline mr-1 text-sky-400' /> Случайно
                          </button>
                        </div>
                      </div>

                      {/* Merchant name input */}
                      <div className="space-y-1.5">
                        <label className="block text-gray-400 font-bold uppercase text-[10px] tracking-wider"><User className='w-3.5 h-3.5 inline mr-1 text-amber-500' /> ИМЯ СКУПЩИКА-ТОРГОВЦА:</label>
                        <input
                          type="text"
                          value={gmMerchantNameInput !== undefined ? gmMerchantNameInput : tavernSettings.merchantName}
                          onChange={(e) => setGmMerchantNameInput(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-bold font-mono text-gray-200 outline-none focus:border-amber-900 focus:ring-1 focus:ring-amber-900/30"
                          placeholder="Пример: Сидорович, Сыч, Боров..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const name = gmMerchantNameInput !== undefined ? gmMerchantNameInput : tavernSettings.merchantName;
                              if (ws) {
                                ws.send(JSON.stringify({
                                  type: "GM_UPDATE_TAVERN_SETTINGS",
                                  payload: { merchantName: name }
                                }));
                                setPdaAlert({ text: `Скупщик переименован в "${name}"!`, type: "success" });
                                setTimeout(() => setPdaAlert(null), 2500);
                              }
                            }}
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold py-1.5 px-2 rounded uppercase text-[10px] cursor-pointer transition-all active:scale-95"
                          >
                            Применить
                          </button>
                          <button
                            onClick={() => {
                              const M_NAMES = [
                                "Сидорович",
                                "Сыч",
                                "Бармен",
                                "Боров",
                                "Зулус",
                                "Гавайец",
                                "Сахаров",
                                "Ашот",
                                "Каланча",
                                "Торговец Митяй",
                                "Дядько Яр",
                                "Косой",
                                "Шустрый",
                                "Суслов",
                                "Лёлик Панадол"
                              ];
                              const currentVal = gmMerchantNameInput !== undefined ? gmMerchantNameInput : tavernSettings.merchantName;
                              const filtered = M_NAMES.filter(n => n !== currentVal);
                              const randomMerchant = filtered[Math.floor(Math.random() * filtered.length)] || M_NAMES[0];
                              setGmMerchantNameInput(randomMerchant);
                              if (ws) {
                                ws.send(JSON.stringify({
                                  type: "GM_UPDATE_TAVERN_SETTINGS",
                                  payload: { merchantName: randomMerchant }
                                }));
                                setPdaAlert({ text: `Сгенерирован торговец: ${randomMerchant}`, type: "info" });
                                setTimeout(() => setPdaAlert(null), 2500);
                              }
                            }}
                            className="bg-gray-800 hover:bg-gray-750 text-gray-300 font-bold py-1.5 px-3 rounded uppercase text-[10px] cursor-pointer transition-all border border-gray-700 hover:border-gray-600"
                          >
                            <Dices className='w-3.5 h-3.5 inline mr-1 text-sky-400' /> Случайно
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* Right Columns: Game Toggles (Trades, Pazaak, Dice, Races, Slots, Roulette, Shooting, Thimblerig, Svinya) */}
                    <div className="lg:col-span-2 space-y-2">
                      <label className="block text-gray-400 font-bold text-[10px] uppercase tracking-wider"><Lock className='w-3.5 h-3.5 inline mr-1 text-sky-400' /> ПЛАШКА МИНИ-ИГР (Заблок. / Разблок. в КПК Сталкеров):</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { key: "trades", label: "Скупка & Торговля" },
                          { key: "pazaak", label: "Паазак" },
                          { key: "dice", label: "Кости" },
                          { key: "races", label: "Тараканьи Скачки" },
                          { key: "slots", label: "Слот-Машина" },
                          { key: "roulette", label: "Рулетка Зоны" },
                          { key: "shooting", label: "Кустарный Тир" },
                          { key: "thimblerig", label: "Напёрстки" },
                          { key: "svinya", label: "Игра «Свинья»" }
                        ].map((itm) => {
                          const isEnabled = tavernSettings.enabledGames[itm.key as keyof typeof tavernSettings.enabledGames];
                          return (
                            <button
                              key={itm.key}
                              onClick={() => {
                                const newGames = { ...tavernSettings.enabledGames, [itm.key]: !isEnabled };
                                if (ws) {
                                  ws.send(JSON.stringify({
                                    type: "GM_UPDATE_TAVERN_SETTINGS",
                                    payload: { enabledGames: newGames }
                                  }));
                                  setPdaAlert({ text: `Режим "${itm.label}" ${!isEnabled ? "РАЗЛОЧЕН" : "ЗАБЛОКИРОВАН"} для сталкеров`, type: "info" });
                                  setTimeout(() => setPdaAlert(null), 2500);
                                }
                              }}
                              className={`py-2 px-2.5 rounded border text-[11px] uppercase font-bold text-center transition-all cursor-pointer ${
                                isEnabled
                                  ? "bg-emerald-950/40 border-emerald-500/80 text-emerald-400 hover:bg-emerald-900/30"
                                  : "bg-red-950/30 border-red-900/80 text-red-400 hover:bg-red-900/20 line-through"
                              }`}
                            >
                              {itm.label}: {isEnabled ? "ОТКРЫТО" : "ЗАКРЫТО"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* GM Column 1: Flea Market Catalogue Manager */}
                  <div className="bg-gray-950 p-4 rounded border border-gray-800 space-y-4">
                    <h5 className="font-bold font-mono text-xs text-amber-500 uppercase pb-1 border-b border-gray-850 flex items-center justify-between">
                      <span><Wrench className="w-4 h-4 inline-block mr-1" /> Ассортимент товаров у {tavernSettings.merchantName || "Сидоровича"}</span>
                      <span className="text-[9px] text-gray-500">БД ТОРГОВЛИ</span>
                    </h5>
                    
                    <div className="space-y-2.5 text-xs font-mono">
                      <div>
                        <label className="block text-gray-400 mb-1">Название предмета:</label>
                        <input
                          type="text"
                          placeholder="Пример: Экзоскелет Монолита, Аптечка научная"
                          value={gmItemName}
                          onChange={(e) => setGmItemName(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-mono text-gray-200 outline-none focus:border-amber-900"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-gray-400 mb-1">Цена (в кр.):</label>
                          <input
                            type="number"
                            placeholder="150"
                            value={gmItemPrice}
                            onChange={(e) => setGmItemPrice(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-mono text-gray-200 outline-none focus:border-amber-900"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">Категория:</label>
                          <select
                            value={gmItemType}
                            onChange={(e: any) => setGmItemType(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-mono text-gray-205 outline-none focus:border-amber-900"
                          >
                            <option value="misc">Разное</option>
                            <option value="weapon">Оружие</option>
                            <option value="ammo">Боеприпасы</option>
                            <option value="med">Медикаменты</option>
                            <option value="armor">Защита/Броня</option>
                            <option value="art">Артефакт</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-gray-400 mb-1">Описание/Эффект:</label>
                        <input
                          type="text"
                          placeholder="Защищает от пси-излучения, +50 ОЗ"
                          value={gmItemDesc}
                          onChange={(e) => setGmItemDesc(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-mono text-gray-200 outline-none focus:border-amber-900"
                        />
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => {
                            if (!gmItemName.trim()) {
                              setPdaAlert({ text: "Введите название предмета!", type: "danger" });
                              setTimeout(() => setPdaAlert(null), 2500);
                              return;
                            }
                            if (ws) {
                              ws.send(JSON.stringify({
                                type: "GM_ADD_SHOP_ITEM",
                                payload: {
                                  name: gmItemName.trim(),
                                  price: parseInt(gmItemPrice, 10) || 100,
                                  type: gmItemType,
                                  description: gmItemDesc.trim()
                                }
                              }));
                              setGmItemName("");
                              setGmItemDesc("");
                            }
                          }}
                          className="flex-1 bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold py-2.5 rounded uppercase tracking-wider cursor-pointer"
                        >
                          <Plus className='w-3.5 h-3.5 inline mr-1 text-gray-950 stroke-[3]' /> Добавить на прилавок
                        </button>
                        
                        <button
                          onClick={() => {
                            if (!gmItemName.trim()) {
                              setPdaAlert({ text: "Введите название для вброса в рюкзак отряда!", type: "danger" });
                              setTimeout(() => setPdaAlert(null), 2500);
                              return;
                            }
                            if (ws) {
                              ws.send(JSON.stringify({
                                type: "GM_ADD_TO_INVENTORY",
                                payload: { itemName: gmItemName.trim() }
                              }));
                            }
                          }}
                          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded font-bold uppercase cursor-pointer"
                          title="Выдать сразу в походный рюкзак отряда"
                        >
                          В рюкзак <Briefcase className='w-3.5 h-3.5 inline ml-1 text-gray-400' />
                        </button>
                      </div>
                    </div>

                    {/* Catalogue deleter list display */}
                    <div className="space-y-1.5 pt-3 border-t border-gray-850">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Текущие товары на удаление:</div>
                      <div className="space-y-1 max-h-[140px] overflow-y-auto bg-gray-900/50 p-2 rounded border border-gray-850">
                        {shopItems.map((item: any) => (
                          <div key={item.id} className="flex justify-between items-center bg-gray-950 px-2 py-1.5 rounded border border-gray-900 text-[11px] font-mono text-gray-300">
                            <div>
                              <span className="font-bold">{item.name}</span> • <span className="text-amber-500">{formatCredits(item.price)}</span>
                            </div>
                            <button
                              onClick={() => {
                                if (ws) {
                                  ws.send(JSON.stringify({
                                    type: "GM_DELETE_SHOP_ITEM",
                                    payload: { itemId: item.id }
                                  }));
                                }
                              }}
                              className="text-red-400 hover:text-red-500 cursor-pointer p-0.5"
                              title="Удалить товар навсегда"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* GM Column 2: Total Player Database Control */}
                  <div className="bg-gray-950 p-4 rounded border border-gray-800 space-y-4">
                    <h5 className="font-bold font-mono text-xs text-amber-500 uppercase pb-1 border-b border-gray-850">
                      Профайлы & База Данных КПК Сталкеров
                    </h5>

                    <div className="space-y-3.5 text-xs font-mono">
                      <div>
                        <label className="block text-gray-400 mb-1">Выберите Сталкера для редактирования:</label>
                        <select
                          value={gmSelectedPlayerId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGmSelectedPlayerId(val);
                            if (playerDb[val] && playerDb[val].balance !== undefined && playerDb[val].balance !== null) {
                              setGmPlayerBalanceInput(playerDb[val].balance.toString());
                            } else {
                              setGmPlayerBalanceInput("0");
                            }
                          }}
                          className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-xs font-mono text-amber-400 font-bold outline-none focus:border-amber-900"
                        >
                          <option value="">-- Выберите игрока --</option>
                          {Object.keys(playerDb).map((pId) => (
                            <option key={pId} value={pId}>
                              {playerDb[pId]?.userName || pId} (Баланс: {formatCredits(playerDb[pId]?.balance || 0)})
                            </option>
                          ))}
                        </select>
                      </div>

                      {gmSelectedPlayerId && playerDb[gmSelectedPlayerId] && (
                        <div className="space-y-3.5 bg-gray-900/60 p-3 rounded border border-gray-850">
                          
                          {/* Part A: Set absolute balance */}
                          <div className="grid grid-cols-3 gap-2 items-end">
                            <div className="col-span-2">
                              <label className="block text-gray-550 mb-1 text-[10px]">Баланс на счете (в кредитах):</label>
                              <input
                                type="number"
                                value={gmPlayerBalanceInput}
                                onChange={(e) => setGmPlayerBalanceInput(e.target.value)}
                                className="w-full bg-gray-950 border border-gray-800 rounded p-1.5 text-xs text-amber-400 font-mono font-bold"
                              />
                            </div>
                            <button
                              onClick={() => {
                                if (ws && gmSelectedPlayerId) {
                                  ws.send(JSON.stringify({
                                    type: "GM_SET_PLAYER_BALANCE",
                                    payload: { targetPlayerId: gmSelectedPlayerId, balance: gmPlayerBalanceInput }
                                  }));
                                  setPdaAlert({ text: `Баланс игрока изменен на ${formatCredits(parseInt(gmPlayerBalanceInput) || 0)}`, type: "success" });
                                  setTimeout(() => setPdaAlert(null), 2500);
                                }
                              }}
                              className="bg-amber-600 hover:bg-amber-500 text-gray-950 py-1.5 font-bold rounded text-[11px] cursor-pointer"
                            >
                              Применить
                            </button>
                          </div>

                          {/* Part B: Unlock Pazaak premium modifier cards */}
                          <div className="grid grid-cols-3 gap-2 items-end">
                            <div className="col-span-2">
                              <label className="block text-gray-550 mb-1 text-[10px]">Выдать карту Паазака:</label>
                              <select
                                value={gmPlayerCardToUnlock}
                                onChange={(e) => setGmPlayerCardToUnlock(e.target.value)}
                                className="w-full bg-gray-950 border border-gray-800 rounded p-1.5 text-[11px] font-mono text-purple-300"
                              >
                                <option value="">-- Выберите карту --</option>
                                <option value="+/-1">+/-1 (Флип)</option>
                                <option value="+/-2">+/-2 (Флип)</option>
                                <option value="+/-3">+/-3 (Флип)</option>
                                <option value="+/-4">+/-4 (Флип)</option>
                                <option value="+/-5">+/-5 (Флип)</option>
                                <option value="+/-6">+/-6 (Флип)</option>
                                <option value="D">D (Double - Удвоение)</option>
                                <option value="T">T (Tie breaker - Ничья)</option>
                                <option value="3 & 6">3 & 6 (Смена знаков 3/6)</option>
                                <option value="2 & 4">2 & 4 (Смена знаков 2/4)</option>
                              </select>
                            </div>
                            <button
                              onClick={() => {
                                if (!gmPlayerCardToUnlock) {
                                  setPdaAlert({ text: "Выберите карту для разблокировки!", type: "info" });
                                  setTimeout(() => setPdaAlert(null), 2500);
                                  return;
                                }
                                if (ws && gmSelectedPlayerId) {
                                  ws.send(JSON.stringify({
                                    type: "GM_UNLOCK_PLAYER_CARDS",
                                    payload: { targetPlayerId: gmSelectedPlayerId, card: gmPlayerCardToUnlock }
                                  }));
                                  setPdaAlert({ text: `Игроку выдана карта [${gmPlayerCardToUnlock}]!`, type: "success" });
                                  setTimeout(() => setPdaAlert(null), 2500);
                                }
                              }}
                              className="bg-purple-900 hover:bg-purple-700 text-purple-100 py-1.5 font-bold rounded text-[11px] border border-purple-700 cursor-pointer"
                            >
                              Выдать
                            </button>
                          </div>

                          {/* Profile Reset action */}
                          <div className="pt-2 border-t border-gray-800">
                            <button
                              onClick={() => {
                                if (confirm("Вы на сто процентов уверены? Будет сброшен баланс до 1000 и дефолтный набор карт!") && ws && gmSelectedPlayerId) {
                                  ws.send(JSON.stringify({
                                    type: "GM_RESET_PLAYER_PROFILE",
                                    payload: { targetPlayerId: gmSelectedPlayerId }
                                  }));
                                  setPdaAlert({ text: "Профиль игрока полностью сброшен!", type: "info" });
                                  setTimeout(() => setPdaAlert(null), 2500);
                                }
                              }}
                              className="w-full bg-red-950 hover:bg-red-900 text-red-300 hover:text-white border border-red-900 py-2 rounded text-center font-bold text-[10px] uppercase tracking-wider cursor-pointer transition-colors"
                            >
                              <CustomWarning />️ Полный Сброс Профиля Сталкера
                            </button>
                          </div>

                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
          )
        )}

        {/* =============== 2. PAZAAK TAB =============== */}
        {activeSubTab === "pazaak" && (
          !tavernSettings.enabledGames.pazaak && !isGM ? (
            <div className="text-center py-16 bg-gray-950/40 rounded border border-dashed border-red-900/40 p-8">
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
              <h3 className="text-red-400 font-bold uppercase font-mono tracking-wider text-sm">Паазак столы временно закрыты</h3>
              <p className="text-gray-400 text-xs mt-2 font-mono max-w-sm mx-auto leading-relaxed">
                Карточные столы по Паазаку временно закрыты куратором бара. Дуэли и сборы колод недоступны.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {!tavernSettings.enabledGames.pazaak && (
                <div className="bg-red-950/40 border border-red-900 text-red-400 text-[11px] font-mono px-3 py-2 rounded text-center uppercase font-bold tracking-wider animate-pulse">
                  ВНИМАНИЕ КУРАТОРА: Паазак временно ОТКЛЮЧЕН для сталкеров!
                </div>
              )}
            
            {/* Active Pazaak Match Renders Overlay */}
            {userActiveLobby ? (
              <div className="bg-gray-950 ring-2 ring-emerald-500/50 rounded-lg p-4 md:p-6 space-y-6">
                
                {/* Board metrics */}
                <div className="flex justify-between items-center bg-gray-900 p-3 rounded border border-gray-800 font-mono text-xs">
                  <div>
                    <span className="text-gray-500">Дуэль:</span> <span className="text-emerald-400 font-bold">{userActiveLobby.creatorName}</span> против <span className="text-emerald-400 font-bold">{userActiveLobby.opponentName || "Ожидание..."}</span>
                  </div>
                  <div className="text-emerald-400 bg-emerald-950/40 rounded px-2.5 py-1 border border-emerald-900/40 font-bold animate-pulse">
                    СТАВКА: {formatCredits(userActiveLobby.bet)}
                  </div>
                </div>

                {/* Score panel boards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Creator Board (Side A) */}
                  <div className={`p-4 bg-gray-900 rounded border transition-colors ${userActiveLobby.turn === userActiveLobby.creatorId ? "border-emerald-500/80 bg-emerald-950/5" : "border-gray-800"}`}>
                    <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="text-emerald-400 w-4 h-4" />
                        <span className="text-gray-200 text-xs font-bold leading-none">{userActiveLobby.creatorName}</span>
                      </div>
                      <div className="flex gap-2">
                        {Array.from({ length: 3 }).map((_, rIdx) => (
                          <span 
                            key={rIdx} 
                            className={`w-3 h-3 rounded-full border ${rIdx < userActiveLobby.roundsWonA ? "bg-emerald-400 border-emerald-400 shadow-md shadow-emerald-900" : "bg-transparent border-gray-600"}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Cards grid on board */}
                    <div className="grid grid-cols-3 gap-2 min-h-24">
                      {userActiveLobby.playerABoard.map((card: any, cIdx: number) => {
                        if (card === "T") return null;
                        const isPlayed = card <= 0 || cIdx > 0; // blue index cards are draws (1-10)
                        return (
                          <div
                            key={cIdx}
                            className={`p-2 rounded text-center font-mono font-bold aspect-square flex flex-col items-center justify-center text-sm border ${
                              card > 10 || card < 0
                                ? "bg-purple-950 text-purple-300 border-purple-800"
                                : "bg-emerald-950 text-emerald-300 border-emerald-800"
                            }`}
                          >
                            <span className="text-[10px] text-gray-500 block leading-tight">№{cIdx+1}</span>
                            <span className="text-lg">{card > 0 ? `+${card}` : card}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-xs text-gray-400 font-mono">Общий счет:</span>
                      <span className={`font-mono text-2xl font-bold ${userActiveLobby.playerAScore > 21 ? "text-red-500 line-through" : "text-emerald-400"}`}>
                        {userActiveLobby.playerAScore} / 20
                      </span>
                    </div>
                    {userActiveLobby.playerAStand && (
                      <div className="mt-2 text-center text-[10px] font-mono font-bold uppercase bg-amber-950/50 text-amber-400 py-1 rounded border border-amber-900/30">
                        STAND (ФИКСАЦИЯ СЧЕТА)
                      </div>
                    )}
                  </div>

                  {/* Opponent Board (Side B) */}
                  <div className={`p-4 bg-gray-900 rounded border transition-colors ${userActiveLobby.turn === userActiveLobby.opponentId ? "border-emerald-500/80 bg-emerald-950/5" : "border-gray-800"}`}>
                    <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="text-emerald-400 w-4 h-4" />
                        <span className="text-gray-200 text-xs font-bold leading-none">{userActiveLobby.opponentName || "Ожидание..."}</span>
                      </div>
                      <div className="flex gap-2">
                        {Array.from({ length: 3 }).map((_, rIdx) => (
                          <span 
                            key={rIdx} 
                            className={`w-3 h-3 rounded-full border ${rIdx < userActiveLobby.roundsWonB ? "bg-emerald-400 border-emerald-400 shadow-md shadow-emerald-900" : "bg-transparent border-gray-600"}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Cards grid on board B */}
                    <div className="grid grid-cols-3 gap-2 min-h-24">
                      {userActiveLobby.playerBBoard.map((card: any, cIdx: number) => {
                        if (card === "T") return null;
                        return (
                          <div
                            key={cIdx}
                            className={`p-2 rounded text-center font-mono font-bold aspect-square flex flex-col items-center justify-center text-sm border ${
                              card > 10 || card < 0
                                ? "bg-purple-950 text-purple-300 border-purple-800"
                                : "bg-emerald-950 text-emerald-300 border-emerald-800"
                            }`}
                          >
                            <span className="text-[10px] text-gray-500 block leading-tight">№{cIdx+1}</span>
                            <span className="text-lg">{card > 0 ? `+${card}` : card}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-xs text-gray-400 font-mono">Общий счет:</span>
                      <span className={`font-mono text-2xl font-bold ${userActiveLobby.playerBScore > 21 ? "text-red-500 line-through" : "text-emerald-400"}`}>
                        {userActiveLobby.playerBScore} / 20
                      </span>
                    </div>
                    {userActiveLobby.playerBStand && (
                      <div className="mt-2 text-center text-[10px] font-mono font-bold uppercase bg-amber-950/50 text-amber-400 py-1 rounded border border-amber-900/30">
                        STAND (ФИКСАЦИЯ СЧЕТА)
                      </div>
                    )}
                  </div>

                </div>

                {/* Hand cards selection (The Side-Deck available) */}
                <div className="p-4 bg-gray-950 rounded border border-gray-800">
                  <h5 className="font-mono text-xs text-gray-400 uppercase tracking-widest mb-3">Ваша Рука Карты КПК (Раз в партию)</h5>
                  <div className="flex gap-2 flex-wrap">
                    {(() => {
                      const isA = userId === userActiveLobby.creatorId;
                      const hand = isA ? userActiveLobby.playerAHands : userActiveLobby.playerBHands;
                      const isMyTurn = userActiveLobby.turn === userId;
                      const stood = isA ? userActiveLobby.playerAStand : userActiveLobby.playerBStand;

                      return hand.map((card: string | null, cardIdx: number) => {
                        if (!card) {
                          return (
                            <div key={cardIdx} className="w-16 h-24 rounded border border-dashed border-gray-800 flex items-center justify-center bg-gray-900/20 text-xs text-gray-700 font-mono">
                              Использ.
                            </div>
                          );
                        }

                        // Determine sign options for dual cards
                        const isDual = card.startsWith("+/-");
                        const playable = isMyTurn && !stood;

                        return (
                          <div key={cardIdx} className="flex flex-col items-center gap-1.5">
                            <button
                              disabled={!playable}
                              onClick={() => {
                                if (isDual) {
                                  setDualSignTriggerCard({ idx: cardIdx, val: card });
                                } else {
                                  handlePazaakPlayCard(userActiveLobby.id, cardIdx);
                                }
                              }}
                              className={`w-16 h-24 rounded font-mono font-bold relative flex flex-col justify-between p-1.5 text-center text-xs transition border uppercase tracking-tighter ${
                                playable 
                                  ? "bg-purple-900 border-purple-500 text-purple-200 cursor-pointer shadow-md hover:bg-purple-800" 
                                  : "bg-gray-850 border-gray-800 text-gray-500 cursor-not-allowed"
                              }`}
                            >
                              <span className="text-[9px] text-purple-400 block tracking-tight leading-none">Pazaak</span>
                              <span className="text-sm font-extrabold my-2 leading-none block">{card}</span>
                              <span className="text-[8px] text-gray-400 block leading-none">Карта</span>
                            </button>

                            {/* Sign Selectors for dual card popup */}
                            {dualSignTriggerCard?.idx === cardIdx && (
                              <div className="flex gap-1 bg-gray-900 p-1.5 rounded border border-purple-800 absolute z-50 shadow-2xl mt-24">
                                <button
                                  onClick={() => handlePazaakPlayCard(userActiveLobby.id, cardIdx, false)}
                                  className="bg-emerald-800 hover:bg-emerald-700 text-emerald-100 rounded text-[10px] px-2 py-1 font-mono cursor-pointer"
                                >
                                  Плюс (+)
                                </button>
                                <button
                                  onClick={() => handlePazaakPlayCard(userActiveLobby.id, cardIdx, true)}
                                  className="bg-red-950 hover:bg-red-900 text-red-200 rounded text-[10px] px-2 py-1 font-mono cursor-pointer border border-red-800"
                                >
                                  Минус (-)
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Match logs and status text */}
                <div className="bg-gray-950 block p-3.5 rounded border border-gray-800 text-xs leading-relaxed max-h-32 overflow-y-auto">
                  <div className="font-mono text-emerald-400 font-bold border-b border-gray-800 pb-1 mb-2">
                    {userActiveLobby.statusMessage}
                  </div>
                  {userActiveLobby.log.slice().reverse().map((line: string, lIdx: number) => (
                    <div key={lIdx} className="font-mono text-[11px] text-gray-400">
                      • {line}
                    </div>
                  ))}
                </div>

                {/* Game control footer */}
                <div className="flex justify-between flex-wrap gap-2.5">
                  <button
                    onClick={() => handlePazaakConcede(userActiveLobby.id)}
                    className="bg-red-950/80 hover:bg-red-900 text-red-400 border border-red-800/50 px-4 py-2 text-xs font-mono font-bold rounded uppercase cursor-pointer"
                  >
                    Сдаться / Сбежать <Flag className='w-3.5 h-3.5 inline ml-1 text-red-400' />
                  </button>

                  {userActiveLobby.turn === userId && (
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => handlePazaakStand(userActiveLobby.id)}
                        className="bg-amber-600 hover:bg-amber-500 text-gray-950 px-5 py-2 text-xs font-mono font-bold rounded uppercase cursor-pointer shadow-md"
                      >
                        Зафиксировать (STAND)
                      </button>
                      <button
                        onClick={() => handlePazaakEndTurn(userActiveLobby.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-gray-950 px-5 py-2 text-xs font-mono font-bold rounded uppercase cursor-pointer shadow-md"
                      >
                        Завершить Ход (PASS) <ChevronRight className='w-3.5 h-3.5 inline ml-1 text-gray-950' />
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              // Create Game and Deck management Panels
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Match creation panel */}
                <div className="space-y-4">
                  <div className="bg-gray-950 p-4 rounded border border-gray-800 space-y-4">
                    <h4 className="font-bold text-emerald-500 text-sm font-mono uppercase tracking-wide flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      Развернуть стол Pazaak
                    </h4>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Паазак – легендарная карточная игра Зоны. Наберите сумму карт ближе к 20, но не выше 20. Преодоление 9 карт на столе без перебора гарантирует победу!
                    </p>

                    <div>
                      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Оппонент встречи</div>
                      <div className="flex gap-3 text-xs font-mono select-none">
                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                          <input
                            type="radio"
                            checked={pazaakBotSelected}
                            onChange={() => setPazaakBotSelected(true)}
                            className="text-emerald-500 bg-gray-950 border-gray-800"
                          />
                          Сыграть с Барменом (AI)
                        </label>
                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                          <input
                            type="radio"
                            checked={!pazaakBotSelected}
                            onChange={() => setPazaakBotSelected(false)}
                            className="text-emerald-500 bg-gray-950 border-gray-800"
                          />
                          Сетевая PvP-Дуэль
                        </label>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Размер Ставки встречи (в кредитах)</div>
                      <input
                        type="number"
                        min="50"
                        max="2000"
                        step="50"
                        value={pazaakBetAmount}
                        onChange={(e) => setPazaakBetAmount(Math.max(50, parseInt(e.target.value) || 50))}
                        className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs font-mono text-emerald-400 text-bold outline-none font-semibold focus:border-emerald-600"
                      />
                    </div>

                    <button
                      onClick={handleCreatePazaakMatch}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-gray-950 py-3 rounded text-xs font-mono tracking-wider font-extrabold transition-all uppercase cursor-pointer shadow flex items-center justify-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5 fill-gray-950 shrink-0" /> {pazaakBotSelected ? "Начать играть с ботом" : "Открыть PvP дуэль"}
                    </button>
                  </div>

                  {/* Active online matches listings */}
                  <div className="bg-gray-950 p-4 rounded border border-gray-800 space-y-3">
                    <h4 className="font-bold text-slate-300 text-xs font-mono uppercase tracking-widest leading-none">Открытые PvP столы в таверне</h4>
                    {Object.values(pazaakLobbies).filter((l: any) => l.status === "waiting").length === 0 ? (
                      <div className="text-center font-mono text-[11px] text-gray-500 py-6">
                        Нет активных столов PvP. Создайте свою PvP встречу выше и другие сталкеры в сети увидят её!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Object.values(pazaakLobbies)
                          .filter((l: any) => l.status === "waiting")
                          .map((lobby: any) => (
                            <div
                              key={lobby.id}
                              className="bg-gray-900 p-2.5 rounded border border-gray-800 flex justify-between items-center text-xs leading-none"
                            >
                              <div>
                                <div className="font-mono font-bold text-gray-200">Стол сталкера {lobby.creatorName}</div>
                                <div className="font-mono text-[10px] text-gray-550 mt-1">Лобби: {lobby.id}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-emerald-400 font-mono font-semibold">{formatCredits(lobby.bet)}</span>
                                <button
                                  onClick={() => handleJoinPazaakMatch(lobby.id)}
                                  className="bg-emerald-950/60 hover:bg-emerald-600 text-emerald-400 hover:text-emerald-950 border border-emerald-900 px-3 py-1.5 rounded font-mono text-[11px] cursor-pointer"
                                >
                                  Бросить вызов
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Deck Card customization panel */}
                <div className="bg-gray-950 p-4 rounded border border-gray-800 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-850">
                    <h4 className="font-bold text-purple-400 text-sm font-mono uppercase tracking-wide leading-none flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-400" />
                      Сборка Боковой Колоды
                    </h4>
                    <span className="font-mono text-xs text-gray-400 font-bold bg-purple-950/50 text-purple-300 border border-purple-900 px-2.5 py-1 rounded">
                      {selectedDeckCards.length} / 8 карт собрано
                    </span>
                  </div>

                  <p className="text-gray-400 text-xs leading-relaxed font-mono">
                    Вы должны выбрать ровно 8 карт из вашей коллекции в Сет-Панели ниже. Из них на игру вам будет тайно роздано 4 случайных карты в руку! Каждую из этих 4-х карт можно использовать лишь ОДИН раз за партию!
                  </p>

                  {/* Save configured deck */}
                  <button
                    disabled={selectedDeckCards.length !== 8}
                    onClick={handleSaveDeck}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-gray-950 py-2.5 rounded font-mono text-xs font-bold transition uppercase tracking-wider cursor-pointer disabled:opacity-40"
                  >
                    Сохранить сборку карт в КПК
                  </button>

                  <div className="border border-dashed border-gray-800 p-3 bg-gray-900/40 rounded">
                    <div className="text-[10px] text-purple-400 font-mono uppercase tracking-widest mb-2 font-bold select-none">
                      Приобрести Booster Pack за 300 кредитов
                    </div>
                    <p className="text-gray-450 text-[11px] leading-snug mb-3">
                      Покупайте случайные премиум модификаторы: флип-знаки `+/-2`, множители `D` (Double), победы на ничьей `T` или триггеры!
                    </p>
                    <button
                      disabled={playerProfile.balance < 300 || isOpeningBooster}
                      onClick={handleBuyBooster}
                      className="bg-purple-900/35 hover:bg-purple-600 text-purple-300 hover:text-purple-950 border border-purple-800 hover:border-purple-600 py-2 w-full text-xs font-mono font-bold uppercase cursor-pointer rounded transition-all"
                    >
                      {isOpeningBooster ? "Покупаем бустер..." : "Купить Booster (300 кредитов)"}
                    </button>

                    {/* Reveal opened booster cards with visual satisfaction */}
                    {boosterPulledCards && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-3 p-2 bg-purple-950/20 border border-purple-900/80 rounded"
                      >
                        <div className="text-[10px] text-purple-300 font-mono text-center font-bold mb-1.5 uppercase tracking-wider">Вы выбили из пака:</div>
                        <div className="flex gap-2 justify-center">
                          {boosterPulledCards.map((pCard, pIdx) => (
                            <span
                              key={pIdx}
                              className="bg-purple-900 border border-purple-600 text-white font-mono text-xs font-bold px-2 py-1 rounded inline-block shadow animate-bounce"
                            >
                              {pCard}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Fully displayed collection list */}
                  <div>
                    <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2 font-bold">Сумка Карточных Листов (Клик для выбора)</div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                      {playerProfile.unlockedCards.map((card: string, index: number) => {
                        const countInSelected = selectedDeckCards.filter(c => c === card).length;
                        const countTotalInUnlocked = playerProfile.unlockedCards.filter(c => c === card).length;
                        const isPicked = selectedDeckCards.includes(card);

                        return (
                          <button
                            key={index}
                            onClick={() => handleToggleCardSelection(card)}
                            className={`p-2 rounded font-mono font-extrabold text-xs aspect-square flex flex-col items-center justify-center border transition relative cursor-pointer ${
                              isPicked 
                                ? "bg-purple-900 border-purple-500 text-purple-100 shadow-md shadow-purple-950" 
                                : "bg-gray-900 border-gray-850 text-gray-400 hover:border-gray-700 hover:bg-gray-850"
                            }`}
                          >
                            <span className="text-[10px] leading-tight text-white">{card}</span>
                            {/* Marker badge */}
                            {isPicked && (
                              <span className="absolute -top-1 -right-1 bg-purple-500 text-purple-950 rounded-full w-4 h-4 flex items-center justify-center border border-purple-300"><UserCheck className="w-2.5 h-2.5 text-purple-950" /></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>
          )
        )}

        {/* =============== 3. DICE TAB =============== */}
        {activeSubTab === "dice" && (
          !tavernSettings.enabledGames.dice && !isGM ? (
            <div className="text-center py-16 bg-gray-950/40 rounded border border-dashed border-red-900/40 p-8">
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
              <h3 className="text-red-400 font-bold uppercase font-mono tracking-wider text-sm">Кости временно убраны</h3>
              <p className="text-gray-400 text-xs mt-2 font-mono max-w-sm mx-auto leading-relaxed">
                Покер на костях временно недоступен. Куратор бара закрыл столы с костями. Заходите позже!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start max-w-5xl mx-auto">
              <div className="lg:col-span-2 space-y-6">
                {!tavernSettings.enabledGames.dice && (
                  <div className="bg-red-950/40 border border-red-900 text-red-400 text-[11px] font-mono px-3 py-2 rounded text-center uppercase font-bold tracking-wider animate-pulse">
                    ВНИМАНИЕ КУРАТОРА: Покер на костях временно ОТКЛЮЧЕН для сталкеров!
                  </div>
                )}
              
                <div className="bg-gray-950 p-4 rounded border border-gray-800 space-y-3.5">
                  <h4 className="font-bold text-sky-400 text-sm font-mono uppercase tracking-wide flex items-center gap-2">
                    <Dice5 className="w-4 h-4" />
                    Сталкерский Покер на Костях
                  </h4>
                  <p className="text-gray-400 text-xs leading-relaxed font-mono">
                    Правила: Вы делаете ставку, система кидает 5 костей. Вы можете заблокировать (LOCK <Lock className='inline w-3 h-3 text-sky-400 mb-0.5' />) любые из понравившихся костей и сделать ОДИН переброс оставшихся. Бармен также бросает и блокирует кости на своей стороне. Побеждает старшая комбинация poker-рейтинга!
                  </p>

                  {!diceState.active ? (
                    // Setup Bet Panel
                    <div className="bg-gray-900 p-3 rounded border border-gray-850 space-y-4">
                      <div>
                        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Размер Ставки (в кредитах)</div>
                        <input
                          type="number"
                          min="50"
                          max="2000"
                          step="50"
                          value={diceBetInput}
                          onChange={(e) => setDiceBetInput(Math.max(50, parseInt(e.target.value) || 50))}
                          className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-xs font-mono text-sky-400 font-bold outline-none ring-slate-800 focus:border-sky-600 focus:ring-1"
                        />
                      </div>
                      <button
                        onClick={handlePlayDice}
                        className="w-full bg-sky-600 hover:bg-sky-500 text-gray-950 font-mono text-xs font-extrabold py-3.5 uppercase tracking-wider rounded cursor-pointer transition shadows"
                      >
                        <Dices className='w-4 h-4 inline mr-1 text-sky-400' /> Бросить Вызов Бармену (AI)
                      </button>
                    </div>
                  ) : (
                    // Active Dice Throw Table
                    <div className="space-y-6">
                      
                      {/* Bartender Bot Dice Panel */}
                      <div className="bg-gray-900 p-4 rounded border border-gray-850">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-800 mb-3 text-xs leading-none font-mono">
                          <span className="text-gray-400 font-bold uppercase font-mono tracking-wider">Кости Бармена:</span>
                          {diceState.botHand && (
                            <span className="text-rose-400 font-bold bg-rose-950/30 border border-rose-900 px-2 py-0.5 rounded text-[11px] uppercase">
                              {diceState.botHand.name}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-center gap-2.5">
                          {diceState.botDice.map((val, idx) => (
                            <div
                              key={idx}
                              className="w-12 h-12 rounded bg-gray-950 border border-gray-800 text-gray-400 flex items-center justify-center font-mono text-xl font-bold filter brightness-75 select-none"
                            >
                              {val}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Player Active Dice Panel */}
                      <div className="bg-gray-900 p-4 rounded border border-sky-900/50">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-gray-800 mb-3 text-xs leading-none font-mono gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 uppercase font-mono mr-1">Этап:</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diceState.rerollStep === 1 ? 'bg-sky-500 text-gray-950 font-extrabold' : 'bg-gray-950 text-gray-500 border border-gray-850'}`}>Бросок 1</span>
                            <span className="text-gray-600 text-[10px] sm:inline hidden">→</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diceState.rerollStep === 2 ? 'bg-sky-500 text-gray-950 font-extrabold' : 'bg-gray-950 text-gray-500 border border-gray-850'}`}>Бросок 2</span>
                            <span className="text-gray-600 text-[10px] sm:inline hidden">→</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diceState.rerollStep === 3 ? 'bg-indigo-950/40 text-emerald-400 border border-emerald-900/40 font-extrabold' : 'bg-gray-950 text-gray-500 border border-gray-850'}`}>Финал</span>
                          </div>
                          {diceState.playerHand && (
                            <span className="text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-900 px-2 py-0.5 rounded text-[11px] uppercase self-start sm:self-auto animate-pulse">
                              {diceState.playerHand.name}
                            </span>
                          )}
                        </div>

                        {/* Dices Selectable */}
                        <div className="flex justify-center gap-2.5 mb-4">
                          {diceState.playerDice.map((val, idx) => {
                            const isLocked = diceState.lockedIndexes[idx];
                            const clickEnabled = diceState.rerollStep === 1 || diceState.rerollStep === 2;

                            return (
                              <button
                                key={idx}
                                disabled={!clickEnabled}
                                onClick={() => handleToggleDiceLock(idx)}
                                className={`w-12 h-12 rounded font-sans text-xl font-extrabold flex flex-col items-center justify-center border relative transition cursor-pointer ${
                                  isLocked 
                                    ? "bg-sky-900 border-sky-400 text-sky-100 shadow" 
                                    : "bg-gray-950 border-gray-850 text-gray-300 hover:border-sky-850"
                                }`}
                              >
                                <span>{val}</span>
                                {/* Small padlock overlay indicators */}
                                {isLocked && (
                                  <span className="absolute -top-1 -right-1 bg-sky-500 rounded-full w-4.5 h-4.5 flex items-center justify-center border border-sky-400 text-gray-950 select-none font-bold"><Lock className="w-2.5 h-2.5 text-gray-950 stroke-[3]" /></span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {(diceState.rerollStep === 1 || diceState.rerollStep === 2) && (
                          <div className="text-center font-mono text-[10px] text-gray-400 mb-4 select-none uppercase tracking-wider">
                            Нажмите на кубики, которые хотите ОСТАВИТЬ (LOCK <Lock className='inline w-3 h-3 text-sky-400 mb-0.5' />), затем кликните переброс ниже!
                          </div>
                        )}

                        {/* Re-roll trigger */}
                        {(diceState.rerollStep === 1 || diceState.rerollStep === 2) ? (
                          <button
                            onClick={handleDiceReroll}
                            className="w-full bg-sky-600 hover:bg-sky-500 text-gray-950 font-mono text-xs font-bold py-2.5 uppercase tracking-wider rounded cursor-pointer animate-pulse"
                          >
                            <RefreshCw className="w-3.5 h-3.5 inline-block mr-1" /> СДЕЛАТЬ ПЕРЕБРОС КУБОВ (ХОД {diceState.rerollStep + 1} ИЗ 3)
                          </button>
                        ) : (
                          <div className="p-3.5 bg-gray-950 rounded border border-gray-800 font-mono text-center text-xs space-y-2 text-gray-200">
                            <div className="font-bold border-b border-gray-850 pb-1.5 text-sky-400">{diceState.message}</div>
                            <button
                              onClick={() => setDiceState(prev => ({ ...prev, active: false }))}
                              className="bg-gray-800 hover:bg-gray-750 text-gray-300 font-mono text-[11px] font-bold px-4 py-1.5 rounded uppercase cursor-pointer"
                            >
                              Сыграть Снова
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Cheat Sheet / Табель комбинаций */}
              <div className="bg-gray-950 p-4 rounded border border-gray-800 space-y-4 font-mono text-xs text-gray-300">
                <h5 className="font-bold text-sky-400 border-b border-gray-850 pb-2 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Award className='w-4 h-4 text-sky-400' /> ПОКЕРНЫЙ ТАБЕЛЬ РАНГОВ
                </h5>
                <p className="text-[10px] text-gray-500 leading-normal">
                  Покерные комбинации от сильнейшей к слабейшей. Сила руки рассчитывается автоматически по старшинству ранга, а при равных рангах — по весу.
                </p>
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {[
                    { rank: 8, name: "ПЯТЕРКА (ПОКЕР)", weight: "Вес: 5000+", desc: "Все 5 костей одинаковые", pattern: "5 • 5 • 5 • 5 • 5" },
                    { rank: 7, name: "КАРЕ", weight: "Вес: 4000+", desc: "4 кости одного номинала", pattern: "4 • 4 • 4 • 4 • ?" },
                    { rank: 6, name: "ФУЛЛ-ХАУС", weight: "Вес: 3000+", desc: "Три кости одного + пара другого", pattern: "3 • 3 • 3 • 6 • 6" },
                    { rank: 5, name: "СТРИТ", weight: "Вес: 2000+", desc: "Последовательная цепочка костей", pattern: "1-2-3-4-5 или 2-3-4-5-6" },
                    { rank: 4, name: "ТРОЙКА", weight: "Вес: 1000+", desc: "Три кости одинакового номинала", pattern: "2 • 2 • 2 • ? • ?" },
                    { rank: 3, name: "ДВЕ ПАРЫ", weight: "Вес: 500+", desc: "Два разных дуплета одинаковых", pattern: "5 • 5 • 1 • 1 • ?" },
                    { rank: 2, name: "ПАРА", weight: "Вес: 200+", desc: "Один дуплет одинаковых костей", pattern: "4 • 4 • ? • ? • ?" },
                    { rank: 1, name: "СТАРШАЯ КОСТЬ", weight: "Сумма костей", desc: "При отсутствии совпадений", pattern: "Суммарный номинал" }
                  ].map((comb) => (
                    <div key={comb.rank} className="p-2 bg-gray-900 border border-gray-850 rounded hover:border-sky-900/60 transition-colors col-span-1">
                      <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-sky-300">#{comb.rank} {comb.name}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">{comb.weight}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">{comb.desc}</div>
                      <div className="text-[9px] text-emerald-550 font-semibold tracking-wider bg-gray-950/80 px-1.5 py-0.5 rounded inline-block mt-1.5">
                        {comb.pattern}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )
        )}

        {/* =============== 4. RACES TAB =============== */}
        {activeSubTab === "races" && (
          !tavernSettings.enabledGames.races && !isGM ? (
            <div className="text-center py-16 bg-gray-950/40 rounded border border-dashed border-red-900/40 p-8">
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
              <h3 className="text-red-400 font-bold uppercase font-mono tracking-wider text-sm">Ипподром закрыт</h3>
              <p className="text-gray-400 text-xs mt-2 font-mono max-w-sm mx-auto leading-relaxed">
                Заезды тварей и тотализатор временно приостановлены куратором бара.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {!tavernSettings.enabledGames.races && (
                <div className="bg-red-950/40 border border-red-900 text-red-400 text-[11px] font-mono px-3 py-2 rounded text-center uppercase font-bold tracking-wider animate-pulse">
                  ВНИМАНИЕ КУРАТОРА: Тотализатор скачек временно ОТКЛЮЧЕН для сталкеров!
                </div>
              )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Racetrack Visual and Bet controls */}
              <div className="lg:col-span-2 bg-gray-950 p-4 rounded border border-gray-800 space-y-4">
                <div className="flex justify-between items-center border-b border-gray-850 pb-2">
                  <h4 className="font-bold text-yellow-500 text-sm font-mono uppercase tracking-wide flex items-center gap-2">
                    <Flame className="w-4 h-4 text-yellow-500" />
                    Подпольный Ипподром Зоны
                  </h4>
                  <div className="font-mono text-xs font-bold uppercase">
                    {activeRace.status === "none" && <span className="text-gray-550">Ожидание ставок</span>}
                    {activeRace.status === "betting" && <span className="text-emerald-400 animate-pulse">Прием Ставок Открыт</span>}
                    {activeRace.status === "running" && <span className="text-yellow-500 animate-pulse">ЗАБЕГ В РАЗГАРЕ</span>}
                    {activeRace.status === "finished" && <span className="text-purple-400">ГОНКА ЗАВЕРШЕНА</span>}
                  </div>
                </div>

                {/* Simulated Racetrack loops */}
                <div className="space-y-3.5 p-3.5 bg-gray-900 rounded border border-gray-850">
                  {activeRace.contestants.map((rider: any, idx: number) => {
                    const progress = rider.position || 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className={`font-bold ${rider.color}`}>{rider.name}</span>
                          <span className="text-gray-500 text-[10px]">Кэф {rider.odds}x • {rider.type}</span>
                        </div>
                        
                        {/* Track slot */}
                        <div className="w-full h-8 bg-gray-950 border border-gray-800 rounded relative overflow-hidden flex items-center px-2">
                          {/* Grid marker guides */}
                          <div className="absolute right-0 top-0 bottom-0 border-l border-red-800/80 w-1 bg-red-950/20 z-10" title="ФИНИШ" />
                          <div className="absolute left-1/4 top-0 bottom-0 border-l border-gray-900/60" />
                          <div className="absolute left-2/4 top-0 bottom-0 border-l border-gray-900/60" />
                          <div className="absolute left-3/4 top-0 bottom-0 border-l border-gray-900/60" />

                          {/* Runner entity container */}
                          <motion.div
                            animate={{ left: `${Math.min(93, progress)}%` }}
                            transition={{ type: "spring", stiffness: 80, damping: 12 }}
                            className="absolute bg-gray-900 border border-gray-850 px-2 py-0.5 rounded shadow z-20 text-xs font-mono font-bold flex items-center gap-1"
                          >
                            <CustomRun className='w-5 h-5 text-gray-400' />
                            {activeRace.winner === rider.name && <CustomCrown />}
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Betting dashboard form */}
                {activeRace.status !== "running" && (
                  <div className="p-3.5 bg-gray-900 rounded border border-gray-850 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5 font-bold">Выберите Участника</div>
                      <select
                        value={selectedRaceContestant}
                        onChange={(e) => setSelectedRaceContestant(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded px-2.5 py-2 text-xs font-semibold font-mono text-slate-350 focus:border-yellow-600 focus:outline-none focus:ring-1 focus:ring-yellow-900"
                      >
                        <option value="">-- Выбрать Конкурсанта --</option>
                        {activeRace.contestants.map((r: any, rIdx: number) => (
                          <option key={rIdx} value={r.name}>
                            {r.name} ({r.odds}x)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5 font-bold">Размер Ставки (в кредитах)</div>
                      <input
                        type="number"
                        min="50"
                        max="2000"
                        step="50"
                        value={raceBetAmount}
                        onChange={(e) => setRaceBetAmount(Math.max(50, parseInt(e.target.value) || 50))}
                        className="w-full bg-gray-950 border border-gray-800 rounded px-2.5 py-1.5 text-xs font-semibold font-mono text-yellow-500 outline-none focus:border-yellow-600 focus:ring-1 focus:ring-yellow-905"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={handlePlaceRaceBet}
                        className="w-full bg-yellow-600 hover:bg-yellow-500 text-gray-950 py-2 rounded font-mono text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                      >
                        <div className="flex items-center justify-center gap-1.5"><CustomNote /> Зарядить Трату</div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Race logs commentary and GM parameters dashboard */}
              <div className="space-y-4">
                
                {/* Comments box */}
                <div className="bg-gray-950 p-4 rounded border border-gray-800 space-y-2.5 leading-relaxed font-mono">
                  <h5 className="font-bold text-gray-300 text-xs uppercase tracking-widest border-b border-gray-850 pb-1.5">Репортаж Гонщика</h5>
                  <div className="h-44 overflow-y-auto font-mono text-[11px] text-gray-400 space-y-1.5">
                    {activeRace.log.slice().reverse().map((line: string, idx: number) => (
                      <div key={idx} className="border-b border-gray-950 pb-1">
                        {line}
                      </div>
                    ))}
                    {activeRace.log.length === 0 && (
                      <div className="text-center text-gray-600 py-10 text-xs">Букмекеры ожидают участников...</div>
                    )}
                  </div>
                </div>

                {/* GM Panel Options */}
                {isGM && (
                  <div className="bg-amber-950/20 border border-amber-900 p-4 rounded space-y-3.5">
                    <h5 className="font-bold text-amber-400 text-xs font-mono uppercase tracking-widest flex items-center gap-1.5 border-b border-amber-900 pb-2">
                      <Wrench className="w-4 h-4 text-amber-550" />
                      КУРАТОР: Панель Ипподрома
                    </h5>

                    {/* Customize Contestants */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Переименовать Бегунов (Через запятую 4 имени)</div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Мутант Лось, Ржавый Болт, Таракан Костыль"
                          value={customContestants}
                          onChange={(e) => setCustomContestants(e.target.value)}
                          className="flex-1 bg-gray-950 border border-gray-850 rounded px-2.5 py-1 text-xs font-mono text-amber-400 font-semibold focus:border-amber-600"
                        />
                        <button
                          onClick={handleCustomizeContestants}
                          className="bg-purple-950/90 hover:bg-purple-900 border border-purple-800 hover:border-purple-600 font-mono text-[10px] font-bold px-2 py-1.5 rounded cursor-pointer text-purple-200"
                        >
                          Применить
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleGMStartRace}
                        className="bg-emerald-600 hover:bg-emerald-500 text-gray-950 font-mono font-bold text-xs py-2 rounded uppercase cursor-pointer text-center"
                      >
                        <div className="flex items-center gap-1.5"><CustomRun /> Запустить Заезд</div>
                      </button>
                      <button
                        onClick={handleGMResetRace}
                        className="bg-red-900 hover:bg-red-800 text-white font-mono font-bold text-xs py-2 rounded uppercase cursor-pointer text-center"
                      >
                        Очистить Заезд
                      </button>
                    </div>
                  </div>
                )}

              </div>

            </div>

          </div>
          )
        )}

        {/* =============== 5. SLOTS TAB =============== */}
        {activeSubTab === "slots" && (
          !tavernSettings.enabledGames.slots && !isGM ? (
            <div className="text-center py-16 bg-gray-950/40 rounded border border-dashed border-red-900/40 p-8">
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
              <h3 className="text-red-400 font-bold uppercase font-mono tracking-wider text-sm">Реактор Слотов отключен</h3>
              <p className="text-gray-400 text-xs mt-2 font-mono max-w-sm mx-auto leading-relaxed">
                Слот-терминалы временно отключены куратором бара для техобслуживания электрокабелей.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {!tavernSettings.enabledGames.slots && (
                <div className="bg-red-950/40 border border-red-900 text-red-400 text-[11px] font-mono px-3 py-2 rounded text-center uppercase font-bold tracking-wider animate-pulse">
                  ВНИМАНИЕ КУРАТОРА: Реактор-Слот в данный момент ОТКЛЮЧЕН для обычных посетителей!
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visual slot machine panel */}
                <div className="lg:col-span-2 bg-gray-950 p-6 rounded-lg border border-purple-900/60 shadow-xl flex flex-col justify-between relative overflow-hidden">
                  {/* Decorative background reactor tubes */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="mb-4">
                    <h4 className="text-purple-400 font-bold uppercase font-mono tracking-wider text-xs flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
                      <span>ПДК Терминал «РЕАКТОР-777»</span>
                    </h4>
                    <p className="text-gray-500 font-mono text-[10px] uppercase tracking-wider mt-1">Откалибруйте стержни реактора для получения выигрышей</p>
                  </div>

                  {/* Reels display interface */}
                  <div className="bg-gray-900 border border-purple-950 p-6 rounded-lg my-4 flex justify-around items-center gap-4 relative">
                    <div className="absolute inset-x-0 h-0.5 bg-purple-500/30 top-1/2 -translate-y-1/2 pointer-events-none" />
                    
                    {slotsState.reels.map((symbol, idx) => {
                      const renderSlotSymbol = (sym: string) => {
                        switch(sym) {
                          case "⚙️": return <Settings className="w-12 h-12 text-stone-400" />;
                          case "🥫": return <Cylinder className="w-12 h-12 text-sky-400" />;
                          case "🍾": return <Wine className="w-12 h-12 text-amber-500" />;
                          case "💎": return <Gem className="w-12 h-12 text-emerald-400" />;
                          case "☢️": return <Activity className="w-12 h-12 text-purple-400" />;
                          case "💀": return <Skull className="w-12 h-12 text-rose-500" />;
                          case "🎲": return <Dices className="w-12 h-12 text-gray-500" />;
                          default: return sym;
                        }
                      };
                      return (
                      <div 
                        key={idx} 
                        className={`w-20 h-24 sm:w-24 sm:h-28 rounded-lg bg-gray-950 border-2 ${
                          slotsState.spinning ? "border-purple-600 animate-bounce" : "border-gray-800"
                        } flex items-center justify-center text-4xl sm:text-5xl shadow-inner shadow-black transition-all`}
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <span className={slotsState.spinning ? 'filter blur-[1px]' : ''}>
                          {renderSlotSymbol(symbol)}
                        </span>
                      </div>
                    )})}
                  </div>

                  {/* Operational Messages */}
                  <div className="min-h-[50px] bg-gray-900/60 rounded border border-gray-850 p-3 flex items-center justify-center text-center">
                    {slotsState.spinning ? (
                      <div className="flex items-center gap-2 text-xs font-mono text-purple-400 font-bold uppercase tracking-wider animate-pulse">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Вращение стержней реактора...</span>
                      </div>
                    ) : slotsState.winAmount !== undefined ? (
                      <div className="font-mono text-xs text-center space-y-1">
                        <div className={`font-bold ${slotsState.winAmount > 0 ? "text-emerald-400 text-sm animate-pulse" : "text-red-400"}`}>
                          {slotsState.winAmount > 0 ? `ВЫИГРЫШ: +${formatCredits(slotsState.winAmount)}!` : "СТЕРЖНИ НЕ СОВПАЛИ!"}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">{slotsState.message}</div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Укажите ставку КПК и потяните рычаг пуска</span>
                    )}
                  </div>

                  {/* Controls HUD */}
                  <div className="mt-6 pt-5 border-t border-purple-950 flex flex-wrap justify-between items-center gap-4">
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest leading-none">Ставка Сталкера (в кредитах)</div>
                      <div className="flex gap-1.5 select-none font-mono">
                        {[50, 100, 250, 500, 1000].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setSlotsBet(amt)}
                            disabled={slotsState.spinning}
                            className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer font-bold ${
                              slotsBet === amt
                                ? "bg-purple-600 text-gray-950 font-extrabold border-2 border-purple-400 shadow-md shadow-purple-950"
                                : "bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-850"
                            }`}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleSlotsSpin}
                      disabled={slotsState.spinning}
                      className={`font-mono text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded cursor-pointer transition-all border ${
                        slotsState.spinning
                          ? "bg-gray-900 border-gray-850 text-gray-600 cursor-not-allowed"
                          : "bg-purple-600 hover:bg-purple-500 text-gray-950 border-purple-400 font-black animate-pulse"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">ПУСК РЕАКТОРА</div>
                    </button>
                  </div>

                </div>

                {/* Slots Payout Matrix */}
                <div className="bg-gray-950 p-4 rounded-lg border border-gray-850 space-y-4">
                  <div className="flex items-center gap-1.5 text-purple-400 font-bold font-mono text-xs uppercase tracking-wider border-b border-purple-950 pb-2">
                    <Gamepad2 className="w-4 h-4" />
                    <span>ТАБЛИЦА СОВПАДЕНИЙ РЕАКТОРА</span>
                  </div>
                  <div className="space-y-2 text-[10px] font-mono text-gray-400 leading-none">
                    <div className="flex justify-between items-center p-2 rounded bg-gray-900 border border-purple-950/40">
                      <span className="flex gap-1 text-purple-400">
                        <Activity className="w-5 h-5"/>
                        <Activity className="w-5 h-5"/>
                        <Activity className="w-5 h-5"/>
                      </span>
                      <span className="text-purple-400 font-extrabold bg-purple-950/50 px-2 py-0.5 rounded border border-purple-900">x150 СТАВКА (Реактор Лок)</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-gray-900/60">
                      <span className="flex gap-1 text-emerald-400">
                        <Gem className="w-5 h-5"/>
                        <Gem className="w-5 h-5"/>
                        <Gem className="w-5 h-5"/>
                      </span>
                      <span className="text-emerald-400 font-extrabold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900">x60 СТАВКА (Артефакты)</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-gray-900/60">
                      <span className="flex gap-1 text-amber-500">
                        <Wine className="w-5 h-5"/>
                        <Wine className="w-5 h-5"/>
                        <Wine className="w-5 h-5"/>
                      </span>
                      <span className="text-amber-400 font-extrabold bg-amber-950/50 px-2 py-0.5 rounded border border-amber-900">x30 СТАВКА (Казаки Водка)</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-gray-900/60">
                      <span className="flex gap-1 text-orange-600">
                        <Cylinder className="w-5 h-5"/>
                        <Cylinder className="w-5 h-5"/>
                        <Cylinder className="w-5 h-5"/>
                      </span>
                      <span className="text-sky-400 font-bold bg-sky-950/50 px-2 py-0.5 rounded border border-sky-900">x15 СТАВКА (Тушонка)</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-gray-900/60">
                      <span className="flex gap-1 text-stone-400">
                        <Settings className="w-5 h-5"/>
                        <Settings className="w-5 h-5"/>
                        <Settings className="w-5 h-5"/>
                      </span>
                      <span className="text-gray-300 font-bold bg-gray-950 px-2 py-0.5 rounded border border-gray-800">x8 СТАВКА (Детали)</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-gray-900 border border-rose-950/20">
                      <div className="flex items-center gap-1.5">
                        <span className="flex gap-1 text-rose-500">
                          <Skull className="w-5 h-5"/>
                          <Skull className="w-5 h-5"/>
                          <Skull className="w-5 h-5"/>
                        </span>
                        <span className="text-rose-500 font-semibold">[ОПАСНОСТЬ!]</span>
                      </div>
                      <span className="text-rose-400 font-bold bg-rose-950/50 px-2 py-0.5 rounded border border-rose-900">x0 (ВЗРЫВ СИСТЕМЫ!)</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-gray-900/40">
                      <span className="text-xs uppercase font-mono text-gray-500">Любые 2 одинаковых</span>
                      <span className="text-gray-300 font-bold bg-gray-950 px-2 py-0.5 rounded">x2 СТАВКА</span>
                    </div>
                  </div>
                  <div className="p-3 bg-purple-950/10 border border-purple-900/40 rounded text-[9px] font-mono text-purple-400 leading-normal">
                    Ставки списываются с Вашего баланса КПК в режиме реального времени. Логи тиражируются в общую систему уведомлений бара. Администрация не возвращает рубли в случае аварии терминала!
                  </div>
                </div>

              </div>
            </div>
          )
        )}

        {/* =============== 6. ROULETTE TAB =============== */}
        {activeSubTab === "roulette" && (
          !tavernSettings.enabledGames.roulette && !isGM ? (
            <div className="text-center py-16 bg-gray-950/40 rounded border border-dashed border-red-900/40 p-8">
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
              <h3 className="text-red-400 font-bold uppercase font-mono tracking-wider text-sm">Радар рулетки выключен</h3>
              <p className="text-gray-400 text-xs mt-2 font-mono max-w-sm mx-auto leading-relaxed">
                Трансляция колеса рулетки заблокирована. Проверьте радиосигнал КПК.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {!tavernSettings.enabledGames.roulette && (
                <div className="bg-red-950/40 border border-red-905 text-red-400 text-[11px] font-mono px-3 py-2 rounded text-center uppercase font-bold tracking-wider animate-pulse">
                  ВНИМАНИЕ КУРАТОРА: Радар-Рулетка в данный момент ОТКЛЮЧЕНА для свободных игроков!
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Radar wheel and visualization */}
                <div className="lg:col-span-2 bg-gray-950 p-6 rounded-lg border border-red-900/60 shadow-xl relative flex flex-col justify-between overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="mb-4">
                    <h4 className="text-red-400 font-bold uppercase font-mono tracking-wider text-xs flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                      <span>ИДП Терминал «РАДАР-МЕЛЬНИЦА»</span>
                    </h4>
                    <p className="text-gray-500 font-mono text-[10px] uppercase tracking-wider mt-1">Делайте ставки на сектора сканирующего излучателя бармена</p>
                  </div>

                  {/* Circle Radar Scanner Graphics */}
                  <div className="my-6 flex justify-center items-center">
                    <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full border-2 border-red-900/50 bg-gray-900 flex items-center justify-center shadow-inner shadow-black">
                      {/* Laser sweep pointer */}
                      <div 
                        className="absolute top-1/2 left-1/2 w-1/2 h-1 bg-red-500 origin-left pointer-events-none"
                        style={{ 
                          transform: `rotate(${rouletteState.radarAngle - 90}deg)`, 
                          boxShadow: "0 0 10px #ef4444",
                          transition: rouletteState.spinning 
                            ? "transform 4.5s cubic-bezier(0.1, 0.8, 0.25, 1)" 
                            : "transform 0.15s ease-out"
                        }}
                      />
                      {/* Circular sweep scan light overlay */}
                      <div 
                        className="absolute inset-0 rounded-full bg-red-500/5 origin-center pointer-events-none"
                        style={{ 
                          transform: `rotate(${rouletteState.radarAngle}deg)`,
                          transition: rouletteState.spinning 
                            ? "transform 4.5s cubic-bezier(0.1, 0.8, 0.25, 1)" 
                            : "transform 0.15s ease-out"
                        }}
                      />
                      <div className="absolute inset-4 rounded-full border border-red-955/40 bg-gray-950/80 flex flex-col items-center justify-center font-mono">
                        {rouletteState.spinning ? (
                          <div className="text-center font-bold font-mono text-red-500 text-xs tracking-widest animate-pulse">
                            ПОИСК <span className="block text-[8px] opacity-75">ЧАСТОТЫ...</span>
                          </div>
                        ) : rouletteState.winningNumber !== undefined ? (
                          <div className="text-center space-y-1">
                            <span className="text-gray-500 text-[10px] tracking-wide uppercase">Сектор Радара</span>
                            <div className="flex items-center justify-center gap-2 mt-0.5">
                              <span className={`w-8 h-8 rounded-full font-sans text-lg font-bold flex items-center justify-center text-white ${
                                rouletteState.winningColor === "red" 
                                  ? "bg-red-600 shadow shadow-red-950" 
                                  : rouletteState.winningColor === "black" 
                                  ? "bg-gray-800 shadow shadow-black" 
                                  : "bg-emerald-600 font-bold border-green-500"
                              }`}>
                                {rouletteState.winningNumber}
                              </span>
                            </div>
                            <span className="text-[9px] uppercase text-gray-400 tracking-wider">
                              {rouletteState.winningColor === "red" ? "Красный" : rouletteState.winningColor === "black" ? "Черный" : "Зеро"}
                            </span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <span className="text-2xl"><CustomTarget className='w-6 h-6 text-sky-400' /></span>
                            <span className="block text-[9px] text-gray-500 uppercase tracking-widest mt-1">РАДАР ГОТОВ</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Outcome Alert Panel */}
                  <div className="min-h-[50px] bg-gray-900/60 rounded border border-gray-850 p-3 flex items-center justify-center text-center">
                    {rouletteState.spinning ? (
                      <div className="flex items-center gap-2 text-xs font-mono text-red-500 font-bold uppercase tracking-wider animate-pulse">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Сканирование секторов колеса...</span>
                      </div>
                    ) : rouletteState.winAmount !== undefined ? (
                      <div className="font-mono text-xs text-center space-y-1">
                        <div className={`font-bold ${rouletteState.winAmount > 0 ? "text-emerald-400 text-sm animate-pulse" : "text-red-400"}`}>
                          {rouletteState.winAmount > 0 ? `СИГНАЛ СОВПАЛ: +${formatCredits(rouletteState.winAmount)}!` : "СТАВКА НЕ СЫГРАЛА!"}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">{rouletteState.message}</div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Выберите параметры ставки ниже и сверьтесь с КПК</span>
                    )}
                  </div>

                  {/* Bet inputs parameters */}
                  <div className="mt-6 pt-5 border-t border-red-950 space-y-4">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* 1. BET CATEGORY */}
                      <div className="space-y-1.5 font-mono text-xs">
                        <label className="block text-gray-500 uppercase text-[9px] tracking-widest leading-none">Тип Ставки</label>
                        <select
                          value={rouletteBetType}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            setRouletteBetType(val);
                            if (val === "color") setRouletteBetValue("red");
                            else if (val === "parity") setRouletteBetValue("even");
                            else setRouletteBetValue("7");
                          }}
                          disabled={rouletteState.spinning}
                          className="w-full bg-gray-900 border border-gray-850 rounded p-2 text-xs font-semibold text-gray-300 outline-none focus:border-red-900"
                        >
                          <option value="number">Число (0 - 36) - выплата x35</option>
                          <option value="color">Цвет (Красное/Черное) - выплата x2</option>
                          <option value="parity">Четность (Четное/Нечетное) - выплата x2</option>
                        </select>
                      </div>

                      {/* 2. CHOSEN VALUE SELECTOR */}
                      <div className="space-y-1.5 font-mono text-xs">
                        <label className="block text-gray-500 uppercase text-[9px] tracking-widest leading-none">Целевой Сектор</label>
                        {rouletteBetType === "color" ? (
                          <div className="flex gap-2 h-9 select-none">
                            <button
                              onClick={() => setRouletteBetValue("red")}
                              disabled={rouletteState.spinning}
                              className={`flex-1 rounded font-bold text-xs cursor-pointer transition-all ${
                                rouletteBetValue === "red"
                                  ? "bg-red-600 text-white font-extrabold border-2 border-red-400"
                                  : "bg-gray-900 text-gray-400 border border-gray-850 hover:bg-gray-850"
                              }`}
                            >
                              Красное
                            </button>
                            <button
                              onClick={() => setRouletteBetValue("black")}
                              disabled={rouletteState.spinning}
                              className={`flex-1 rounded font-bold text-xs cursor-pointer transition-all ${
                                rouletteBetValue === "black"
                                  ? "bg-gray-800 text-gray-100 font-extrabold border-2 border-gray-650"
                                  : "bg-gray-900 text-gray-400 border border-gray-850 hover:bg-gray-850"
                              }`}
                            >
                              Черное
                            </button>
                          </div>
                        ) : rouletteBetType === "parity" ? (
                          <div className="flex gap-2 h-9 select-none">
                            <button
                              onClick={() => setRouletteBetValue("even")}
                              disabled={rouletteState.spinning}
                              className={`flex-1 rounded font-bold text-xs cursor-pointer transition-all ${
                                rouletteBetValue === "even"
                                  ? "bg-gray-800 text-gray-200 border-2 border-gray-500"
                                  : "bg-gray-900 text-gray-450 border border-gray-850"
                              }`}
                            >
                              Четное
                            </button>
                            <button
                              onClick={() => setRouletteBetValue("odd")}
                              disabled={rouletteState.spinning}
                              className={`flex-1 rounded font-bold text-xs cursor-pointer transition-all ${
                                rouletteBetValue === "odd"
                                  ? "bg-gray-800 text-gray-200 border-2 border-gray-500"
                                  : "bg-gray-900 text-gray-450 border border-gray-850"
                              }`}
                            >
                              Нечетное
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <input
                              type="number"
                              min="0"
                              max="36"
                              value={rouletteBetValue}
                              onChange={(e) => setRouletteBetValue(Math.max(0, Math.min(36, parseInt(e.target.value) || 0)).toString())}
                              disabled={rouletteState.spinning}
                              className="w-14 bg-gray-900 border border-gray-850 rounded p-2 text-center text-xs font-bold text-gray-200 focus:border-red-900 outline-none"
                            />
                            <div className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-none py-1.5 flex gap-1 bg-gray-900/40 rounded px-1.5 border border-gray-850/65">
                              {[0, 1, 7, 13, 21, 24, 32, 36].map((num) => (
                                <button
                                  key={num}
                                  onClick={() => setRouletteBetValue(num.toString())}
                                  className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${
                                    rouletteBetValue === num.toString() 
                                      ? "bg-red-500 text-gray-950 font-black" 
                                      : "bg-gray-950 text-gray-400 hover:text-white"
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3. BET SIZE SELECTOR AND SPIN TRIGGER */}
                      <div className="space-y-1.5 font-mono text-xs">
                        <label className="block text-gray-500 uppercase text-[9px] tracking-widest leading-none">Ставка Сталкера (в кредитах)</label>
                        <div className="flex gap-1.5 select-none font-mono">
                          {[50, 100, 250, 500, 1000].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setRouletteBetAmount(amt)}
                              disabled={rouletteState.spinning}
                              className={`flex-1 py-1 rounded transition-all cursor-pointer font-bold text-[10px] ${
                                rouletteBetAmount === amt
                                  ? "bg-red-650 text-white font-extrabold border-2 border-red-500 shadow shadow-red-950 animate-pulse"
                                  : "bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-850"
                              }`}
                            >
                              {amt}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>

                    <button
                      onClick={handleRouletteSpin}
                      disabled={rouletteState.spinning}
                      className={`w-full font-mono text-xs font-bold py-3 uppercase tracking-wider rounded cursor-pointer transition border ${
                        rouletteState.spinning
                          ? "bg-gray-900 border-gray-850 text-gray-600 cursor-not-allowed"
                          : "bg-red-600 hover:bg-red-500 text-white border-red-400 tracking-widest font-black"
                      }`}
                    >
                      <div className="flex justify-center items-center gap-1.5">ЗАПУСТИТЬ ОПТИМАЛЬНОЕ СКАНИРОВАНИЕ РАДАРА</div>
                    </button>

                  </div>

                </div>

                {/* Roulette rules sidebar */}
                <div className="bg-gray-950 p-4 rounded-lg border border-gray-850 space-y-4">
                  <h5 className="text-red-400 font-bold font-mono text-xs uppercase tracking-wider border-b border-red-950 pb-2">ТАРИФЫ ЧАСТОТ ДЕТЕКТОРА</h5>
                  <div className="space-y-2.5 text-[10px] font-mono text-gray-400 leading-normal">
                    <p>
                      Система рулетки базируется на случайной модуляции КПК:
                    </p>
                    <div className="p-2 rounded bg-gray-900 space-y-1 border border-red-950/30">
                      <div className="font-bold text-red-400 uppercase">Число (0 - 36)</div>
                      <p>Угадайте точный сектор частоты от 0 до 36. Вознаграждение выплачивается в масштабе <strong className="text-emerald-400">35 к 1</strong>!</p>
                    </div>
                    <div className="p-2 rounded bg-gray-900 space-y-1 border border-red-950/30">
                      <div className="font-bold text-red-400 uppercase">Цвет (Красный/Черный)</div>
                      <p>Зеро (0) окрашено в зеленый цвет. Все прочие числа делятся строго по цветам. Выплата за правильный выбор цвета составит <strong className="text-emerald-400">2 к 1</strong>!</p>
                    </div>
                    <div className="p-2 rounded bg-gray-900 space-y-1 border border-red-950/30">
                      <div className="font-bold text-red-400 uppercase">Четное / Нечетное</div>
                      <p>При выпадении Зеро (0) все ставки на четность сгорают в пользу таверны. Победное толкование составляет <strong className="text-emerald-400">2 к 1</strong>.</p>
                    </div>
                    <div className="p-3 bg-red-950/10 border border-red-900/30 rounded text-[9px] text-red-400 leading-normal">
                      <CustomWarning /> Любые программные подделки импульсов рулетки наказываются вызовом на арену!
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )
        )}

        {/* =============== 7. SHOOTING TAB =============== */}
        {activeSubTab === "shooting" && (
          !tavernSettings.enabledGames.shooting && !isGM ? (
            <div className="text-center py-16 bg-gray-950/40 rounded border border-dashed border-red-900/40 p-8">
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
              <h3 className="text-red-400 font-bold uppercase font-mono tracking-wider text-sm">КПП тира опечатан</h3>
              <p className="text-gray-400 text-xs mt-2 font-mono max-w-sm mx-auto leading-relaxed">
                Стрелковый полигон временно закрыт для учебных ведений огня.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {!tavernSettings.enabledGames.shooting && (
                <div className="bg-red-950/40 border border-red-900 text-red-400 text-[11px] font-mono px-3 py-2 rounded text-center uppercase font-bold tracking-wider animate-pulse">
                  ВНИМАНИЕ КУРАТОРА: КПК-Тир закрыт и заблокирован для рядовых сталкеров!
                </div>
              )}

              {/* Start training dashboard if currently not active */}
              {!shootingState.active && !shootingState.ended && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Weapon selection panel */}
                  <div className="md:col-span-2 bg-gray-950 p-6 rounded-lg border border-orange-900/50 space-y-6">
                    <div>
                      <h4 className="text-orange-500 font-bold uppercase font-mono tracking-wider text-sm flex items-center gap-2">
                        <Crosshair className="w-5 h-5 text-orange-500 animate-pulse" />
                        <span>Стрелковый Тренажёр КПК «ОПАЛ-М»</span>
                      </h4>
                      <p className="text-gray-400 font-mono text-xs mt-1 leading-relaxed">
                        Сталкерам предлагается пройти 15-секундную сессию стрельбы по виртуальным мишеням и мутантам для фиксации рекорда и получения призовых жетонов Куратора. Выберите ствол и калибр патронов:
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs select-none">
                      
                      {/* PM */}
                      <button
                        onClick={() => setShootingState(prev => ({ ...prev, weapon: "pm" }))}
                        className={`p-4 rounded-lg border text-left flex flex-col justify-between transition gap-3 cursor-pointer ${
                          shootingState.weapon === "pm"
                            ? "bg-orange-950/20 border-orange-500 shadow-md shadow-orange-950"
                            : "bg-gray-900 border-gray-850 hover:bg-gray-850"
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-orange-400 text-sm">Пистолет ПМ</div>
                          <p className="text-[10px] text-gray-500 mt-1 capitalize leading-relaxed">Надежная классика, слабый подброс при отдаче.</p>
                        </div>
                        <div className="text-[10px] space-y-0.5 text-gray-400 border-t border-gray-800 pt-2 shrink-0">
                          <div>🪨 Емкость: <span className="text-white font-bold">8 патронов</span></div>
                          <div><RefreshCw className="w-3.5 h-3.5 inline-block mr-1" /> Зарядка: <span className="text-amber-500">0.9 сек</span></div>
                          <div><Award className="w-3.5 h-3.5 inline-block mr-1 text-yellow-400" /> Множитель: <span className="text-emerald-400">1.0x</span></div>
                        </div>
                      </button>

                      {/* AK-74 */}
                      <button
                        onClick={() => setShootingState(prev => ({ ...prev, weapon: "ak" }))}
                        className={`p-4 rounded-lg border text-left flex flex-col justify-between transition gap-3 cursor-pointer ${
                          shootingState.weapon === "ak"
                            ? "bg-orange-950/20 border-orange-500 shadow-md shadow-orange-950"
                            : "bg-gray-900 border-gray-850 hover:bg-gray-850"
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-amber-500 text-sm">Автомат АК-74М</div>
                          <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">Огромная плотность огня, сильный боковой увод ствола.</p>
                        </div>
                        <div className="text-[10px] space-y-0.5 text-gray-400 border-t border-gray-800 pt-2 shrink-0">
                          <div>🪨 Емкость: <span className="text-white font-bold">30 патронов</span></div>
                          <div><RefreshCw className="w-3.5 h-3.5 inline-block mr-1" /> Зарядка: <span className="text-amber-500">1.4 сек</span></div>
                          <div><Award className="w-3.5 h-3.5 inline-block mr-1 text-yellow-400" /> Множитель: <span className="text-emerald-400">1.3x</span></div>
                        </div>
                      </button>

                      {/* Vintorez */}
                      <button
                        onClick={() => setShootingState(prev => ({ ...prev, weapon: "vintorez" }))}
                        className={`p-4 rounded-lg border text-left flex flex-col justify-between transition gap-3 cursor-pointer ${
                          shootingState.weapon === "vintorez"
                            ? "bg-orange-950/20 border-orange-500 shadow-md shadow-orange-950"
                            : "bg-gray-900 border-gray-850 hover:bg-gray-850"
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-purple-400 text-sm">Винтовка ВСС</div>
                          <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">Бесшумный урон, мгновенный полет пули со снайперским зумом.</p>
                        </div>
                        <div className="text-[10px] space-y-0.5 text-gray-400 border-t border-gray-800 pt-2 shrink-0">
                          <div>🪨 Емкость: <span className="text-white font-bold">10 патронов</span></div>
                          <div><RefreshCw className="w-3.5 h-3.5 inline-block mr-1" /> Зарядка: <span className="text-amber-500">1.1 сек</span></div>
                          <div><Award className="w-3.5 h-3.5 inline-block mr-1 text-yellow-400" /> Множитель: <span className="text-emerald-400">1.6x</span></div>
                        </div>
                      </button>

                    </div>

                    <div className="pt-4 border-t border-gray-900 flex flex-wrap justify-between items-center gap-4">
                      
                      {/* Bet size Selector inside Range */}
                      <div className="space-y-2">
                        <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest leading-none">Размер Оружейного Взноса (в кредитах)</span>
                        <div className="flex gap-1.5 font-mono">
                          {[100, 250, 500, 1000].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setShootingState(prev => ({ ...prev, bet: amt }))}
                              className={`px-3 py-1.5 rounded transition font-bold text-xs cursor-pointer ${
                                (shootingState.bet || 100) === amt
                                  ? "bg-orange-600 text-gray-950 font-extrabold border border-orange-400"
                                  : "bg-gray-900 text-gray-400 border border-gray-850"
                              }`}
                            >
                              {amt}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleStartShootingGame(shootingState.weapon, shootingState.bet || 100)}
                        className="bg-orange-600 hover:bg-orange-500 text-gray-950 font-bold font-mono text-xs px-6 py-2.5 rounded uppercase cursor-pointer transition-all border border-orange-400 animate-pulse tracking-wide font-black"
                      >
                        <span className="flex items-center justify-center gap-1.5">НАЧАТЬ СТРЕЛЬБУ</span>
                      </button>

                    </div>

                  </div>

                  {/* Range high scores or tutorial stats */}
                  <div className="bg-gray-950 p-4 rounded-lg border border-gray-850 space-y-4">
                    <h5 className="text-orange-500 font-bold font-mono text-xs uppercase tracking-wider border-b border-gray-900 pb-2">ИНСТРУКТАЖ СНАЙПЕРОВ</h5>
                    <div className="text-[10px] font-mono text-gray-400 leading-relaxed space-y-2.5">
                      <p>Капитаны Сталкеров предупреждают:</p>
                      <ul className="list-disc pl-4 space-y-1 text-gray-400">
                        <li>Запуск таймера спишет взнос. Сессия прекращается автоматически через <strong className="text-amber-500">15 секунд</strong>.</li>
                        <li>Мишени и Мутанты движутся по экрану с разной скоростью.</li>
                        <li>
                          <span className="text-red-400 font-bold"><span className="flex items-center gap-1">Обычная Мишень</span></span>: +10 очков.
                        </li>
                        <li>
                          <span className="text-amber-400 font-bold"><span className="flex items-center gap-1">Быстрый Снорк</span></span>: +25 очков.
                        </li>
                        <li>
                          <span className="text-indigo-400 font-bold"><span className="flex items-center gap-1">Невидимый Кровосос</span></span>: +40 очков.
                        </li>
                        <li>
                          <span className="text-rose-500 font-bold"><span className="flex items-center gap-1">Шкодливый Тушкан</span></span>: +15 очков.
                        </li>
                        <li>
                          <span className="text-red-500 font-bold"><CustomWarning />️ Эколог-Санитар</span>: <span className="font-extrabold text-red-400">-50 очков</span> за ранение! НЕ СТРЕЛЯТЬ!
                        </li>
                      </ul>
                      <p className="text-gray-500 pt-2 border-t border-gray-900">
                        Итоговый набранный счет определит Ваш ранг (Новичок, Профи, Сталкер-Легенда), который сформирует финальный коэффициент выплаты!
                      </p>
                    </div>
                  </div>

                </div>
              )}

              {/* Active training game module screen */}
              {shootingState.active && (
                <div className="space-y-4 font-mono">
                  {/* Performance HUD bar */}
                  <div className="bg-gray-950 px-4 py-3 rounded-lg border border-gray-850 flex flex-wrap items-center justify-between font-mono text-xs text-gray-300 gap-4 select-none">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-gray-500 uppercase tracking-widest text-[9px] block">Оружие</span>
                        <span className="font-bold text-orange-400 uppercase">
                          {shootingState.weapon === "pm" ? "Пистолет ПМ" : shootingState.weapon === "ak" ? "Штурмовой АК-74" : "Снайперский ВСС"}
                        </span>
                      </div>
                      <div className="border-l border-gray-800 h-6 px-1" />
                      <div>
                        <span className="text-gray-500 tracking-widest text-[9px] block">Патроны</span>
                        <div className="flex items-center gap-1 font-mono">
                          <span className={`${shootingState.ammo <= 2 ? "text-red-400 font-bold animate-pulse" : "text-white font-bold"}`}>
                            {shootingState.reloading ? "ЗАРЯДКА..." : `${shootingState.ammo} / ${shootingState.maxAmmo}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 font-mono">
                      <div className="text-center">
                        <span className="text-gray-500 text-[9px] tracking-widest block uppercase">Таймер</span>
                        <span className={`text-sm font-extrabold font-mono ${shootingState.timer < 5 ? 'text-red-500 animate-ping' : 'text-amber-500'}`}>{shootingState.timer} сек</span>
                      </div>
                      <div className="text-center">
                        <span className="text-gray-500 text-[9px] tracking-widest block uppercase">Набрано Очков</span>
                        <span className="text-sm font-bold text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded border border-emerald-900/40">{shootingState.score}</span>
                      </div>
                    </div>
                  </div>

                  {/* Range Playground Arena Container */}
                  <div 
                    onClick={handleShootingClick}
                    className="w-full h-[320px] bg-slate-950 rounded-lg border-2 border-orange-900/60 relative overflow-hidden select-none cursor-[crosshair] shadow-inner"
                  >
                    {/* Metal background rails and targets frame */}
                    <div className="absolute inset-0 bg-dot-grid opacity-10 pointer-events-none" />
                    <div className="absolute top-1/3 left-0 right-0 h-0.5 bg-gray-800/40 pointer-events-none" />
                    <div className="absolute top-2/3 left-0 right-0 h-0.5 bg-gray-800/40 pointer-events-none" />
                    
                    {/* Render Bullet Impact holes static */}
                    {shootingState.bulletHoles.map(hole => (
                      <div
                        key={hole.id}
                        className="absolute w-3.5 h-3.5 bg-gray-900 border border-gray-700/65 rounded-full flex items-center justify-center pointer-events-none shadow shadow-inner"
                        style={{ left: `${hole.x}%`, top: `${hole.y}%`, transform: "translate(-50%, -50%)" }}
                      >
                        <div className="w-1.5 h-1.5 bg-black rounded-full" />
                      </div>
                    ))}

                    {/* Muzzle flash overlay short animation */}
                    {shootingState.flashes.map(f => (
                      <div
                        key={f.id}
                        className="absolute rounded-full bg-amber-400 opacity-80 blur-[2px] animate-ping pointer-events-none"
                        style={{ 
                          left: `${f.x}%`, 
                          top: `${f.y}%`, 
                          width: `${f.size}px`, 
                          height: `${f.size}px`, 
                          transform: "translate(-50%, -50%)",
                          boxShadow: "0 0 25px #f59e0b"
                        }}
                      />
                    ))}

                    {/* Reloading banner overlay */}
                    {shootingState.reloading && (
                      <div className="absolute inset-0 bg-gray-950/70 z-30 flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                        <span className="font-mono text-xs font-bold uppercase text-amber-400 tracking-widest animate-pulse">ПЕРЕЗАРЯДКА ОЖИДАЙТЕ...</span>
                      </div>
                    )}

                    {/* Spawns dynamic moving targets */}
                    {shootingState.targets.map(target => {
                      const colorMap = {
                        bullseye: "bg-red-950/90 border-red-400 text-white",
                        snork: "bg-orange-950/95 border-orange-500 text-orange-100",
                        bloodsucker: "bg-purple-950/70 border-purple-800 text-purple-200 animate-pulse",
                        rat: "bg-amber-955 border-amber-600 text-amber-200",
                        loner: "bg-emerald-850/95 border-emerald-500 text-emerald-100 font-extrabold animate-bounce"
                      };

                      return (
                        <div
                          key={target.id}
                          className={`absolute rounded-full border-2 text-center flex flex-col items-center justify-center shadow-lg transition-all ${
                            target.state === "dying" ? "scale-0 rotate-45 opacity-0 duration-300" : "scale-100 duration-100"
                          } ${colorMap[target.type]}`}
                          style={{
                            left: `${target.x}%`,
                            top: `${target.y}%`,
                            width: `${target.size}px`,
                            height: `${target.size}px`,
                            transform: "translate(-50%, -50%)"
                          }}
                        >
                          <span className="text-[14px] leading-none mb-0.5 select-none font-sans">
                            {target.type === "bullseye" ? (
                              <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" />
                                <circle cx="12" cy="12" r="6" strokeWidth="2" />
                                <circle cx="12" cy="12" r="2" fill="currentColor" />
                              </svg>
                            ) : target.type === "snork" ? (
                              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-500 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
                                <path d="M6 13a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4" />
                                <circle cx="9" cy="9" r="1" fill="currentColor" />
                                <circle cx="15" cy="9" r="1" fill="currentColor" />
                              </svg>
                            ) : target.type === "bloodsucker" ? (
                              <svg viewBox="0 0 24 24" className="w-5 h-5 text-purple-400 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a8 8 0 0 0-8 8v12l3-3 3 3 3-3 3 3 3-3 3 3V10a8 8 0 0 0-8-8z" />
                                <circle cx="9" cy="10" r="1.5" fill="currentColor" />
                                <circle cx="15" cy="10" r="1.5" fill="currentColor" />
                              </svg>
                            ) : target.type === "rat" ? (
                              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" />
                                <path d="M9 13a5 5 0 0 1-5-5" />
                                <circle cx="11" cy="10" r="0.8" fill="currentColor" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" className="w-5 h-5 text-sky-400 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v8M8 12h8" strokeWidth="3" />
                              </svg>
                            )}
                          </span>
                          <span className="text-[7px] leading-tight select-none uppercase tracking-tight block max-w-[85%] truncate">
                            {target.type === "loner" ? "НЕ СТРЕЛЯТЬ" : target.label}
                          </span>
                        </div>
                      );
                    })}

                    {shootingState.targets.length === 0 && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-widest text-gray-500 animate-pulse">
                        Ожидайте появления мутантов...
                      </div>
                    )}

                  </div>

                  <div className="flex justify-between items-center bg-gray-950 p-3 rounded-lg border border-gray-850">
                    <button
                      onClick={handleShootingReload}
                      disabled={shootingState.reloading || shootingState.ammo === shootingState.maxAmmo}
                      className="bg-gray-900 text-gray-300 hover:text-white border border-gray-800 font-mono text-2xs uppercase px-4 py-1.5 rounded cursor-pointer transition font-bold"
                    >
                      <RefreshCw className="w-3.5 h-3.5 inline-block mr-1" /> Перезарядить ствол
                    </button>
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest select-none">
                      Кликайте по целям в окне тира для произведения выстрела
                    </span>
                  </div>

                </div>
              )}

              {/* End of results processing report screen */}
              {shootingState.ended && (
                <div className="mx-auto max-w-lg bg-gray-950 p-6 rounded-lg border border-orange-900 space-y-4 shadow-xl">
                  <div className="text-center space-y-2">
                    <div className="text-3xl"><CustomTrophy className='w-8 h-8 text-yellow-400' /></div>
                    <h4 className="text-orange-500 font-bold font-mono text-sm uppercase tracking-wider">ОТЧЕТ О СТРЕЛКОВОЙ КВАЛИФИКАЦИИ</h4>
                    <p className="text-gray-400 font-mono text-xs">Ваша учебная тренировка завершена и сохранена в базу КПК</p>
                  </div>

                  <div className="bg-gray-900 rounded p-4 border border-gray-850 font-mono text-xs space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Набранные Очки (Score):</span>
                      <span className="font-bold text-white">{shootingState.score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Размер оклада (Взнос):</span>
                      <span className="font-bold text-amber-500">{formatCredits(shootingState.bet)}</span>
                    </div>
                    {shootingState.winAmount !== undefined && (
                      <div className="flex justify-between border-t border-gray-850 pt-2.5 animate-pulse">
                        <span className="text-gray-400 uppercase font-bold">Выплата от Куратора:</span>
                        <span className={`font-black uppercase text-sm ${shootingState.winAmount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {formatCredits(shootingState.winAmount)} ({shootingState.winAmount > 0 ? "ПРИБЫЛЬ" : "УБЫТОК"})
                        </span>
                      </div>
                    )}
                  </div>

                  {shootingState.message && (
                    <p className="text-center text-xs font-mono text-orange-400 bg-orange-950/25 border border-orange-900/30 p-3 rounded font-semibold italic">
                      « {shootingState.message} »
                    </p>
                  )}

                  <div className="flex gap-3 justify-center pt-2">
                    <button
                      onClick={() => setShootingState(prev => ({ ...prev, ended: false, active: false }))}
                      className="bg-orange-600 hover:bg-orange-500 text-gray-950 font-bold font-mono text-xs px-5 py-2 rounded uppercase cursor-pointer"
                    >
                      Вернуться на Исходную
                    </button>
                  </div>
                </div>
              )}

            </div>
          )
        )}

        {/* =============== 8. THIMBLERIG TAB =============== */}
        {activeSubTab === "thimblerig" && (
          !tavernSettings.enabledGames.thimblerig && !isGM ? (
            <div className="text-center py-16 bg-gray-950/40 rounded border border-dashed border-red-900/40 p-8">
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
              <h3 className="text-red-400 font-bold uppercase font-mono tracking-wider text-sm">{LANG.common.statusLocked}</h3>
              <p className="text-gray-400 text-xs mt-2 font-mono max-w-sm mx-auto leading-relaxed">
                Куратор временно убрал напёрстки со стола.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {!tavernSettings.enabledGames.thimblerig && (
                <div className="bg-red-950/40 border border-red-900 text-red-400 text-[11px] font-mono px-3 py-2 rounded text-center uppercase font-bold tracking-wider animate-pulse">
                  {LANG.common.attentionGM}: Напёрстки заблокированы для игроков!
                </div>
              )}

              <div className="bg-gray-950 p-6 rounded-lg border border-teal-900/40 space-y-6">
                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <div>
                    <h3 className="text-teal-400 font-bold uppercase font-mono tracking-wider text-sm">
                      {LANG.thimblerig.title}
                    </h3>
                    <p className="text-gray-500 text-[11px] font-mono mt-0.5">
                      {LANG.thimblerig.rules}
                    </p>
                  </div>
                  <HelpCircle 
                    className="w-5 h-5 text-gray-600 hover:text-teal-500 cursor-pointer transition select-none"
                    onClick={() => setPdaAlert({ text: LANG.thimblerig.ruleAlert, type: "info" })}
                  />
                </div>

                {!thimblerigState.active ? (
                  <div className="flex flex-col items-center py-6 text-center max-w-md mx-auto space-y-5">
                    <div className="w-16 h-16 rounded-full bg-teal-950/40 border border-teal-800/40 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-8 h-8 text-amber-500 fill-current animate-bounce drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]">
                        <path d="M12 2l-5 3v4l5 3 5-3V5l-5-3zm-4.3 6V5.7l4.3-2.6 4.3 2.6V8L12 10.6 7.7 8z" />
                        <path d="M10 11h4v4h-4zm0 5h4v4h-4zm1-10.5h2v3h-2z" />
                        <rect x="9.5" y="11" width="5" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        <line x1="9.5" y1="14" x2="14.5" y2="14" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="9.5" y1="17" x2="14.5" y2="17" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="9.5" y1="20" x2="14.5" y2="20" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-300 text-xs font-mono leading-relaxed">
                        {LANG.thimblerig.desc}
                      </p>
                      <p className="text-teal-500 text-xs font-mono font-semibold mt-3">
                        {LANG.thimblerig.quote}
                      </p>
                    </div>

                    <div className="w-full space-y-3 pt-2">
                      <div className="flex justify-between text-[11px] font-mono text-gray-500">
                        <span>Сумма ставки (в кредитах):</span>
                        <span className="text-emerald-400 font-bold">{formatCredits(thimblerigState.bet)}</span>
                      </div>
                      <input 
                        type="range"
                        min="25"
                        max="1000"
                        step="25"
                        value={thimblerigState.bet}
                        onChange={(e) => setThimblerigState(prev => ({ ...prev, bet: parseInt(e.target.value) }))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                      />
                      <div className="flex gap-2 justify-center">
                        {[50, 100, 250, 500].map(val => (
                          <button
                            key={val}
                            onClick={() => setThimblerigState(prev => ({ ...prev, bet: val }))}
                            className={`px-2.5 py-1 text-[10px] font-mono rounded border transition-all cursor-pointer ${
                              thimblerigState.bet === val 
                                ? "bg-teal-950 border-teal-700 text-teal-400 font-bold" 
                                : "bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartThimblerig(thimblerigState.bet)}
                      className="w-full bg-teal-600 hover:bg-teal-500 text-gray-950 font-bold font-mono text-xs py-2.5 rounded uppercase cursor-pointer tracking-wider shadow-lg transition"
                    >
                      {LANG.thimblerig.startBtn} (-{formatCredits(thimblerigState.bet)})
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6 space-y-8">
                    {/* Game Message */}
                    <div className="bg-teal-950/20 border border-teal-900/30 p-2.5 rounded text-center w-full max-w-md">
                      <p className="text-[11px] font-mono text-teal-400 italic">
                        {thimblerigState.message || "Следите за банками..."}
                      </p>
                    </div>

                    {/* Three Cups / Cans */}
                    <div className="flex gap-20 justify-center items-end py-10 h-48 max-w-lg mx-auto">
                      {thimblerigState.positions.map((idx) => {
                        const isChosen = thimblerigState.selectedCup === idx;
                        const isWinner = thimblerigState.ballCup === idx;
                        const isRevealedWinner = thimblerigState.revealed && isWinner;
                        const isInitialRevealedWinner = thimblerigState.initialReveal && isWinner;
                        const shouldShowBolt = isRevealedWinner || isInitialRevealedWinner;

                        const revealShift = shouldShowBolt ? "-translate-y-16 scale-95" : "translate-y-0";

                        return (
                          <motion.div 
                            key={idx} 
                            layout
                            transition={{ type: "spring", stiffness: 140, damping: 14 }}
                            className="flex flex-col items-center relative select-none w-16"
                          >
                            {/* Bolt indicator (visible underneath only when revealed or initially shown) */}
                            {shouldShowBolt && (
                              <motion.div 
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="absolute bottom-2 z-0"
                              >
                                <svg viewBox="0 0 24 24" className="w-8 h-8 text-amber-500 fill-amber-500/10 animate-bounce drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]">
                                  <path d="M6 6l6-3 6 3v3H6V6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <rect x="9" y="9" width="6" height="11" rx="0.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <line x1="9" y1="14.5" x2="15" y2="14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <line x1="9" y1="17" x2="15" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <line x1="9" y1="19.5" x2="15" y2="19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </motion.div>
                            )}

                            {/* Cup graphics */}
                            <motion.button
                              onClick={() => handleChooseCup(idx)}
                              disabled={thimblerigState.shuffling || thimblerigState.revealed || thimblerigState.initialReveal}
                              animate={thimblerigState.shuffling ? {
                                y: [0, -12, 0],
                              } : {}}
                              transition={thimblerigState.shuffling ? {
                                repeat: Infinity,
                                duration: Math.max(0.12, 0.32 - Math.min(0.20, (thimblerigState.bet / 1000) * 0.18)),
                                ease: "easeInOut"
                              } : {}}
                              className={`w-16 h-20 bg-gradient-to-b from-stone-600 to-stone-800 border-2 rounded-t-xl cursor-pointer relative shadow-xl z-10 transition-all transform flex items-center justify-center ${revealShift} ${
                                isChosen 
                                  ? "border-amber-400" 
                                  : isRevealedWinner 
                                  ? "border-teal-500 shadow-teal-500/20" 
                                  : "border-stone-500"
                              }`}
                            >
                              <div className="flex flex-col items-center justify-center gap-1">
                                <Cylinder className="w-7 h-7 text-stone-400" />
                              </div>
                            </motion.button>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Result screen */}
                    {thimblerigState.revealed && (
                      <div className="text-center space-y-4 max-w-sm mx-auto pt-4 border-t border-gray-800 w-full">
                        <div className="font-mono text-xs">
                          {thimblerigState.winAmount && thimblerigState.winAmount > 0 ? (
                            <span className="text-emerald-400 font-bold block text-sm">
                              {LANG.thimblerig.win}: +{formatCredits(thimblerigState.winAmount)}!
                            </span>
                          ) : (
                            <span className="text-red-400 font-bold block text-sm">
                              {LANG.thimblerig.lose}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-4">
                          <button
                            onClick={() => handleStartThimblerig(thimblerigState.bet)}
                            className="flex-1 bg-teal-600 hover:bg-teal-500 text-gray-950 font-bold font-mono text-xs py-2 rounded uppercase cursor-pointer"
                          >
                            Ещё разок
                          </button>
                          <button
                            onClick={() => setThimblerigState(prev => ({ ...prev, active: false }))}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold font-mono text-xs py-2 rounded uppercase cursor-pointer"
                          >
                            К стойке
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* =============== 9. SVINYA TAB =============== */}
        {activeSubTab === "svinya" && (
          !tavernSettings.enabledGames.svinya && !isGM ? (
            <div className="text-center py-16 bg-gray-950/40 rounded border border-dashed border-red-900/40 p-8">
              <Lock className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
              <h3 className="text-red-400 font-bold uppercase font-mono tracking-wider text-sm">Свинья под охраной</h3>
              <p className="text-gray-400 text-xs mt-2 font-mono max-w-sm mx-auto leading-relaxed">
                Карточный загон для «Свиньи» временно заперт барменом.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {!tavernSettings.enabledGames.svinya && (
                <div className="bg-red-950/40 border border-red-900 text-red-400 text-[11px] font-mono px-3 py-2 rounded text-center uppercase font-bold tracking-wider animate-pulse">
                  ВНИМАНИЕ КУРАТОРА: Игра «Свинья» закрыта для сталкеров!
                </div>
              )}

              <div className="bg-gray-950 p-6 rounded-lg border border-pink-900/40 space-y-6">
                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <div>
                    <h3 className="text-pink-400 font-bold uppercase font-mono tracking-wider text-sm">
                      Карточная игра «Свинья» с Батюшкой
                    </h3>
                    <p className="text-gray-500 text-[11px] font-mono mt-0.5">
                      Традиционная сталкерская игра. Сбрось свои карты в круг и оставь оппонента в «Свиньях»!
                    </p>
                  </div>
                  <HelpCircle 
                    className="w-5 h-5 text-gray-600 hover:text-pink-500 cursor-pointer transition"
                    onClick={() => setPdaAlert({ text: "Правила: Тащи карту из круга. Если её масть совпадает или ранг на 1 соседствует с центральной — сбрасываешь! Если не совпадает — забираешь в свой загон. Карта Пики 6 — Ловушка Свиньи! Вытянешь её — заберёшь ВСЮ центральную кучу! Конец игры: когда круг пуст. У кого меньше карт в загоне — забирает банк!", type: "info" })}
                  />
                </div>

                {svinyaState.phase === "ready" && (
                  <div className="flex flex-col items-center py-6 text-center max-w-md mx-auto space-y-5">
                    <div className="w-16 h-16 rounded-full bg-pink-950/40 border border-pink-800/40 flex items-center justify-center text-3xl">
                      <CustomPig className='inline w-4 h-4 text-pink-400' />
                    </div>
                    <div>
                      <p className="text-gray-300 text-xs font-mono leading-relaxed">
                        Карточная «Свинья» — простая игра на выбывание с колодой в 36 карт. Игровое поле — это круговой веер карт, лежащих рубашкой вверх. В центре — плацдарм сброса.
                      </p>
                      <p className="text-pink-500 text-xs font-mono font-semibold mt-3">
                        « Говорят, Харон всегда прячет Пиковый Шестерняк — Свинью-Ловушку. Будь осторожен! Избавишься от карт — унесешь двойной куш! »
                      </p>
                    </div>

                    <div className="w-full space-y-3 pt-2">
                      <div className="flex justify-between text-[11px] font-mono text-gray-500">
                        <span>Сумма кона (в кредитах):</span>
                        <span className="text-emerald-400 font-bold">{formatCredits(svinyaState.bet)}</span>
                      </div>
                      <input 
                        type="range"
                        min="50"
                        max="1000"
                        step="50"
                        value={svinyaState.bet}
                        onChange={(e) => setSvinyaState(prev => ({ ...prev, bet: parseInt(e.target.value) }))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                      />
                      <div className="flex gap-2 justify-center">
                        {[50, 100, 200, 500].map(val => (
                          <button
                            key={val}
                            onClick={() => setSvinyaState(prev => ({ ...prev, bet: val }))}
                            className={`px-2.5 py-1 text-[10px] font-mono rounded border transition-all cursor-pointer ${
                              svinyaState.bet === val 
                                ? "bg-pink-950 border-pink-700 text-pink-400 font-bold" 
                                : "bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      disabled={svinyaState.loading}
                      onClick={() => handleStartSvinya(svinyaState.bet)}
                      className="w-full bg-pink-600 hover:bg-pink-500 text-gray-950 font-bold font-mono text-xs py-2.5 rounded uppercase cursor-pointer tracking-wider shadow-lg transition disabled:opacity-50"
                    >
                      {svinyaState.loading ? "Раскладываем кон..." : `Раздать Колоду (-${formatCredits(svinyaState.bet)})`}
                    </button>
                  </div>
                )}

                {svinyaState.phase === "playing" && (
                  <div className="flex flex-col space-y-6">
                    {/* Turn header */}
                    <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${svinyaState.turn === "player" ? "bg-pink-500 animate-pulse" : "bg-gray-600"}`}></span>
                        <span className="text-xs uppercase font-mono font-bold text-gray-300">
                          {svinyaState.turn === "player" ? "ТВОЙ ХОД" : "ХОД БАРМЕНА"}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-gray-500">
                        Осталось карт в кругу: <span className="text-amber-500 font-bold">{svinyaState.circleCards.filter(c => c !== null).length}</span>
                      </div>
                    </div>

                    {/* Svinya Circular board */}
                    <div className="relative w-full h-[260px] flex items-center justify-center bg-gray-950/60 rounded-xl overflow-hidden border border-gray-800/40">
                      {/* Circle of cards */}
                      <div className="relative w-[340px] h-[340px] flex items-center justify-center shrink-0">
                        {svinyaState.circleCards.map((card, idx) => {
                          if (!card) return null;
                          const angle = (idx * 360) / 36;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSvinyaPlayerDraw(idx)}
                              disabled={svinyaState.turn !== "player" || svinyaState.phase !== "playing"}
                              className={`absolute w-8 h-12 rounded border flex items-center justify-center font-bold font-mono transition shadow select-none ${
                                svinyaState.turn === "player" 
                                  ? "border-pink-900/50 hover:border-pink-500 hover:-translate-y-1 cursor-pointer bg-zinc-800 text-pink-400"
                                  : "border-gray-800/20 bg-zinc-900 text-gray-600 cursor-not-allowed"
                              }`}
                              style={{
                                transform: `rotate(${angle}deg) translate(0, -95px) rotate(${-angle}deg)`,
                                backgroundImage: "repeating-linear-gradient(45deg, #18181b, #18181b 3px, #27272a 3px, #27272a 6px)"
                              }}
                            >
                              <Zap className="w-3 h-3 text-pink-500/85 pointer-events-none" />
                            </button>
                          );
                        })}

                        {/* Central Foundation Pile */}
                        <div className="absolute w-[86px] h-32 rounded-lg border-2 border-dashed border-pink-900/40 p-1 flex items-center justify-center bg-gray-900/40 shadow-inner">
                          {svinyaState.centerPile.length > 0 ? (
                            (() => {
                              const topVal = svinyaState.centerPile[svinyaState.centerPile.length - 1];
                              const isRed = topVal.suit === "hearts" || topVal.suit === "diamonds";
                              const suitSymbol = topVal.suit === "hearts" ? <CustomHeart className='inline w-4 h-4 text-red-500' /> : topVal.suit === "diamonds" ? <CustomDiamond className='inline w-4 h-4 text-red-500' /> : topVal.suit === "clubs" ? <CustomClub className='inline w-4 h-4 text-gray-900' /> : <CustomSpade className='inline w-4 h-4 text-gray-900' />;
                              
                              return (
                                <div className={`w-[74px] h-[114px] bg-zinc-950 border border-pink-900/40 rounded flex flex-col justify-between p-1.5 shadow-lg select-none ${isRed ? "text-red-500" : "text-gray-400"}`}>
                                  <div className="text-xs font-bold font-mono flex justify-between items-center">
                                    <span>{topVal.value}</span>
                                    <span>{suitSymbol}</span>
                                  </div>
                                  <div className="text-center text-3xl my-auto">
                                    {topVal.isPig ? <CustomPig className='inline w-8 h-8 text-pink-400' /> : suitSymbol}
                                  </div>
                                  <div className="text-[10px] text-gray-600 font-mono text-center">
                                    Куча ({svinyaState.centerPile.length})
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-[10px] text-gray-600 font-mono text-center">Сброс пуст</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notification Box */}
                    {svinyaState.message && (
                      <p className="text-center text-[11px] font-mono text-pink-400 bg-pink-950/15 border border-pink-900/20 p-2 rounded italic">
                        <Wrench className="w-4 h-4 inline-block mr-1" /> {svinyaState.message}
                      </p>
                    )}

                    {/* Sties status panel */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 1. Player Sty (Your Sty) */}
                      <div className="p-4 bg-gray-900/80 rounded-lg border border-pink-900/20 space-y-3">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                          <span className="text-xs font-mono font-bold text-gray-300">Твой Загон (Свинарник):</span>
                          <span className="text-xs font-mono bg-pink-950 text-pink-400 px-2 py-0.5 rounded font-extrabold border border-pink-900/20">
                            {svinyaState.playerSty.length} шт
                          </span>
                        </div>

                        {svinyaState.playerSty.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex gap-1.5 overflow-x-auto py-2 px-1.5">
                              {svinyaState.playerSty.map((card, cidx) => {
                                const isRed = card.suit === "hearts" || card.suit === "diamonds";
                                const suitSymbol = card.suit === "hearts" ? <CustomHeart className='inline w-3 h-3 text-red-500' /> : card.suit === "diamonds" ? <CustomDiamond className='inline w-3 h-3 text-red-500' /> : card.suit === "clubs" ? <CustomClub className='inline w-3 h-3 text-gray-900' /> : <CustomSpade className='inline w-3 h-3 text-gray-900' />;
                                const isTop = cidx === svinyaState.playerSty.length - 1;

                                return (
                                  <div 
                                    key={cidx}
                                    className={`w-10 h-14 shrink-0 rounded border bg-zinc-950 p-1 flex flex-col justify-between text-[11px] font-bold font-mono transition-all ${
                                      isRed ? "text-red-500 border-red-900/30" : "text-gray-400 border-gray-800"
                                    } ${isTop ? "ring-2 ring-pink-500 border-pink-400 scale-105" : "opacity-85"}`}
                                  >
                                    <span>{card.value}</span>
                                    <span className="text-center">{card.isPig ? <CustomPig className='inline w-4 h-4 text-pink-400' /> : suitSymbol}</span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Discard top card of Sty helper button */}
                            {(() => {
                              if (svinyaState.playerSty.length === 0) return null;
                              const topC = svinyaState.playerSty[svinyaState.playerSty.length - 1];
                              const centerC = svinyaState.centerPile[svinyaState.centerPile.length - 1];
                              const playable = checkSvinyaPlayable(topC, centerC);

                              return (
                                <button
                                  disabled={!playable || svinyaState.turn !== "player"}
                                  onClick={handleSvinyaPlayStyBack}
                                  className={`w-full py-1.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider cursor-pointer ${
                                    playable && svinyaState.turn === "player"
                                      ? "bg-pink-600 hover:bg-pink-500 text-gray-950 animate-bounce"
                                      : "bg-gray-800 text-gray-600 cursor-not-allowed"
                                  }`}
                                >
                                  {playable ? `Сбросить верхнюю карту (${topC.value})` : "Сброс недоступен (не подходит)"}
                                </button>
                              );
                            })()}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-600 font-mono text-center py-2 italic font-semibold">
                            Чистый хлев! Ни одной свиной карты.
                          </p>
                        )}
                      </div>

                      {/* 2. Bot Sty (Barman Sty) */}
                      <div className="p-4 bg-gray-900/80 rounded-lg border border-gray-800 space-y-3">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                          <span className="text-xs font-mono font-bold text-gray-300"><User className='w-3.5 h-3.5 inline mr-1 text-red-400' /> Загон Бармена:</span>
                          <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-extrabold border border-gray-700/50">
                            {svinyaState.botSty.length} шт
                          </span>
                        </div>

                        {svinyaState.botSty.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex gap-1 py-1 overflow-x-auto">
                              {svinyaState.botSty.map((card, bidx) => (
                                <div key={bidx} className="w-6 h-10 shrink-0 border border-dashed border-gray-800 bg-zinc-900/50 flex items-center justify-center text-[10px] font-mono text-gray-600">
                                  <CustomNote className='inline w-4 h-4 text-stone-500' />
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-gray-500 font-mono italic text-center">
                              Бармен хмурится и поглядывает на свои карты.
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-600 font-mono text-center py-2 italic">
                            У бармена идеально стерильный загон!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {svinyaState.phase === "ended" && (
                  <div className="text-center py-6 space-y-5 max-w-sm mx-auto">
                    <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-4xl bg-pink-950/20 border border-pink-900/30">
                      {svinyaState.result === "win" ? <CustomTrophy className='inline w-8 h-8 text-yellow-500' /> : svinyaState.result === "tie" ? <CustomHandshake className='inline w-8 h-8 text-blue-400' /> : <CustomPig className='inline w-8 h-8 text-pink-400' />}
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-gray-200 uppercase font-mono tracking-wider text-sm">
                        Партия завершена!
                      </h4>
                      <div className="p-3.5 bg-gray-950 border border-gray-800/80 rounded font-mono text-[11px] space-y-1">
                        <div className="flex justify-between">
                          <span>Ваши карты в загоне:</span>
                          <span className="text-pink-400 font-semibold">{svinyaState.playerSty.length} шт</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Карты бармена:</span>
                          <span className="text-gray-400">{svinyaState.botSty.length} шт</span>
                        </div>
                      </div>

                      {svinyaState.message && (
                        <p className="text-xs font-mono text-pink-400 italic bg-pink-950/10 p-2.5 rounded border border-pink-900/20 leading-relaxed">
                          « {svinyaState.message} »
                        </p>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => handleStartSvinya(svinyaState.bet)}
                        className="flex-1 bg-pink-600 hover:bg-pink-500 text-gray-950 font-bold font-mono text-xs py-2 rounded uppercase cursor-pointer"
                      >
                        Замешать еще раз
                      </button>
                      <button
                        onClick={() => setSvinyaState(prev => ({ ...prev, phase: "ready" }))}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold font-mono text-xs py-2 rounded uppercase cursor-pointer"
                      >
                        Выйти
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        )}

      </div>

      {/* GM Global Admin wallet panel when active */}
      {isGM && (
        <div className="bg-amber-950/10 border-t border-amber-900 p-3.5 flex flex-wrap gap-4 items-center justify-between font-mono text-xs">
          <div className="text-amber-500 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-amber-500 shrink-0" />
            Кураторский Финансовый Регулятор
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            {Object.entries(playerDb).map(([pId, val]: [string, any]) => {
              if (pId === userId) return null; // skip self
              return (
                <div key={pId} className="bg-gray-900 border border-gray-800 p-1.5 rounded flex items-center gap-2.5">
                  <span className="text-gray-400 font-bold font-mono">{val.userName || pId.slice(0, 5)}:</span>
                  <span className="text-emerald-400 font-bold">{formatCredits(val.balance)}</span>
                  <div className="flex gap-1 select-none">
                    <button
                      onClick={() => handleGMModifyBalanceLocal(pId, 250)}
                      className="bg-emerald-950 text-emerald-400 hover:bg-emerald-800 hover:text-emerald-100 rounded text-[10px] px-1.5 font-bold cursor-pointer transition border border-emerald-900"
                    >
                      +250
                    </button>
                    <button
                      onClick={() => handleGMModifyBalanceLocal(pId, -250)}
                      className="bg-red-950 text-red-400 hover:bg-red-950/30 rounded text-[10px] px-1.5 font-bold cursor-pointer transition border border-red-900"
                    >
                      -250
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
