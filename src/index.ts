export type {
  AutobattleResult,
  CardDefinition,
  CardInstance,
  CombatStep,
  GamePhase,
  GameSnapshot,
  PlayerId,
  PlayerSnapshot,
  Rarity,
} from "./types.js";
export {
  CARD_BACK_PATH,
  CARD_TEMPLATE_PATH,
  formatCardStats,
  instantiateCard,
  instantiateCards,
  isCardDefeated,
  resetInstanceCounter,
} from "./card.js";
export { Deck } from "./deck.js";
export {
  DEFEAT_THRESHOLD,
  HAND_SIZE,
  MAX_DECK_SIZE,
  MIN_DECK_SIZE,
  Player,
} from "./player.js";
export { resolveAutobattle, STRIKE_DELAY_MS } from "./combat.js";
export { Game, PLACEMENT_TURN_SECONDS } from "./game.js";
export type { GameOptions, MulliganChoice, PlacementChoice } from "./game.js";
export {
  CARD_CATALOGUE,
  buildRandomBotDeck,
  buildRandomDeck,
  buildStarterDeck,
  buildTestDeck,
  getDefinition,
} from "./data/cards.js";
