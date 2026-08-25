import { useEffect, useRef } from "react";
import type { WorldMetaData } from "@shared/types";

interface Props {
  world: WorldMetaData | null;
  playerPos: { x: number; y: number };
}

const SIZE = 150;

const SETTLEMENT_COLORS: Record<string, string> = {
  capital: "#ffd700",
  city: "#ff9944",
  town: "#66ccff",
  village: "#aaaaaa",
};

export default function Minimap({ world, playerPos }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Background (ocean)
    ctx.fillStyle = "#0a1a3a";
    ctx.fillRect(0, 0, SIZE, SIZE);

    const totalTiles = world.width * 64; // world width in tiles
    const scale = SIZE / totalTiles;
    const toMapX = (wx: number) => wx * scale;
    const toMapY = (wy: number) => wy * scale;

    // Roads
    if (world.roads.length > 0) {
      ctx.strokeStyle = "rgba(180, 150, 100, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const r of world.roads) {
        const x = toMapX(r.wx);
        const y = toMapY(r.wy);
        if (x === 0 && y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Kingdoms — draw capital influence circles
    for (const k of world.kingdoms) {
      const capital = world.settlements.find((s) => s.id === k.capitalId);
      if (!capital) continue;
      const color = `#${(k.color & 0xffffff).toString(16).padStart(6, "0")}`;
      const grad = ctx.createRadialGradient(
        toMapX(capital.wx), toMapY(capital.wy), 2,
        toMapX(capital.wx), toMapY(capital.wy), 60,
      );
      grad.addColorStop(0, color + "44");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(toMapX(capital.wx), toMapY(capital.wy), 60, 0, Math.PI * 2);
      ctx.fill();
    }

    // Settlements
    for (const s of world.settlements) {
      const x = toMapX(s.wx);
      const y = toMapY(s.wy);
      const r = s.type === "capital" ? 4 : s.type === "city" ? 3 : 2;
      ctx.fillStyle = SETTLEMENT_COLORS[s.type] ?? "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Label for capitals only
      if (s.type === "capital") {
        ctx.fillStyle = "#ffffff";
        ctx.font = "7px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.name, x, y - 6);
      }
    }

    // Player marker
    const px = toMapX(playerPos.x);
    const py = toMapY(playerPos.y);
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }, [world, playerPos.x, playerPos.y]);

  return (
    <div className="minimap-container">
      <canvas ref={canvasRef} style={{ width: SIZE, height: SIZE }} />
      <div className="minimap-label">
        {world ? `${world.settlements.length} asentamientos` : "Cargando mundo..."}
      </div>
    </div>
  );
}
