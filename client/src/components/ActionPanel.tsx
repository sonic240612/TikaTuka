import type { Dice } from "../../../shared/types.js";

interface ActionPanelProps {
  currentRoll: Dice | null;
  previousRoll: Dice | null;
  isMyTurn: boolean;
  hasReroll: boolean;
  phase: string;
  onReroll: () => void;
  onKeepRoll: () => void;
  onUsePrevious: () => void;
}

const diceFaces: Record<number, string> = {
  1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅",
};

export default function ActionPanel({
  currentRoll,
  previousRoll,
  isMyTurn,
  hasReroll,
  phase,
  onReroll,
  onKeepRoll,
  onUsePrevious,
}: ActionPanelProps) {
  if (!isMyTurn) return null;

  if (phase === "reroll_choice" && currentRoll && previousRoll) {
    return (
      <div className="action-panel">
        <h3>Choose a Dice Value</h3>
        <div className="reroll-choice">
          <button className="btn btn-secondary" onClick={onUsePrevious}>
            <span className="dice-face">{diceFaces[previousRoll.value]}</span>
            {" "}Old: {previousRoll.value}
          </button>
          <button className="btn btn-primary" onClick={onKeepRoll}>
            <span className="dice-face">{diceFaces[currentRoll.value]}</span>
            {" "}New: {currentRoll.value}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "action" && currentRoll && hasReroll) {
    return (
      <div className="action-panel">
        <div className="reroll-section">
          <button className="btn btn-accent" onClick={onReroll}>
            Reroll Dice
          </button>
        </div>
      </div>
    );
  }

  return null;
}
