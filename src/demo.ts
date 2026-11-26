/**
 * Console demo with auto-draw opening hands.
 */
import { buildTestDeck, Game, resetInstanceCounter } from "./index.js";

resetInstanceCounter();

const game = new Game(buildTestDeck("nova", 3), buildTestDeck("nova", 3), {
  player1Name: "Alex",
  player2Name: "Bot",
});
game.start();

function pick(playerId: "player1" | "player2"): string {
  const hand = game.snapshot().players[playerId].hand;
  const card = hand[0];
  if (!card) throw new Error(`${playerId} empty hand`);
  return card.instanceId;
}

let safety = 0;
while (game.snapshot().phase !== "ended" && safety < 40) {
  safety += 1;
  const { phase, players } = game.snapshot();

  if (phase === "placement" || phase === "replace") {
    for (const id of ["player1", "player2"] as const) {
      if (!players[id].needsReplace) continue;
      if (players[id].hand.length === 0) continue;
      if (game.snapshot().phase === "replace") {
        game.submitReplace({ playerId: id, instanceId: pick(id) });
      } else if (game.snapshot().phase === "placement") {
        game.submitPlacement({ playerId: id, instanceId: pick(id) });
      }
    }
    continue;
  }
  break;
}

console.log("=== Game log ===");
for (const line of game.getLog()) console.log(`• ${line}`);
const final = game.snapshot();
console.log(
  "\nResult:",
  final.isDraw ? "DRAW" : final.winnerId ? final.players[final.winnerId].name : "?",
);
