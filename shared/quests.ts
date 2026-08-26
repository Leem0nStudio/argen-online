// ============================================================
// Quests — Definitions shared client/server
// ============================================================

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  targetMonster: string; // e.g. "Goblin"
  required: number;
  rewardXp: number;
  rewardGold: number;
  rewardRep: number;
  kingdom?: string; // which faction gains rep
}

export const QUESTS: QuestDef[] = [
  { id: "q_goblin", name: "Cacería de Goblins", description: "Elimina 5 Goblins", targetMonster: "Goblin", required: 5, rewardXp: 80, rewardGold: 40, rewardRep: 5 },
  { id: "q_wolf", name: "Lobos al acecho", description: "Mata 4 Lobos", targetMonster: "Lobo", required: 4, rewardXp: 100, rewardGold: 50, rewardRep: 6 },
  { id: "q_skeleton", name: "Huesos inquietos", description: "Derrota 3 Esqueletos", targetMonster: "Esqueleto", required: 3, rewardXp: 120, rewardGold: 70, rewardRep: 8 },
  { id: "q_ogre", name: "El Ogro del bosque", description: "Abate 2 Ogros", targetMonster: "Ogro", required: 2, rewardXp: 200, rewardGold: 120, rewardRep: 12 },
];
