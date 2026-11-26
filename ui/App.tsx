import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildRandomDeck,
  Game,
  PLACEMENT_TURN_SECONDS,
  resetInstanceCounter,
  STRIKE_DELAY_MS,
} from "../src/index";
import type {
  AutobattleResult,
  CardInstance,
  CombatStep,
  GameSnapshot,
  PlayerId,
} from "../src/types";
import { publicAsset } from "./assets";
import { CardPreview, CardView } from "./CardView";
import {
  DeckZone,
  DiscardPileModal,
  DiscardZone,
  FieldCard,
} from "./BoardZones";
import { EndOverlay } from "./EndOverlay";
import { BOT_ID, ensureBotActs, HUMAN_ID, runBotTimeout, runBotTurn } from "./bot";

const END_OVERLAY_DELAY_MS = 2000;
const FLIP_REVEAL_MS = 680;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Opponent was face-down locked — their card flips on reveal when the other player locks in. */
function flipRevealOnLockIn(
  lockedBefore: PlayerId[],
  placerId: PlayerId,
): PlayerId | undefined {
  const opponent = placerId === HUMAN_ID ? BOT_ID : HUMAN_ID;
  return lockedBefore.includes(opponent) ? opponent : undefined;
}

/** Discard pile as shown on board — hides this fight's KO'd cards until they fly in. */
function discardVisibleDuringBattle(
  snap: GameSnapshot,
  result: AutobattleResult,
): Record<PlayerId, CardInstance[]> {
  const pending = new Set(result.discarded.map((d) => d.card.instanceId));
  return {
    player1: snap.players.player1.discard.filter((c) => !pending.has(c.instanceId)),
    player2: snap.players.player2.discard.filter((c) => !pending.has(c.instanceId)),
  };
}

type DiscardModalState =
  | { owner: "bot" | "me"; label: string; cards: CardInstance[] }
  | null;

export function App() {
  const gameRef = useRef<Game | null>(null);
  const matchId = useRef(0);
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [banner, setBanner] = useState("Start a match — your opening hand is dealt automatically.");
  const [hoverCard, setHoverCard] = useState<CardInstance | null>(null);
  const [discardModal, setDiscardModal] = useState<DiscardModalState>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [anim, setAnim] = useState<{
    kind: CombatStep["kind"] | null;
    movers: string[];
    health: Record<string, number>;
    staging: AutobattleResult["initialField"] | null;
    /** Bumps each strike so CSS animations retrigger on repeat clashes. */
    stepKey: number;
    /** Cards flying from field to discard pile. */
    discarding: string[];
    /** Lagging discard piles while combat animates (null = use live snapshot). */
    displayDiscard: Record<PlayerId, CardInstance[]> | null;
    /** Field card that plays a lock-in flip reveal before combat. */
    flipReveal: PlayerId | null;
    flipActive: boolean;
  }>({
    kind: null,
    movers: [],
    health: {},
    staging: null,
    stepKey: 0,
    discarding: [],
    displayDiscard: null,
    flipReveal: null,
    flipActive: false,
  });
  const [busy, setBusy] = useState(false);
  const [endOverlayReady, setEndOverlayReady] = useState(false);
  const animating = useRef(false);
  const botBusy = useRef(false);
  const timerKey = useRef(0);

  const isCurrent = (id: number) => matchId.current === id && gameRef.current !== null;

  const refresh = useCallback(() => {
    if (gameRef.current) setSnap(gameRef.current.snapshot());
  }, []);

  const updateBannerAfter = useCallback(() => {
    const after = gameRef.current?.snapshot();
    if (!after) return;
    if (after.phase === "ended") {
      setBanner(
        after.isDraw || after.winnerId === null
          ? "Draw!"
          : after.winnerId === HUMAN_ID
            ? "You win!"
            : "You lose!",
      );
      setSecondsLeft(null);
    } else if (after.phase === "replace") {
      if (after.players[HUMAN_ID].needsReplace) {
        setBanner("Your Camgirl fell — pick a replacement from your hand.");
      } else {
        setBanner("Waiting for Bot to replace…");
      }
    } else if (after.phase === "placement") {
      setBanner("Pick a Camgirl from your hand to place on your left field slot.");
    }
  }, []);

  const playBattle = useCallback(
    async (
      result: AutobattleResult | null,
      thisMatch = matchId.current,
      opts: { flipReveal?: PlayerId } = {},
    ) => {
      if (!isCurrent(thisMatch)) return;

      if (!result || result.steps.length === 0) {
        refresh();
        setBusy(false);
        updateBannerAfter();
        return;
      }
      animating.current = true;
      setBusy(true);
      setSecondsLeft(null);
      setBanner("Auto-battle…");

      const snapNow = gameRef.current!.snapshot();
      let displayDiscard = discardVisibleDuringBattle(snapNow, result);

      const startHealth: Record<string, number> = {};
      for (const id of ["player1", "player2"] as const) {
        const c = result.initialField[id];
        if (c) startHealth[c.instanceId] = c.health;
      }
      let battleStaging: AutobattleResult["initialField"] = {
        player1: result.initialField.player1
          ? { ...result.initialField.player1 }
          : null,
        player2: result.initialField.player2
          ? { ...result.initialField.player2 }
          : null,
      };
      setAnim({
        kind: null,
        movers: [],
        health: startHealth,
        staging: battleStaging,
        stepKey: 0,
        discarding: [],
        displayDiscard,
        flipReveal: opts.flipReveal ?? null,
        flipActive: false,
      });

      if (opts.flipReveal) {
        await sleep(80);
        if (!isCurrent(thisMatch)) return;
        setAnim((prev) => ({ ...prev, flipActive: true }));
        await sleep(FLIP_REVEAL_MS);
        if (!isCurrent(thisMatch)) return;
        setAnim((prev) => ({ ...prev, flipReveal: null, flipActive: false }));
      }

      await sleep(opts.flipReveal ? 350 : 700);
      if (!isCurrent(thisMatch)) return;

      let lastStrikeAt = Date.now();

      for (let i = 0; i < result.steps.length; i += 1) {
        const step = result.steps[i]!;
        if (!isCurrent(thisMatch)) return;
        setAnim({
          kind: step.kind,
          movers: step.movers.map((m) => m.cardId),
          health: { ...startHealth, ...step.healthAfter },
          staging: battleStaging,
          stepKey: i + 1,
          discarding: [],
          displayDiscard,
          flipReveal: null,
          flipActive: false,
        });
        Object.assign(startHealth, step.healthAfter);
        setBanner(
          step.kind === "clash"
            ? "CLASH — equal speed!"
            : `CRASH — ${step.movers[0]?.cardName} strikes!`,
        );
        await sleep(Math.min(step.delayMs || STRIKE_DELAY_MS, 2200));
        lastStrikeAt = Date.now();

        if (!isCurrent(thisMatch)) return;

        if (step.discarded.length > 0) {
          const flyIds = step.discarded.map((d) => d.cardId);
          setAnim((prev) => ({
            ...prev,
            kind: null,
            movers: [],
            discarding: flyIds,
            displayDiscard,
          }));
          setBanner(
            step.discarded.map((d) => `${d.cardName} → discard`).join(" · "),
          );
          await sleep(900);

          if (!isCurrent(thisMatch)) return;

          for (const d of step.discarded) {
            battleStaging[d.playerId] = null;
            const entry = result.discarded.find((x) => x.card.instanceId === d.cardId);
            if (entry) {
              displayDiscard = {
                ...displayDiscard,
                [d.playerId]: [...displayDiscard[d.playerId], { ...entry.card }],
              };
            }
          }
          setAnim((prev) => ({
            ...prev,
            staging: { ...battleStaging },
            discarding: [],
            displayDiscard: { ...displayDiscard },
          }));
          await sleep(120);
        }
      }

      if (!isCurrent(thisMatch)) return;

      setAnim({
        kind: null,
        movers: [],
        health: {},
        staging: null,
        stepKey: 0,
        discarding: [],
        displayDiscard: null,
        flipReveal: null,
        flipActive: false,
      });
      animating.current = false;
      setBusy(false);
      refresh();
      updateBannerAfter();

      const after = gameRef.current?.snapshot();
      if (after?.phase === "ended" && isCurrent(thisMatch)) {
        const elapsed = Date.now() - lastStrikeAt;
        await sleep(Math.max(0, END_OVERLAY_DELAY_MS - elapsed));
        if (isCurrent(thisMatch)) setEndOverlayReady(true);
      }
    },
    [refresh, updateBannerAfter],
  );

  const resolvePlacement = useCallback(
    async (instanceId: string, thisMatch = matchId.current) => {
      const g = gameRef.current;
      if (!g || !isCurrent(thisMatch)) return;

      setBusy(true);
      setHoverCard(null);
      setSecondsLeft(null);
      timerKey.current += 1;

      const state = g.snapshot();
      const lockedBefore = state.lockedPlacement.slice();
      let result =
        state.phase === "replace"
          ? g.submitReplace({ playerId: HUMAN_ID, instanceId })
          : g.submitPlacement({ playerId: HUMAN_ID, instanceId });

      const willAnimateCombat = !!(result && result.steps.length > 0);
      if (!willAnimateCombat) {
        refresh();
      }

      let flipReveal = result
        ? flipRevealOnLockIn(lockedBefore, HUMAN_ID)
        : undefined;

      if (!result) {
        setBanner("Locked in — Bot is responding…");
        await sleep(400);
        if (!isCurrent(thisMatch)) return;

        let wait = 0;
        while (botBusy.current && wait < 20) {
          await sleep(100);
          wait += 1;
        }
        if (!isCurrent(thisMatch)) return;

        const mid = g.snapshot();
        if (mid.phase === "ended") {
          setBusy(false);
          refresh();
          updateBannerAfter();
          await sleep(END_OVERLAY_DELAY_MS);
          if (isCurrent(thisMatch)) setEndOverlayReady(true);
          return;
        }

        if (mid.phase === "placement" && mid.players[BOT_ID].needsReplace && !botBusy.current) {
          botBusy.current = true;
          try {
            const lockedBeforeBot = mid.lockedPlacement.slice();
            result = await ensureBotActs(g, {
              refresh: () => isCurrent(thisMatch) && refresh(),
            });
            if (result) {
              flipReveal = flipRevealOnLockIn(lockedBeforeBot, BOT_ID);
            }
          } finally {
            if (isCurrent(thisMatch)) botBusy.current = false;
          }
        } else if (mid.phase !== "placement") {
          setBusy(false);
          refresh();
          updateBannerAfter();
          return;
        }
      }

      if (!isCurrent(thisMatch)) return;
      await playBattle(result, thisMatch, { flipReveal });
    },
    [playBattle, refresh, updateBannerAfter],
  );

  const onPlaceFromHand = useCallback(
    (instanceId: string) => {
      const g = gameRef.current;
      if (!g || busy || animating.current) return;
      const state = g.snapshot();
      if (!state.players[HUMAN_ID].needsReplace) return;
      if (state.phase !== "placement" && state.phase !== "replace") return;
      void resolvePlacement(instanceId);
    },
    [busy, resolvePlacement],
  );

  useEffect(() => {
    if (snap?.phase !== "ended") {
      setEndOverlayReady(false);
    }
  }, [snap?.phase]);

  const startMatch = () => {
    matchId.current += 1;
    botBusy.current = false;
    animating.current = false;
    timerKey.current += 1;
    setEndOverlayReady(false);

    resetInstanceCounter();
    const g = new Game(buildRandomDeck(3, "p1"), buildRandomDeck(3, "p2"), {
      player1Name: "You",
      player2Name: "Bot",
    });
    g.start();
    gameRef.current = g;
    setHoverCard(null);
    setAnim({
      kind: null,
      movers: [],
      health: {},
      staging: null,
      stepKey: 0,
      discarding: [],
      displayDiscard: null,
      flipReveal: null,
      flipActive: false,
    });
    setBanner("Pick a Camgirl from your hand — you have 30 seconds.");
    setBusy(false);
    refresh();
  };

  const view = useMemo(() => {
    if (!snap) return null;
    return {
      me: snap.players[HUMAN_ID],
      bot: snap.players[BOT_ID],
    };
  }, [snap]);

  const botDiscardPile =
    anim.displayDiscard?.[BOT_ID] ?? view?.bot.discard ?? [];
  const myDiscardPile =
    anim.displayDiscard?.[HUMAN_ID] ?? view?.me.discard ?? [];

  const fieldAnimClass = (cardId: string, side: "me" | "bot") => {
    if (anim.discarding.includes(cardId)) {
      return side === "me" ? "anim-discard-fly-me" : "anim-discard-fly-bot";
    }
    if (!anim.kind || !anim.movers.includes(cardId)) return "";
    if (anim.kind === "clash") {
      return side === "me" ? "anim-clash-left" : "anim-clash-right";
    }
    return side === "me" ? "anim-crash-up" : "anim-crash-down";
  };

  const stagedBot = anim.staging ? anim.staging[BOT_ID] : undefined;
  const stagedMe = anim.staging ? anim.staging[HUMAN_ID] : undefined;

  const botField =
    stagedBot !== undefined ? stagedBot : view?.bot.field[0] ?? null;
  const myField =
    stagedMe !== undefined ? stagedMe : view?.me.field[0] ?? null;

  const showBotLock =
    !anim.staging &&
    !!snap?.lockedPlacement.includes(BOT_ID) &&
    (view?.bot.field.length ?? 0) === 0;
  const showMyLock =
    !anim.staging &&
    !!snap?.lockedPlacement.includes(HUMAN_ID) &&
    (view?.me.field.length ?? 0) === 0;

  const canPlace =
    !!view &&
    view.me.needsReplace &&
    !busy &&
    (snap?.phase === "placement" || snap?.phase === "replace");

  /** Stable key so the 30s timer is not reset on every snapshot refresh. */
  const turnTimerKey = snap
    ? `${snap.phase}:${snap.roundNumber}:${snap.players[HUMAN_ID].needsReplace}:${snap.lockedPlacement.includes(HUMAN_ID)}:${snap.players[BOT_ID].needsReplace}:${snap.lockedPlacement.includes(BOT_ID)}`
    : null;

  /** Proactive bot — acts as soon as it must place, not only on the 30s timer. */
  const botActKey = snap
    ? `${turnTimerKey}:${snap.players[BOT_ID].hand.length}`
    : null;

  useEffect(() => {
    const g = gameRef.current;
    if (!g || !botActKey || busy || animating.current || botBusy.current) return;

    const state = g.snapshot();
    if (state.phase === "ended" || state.phase === "combat") return;

    const bot = state.players[BOT_ID];
    const lockedBefore = state.lockedPlacement.slice();
    const botShouldAct =
      bot.needsReplace &&
      !state.lockedPlacement.includes(BOT_ID) &&
      (state.phase === "placement" || state.phase === "replace") &&
      bot.hand.length > 0;

    if (!botShouldAct) return;

    const thisMatch = matchId.current;

    void (async () => {
      botBusy.current = true;
      setBusy(true);
      try {
        await sleep(450 + Math.random() * 550);
        if (!isCurrent(thisMatch)) return;
        const result = await runBotTurn(g, {
          refresh: () => isCurrent(thisMatch) && refresh(),
        });
        if (!isCurrent(thisMatch)) return;
        if (result) {
          const flipReveal = flipRevealOnLockIn(lockedBefore, BOT_ID);
          await playBattle(result, thisMatch, { flipReveal });
        } else {
          refresh();
        }
      } finally {
        if (isCurrent(thisMatch)) {
          botBusy.current = false;
          setBusy(false);
          refresh();
        }
      }
    })();
  }, [botActKey, busy, playBattle, refresh]);

  // 30s placement timer for human (and bot fallback).
  useEffect(() => {
    const g = gameRef.current;
    if (!g || !turnTimerKey || busy || animating.current) return;

    const state = g.snapshot();
    if (state.phase === "ended" || state.phase === "combat") {
      setSecondsLeft(null);
      return;
    }

    const human = state.players[HUMAN_ID];
    const bot = state.players[BOT_ID];
    const humanMustAct =
      human.needsReplace &&
      !state.lockedPlacement.includes(HUMAN_ID) &&
      (state.phase === "placement" || state.phase === "replace");

    const botMustAct =
      bot.needsReplace &&
      !state.lockedPlacement.includes(BOT_ID) &&
      (state.phase === "placement" || state.phase === "replace");

    if (!humanMustAct && !botMustAct) {
      setSecondsLeft(null);
      return;
    }

    const key = ++timerKey.current;
    setSecondsLeft(PLACEMENT_TURN_SECONDS);

    const tick = setInterval(() => {
      if (timerKey.current !== key) {
        clearInterval(tick);
        return;
      }
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    const timeout = setTimeout(() => {
      if (timerKey.current !== key || !gameRef.current) return;
      const latest = gameRef.current.snapshot();
      if (latest.phase === "ended" || latest.phase === "combat") return;

      void (async () => {
        const game = gameRef.current!;
        const thisMatch = matchId.current;

        const hMust =
          latest.players[HUMAN_ID].needsReplace &&
          !latest.lockedPlacement.includes(HUMAN_ID) &&
          (latest.phase === "placement" || latest.phase === "replace");

        if (hMust && latest.players[HUMAN_ID].hand.length > 0) {
          const hand = latest.players[HUMAN_ID].hand;
          const pick = hand[Math.floor(Math.random() * hand.length)]!;
          setBanner(`Time's up — ${pick.name} is placed at random.`);
          await resolvePlacement(pick.instanceId, thisMatch);
          return;
        }

        const bMust =
          latest.players[BOT_ID].needsReplace &&
          !latest.lockedPlacement.includes(BOT_ID);

        if (bMust && !botBusy.current) {
          botBusy.current = true;
          try {
            const lockedBefore = latest.lockedPlacement.slice();
            const result = runBotTimeout(game);
            if (result) {
              const flipReveal = flipRevealOnLockIn(lockedBefore, BOT_ID);
              await playBattle(result, thisMatch, { flipReveal });
            } else {
              refresh();
            }
          } finally {
            botBusy.current = false;
          }
        }
      })();
    }, PLACEMENT_TURN_SECONDS * 1000);

    return () => {
      clearInterval(tick);
      clearTimeout(timeout);
    };
  }, [turnTimerKey, busy, playBattle, refresh, resolvePlacement]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">jerkmate</span>
          <h1>Camgirl Clash</h1>
        </div>
        <button type="button" className="btn btn--primary" onClick={startMatch}>
          {snap ? "New match" : "Start vs Bot"}
        </button>
      </header>

      <p className="banner" role="status">
        {banner}
        {secondsLeft !== null && snap?.phase !== "ended" && snap?.phase !== "combat" ? (
          <span className={`timer${secondsLeft <= 10 ? " timer--urgent" : ""}`}>
            {secondsLeft}s
          </span>
        ) : null}
      </p>

      <div className="arena">
        <CardPreview card={hoverCard} />

        <div className="board-wrap">
          {!snap || !view ? (
            <div className="board board--idle">
              <img
                src={publicAsset("battle-board.png")}
                alt=""
                className="board__bg"
              />
              <p className="board__hint">
                Press Start vs Bot — both decks roll random ★/👢/♥ stats (1–10).
              </p>
            </div>
          ) : (
            <div className="board">
              <img
                src={publicAsset("battle-board.png")}
                alt=""
                className="board__bg"
              />

              <div className="zone zone--bot-discard">
                <DiscardZone
                  beatenCount={botDiscardPile.length}
                  topCard={botDiscardPile.at(-1)}
                  variant="bot"
                  onHover={setHoverCard}
                  onOpen={() =>
                    setDiscardModal({
                      owner: "bot",
                      label: view.bot.name,
                      cards: botDiscardPile,
                    })
                  }
                />
              </div>

              <div className="zone zone--bot-field-idle" aria-hidden />
              <div className="zone zone--bot-field">
                <FieldCard
                  locked={showBotLock}
                  card={botField}
                  animKey={anim.stepKey}
                  flipReveal={
                    anim.flipReveal === BOT_ID
                      ? { active: anim.flipActive }
                      : undefined
                  }
                  healthOverride={
                    botField ? anim.health[botField.instanceId] : undefined
                  }
                  animClass={
                    botField ? fieldAnimClass(botField.instanceId, "bot") : ""
                  }
                  hovered={!!botField && hoverCard?.instanceId === botField.instanceId}
                  onHover={setHoverCard}
                />
              </div>

              <div className="zone zone--bot-deck">
                <DeckZone count={view.bot.deckCount} />
              </div>

              <div className="zone zone--me-discard">
                <DiscardZone
                  beatenCount={myDiscardPile.length}
                  topCard={myDiscardPile.at(-1)}
                  variant="me"
                  onHover={setHoverCard}
                  onOpen={() =>
                    setDiscardModal({
                      owner: "me",
                      label: view.me.name,
                      cards: myDiscardPile,
                    })
                  }
                />
              </div>

              <div className="zone zone--me-field">
                <FieldCard
                  locked={showMyLock}
                  card={myField}
                  animKey={anim.stepKey}
                  flipReveal={
                    anim.flipReveal === HUMAN_ID
                      ? { active: anim.flipActive }
                      : undefined
                  }
                  healthOverride={
                    myField ? anim.health[myField.instanceId] : undefined
                  }
                  animClass={
                    myField ? fieldAnimClass(myField.instanceId, "me") : ""
                  }
                />
              </div>
              <div className="zone zone--me-field-idle" aria-hidden />

              <div className="zone zone--me-deck">
                <DeckZone count={view.me.deckCount} />
              </div>
            </div>
          )}

          {view ? (
            <div className="hand-recap" aria-label="Your hand">
              {view.me.hand.map((c) => (
                <CardView
                  key={c.instanceId}
                  card={c}
                  size="md"
                  hovered={hoverCard?.instanceId === c.instanceId}
                  onMouseEnter={() => setHoverCard(c)}
                  onMouseLeave={() => setHoverCard(null)}
                  onClick={
                    canPlace ? () => onPlaceFromHand(c.instanceId) : undefined
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {snap ? (
        <aside className="log">
          {[...snap.log].slice(-6).map((line, i) => (
            <div key={`${i}-${line.slice(0, 16)}`}>{line}</div>
          ))}
        </aside>
      ) : null}

      {discardModal ? (
        <DiscardPileModal
          ownerLabel={discardModal.label}
          cards={discardModal.cards}
          onClose={() => {
            setDiscardModal(null);
            setHoverCard(null);
          }}
          onHover={setHoverCard}
        />
      ) : null}

      {snap?.phase === "ended" && endOverlayReady ? (
        <EndOverlay snap={snap} onRematch={startMatch} />
      ) : null}
    </div>
  );
}
