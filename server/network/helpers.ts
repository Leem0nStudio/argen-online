// ============================================================
// Handler Helpers — Shared utilities for socket handlers
// ============================================================

import type { PlayerState } from "../../shared/types.js";
import { Players } from "../game/state.js";

export function getPlayersOnMap(mapId: string): PlayerState[] {
  return Players.onMap(mapId).map(p => ({ ...p } as PlayerState));
}
