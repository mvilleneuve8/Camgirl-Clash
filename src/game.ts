import { CARD_BACK_PATH, formatCardStats } from "./card.js";
import { resolveAutobattle } from "./combat.js";
import { Deck } from "./deck.js";
import {
  HAND_SIZE,
  MAX_DECK_SIZE,
  MIN_DECK_SIZE,
  Player,
} from "./player.js";
import type {
  AutobattleResult,
  CardInstance,
  GamePhase,
  GameSnapshot,
  PlayerId,
} from "./types.js";

export interface MulliganChoice {
  playerId: PlayerId;
  returnIds: string[];
}

export interface PlacementChoice {
  playerId: PlayerId;
  instanceId: string;
}

export interface GameOptions {
  player1Name?: string;
  player2Name?: string;
  rng?: () => number;
}

/** Seconds allowed to choose a Camgirl for the field before a random pick. */
export const PLACEMENT_TURN_SECONDS = 30;

/**
 * Simultaneous first drop → 1v1 speed auto-battle → replace face-up on defeat.
 *
 * - First Camgirls: both lock choices, reveal together, then fight.
 * - On defeat: Camgirl → discard; that player places a new one from hand face-up.
 * - If both need a Camgirl (mutual KO or opening), simultaneous lock-in again.
 */
export class Game {
  readonly players: Record<PlayerId, Player>;
  phase: GamePhase = "setup";
  winnerId: PlayerId | null = null;
  isDraw = false;
  roundNumber = 0;
  private readonly log: string[] = [];
  private readonly pendingMulligan = new Set<PlayerId>();
  private readonly pendingPlacement = new Map<PlayerId, string>();
  /** Cards pulled from hand during lock-in, before reveal. */
  private readonly pendingHeld = new Map<PlayerId, CardInstance>();
  private readonly needsReplace = new Set<PlayerId>();
  private readonly rng: () => number;
  /** Last fight result for the UI to animate. */
  lastBattle: AutobattleResult | null = null;

  constructor(
    player1Deck: CardInstance[],
    player2Deck: CardInstance[],
    options: GameOptions = {},
  ) {
    this.assertDeckSize(player1Deck, "player1");
    this.assertDeckSize(player2Deck, "player2");

    this.rng = options.rng ?? Math.random;
    this.players = {
      player1: new Player(
        "player1",
        options.player1Name ?? "Player 1",
        new Deck(player1Deck),
      ),
      player2: new Player(
        "player2",
        options.player2Name ?? "Player 2",
        new Deck(player2Deck),
      ),
    };
  }

  private assertDeckSize(cards: CardInstance[], label: string): void {
    if (cards.length < MIN_DECK_SIZE || cards.length > MAX_DECK_SIZE) {
      throw new Error(
        `${label} deck must have ${MIN_DECK_SIZE}–${MAX_DECK_SIZE} Camgirls (got ${cards.length})`,
      );
    }
  }

  private record(message: string): void {
    this.log.push(message);
  }

  start(): void {
    if (this.phase !== "setup") {
      throw new Error("Game has already started");
    }

    for (const player of Object.values(this.players)) {
      player.deck.shuffle(this.rng);
    }

    for (const id of ["player1", "player2"] as PlayerId[]) {
      this.refillHand(id, true);
    }

    this.beginSimultaneousPlacement();
    this.record(
      "Match ready — opening hands dealt. Click a hand card to place (30s per turn).",
    );
  }

  /**
   * Draw from deck until the hand has HAND_SIZE cards (skipped when deck is empty).
   * @param opening When true, logs a single summary line instead of per-card draws.
   */
  refillHand(playerId: PlayerId, opening = false): CardInstance[] {
    if (this.phase === "combat") return [];
    const player = this.players[playerId];
    const drawn = player.drawToHandSize(HAND_SIZE);
    if (drawn.length > 0) {
      if (opening) {
        this.record(
          `${player.name} draws opening hand (${drawn.length} card${drawn.length === 1 ? "" : "s"}).`,
        );
      } else {
        this.record(
          `${player.name} draws: ${drawn.map((c) => c.name).join(", ")}.`,
        );
      }
    }
    return drawn;
  }

  refillAllHands(): void {
    for (const id of ["player1", "player2"] as PlayerId[]) {
      this.refillHand(id);
    }
  }

  /** Random hand card when the placement timer expires. */
  submitTimeoutPlacement(playerId: PlayerId): AutobattleResult | null {
    const player = this.players[playerId];
    const hand = player.hand;
    if (hand.length === 0) return null;
    const pick = hand[Math.floor(this.rng() * hand.length)]!;
    this.record(
      `${player.name} ran out of time — ${pick.name} is placed at random.`,
    );
    if (this.phase === "replace") {
      return this.submitReplace({ playerId, instanceId: pick.instanceId });
    }
    if (this.phase === "placement") {
      return this.submitPlacement({ playerId, instanceId: pick.instanceId });
    }
    return null;
  }

  submitMulligan(choice: MulliganChoice): void {
    if (this.phase !== "mulligan") {
      throw new Error("Not in mulligan phase");
    }
    if (!this.pendingMulligan.has(choice.playerId)) {
      throw new Error(`${choice.playerId} already submitted their mulligan`);
    }

    const player = this.players[choice.playerId];
    const returning = choice.returnIds;
    const returnedNames = returning
      .map((id) => player.hand.find((c) => c.instanceId === id)?.name ?? id)
      .join(", ");
    const drawn = player.mulligan(returning);

    if (returning.length === 0) {
      this.record(`${player.name} keeps their opening hand.`);
    } else {
      this.record(
        `${player.name} returns: ${returnedNames}. Redraws: ${drawn.map((c) => c.name).join(", ") || "(deck empty)"}`,
      );
    }

    this.pendingMulligan.delete(choice.playerId);
    if (this.pendingMulligan.size === 0) {
      this.beginSimultaneousPlacement();
    }
  }

  skipAllMulligans(): void {
    if (this.phase !== "mulligan") return;
    this.submitMulligan({ playerId: "player1", returnIds: [] });
    this.submitMulligan({ playerId: "player2", returnIds: [] });
  }

  private beginSimultaneousPlacement(): void {
    this.roundNumber += 1;
    this.pendingPlacement.clear();
    this.pendingHeld.clear();
    this.needsReplace.clear();
    this.needsReplace.add("player1");
    this.needsReplace.add("player2");
    this.refillAllHands();
    this.phase = "placement";
    this.record(
      `Round ${this.roundNumber} — both players drop a Camgirl at the same time (hidden until both lock in).`,
    );
  }

  private beginReplace(who: PlayerId[]): void {
    this.needsReplace.clear();
    for (const id of who) this.needsReplace.add(id);
    this.pendingPlacement.clear();
    this.pendingHeld.clear();
    for (const id of who) this.refillHand(id);

    if (who.length === 2) {
      this.phase = "placement";
      this.roundNumber += 1;
      this.record(
        `Round ${this.roundNumber} — both players must drop a new Camgirl simultaneously.`,
      );
    } else {
      this.phase = "replace";
      const p = this.players[who[0]!];
      this.record(
        `${p.name} must set a new Camgirl from hand face-up to replace their combatant.`,
      );
    }
  }

  /**
   * Simultaneous lock-in (opening / mutual empty field).
   * Returns a battle result when both are ready and fight starts; otherwise null.
   */
  submitPlacement(choice: PlacementChoice): AutobattleResult | null {
    if (this.phase !== "placement") {
      throw new Error("Not in simultaneous placement phase");
    }
    if (this.pendingPlacement.has(choice.playerId)) {
      throw new Error(`${choice.playerId} already locked in`);
    }
    if (!this.needsReplace.has(choice.playerId)) {
      throw new Error(`${choice.playerId} does not need to place`);
    }

    const player = this.players[choice.playerId];
    const index = player.hand.findIndex((c) => c.instanceId === choice.instanceId);
    if (index === -1) {
      throw new Error(`Camgirl not in ${player.name}'s hand`);
    }

    const [card] = player.hand.splice(index, 1);
    this.pendingHeld.set(choice.playerId, card!);
    this.pendingPlacement.set(choice.playerId, choice.instanceId);
    this.record(`${player.name} locks in (face-down until both ready).`);

    if (this.pendingPlacement.size < this.needsReplace.size) {
      return null;
    }

    return this.revealAndFight();
  }

  /**
   * Face-up replacement after a defeat. Starts combat again once the
   * replacing player(s) have a Camgirl on the field.
   */
  submitReplace(choice: PlacementChoice): AutobattleResult | null {
    if (this.phase !== "replace") {
      throw new Error("Not in replace phase");
    }
    if (!this.needsReplace.has(choice.playerId)) {
      throw new Error(`${choice.playerId} does not need to replace`);
    }

    const player = this.players[choice.playerId];
    if (player.field.length > 0) {
      throw new Error(`${player.name} already has a combatant`);
    }

    const card = player.placeFromHand(choice.instanceId);
    this.needsReplace.delete(choice.playerId);
    this.refillHand(choice.playerId);
    this.record(
      `${player.name} sets ${card.name} [${formatCardStats(card)}] face-up.`,
    );

    if (this.needsReplace.size > 0) {
      return null;
    }

    // Opponent still on field → fight immediately.
    const p1 = this.players.player1;
    const p2 = this.players.player2;
    if (p1.field.length > 0 && p2.field.length > 0) {
      return this.runCombat();
    }

    // Someone couldn't place (empty hand) — check loss / wait.
    if (this.checkWinner()) return this.lastBattle;
    this.beginSimultaneousPlacement();
    return null;
  }

  private revealAndFight(): AutobattleResult {
    for (const playerId of [...this.needsReplace]) {
      const player = this.players[playerId];
      const card = this.pendingHeld.get(playerId);
      if (!card) {
        throw new Error(`Missing held Camgirl for ${playerId}`);
      }
      player.field = [card];
      this.refillHand(playerId);
      this.record(
        `${player.name} reveals ${card.name} [${formatCardStats(card)}].`,
      );
    }

    this.pendingPlacement.clear();
    this.pendingHeld.clear();
    this.needsReplace.clear();
    return this.runCombat();
  }

  private runCombat(): AutobattleResult {
    this.phase = "combat";
    this.record("Fight — higher speed crashes first; equal speed clashes together.");

    const result = resolveAutobattle(this.players.player1, this.players.player2);
    this.lastBattle = result;

    for (const step of result.steps) {
      if (step.kind === "clash") {
        const [m1, m2] = step.movers;
        this.record(
          `CLASH! ${m1?.cardName} deals ${m1?.damageDealt}, ${m2?.cardName} deals ${m2?.damageDealt}.`,
        );
      } else {
        const m = step.movers[0]!;
        this.record(`CRASH! ${m.cardName} strikes for ${m.damageDealt}.`);
      }
      for (const d of step.discarded) {
        this.record(`${d.cardName} → discard pile (${d.playerId}).`);
      }
    }

    const p1 = this.players.player1;
    const p2 = this.players.player2;
    this.record(
      `Discard — ${p1.name}: ${p1.beatenCount}/3, ${p2.name}: ${p2.beatenCount}/3`,
    );

    if (this.checkWinner()) {
      return result;
    }

    const missing: PlayerId[] = [];
    if (p1.field.length === 0) missing.push("player1");
    if (p2.field.length === 0) missing.push("player2");

    if (missing.length === 0) {
      this.beginSimultaneousPlacement();
      return result;
    }

    // Can still play if they have a hand card OR remaining deck to draw from.
    const canStillPlay = (id: PlayerId): boolean => {
      const p = this.players[id];
      return p.hand.length > 0 || p.deck.size > 0;
    };

    const able = missing.filter(canStillPlay);
    const unable = missing.filter((id) => !canStillPlay(id));

    if (unable.length > 0 && able.length === 0) {
      // Nobody can field another Camgirl.
      if (!this.checkWinner()) {
        this.phase = "ended";
        this.winnerId =
          p1.field.length > 0 ? "player1" : p2.field.length > 0 ? "player2" : null;
        this.isDraw = this.winnerId === null;
        this.record(
          this.isDraw
            ? "Draw — neither player can field another Camgirl."
            : `${this.players[this.winnerId!].name} wins — opponent cannot replace.`,
        );
      }
      return result;
    }

    if (unable.length === 1) {
      const out = unable[0]!;
      const winner: PlayerId = out === "player1" ? "player2" : "player1";
      // Opponent still on field OR can still play → they win.
      if (
        !this.players[winner].defeated &&
        (this.players[winner].field.length > 0 || canStillPlay(winner))
      ) {
        this.phase = "ended";
        this.winnerId = winner;
        this.isDraw = false;
        this.record(
          `${this.players[winner].name} wins — ${this.players[out].name} has no cards left.`,
        );
        return result;
      }
    }

    this.beginReplace(able.length > 0 ? able : missing);
    return result;
  }

  private checkWinner(): boolean {
    const p1 = this.players.player1;
    const p2 = this.players.player2;

    if (p1.defeated && p2.defeated) {
      this.phase = "ended";
      this.winnerId = null;
      this.isDraw = true;
      this.record("Draw — both players had 3 Camgirls defeated.");
      return true;
    }
    if (p1.defeated) {
      this.phase = "ended";
      this.winnerId = "player2";
      this.isDraw = false;
      this.record(`${p2.name} wins! ${p1.name} reached 3 discarded Camgirls.`);
      return true;
    }
    if (p2.defeated) {
      this.phase = "ended";
      this.winnerId = "player1";
      this.isDraw = false;
      this.record(`${p1.name} wins! ${p2.name} reached 3 discarded Camgirls.`);
      return true;
    }
    return false;
  }

  snapshot(): GameSnapshot {
    return {
      phase: this.phase,
      players: {
        player1: this.snapshotPlayer("player1"),
        player2: this.snapshotPlayer("player2"),
      },
      winnerId: this.winnerId,
      isDraw: this.isDraw,
      roundNumber: this.roundNumber,
      lockedPlacement: [...this.pendingPlacement.keys()],
      log: [...this.log],
    };
  }

  private snapshotPlayer(id: PlayerId) {
    const p = this.players[id];
    return {
      id: p.id,
      name: p.name,
      hand: p.hand.map((c) => ({ ...c })),
      deckCount: p.deck.size,
      field: p.field.map((c) => ({ ...c })),
      discard: p.discard.map((c) => ({ ...c })),
      beatenCount: p.beatenCount,
      defeated: p.defeated,
      needsReplace: this.needsReplace.has(id),
    };
  }

  getLog(): readonly string[] {
    return this.log;
  }

  /** Asset path helper for UIs that only know the card back. */
  static get CARD_BACK(): string {
    return CARD_BACK_PATH;
  }
}
