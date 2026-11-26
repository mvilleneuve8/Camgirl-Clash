import type { CardDefinition, CardInstance } from "./types.js";

/** Shared PNG frame for every Camgirl face (name / art / ★ ATK · 👢 SPD · ♥ HP). */
export const CARD_TEMPLATE_PATH = "assets/card-template.png";

/** Jerkmate back — shown for decks and hidden opponent cards. */
export const CARD_BACK_PATH = "assets/card-back.png";

let nextInstanceSeq = 1;

/** Create a unique instance from a Camgirl definition. */
export function instantiateCard(definition: CardDefinition): CardInstance {
  return {
    instanceId: `${definition.id}-${nextInstanceSeq++}`,
    definitionId: definition.id,
    name: definition.name,
    attack: definition.attack,
    speed: definition.speed,
    health: definition.health,
    maxHealth: definition.health,
    rarity: definition.rarity,
    description: definition.description,
    artPath: definition.artPath ?? CARD_TEMPLATE_PATH,
  };
}

export function instantiateCards(definitions: CardDefinition[]): CardInstance[] {
  return definitions.map(instantiateCard);
}

export function resetInstanceCounter(): void {
  nextInstanceSeq = 1;
}

export function isCardDefeated(card: CardInstance): boolean {
  return card.health <= 0;
}

/** Compact ATK/SPD/HP label matching template icons: star, boot, heart. */
export function formatCardStats(
  card: Pick<CardInstance, "attack" | "speed" | "health">,
): string {
  return `${card.attack}/${card.speed}/${card.health}`;
}
