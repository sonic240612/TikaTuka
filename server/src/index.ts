import { Server } from "socket.io";
import { createServer } from "http";
import { RoomManager } from "./rooms/RoomManager.js";
import { RateLimiter } from "./utils/RateLimiter.js";
import {
  handleRoll,
  handleReroll,
  handleKeepRoll,
  handleUsePrevious,
  handlePlaceDice,
  handleCounter,
  handlePlaceShield,
  handlePass,
} from "./game/GameEngine.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameState,
  TimerState,
} from "../../shared/types.js";
import type { ActionResult } from "./game/GameEngine.js";

const TURN_TIME_LIMIT = 15;
const INITIAL_RESERVE = 60;

const PORT = parseInt(process.env.PORT || "3001", 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const httpServer = createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  }
});
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN.split(","),
    methods: ["GET", "POST"],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

const roomManager = new RoomManager();
const rateLimiter = new RateLimiter(10, 1000);

const turnTimers = new Map<string, {
  turnTimeout: NodeJS.Timeout | null;
  overtimeInterval: NodeJS.Timeout | null;
  overtime: boolean;
  elapsed: number;
}>();

function clearTurnTimer(roomId: string) {
  const timer = turnTimers.get(roomId);
  if (timer) {
    if (timer.turnTimeout) clearTimeout(timer.turnTimeout);
    if (timer.overtimeInterval) clearInterval(timer.overtimeInterval);
    turnTimers.delete(roomId);
  }
}

function getTimerState(roomId: string): TimerState {
  const room = roomManager.getRoom(roomId);
  const timer = turnTimers.get(roomId);
  const reserveTime = room?.reserveTime ?? [INITIAL_RESERVE, INITIAL_RESERVE];
  const overtime = timer?.overtime ?? false;
  const elapsed = timer?.elapsed ?? 0;
  return {
    turnTimeLeft: Math.max(0, TURN_TIME_LIMIT - elapsed),
    reserveTime,
    overtime,
  };
}

function emitGameState(roomId: string, gameState: GameState) {
  io.to(roomId).emit("game_state", {
    gameState,
    timer: getTimerState(roomId),
  });
}

function handleOvertimeTick(roomId: string) {
  const room = roomManager.getRoom(roomId);
  if (!room || !room.gameState || room.gameState.phase === "game_over") {
    clearTurnTimer(roomId);
    return;
  }

  const depleted = roomManager.deductReserveTime(roomId, room.gameState.currentPlayerIndex, 1);
  const timer = turnTimers.get(roomId);
  if (timer) timer.elapsed++;

  io.to(roomId).emit("timer_update", getTimerState(roomId));

  if (depleted) {
    clearTurnTimer(roomId);
    const winner = room.gameState.currentPlayerIndex === 0 ? 1 : 0;
    room.gameState.phase = "game_over" as any;
    room.gameState.winner = winner;
    room.gameState.message = `Player ${room.gameState.currentPlayerIndex + 1} ran out of time!`;
    emitGameState(roomId, room.gameState);
    setTimeout(() => {
      io.to(roomId).emit("game_over", {
        winner,
        gameState: room.gameState!,
      });
    }, 500);
  }
}

function startTurnTimer(roomId: string) {
  clearTurnTimer(roomId);
  const room = roomManager.getRoom(roomId);
  if (!room || !room.gameState || room.gameState.phase === "game_over") return;

  let elapsed = 0;
  const timerEntry = { turnTimeout: null as NodeJS.Timeout | null, overtimeInterval: null as NodeJS.Timeout | null, overtime: false, elapsed: 0 };
  turnTimers.set(roomId, timerEntry);

  timerEntry.turnTimeout = setTimeout(() => {
    timerEntry.overtime = true;
    handleOvertimeTick(roomId);
    timerEntry.overtimeInterval = setInterval(() => {
      handleOvertimeTick(roomId);
    }, 1000);
  }, TURN_TIME_LIMIT * 1000);
}

setInterval(() => rateLimiter.sweep(), 30_000);

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  function emitRoomList() {
    socket.emit("room_list", { rooms: roomManager.getRoomList() });
  }

  emitRoomList();

  socket.on("create_room", () => {
    const roomId = roomManager.createRoom(socket.id);
    socket.join(roomId);
    socket.emit("joined", {
      roomId,
      playerIndex: 0,
      gameState: null,
    });
    emitRoomList();
    console.log(`[create_room] ${socket.id} -> ${roomId}`);
  });

  socket.on("join_room", ({ roomId }) => {
    const result = roomManager.joinRoom(roomId, socket.id);
    if (!result.ok) {
      socket.emit("error", { message: result.error! });
      return;
    }

    socket.join(roomId);
    const playerIndex = roomManager.getPlayerIndex(roomId, socket.id);
    const room = roomManager.getRoom(roomId)!;

    socket.emit("joined", {
      roomId,
      playerIndex,
      gameState: room.gameState!,
    });

    socket.to(roomId).emit("opponent_joined", {
      roomId,
      gameState: room.gameState!,
    });

    startTurnTimer(roomId);
    io.to(roomId).emit("timer_update", getTimerState(roomId));
    emitRoomList();

    console.log(`[join_room] ${socket.id} -> ${roomId} as player ${playerIndex}`);
  });

  socket.on("join_random", () => {
    const result = roomManager.joinRandom(socket.id);
    if (!result) {
      return;
    }

    socket.join(result.roomId);

    if (!result.gameState) {
      socket.emit("joined", {
        roomId: result.roomId,
        playerIndex: result.playerIndex,
        gameState: null,
      });
      console.log(`[join_random] ${socket.id} -> room ${result.roomId} (waiting, P${result.playerIndex + 1})`);
      return;
    }

    socket.emit("match_found", {
      roomId: result.roomId,
      playerIndex: result.playerIndex,
      gameState: result.gameState,
    });

    const opponentSocketId = result.gameState.players[0].id;
    io.to(opponentSocketId).emit("match_found", {
      roomId: result.roomId,
      playerIndex: 0,
      gameState: result.gameState,
    });

    startTurnTimer(result.roomId);
    io.to(result.roomId).emit("timer_update", getTimerState(result.roomId));
    console.log(`[join_random] matched ${socket.id} in ${result.roomId}`);
  });

  socket.on("cancel_random", () => {
    const { roomId } = roomManager.removeFromRandomQueue(socket.id);
    socket.emit("match_cancelled");
    if (roomId) {
      socket.leave(roomId);
    }
    console.log(`[cancel_random] ${socket.id}`);
  });

  function requireGameAction(
    cb: (state: GameState) => ActionResult
  ) {
    if (!rateLimiter.isAllowed(socket.id)) {
      socket.emit("error", { message: "Too many requests. Slow down." });
      return;
    }

    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || !room.gameState) {
      socket.emit("error", { message: "Not in a game" });
      return;
    }

    const playerIndex = roomManager.getPlayerIndex(room.id, socket.id);
    if (room.gameState.currentPlayerIndex !== playerIndex) {
      socket.emit("error", { message: "Not your turn" });
      return;
    }

    clearTurnTimer(room.id);

    const result = roomManager.processAction(room.id, (state) =>
      cb(state)
    );

    if (result.error) {
      socket.emit("error", { message: result.error });
      return;
    }

    if (result.state) {
      emitGameState(room.id, result.state);
      if (result.state.phase === "game_over" && result.state.winner !== null) {
        setTimeout(() => {
          io.to(room.id).emit("game_over", {
            winner: result.state.winner!,
            gameState: result.state,
          });
        }, 500);
      } else {
        startTurnTimer(room.id);
      }
    }
  }

  socket.on("roll_dice", () => {
    requireGameAction((state) => handleRoll(state, socket.id));
  });

  socket.on("reroll_dice", () => {
    requireGameAction((state) => handleReroll(state, socket.id));
  });

  socket.on("keep_roll", () => {
    requireGameAction((state) => handleKeepRoll(state, socket.id));
  });

  socket.on("use_previous", () => {
    requireGameAction((state) => handleUsePrevious(state, socket.id));
  });

  socket.on("place_dice", ({ laneIndex }) => {
    requireGameAction((state) => handlePlaceDice(state, socket.id, laneIndex));
  });

  socket.on("counter_dice", ({ laneIndex }) => {
    requireGameAction((state) => handleCounter(state, socket.id, laneIndex));
  });

  socket.on("place_shield", ({ laneIndex, targetPlayerIndex }) => {
    requireGameAction((state) =>
      handlePlaceShield(state, socket.id, laneIndex, targetPlayerIndex)
    );
  });

  socket.on("pass", () => {
    requireGameAction((state) => handlePass(state, socket.id));
  });

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    const room = roomManager.getRoomByPlayer(socket.id);
    if (room) clearTurnTimer(room.id);
    roomManager.removePlayer(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] running on port ${PORT}`);
  console.log(`[server] client origin: ${CLIENT_ORIGIN}`);
});
