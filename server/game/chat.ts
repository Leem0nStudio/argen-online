// ============================================================
// Chat System — Messages, system messages
// ============================================================

import { v4 as uuidv4 } from "uuid";
import type { ChatMessage } from "../../shared/types.js";
import { MAX_CHAT_LENGTH, CHAT_HISTORY_LIMIT } from "../../shared/constants.js";
import { Players, Chat as ChatState } from "./state.js";

export function addChatMessage(playerId: string, username: string, message: string): ChatMessage {
  const msg: ChatMessage = {
    id: uuidv4(), playerId, username,
    message: message.slice(0, MAX_CHAT_LENGTH),
    timestamp: Date.now(), type: "local",
  };
  ChatState.add(msg);
  return msg;
}

export function addSystemMessage(message: string): ChatMessage {
  const msg: ChatMessage = {
    id: uuidv4(), playerId: "system", username: "Sistema",
    message, timestamp: Date.now(), type: "system",
  };
  ChatState.add(msg);
  return msg;
}

export function getNearbyMessages(limit = 20): ChatMessage[] {
  return ChatState.recent(limit, (playerId) => Players.allIds().includes(playerId));
}
