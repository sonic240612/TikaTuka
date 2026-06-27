import { Server } from "socket.io";
import { createServer } from "http";
import { RoomManager, generateDiceOff } from "./rooms/RoomManager.js";
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
  DiceOffResult,
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
  interval: NodeJS.Timeout | null;
  overtime: boolean;
  elapsed: number;
}>();

function clearTurnTimer(roomId: string) {
  const timer = turnTimers.get(roomId);
  if (timer) {
    if (timer.interval) clearInterval(timer.interval);
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

function handleTimerTick(roomId: string) {
  const room = roomManager.getRoom(roomId);
  const timer = turnTimers.get(roomId);
  if (!room || !room.gameState || room.gameState.phase === "game_over" || !timer) {
    clearTurnTimer(roomId);
    return;
  }

  timer.elapsed++;

  if (!timer.overtime && timer.elapsed >= TURN_TIME_LIMIT) {
    timer.overtime = true;
  }

  if (timer.overtime) {
    const depleted = roomManager.deductReserveTime(roomId, room.gameState.currentPlayerIndex, 1);

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
      return;
    }
  }

  io.to(roomId).emit("timer_update", getTimerState(roomId));
}

function startTurnTimer(roomId: string) {
  clearTurnTimer(roomId);
  const room = roomManager.getRoom(roomId);
  if (!room || !room.gameState || room.gameState.phase === "game_over") return;

  const timerEntry = { interval: null as NodeJS.Timeout | null, overtime: false, elapsed: 0 };
  turnTimers.set(roomId, timerEntry);

  io.to(roomId).emit("timer_update", getTimerState(roomId));

  timerEntry.interval = setInterval(() => {
    handleTimerTick(roomId);
  }, 1000);
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
    const diceOff = generateDiceOff();
    const result = roomManager.joinRoom(roomId, socket.id, diceOff.firstPlayerIndex);
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

    const diceOffForJoiner: DiceOffResult = {
      myRoll: playerIndex === 0 ? diceOff.myRoll : diceOff.opponentRoll,
      opponentRoll: playerIndex === 0 ? diceOff.opponentRoll : diceOff.myRoll,
      firstPlayerIndex: diceOff.firstPlayerIndex,
    };
    socket.emit("dice_off_result", diceOffForJoiner);

    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const diceOffForHost: DiceOffResult = {
      myRoll: opponentIndex === 0 ? diceOff.myRoll : diceOff.opponentRoll,
      opponentRoll: opponentIndex === 0 ? diceOff.opponentRoll : diceOff.myRoll,
      firstPlayerIndex: diceOff.firstPlayerIndex,
    };
    socket.to(roomId).emit("dice_off_result", diceOffForHost);

    emitRoomList();

    console.log(`[join_room] ${socket.id} -> ${roomId} as player ${playerIndex}`);
  });

  socket.on("join_random", () => {
    if (roomManager.isInRandomQueue(socket.id)) {
      return;
    }

    if (roomManager.hasQueuedOpponent()) {
      const diceOff = generateDiceOff();
      const result = roomManager.joinRandom(socket.id, diceOff.firstPlayerIndex);
      if (!result || !result.gameState) return;

      socket.join(result.roomId);

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

      const diceOffForJoiner: DiceOffResult = {
        myRoll: result.playerIndex === 0 ? diceOff.myRoll : diceOff.opponentRoll,
        opponentRoll: result.playerIndex === 0 ? diceOff.opponentRoll : diceOff.myRoll,
        firstPlayerIndex: diceOff.firstPlayerIndex,
      };
      socket.emit("dice_off_result", diceOffForJoiner);

      const diceOffForHost: DiceOffResult = {
        myRoll: 0 === 0 ? diceOff.myRoll : diceOff.opponentRoll,
        opponentRoll: 0 === 0 ? diceOff.opponentRoll : diceOff.myRoll,
        firstPlayerIndex: diceOff.firstPlayerIndex,
      };
      io.to(opponentSocketId).emit("dice_off_result", diceOffForHost);

      console.log(`[join_random] matched ${socket.id} in ${result.roomId}`);
    } else {
      const result = roomManager.joinRandom(socket.id);
      if (!result) return;

      socket.join(result.roomId);

      socket.emit("joined", {
        roomId: result.roomId,
        playerIndex: result.playerIndex,
        gameState: null,
      });
      console.log(`[join_random] ${socket.id} -> room ${result.roomId} (waiting, P${result.playerIndex + 1})`);
    }
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

    const prevPlayerIndex = room.gameState.currentPlayerIndex;

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
        clearTurnTimer(room.id);
        setTimeout(() => {
          io.to(room.id).emit("game_over", {
            winner: result.state.winner!,
            gameState: result.state,
          });
        }, 500);
      } else if (result.state.currentPlayerIndex !== prevPlayerIndex) {
        startTurnTimer(room.id);
      } else if (!turnTimers.has(room.id)) {
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
