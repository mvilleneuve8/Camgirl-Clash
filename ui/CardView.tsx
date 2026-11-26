import type { CardInstance } from "../src/types";
import { publicAsset } from "./assets";

interface CardViewProps {
  card?: CardInstance | null;
  faceDown?: boolean;
  /** Lock-in reveal: card starts face-down then flips to show the camgirl. */
  flipReveal?: { active: boolean };
  selected?: boolean;
  dimmed?: boolean;
  hovered?: boolean;
  healthOverride?: number;
  size?: "sm" | "md" | "lg" | "xl";
  animClass?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  label?: string;
  className?: string;
}

/**
 * Card face overlays ★ attack · 👢 speed · ♥ health on the template.
 * Face-down cards use the Jerkmate back.
 */
export function CardView({
  card,
  faceDown = false,
  flipReveal,
  selected = false,
  dimmed = false,
  hovered = false,
  healthOverride,
  size = "md",
  animClass = "",
  onClick,
  onMouseEnter,
  onMouseLeave,
  label,
  className = "",
}: CardViewProps) {
  const showBack = (faceDown || !card) && !flipReveal;
  const hp = card
    ? healthOverride !== undefined
      ? healthOverride
      : card.health
    : 0;

  const classNames = [
    "card-view",
    `card-view--${size}`,
    flipReveal && card ? "card-view--flip" : "",
    selected ? "is-selected" : "",
    dimmed ? "is-dimmed" : "",
    hovered ? "is-hovered" : "",
    onClick ? "is-clickable" : "",
    animClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const aria =
    flipReveal && card
      ? "Revealing card…"
      : showBack
        ? label ?? "Hidden card"
        : card
          ? `${card.name}, ${card.attack} attack, ${card.speed} speed, ${hp} health`
          : "Card";

  const faceContent =
    card ? (
      <div className="card-view__face">
        <img
          className="card-view__img"
          src={publicAsset("card-template.png")}
          alt=""
          draggable={false}
        />
        <span className="card-view__name">{card.name}</span>
        <div className="card-view__stats" aria-hidden>
          <span className="stat stat--atk">{card.attack}</span>
          <span className="stat stat--spd">{card.speed}</span>
          <span className="stat stat--hp">{hp}</span>
        </div>
      </div>
    ) : null;

  const inner =
    flipReveal && card && faceContent ? (
      <div
        className={`card-view__flip-inner${flipReveal.active ? " is-flipping" : ""}`}
      >
        <img
          className="card-view__flip-back card-view__img"
          src={publicAsset("card-back.png")}
          alt=""
          draggable={false}
        />
        <div className="card-view__flip-face">{faceContent}</div>
      </div>
    ) : showBack ? (
      <img
        className="card-view__img"
        src={publicAsset("card-back.png")}
        alt=""
        draggable={false}
      />
    ) : (
      faceContent
    );

  if (onClick) {
    return (
      <button
        type="button"
        className={classNames}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        aria-label={aria}
      >
        {inner}
        {label ? <span className="card-view__tag">{label}</span> : null}
      </button>
    );
  }

  return (
    <div
      className={classNames}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={aria}
      role="img"
    >
      {inner}
      {label ? <span className="card-view__tag">{label}</span> : null}
    </div>
  );
}

/** Large flat preview shown on the left while hovering a hand card. */
export function CardPreview({ card }: { card: CardInstance | null }) {
  if (!card) {
    return (
      <aside className="card-preview card-preview--empty" aria-hidden>
        <p>Hover a card in your hand, on the field, or in a discard pile to inspect stats</p>
      </aside>
    );
  }

  return (
    <aside className="card-preview" aria-live="polite">
      <CardView card={card} size="xl" />
      <div className="card-preview__info">
        <h3>{card.name}</h3>
        <p className="card-preview__rarity">{card.rarity}</p>
        {card.description ? <p>{card.description}</p> : null}
        <ul>
          <li>
            <span>★ Attack</span>
            <strong>{card.attack}</strong>
            <em>damage per strike</em>
          </li>
          <li>
            <span>👢 Speed</span>
            <strong>{card.speed}</strong>
            <em>higher strikes first</em>
          </li>
          <li>
            <span>♥ Health</span>
            <strong>
              {card.health}/{card.maxHealth}
            </strong>
            <em>0 → discard pile</em>
          </li>
        </ul>
      </div>
    </aside>
  );
}
