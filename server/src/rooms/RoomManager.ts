import { type GameState, type RoomInfo } from "../../../shared/types.js";
import { createInitialGameState, handleRoll, handleReroll, handlePlaceDice, handleCounter, handlePlaceShield, handlePass, type ActionResult } from "../game/GameEngine.js";

function generateRoomId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

interface PendingPlayer {
  id: string;
  roomId: string;
}

interface Room {
  id: string;
  gameState: GameState;
  playerSockets: string[];
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private randomQueue: PendingPlayer[] = [];

  createRoom(playerSocketId: string): string {
    let roomId = generateRoomId();
    while (this.rooms.has(roomId)) {
      roomId = generateRoomId();
    }

    const room: Room = {
      id: roomId,
      gameState: null as unknown as GameState,
      playerSockets: [playerSocketId],
    };
    this.rooms.set(roomId, room);
    return roomId;
  }

  joinRoom(roomId: string, playerSocketId: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: "Room not found" };
    if (room.playerSockets.length >= 2) return { ok: false, error: "Room is full" };

    room.playerSockets.push(playerSocketId);
    room.gameState = createInitialGameState(
      roomId,
      room.playerSockets[0],
      room.playerSockets[1]
    );

    return { ok: true };
  }

  isInRandomQueue(socketId: string): boolean {
    return this.randomQueue.some((p) => p.id === socketId);
  }

  joinRandom(playerSocketId: string): { roomId: string; playerIndex: number; gameState: GameState | null } | null {
    if (this.isInRandomQueue(playerSocketId)) {
      return null;
    }

    if (this.randomQueue.length > 0) {
      const opponent = this.randomQueue.shift()!;
      const room = this.rooms.get(opponent.roomId)!;
      room.playerSockets.push(playerSocketId);
      room.gameState = createInitialGameState(
        room.id,
        opponent.id,
        playerSocketId
      );
      return { roomId: room.id, playerIndex: 1, gameState: room.gameState };
    }

    const roomId = this.createRoom(playerSocketId);
    this.randomQueue.push({ id: playerSocketId, roomId });
    return { roomId, playerIndex: 0, gameState: null };
  }

  removeFromRandomQueue(socketId: string): { roomId?: string } {
    const entry = this.randomQueue.find((p) => p.id === socketId);
    this.randomQueue = this.randomQueue.filter((p) => p.id !== socketId);
    if (entry) {
      this.rooms.delete(entry.roomId);
      return { roomId: entry.roomId };
    }
    return {};
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByPlayer(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.playerSockets.includes(socketId)) return room;
    }
    return undefined;
  }

  getPlayerIndex(roomId: string, socketId: string): number {
    const room = this.rooms.get(roomId);
    if (!room) return -1;
    return room.playerSockets.indexOf(socketId);
  }

  getRoomList(): RoomInfo[] {
    const rooms: RoomInfo[] = [];
    for (const room of this.rooms.values()) {
      if (room.playerSockets.length < 2) {
        rooms.push({ roomId: room.id, playerCount: room.playerSockets.length });
      }
    }
    return rooms;
  }

  processAction(roomId: string, action: (state: GameState) => ActionResult): ActionResult {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) return { error: "Room not found" };

    const clonedState = JSON.parse(JSON.stringify(room.gameState));
    const result = action(clonedState);

    if (result.state) {
      room.gameState = result.state;
    }

    return result;
  }

  removePlayer(socketId: string): void {
    this.removeFromRandomQueue(socketId);
    for (const [roomId, room] of this.rooms.entries()) {
      const idx = room.playerSockets.indexOf(socketId);
      if (idx !== -1) {
        room.playerSockets.splice(idx, 1);
        if (room.playerSockets.length === 0) {
          this.rooms.delete(roomId);
        }
        break;
      }
    }
  }
}
