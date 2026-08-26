// ============================================================
// Party — Group play: invites, shared XP proximity, party chat
// ============================================================

import type { PartyMemberInfo } from "../../shared/types.js";
import { Players, type ActivePlayer } from "./state.js";

export const PARTY_MAX_MEMBERS = 5;
export const PARTY_XP_RANGE = 12;      // tiles (manhattan) to qualify for shared xp
export const PARTY_XP_BONUS = 1.25;    // total pool multiplier — grouping pays
export const PARTY_INVITE_TTL_MS = 30_000;

export interface Party {
  id: string;
  leaderId: string;
  memberIds: Set<string>;
}

const parties = new Map<string, Party>();            // by party id
const memberParty = new Map<string, string>();       // playerId → party id
const pendingInvites = new Map<string, { fromId: string; fromName: string; expiresAt: number }>();

export function getPartyOf(playerId: string): Party | undefined {
  const pid = memberParty.get(playerId);
  return pid ? parties.get(pid) : undefined;
}

export function invite(fromId: string, fromName: string, targetUsername: string): { ok: boolean; error?: string; targetId?: string } {
  const from = Players.get(fromId);
  if (!from) return { ok: false, error: "No estás en el mundo" };

  if (getPartyOf(fromId) && getPartyOf(fromId)!.leaderId !== fromId) {
    return { ok: false, error: "Solo el líder puede invitar" };
  }
  const fromParty = getPartyOf(fromId);
  if (fromParty && fromParty.memberIds.size >= PARTY_MAX_MEMBERS) {
    return { ok: false, error: "El grupo está lleno" };
  }

  let target: ActivePlayer | undefined;
  for (const p of Players.all()) {
    if (p.username.toLowerCase() === targetUsername.toLowerCase()) { target = p; break; }
  }
  if (!target) return { ok: false, error: "Jugador no encontrado" };
  if (target.id === fromId) return { ok: false, error: "No podés invitarte a vos mismo" };
  if (getPartyOf(target.id)) return { ok: false, error: "Ya tiene grupo" };

  pendingInvites.set(target.id, { fromId, fromName, expiresAt: Date.now() + PARTY_INVITE_TTL_MS });
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

export function accept(targetId: string): { party: Party; leaderName: string } | null {
  const inv = getInvite(targetId);
  if (!inv) return null;
  pendingInvites.delete(targetId);

  let party = getPartyOf(inv.fromId);
  if (!party) {
    party = { id: `party_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, leaderId: inv.fromId, memberIds: new Set([inv.fromId]) };
    parties.set(party.id, party);
    memberParty.set(inv.fromId, party.id);
  }
  if (party.memberIds.size >= PARTY_MAX_MEMBERS) return null;

  party.memberIds.add(targetId);
  memberParty.set(targetId, party.id);

  const leader = Players.get(party.leaderId);
  return { party, leaderName: leader?.username ?? "?" };
}

export function leave(playerId: string): { party?: Party; dissolved: boolean; wasLeader: boolean } {
  const party = getPartyOf(playerId);
  if (!party) return { dissolved: false, wasLeader: false };
  const wasLeader = party.leaderId === playerId;

  party.memberIds.delete(playerId);
  memberParty.delete(playerId);

  if (party.memberIds.size === 0) {
    parties.delete(party.id);
    return { dissolved: true, wasLeader };
  }
  // Promote next member if leader left
  if (wasLeader) {
    party.leaderId = [...party.memberIds][0];
  }
  return { party, dissolved: false, wasLeader };
}

export function removeCompletely(playerId: string): void {
  leave(playerId);
}

export function stateFor(party: Party) {
  const members: PartyMemberInfo[] = [];
  for (const id of party.memberIds) {
    const p = Players.get(id);
    if (p) members.push({ id, username: p.username, level: p.level, isLeader: id === party.leaderId });
  }
  return { members };
}

/**
 * Shared XP for a kill. Returns the XP each qualifying member received and
 * who leveled up. Solo kill behaves exactly as before (full xp to killer).
 */
export function sharedXpOnKill(
  killerId: string,
  baseXp: number,
  grantFn: (player: ActivePlayer, xp: number) => boolean,
  monster: { mapId: string; x: number; y: number },
): { distributions: { playerId: string; username: string; xp: number; leveledUp: boolean }[] } {
  const killer = Players.get(killerId);
  if (!killer) return { distributions: [] };

  const party = getPartyOf(killerId);
  if (!party || party.memberIds.size <= 1) {
    const leveledUp = grantFn(killer, baseXp);
    return { distributions: [{ playerId: killerId, username: killer.username, xp: baseXp, leveledUp }] };
  }

  // Qualifying members: connected, same map, near the kill
  const qualifiers: ActivePlayer[] = [];
  for (const id of party.memberIds) {
    const p = Players.get(id);
    if (!p) continue;
    if (p.mapId !== monster.mapId) continue;
    if (Math.abs(p.x - monster.x) + Math.abs(p.y - monster.y) > PARTY_XP_RANGE) continue;
    qualifiers.push(p);
  }
  if (qualifiers.length === 0) qualifiers.push(killer);

  const pool = Math.ceil(baseXp * PARTY_XP_BONUS);
  const share = Math.max(1, Math.floor(pool / qualifiers.length));

  const distributions = qualifiers.map(p => ({
    playerId: p.id,
    username: p.username,
    xp: share,
    leveledUp: grantFn(p, share),
  }));
  return { distributions };
}
