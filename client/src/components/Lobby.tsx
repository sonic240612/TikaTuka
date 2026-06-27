import { useState, useEffect } from "react";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomInfo,
} from "../../../shared/types.js";

interface LobbyProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connected: boolean;
  roomId: string | null;
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
  availableRooms: RoomInfo[];
  showRoomList: boolean;
  onToggleRoomList: () => void;
}

export default function Lobby({
  socket,
  connected,
  roomId,
  serverUrl,
  onServerUrlChange,
  availableRooms,
  showRoomList,
  onToggleRoomList,
}: LobbyProps) {
  const [joinCode, setJoinCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

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

      {availableRooms.length > 0 && (
        <div className="room-list-section">
          <button
            className="btn btn-small btn-ghost"
            onClick={onToggleRoomList}
          >
            {showRoomList ? "Hide" : "Show"} Available Rooms ({availableRooms.length})
          </button>
          {showRoomList && (
            <div className="room-list">
              {availableRooms.map((r) => (
                <div key={r.roomId} className="room-item">
                  <span>Room: {r.roomId}</span>
                  <button
                    className="btn btn-small"
                    onClick={() => socket?.emit("join_room", { roomId: r.roomId })}
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="server-config">
        <button className="btn-server-config" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? "Hide" : "Server"} Settings
        </button>
        {showConfig && (
          <div className="server-url-row">
            <input
              className="input server-input"
              value={serverUrl}
              onChange={(e) => onServerUrlChange(e.target.value)}
              placeholder="http://localhost:3001"
            />
            <span className={`status-dot ${connected ? "connected" : "disconnected"}`} />
            <span className="server-status-text">{connected ? "Connected" : "Disconnected"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
