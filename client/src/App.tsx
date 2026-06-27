import { useMemo, useState, useRef, useEffect } from "react";
import { useSocket } from "./hooks/useSocket.js";
import { useAudio } from "./hooks/useAudio.js";
import Lobby from "./components/Lobby.js";
import GameBoard from "./components/GameBoard.js";
import DiceRoller from "./components/DiceRoller.js";
import ActionPanel from "./components/ActionPanel.js";
import TurnTimer from "./components/TurnTimer.js";
import DiceOffScreen from "./components/DiceOffScreen.js";
import "./App.css";

export default function App() {
  const [serverUrl, setServerUrl] = useState(
    () => localStorage.getItem("serverUrl") || import.meta.env.VITE_SERVER_URL || "http://localhost:3001"
  );
  const [showRoomList, setShowRoomList] = useState(false);

  const {
    socket,
    connected,
    roomId,
    playerIndex,
    gameState,
    error,
    rooms,
    timer,
    diceOffResult,
    clearDiceOff,
  } = useSocket(serverUrl);

  const availableRooms = useMemo(
    () => rooms.filter((r) => r.roomId !== roomId),
    [rooms, roomId]
  );

  function handleServerUrlChange(url: string) {
    localStorage.setItem("serverUrl", url);
    setServerUrl(url);
  }

  const isMyTurn =
    gameState !== null &&
    playerIndex !== null &&
    gameState.currentPlayerIndex === playerIndex;

  const canRoll =
    gameState !== null && gameState.phase === "roll";

  const canReroll =
    gameState !== null &&
    gameState.phase === "action" &&
    !gameState.rerollUsed[playerIndex ?? 0] &&
    gameState.currentRoll !== null;

  const counterLanes = useMemo(() => {
    if (
      !gameState ||
      !gameState.currentRoll ||
      gameState.currentRoll.type !== "normal" ||
      playerIndex === null
    )
      return [];

    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const myBoard = gameState.players[playerIndex].board;
    const opponentBoard = gameState.players[opponentIndex].board;
    const diceValue = gameState.currentRoll.value;
    const valid: number[] = [];

    for (let i = 0; i < 3; i++) {
      const myLaneFull = myBoard.lanes[i].slots.every((s) => s !== null);
      if (myLaneFull) continue;

      const hasMatch = opponentBoard.lanes[i].slots.some(
        (s) => s !== null && s.type === "normal" && s.value === diceValue
      );
      if (hasMatch) valid.push(i);
    }

    return valid;
  }, [gameState, playerIndex]);

  const message = gameState?.message ?? "";
  const [delayedMessage, setDelayedMessage] = useState("");
  const prevPhaseRef = useRef("");

  useEffect(() => {
    if (!gameState) {
      prevPhaseRef.current = "";
      setDelayedMessage("");
      return;
    }

    const prevPhase = prevPhaseRef.current;
    const newPhase = gameState.phase;

    if (prevPhase === "roll" && newPhase === "action") {
      trigger("dice_roll");
      setDelayedMessage("");
      const timer = setTimeout(() => setDelayedMessage(gameState.message), 800);
      prevPhaseRef.current = newPhase;
      return () => clearTimeout(timer);
    }

    if (prevPhase === "place_shield" && newPhase !== "place_shield") {
      trigger("shield_place");
    }

    if (newPhase === "game_over") {
      trigger(gameState.winner === playerIndex ? "victory" : "defeat");
    }

    prevPhaseRef.current = newPhase;
    setDelayedMessage(gameState.message);
  }, [gameState]);

  useEffect(() => {
    if (canRoll && isMyTurn && socket && !diceOffResult) {
      socket.emit("roll_dice");
    }
  }, [canRoll, isMyTurn, socket, diceOffResult]);

  const showRerollChoice =
    gameState?.phase === "reroll_choice";
  const showRerollButton =
    gameState?.phase === "action" && isMyTurn && canReroll;

  const pendingShieldDice = useMemo(() => {
    if (!gameState) return null;
    return gameState.players[0]?.shieldDice ?? gameState.players[1]?.shieldDice ?? null;
  }, [gameState]);

  const showActionPanel = showRerollChoice || showRerollButton;

  const { muted, toggle: toggleMute, trigger } = useAudio();

  return (
    <div className="app">
      <Lobby
        socket={socket}
        connected={connected}
        roomId={roomId}
        serverUrl={serverUrl}
        onServerUrlChange={handleServerUrlChange}
        availableRooms={availableRooms}
        showRoomList={showRoomList}
        onToggleRoomList={() => setShowRoomList((v) => !v)}
      />

      {roomId && !gameState && (
        <div className="waiting-screen">
          <h2>Waiting for opponent...</h2>
          <p>Room Code: <strong>{roomId}</strong></p>
          <p className="status">Share this code with a friend</p>
        </div>
      )}

      {diceOffResult && (
        <DiceOffScreen
          myRoll={diceOffResult.myRoll}
          opponentRoll={diceOffResult.opponentRoll}
          firstPlayerIndex={diceOffResult.firstPlayerIndex}
          myPlayerIndex={playerIndex ?? 0}
          onComplete={clearDiceOff}
        />
      )}
      {roomId && gameState && (
        <div className="game-container">
          <div className="game-header">
            <span className="room-code">Room: {roomId} | P{playerIndex !== null ? playerIndex + 1 : "?"}</span>
            <span className="turn-indicator">
              {gameState.phase === "game_over"
                ? "Game Over"
                : isMyTurn
                  ? "Your Turn"
                  : "Opponent's Turn"}
            </span>
            <button className="btn-mute" onClick={toggleMute} title={muted ? "Unmute" : "Mute"}>
              {muted ? "SFX OFF" : "SFX ON"}
            </button>
          </div>

          {error && <div className="error-toast">{error}</div>}

          <TurnTimer
            turnTimeLeft={timer.turnTimeLeft}
            reserveTime={timer.reserveTime}
            overtime={timer.overtime}
            currentPlayerIndex={gameState.currentPlayerIndex}
            playerIndex={playerIndex ?? 0}
            phase={gameState.phase}
          />

          <div className="game-status">{delayedMessage}</div>

          <div className="game-main">
            <GameBoard
              gameState={gameState}
              playerIndex={playerIndex ?? 0}
              isMyTurn={isMyTurn ?? false}
              currentRoll={gameState.currentRoll}
              counterLanes={counterLanes}
              onPlace={(laneIndex) => {
                trigger("dice_place");
                socket?.emit("place_dice", { laneIndex });
              }}
              onCounter={(laneIndex) => {
                trigger("counter_fire");
                socket?.emit("counter_dice", { laneIndex });
              }}
              onPlaceShield={(laneIndex, targetPlayerIndex) =>
                socket?.emit("place_shield", {
                  laneIndex,
                  targetPlayerIndex,
                })
              }
            />

            {gameState.phase !== "game_over" && (
              <div className="game-sidebar">
                <DiceRoller
                  dice={gameState.currentRoll}
                  shieldDice={pendingShieldDice}
                  isMyTurn={isMyTurn ?? false}
                  isShieldPhase={gameState.phase === "place_shield"}
                />

                {showActionPanel && (
                  <ActionPanel
                    phase={gameState.phase}
                    currentRoll={gameState.currentRoll}
                    previousRoll={gameState.previousRoll}
                    isMyTurn={isMyTurn ?? false}
                    hasReroll={canReroll}
                    onReroll={() => {
                      trigger("dice_reroll");
                      socket?.emit("reroll_dice");
                    }}
                    onKeepRoll={() => socket?.emit("keep_roll")}
                    onUsePrevious={() => socket?.emit("use_previous")}
                  />
                )}

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
