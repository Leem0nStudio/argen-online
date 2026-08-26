import { useState } from "react";
import { CharacterClass, Race } from "@shared/types";

interface Props {
  onLogin: (username: string, password: string) => void;
  onRegister: (username: string, password: string, characterClass: CharacterClass, race?: Race) => void;
  error: string;
}

const CLASSES = [
  { id: CharacterClass.Warrior, icon: "⚔️", name: "Guerrero", desc: "Fuerza y resistencia" },
  { id: CharacterClass.Mage, icon: "🔮", name: "Mago", desc: "Poder mágico" },
  { id: CharacterClass.Archer, icon: "🏹", name: "Arquero", desc: "Precisión y velocidad" },
  { id: CharacterClass.Paladin, icon: "🛡️", name: "Paladín", desc: "Equilibrio" },
];

const RACES = [
  { id: Race.Humano, icon: "🧑", name: "Humano", desc: "Equilibrado" },
  { id: Race.Elfo, icon: "🧝", name: "Elfo", desc: "Ágil y mágico" },
  { id: Race.ElfoOscuro, icon: "🧝‍♂️", name: "Elfo Oscuro", desc: "Mago oscuro" },
  { id: Race.Enano, icon: "🧔", name: "Enano", desc: "Fuerte y resistente" },
  { id: Race.Gnomo, icon: "🧙", name: "Gnomo", desc: "Pequeño sabio" },
];

export default function AuthScreen({ onLogin, onRegister, error }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedClass, setSelectedClass] = useState<CharacterClass>(CharacterClass.Warrior);
  const [selectedRace, setSelectedRace] = useState<Race>(Race.Humano);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    if (tab === "login") onLogin(username.trim(), password);
    else onRegister(username.trim(), password, selectedClass, selectedRace);
  };

  return (
    <div className="auth-container">
      <div className="auth-title">⚔️ Argentum Online</div>
      <div className="auth-subtitle">El mundo te espera, aventurero</div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === "login" ? "active" : ""}`} onClick={() => setTab("login")}>
            Iniciar Sesión
          </button>
          <button className={`auth-tab ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
            Crear Personaje
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="auth-name">Nombre</label>
            <input
              id="auth-name"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu nombre de personaje"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña secreta"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
            />
          </div>

          {tab === "register" && (
            <>
              <div className="auth-field">
                <label>Clase</label>
              </div>
              <div className="class-select">
                {CLASSES.map((c) => (
                  <div
                    key={c.id}
                    className={`class-option ${selectedClass === c.id ? "selected" : ""}`}
                    onClick={() => setSelectedClass(c.id)}
                  >
                    <span className="class-icon">{c.icon}</span>
                    {c.name}
                    <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{c.desc}</div>
                  </div>
                ))}
              </div>
              <div className="auth-field" style={{ marginTop: "0.8rem" }}>
                <label>Raza</label>
              </div>
              <div className="class-select">
                {RACES.map((r) => (
                  <div
                    key={r.id}
                    className={`class-option ${selectedRace === r.id ? "selected" : ""}`}
                    onClick={() => setSelectedRace(r.id)}
                  >
                    <span className="class-icon">{r.icon}</span>
                    {r.name}
                    <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button type="submit" className="auth-btn" disabled={!username.trim() || !password.trim()}>
            {tab === "login" ? "⚔️ Entrar al Mundo" : "🛡️ Crear Personaje"}
          </button>
        </form>

        {tab === "login" && (
          <div style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.75rem", color: "var(--text-dim)" }}>
            ¿Primera vez? Crea un personaje nuevo arriba ↑
          </div>
        )}
      </div>

      <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.7rem", color: "var(--text-dim)" }}>
        Mundo peligroso · PvP con consecuencias · Economía de jugadores
      </div>
    </div>
  );
}
