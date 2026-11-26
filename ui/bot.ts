import { HAND_SIZE } from "../src/player";
import type { Game } from "../src/game";
import type { CardInstance, PlayerId } from "../src/types";

export const BOT_ID: PlayerId = "player2";
export const HUMAN_ID: PlayerId = "player1";

type BattleResult = ReturnType<Game["submitPlacement"]>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickHandCard(hand: CardInstance[]): CardInstance | undefined {
  return [...hand].sort((a, b) => b.speed - a.speed || b.attack - a.attack)[0];
}

/**
 * Test bot: waits briefly, then places the best Camgirl from hand.
 * Hand refill is handled by the game engine.
 */
export async function runBotTurn(
  game: Game,
  opts: { refresh?: () => void } = {},
): Promise<BattleResult> {
  let state = game.snapshot();
  if (state.phase === "ended" || state.phase === "combat") return null;

  const bot = state.players[BOT_ID];
  if (!bot.needsReplace) return null;

  if (bot.hand.length === 0) return null;

  await sleep(500 + Math.random() * 800);

  state = game.snapshot();
  const hand = state.players[BOT_ID].hand;
  if (hand.length === 0) return null;

  const pick = pickHandCard(hand);
  if (!pick) return null;

  opts.refresh?.();

  if (state.phase === "replace") {
    return game.submitReplace({ playerId: BOT_ID, instanceId: pick.instanceId });
  }
  if (state.phase === "placement") {
    return game.submitPlacement({ playerId: BOT_ID, instanceId: pick.instanceId });
  }
  return null;
}

export async function ensureBotActs(
  game: Game,
  opts: { refresh?: () => void } = {},
): Promise<BattleResult> {
  const state = game.snapshot();
  if (!state.players[BOT_ID].needsReplace) return null;
  if (state.phase !== "placement" && state.phase !== "replace") return null;
  return runBotTurn(game, opts);
}

/** Bot timeout handler — random placement when turn expires. */
export function runBotTimeout(game: Game): BattleResult {
  return game.submitTimeoutPlacement(BOT_ID);
}
