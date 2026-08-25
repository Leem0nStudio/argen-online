import { useState } from "react";
import type { PlayerState } from "@shared/types";
import { SKILLS } from "@shared/types";
import { xpForLevel, SKILL_UNLOCK_LEVELS } from "@shared/constants";
import { getSocket } from "../network/socket";

interface Props {
  player: PlayerState;
  onClose: () => void;
}

const STAT_INFO: Record<string, { label: string; icon: string; desc: string }> = {
  strength:     { label: "Fuerza",     icon: "⚔️", desc: "Daño físico +1" },
  dexterity:    { label: "Destreza",   icon: "🏹", desc: "Crit +0.5%, Esquiva" },
  intelligence: { label: "Inteligencia", icon: "🔮", desc: "Daño mágico, +2 MP" },
  constitution: { label: "Constitución", icon: "🛡️", desc: "Vida +3, Defensa" },
};

export default function StatPanel({ player, onClose }: Props) {
  const [pending, setPending] = useState<Record<string, number>>({});

  const totalPending = Object.values(pending).reduce((a, b) => a + b, 0);
  const available = (player.statPoints ?? 0) - totalPending;

  function addStat(stat: string) {
    if (available <= 0) return;
    setPending(prev => ({ ...prev, [stat]: (prev[stat] ?? 0) + 1 }));
  }

  function removeStat(stat: string) {
    if ((pending[stat] ?? 0) <= 0) return;
    setPending(prev => ({ ...prev, [stat]: prev[stat] - 1 }));
  }

  function confirm() {
    // Send each stat allocation to server
    for (const [stat, count] of Object.entries(pending)) {
      for (let i = 0; i < count; i++) {
        getSocket().emit("stat:allocate", { stat: stat as any });
      }
    }
    onClose();
  }

  const classSkills = SKILLS[player.characterClass] ?? [];
  const skillSlots = ["Q", "W", "E"];

  return (
    <div className="death-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="stat-panel" onClick={(e) => e.stopPropagation()}>
        <div className="stat-panel-title">
          ⬆️ Nivel {player.level} — Puntos de Stat: {available}
        </div>

        {/* Stats */}
        <div className="stat-grid">
          {Object.entries(STAT_INFO).map(([key, info]) => {
            const base = player.stats[key as keyof typeof player.stats] ?? 0;
            const added = pending[key] ?? 0;
            return (
              <div key={key} className="stat-row">
                <div className="stat-icon">{info.icon}</div>
                <div className="stat-info">
                  <div className="stat-name">{info.label}</div>
                  <div className="stat-desc">{info.desc}</div>
                </div>
                <div className="stat-value">
                  {base}{added > 0 && <span className="stat-pending">+{added}</span>}
                </div>
                <div className="stat-buttons">
                  <button className="stat-btn minus" onClick={() => removeStat(key)} disabled={added <= 0}>−</button>
                  <button className="stat-btn plus" onClick={() => addStat(key)} disabled={available <= 0}>+</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Skill unlocks preview */}
        <div className="skill-unlock-section">
          <div className="skill-unlock-title">Habilidades</div>
          <div className="skill-unlock-row">
            {skillSlots.map((slot, i) => {
              const skill = classSkills[i];
              const isUnlocked = player.skillUnlocks?.includes(slot);
              const unlockLevel = Object.entries(SKILL_UNLOCK_LEVELS).find(([, slots]) => slots.includes(slot))?.[0] ?? "1";
              return (
                <div key={slot} className={`skill-unlock-slot ${isUnlocked ? "unlocked" : "locked"}`}>
                  <div className="skill-unlock-icon">{skill?.icon ?? "?"}</div>
                  <div className="skill-unlock-key">{slot}</div>
                  {isUnlocked ? (
                    <div className="skill-unlock-name">{skill?.name}</div>
                  ) : (
                    <div className="skill-unlock-req">Lv.{unlockLevel}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* XP bar */}
        <div className="xp-section">
          <div className="xp-label">EXP: {player.experience} / {xpForLevel(player.level)}</div>
          <div className="hud-bar">
            <div
              className="hud-bar-fill xp"
              style={{ width: `${Math.min(100, (player.experience / xpForLevel(player.level)) * 100)}%` }}
            />
          </div>
        </div>

        <div className="stat-panel-actions">
          <button className="stat-confirm-btn" onClick={confirm} disabled={totalPending === 0}>
            {totalPending > 0 ? `Asignar ${totalPending} puntos` : "Cerrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
