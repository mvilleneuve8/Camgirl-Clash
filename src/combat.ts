import type { AutobattleResult, CardInstance, CombatStep, PlayerId } from "./types.js";
import type { Player } from "./player.js";

/** Default pause between animated strikes (≤ a few seconds). */
export const STRIKE_DELAY_MS = 1600;

/**
 * 1v1 speed auto-battler between each player's single field Camgirl.
 *
 * - Higher speed crashes into the other first (one-way `crash` step).
 * - Equal speed → both clash together (`clash` step) and deal damage at once.
 * - After a full exchange (fast then slow, or one clash), delay, then repeat
 *   until a Camgirl hits 0 HP and is sent to the discard pile.
 */
export function resolveAutobattle(
  player1: Player,
  player2: Player,
): AutobattleResult {
  const steps: CombatStep[] = [];
  const discarded: AutobattleResult["discarded"] = [];
  const initialField: AutobattleResult["initialField"] = {
    player1: player1.field[0] ? { ...player1.field[0] } : null,
    player2: player2.field[0] ? { ...player2.field[0] } : null,
  };

  const stillFighting = (): boolean =>
    player1.field.length > 0 &&
    player2.field.length > 0 &&
    !player1.defeated &&
    !player2.defeated;

  let safety = 0;
  while (stillFighting() && safety < 100) {
    safety += 1;

    const a = player1.field[0]!;
    const b = player2.field[0]!;

    if (a.speed === b.speed) {
      const step = applyClash(player1, a, player2, b);
      steps.push(step);
      collectDiscarded(step, player1, player2, discarded);
    } else {
      const firstOwner = a.speed > b.speed ? player1 : player2;
      const firstCard = a.speed > b.speed ? a : b;
      const secondOwner = a.speed > b.speed ? player2 : player1;
      const secondCard = a.speed > b.speed ? b : a;

      const crash1 = applyCrash(
        firstOwner,
        firstCard,
        secondOwner,
        secondCard,
        player1,
        player2,
      );
      steps.push(crash1);
      collectDiscarded(crash1, player1, player2, discarded);

      if (!stillFighting()) break;

      // Re-read living cards (references stay valid; may already be discarded).
      const aliveFirst = firstOwner.findOnField(firstCard.instanceId);
      const aliveSecond = secondOwner.findOnField(secondCard.instanceId);
      if (!aliveFirst || !aliveSecond) break;

      const crash2 = applyCrash(
        secondOwner,
        aliveSecond,
        firstOwner,
        aliveFirst,
        player1,
        player2,
      );
      steps.push(crash2);
      collectDiscarded(crash2, player1, player2, discarded);
    }
  }

  return { steps, discarded, initialField };
}

function healthMap(
  player1: Player,
  player2: Player,
  ...cards: CardInstance[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of [
    ...player1.field,
    ...player2.field,
    ...player1.discard,
    ...player2.discard,
    ...cards,
  ]) {
    map[c.instanceId] = Math.max(0, c.health);
  }
  return map;
}

function applyCrash(
  attackerOwner: Player,
  attacker: CardInstance,
  defenderOwner: Player,
  defender: CardInstance,
  player1: Player,
  player2: Player,
): CombatStep {
  const defeated = defenderOwner.applyDamage(defender.instanceId, attacker.attack);
  const discarded: CombatStep["discarded"] = [];
  if (defeated) {
    discarded.push({
      playerId: defenderOwner.id,
      cardId: defender.instanceId,
      cardName: defender.name,
    });
  }

  return {
    kind: "crash",
    delayMs: STRIKE_DELAY_MS,
    movers: [
      {
        playerId: attackerOwner.id,
        cardId: attacker.instanceId,
        cardName: attacker.name,
        damageDealt: attacker.attack,
      },
    ],
    healthAfter: healthMap(player1, player2, attacker, defender),
    discarded,
  };
}

function applyClash(
  p1: Player,
  a: CardInstance,
  p2: Player,
  b: CardInstance,
): CombatStep {
  const dmgToB = a.attack;
  const dmgToA = b.attack;

  const bDefeated = p2.applyDamage(b.instanceId, dmgToB);
  const aDefeated = p1.applyDamage(a.instanceId, dmgToA);

  const discarded: CombatStep["discarded"] = [];
  if (aDefeated) {
    discarded.push({ playerId: "player1", cardId: a.instanceId, cardName: a.name });
  }
  if (bDefeated) {
    discarded.push({ playerId: "player2", cardId: b.instanceId, cardName: b.name });
  }

  return {
    kind: "clash",
    delayMs: STRIKE_DELAY_MS,
    movers: [
      {
        playerId: "player1",
        cardId: a.instanceId,
        cardName: a.name,
        damageDealt: dmgToB,
      },
      {
        playerId: "player2",
        cardId: b.instanceId,
        cardName: b.name,
        damageDealt: dmgToA,
      },
    ],
    healthAfter: healthMap(p1, p2, a, b),
    discarded,
  };
}

function collectDiscarded(
  step: CombatStep,
  player1: Player,
  player2: Player,
  out: AutobattleResult["discarded"],
): void {
  for (const d of step.discarded) {
    const owner = d.playerId === "player1" ? player1 : player2;
    const card = owner.discard.find((c) => c.instanceId === d.cardId);
    if (card) out.push({ playerId: d.playerId, card: { ...card } });
  }
}

export function opponentId(id: PlayerId): PlayerId {
  return id === "player1" ? "player2" : "player1";
}
