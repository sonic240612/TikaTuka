interface TurnTimerProps {
  turnTimeLeft: number;
  reserveTime: [number, number];
  overtime: boolean;
  currentPlayerIndex: number;
  playerIndex: number;
  phase: string;
}

export default function TurnTimer({
  turnTimeLeft,
  reserveTime,
  overtime,
  currentPlayerIndex,
  playerIndex,
  phase,
}: TurnTimerProps) {
  if (phase === "game_over" || phase === "waiting") return null;

  const isMyTurn = currentPlayerIndex === playerIndex;

  const opponentIndex = playerIndex === 0 ? 1 : 0;

  return (
    <div className="turn-timer-container">
      <div className="timer-reserve-bar opponent-reserve">
        <span className="timer-reserve-label">Opponent</span>
        <div className="timer-reserve-track">
          <div
            className="timer-reserve-fill"
            style={{ width: `${(reserveTime[opponentIndex] / 60) * 100}%` }}
          />
        </div>
        <span className="timer-reserve-value">{reserveTime[opponentIndex]}s</span>
      </div>

      <div className="timer-main">
        <div className={`timer-circle ${overtime ? "overtime" : ""} ${turnTimeLeft <= 3 && !overtime ? "warning" : ""}`}>
          <svg viewBox="0 0 100 100" className="timer-svg">
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="var(--border)"
              strokeWidth="6"
            />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke={overtime ? "var(--danger)" : turnTimeLeft <= 3 ? "var(--warning)" : "var(--accent)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={2 * Math.PI * 45 * (1 - (overtime ? reserveTime[currentPlayerIndex] / 60 : turnTimeLeft / 15))}
              transform="rotate(-90 50 50)"
              className="timer-arc"
            />
          </svg>
          <div className="timer-text">
            <span className="timer-number">
              {overtime ? reserveTime[currentPlayerIndex] : turnTimeLeft}
            </span>
            <span className="timer-unit">s</span>
          </div>
        </div>
        <div className="timer-label">
          {overtime
            ? "Overtime!"
            : isMyTurn
              ? "Your Turn"
              : "Opponent's Turn"}
        </div>
      </div>

      <div className="timer-reserve-bar my-reserve">
        <span className="timer-reserve-label">You</span>
        <div className="timer-reserve-track">
          <div
            className="timer-reserve-fill"
            style={{ width: `${(reserveTime[playerIndex] / 60) * 100}%` }}
          />
        </div>
        <span className="timer-reserve-value">{reserveTime[playerIndex]}s</span>
      </div>
    </div>
  );
}
