import { useState, useEffect, useRef } from 'react';
import type { Dice } from "../../../shared/types.js";
import DiceFace from './DiceFace';

interface DiceRollerProps {
  dice: Dice | null;
  shieldDice: Dice | null;
  isMyTurn: boolean;
  isShieldPhase: boolean;
}

export default function DiceRoller({
  dice,
  shieldDice,
  isMyTurn,
  isShieldPhase,
}: DiceRollerProps) {
  const [rolling, setRolling] = useState(false);
  const [rollingValue, setRollingValue] = useState(1);
  const prevDiceRef = useRef<Dice | null>(null);

  const displayDice = dice ?? shieldDice;

  useEffect(() => {
    if (!rolling && dice !== null && prevDiceRef.current === null) {
      setRolling(true);
    }
    prevDiceRef.current = dice;
  }, [dice, rolling]);

  useEffect(() => {
    if (!rolling) return;
    const timer = setTimeout(() => setRolling(false), 800);
    const interval = setInterval(() => {
      setRollingValue(Math.floor(Math.random() * 6) + 1);
    }, 80);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [rolling]);

  const faceValue = rolling ? rollingValue : (displayDice?.value ?? 0);
  const diceType = displayDice?.type ?? 'normal';

  return (
    <div className="dice-roller">
      <div className="dice-display">
        {displayDice || rolling ? (
          <div className={`dice-result ${isShieldPhase && !rolling ? "shield-active" : ""}`}>
            <DiceFace value={faceValue} size={72} type={diceType} rolling={rolling} />
            <div className="dice-value-label">
              <span className="dice-value-number">{faceValue}</span>
              {displayDice?.type === 'shield' && !rolling && (
                <span className="dice-type-badge">SHIELD</span>
              )}
            </div>
          </div>
        ) : (
          <div className="dice-empty">?</div>
        )}
      </div>
    </div>
  );
}
