import type { Dice } from "../../../shared/types.js";
import DiceFace from './DiceFace';

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
          <button className="btn btn-secondary reroll-btn" onClick={onUsePrevious}>
            <DiceFace value={previousRoll.value} size={40} type={previousRoll.type} />
            <span>Old: {previousRoll.value}</span>
          </button>
          <button className="btn btn-primary reroll-btn" onClick={onKeepRoll}>
            <DiceFace value={currentRoll.value} size={40} type={currentRoll.type} />
            <span>New: {currentRoll.value}</span>
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
