import { useRef, useCallback, useState } from "react";
import { Direction } from "@shared/types";

interface Props {
  onMove: (dx: number, dy: number, direction: Direction) => void;
  onRelease: () => void;
}

const DEAD_ZONE = 0.25;
const STICK_RADIUS = 48;

export default function VirtualJoystick({ onMove, onRelease }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDragging = useRef(false);
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });

  const clearMovementInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startMovementInterval = useCallback((dx: number, dy: number, dir: Direction) => {
    clearMovementInterval();
    onMove(dx, dy, dir);
    intervalRef.current = setInterval(() => {
      onMove(dx, dy, dir);
    }, 150);
  }, [onMove, clearMovementInterval]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;

    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return;
    originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDragging.current) return;
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier !== touchIdRef.current) continue;
      const dx = touch.clientX - originRef.current.x;
      const dy = touch.clientY - originRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, STICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      const sx = Math.cos(angle) * clampedDist;
      const sy = Math.sin(angle) * clampedDist;
      setStickOffset({ x: sx, y: sy });

      if (dist > DEAD_ZONE * STICK_RADIUS) {
        let dir: Direction;
        if (Math.abs(dx) > Math.abs(dy)) {
          dir = dx > 0 ? Direction.Right : Direction.Left;
        } else {
          dir = dy > 0 ? Direction.Down : Direction.Up;
        }
        const normX = sx / STICK_RADIUS;
        const normY = sy / STICK_RADIUS;
        const moveDx = Math.abs(normX) > 0.4 ? (normX > 0 ? 1 : -1) : 0;
        const moveDy = Math.abs(normY) > 0.4 ? (normY > 0 ? 1 : -1) : 0;
        if (moveDx !== 0 || moveDy !== 0) {
          startMovementInterval(moveDx, moveDy, dir);
        }
      } else {
        clearMovementInterval();
      }
    }
  }, [startMovementInterval, clearMovementInterval]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier !== touchIdRef.current) continue;
      touchIdRef.current = null;
      isDragging.current = false;
      setStickOffset({ x: 0, y: 0 });
      clearMovementInterval();
      onRelease();
    }
  }, [onRelease, clearMovementInterval]);

  const handleDpad = useCallback((dx: number, dy: number) => {
    let dir: Direction;
    if (dx > 0) dir = Direction.Right;
    else if (dx < 0) dir = Direction.Left;
    else if (dy > 0) dir = Direction.Down;
    else dir = Direction.Up;
    onMove(dx, dy, dir);
  }, [onMove]);

  return (
    <div className="mobile-controls">
      <div className="dpad-container">
        <button className="dpad-btn dpad-up" onTouchStart={(e) => { e.preventDefault(); handleDpad(0, -1); }} aria-label="Up">▲</button>
        <button className="dpad-btn dpad-left" onTouchStart={(e) => { e.preventDefault(); handleDpad(-1, 0); }} aria-label="Left">◄</button>
        <div className="dpad-center" />
        <button className="dpad-btn dpad-right" onTouchStart={(e) => { e.preventDefault(); handleDpad(1, 0); }} aria-label="Right">►</button>
        <button className="dpad-btn dpad-down" onTouchStart={(e) => { e.preventDefault(); handleDpad(0, 1); }} aria-label="Down">▼</button>
      </div>

      <button className="mobile-attack-btn" aria-label="Attack">⚔️</button>
    </div>
  );
}
