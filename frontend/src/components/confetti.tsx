"use client";

const COLORS = ["var(--primary)", "var(--streak)", "var(--info)", "var(--danger)"];

/** Deterministic pseudo-random in [0,1) — render must stay pure (no
 * Math.random), and a fixed scatter per index looks random enough. */
function prand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Decorative confetti burst for the session-done screen (SPEC §17.1-B4).
 * Pure CSS animation; invisible to screen readers. */
export function Confetti({ count = 28 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    left: prand(i, 1) * 100,
    delay: prand(i, 2) * 0.5,
    duration: 1.8 + prand(i, 3) * 1.4,
    rotate: prand(i, 4) * 360,
    color: COLORS[i % COLORS.length],
    width: 6 + prand(i, 5) * 6,
  }));

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {pieces.map((piece, i) => (
        <span
          key={i}
          className="animate-confetti-fall absolute -top-[5%] rounded-[2px]"
          style={{
            left: `${piece.left}%`,
            width: piece.width,
            height: piece.width * 0.45,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotate}deg)`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
