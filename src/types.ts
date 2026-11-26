/** Shared domain types for the Camgirl card game. */

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type PlayerId = "player1" | "player2";

export type GamePhase =
  | "setup"
  | "mulligan"
  | "placement"
  | "replace"
  | "combat"
  | "ended";

/** Immutable Camgirl definition (template from a catalogue). */
export interface CardDefinition {
  id: string;
  name: string;
  /** Damage dealt each time this Camgirl strikes (★ on the card). */
  attack: number;
  /** Initiative — higher speed strikes first (👢 on the card). */
  speed: number;
  /** Hits that can be taken before discard (♥ on the card). */
  health: number;
  rarity: Rarity;
  description?: string;
  artPath?: string;
}

/**
 * A live Camgirl instance in a deck, hand, field, or discard.
 * `instanceId` is unique per copy; `definitionId` points at the template.
 */
export interface CardInstance {
  instanceId: string;
  definitionId: string;
  name: string;
  attack: number;
  speed: number;
  /** Current remaining HP (starts at the definition's health). */
  health: number;
  maxHealth: number;
  rarity: Rarity;
  description?: string;
  artPath?: string;
}

/**
 * One animated combat beat for the UI.
 * - `clash` — equal speed, both crash together and deal damage
 * - `crash` — faster Camgirl crashes into the slower one
 */
export interface CombatStep {
  kind: "clash" | "crash";
  /** Delay hint in ms before playing the next step (UI may override). */
  delayMs: number;
  /** Cards that animate toward each other. */
  movers: Array<{
    playerId: PlayerId;
    cardId: string;
    cardName: string;
    damageDealt: number;
  }>;
  /** HP after this step resolves. */
  healthAfter: Record<string, number>;
  discarded: Array<{ playerId: PlayerId; cardId: string; cardName: string }>;
}

export interface AutobattleResult {
  steps: CombatStep[];
  discarded: Array<{ playerId: PlayerId; card: CardInstance }>;
  /** Field Camgirls at fight start — UI animates these while HP ticks down. */
  initialField: Record<PlayerId, CardInstance | null>;
}

export interface PlayerSnapshot {
  id: PlayerId;
  name: string;
  hand: CardInstance[];
  deckCount: number;
  /** Hidden — only count is exposed publicly. */
  field: CardInstance[];
  discard: CardInstance[];
  beatenCount: number;
  defeated: boolean;
  /** True when this player must place a face-up replacement. */
  needsReplace: boolean;
}

export interface GameSnapshot {
  phase: GamePhase;
  players: Record<PlayerId, PlayerSnapshot>;
  winnerId: PlayerId | null;
  isDraw: boolean;
  roundNumber: number;
  /** Players who have locked a simultaneous placement but not yet revealed. */
  lockedPlacement: PlayerId[];
  log: string[];
}
