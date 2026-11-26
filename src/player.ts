import { isCardDefeated } from "./card.js";
import { Deck } from "./deck.js";
import type { CardInstance, PlayerId, PlayerSnapshot } from "./types.js";

/** A player loses after this many Camgirls are in their discard pile. */
export const DEFEAT_THRESHOLD = 3;

/** Opening hand size and refill target after mulligan / after placing. */
export const HAND_SIZE = 3;

/** Decks may contain between MIN and MAX Camgirls. */
export const MIN_DECK_SIZE = 3;
export const MAX_DECK_SIZE = 20;

export class Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly deck: Deck;
  hand: CardInstance[] = [];
  /** Camgirls currently on the battlefield. */
  field: CardInstance[] = [];
  /** Defeated Camgirls (0 HP). Length drives the loss condition. */
  discard: CardInstance[] = [];

  constructor(id: PlayerId, name: string, deck: Deck) {
    this.id = id;
    this.name = name;
    this.deck = deck;
  }

  get beatenCount(): number {
    return this.discard.length;
  }

  get defeated(): boolean {
    return this.beatenCount >= DEFEAT_THRESHOLD;
  }

  /** Draw up to `count` cards into hand (skips gracefully when the deck is empty). */
  draw(count: number): CardInstance[] {
    if (count <= 0 || this.deck.isEmpty) return [];
    const drawn = this.deck.draw(count);
    this.hand.push(...drawn);
    return drawn;
  }

  /**
   * Draw until the hand has `target` cards.
   * If the deck is empty, drawing is simply skipped.
   */
  drawToHandSize(target = HAND_SIZE): CardInstance[] {
    const needed = Math.max(0, target - this.hand.length);
    return this.draw(needed);
  }

  /**
   * Mulligan: put selected hand cards on the bottom of the deck, then refill.
   * @param instanceIds Camgirls from hand to send to the bottom (any subset).
   */
  mulligan(instanceIds: string[]): CardInstance[] {
    const idSet = new Set(instanceIds);
    const returning: CardInstance[] = [];
    const keeping: CardInstance[] = [];

    for (const card of this.hand) {
      if (idSet.has(card.instanceId)) {
        returning.push(card);
        idSet.delete(card.instanceId);
      } else {
        keeping.push(card);
      }
    }

    if (idSet.size > 0) {
      const missing = [...idSet].join(", ");
      throw new Error(`Cannot mulligan cards not in hand: ${missing}`);
    }

    this.hand = keeping;
    this.deck.putOnBottom(returning);
    return this.drawToHandSize(HAND_SIZE);
  }

  /**
   * Place a Camgirl from hand onto the field (no auto-draw — player must
   * click the deck separately when they want another card).
   */
  placeFromHand(instanceId: string): CardInstance {
    const index = this.hand.findIndex((c) => c.instanceId === instanceId);
    if (index === -1) {
      throw new Error(`Camgirl ${instanceId} is not in ${this.name}'s hand`);
    }
    const [card] = this.hand.splice(index, 1);
    // Always sit in the leftmost field slot for this player.
    this.field = [card!];
    return card!;
  }

  findOnField(instanceId: string): CardInstance | undefined {
    return this.field.find((c) => c.instanceId === instanceId);
  }

  /**
   * Apply HP loss to a field Camgirl. At 0 HP she moves to the discard pile.
   * Returns true if she was defeated.
   */
  applyDamage(instanceId: string, amount: number): boolean {
    const card = this.findOnField(instanceId);
    if (!card) {
      throw new Error(`Camgirl ${instanceId} is not on ${this.name}'s field`);
    }

    card.health -= amount;
    if (!isCardDefeated(card)) return false;

    this.field = this.field.filter((c) => c.instanceId !== instanceId);
    const restored = { ...card, health: card.maxHealth };
    this.discard.push(restored);
    return true;
  }

  snapshot(needsReplace = false): PlayerSnapshot {
    return {
      id: this.id,
      name: this.name,
      hand: this.hand.map((c) => ({ ...c })),
      deckCount: this.deck.size,
      field: this.field.map((c) => ({ ...c })),
      discard: this.discard.map((c) => ({ ...c })),
      beatenCount: this.beatenCount,
      defeated: this.defeated,
      needsReplace,
    };
  }
}
