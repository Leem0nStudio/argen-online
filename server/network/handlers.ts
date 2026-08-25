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
import { tryAttack } from "../game/combat.js";
import { useSkill } from "../game/skills.js";
import { pickupItem, equipItem, useConsumable } from "../game/inventory.js";
import { addChatMessage, addSystemMessage } from "../game/chat.js";
import { getNPC, npcBuyItem, npcSellItem } from "../game/npc.js";
import { spawnMonstersForMap, getMonstersAsData } from "../game/monster-ai.js";
import { getPlayersOnMap } from "./helpers.js";

type GameServer = Server<ClientEvents, ServerEvents>;
type GameSocket = Socket<ClientEvents, ServerEvents>;

function ensureMonsters(mapId: string) {
  if (!SpawnState.hasSpawned(mapId)) {
    spawnMonstersForMap(mapId);
    SpawnState.markSpawned(mapId);
  }
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
        socket.emit("auth:success", player);
        sendMapState(socket, player.mapId);
        io.emit("players:list", getPlayersOnMap(player.mapId));
        io.emit("chat:message", addSystemMessage(`${player.username} ha entrado al mundo.`));
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
      socket.emit("auth:success", player);
      sendMapState(socket, player.mapId);
      io.emit("players:list", getPlayersOnMap(player.mapId));
      io.emit("chat:message", addSystemMessage(`${player.username} ha regresado.`));
    });

    socket.on("player:move", (data) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const result = movePlayer(playerId, data.x, data.y, data.direction);
      if (!result) return;

      if (result.teleported) {
        const player = Players.get(playerId);
        if (player) {
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
      const msg = addChatMessage(playerId, player.username, message);
      io.emit("chat:message", msg);
    });

    socket.on("combat:attack", (targetId) => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const event = tryAttack(playerId, targetId);
      if (!event) return;
      io.emit("combat:damage", event);

      const victim = Players.get(targetId);
      if (victim && victim.stats.hp <= 0) {
        io.emit("combat:death", { killerId: playerId, victimId: targetId });
        const killer = Players.get(playerId);
        io.emit("chat:message", addSystemMessage(`${killer?.username} ha derrotado a ${victim.username}!`));
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

      const player = Players.get(playerId);
      if (player) socket.emit("player:update", player);
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
      socket.emit("npc:interact", { npcId, dialogue, shopItems });
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

    socket.on("disconnect", () => {
      const playerId = socket.data.playerId;
      if (playerId) {
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
