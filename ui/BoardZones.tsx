import type { CardInstance } from "../src/types";
import { CardView } from "./CardView";

interface DiscardPileModalProps {
  ownerLabel: string;
  cards: CardInstance[];
  onClose: () => void;
  onHover: (card: CardInstance | null) => void;
}

/** Full discard pile viewer — click cards to inspect via hover preview. */
export function DiscardPileModal({
  ownerLabel,
  cards,
  onClose,
  onHover,
}: DiscardPileModalProps) {
  return (
    <div className="discard-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="discard-modal__backdrop"
        aria-label="Close discard pile"
        onClick={onClose}
      />
      <div className="discard-modal__panel">
        <header className="discard-modal__header">
          <h2>{ownerLabel} discard pile</h2>
          <span>{cards.length}/3 defeated</span>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="discard-modal__grid">
          {cards.map((card) => (
            <CardView
              key={card.instanceId}
              card={card}
              size="md"
              className="discard-modal__card"
              onMouseEnter={() => onHover(card)}
              onMouseLeave={() => onHover(null)}
            />
          ))}
        </div>
        <p className="discard-modal__hint">Hover a card to inspect its stats.</p>
      </div>
    </div>
  );
}

interface DiscardZoneProps {
  beatenCount: number;
  topCard?: CardInstance;
  variant: "bot" | "me";
  onOpen: () => void;
  onHover?: (card: CardInstance | null) => void;
}

/** On-board discard slot — count always visible; top card only after a defeat. */
export function DiscardZone({
  beatenCount,
  topCard,
  variant,
  onOpen,
  onHover,
}: DiscardZoneProps) {
  const hasCards = beatenCount > 0 && topCard;

  return (
    <button
      type="button"
      className={`zone-discard zone-discard--${variant}${hasCards ? " is-clickable" : ""}`}
      onClick={hasCards ? onOpen : undefined}
      disabled={!hasCards}
      title={hasCards ? "View discard pile" : "No defeated Camgirls yet"}
    >
      <span className="zone__label zone__label--discard">{beatenCount}/3</span>
      <div className="zone-discard__slot">
        {hasCards ? (
          <CardView
            card={topCard}
            size="md"
            className="zone__card zone__card--discard"
            onMouseEnter={() => onHover?.(topCard)}
            onMouseLeave={() => onHover?.(null)}
          />
        ) : null}
      </div>
    </button>
  );
}

export function DeckZone({ count }: { count: number }) {
  return (
    <div className="zone-deck">
      <div className="zone-deck__slot">
        {count === 0 ? (
          <span className="zone__label zone__label--empty">EMPTY</span>
        ) : (
          <CardView faceDown size="md" className="zone__card zone__card--deck" />
        )}
      </div>
    </div>
  );
}

export function FieldCard({
  card,
  healthOverride,
  animClass,
  animKey = 0,
  locked,
  flipReveal,
  hovered = false,
  onHover,
}: {
  card?: CardInstance | null;
  healthOverride?: number;
  animClass?: string;
  /** Changes each combat step so strike animations replay. */
  animKey?: number;
  locked?: boolean;
  flipReveal?: { active: boolean };
  hovered?: boolean;
  onHover?: (card: CardInstance | null) => void;
}) {
  return (
    <div className="zone-field-card">
      <div className="zone-field__slot">
        {locked ? (
          <CardView
            key={`locked-${animKey}`}
            faceDown
            size="md"
            animClass={animClass}
            className="zone__card zone__card--field"
          />
        ) : card ? (
          <CardView
            key={`${card.instanceId}-${animKey}`}
            card={card}
            size="md"
            flipReveal={flipReveal}
            healthOverride={healthOverride}
            animClass={animClass}
            hovered={hovered}
            className="zone__card zone__card--field"
            onMouseEnter={() => onHover?.(card)}
            onMouseLeave={() => onHover?.(null)}
          />
        ) : null}
      </div>
      {locked ? <span className="zone__lock-label">Locked</span> : null}
    </div>
  );
}
