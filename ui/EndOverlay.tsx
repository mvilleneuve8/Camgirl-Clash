import type { GameSnapshot, PlayerId } from "../src/types";
import { HUMAN_ID } from "./bot";

type Outcome = "win" | "lose" | "draw";

function resolveOutcome(snap: GameSnapshot, humanId: PlayerId = HUMAN_ID): Outcome | null {
  if (snap.phase !== "ended") return null;
  if (snap.isDraw || snap.winnerId === null) return "draw";
  return snap.winnerId === humanId ? "win" : "lose";
}

interface EndOverlayProps {
  snap: GameSnapshot;
  onRematch: () => void;
}

/** Full-screen YOU WIN / YOU LOSE / Draw! splash when the match ends. */
export function EndOverlay({ snap, onRematch }: EndOverlayProps) {
  const outcome = resolveOutcome(snap);
  if (!outcome) return null;

  return (
    <div className={`end-overlay end-overlay--${outcome}`} role="dialog" aria-modal="true">
      <div className="end-overlay__panel">
        {outcome === "win" ? (
          <p className="end-overlay__win" aria-label="You win">
            YOU WIN
          </p>
        ) : outcome === "lose" ? (
          <p className="end-overlay__lose" aria-label="You lose">
            YOU LOSE
          </p>
        ) : (
          <p className="end-overlay__draw">Draw!</p>
        )}
        <button type="button" className="btn btn--primary" onClick={onRematch}>
          Play again
        </button>
      </div>
    </div>
  );
}
