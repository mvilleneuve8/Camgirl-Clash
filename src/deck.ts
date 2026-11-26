import type { CardInstance } from "./types.js";

/**
 * Deck: draw from the top (index 0), put cards at the bottom (end of array).
 */
export class Deck {
  private cards: CardInstance[];

  constructor(cards: CardInstance[] = []) {
    this.cards = [...cards];
  }

  get size(): number {
    return this.cards.length;
  }

  get isEmpty(): boolean {
    return this.cards.length === 0;
  }

  /** Fisher–Yates shuffle in place. */
  shuffle(rng: () => number = Math.random): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j]!, this.cards[i]!];
    }
  }

  /** Draw up to `count` cards from the top. Returns fewer if the deck runs out. */
  draw(count: number): CardInstance[] {
    if (count <= 0) return [];
    return this.cards.splice(0, count);
  }

  /** Peek at the top card without removing it. */
  peek(): CardInstance | undefined {
    return this.cards[0];
  }

  /** Put one or more cards on the bottom of the deck (preserve given order). */
  putOnBottom(cards: CardInstance[]): void {
    this.cards.push(...cards);
  }

  /** Put one or more cards on top of the deck (first card becomes the new top). */
  putOnTop(cards: CardInstance[]): void {
    this.cards.unshift(...cards);
  }

  toArray(): CardInstance[] {
    return [...this.cards];
  }

  clone(): Deck {
    return new Deck(this.cards.map((c) => ({ ...c })));
  }
}
