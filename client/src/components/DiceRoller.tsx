import type { Dice } from "../../../shared/types.js";

interface DiceRollerProps {
  dice: Dice | null;
  shieldDice: Dice | null;
  canRoll: boolean;
  onRoll: () => void;
  isMyTurn: boolean;
  isShieldPhase: boolean;
}

const diceFaces: Record<number, string> = {
  1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅",
};

export default function DiceRoller({
  dice,
  shieldDice,
  canRoll,
  onRoll,
  isMyTurn,
  isShieldPhase,
}: DiceRollerProps) {
  const displayDice = dice ?? shieldDice;

  return (
    <div className="dice-roller">
      <div className="dice-display">
        {displayDice ? (
          <div className={`dice-result ${isShieldPhase ? "shield-active" : ""}`}>
            <span className="dice-face">{diceFaces[displayDice.value]}</span>
            <span className="dice-value">{displayDice.value}</span>
            {displayDice.type === "shield" && (
              <span className="dice-type-badge">SHIELD</span>
            )}
          </div>
        ) : (
          <div className="dice-empty">?</div>
        )}
      </div>
      <div className="dice-actions">
        {canRoll && isMyTurn && (
          <button className="btn btn-primary" onClick={onRoll}>
            Roll Dice
          </button>
        )}
      </div>
    </div>
  );
}
