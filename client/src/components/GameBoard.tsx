import { useState, useRef, useEffect } from "react";
import type { GameState, Lane, Slot, Dice, LaneScore } from "../../../shared/types.js";
import { calculateBoardScores, totalScore, calculateLaneScore } from "../../../shared/types.js";
import DiceFace from './DiceFace';
import { playSound } from "../utils/audio.js";

interface GameBoardProps {
  gameState: GameState;
  playerIndex: number;
  isMyTurn: boolean;
  currentRoll: Dice | null;
  counterLanes: number[];
  onPlace: (laneIndex: number) => void;
  onCounter: (laneIndex: number) => void;
  onPlaceShield: (laneIndex: number, targetPlayerIndex: number) => void;
}

function DiceSlot({ slot }: { slot: Slot }) {
  if (!slot) return <div className="slot empty" />;
  return (
    <div className={`slot ${slot.type}`}>
      <DiceFace value={slot.value} size={44} type={slot.type} />
    </div>
  );
}

function LaneScoreDisplay({ score }: { score: LaneScore }) {
  if (score.total === 0) return null;
  return (
    <div className="lane-score">
      <span className="ls-total">{score.total}</span>
    </div>
  );
}

function LaneView({
  lane,
  score,
  scorePosition,
  isClickable,
  onClick,
  dataLane,
}: {
  lane: Lane;
  score: LaneScore;
  scorePosition: "top" | "bottom";
  isClickable: boolean;
  onClick: () => void;
  dataLane?: string;
}) {
  return (
    <div
      className={`lane ${isClickable ? "lane-clickable" : ""}`}
      data-lane={dataLane}
      onClick={isClickable ? onClick : undefined}
    >
      {scorePosition === "top" && <LaneScoreDisplay score={score} />}
      <div className="lane-slots">
        {lane.slots.map((slot, i) => (
          <DiceSlot key={i} slot={slot} />
        ))}
      </div>
      {scorePosition === "bottom" && <LaneScoreDisplay score={score} />}
    </div>
  );
}

interface FlyingDiceAnim {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  value: number;
}

function findCounterLane(prev: GameState, curr: GameState, playerIdx: number): number {
  const prevOpp = prev.players[playerIdx === 0 ? 1 : 0];
  const currOpp = curr.players[playerIdx === 0 ? 1 : 0];
  const prevRoll = prev.currentRoll;
  if (!prevRoll) return -1;

  for (let i = 0; i < 3; i++) {
    const prevCount = prevOpp.board.lanes[i].slots.filter(
      (s) => s !== null && s.type === "normal" && s.value === prevRoll.value
    ).length;
    const currCount = currOpp.board.lanes[i].slots.filter(
      (s) => s !== null && s.type === "normal" && s.value === prevRoll.value
    ).length;
    if (prevCount > currCount) return i;
  }
  return -1;
}

export default function GameBoard({
  gameState,
  playerIndex,
  isMyTurn,
  currentRoll,
  counterLanes,
  onPlace,
  onCounter,
  onPlaceShield,
}: GameBoardProps) {
  const me = gameState.players[playerIndex];
  const opponent = gameState.players[playerIndex === 0 ? 1 : 0];
  const opponentIndex = playerIndex === 0 ? 1 : 0;

  const meScores = calculateBoardScores(me.board);
  const oppScores = calculateBoardScores(opponent.board);
  const meTotal = totalScore(meScores);
  const oppTotal = totalScore(oppScores);

  const isOver = gameState.phase === "game_over";
  const isAction = gameState.phase === "action" && isMyTurn && currentRoll;
  const isShield = gameState.phase === "place_shield" && isMyTurn;

  const [flyingDice, setFlyingDice] = useState<FlyingDiceAnim | null>(null);
  const prevGameStateRef = useRef<GameState | null>(null);
  const flyingRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = prevGameStateRef.current;
    if (prev && prev.currentRoll && gameState.phase === "place_shield" && prev.phase === "action") {
      const p = gameState.players[playerIndex];
      if (p?.shieldDice) {
        const laneIdx = findCounterLane(prev, gameState, playerIndex);
        if (laneIdx >= 0) {
          const srcEl = document.querySelector(`[data-lane="me-${laneIdx}"]`);
          const dstEl = document.querySelector(`[data-lane="opponent-${laneIdx}"]`);
          if (srcEl && dstEl) {
            const srcRect = srcEl.getBoundingClientRect();
            const dstRect = dstEl.getBoundingClientRect();
            const size = 52;
            setFlyingDice({
              fromX: srcRect.left + srcRect.width / 2 - size / 2,
              fromY: srcRect.top + srcRect.height / 2 - size / 2,
              toX: dstRect.left + dstRect.width / 2 - size / 2,
              toY: dstRect.top + dstRect.height / 2 - size / 2,
              value: prev.currentRoll.value,
            });
          }
        }
      }
    }
    prevGameStateRef.current = gameState;
  }, [gameState, playerIndex]);

  useEffect(() => {
    if (!flyingDice || !flyingRef.current) return;

    const el = flyingRef.current;
    el.style.transition = "none";
    el.style.transform = "translate(0, 0) rotate(0deg) scale(1)";
    el.style.left = `${flyingDice.fromX}px`;
    el.style.top = `${flyingDice.fromY}px`;

    el.getBoundingClientRect();

    const dx = flyingDice.toX - flyingDice.fromX;
    const dy = flyingDice.toY - flyingDice.fromY;
    el.style.transition = "transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1)";
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(720deg) scale(0.85)`;

    const flyTimer = setTimeout(() => {
      playSound("counter_hit");
      if (hitRef.current) {
        hitRef.current.style.left = `${flyingDice.toX}px`;
        hitRef.current.style.top = `${flyingDice.toY}px`;
        hitRef.current.style.transform = "scale(1.5)";
        hitRef.current.style.opacity = "1";
        setTimeout(() => {
          if (hitRef.current) {
            hitRef.current.style.transform = "scale(2.5)";
            hitRef.current.style.opacity = "0";
          }
        }, 50);
      }
      if (el) {
        el.style.transition = "opacity 0.15s, transform 0.15s";
        el.style.transform = `translate(${dx}px, ${dy}px) rotate(720deg) scale(1.1)`;
        el.style.opacity = "0";
      }
      setTimeout(() => setFlyingDice(null), 200);
    }, 400);

    return () => clearTimeout(flyTimer);
  }, [flyingDice]);

  function canPlaceHere(laneIdx: number): boolean {
    if (!isAction) return false;
    if (!me.board.lanes[laneIdx].slots.some((s) => s === null)) return false;
    if (currentRoll?.type === "normal" && counterLanes.includes(laneIdx)) return false;
    return true;
  }

  function canCounterHere(laneIdx: number): boolean {
    if (!isAction) return false;
    if (currentRoll?.type !== "normal") return false;
    return counterLanes.includes(laneIdx);
  }

  function canShieldHere(laneIdx: number, targetIdx: number): boolean {
    if (!isShield) return false;
    return gameState.players[targetIdx].board.lanes[laneIdx].slots.some(
      (s) => s === null
    );
  }

  function handleOpponentLaneClick(laneIdx: number) {
    if (canCounterHere(laneIdx)) {
      onCounter(laneIdx);
    } else if (canShieldHere(laneIdx, opponentIndex)) {
      onPlaceShield(laneIdx, opponentIndex);
    }
  }

  function handleMyLaneClick(laneIdx: number) {
    if (canPlaceHere(laneIdx)) {
      onPlace(laneIdx);
    } else if (canShieldHere(laneIdx, playerIndex)) {
      onPlaceShield(laneIdx, playerIndex);
    }
  }

  return (
    <div className="game-board">
      {isOver && (
        <div className="game-over-banner">
          {gameState.winner === playerIndex ? "You Win!" : "You Lose"}
        </div>
      )}

      {isAction && (
        <div className="phase-hint">
          {currentRoll?.type === "normal"
            ? "Place in a non-matching lane, or counter in a matching lane"
            : "Click an empty slot on your board to place"}
        </div>
      )}
      {isShield && (
        <div className="phase-hint">
          Click any empty slot on either board to place your shield dice
        </div>
      )}

      <div className="player-section opponent">
        <h2>Opponent <span className="total-score">Σ {oppTotal}</span></h2>
        <div className="lanes-container">
          {opponent.board.lanes.map((lane, i) => {
            const opponentClickable =
              canCounterHere(i) || canShieldHere(i, opponentIndex);
            return (
              <LaneView
                key={i}
                lane={lane}
                score={oppScores[i]}
                scorePosition="bottom"
                isClickable={opponentClickable}
                onClick={() => handleOpponentLaneClick(i)}
                dataLane={`opponent-${i}`}
              />
            );
          })}
        </div>
      </div>

      <div className="divider" />

      <div className="player-section me">
        <h2>You <span className="total-score">Σ {meTotal}</span></h2>
        <div className="lanes-container">
          {me.board.lanes.map((lane, i) => {
            const myClickable =
              canPlaceHere(i) || canShieldHere(i, playerIndex);
            return (
              <LaneView
                key={i}
                lane={lane}
                score={meScores[i]}
                scorePosition="top"
                isClickable={myClickable}
                onClick={() => handleMyLaneClick(i)}
                dataLane={`me-${i}`}
              />
            );
          })}
        </div>
      </div>

      {flyingDice && (
        <div className="flying-dice" ref={flyingRef}>
          <DiceFace value={flyingDice.value} size={52} type="normal" />
        </div>
      )}
      <div className="hit-effect" ref={hitRef} />
    </div>
  );
}
