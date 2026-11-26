# Camgirl Clash

Battle board UI with deck-click draws, bot opponent, and hover inspection.

## Play

```bash
npm install
npm run dev
```

1. **Start vs Bot** — both get a **3-card deck** of Nova Spark (★3 / 👢3 / ♥7).
2. **Click your deck** (cyan, right) to draw — watch the 3D lift into hand.
3. **Hover** a hand card — cyan outline + large preview on the left with full stats.
4. **Click** the hand card to place it on your **left** field slot.
5. Bot mirrors the same flow automatically.
6. Combat animates with delays; defeated Camgirls go to the **left** discard pile.

## Board layout (`assets/battle-board.png`)

| Side | Discard | Field (place here) | Deck |
|------|---------|--------------------|------|
| You (cyan, bottom) | Left | Left of the two stars | Right |
| Bot (pink, top) | Left | Their left = right star from your view | Right |

## Assets

- `assets/battle-board.png` — table
- `assets/card-template.png` — face (★ ATK · 👢 SPD · ♥ HP)
- `assets/card-back.png` — hidden / deck
