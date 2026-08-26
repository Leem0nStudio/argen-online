// ============================================================
// Socket Handlers — Wire socket events to game modules
// ============================================================

import type { Server, Socket } from "socket.io";
import type { ClientEvents, ServerEvents } from "../../shared/types.js";
import { Direction } from "../../shared/types.js";
import { ITEMS } from "../../shared/items.js";
import {
  registerPlayer, authenticatePlayer, getPlayer as getDbPlayer,
  savePlayer, saveInventory, saveEquipment,
} from "../db/database.js";
import {
  Players, Ground, SpawnState,
} from "../game/state.js";
import {
  movePlayer, stopPlayer, respawnPlayer,
} from "../game/movement.js";
import { tryAttack, grantXp } from "../game/combat.js";
import { useSkill } from "../game/skills.js";
import { pickupItem, equipItem, useConsumable } from "../game/inventory.js";
import { addChatMessage, addSystemMessage } from "../game/chat.js";
import { getNPC, npcBuyItem, npcSellItem } from "../game/npc.js";
import { spawnMonstersForMap, getMonstersAsData } from "../game/monster-ai.js";
import { getWorldMap, getWorldDataForClient } from "../game/world.js";
import {
  depositGold, withdrawGold, getBankSummary, depositItem, withdrawItem,
} from "../game/bank.js";
import * as Trade from "../game/trade.js";
import * as Party from "../game/party.js";
import * as Clan from "../game/clan.js";
import * as Quest from "../game/quest.js";
import { gather } from "../game/gathering.js";
import { craft } from "../game/crafting.js";
import { getPlayersOnMap } from "./helpers.js";

type GameServer = Server<ClientEvents, ServerEvents>;
type GameSocket = Socket<ClientEvents, ServerEvents>;

function ensureMonsters(mapId: string) {
  if (!SpawnState.hasSpawned(mapId)) {
    spawnMonstersForMap(mapId);
    SpawnState.markSpawned(mapId);
  }
}

/** Push current trade state to both participants of the session the player is in */
function broadcastTradeState(io: GameServer, playerId: string) {
  const session = Trade.getSession(playerId);
  if (!session) return;
  for (const pid of [session.aId, session.bId]) {
    const partner = Players.get(pid === session.aId ? session.bId : session.aId);
    if (!partner) continue;
    io.to(pid).emit("trade:state", {
      partnerName: partner.username,
      myOffer: pid === session.aId ? session.aOffer : session.bOffer,
      theirOffer: pid === session.aId ? session.bOffer : session.aOffer,
    });
  }
}

/** Push party roster to every member */
function broadcastPartyState(io: GameServer, party: import("../game/party.js").Party) {
  const state = Party.stateFor(party);
  for (const id of party.memberIds) io.to(id).emit("party:state", state);
}

/** Push clan roster to every member */
function broadcastClanState(io: GameServer, clan: import("../game/clan.js").Clan) {
  const state = Clan.stateFor(clan);
  for (const id of clan.memberIds) io.to(id).emit("clan:state", state);
}

function sendMapState(socket: GameSocket, mapId: string) {
  const player = Players.get(socket.data.playerId!);
  if (!player) return;
  socket.join(mapId);
  ensureMonsters(mapId);
  socket.emit("world:state", {
    players: getPlayersOnMap(mapId),
    groundItems: Ground.onMap(mapId),
    mapId,
  });
  socket.emit("monsters:update", getMonstersAsData(mapId));
  // Send full settlement map data so the client can render it
  if (mapId !== "world") {
    try {
      const map = getWorldMap().getMap(mapId);
      if (map) socket.emit("map:data", JSON.parse(JSON.stringify(map)));
    } catch { /* world not ready */ }
  }
  // Send procedural world data to client
  try {
    socket.emit("world:data", getWorldDataForClient());
  } catch { /* world not ready */ }
}

export function setupHandlers(io: GameServer) {
  io.on("connection", (socket: GameSocket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on("auth:register", (data) => {
      try {
        const id = registerPlayer(data.username, data.password, data.characterClass);
        const player = getDbPlayer(id);
        if (!player) {
          socket.emit("auth:error", "Error al crear personaje");
          return;
        }
        Players.set(player);
        socket.data.playerId = id;
        socket.join(id); // personal room addressed by player id
        socket.emit("auth:success", player);
        sendMapState(socket, player.mapId);
        io.emit("players:list", getPlayersOnMap(player.mapId));
        io.emit("chat:message", addSystemMessage(`${player.username} ha entrado al mundo.`));
        // Quest state for new player (none yet)
        socket.emit("quest:state", null);
      } catch (err: any) {
        socket.emit("auth:error", err.message?.includes("UNIQUE") ? "Nombre ya existe" : "Error al registrar");
      }
    });

    socket.on("auth:login", (data) => {
      const playerId = authenticatePlayer(data.username, data.password);
      if (!playerId) {
        socket.emit("auth:error", "Usuario o contraseña incorrectos");
        return;
      }
      const player = getDbPlayer(playerId);
      if (!player) {
        socket.emit("auth:error", "Error al cargar personaje");
        return;
      }
      Players.set(player);
      socket.data.playerId = playerId;
      socket.join(playerId); // personal room addressed by player id
      socket.emit("auth:success", player);
      sendMapState(socket, player.mapId);
      io.emit("players:list", getPlayersOnMap(player.mapId));
      io.emit("chat:message", addSystemMessage(`${player.username} ha regresado.`));
      // Restore quest state
      const q = Quest.getActiveQuest(playerId);
      if (q) socket.emit("quest:state", { questId: q.questId, progress: q.progress, required: q.def.required, completed: q.completed, name: q.def.name });
      else socket.emit("quest:state", null);
    });

    socket.on("player:move", (data) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const result = movePlayer(playerId, data.x, data.y, data.direction);
      if (!result) return;

      if (result.teleported) {
        const player = Players.get(playerId);
        if (player) {
          socket.emit("player:update", { ...player } as any);
          sendMapState(socket, player.mapId);
          io.emit("players:list", getPlayersOnMap(player.mapId));
        }
      } else {
        const player = Players.get(playerId);
        if (player) {
          socket.to(player.mapId).emit("player:move", {
            id: playerId, x: data.x, y: data.y, direction: data.direction, isMoving: true,
          });
        }
      }
    });

    socket.on("player:stop", (data) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      stopPlayer(playerId, data.x, data.y, data.direction);
      const player = Players.get(playerId);
      if (player) {
        socket.to(player.mapId).emit("player:move", {
          id: playerId, x: data.x, y: data.y, direction: data.direction, isMoving: false,
        });
      }
    });

    socket.on("chat:send", (message) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const player = Players.get(playerId);
      if (!player) return;

      // Party chat: /p mensaje
      if (message.startsWith("/p ")) {
        const party = Party.getPartyOf(playerId);
        if (!party) return;
        const text = message.slice(3).trim().slice(0, 200);
        if (!text) return;
        const msg = addChatMessage(playerId, player.username, text);
        for (const id of party.memberIds) {
          io.to(id).emit("chat:message", { ...msg, channel: "party" });
        }
        return;
      }
      // Clan chat: /c mensaje
      if (message.startsWith("/c ")) {
        const clan = Clan.getClanOf(playerId);
        if (!clan) return;
        const text = message.slice(3).trim().slice(0, 200);
        if (!text) return;
        const msg = addChatMessage(playerId, player.username, text);
        for (const id of clan.memberIds) {
          io.to(id).emit("chat:message", { ...msg, channel: "clan" });
        }
        return;
      }

      const msg = addChatMessage(playerId, player.username, message);
      io.emit("chat:message", msg);
    });

    socket.on("combat:attack", (targetId) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const event = tryAttack(playerId, targetId);
      if (!event) return;
      io.emit("combat:damage", event);

      // Monster killed by melee: broadcast loot drop and level-up (party-shared)
      if (event.xpGained !== undefined) {
        const killer = Players.get(playerId);
        if (killer) {
          io.emit("groundItems:update", Ground.onMap(killer.mapId));
          // Notify all party members who shared the kill (they already got XP via sharedXpOnKill)
          const party = Party.getPartyOf(playerId);
          if (party) {
            for (const pid of party.memberIds) {
              const member = Players.get(pid);
              if (member) {
                io.to(pid).emit("player:update", { ...member } as any);
                // Quest progress update
                const q = Quest.getActiveQuest(pid);
                if (q) io.to(pid).emit("quest:state", { questId: q.questId, progress: q.progress, required: q.def.required, completed: q.completed, name: q.def.name });
              }
            }
          } else {
            // Solo kill: quest progress for killer
            const q = Quest.getActiveQuest(playerId);
            if (q) socket.emit("quest:state", { questId: q.questId, progress: q.progress, required: q.def.required, completed: q.completed, name: q.def.name });
          }
          if (event.levelUp) {
            io.emit("chat:message", addSystemMessage(`⚔️ ${killer.username} ha alcanzado el nivel ${killer.level}!`));
          }
        }
      }

      const victim = Players.get(targetId);
      const monster = Monsters.get(targetId);
      if (victim && victim.stats.hp <= 0) {
        io.emit("combat:death", { killerId: playerId, victimId: targetId });
        const killer = Players.get(playerId);
        io.emit("chat:message", addSystemMessage(`${killer?.username} ha derrotado a ${victim.username}!`));
        io.to(targetId).emit("player:update", { ...victim } as any);
        io.emit("groundItems:update", Ground.onMap(victim.mapId));
      }
      // XP from monster kill
      if (monster && monster.hp <= 0) {
        const killer = Players.get(playerId);
        if (killer) {
          const xpResult = grantXp(killer, monster.xpReward);
          io.emit("combat:damage", { attackerId: playerId, defenderId: targetId, damage: 0, isCrit: false, timestamp: Date.now(), xp: monster.xpReward });
          if (xpResult.leveledUp) {
            socket.emit("player:levelup", { level: xpResult.newLevel, statPoints: xpResult.totalStatPoints, newUnlocks: xpResult.newUnlocks });
            io.emit("chat:message", addSystemMessage(`¡${killer.username} ha subido al nivel ${xpResult.newLevel}!`));
          }
        }
      }

      const attacker = Players.get(playerId);
      if (attacker) socket.emit("player:update", attacker);
    });

    socket.on("skill:use", (data) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const event = useSkill(playerId, data.skillId, data.targetId);
      if (!event) return;

      io.emit("skill:effect", event);

      if (event.damage && event.damage > 0 && event.targetId) {
        io.emit("combat:damage", {
          attackerId: playerId, defenderId: event.targetId,
          damage: event.damage, isCrit: false, timestamp: Date.now(),
        });
      }

      if (event.aoe && event.damage) {
        io.emit("combat:damage", {
          attackerId: playerId, defenderId: playerId,
          damage: 0, isCrit: false, timestamp: Date.now(),
        });
      }

      // Skill kills drop loot too — broadcast it
      const caster = Players.get(playerId);
      if (caster) io.emit("groundItems:update", Ground.onMap(caster.mapId));

      const player = Players.get(playerId);
      if (player) socket.emit("player:update", player);
    });

    // ---- Bank ----

    socket.on("bank:gold", (action, amount) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const ok = action === "deposit" ? depositGold(playerId, amount) : withdrawGold(playerId, amount);
      if (!ok) return;
      const player = Players.get(playerId);
      if (player) {
        savePlayer(player);
        socket.emit("player:update", { ...player } as any);
        socket.emit("bank:state", getBankSummary(playerId));
      }
    });

    socket.on("bank:item", (action, itemId, quantity) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const ok = action === "deposit"
        ? depositItem(playerId, Number(itemId), quantity)
        : withdrawItem(playerId, String(itemId), quantity);
      if (!ok) return;
      const player = Players.get(playerId);
      if (player) {
        savePlayer(player);
        saveInventory(playerId, player.inventory);
        socket.emit("player:update", { ...player } as any);
        socket.emit("bank:state", getBankSummary(playerId));
      }
    });

    // ---- Player-to-player trade ----

    socket.on("trade:invite", (targetUsername) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const from = Players.get(playerId);
      const result = Trade.invite(playerId, from?.username ?? "?", targetUsername);
      if (!result.ok || !result.targetId) {
        socket.emit("trade:closed", { reason: result.error ?? "No se pudo iniciar el comercio" });
        return;
      }
      io.to(result.targetId).emit("trade:request", { fromId: playerId, fromName: from?.username ?? "?" });
    });

    socket.on("trade:accept", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const session = Trade.accept(playerId);
      if (!session) return;
      for (const pid of [session.aId, session.bId]) {
        const partner = Players.get(pid === session.aId ? session.bId : session.aId)!;
        io.to(pid).emit("trade:state", {
          partnerName: partner.username,
          myOffer: pid === session.aId ? session.aOffer : session.bOffer,
          theirOffer: pid === session.aId ? session.bOffer : session.aOffer,
        });
      }
    });

    socket.on("trade:decline", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const invite = Trade.getInvite(playerId);
      Trade.cancelInvite(playerId);
      if (invite) io.to(invite.fromId).emit("trade:closed", { reason: "Rechazó tu oferta de comercio" });
    });

    socket.on("trade:addItem", (slot, quantity) => {
      const playerId = socket.data.playerId;
      if (!playerId || !Trade.addItem(playerId, slot, quantity)) return;
      broadcastTradeState(io, playerId);
    });

    socket.on("trade:addGold", (amount) => {
      const playerId = socket.data.playerId;
      if (!playerId || !Trade.addGold(playerId, amount)) return;
      broadcastTradeState(io, playerId);
    });

    socket.on("trade:confirm", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const result = Trade.confirm(playerId);
      if (!result.aId || !result.bId) return;
      for (const pid of [result.aId, result.bId]) {
        io.to(pid).emit("trade:closed", { reason: result.reason });
        const p = Players.get(pid);
        if (p && result.completed) {
          savePlayer(p);
          saveInventory(pid, p.inventory);
          io.to(pid).emit("player:update", { ...p } as any);
        }
      }
      if (result.completed) {
        const a = Players.get(result.aId), b = Players.get(result.bId);
        if (a && b) io.emit("chat:message", addSystemMessage(`${a.username} y ${b.username} completaron un comercio.`));
      }
    });

    socket.on("trade:cancel", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const closed = Trade.cancel(playerId);
      if (closed) {
        for (const pid of [closed.aId, closed.bId]) {
          io.to(pid).emit("trade:closed", { reason: "Comercio cancelado" });
        }
      }
    });

    // ---- Party ----

    socket.on("party:invite", (targetUsername) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const from = Players.get(playerId);
      const result = Party.invite(playerId, from?.username ?? "?", targetUsername);
      if (!result.ok || !result.targetId) return;
      io.to(result.targetId).emit("party:request", { fromId: playerId, fromName: from?.username ?? "?" });
    });

    socket.on("party:accept", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const result = Party.accept(playerId);
      if (!result) return;
      const newMember = Players.get(playerId);
      if (newMember) {
        for (const id of result.party.memberIds) {
          io.to(id).emit("chat:message", addSystemMessage(`${newMember.username} se unió al grupo.`));
        }
      }
      broadcastPartyState(io, result.party);
    });

    socket.on("party:decline", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const invite = Party.getInvite(playerId);
      Party.cancelInvite(playerId);
      if (invite) io.to(invite.fromId).emit("party:closed", { reason: "Rechazó tu invitación al grupo" });
    });

    socket.on("party:leave", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const partyBefore = Party.getPartyOf(playerId);
      const result = Party.leave(playerId);
      if (result.dissolved) {
        if (partyBefore) for (const id of partyBefore.memberIds) io.to(id).emit("party:state", { members: [] });
        return;
      }
      const leaver = Players.get(playerId);
      if (partyBefore && leaver) {
        for (const id of partyBefore.memberIds) {
          io.to(id).emit("chat:message", addSystemMessage(`${leaver.username} dejó el grupo.`));
          const p = Party.getPartyOf(id);
          if (p) io.to(id).emit("party:state", Party.stateFor(p));
        }
        io.to(playerId).emit("party:state", { members: [] });
      }
    });

    // ---- Clan ----

    socket.on("clan:create", (name) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const result = Clan.createClan(playerId, name);
      if (!result.ok || !result.clan) {
        socket.emit("clan:closed", { reason: result.error ?? "Error" });
        return;
      }
      broadcastClanState(io, result.clan);
      io.emit("chat:message", addSystemMessage(`${Players.get(playerId)?.username} fundó el clan ${result.clan.name}!`));
    });

    socket.on("clan:invite", (targetUsername) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const from = Players.get(playerId);
      const result = Clan.invite(playerId, from?.username ?? "?", targetUsername);
      if (!result.ok || !result.targetId) {
        socket.emit("clan:closed", { reason: result.error ?? "Error" });
        return;
      }
      const clan = Clan.getClanOf(playerId)!;
      io.to(result.targetId).emit("clan:request", { fromId: playerId, fromName: from?.username ?? "?", clanName: clan.name });
    });

    socket.on("clan:accept", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const clan = Clan.accept(playerId);
      if (!clan) return;
      const member = Players.get(playerId);
      if (member) {
        for (const id of clan.memberIds) {
          io.to(id).emit("chat:message", addSystemMessage(`${member.username} se unió al clan ${clan.name}.`));
        }
      }
      broadcastClanState(io, clan);
    });

    socket.on("clan:decline", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const inv = Clan.getInvite(playerId);
      Clan.decline(playerId);
      if (inv) io.to(inv.fromId).emit("clan:closed", { reason: "Rechazó tu invitación al clan" });
    });

    socket.on("clan:leave", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const clanBefore = Clan.getClanOf(playerId);
      const result = Clan.leave(playerId);
      if (result.dissolved) {
        if (clanBefore) for (const id of clanBefore.memberIds) io.to(id).emit("clan:state", null as any);
        return;
      }
      const leaver = Players.get(playerId);
      if (clanBefore && leaver) {
        for (const id of clanBefore.memberIds) {
          io.to(id).emit("chat:message", addSystemMessage(`${leaver.username} dejó el clan.`));
          const c = Clan.getClanOf(id);
          if (c) io.to(id).emit("clan:state", Clan.stateFor(c));
        }
        io.to(playerId).emit("clan:state", null as any);
      }
    });

    socket.on("item:pickup", (groundItemId) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      if (pickupItem(playerId, groundItemId)) {
        const player = Players.get(playerId);
        if (player) {
          socket.emit("player:update", player);
          io.emit("groundItems:update", Ground.onMap(player.mapId));
        }
      }
    });

    socket.on("item:equip", (inventorySlot) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      if (equipItem(playerId, inventorySlot)) {
        const player = Players.get(playerId);
        if (player) socket.emit("player:update", player);
      }
    });

    socket.on("item:use", (inventorySlot) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      if (useConsumable(playerId, inventorySlot)) {
        const player = Players.get(playerId);
        if (player) {
          socket.emit("player:update", player);
          socket.emit("combat:damage", {
            attackerId: playerId, defenderId: playerId,
            damage: 0, isCrit: false, timestamp: Date.now(),
          });
        }
      }
    });

    socket.on("item:drop", (inventorySlot, quantity) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const player = Players.get(playerId);
      if (player) socket.emit("player:update", player);
    });

    socket.on("npc:interact", (npcId) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const player = Players.get(playerId);
      if (!player) return;
      const npc = getNPC(player.mapId, npcId);
      if (!npc) return;
      const dialogue = npc.dialogue[Math.floor(Math.random() * npc.dialogue.length)];
      const shopItems = npc.shopItems?.map(id => ITEMS[id]).filter(Boolean);
      socket.emit("npc:interact", { npcId, dialogue, shopItems, isBanker: npc.type === "banker" });
      if (npc.type === "banker") {
        socket.emit("bank:state", getBankSummary(playerId));
      }
    });

    socket.on("npc:buy", (itemId, quantity) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      if (npcBuyItem(playerId, itemId, quantity)) {
        const player = Players.get(playerId);
        if (player) socket.emit("player:update", player);
      }
    });

    socket.on("npc:sell", (inventorySlot, quantity) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      if (npcSellItem(playerId, inventorySlot, quantity)) {
        const player = Players.get(playerId);
        if (player) socket.emit("player:update", player);
      }
    });

    socket.on("player:respawn", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      respawnPlayer(playerId);
      const player = Players.get(playerId);
      if (player) {
        socket.emit("auth:success", player);
        sendMapState(socket, player.mapId);
        io.emit("players:list", getPlayersOnMap(player.mapId));
      }
    });

    // ---- Quests ----

    const sendQuestState = (playerId: string) => {
      const q = Quest.getActiveQuest(playerId);
      if (!q) socket.emit("quest:state", null);
      else socket.emit("quest:state", { questId: q.questId, progress: q.progress, required: q.def.required, completed: q.completed, name: q.def.name });
    };

    socket.on("quest:accept", (questId) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const r = Quest.acceptQuest(playerId, questId);
      socket.emit("action:result", { ok: r.ok, message: r.message });
      sendQuestState(playerId);
    });

    socket.on("quest:abandon", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const r = Quest.abandonQuest(playerId);
      socket.emit("action:result", { ok: r.ok, message: r.message });
      sendQuestState(playerId);
    });

    socket.on("quest:claim", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const r = Quest.claimReward(playerId);
      socket.emit("action:result", { ok: r.ok, message: r.message });
      if (r.ok) {
        const player = Players.get(playerId);
        if (player) socket.emit("player:update", { ...player } as any);
      }
      sendQuestState(playerId);
    });

    // ---- Gathering & Crafting ----

    socket.on("gather", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const result = gather(playerId);
      socket.emit("action:result", { ok: result.ok, message: result.message });
      if (result.ok) {
        const player = Players.get(playerId);
        if (player) {
          saveInventory(playerId, player.inventory);
          socket.emit("player:update", { ...player } as any);
        }
      }
    });

    socket.on("crafting:craft", (recipeId) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const result = craft(playerId, recipeId);
      socket.emit("action:result", { ok: result.ok, message: result.message });
      if (result.ok) {
        const player = Players.get(playerId);
        if (player) {
          savePlayer(player);
          saveInventory(playerId, player.inventory);
          socket.emit("player:update", { ...player } as any);
        }
      }
    });

    // ---- Procedural world chunk streaming ----
    socket.on("world:request", (data) => {
      try {
        const wm = getWorldMap();
        const radiusChunks = Math.max(1, Math.min(3, Math.ceil((data.radius ?? 40) / 64)));
        const { rx: prx, ry: pry } = wm.chunkCoordsAt(data.wx, data.wy);
        for (let ry = pry - radiusChunks; ry <= pry + radiusChunks; ry++) {
          for (let rx = prx - radiusChunks; rx <= prx + radiusChunks; rx++) {
            if (!wm.isChunkInBounds(rx, ry)) continue;
            const tiles = wm.getChunkTiles(rx * 64 + 32, ry * 64 + 32);
            socket.emit("world:chunk", { rx, ry, tiles });
          }
        }
      } catch (err) {
        console.error("[Socket] world:request failed:", err);
      }
    });

    // ---- Stat Allocation ----
    socket.on("stat:allocate", (data) => {
      const playerId = socket.data.playerId;
      const player = playerId ? Players.get(playerId) : undefined;
      if (!player || player.statPoints <= 0) return;

      const stat = data.stat;
      if (!player.stats[stat] && player.stats[stat] !== 0) return;

      (player.stats as Record<string, number>)[stat] += 1;
      player.statPoints -= 1;

      // Recalculate derived stats
      if (stat === "constitution") {
        player.stats.maxHp += 3;
        player.stats.hp = Math.min(player.stats.hp + 3, player.stats.maxHp);
      } else if (stat === "intelligence") {
        player.stats.maxMp += 2;
        player.stats.mp = Math.min(player.stats.mp + 2, player.stats.maxMp);
      }

      socket.emit("player:update", player);
    });

    socket.on("disconnect", () => {
      const playerId = socket.data.playerId;
      if (playerId) {
        // Abort any active trade session
        const closedTrade = Trade.cancel(playerId);
        if (closedTrade) {
          for (const pid of [closedTrade.aId, closedTrade.bId]) {
            io.to(pid).emit("trade:closed", { reason: "El otro jugador se desconectó" });
          }
        }
        // Leave party
        const partyBefore = Party.getPartyOf(playerId);
        const leftParty = Party.leave(playerId);
        if (partyBefore && !leftParty.dissolved) {
          broadcastPartyState(io, partyBefore);
        }
        // Leave clan (in-memory)
        const clanBefore = Clan.getClanOf(playerId);
        const leftClan = Clan.leave(playerId);
        if (clanBefore && !leftClan.dissolved) {
          broadcastClanState(io, clanBefore);
        }
        Quest.removePlayer(playerId);
        const player = Players.get(playerId);
        if (player) {
          io.to(player.mapId).emit("player:leave", playerId);
          io.emit("chat:message", addSystemMessage(`${player.username} ha salido del mundo.`));
        }
        // Save before removing
        const removed = Players.delete(playerId);
        if (removed) {
          savePlayer(removed);
          saveInventory(playerId, removed.inventory);
          saveEquipment(playerId, removed.equipment as Record<string, string | null>);
        }
      }
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
}
