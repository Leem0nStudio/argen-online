import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { PlayerState, GroundItem, ChatMessage, ItemDef, DamageEvent, MonsterData, SkillEvent, WorldMetaData, TradeState, PartyState, ClanState } from "@shared/types";
import { MapZone, Direction, SKILLS } from "@shared/types";
import { xpForLevel } from "@shared/constants";
import { RECIPES } from "@shared/crafting";
import { QUESTS } from "@shared/quests";
import { ITEMS } from "@shared/items";
import { getSocket } from "../network/socket";
import { GameEngine } from "../game/engine";
import VirtualJoystick from "./VirtualJoystick";
import Minimap from "./Minimap";
import StatPanel from "./StatPanel";
import * as Audio from "../game/audio";

interface Props {
  player: PlayerState;
  onLogout: () => void;
}

const ITEM_ICONS: Record<string, string> = {
  rusty_sword: "🗡️", iron_sword: "⚔️", steel_sword: "🗡️", oak_bow: "🏹",
  mage_staff: "🪄", flame_blade: "🔥", leather_armor: "🥋", chainmail: "🦺",
  plate_armor: "🛡️", wooden_shield: "🪵", health_potion: "🧪", mana_potion: "💧",
  bandage: "🩹", iron_ore: "⛏️", wood: "🪵", gold_nugget: "✨",
};

const SLOT_LABELS: Record<string, string> = {
  weapon: "Arma", armor: "Armadura", shield: "Escudo",
  head: "Cabeza", boots: "Botas", ring: "Anillo",
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768;
  });
  useEffect(() => {
    const check = () => setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function GameScreen({ player: initialPlayer, onLogout }: Props) {
  const [player, setPlayer] = useState<PlayerState>(initialPlayer);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showInventory, setShowInventory] = useState(false);
  const [groundItems, setGroundItems] = useState<GroundItem[]>([]);
  const [damageNumbers, setDamageNumbers] = useState<{ id: string; x: number; y: number; amount: number; isCrit: boolean; isHeal: boolean }[]>([]);
  const [npcPanel, setNpcPanel] = useState<{ npcId: string; name: string; dialogue: string; shopItems?: ItemDef[]; isBanker?: boolean } | null>(null);
  const [bankState, setBankState] = useState<{ gold: number; items: { itemId: string; name: string; quantity: number }[] } | null>(null);
  const [tradeState, setTradeState] = useState<TradeState | null>(null);
  const [tradeNotice, setTradeNotice] = useState<string | null>(null);
  const [partyState, setPartyState] = useState<PartyState | null>(null);
  const [clanState, setClanState] = useState<ClanState | null>(null);
  const [questState, setQuestState] = useState<{ questId: string; progress: number; required: number; completed: boolean; name: string } | null>(null);
  const [showCrafting, setShowCrafting] = useState(false);
  const [deathScreen, setDeathScreen] = useState(false);
  const [chatFocused, setChatFocused] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [engineError, setEngineError] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [worldData, setWorldData] = useState<WorldMetaData | null>(null);
  const [showStatPanel, setShowStatPanel] = useState(false);
  const [levelUpToast, setLevelUpToast] = useState<{ level: number; newUnlocks: string[] } | null>(null);

  const safeAreaInset = useMemo(() => ({
    top: "env(safe-area-inset-top, 0px)",
    bottom: "env(safe-area-inset-bottom, 0px)",
    left: "env(safe-area-inset-left, 0px)",
    right: "env(safe-area-inset-right, 0px)",
  }), []);

  // Get skills for current class
  const classSkills = useMemo(() => SKILLS[player.characterClass] ?? [], [player.characterClass]);

  // Cooldown updater
  useEffect(() => {
    if (!player.cooldowns) return;
    const updateCooldowns = () => {
      const now = Date.now();
      const active: Record<string, number> = {};
      for (const [skillId, endTime] of Object.entries(player.cooldowns ?? {})) {
        if (endTime > now) active[skillId] = endTime;
      }
      setCooldowns(active);
    };
    updateCooldowns();
    const interval = setInterval(updateCooldowns, 100);
    return () => clearInterval(interval);
  }, [player.cooldowns]);

  // Initialize engine
  useEffect(() => {
    let cancelled = false;
    const initEngine = () => {
      if (!canvasRef.current || cancelled) return;
      try {
        const engine = new GameEngine(canvasRef.current);
        if (cancelled) { engine.destroy(); return; }
        engineRef.current = engine;

        engine.onMove = (x, y, dir) => getSocket().emit("player:move", { x, y, direction: dir });
        engine.onStop = (x, y, dir) => getSocket().emit("player:stop", { x, y, direction: dir });
        engine.onNPCClick = (npcId) => getSocket().emit("npc:interact", npcId);
        engine.onItemPickup = (itemId) => getSocket().emit("item:pickup", itemId);
        engine.onAttack = (targetId) => {
          setSelectedTarget(targetId);
          getSocket().emit("combat:attack", targetId);
        };
        engine.onRequestChunks = (wx, wy) => getSocket().emit("world:request", { wx, wy, radius: 120 });

        engine.setLocalPlayer(player);
        setEngineReady(true);
      } catch (err: any) {
        console.error("[GameScreen] Engine init failed:", err);
        if (!cancelled) setEngineError(err.message || "No se pudo inicializar el motor gráfico.");
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(initEngine));
    return () => { cancelled = true; engineRef.current?.destroy(); engineRef.current = null; };
  }, []);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();

    const onPlayerUpdate = (p: PlayerState) => {
      setPlayer(p);
      engineRef.current?.updateLocalPlayer(p);
      if (p.stats.hp <= 0) setDeathScreen(true);
    };
    const onPlayerMove = (data: { id: string; x: number; y: number; direction: Direction; isMoving: boolean }) => {
      engineRef.current?.updateOtherPlayer({ ...initialPlayer, id: data.id, x: data.x, y: data.y, direction: data.direction, isMoving: data.isMoving, mapId: player.mapId } as PlayerState);
    };
    const onPlayerLeave = (id: string) => engineRef.current?.removeOtherPlayer(id);
    const onPlayersList = (players: PlayerState[]) => {
      const ids = new Set(players.map((p) => p.id));
      for (const id of Array.from(engineRef.current?.otherPlayers.keys() ?? [])) {
        if (!ids.has(id)) engineRef.current?.removeOtherPlayer(id);
      }
      for (const p of players) { if (p.id !== player.id) engineRef.current?.addOtherPlayer(p); }
    };
    const onChatMessage = (msg: ChatMessage) => setChatMessages((prev) => [...prev.slice(-50), msg]);
    const onCombatDamage = (event: DamageEvent) => {
      const id = `dmg_${Date.now()}_${Math.random()}`;
      setDamageNumbers((prev) => [...prev, { id, x: event.defenderId === player.id ? window.innerWidth / 2 : 0, y: window.innerHeight / 2, amount: event.damage, isCrit: event.isCrit, isHeal: false }]);
      setTimeout(() => setDamageNumbers((prev) => prev.filter((d) => d.id !== id)), 1000);
      if (event.damage > 0) {
        if (event.isCrit) { Audio.playCrit(); } else { Audio.playHit(); }
      }
      engineRef.current?.playHitEffect(event.defenderId, event.isCrit);
      if (event.defenderId === player.id) Audio.resumeAudio();
    };
    const onCombatDeath = (data: { killerId: string; victimId: string }) => {
      if (data.victimId === player.id) setDeathScreen(true);
      Audio.playDeath();
      engineRef.current?.playDeathEffect(data.victimId);
    };
    const onSkillEffect = (event: SkillEvent) => {
      if (event.casterId === player.id) {
        Audio.playEquip();
        engineRef.current?.playLevelUpEffect();
      }
      if (event.heal && event.heal > 0 && event.casterId === player.id) {
        engineRef.current?.playHealEffect();
      }
    };
    const onGroundItems = (items: GroundItem[]) => {
      const oldCount = groundItems.length;
      setGroundItems(items);
      engineRef.current?.updateGroundItems(items);
      if (items.length > oldCount) Audio.playPickup();
    };
    const onNpcInteract = (data: { npcId: string; dialogue: string; shopItems?: ItemDef[]; isBanker?: boolean }) => setNpcPanel({ npcId: data.npcId, name: data.npcId.replace(/_/g, " "), dialogue: data.dialogue, shopItems: data.shopItems, isBanker: data.isBanker });
    const onWorldState = (state: { players: PlayerState[]; groundItems: GroundItem[]; mapId: string }) => {
      for (const p of state.players) { if (p.id !== player.id) engineRef.current?.addOtherPlayer(p); }
      setGroundItems(state.groundItems);
      engineRef.current?.updateGroundItems(state.groundItems);
    };
    const onMonstersUpdate = (monsters: MonsterData[]) => {
      engineRef.current?.updateMonsters(monsters);
    };
    const onWorldData = (data: WorldMetaData) => setWorldData(data);
    const onWorldChunk = (data: { rx: number; ry: number; tiles: number[][] }) => {
      engineRef.current?.loadWorldChunk(data.rx, data.ry, data.tiles);
    };
    const onLevelUp = (data: { level: number; statPoints: number; newUnlocks: string[] }) => {
      setPlayer(p => ({ ...p, level: data.level, statPoints: data.statPoints, skillUnlocks: [...(p.skillUnlocks ?? []), ...data.newUnlocks] }));
      setLevelUpToast({ level: data.level, newUnlocks: data.newUnlocks });
      setTimeout(() => setLevelUpToast(null), 4000);
    };
    const onMapData = (map: import("@shared/types").GameMap) => {
      engineRef.current?.registerMap(map);
    };
    const onWorldTime = (data: { time: number; isDay: boolean }) => {
      engineRef.current?.setWorldTime(data.time, data.isDay);
    };
    const onBankState = (state: { gold: number; items: { itemId: string; name: string; quantity: number }[] }) => setBankState(state);
    const onClanState = (state: ClanState | null) => setClanState(state);
    const onClanRequest = (data: { fromId: string; fromName: string; clanName: string }) => {
      if (window.confirm(`${data.fromName} te invita al clan ${data.clanName}. ¿Aceptar?`)) getSocket().emit("clan:accept");
      else getSocket().emit("clan:decline");
    };
    const onClanClosed = (data: { reason: string }) => { setTradeNotice(data.reason); setTimeout(() => setTradeNotice(null), 4000); };
    const onQuestState = (state: { questId: string; progress: number; required: number; completed: boolean; name: string } | null) => setQuestState(state);
    const onTradeRequest = (data: { fromId: string; fromName: string }) => {
      if (window.confirm(`${data.fromName} quiere comerciar con vos. ¿Aceptar?`)) {
        getSocket().emit("trade:accept");
      } else {
        getSocket().emit("trade:decline");
      }
    };
    const onTradeState = (state: TradeState) => setTradeState(state);
    const onTradeClosed = (data: { reason: string }) => {
      setTradeState(null);
      setTradeNotice(data.reason);
      setTimeout(() => setTradeNotice(null), 4000);
    };
    const onPartyRequest = (data: { fromId: string; fromName: string }) => {
      if (window.confirm(`${data.fromName} te invita a su grupo. ¿Aceptar?`)) {
        getSocket().emit("party:accept");
      } else {
        getSocket().emit("party:decline");
      }
    };
    const onPartyState = (state: PartyState) => setPartyState(state.members.length > 0 ? state : null);
    const onPartyClosed = (data: { reason: string }) => {
      setTradeNotice(data.reason);
      setTimeout(() => setTradeNotice(null), 4000);
    };
    const onActionResult = (data: { ok: boolean; message: string }) => {
      setTradeNotice(data.message);
      setTimeout(() => setTradeNotice(null), 4000);
    };

    socket.on("clan:state", onClanState);
    socket.on("clan:request", onClanRequest);
    socket.on("clan:closed", onClanClosed);
    socket.on("quest:state", onQuestState);
    socket.on("player:update", onPlayerUpdate);
    socket.on("player:move", onPlayerMove);
    socket.on("player:leave", onPlayerLeave);
    socket.on("players:list", onPlayersList);
    socket.on("chat:message", onChatMessage);
    socket.on("combat:damage", onCombatDamage);
    socket.on("combat:death", onCombatDeath);
    socket.on("skill:effect", onSkillEffect);
    socket.on("groundItems:update", onGroundItems);
    socket.on("npc:interact", onNpcInteract);
    socket.on("world:state", onWorldState);
    socket.on("monsters:update", onMonstersUpdate);
    socket.on("world:data", onWorldData);
    socket.on("world:chunk", onWorldChunk);
    socket.on("player:levelup", onLevelUp);
    socket.on("map:data", onMapData);
    socket.on("world:time", onWorldTime);
    socket.on("bank:state", onBankState);
    socket.on("trade:request", onTradeRequest);
    socket.on("trade:state", onTradeState);
    socket.on("trade:closed", onTradeClosed);
    socket.on("party:request", onPartyRequest);
    socket.on("party:state", onPartyState);
    socket.on("party:closed", onPartyClosed);
    socket.on("action:result", onActionResult);

    return () => {
      socket.off("player:update", onPlayerUpdate);
      socket.off("player:move", onPlayerMove);
      socket.off("player:leave", onPlayerLeave);
      socket.off("players:list", onPlayersList);
      socket.off("chat:message", onChatMessage);
      socket.off("combat:damage", onCombatDamage);
      socket.off("combat:death", onCombatDeath);
      socket.off("skill:effect", onSkillEffect);
      socket.off("groundItems:update", onGroundItems);
      socket.off("npc:interact", onNpcInteract);
      socket.off("world:state", onWorldState);
      socket.off("monsters:update", onMonstersUpdate);
      socket.off("world:data", onWorldData);
      socket.off("world:chunk", onWorldChunk);
      socket.off("player:levelup", onLevelUp);
      socket.off("map:data", onMapData);
      socket.off("world:time", onWorldTime);
      socket.off("bank:state", onBankState);
      socket.off("trade:request", onTradeRequest);
      socket.off("trade:state", onTradeState);
    socket.off("trade:closed", onTradeClosed);
    socket.off("party:request", onPartyRequest);
    socket.off("party:state", onPartyState);
    socket.off("party:closed", onPartyClosed);
    socket.off("clan:state", onClanState);
    socket.off("clan:request", onClanRequest);
    socket.off("clan:closed", onClanClosed);
    socket.off("quest:state", onQuestState);
    socket.off("action:result", onActionResult);
  };
  }, [player.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // Keyboard shortcuts for skills
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (chatFocused) return;
      const key = e.key.toLowerCase();
      const skillKeys: Record<string, string> = { q: "0", w: "1", e: "2" };
      if (key in skillKeys) {
        const idx = parseInt(skillKeys[key]);
        if (classSkills[idx]) {
          useSkill(classSkills[idx].id);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [classSkills, chatFocused]);

  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    if (text.startsWith("/comerciar ")) {
      const target = text.slice("/comerciar ".length).trim();
      if (target) getSocket().emit("trade:invite", target);
      setChatInput("");
      return;
    }
    if (text.startsWith("/party ")) {
      const target = text.slice("/party ".length).trim();
      if (target) getSocket().emit("party:invite", target);
      setChatInput("");
      return;
    }
    if (text === "/salir") {
      getSocket().emit("party:leave");
      setChatInput("");
      return;
    }
    if (text.startsWith("/quest ")) {
      const arg = text.slice(7).trim();
      if (arg.startsWith("aceptar ")) getSocket().emit("quest:accept", arg.slice(8).trim());
      else if (arg === "abandonar") getSocket().emit("quest:abandon");
      else if (arg === "reclamar") getSocket().emit("quest:claim");
      else setTradeNotice("Uso: /quest aceptar <id> | /quest abandonar | /quest reclamar");
      setChatInput("");
      return;
    }
    if (text.startsWith("/clan ")) {
      const rest = text.slice(6).trim();
      if (rest.startsWith("crear ")) getSocket().emit("clan:create", rest.slice(6).trim());
      else if (rest.startsWith("invitar ")) getSocket().emit("clan:invite", rest.slice(8).trim());
      else if (rest === "salir") getSocket().emit("clan:leave");
      else setTradeNotice("Uso: /clan crear <nombre> | /clan invitar <usuario> | /clan salir");
      setChatInput("");
      return;
    }
    if (text.startsWith("/c ")) {
      Audio.playChat();
      getSocket().emit("chat:send", text);
      setChatInput("");
      return;
    }
    if (text === "/reputacion" || text === "/rep") {
      const rep = (player as any).reputation as Record<string, number> | undefined;
      if (!rep || Object.keys(rep).length === 0) setTradeNotice("Sin reputación aún. Cazá en territorios de reinos.");
      else setTradeNotice(Object.entries(rep).map(([k, v]) => `${k}: ${v}`).join(" | "));
      setTimeout(() => setTradeNotice(null), 4000);
      setChatInput("");
      return;
    }
    if (text === "/recolectar") {
      getSocket().emit("gather");
      setChatInput("");
      return;
    }
    if (text === "/craftear") {
      setShowCrafting((v) => !v);
      setChatInput("");
      return;
    }
    Audio.playChat();
    getSocket().emit("chat:send", text);
    setChatInput("");
  }, [chatInput]);
  const handleRespawn = useCallback(() => { getSocket().emit("player:respawn"); setDeathScreen(false); Audio.playZoneChange(); }, []);
  const handleEquip = useCallback((slot: number) => { Audio.playEquip(); getSocket().emit("item:equip", slot); }, []);
  const handleUse = useCallback((slot: number) => { Audio.playUsePotion(); getSocket().emit("item:use", slot); }, []);
  const handleBuyItem = useCallback((itemId: string) => { Audio.playBuy(); getSocket().emit("npc:buy", itemId, 1); }, []);

  const useSkill = useCallback((skillId: string) => {
    const target = selectedTarget ?? undefined;
    getSocket().emit("skill:use", { skillId, targetId: target });
  }, [selectedTarget]);

  const handleJoystickMove = useCallback((dx: number, dy: number, dir: Direction) => {
    engineRef.current?.moveFromJoystick(dx, dy, dir);
  }, []);

  const handleJoystickRelease = useCallback(() => {
    engineRef.current?.stopFromJoystick();
  }, []);

  const handleMobileAttack = useCallback(() => {
    const target = selectedTarget ?? engineRef.current?.getNearestMonsterId() ?? undefined;
    if (target) getSocket().emit("combat:attack", target);
  }, [selectedTarget]);

  const zone = (() => {
    const m = player.mapId;
    if (m?.includes("rucci")) return MapZone.City;
    if (m?.includes("mazmorra")) return MapZone.Dungeon;
    return MapZone.Wilderness;
  })();

  useEffect(() => {
    Audio.resumeAudio();
    const zoneName = zone === MapZone.City ? "city" : zone === MapZone.Dungeon ? "dungeon" : "wilderness";
    Audio.startMusic(zoneName);
    Audio.startAmbient(zoneName);
    return () => { Audio.stopMusic(); Audio.stopAmbient(); };
  }, [zone]);

  const hpPct = (player.stats.hp / player.stats.maxHp) * 100;
  const mpPct = (player.stats.mp / player.stats.maxMp) * 100;
  const xpPct = player.level > 0 ? (player.experience / xpForLevel(player.level)) * 100 : 0;

  if (engineError) {
    return (
      <div className="game-container" style={{ paddingTop: safeAreaInset.top, paddingBottom: safeAreaInset.bottom }}>
        <canvas ref={canvasRef} id="game-canvas" />
        <div className="death-overlay" style={{ background: "rgba(10,10,15,0.95)" }}>
          <div className="death-title" style={{ fontSize: "clamp(1.5rem, 5vw, 2rem)" }}>⚠️ Error de Renderizado</div>
          <div className="death-text">{engineError}</div>
          <div className="death-text" style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            Intenta usar un navegador con soporte WebGL.
          </div>
          <button className="respawn-btn" onClick={onLogout}>↩ Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container" style={{ paddingTop: safeAreaInset.top, paddingBottom: safeAreaInset.bottom }}>
      {!engineReady && (
        <div className="death-overlay" style={{ background: "rgba(10,10,15,0.95)" }}>
          <div className="death-title" style={{ fontSize: "clamp(1.2rem, 4vw, 1.8rem)" }}>⚔️ Cargando mundo...</div>
        </div>
      )}
      <canvas ref={canvasRef} id="game-canvas" />

      {/* HUD */}
      <div className="hud">
        <div className="hud-bars">
          <div className="hud-bar"><div className="hud-bar-fill hp" style={{ width: `${hpPct}%` }} /><div className="hud-bar-text">HP {player.stats.hp}/{player.stats.maxHp}</div></div>
          <div className="hud-bar"><div className="hud-bar-fill mp" style={{ width: `${mpPct}%` }} /><div className="hud-bar-text">MP {player.stats.mp}/{player.stats.maxMp}</div></div>
          <div className="hud-bar"><div className="hud-bar-fill xp" style={{ width: `${xpPct}%` }} /><div className="hud-bar-text">XP {player.experience}/{xpForLevel(player.level)}</div></div>
        </div>
        <div className="hud-info">
          <span>Lv.{player.level}</span><span>💰 {player.gold}</span>
          <span className="hud-info-desktop">⚔️ {player.stats.strength}</span>
          <span className="hud-info-desktop">🛡️ {player.stats.constitution}</span>
        </div>
        <div className={`hud-zone ${zone === MapZone.City ? "safe" : "danger"}`}>
          {zone === MapZone.City ? "🟢 Segura" : zone === MapZone.Dungeon ? "🔴 Mazmorra" : "🔴 Peligrosa"}
        </div>
      </div>

      {/* Minimap */}
      {worldData && (
        <div className="minimap-wrapper">
          <Minimap world={worldData} playerPos={{ x: player.x, y: player.y }} />
        </div>
      )}

      {/* Chat */}
      <div className={`chat-panel ${chatFocused ? "chat-focused" : ""}`}>
        <div className="chat-messages">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`chat-msg ${msg.type}`}>
               {msg.type === "system" ? <span>{msg.message}</span> : <><span className="chat-user">{msg.channel === "party" ? "[Grupo] " : msg.channel === "clan" ? "[Clan] " : ""}{msg.username}:</span> {msg.message}</>}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-input-wrap">
          <input
            className="chat-input"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendChat(); e.stopPropagation(); }}
            onFocus={() => setChatFocused(true)}
            onBlur={() => setChatFocused(false)}
            placeholder="💬"
            autoComplete="off"
            enterKeyHint="send"
          />
          <button className="chat-send" onClick={sendChat}>➤</button>
        </div>
      </div>

      {/* Skill Bar */}
      <div className="skill-bar">
        {classSkills.map((skill, idx) => {
          const cdEnd = cooldowns[skill.id] ?? 0;
          const now = Date.now();
          const onCooldown = cdEnd > now;
          const cdRemaining = onCooldown ? Math.ceil((cdEnd - now) / 1000) : 0;
          const mpAvailable = player.stats.mp >= skill.manaCost;

          return (
            <div
              key={skill.id}
              className={`skill-slot ${onCooldown ? "on-cooldown" : ""} ${!mpAvailable && !onCooldown ? "no-mana" : ""}`}
              onClick={() => { if (!onCooldown && mpAvailable) useSkill(skill.id); }}
              title={`${skill.name} - ${skill.description}\nMP: ${skill.manaCost} | CD: ${skill.cooldownMs / 1000}s${!isMobile ? `\n[${["Q","W","E"][idx]}]` : ""}`}
            >
              <div className="skill-icon">{skill.icon}</div>
              {!isMobile && <div className="skill-key">{["Q","W","E"][idx]}</div>}
              <div className="skill-mana">{skill.manaCost}</div>
              {onCooldown && (
                <div className="skill-cooldown-overlay">
                  <span className="skill-cd-text">{cdRemaining}s</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        <div className="action-slot" onClick={() => setShowInventory(!showInventory)}>
          <span className="slot-key">{isMobile ? "" : "I"}</span>🎒
        </div>
        <div className="action-slot" onClick={() => { const hp = player.inventory?.find(i => i.itemId === "health_potion"); if (hp) handleUse(hp.slot); }}>
          <span className="slot-key">{isMobile ? "" : "1"}</span>🧪
          <span className="slot-count">{player.inventory?.find(i => i.itemId === "health_potion")?.quantity ?? 0}</span>
        </div>
        <div className="action-slot" onClick={() => { const mp = player.inventory?.find(i => i.itemId === "mana_potion"); if (mp) handleUse(mp.slot); }}>
          <span className="slot-key">{isMobile ? "" : "2"}</span>💧
          <span className="slot-count">{player.inventory?.find(i => i.itemId === "mana_potion")?.quantity ?? 0}</span>
        </div>
        <div className="action-slot" onClick={() => { const b = player.inventory?.find(i => i.itemId === "bandage"); if (b) handleUse(b.slot); }}>
          <span className="slot-key">{isMobile ? "" : "3"}</span>🩹
          <span className="slot-count">{player.inventory?.find(i => i.itemId === "bandage")?.quantity ?? 0}</span>
        </div>
      </div>

      {/* Active Buffs */}
      {player.buffs && player.buffs.length > 0 && (
        <div className="buff-bar">
          {player.buffs.map((buff, i) => {
            const remaining = Math.max(0, Math.ceil((buff.expiresAt - Date.now()) / 1000));
            const buffIcons: Record<string, string> = {
              strength: "💪", dodge: "💨", invuln: "👼", shield_absorb: "🧊",
              poison: "☠️", stun: "💫",
            };
            return (
              <div key={i} className="buff-icon" title={`${buff.type}: ${buff.value}`}>
                {buffIcons[buff.type] ?? "✦"}<span className="buff-timer">{remaining}s</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile Virtual Controls */}
      {isMobile && !chatFocused && !npcPanel && !showInventory && !deathScreen && (
        <VirtualJoystick onMove={handleJoystickMove} onRelease={handleJoystickRelease} onAttack={handleMobileAttack} />
      )}

      {/* Inventory Panel */}
      {showInventory && (
        <div className="inventory-panel">
          <div className="inventory-title">🎒 Inventario</div>
          <div className="inventory-grid">
            {Array.from({ length: 16 }, (_, i) => {
              const item = player.inventory?.find(inv => inv.slot === i);
              return (
                <div key={i} className={`inventory-slot ${item ? "has-item" : ""}`} onClick={() => item && handleEquip(item.slot)}>
                  {item && (<><span>{ITEM_ICONS[item.itemId] ?? "?"}</span>{item.quantity > 1 && <span className="item-count">{item.quantity}</span>}</>)}
                </div>
              );
            })}
          </div>
          <div className="equipment-section">
            <div className="equipment-title">Equipo</div>
            <div className="equipment-grid">
              {(["weapon", "armor", "shield", "head", "boots", "ring"] as string[]).map((slot) => {
                const equipped = (player.equipment as any)?.[slot];
                return (
                  <div key={slot} className={`equip-slot ${equipped ? "filled" : ""}`}>
                    <div className="equip-slot-label">{SLOT_LABELS[slot] ?? slot}</div>
                    <div>{equipped ? (ITEM_ICONS[equipped] ?? "?") : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <button className="npc-close" onClick={() => setShowInventory(false)}>Cerrar</button>
        </div>
      )}

      {/* NPC Panel */}
      {npcPanel && (
        <div className="npc-panel">
          <div className="npc-name">{npcPanel.name}</div>
          <div className="npc-dialogue">{npcPanel.dialogue}</div>

          {npcPanel.isBanker && bankState && (
            <div className="bank-section">
              <div className="bank-gold">🏦 Bóveda: <strong>💰 {bankState.gold}</strong></div>
              <div className="bank-actions">
                <button onClick={() => {
                  const amt = Number(window.prompt(`¿Cuánto oro depositás? (tenés ${player.gold})`, "0"));
                  if (amt > 0) getSocket().emit("bank:gold", "deposit", Math.floor(amt));
                }}>⬇️ Depositar</button>
                <button onClick={() => {
                  const amt = Number(window.prompt(`¿Cuánto oro retirás? (bóveda: ${bankState.gold})`, "0"));
                  if (amt > 0) getSocket().emit("bank:gold", "withdraw", Math.floor(amt));
                }}>⬆️ Retirar</button>
              </div>
              {player.gold >= 0 && (
                <div className="bank-items">
                  {bankState.items.length === 0 && <div className="bank-empty">Bóveda vacía</div>}
                  {bankState.items.map((bi) => (
                    <div key={bi.itemId} className="shop-item" onClick={() => {
                      const qty = Number(window.prompt(`¿Cuántos ${bi.name} retirás? (hay ${bi.quantity})`, "1"));
                      if (qty > 0) getSocket().emit("bank:item", "withdraw", bi.itemId, Math.floor(qty));
                    }}>
                      <span>{ITEM_ICONS[bi.itemId] ?? "?"} {bi.name} x{bi.quantity}</span>
                      <span className="shop-item-price">tocar p/ retirar</span>
                    </div>
                  ))}
                  <div className="bank-deposit-hint">— Tu inventario (tocá para depositar) —</div>
                  {player.inventory.length === 0 && <div className="bank-empty">Inventario vacío</div>}
                  {player.inventory.map((inv) => (
                    <div key={inv.slot} className="shop-item" onClick={() => {
                      const qty = Number(window.prompt(`¿Cuántos ${ITEMS[inv.itemId]?.name ?? inv.itemId} depositás? (tenés ${inv.quantity})`, `${inv.quantity}`));
                      if (qty > 0) getSocket().emit("bank:item", "deposit", String(inv.slot), Math.floor(qty));
                    }}>
                      <span>{ITEM_ICONS[inv.itemId] ?? "?"} {ITEMS[inv.itemId]?.name ?? inv.itemId} x{inv.quantity}</span>
                      <span className="shop-item-price">tocar p/ depositar</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {npcPanel.shopItems && npcPanel.shopItems.length > 0 && (
            <div className="shop-items">
              {npcPanel.shopItems.map((item) => (
                <div key={item.id} className="shop-item" onClick={() => handleBuyItem(item.id)}>
                  <span className="shop-item-name">{ITEM_ICONS[item.id] ?? "?"} {item.name}</span>
                  <span className="shop-item-price">💰 {item.buyPrice}</span>
                </div>
              ))}
            </div>
          )}
          <button className="npc-close" onClick={() => setNpcPanel(null)}>Cerrar</button>
        </div>
      )}

      {/* Crafting Panel */}
      {showCrafting && (
        <div className="trade-panel">
          <div className="npc-name">🔨 Mesa de Crafteo</div>
          <div className="craft-list">
            {RECIPES.map((recipe) => {
              const canCraft = recipe.ingredients.every((ing) =>
                player.inventory.filter((i) => i.itemId === ing.itemId).reduce((s, i) => s + i.quantity, 0) >= ing.quantity
              );
              return (
                <div key={recipe.id} className={`craft-recipe ${canCraft ? "available" : ""}`}>
                  <div className="craft-head">
                    <span>{ITEM_ICONS[recipe.resultItemId] ?? "?"} {recipe.name}</span>
                    {canCraft && (
                      <button onClick={() => getSocket().emit("crafting:craft", recipe.id)}>Forjar</button>
                    )}
                  </div>
                  <div className="craft-ing">
                    {recipe.ingredients.map((ing) => {
                      const have = player.inventory.filter((i) => i.itemId === ing.itemId).reduce((s, i) => s + i.quantity, 0);
                      return (
                        <span key={ing.itemId} className={have >= ing.quantity ? "have" : "missing"}>
                          {ITEM_ICONS[ing.itemId] ?? "?"} {ITEMS[ing.itemId]?.name ?? ing.itemId}: {have}/{ing.quantity}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <button className="npc-close" onClick={() => setShowCrafting(false)}>Cerrar</button>
        </div>
      )}

      {/* Trade Panel */}
      {tradeState && (
        <div className="trade-panel">
          <div className="npc-name">🤝 Comercio con {tradeState.partnerName}</div>
          <div className="trade-columns">
            <div className="trade-col">
              <div className="trade-col-title">Ofrecés</div>
              <div className="trade-gold">💰 {tradeState.myOffer.gold}</div>
              {tradeState.myOffer.items.map((i) => (
                <div key={i.slot} className="shop-item">
                  <span>{ITEM_ICONS[i.itemId] ?? "?"} {ITEMS[i.itemId]?.name ?? i.itemId} x{i.quantity}</span>
                </div>
              ))}
              {tradeState.myOffer.items.length === 0 && <div className="bank-empty">Sin ítems</div>}
              <div className={`trade-confirm ${tradeState.myOffer.confirmed ? "ok" : ""}`}>
                {tradeState.myOffer.confirmed ? "✔ Confirmado" : "Sin confirmar"}
              </div>
            </div>
            <div className="trade-col">
              <div className="trade-col-title">{tradeState.partnerName} ofrece</div>
              <div className="trade-gold">💰 {tradeState.theirOffer.gold}</div>
              {tradeState.theirOffer.items.map((i, idx) => (
                <div key={idx} className="shop-item">
                  <span>{ITEM_ICONS[i.itemId] ?? "?"} {ITEMS[i.itemId]?.name ?? i.itemId} x{i.quantity}</span>
                </div>
              ))}
              {tradeState.theirOffer.items.length === 0 && <div className="bank-empty">Sin ítems</div>}
              <div className={`trade-confirm ${tradeState.theirOffer.confirmed ? "ok" : ""}`}>
                {tradeState.theirOffer.confirmed ? "✔ Confirmado" : "Sin confirmar"}
              </div>
            </div>
          </div>
          <div className="trade-actions">
            <button onClick={() => {
              const amt = Number(window.prompt(`¿Cuánto oro ofrecés? (tenés ${player.gold})`, "0"));
              if (amt >= 0) getSocket().emit("trade:addGold", Math.floor(amt));
            }}>💰 Ofrecer oro</button>
            <button onClick={() => {
              const slot = Number(window.prompt(`Slot del ítem a ofrecer (0-19):`, "0"));
              const qty = Number(window.prompt("Cantidad:", "1"));
              if (!Number.isNaN(slot)) getSocket().emit("trade:addItem", slot, Math.max(1, qty));
            }}>🎒 Ofrecer ítem</button>
          </div>
          <div className="trade-actions">
            <button className="trade-ok" onClick={() => getSocket().emit("trade:confirm")}>✔ Confirmar</button>
            <button className="trade-no" onClick={() => getSocket().emit("trade:cancel")}>✖ Cancelar</button>
          </div>
        </div>
      )}

      {/* Trade notice */}
      {tradeNotice && (
        <div className="trade-notice">{tradeNotice}</div>
      )}

      {/* Party Panel */}
      {partyState && (
        <div className="party-panel">
          <div className="party-title">⚔️ Grupo</div>
          {partyState.members.map((m) => (
            <div key={m.id} className={`party-member ${m.isLeader ? "leader" : ""}`}>
              <span>{m.isLeader ? "👑" : "•"} {m.username}</span>
              <span>Nv.{m.level}</span>
            </div>
          ))}
          <button className="party-leave" onClick={() => getSocket().emit("party:leave")}>Salir</button>
        </div>
      )}

      {/* Clan Panel */}
      {clanState && (
        <div className="party-panel" style={{ top: partyState ? "calc(230px + var(--safe-top))" : "calc(150px + var(--safe-top))" }}>
          <div className="party-title">🏰 {clanState.name}</div>
          {clanState.members.map((m) => (
            <div key={m.id} className={`party-member ${m.isLeader ? "leader" : ""}`}>
              <span>{m.isLeader ? "👑" : "•"} {m.username}</span>
              <span>Nv.{m.level}</span>
            </div>
          ))}
          <button className="party-leave" onClick={() => getSocket().emit("clan:leave")}>Salir del clan</button>
        </div>
      )}

      {/* Quest Panel */}
      <div className="quest-hud">
        {questState ? (
          <div className="quest-card">
            <div className="quest-title">📜 {questState.name}</div>
            <div className="quest-progress">{questState.progress}/{questState.required} {questState.completed ? "✔" : ""}</div>
            <div className="quest-actions">
              {questState.completed ? (
                <button onClick={() => getSocket().emit("quest:claim")}>Reclamar</button>
              ) : (
                <button onClick={() => getSocket().emit("quest:abandon")}>Abandonar</button>
              )}
            </div>
          </div>
        ) : (
          <div className="quest-list">
            {QUESTS.map((q) => (
              <div key={q.id} className="quest-option">
                <span>{q.name} — {q.description}</span>
                <button onClick={() => getSocket().emit("quest:accept", q.id)}>Aceptar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Damage Numbers */}
      {damageNumbers.map((d) => (
        <div key={d.id} className={`damage-float ${d.isCrit ? "crit" : ""} ${d.isHeal ? "heal" : ""}`} style={{ left: d.x, top: d.y }}>
          {d.isHeal ? `+${d.amount}` : `-${d.amount}`}
        </div>
      ))}

      {/* Level Up Toast */}
      {levelUpToast && (
        <div className="levelup-toast">
          <div className="levelup-toast-title">⭐ ¡Nivel {levelUpToast.level}! ⭐</div>
          {levelUpToast.newUnlocks.length > 0 && (
            <div className="levelup-toast-unlock">🔓 Habilidad desbloqueada: {levelUpToast.newUnlocks.join(", ")}</div>
          )}
          <div className="levelup-toast-sub">+3 puntos de stat disponibles</div>
        </div>
      )}

      {/* Stat Panel Button */}
      {(player.statPoints ?? 0) > 0 && !showStatPanel && !deathScreen && !engineError && (
        <button className="stat-btn-float" onClick={() => setShowStatPanel(true)}>
          ⬆️ Stat ({player.statPoints})
        </button>
      )}

      {/* Stat Panel */}
      {showStatPanel && (
        <StatPanel player={player} onClose={() => setShowStatPanel(false)} />
      )}

      {/* Death Screen */}
      {deathScreen && (
        <div className="death-overlay">
          <div className="death-title">💀 Has Muerto</div>
          <div className="death-text">Perdiste un poco de oro. La ciudad de Rucci te espera.</div>
          <button className="respawn-btn" onClick={handleRespawn}>⚔️ Resucitar en Rucci</button>
        </div>
      )}
    </div>
  );
}
