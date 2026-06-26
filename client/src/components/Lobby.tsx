import { useState, useEffect } from "react";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../../shared/types.js";

interface LobbyProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connected: boolean;
  roomId: string | null;
}

export default function Lobby({
  socket,
  connected,
  roomId,
}: LobbyProps) {
  const [joinCode, setJoinCode] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const onMatchFound = () => setSearching(false);
    const onCancelled = () => setSearching(false);
    socket.on("match_found", onMatchFound);
    socket.on("match_cancelled", onCancelled);
    return () => {
      socket.off("match_found", onMatchFound);
      socket.off("match_cancelled", onCancelled);
    };
  }, [socket]);

  useEffect(() => {
    if (roomId) setSearching(false);
  }, [roomId]);

  if (roomId) return null;

  return (
    <div className="lobby">
      <h1 className="title">Tik-a-Tuka</h1>
      <p className="subtitle">1:1 Dice Battle Game</p>

      <div className="lobby-buttons">
        <button
          className="btn btn-primary"
          disabled={!connected}
          onClick={() => socket?.emit("create_room")}
        >
          Create Room
        </button>

        <div className="join-row">
          <input
            className="input"
            placeholder="Enter room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button
            className="btn btn-secondary"
            disabled={!connected || joinCode.length !== 6 || searching}
            onClick={() => {
              socket?.emit("join_room", { roomId: joinCode });
            }}
          >
            Join
          </button>
        </div>

        {searching ? (
          <button
            className="btn btn-danger"
            onClick={() => {
              socket?.emit("cancel_random");
            }}
          >
            Cancel Match
          </button>
        ) : (
          <button
            className="btn btn-accent"
            disabled={!connected}
            onClick={() => {
              setSearching(true);
              socket?.emit("join_random");
            }}
          >
            Random Match
          </button>
        )}
      </div>

      {searching && <p className="status search-status">Searching for opponent...</p>}

      {!connected && <p className="status">Connecting to server...</p>}
    </div>
  );
}
