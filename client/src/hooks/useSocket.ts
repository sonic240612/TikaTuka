import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameState,
  RoomInfo,
} from "../../../shared/types.js";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

interface UseSocketReturn {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connected: boolean;
  roomId: string | null;
  playerIndex: number | null;
  gameState: GameState | null;
  error: string | null;
  rooms: RoomInfo[];
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);

  useEffect(() => {
    const socket = io(SERVER_URL, {
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
    });

    socket.on("opponent_joined", (data) => {
      setGameState(data.gameState);
    });

    socket.on("match_found", (data) => {
      setRoomId(data.roomId);
      setPlayerIndex(data.playerIndex);
      setGameState(data.gameState);
      setError(null);
    });

    socket.on("game_state", (data) => {
      setGameState(data.gameState);
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
  }, []);

  return {
    socket: socketRef.current,
    connected,
    roomId,
    playerIndex,
    gameState,
    error,
    rooms,
  };
}
