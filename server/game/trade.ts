// ============================================================
// Trade — Player-to-player trading with server-authoritative swap
// ============================================================

import type { TradeOffer } from "../../shared/types.js";
import { Players, type ActivePlayer } from "./state.js";
import { MAX_INVENTORY_SLOTS } from "../../shared/constants.js";

export interface TradeSession {
  aId: string;
  bId: string;
  aOffer: TradeOffer;
  bOffer: TradeOffer;
}

const TRADE_RANGE = 5;

const sessions = new Map<string, TradeSession>(); // keyed by either participant id
const pendingInvites = new Map<string, { fromId: string; fromName: string; expiresAt: number }>(); // keyed by target id

function emptyOffer(): TradeOffer {
  return { items: [], gold: 0, confirmed: false };
}

export function invite(fromId: string, fromName: string, targetUsername: string): { ok: boolean; error?: string; targetId?: string } {
  const from = Players.get(fromId);
  if (!from) return { ok: false, error: "No estás en el mundo" };
  if (sessions.has(fromId)) return { ok: false, error: "Ya estás comercando" };

  let target: ActivePlayer | undefined;
  for (const p of Players.all()) {
    if (p.username.toLowerCase() === targetUsername.toLowerCase()) { target = p; break; }
  }
  if (!target) return { ok: false, error: "Jugador no encontrado" };
  if (target.id === fromId) return { ok: false, error: "No podés comerciarte a vos mismo" };
  if (target.mapId !== from.mapId) return { ok: false, error: "No están en el mismo lugar" };
  if (Math.abs(target.x - from.x) + Math.abs(target.y - from.y) > TRADE_RANGE) return { ok: false, error: "Está demasiado lejos" };
  if (sessions.has(target.id)) return { ok: false, error: "Ya está comerciando con otro" };

  pendingInvites.set(target.id, { fromId, fromName, expiresAt: Date.now() + 30_000 });
  return { ok: true, targetId: target.id };
}

export function getInvite(targetId: string) {
  const inv = pendingInvites.get(targetId);
  if (!inv) return null;
  if (Date.now() > inv.expiresAt) { pendingInvites.delete(targetId); return null; }
  return inv;
}

export function cancelInvite(targetId: string): void {
  pendingInvites.delete(targetId);
}

/** Accept an invite and create the session. Returns partner ids. */
export function accept(targetId: string): { aId: string; bId: string } | null {
  const inv = getInvite(targetId);
  if (!inv) return null;
  pendingInvites.delete(targetId);

  const a = Players.get(inv.fromId), b = Players.get(targetId);
  if (!a || !b || sessions.has(inv.fromId) || sessions.has(targetId)) return null;

  const session: TradeSession = {
    aId: inv.fromId, bId: targetId,
    aOffer: emptyOffer(), bOffer: emptyOffer(),
  };
  sessions.set(inv.fromId, session);
  sessions.set(targetId, session);
  return { aId: session.aId, bId: session.bId };
}

export function getSession(playerId: string): TradeSession | undefined {
  return sessions.get(playerId);
}

export function otherOf(session: TradeSession, playerId: string): ActivePlayer | undefined {
  return Players.get(session.aId === playerId ? session.bId : session.aId);
}

function offerOf(session: TradeSession, playerId: string): TradeOffer {
  return session.aId === playerId ? session.aOffer : session.bOffer;
}

export function addItem(playerId: string, slot: number, quantity: number): boolean {
  const session = sessions.get(playerId);
  const player = Players.get(playerId);
  if (!session || !player) return false;
  if (offerOf(session, playerId).confirmed) return false;

  const inv = player.inventory.find(i => i.slot === slot);
  if (!inv || quantity <= 0 || inv.quantity < quantity) return false;
  const offer = offerOf(session, playerId);
  // Replace any previous entry for the same slot
  offer.items = offer.items.filter(i => i.slot !== slot);
  offer.items.push({ slot, itemId: inv.itemId, quantity });
  return true;
}

export function addGold(playerId: string, amount: number): boolean {
  const session = sessions.get(playerId);
  const player = Players.get(playerId);
  if (!session || !player) return false;
  if (offerOf(session, playerId).confirmed) return false;
  if (!Number.isFinite(amount) || amount < 0 || player.gold < amount) return false;
  offerOf(session, playerId).gold = amount;
  return true;
}

export function confirm(playerId: string): { completed: boolean; reason: string; aId?: string; bId?: string } {
  const session = sessions.get(playerId);
  if (!session) return { completed: false, reason: "sin sesión" };
  const { aId, bId } = session;
  offerOf(session, playerId).confirmed = true;

  if (session.aOffer.confirmed && session.bOffer.confirmed) {
    const a = Players.get(session.aId), b = Players.get(session.bId);
    if (!a || !b) { close(session); return { completed: false, reason: "jugador ausente", aId, bId }; }

    // Validate both sides still hold what they offered
    for (const [offer, owner] of [[session.aOffer, a], [session.bOffer, b]] as const) {
      if (owner.gold < offer.gold) { close(session); return { completed: false, reason: "falta de oro", aId, bId }; }
      for (const item of offer.items) {
        const inv = owner.inventory.find(i => i.slot === item.slot && i.itemId === item.itemId && i.quantity >= item.quantity);
        if (!inv) { close(session); return { completed: false, reason: "faltan ítems", aId, bId }; }
      }
    }
    if (!executeSwap(session, a, b)) { close(session); return { completed: false, reason: "espacio insuficiente", aId, bId }; }
    close(session);
    return { completed: true, reason: "completado", aId, bId };
  }
  return { completed: false, reason: "esperando confirmación" };
}

function executeSwap(session: TradeSession, a: ActivePlayer, b: ActivePlayer): boolean {
  // Pre-check free space on each side (stackables merge)
  const fits = (receiver: ActivePlayer, offer: TradeOffer): boolean => {
    const usedSlots = new Set(receiver.inventory.map(i => i.slot));
    for (const item of offer.items) {
      const def = receiver.inventory.find(i => i.itemId === item.itemId);
      const stackableHere = def !== undefined;
      if (stackableHere) continue; // merges into existing stack
      let free = false;
      for (let s = 0; s < MAX_INVENTORY_SLOTS; s++) { if (!usedSlots.has(s)) { free = true; break; } }
      if (!free) return false;
    }
    return true;
  };
  if (!fits(a, session.bOffer) || !fits(b, session.aOffer)) return false;

  // Remove offered items from their owners
  for (const [owner, offer] of [[a, session.aOffer], [b, session.bOffer]] as const) {
    for (const item of offer.items) {
      const inv = owner.inventory.find(i => i.slot === item.slot)!;
      inv.quantity -= item.quantity;
      if (inv.quantity <= 0) owner.inventory = owner.inventory.filter(i => i.slot !== item.slot);
    }
  }
  // Give items to the counterpart
  for (const [receiver, offer] of [[a, session.bOffer], [b, session.aOffer]] as const) {
    for (const item of offer.items) {
      let slotUsed = -1;
      const existingStack = receiver.inventory.find(i => i.itemId === item.itemId);
      if (existingStack) {
        existingStack.quantity += item.quantity;
        continue;
      }
      const usedSlots = new Set(receiver.inventory.map(i => i.slot));
      for (let s = 0; s < MAX_INVENTORY_SLOTS; s++) { if (!usedSlots.has(s)) { slotUsed = s; break; } }
      if (slotUsed === -1) return false; // unreachable due to fits()
      receiver.inventory.push({ itemId: item.itemId, quantity: item.quantity, slot: slotUsed });
    }
  }
  // Gold
  if (session.aOffer.gold > 0) { a.gold -= session.aOffer.gold; b.gold += session.aOffer.gold; }
  if (session.bOffer.gold > 0) { b.gold -= session.bOffer.gold; a.gold += session.bOffer.gold; }
  return true;
}

/** Close a session. Returns participant ids so handlers can notify both. */
export function close(session: TradeSession): { aId: string; bId: string } {
  sessions.delete(session.aId);
  sessions.delete(session.bId);
  return { aId: session.aId, bId: session.bId };
}

export function cancel(playerId: string): { aId: string; bId: string } | null {
  const session = sessions.get(playerId);
  if (!session) return null;
  return close(session);
}
