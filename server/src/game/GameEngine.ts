import {
  type Dice,
  type GameState,
  type PlayerState,
  type Lane,
  type LaneScore,
  type Slot,
  GamePhase,
  DiceType,
  createEmptyBoard,
  calculateLaneScore,
} from "../../../shared/types.js";

function rollDiceValue(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function createDice(type: DiceType, value?: number): Dice {
  return { type, value: value ?? rollDiceValue() };
}

function isLaneFull(lane: Lane): boolean {
  return lane.slots.every((s) => s !== null);
}

function isBoardFull(board: { lanes: [Lane, Lane, Lane] }): boolean {
  return board.lanes.every(isLaneFull);
}

function rollDice(type: DiceType = DiceType.NORMAL): Dice {
  return createDice(type);
}

function findCounterLane(
  player: PlayerState,
  opponent: PlayerState,
  diceValue: number
): number[] {
  const validLanes: number[] = [];
  for (let i = 0; i < 3; i++) {
    if (isLaneFull(player.board.lanes[i])) continue;
    const hasMatching = opponent.board.lanes[i].slots.some(
      (s) => s !== null && s.type === DiceType.NORMAL && s.value === diceValue
    );
    if (hasMatching) validLanes.push(i);
  }
  return validLanes;
}

function applyCounter(
  opponent: PlayerState,
  laneIndex: number,
  diceValue: number
): void {
  const lane = opponent.board.lanes[laneIndex];
  lane.slots = lane.slots.map((s) => {
    if (s !== null && s.type === DiceType.NORMAL && s.value === diceValue) {
      return null;
    }
    return s;
  }) as [Slot, Slot, Slot];
}

function calculateFinalScores(
  player0: PlayerState,
  player1: PlayerState
): {
  laneScores: [
    [LaneScore, LaneScore, LaneScore] | null,
    [LaneScore, LaneScore, LaneScore] | null,
  ];
  totalScores: [number, number];
  laneWins: [number, number];
  winner: number;
} {
  const p0Scores: [LaneScore, LaneScore, LaneScore] = [
    calculateLaneScore(player0.board.lanes[0]),
    calculateLaneScore(player0.board.lanes[1]),
    calculateLaneScore(player0.board.lanes[2]),
  ];
  const p1Scores: [LaneScore, LaneScore, LaneScore] = [
    calculateLaneScore(player1.board.lanes[0]),
    calculateLaneScore(player1.board.lanes[1]),
    calculateLaneScore(player1.board.lanes[2]),
  ];

  const p0Total = p0Scores.reduce((a, s) => a + s.total, 0);
  const p1Total = p1Scores.reduce((a, s) => a + s.total, 0);

  let p0Wins = 0;
  let p1Wins = 0;
  for (let i = 0; i < 3; i++) {
    if (p0Scores[i].total > p1Scores[i].total) p0Wins++;
    else if (p1Scores[i].total > p0Scores[i].total) p1Wins++;
  }

  let winner: number;
  if (p0Wins > p1Wins) {
    winner = 0;
  } else if (p1Wins > p0Wins) {
    winner = 1;
  } else {
    winner = p0Total >= p1Total ? 0 : 1;
  }

  return {
    laneScores: [p0Scores, p1Scores],
    totalScores: [p0Total, p1Total],
    laneWins: [p0Wins, p1Wins],
    winner,
  };
}

function getNextPlayer(
  currentPlayerIndex: number,
  players: [PlayerState, PlayerState]
): number {
  const next = currentPlayerIndex === 0 ? 1 : 0;
  if (isBoardFull(players[next].board)) {
    return currentPlayerIndex;
  }
  return next;
}

function generateRandomShieldDice(): Dice {
  return createDice(DiceType.SHIELD);
}

export function createInitialGameState(
  roomId: string,
  player0Id: string,
  player1Id: string
): GameState {
  return {
    roomId,
    players: [
      { id: player0Id, board: createEmptyBoard(), shieldDice: null },
      { id: player1Id, board: createEmptyBoard(), shieldDice: null },
    ],
    currentPlayerIndex: 0,
    phase: GamePhase.ROLL,
    currentRoll: null,
    previousRoll: null,
    winner: null,
    laneScores: [null, null],
    totalScores: [null, null],
    laneWins: [0, 0],
    rerollUsed: [false, false],
    isFirstTurn: true,
    turnCount: 0,
    message: "Player 1's turn. Roll the dice!",
  };
}

export type ActionResult =
  | { state: GameState; error?: undefined }
  | { state?: undefined; error: string };

export function handleRoll(state: GameState, playerId: string): ActionResult {
  if (state.phase !== GamePhase.ROLL) return { error: "Not your turn to roll" };
  if (state.players[state.currentPlayerIndex].id !== playerId)
    return { error: "Not your turn" };

  const dice = rollDice(DiceType.NORMAL);

  state.currentRoll = dice;
  state.phase = GamePhase.ACTION;
  state.message = `You rolled: ${dice.value}`;
  return { state };
}

export function handleReroll(state: GameState, playerId: string): ActionResult {
  if (state.phase !== GamePhase.ACTION)
    return { error: "Cannot reroll now" };
  if (state.players[state.currentPlayerIndex].id !== playerId)
    return { error: "Not your turn" };
  if (!state.currentRoll) return { error: "No dice to reroll" };
  if (state.rerollUsed[state.currentPlayerIndex])
    return { error: "Reroll already used" };

  state.previousRoll = { ...state.currentRoll };
  state.currentRoll = rollDice(state.currentRoll.type);
  state.rerollUsed[state.currentPlayerIndex] = true;
  state.phase = GamePhase.REROLL_CHOICE;
  state.message = `Rerolled! Old: ${state.previousRoll.value}, New: ${state.currentRoll.value}. Choose one.`;
  return { state };
}

export function handleKeepRoll(state: GameState, playerId: string): ActionResult {
  if (state.phase !== GamePhase.REROLL_CHOICE)
    return { error: "No reroll choice available" };
  if (state.players[state.currentPlayerIndex].id !== playerId)
    return { error: "Not your turn" };
  if (!state.currentRoll || !state.previousRoll)
    return { error: "No dice to choose from" };

  state.phase = GamePhase.ACTION;
  state.message = `Keeping value: ${state.currentRoll.value}`;
  return { state };
}

export function handleUsePrevious(state: GameState, playerId: string): ActionResult {
  if (state.phase !== GamePhase.REROLL_CHOICE)
    return { error: "No reroll choice available" };
  if (state.players[state.currentPlayerIndex].id !== playerId)
    return { error: "Not your turn" };
  if (!state.currentRoll || !state.previousRoll)
    return { error: "No dice to choose from" };

  state.currentRoll = state.previousRoll;
  state.previousRoll = null;
  state.phase = GamePhase.ACTION;
  state.message = `Keeping old value: ${state.currentRoll.value}`;
  return { state };
}

export function handlePlaceDice(
  state: GameState,
  playerId: string,
  laneIndex: number
): ActionResult {
  if (state.phase !== GamePhase.ACTION)
    return { error: "Cannot place dice now" };
  if (state.players[state.currentPlayerIndex].id !== playerId)
    return { error: "Not your turn" };
  if (!state.currentRoll) return { error: "No dice to place" };
  if (laneIndex < 0 || laneIndex > 2) return { error: "Invalid lane" };

  const player = state.players[state.currentPlayerIndex];
  const lane = player.board.lanes[laneIndex];

  if (isLaneFull(lane)) return { error: "Lane is full" };

  const firstEmpty = lane.slots.indexOf(null);
  lane.slots[firstEmpty] = { ...state.currentRoll };

  state.currentRoll = null;
  state.isFirstTurn = false;
  state.turnCount++;

  if (player.shieldDice) {
    state.phase = GamePhase.PLACE_SHIELD;
    state.message = "Place your acquired shield dice!";
    return { state };
  }

  const opponentIndex = state.currentPlayerIndex === 0 ? 1 : 0;
  if (isBoardFull(player.board) && isBoardFull(state.players[opponentIndex].board)) {
    return finalizeGame(state);
  }

  if (isBoardFull(state.players[opponentIndex].board)) {
    state.phase = GamePhase.ROLL;
    state.message = `Player ${state.currentPlayerIndex + 1}'s turn (opponent board full).`;
    return { state };
  }

  if (isBoardFull(player.board)) {
    state.currentPlayerIndex = opponentIndex;
    state.phase = GamePhase.ROLL;
    state.message = `Player ${state.currentPlayerIndex + 1}'s turn. Roll the dice!`;
    return { state };
  }

  state.currentPlayerIndex = opponentIndex;
  state.phase = GamePhase.ROLL;
  state.message = `Player ${state.currentPlayerIndex + 1}'s turn. Roll the dice!`;
  return { state };
}

export function handleCounter(
  state: GameState,
  playerId: string,
  laneIndex: number
): ActionResult {
  if (state.phase !== GamePhase.ACTION)
    return { error: "Cannot counter now" };
  if (state.players[state.currentPlayerIndex].id !== playerId)
    return { error: "Not your turn" };
  if (!state.currentRoll) return { error: "No dice to use for counter" };
  if (state.currentRoll.type !== DiceType.NORMAL)
    return { error: "Can only counter with normal dice" };
  if (laneIndex < 0 || laneIndex > 2) return { error: "Invalid lane" };

  const player = state.players[state.currentPlayerIndex];
  const opponent = state.players[state.currentPlayerIndex === 0 ? 1 : 0];

  if (isLaneFull(player.board.lanes[laneIndex]))
    return { error: "Your lane is full, cannot counter" };

  const hasMatching = opponent.board.lanes[laneIndex].slots.some(
    (s) => s !== null && s.type === DiceType.NORMAL && s.value === state.currentRoll!.value
  );
  if (!hasMatching)
    return { error: "No matching normal dice in opponent's lane" };

  applyCounter(opponent, laneIndex, state.currentRoll.value);

  const shieldReward = generateRandomShieldDice();
  player.shieldDice = shieldReward;

  state.currentRoll = null;
  state.isFirstTurn = false;
  state.phase = GamePhase.PLACE_SHIELD;
  state.message = `Counter successful! You got a shield dice (${shieldReward.value}). Place it now!`;
  return { state };
}

export function handlePlaceShield(
  state: GameState,
  playerId: string,
  laneIndex: number,
  targetPlayerIndex: number
): ActionResult {
  if (state.phase !== GamePhase.PLACE_SHIELD)
    return { error: "Cannot place shield dice now" };
  if (state.players[state.currentPlayerIndex].id !== playerId)
    return { error: "Not your turn" };
  if (laneIndex < 0 || laneIndex > 2) return { error: "Invalid lane" };
  if (targetPlayerIndex < 0 || targetPlayerIndex > 1)
    return { error: "Invalid target" };

  const player = state.players[state.currentPlayerIndex];
  if (!player.shieldDice) return { error: "No shield dice to place" };

  const targetPlayer = state.players[targetPlayerIndex];
  const lane = targetPlayer.board.lanes[laneIndex];

  if (isLaneFull(lane)) return { error: "Target lane is full" };

  const firstEmpty = lane.slots.indexOf(null);
  lane.slots[firstEmpty] = { ...player.shieldDice };
  player.shieldDice = null;

  state.turnCount++;
  state.isFirstTurn = false;

  const opponentIdx = state.currentPlayerIndex === 0 ? 1 : 0;
  if (isBoardFull(state.players[opponentIdx].board)) {
    if (isBoardFull(state.players[state.currentPlayerIndex].board)) {
      return finalizeGame(state);
    }
    state.phase = GamePhase.ROLL;
    state.message = `Player ${state.currentPlayerIndex + 1}'s turn (opponent board full).`;
    return { state };
  }

  state.currentPlayerIndex = opponentIdx;
  state.phase = GamePhase.ROLL;
  state.message = `Player ${state.currentPlayerIndex + 1}'s turn. Roll the dice!`;
  return { state };
}

export function handlePass(state: GameState, playerId: string): ActionResult {
  if (state.players[state.currentPlayerIndex].id !== playerId)
    return { error: "Not your turn" };

  const next = state.currentPlayerIndex === 0 ? 1 : 0;
  if (isBoardFull(state.players[next].board)) {
    return finalizeGame(state);
  }

  state.currentPlayerIndex = next;
  state.phase = GamePhase.ROLL;
  state.message = `Player ${state.currentPlayerIndex + 1}'s turn. Roll the dice!`;
  return { state };
}

function finalizeGame(state: GameState): ActionResult {
  const result = calculateFinalScores(state.players[0], state.players[1]);
  state.phase = GamePhase.GAME_OVER;
  state.winner = result.winner;
  state.laneScores = result.laneScores;
  state.totalScores = [result.totalScores[0], result.totalScores[1]];
  state.laneWins = [result.laneWins[0], result.laneWins[1]];
  state.message = `Game Over! Player ${result.winner + 1} wins!`;
  return { state };
}
