// ============================================================
// Clan — Persistent player guilds (AO-style)
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { Players } from "./state.js";
import {
  dbCreateClan, dbAddClanMember, dbRemoveClanMember, dbDeleteClan, dbUpdateClanLeader, dbGetClans,
} from "../db/database.js";

export interface Clan {
  id: string;
  name: string;
  leaderId: string;
  memberIds: Set<string>;
  createdAt: number;
}

const clans = new Map<string, Clan>(); // by id
const memberClan = new Map<string, string>(); // playerId -> clan id
const pendingInvites = new Map<string, { clanId: string; fromId: string; fromName: string; expiresAt: number }>();

export const CLAN_MAX_MEMBERS = 8;
export const CLAN_INVITE_TTL_MS = 30_000;

export function getClanOf(playerId: string): Clan | undefined {
  const cid = memberClan.get(playerId);
  return cid ? clans.get(cid) : undefined;
}

export function getClanByName(name: string): Clan | undefined {
  for (const c of clans.values()) if (c.name.toLowerCase() === name.toLowerCase()) return c;
  return undefined;
}

export function loadClansFromDB(): void {
  try {
    for (const row of dbGetClans()) {
      const clan: Clan = { id: row.id, name: row.name, leaderId: row.leader_id, memberIds: new Set(row.memberIds), createdAt: 0 };
      clans.set(clan.id, clan);
      for (const pid of row.memberIds) memberClan.set(pid, clan.id);
    }
  } catch { /* DB not ready yet */ }
}

export function createClan(leaderId: string, clanName: string): { ok: boolean; error?: string; clan?: Clan } {
  const player = Players.get(leaderId);
  if (!player) return { ok: false, error: "No estás en el mundo" };
  if (getClanOf(leaderId)) return { ok: false, error: "Ya perteneces a un clan" };
  const clean = clanName.trim().slice(0, 20);
  if (clean.length < 3) return { ok: false, error: "Nombre muy corto (mín. 3)" };
  if (getClanByName(clean)) return { ok: false, error: "Ya existe un clan con ese nombre" };
  const clan: Clan = { id: uuidv4(), name: clean, leaderId, memberIds: new Set([leaderId]), createdAt: Date.now() };
  clans.set(clan.id, clan);
  memberClan.set(leaderId, clan.id);
  try { dbCreateClan(clan.id, clan.name, leaderId); } catch {}
  return { ok: true, clan };
}

export function invite(fromId: string, fromName: string, targetUsername: string): { ok: boolean; error?: string; targetId?: string } {
  const clan = getClanOf(fromId);
  if (!clan) return { ok: false, error: "No tienes clan. Créalo con /clan crear <nombre>" };
  if (clan.leaderId !== fromId) return { ok: false, error: "Solo el líder puede invitar" };
  if (clan.memberIds.size >= CLAN_MAX_MEMBERS) return { ok: false, error: "Clan lleno" };
  let target: any;
  for (const p of Players.all()) if (p.username.toLowerCase() === targetUsername.toLowerCase()) target = p;
  if (!target) return { ok: false, error: "Jugador no encontrado" };
  if (target.id === fromId) return { ok: false, error: "No podés invitarte" };
  if (getClanOf(target.id)) return { ok: false, error: "Ya tiene clan" };
  pendingInvites.set(target.id, { clanId: clan.id, fromId, fromName, expiresAt: Date.now() + CLAN_INVITE_TTL_MS });
  return { ok: true, targetId: target.id };
}

export function getInvite(targetId: string) {
  const inv = pendingInvites.get(targetId);
  if (!inv) return null;
  if (Date.now() > inv.expiresAt) { pendingInvites.delete(targetId); return null; }
  return inv;
}

export function accept(targetId: string): Clan | null {
  const inv = getInvite(targetId);
  if (!inv) return null;
  pendingInvites.delete(targetId);
  const clan = clans.get(inv.clanId);
  if (!clan || clan.memberIds.size >= CLAN_MAX_MEMBERS) return null;
  clan.memberIds.add(targetId);
  memberClan.set(targetId, clan.id);
  try { dbAddClanMember(clan.id, targetId); } catch {}
  return clan;
}

export function decline(targetId: string): { fromId?: string } | null {
  const inv = getInvite(targetId);
  if (!inv) return null;
  pendingInvites.delete(targetId);
  return { fromId: inv.fromId };
}

export function leave(playerId: string): { clan?: Clan; dissolved: boolean; wasLeader: boolean } {
  const clan = getClanOf(playerId);
  if (!clan) return { dissolved: false, wasLeader: false };
  const wasLeader = clan.leaderId === playerId;
  clan.memberIds.delete(playerId);
  memberClan.delete(playerId);
  try { dbRemoveClanMember(clan.id, playerId); } catch {}
  if (clan.memberIds.size === 0) {
    clans.delete(clan.id);
    try { dbDeleteClan(clan.id); } catch {}
    return { dissolved: true, wasLeader };
  }
  if (wasLeader) {
    clan.leaderId = [...clan.memberIds][0];
    try { dbUpdateClanLeader(clan.id, clan.leaderId); } catch {}
  }
  return { clan, dissolved: false, wasLeader };
}

export function removeCompletely(playerId: string): void {
  leave(playerId);
}

export function stateFor(clan: Clan) {
  const members: { id: string; username: string; level: number; isLeader: boolean; online: boolean }[] = [];
  for (const id of clan.memberIds) {
    const p = Players.get(id);
    if (p) members.push({ id, username: p.username, level: p.level, isLeader: id === clan.leaderId, online: true });
    else members.push({ id, username: "?", level: 0, isLeader: id === clan.leaderId, online: false });
  }
  return { id: clan.id, name: clan.name, members };
}
