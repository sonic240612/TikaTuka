import type { GameState, Lane, Slot, Dice, LaneScore } from "../../../shared/types.js";
import { calculateBoardScores, totalScore, calculateLaneScore } from "../../../shared/types.js";
import DiceFace from './DiceFace';

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
}: {
  lane: Lane;
  score: LaneScore;
  scorePosition: "top" | "bottom";
  isClickable: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`lane ${isClickable ? "lane-clickable" : ""}`}
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
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
