export enum DiceType {
  NORMAL = "normal",
  SHIELD = "shield",
}

export interface Dice {
  type: DiceType;
  value: number;
}

export type Slot = Dice | null;

export interface Lane {
  slots: [Slot, Slot, Slot];
}

export interface PlayerBoard {
  lanes: [Lane, Lane, Lane];
}

export interface PlayerState {
  id: string;
  board: PlayerBoard;
  shieldDice: Dice | null;
}

export enum GamePhase {
  WAITING = "waiting",
  ROLL = "roll",
  ACTION = "action",
  REROLL_CHOICE = "reroll_choice",
  PLACE_SHIELD = "place_shield",
  GAME_OVER = "game_over",
}

export interface LaneScore {
  sum: number;
  bonus: number;
  total: number;
}

export interface GameState {
  roomId: string;
  players: [PlayerState, PlayerState];
  currentPlayerIndex: number;
  phase: GamePhase;
  currentRoll: Dice | null;
  previousRoll: Dice | null;
  winner: number | null;
  laneScores: [[LaneScore, LaneScore, LaneScore] | null, [LaneScore, LaneScore, LaneScore] | null];
  totalScores: [number | null, number | null];
  laneWins: [number, number];
  rerollUsed: [boolean, boolean];
  turnCount: number;
  message: string;
}

export interface RoomInfo {
  roomId: string;
  playerCount: number;
}

export interface TimerState {
  turnTimeLeft: number;
  reserveTime: [number, number];
  overtime: boolean;
}

export interface DiceOffResult {
  myRoll: number;
  opponentRoll: number;
  firstPlayerIndex: number;
}

export interface ServerToClientEvents {
  joined: (data: { roomId: string; playerIndex: number; gameState: GameState | null }) => void;
  opponent_joined: (data: { roomId: string; gameState: GameState }) => void;
  game_state: (data: { gameState: GameState; timer: TimerState }) => void;
  game_over: (data: { winner: number; gameState: GameState }) => void;
  error: (data: { message: string }) => void;
  room_list: (data: { rooms: RoomInfo[] }) => void;
  match_found: (data: { roomId: string; playerIndex: number; gameState: GameState }) => void;
  match_cancelled: () => void;
  timer_update: (data: TimerState) => void;
  dice_off_result: (data: DiceOffResult) => void;
}

export interface ClientToServerEvents {
  create_room: () => void;
  join_room: (data: { roomId: string }) => void;
  join_random: () => void;
  cancel_random: () => void;
  roll_dice: () => void;
  reroll_dice: () => void;
  keep_roll: () => void;
  use_previous: () => void;
  place_dice: (data: { laneIndex: number }) => void;
  counter_dice: (data: { laneIndex: number }) => void;
  place_shield: (data: { laneIndex: number; targetPlayerIndex: number }) => void;
  pass: () => void;
}

export function createEmptyBoard(): PlayerBoard {
  return {
    lanes: [
      { slots: [null, null, null] },
      { slots: [null, null, null] },
      { slots: [null, null, null] },
    ],
  };
}

export function calculateLaneScore(lane: Lane): LaneScore {
  const values = lane.slots
    .filter((s): s is Dice => s !== null)
    .map((d) => d.value);
  if (values.length === 0) return { sum: 0, bonus: 0, total: 0 };

  const sum = values.reduce((a, b) => a + b, 0);

  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }

  let bonus = 0;
  for (const [val, count] of counts) {
    if (count === 3) {
      bonus = val * 2;
    } else if (count === 2) {
      bonus = val;
    }
  }

  return { sum, bonus, total: sum + bonus };
}

export function calculateBoardScores(board: PlayerBoard): [LaneScore, LaneScore, LaneScore] {
  return [
    calculateLaneScore(board.lanes[0]),
    calculateLaneScore(board.lanes[1]),
    calculateLaneScore(board.lanes[2]),
  ];
}

export function totalScore(scores: [LaneScore, LaneScore, LaneScore]): number {
  return scores.reduce((a, s) => a + s.total, 0);
}
