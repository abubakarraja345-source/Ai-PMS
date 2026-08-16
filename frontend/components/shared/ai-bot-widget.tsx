"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";

const STORAGE_KEY = "hostly-ai-bot-position";
const DRAG_THRESHOLD_PX = 6;

interface Position {
  x: number;
  y: number;
}

/**
 * A draggable floating bot that links to the AI Assistant. Distinct
 * from CurrencyCalculator's fixed bottom-right FAB — this one starts
 * higher up (so the two don't overlap) and can be dragged anywhere;
 * its position persists across page loads via localStorage.
 *
 * Click vs. drag is disambiguated by movement distance: a pointer
 * down+up with less than DRAG_THRESHOLD_PX of movement is a click
 * (navigates to /ai); anything past that threshold is treated as a
 * drag and never navigates, so dragging the bot can never accidentally
 * fire a navigation.
 */
export default function AiBotWidget() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  const dragState = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setMounted(true);

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setPosition(JSON.parse(raw));
      }
    } catch {
      // Corrupt/missing storage — falls through to the default position.
    }
  }, []);

  function defaultPosition(): Position {
    return {
      x: window.innerWidth - 96,
      y: window.innerHeight - 176,
    };
  }

  function clampToViewport(pos: Position): Position {
    const size = 56;
    return {
      x: Math.min(Math.max(pos.x, 8), window.innerWidth - size - 8),
      y: Math.min(Math.max(pos.y, 8), window.innerHeight - size - 8),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    const current = position ?? defaultPosition();

    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: current.x,
      originY: current.y,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
      setDragging(true);
    }

    if (drag.moved) {
      setPosition(
        clampToViewport({ x: drag.originX + dx, y: drag.originY + dy })
      );
    }
  }

  function handlePointerUp() {
    const drag = dragState.current;
    dragState.current = null;
    setDragging(false);

    if (!drag) return;

    if (drag.moved) {
      setPosition((current) => {
        if (current) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          } catch {
            // Non-fatal — the position just won't persist across reloads.
          }
        }
        return current;
      });
      return;
    }

    // No real movement — treat as a click.
    router.push("/ai");
  }

  if (!mounted) return null;

  const pos = position ?? defaultPosition();

  return (
    <div
      className="fixed z-40"
      style={{ left: pos.x, top: pos.y }}
    >
      {hovered && !dragging && (
        <div className="glass-panel absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium text-foreground shadow-lg animate-in fade-in zoom-in-95 slide-in-from-bottom-1 duration-150">
          Hi! Need any help?
          <span className="absolute -bottom-1 right-5 h-2 w-2 rotate-45 border-b border-r border-border bg-card" />
        </div>
      )}

      <button
        type="button"
        aria-label="Open AI Assistant"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex h-14 w-14 touch-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-black/20 transition-transform ${
          dragging ? "scale-105 cursor-grabbing" : "cursor-grab hover:scale-105"
        }`}
      >
        <Bot size={26} className={dragging ? "" : "animate-[wiggle_3s_ease-in-out_infinite]"} />
      </button>
    </div>
  );
}
