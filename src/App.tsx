import { useState, useEffect, useCallback } from "react";
import type { PlayerState } from "@shared/types";
import { getSocket, disconnectSocket } from "./network/socket";
import AuthScreen from "./ui/AuthScreen";
import GameScreen from "./ui/GameScreen";

type Screen = "auth" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const socket = getSocket();

    socket.on("auth:success", (p: PlayerState) => {
      setPlayer(p);
      setScreen("game");
      setError("");
    });

    socket.on("auth:error", (msg: string) => {
      setError(msg);
    });

    return () => {
      socket.off("auth:success");
      socket.off("auth:error");
    };
  }, []);

  const handleLogin = useCallback((username: string, password: string) => {
    const socket = getSocket();
    setError("");
    socket.emit("auth:login", { username, password });
  }, []);

  const handleRegister = useCallback((username: string, password: string, characterClass: any, race?: any) => {
    const socket = getSocket();
    setError("");
    socket.emit("auth:register", { username, password, characterClass, race });
  }, []);

  const handleLogout = useCallback(() => {
    disconnectSocket();
    setPlayer(null);
    setScreen("auth");
  }, []);

  if (screen === "auth") {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} error={error} />;
  }

  return <GameScreen player={player!} onLogout={handleLogout} />;
}
