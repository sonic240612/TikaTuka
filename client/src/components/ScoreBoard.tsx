import type { LaneScore } from "../../../shared/types.js";

interface ScoreBoardProps {
  laneScores: [LaneScore, LaneScore, LaneScore] | null;
  totalScore: number | null;
  laneWins: number | null;
  label: string;
  compact?: boolean;
}

export default function ScoreBoard({
  laneScores,
  totalScore,
  laneWins,
  label,
  compact,
}: ScoreBoardProps) {
  return (
    <div className={`scoreboard ${compact ? "compact" : ""}`}>
      {laneScores ? (
        <>
          <div className="score-table">
            {laneScores.map((score, i) => (
              <div key={i} className="score-row">
                <span className="score-lane">L{i + 1}</span>
                <span className="score-dice">
                  {score.sum > 0 ? `${score.sum}` : "-"}
                </span>
                {score.bonus > 0 && (
                  <span className="score-bonus">+{score.bonus}</span>
                )}
                <span className="score-eq">=</span>
                <span className="score-total">{score.total}</span>
              </div>
            ))}
          </div>
          <div className="score-summary">
            <span>Σ {totalScore}</span>
          </div>
        </>
      ) : (
        <p className="score-placeholder">-</p>
      )}
    </div>
  );
}
