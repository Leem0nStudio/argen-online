// ============================================================
// Argentum Online — Game Server Entry Point
// ============================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { initDB } from "./db/database.js";
import { initWorld } from "./game/world.js";
import { setupHandlers } from "./network/handlers.js";
import { startGameLoop } from "./network/game-loop.js";
import { loadClansFromDB } from "./game/clan.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("⚔️  Argentum Online - Game Server Starting...");

initDB();
console.log("✅ Database initialized");

try {
  loadClansFromDB();
  console.log("✅ Clans loaded");
} catch { /* clans table may not exist yet on first run */ }

// Initialize procedural world
const worldMap = initWorld();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

// Serve static files from Vite build (production)
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

setupHandlers(io);
startGameLoop(io);

const PORT = parseInt(process.env.SERVER_PORT || "3001", 10);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🌍 Game server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
});
