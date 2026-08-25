import { useRef, useState, useCallback } from "react";
import { Direction } from "@shared/types";

interface Props {
  onMove: (dx: number, dy: number, direction: Direction) => void;
  onRelease: () => void;
  onAttack?: () => void;
}

const DEAD_ZONE = 0.25;
const STICK_RADIUS = 46;
const REPEAT_MS = 150;

export default function VirtualJoystick({ onMove, onRelease, onAttack }: Props) {
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [basePos, setBasePos] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const clearRepeat = useCallback(() => {
    if (repeatRef.current) {
      clearInterval(repeatRef.current);
      repeatRef.current = null;
    }
  }, []);

  const startDir = useCallback((dx: number, dy: number, dir: Direction) => {
    clearRepeat();
    onMove(dx, dy, dir);
    repeatRef.current = setInterval(() => onMove(dx, dy, dir), REPEAT_MS);
  }, [onMove, clearRepeat]);

  const endDir = useCallback(() => {
    clearRepeat();
    onRelease();
  }, [onRelease, clearRepeat]);

  // ---- Analog joystick (dynamic: appears where the finger lands, left half) ----

  const handleZoneTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    originRef.current = { x: touch.clientX, y: touch.clientY };
    setBasePos({ x: touch.clientX, y: touch.clientY });
    setKnob({ x: 0, y: 0 });
  }, []);

  const handleZoneTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (touchIdRef.current === null) return;
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier !== touchIdRef.current) continue;
      const dx = touch.clientX - originRef.current.x;
      const dy = touch.clientY - originRef.current.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, STICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      setKnob({ x: Math.cos(angle) * clamped, y: Math.sin(angle) * clamped });

      if (dist > DEAD_ZONE * STICK_RADIUS) {
        let dir: Direction;
        if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? Direction.Right : Direction.Left;
        else dir = dy > 0 ? Direction.Down : Direction.Up;
        const nx = dx / STICK_RADIUS;
        const ny = dy / STICK_RADIUS;
        const mx = Math.abs(nx) > 0.4 ? (nx > 0 ? 1 : -1) : 0;
        const my = Math.abs(ny) > 0.4 ? (ny > 0 ? 1 : -1) : 0;
        if (mx !== 0 || my !== 0) {
          // throttle to engine pace without stacking intervals
          clearRepeat();
          onMove(mx, my, dir);
          repeatRef.current = setInterval(() => onMove(mx, my, dir), REPEAT_MS);
        }
      } else {
        clearRepeat();
        onRelease();
      }
    }
  }, [onMove, onRelease, clearRepeat]);

  const handleZoneTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier !== touchIdRef.current) continue;
      touchIdRef.current = null;
      setBasePos(null);
      setKnob({ x: 0, y: 0 });
      clearRepeat();
      onRelease();
    }
  }, [onRelease, clearRepeat]);

  return (
    <>
      {/* Analog joystick capture zone — left half of the screen */}
      <div
        className="joystick-zone"
        onTouchStart={handleZoneTouchStart}
        onTouchMove={handleZoneTouchMove}
        onTouchEnd={handleZoneTouchEnd}
        onTouchCancel={handleZoneTouchEnd}
      />
      {basePos && (
        <div
          className="joystick-base"
          style={{ left: basePos.x - 60, top: basePos.y - 60 }}
        >
          <div
            className="joystick-knob"
            style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
          />
        </div>
      )}

      {/* D-Pad with hold-to-repeat */}
      <div className="mobile-controls">
        <div className="dpad-container">
          <button
            className="dpad-btn dpad-up" aria-label="Arriba"
            onTouchStart={(e) => { e.preventDefault(); startDir(0, -1, Direction.Up); }}
            onTouchEnd={(e) => { e.preventDefault(); endDir(); }}
            onTouchCancel={endDir}
            onPointerDown={(e) => { if (e.pointerType === "mouse") startDir(0, -1, Direction.Up); }}
            onPointerUp={() => endDir()}
          >▲</button>
          <button
            className="dpad-btn dpad-left" aria-label="Izquierda"
            onTouchStart={(e) => { e.preventDefault(); startDir(-1, 0, Direction.Left); }}
            onTouchEnd={(e) => { e.preventDefault(); endDir(); }}
            onTouchCancel={endDir}
            onPointerDown={(e) => { if (e.pointerType === "mouse") startDir(-1, 0, Direction.Left); }}
            onPointerUp={() => endDir()}
          >◄</button>
          <div className="dpad-center" />
          <button
            className="dpad-btn dpad-right" aria-label="Derecha"
            onTouchStart={(e) => { e.preventDefault(); startDir(1, 0, Direction.Right); }}
            onTouchEnd={(e) => { e.preventDefault(); endDir(); }}
            onTouchCancel={endDir}
            onPointerDown={(e) => { if (e.pointerType === "mouse") startDir(1, 0, Direction.Right); }}
            onPointerUp={() => endDir()}
          >►</button>
          <button
            className="dpad-btn dpad-down" aria-label="Abajo"
            onTouchStart={(e) => { e.preventDefault(); startDir(0, 1, Direction.Down); }}
            onTouchEnd={(e) => { e.preventDefault(); endDir(); }}
            onTouchCancel={endDir}
            onPointerDown={(e) => { if (e.pointerType === "mouse") startDir(0, 1, Direction.Down); }}
            onPointerUp={() => endDir()}
          >▼</button>
        </div>

        <button
          className="mobile-attack-btn" aria-label="Atacar"
          onTouchStart={(e) => { e.preventDefault(); onAttack?.(); }}
          onClick={() => onAttack?.()}
        >⚔️</button>
      </div>
    </>
  );
}
