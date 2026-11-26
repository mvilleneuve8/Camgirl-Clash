import { CARD_TEMPLATE_PATH, instantiateCards } from "../card.js";
import type { CardDefinition, CardInstance } from "../types.js";
import { MAX_DECK_SIZE, MIN_DECK_SIZE } from "../player.js";

/**
 * Camgirl catalogue.
 * Icons on the face template: ★ attack · 👢 speed · ♥ health
 * Example: ★3 damage / 👢3 speed / ♥7 HP
 */
export const CARD_CATALOGUE: CardDefinition[] = [
  {
    id: "nova",
    name: "Nova Spark",
    attack: 3,
    speed: 3,
    health: 7,
    rarity: "common",
    description: "Balanced streamer — 3 damage, speed 3, 7 hearts.",
    artPath: CARD_TEMPLATE_PATH,
  },
  {
    id: "velvet",
    name: "Velvet Quinn",
    attack: 1,
    speed: 2,
    health: 5,
    rarity: "common",
    description: "Slow burn. Survives the chat raids.",
  },
  {
    id: "blaze",
    name: "Blaze Hart",
    attack: 4,
    speed: 5,
    health: 2,
    rarity: "uncommon",
    description: "Glass cannon. Crashes in fast.",
  },
  {
    id: "echo",
    name: "Echo Vane",
    attack: 2,
    speed: 5,
    health: 3,
    rarity: "uncommon",
    description: "Always first on the field.",
  },
  {
    id: "luna",
    name: "Luna Drift",
    attack: 3,
    speed: 3,
    health: 4,
    rarity: "rare",
    description: "Equal-speed clash specialist.",
  },
  {
    id: "iris",
    name: "Iris Lock",
    attack: 2,
    speed: 1,
    health: 8,
    rarity: "rare",
    description: "Low speed wall. Last one standing.",
  },
  {
    id: "jade",
    name: "Jade Rush",
    attack: 3,
    speed: 6,
    health: 2,
    rarity: "epic",
    description: "Highest initiative in the room.",
  },
  {
    id: "sable",
    name: "Sable Crown",
    attack: 4,
    speed: 4,
    health: 4,
    rarity: "epic",
    description: "Premium all-rounder.",
  },
  {
    id: "aria",
    name: "Aria Prime",
    attack: 5,
    speed: 2,
    health: 5,
    rarity: "legendary",
    description: "Headliner. Hits like a season finale.",
  },
  {
    id: "pixel",
    name: "Pixel Kiss",
    attack: 1,
    speed: 7,
    health: 1,
    rarity: "legendary",
    description: "Blink-and-you-miss strike.",
  },
];

export function buildStarterDeck(
  seedOffset = 0,
  size = MAX_DECK_SIZE,
): CardInstance[] {
  const count = Math.min(MAX_DECK_SIZE, Math.max(MIN_DECK_SIZE, size));
  const definitions: CardDefinition[] = [];
  for (let i = 0; i < count; i++) {
    const def = CARD_CATALOGUE[(i + seedOffset) % CARD_CATALOGUE.length]!;
    definitions.push(def);
  }
  return instantiateCards(definitions);
}

/** Testing deck: three copies of the same Camgirl (default Nova Spark 3/3/7). */
export function buildTestDeck(definitionId = "nova", size = 3): CardInstance[] {
  const def = CARD_CATALOGUE.find((c) => c.id === definitionId);
  if (!def) throw new Error(`Unknown Camgirl: ${definitionId}`);
  const count = Math.min(MAX_DECK_SIZE, Math.max(MIN_DECK_SIZE, size));
  return instantiateCards(Array.from({ length: count }, () => def));
}

function randomStat(): number {
  return Math.floor(Math.random() * 10) + 1;
}

/** Random deck: catalogue faces with ★/👢/♥ each rolled 1–10. */
export function buildRandomDeck(size = 3, idPrefix = "random"): CardInstance[] {
  const count = Math.min(MAX_DECK_SIZE, Math.max(MIN_DECK_SIZE, size));
  const definitions: CardDefinition[] = [];
  for (let i = 0; i < count; i++) {
    const face = CARD_CATALOGUE[Math.floor(Math.random() * CARD_CATALOGUE.length)]!;
    definitions.push({
      id: `${idPrefix}-${i}`,
      name: face.name,
      attack: randomStat(),
      speed: randomStat(),
      health: randomStat(),
      rarity: face.rarity,
      description: `Random stats — ${face.description ?? "rogue streamer"}`,
      artPath: CARD_TEMPLATE_PATH,
    });
  }
  return instantiateCards(definitions);
}

/** @deprecated Use {@link buildRandomDeck} */
export function buildRandomBotDeck(size = 3): CardInstance[] {
  return buildRandomDeck(size, "bot-random");
}

export function getDefinition(id: string): CardDefinition | undefined {
  return CARD_CATALOGUE.find((c) => c.id === id);
}
