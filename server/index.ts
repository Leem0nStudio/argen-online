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
import { logger } from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

logger.info("⚔️  Argentum Online - Game Server Starting...");

initDB();
logger.info("✅ Database initialized");

try {
  loadClansFromDB();
  logger.info("✅ Clans loaded");
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
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

setupHandlers(io);
startGameLoop(io);

const PORT = parseInt(process.env.SERVER_PORT || "3001", 10);
httpServer.listen(PORT, "0.0.0.0", () => {
  logger.info(`🌍 Game server running on http://0.0.0.0:${PORT}`);
  logger.info(`📡 Socket.io ready for connections`);
});
