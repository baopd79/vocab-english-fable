import { cn } from "@/lib/cn";

/* Hand-drawn stroke icon set (viewBox 24) from the v2 design. Decks have no
 * icon field on the backend, so the tile is picked deterministically by id. */
const ICONS = [
  {
    // open book
    path: "M12 6.3C10.2 4.7 7.7 4 4.8 4H4v14h.8c2.9 0 5.4.8 7.2 2.4 1.8-1.6 4.3-2.4 7.2-2.4h.8V4h-.8c-2.9 0-5.4.7-7.2 2.3zm0 0v14.1",
    tile: "bg-primary/15 text-primary-text",
  },
  {
    // graduation cap
    path: "M2.5 9.5 12 4.5l9.5 5-9.5 5-9.5-5zM6 12.3v4.2c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.2M21.5 9.5v5",
    tile: "bg-info/15 text-info-text",
  },
  {
    // speech bubble
    path: "M21 11.3c0 4.4-4 7.9-9 7.9-1 0-2-.1-2.9-.4L4 20.7l1.5-4.1C4.2 15.2 3 13.4 3 11.3 3 6.9 7 3.5 12 3.5s9 3.4 9 7.8z",
    tile: "bg-streak/15 text-streak-text",
  },
  {
    // leaf
    path: "M11.5 20.5A7.5 7.5 0 0 1 4 13c0-4.5 3.5-8.5 10.5-9.5 3-.4 5.5 0 5.5 0s.4 2.5 0 5.5c-1 7-5 11.5-8.5 11.5zM4.5 20.5c2-3.5 5-6.5 9-8.5",
    tile: "bg-primary/15 text-primary-text",
  },
];

/** Colored icon tile for a deck card. `className` sizes the tile (w/h/rounded). */
export function DeckIcon({ deckId, className }: { deckId: number; className?: string }) {
  const icon = ICONS[Math.abs(deckId) % ICONS.length];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl [&>svg]:h-[55%] [&>svg]:w-[55%]",
        icon.tile,
        className ?? "h-10 w-10",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={icon.path} />
      </svg>
    </span>
  );
}
