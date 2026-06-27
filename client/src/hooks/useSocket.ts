import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameState,
  RoomInfo,
  TimerState,
  DiceOffResult,
} from "../../../shared/types.js";

interface UseSocketReturn {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connected: boolean;
  roomId: string | null;
  playerIndex: number | null;
  gameState: GameState | null;
  error: string | null;
  rooms: RoomInfo[];
  timer: TimerState;
  diceOffResult: DiceOffResult | null;
  clearDiceOff: () => void;
}

export function useSocket(serverUrl: string): UseSocketReturn {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [timer, setTimer] = useState<TimerState>({ turnTimeLeft: 15, reserveTime: [60, 60], overtime: false });
  const [diceOffResult, setDiceOffResult] = useState<DiceOffResult | null>(null);

  useEffect(() => {
    setConnected(false);
    setRoomId(null);
    setPlayerIndex(null);
    setGameState(null);
    setError(null);
    setRooms([]);

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    }) as unknown as Socket<ServerToClientEvents, ClientToServerEvents>;

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("joined", (data) => {
      setRoomId(data.roomId);
      setPlayerIndex(data.playerIndex);
      setGameState(data.gameState);
      setError(null);
      if (data.diceOff) setDiceOffResult(data.diceOff);
    });

    socket.on("opponent_joined", (data) => {
      setGameState(data.gameState);
      if (data.diceOff) setDiceOffResult(data.diceOff);
    });

    socket.on("match_found", (data) => {
      setRoomId(data.roomId);
      setPlayerIndex(data.playerIndex);
      setGameState(data.gameState);
      setError(null);
      if (data.diceOff) setDiceOffResult(data.diceOff);
    });

    socket.on("game_state", (data) => {
      setGameState(data.gameState);
      setTimer(data.timer);
    });

    socket.on("timer_update", (data) => {
      setTimer(data);
    });

    socket.on("game_over", (data) => {
      setGameState(data.gameState);
    });

    socket.on("error", (data) => {
      setError(data.message);
    });

    socket.on("room_list", (data) => {
      setRooms(data.rooms);
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

  function clearDiceOff() {
    setDiceOffResult(null);
  }

  return {
    socket: socketRef.current,
    connected,
    roomId,
    playerIndex,
    gameState,
    error,
    rooms,
    timer,
    diceOffResult,
    clearDiceOff,
  };
}
