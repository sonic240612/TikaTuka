import { useState, useEffect, useRef } from 'react';
import DiceFace from './DiceFace';

interface DiceOffScreenProps {
  myRoll: number;
  opponentRoll: number;
  firstPlayerIndex: number;
  myPlayerIndex: number;
  onComplete: () => void;
}

export default function DiceOffScreen({
  myRoll,
  opponentRoll,
  firstPlayerIndex,
  myPlayerIndex,
  onComplete,
}: DiceOffScreenProps) {
  const [phase, setPhase] = useState<'rolling' | 'reveal' | 'result'>('rolling');
  const [myDisplay, setMyDisplay] = useState(1);
  const [oppDisplay, setOppDisplay] = useState(1);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const rollInterval = setInterval(() => {
      setMyDisplay(Math.floor(Math.random() * 6) + 1);
      setOppDisplay(Math.floor(Math.random() * 6) + 1);
    }, 80);

    const revealTimer = setTimeout(() => {
      clearInterval(rollInterval);
      setMyDisplay(myRoll);
      setOppDisplay(opponentRoll);
      setPhase('reveal');

      const resultTimer = setTimeout(() => {
        setPhase('result');

        const exitTimer = setTimeout(() => {
          onCompleteRef.current();
        }, 2000);
      }, 1200);
    }, 1500);

    return () => {
      clearInterval(rollInterval);
      clearTimeout(revealTimer);
    };
  }, [myRoll, opponentRoll]);

  const iAmFirst = myPlayerIndex === firstPlayerIndex;

  return (
    <div className="dice-off-overlay">
      <div className="dice-off-modal">
        <h2 className="dice-off-title">Dice Off!</h2>
        <p className="dice-off-subtitle">
          {phase === 'rolling'
            ? 'Rolling...'
            : phase === 'reveal'
              ? `${myRoll} vs ${opponentRoll}`
              : iAmFirst
                ? 'You go first!'
                : 'Opponent goes first!'}
        </p>

        <div className="dice-off-players">
          <div className={`dice-off-player ${phase === 'result' && iAmFirst ? 'winner' : ''}`}>
            <span className="dice-off-label">You</span>
            <DiceFace value={myDisplay} size={80} type="normal" rolling={phase === 'rolling'} />
            {phase === 'result' && iAmFirst && <span className="dice-off-badge">First</span>}
          </div>

          <div className="dice-off-vs">VS</div>

          <div className={`dice-off-player ${phase === 'result' && !iAmFirst ? 'winner' : ''}`}>
            <span className="dice-off-label">Opponent</span>
            <DiceFace value={oppDisplay} size={80} type="normal" rolling={phase === 'rolling'} />
            {phase === 'result' && !iAmFirst && <span className="dice-off-badge">First</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
