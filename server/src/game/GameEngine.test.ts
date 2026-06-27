import { describe, it, expect, beforeEach } from "vitest";
import {
  GamePhase,
  DiceType,
  type GameState,
  type PlayerState,
  type Dice,
  createEmptyBoard,
} from "../../../shared/types.js";
import {
  createInitialGameState,
  handleRoll,
  handleReroll,
  handleKeepRoll,
  handleUsePrevious,
  handlePlaceDice,
  handleCounter,
  handlePlaceShield,
  handlePass,
  type ActionResult,
} from "./GameEngine.js";

const P0 = "player-0";
const P1 = "player-1";
const ROOM = "room-1";

function createState(): GameState {
  return createInitialGameState(ROOM, P0, P1);
}

function roll(state: GameState): GameState {
  const result = handleRoll(state, P0);
  if (!result.state) throw new Error(`Roll failed: ${result.error}`);
  return result.state;
}

function fillAllSlots(board: ReturnType<typeof createEmptyBoard>, value = 3): void {
  for (const lane of board.lanes) {
    lane.slots = [{ type: DiceType.NORMAL, value }, { type: DiceType.NORMAL, value }, { type: DiceType.NORMAL, value }];
  }
}

function fillExcept(board: ReturnType<typeof createEmptyBoard>, laneIdx: number, slotIdx: number, value = 3): void {
  for (let l = 0; l < 3; l++) {
    for (let s = 0; s < 3; s++) {
      if (l === laneIdx && s === slotIdx) {
        board.lanes[l].slots[s] = null;
      } else {
        board.lanes[l].slots[s] = { type: DiceType.NORMAL, value };
      }
    }
  }
}

describe("createInitialGameState", () => {
  it("creates state with ROLL phase for player 0", () => {
    const state = createState();
    expect(state.roomId).toBe(ROOM);
    expect(state.phase).toBe(GamePhase.ROLL);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.players[0].id).toBe(P0);
    expect(state.players[1].id).toBe(P1);
    expect(state.currentRoll).toBeNull();
    expect(state.winner).toBeNull();
    expect(state.rerollUsed).toEqual([false, false]);
  });

  it("creates empty boards", () => {
    const state = createState();
    for (const p of state.players) {
      for (const lane of p.board.lanes) {
        expect(lane.slots).toEqual([null, null, null]);
      }
    }
  });
});

describe("handleRoll", () => {
  it("transitions from ROLL to ACTION with a dice value", () => {
    const state = createState();
    const result = handleRoll(state, P0);
    expect(result.state).toBeDefined();
    expect(result.state!.phase).toBe(GamePhase.ACTION);
    expect(result.state!.currentRoll).not.toBeNull();
    expect(result.state!.currentRoll!.value).toBeGreaterThanOrEqual(1);
    expect(result.state!.currentRoll!.value).toBeLessThanOrEqual(6);
    expect(result.state!.currentRoll!.type).toBe(DiceType.NORMAL);
  });

  it("rejects roll when not in ROLL phase", () => {
    const state = createState();
    state.phase = GamePhase.ACTION;
    expect(handleRoll(state, P0).error).toBeDefined();
  });

  it("rejects roll when not your turn", () => {
    const state = createState();
    expect(handleRoll(state, P1).error).toBeDefined();
  });

  it("auto-passes when player board is full", () => {
    const state = createState();
    fillAllSlots(state.players[0].board);
    const result = handleRoll(state, P0);
    expect(result.state).toBeDefined();
    expect(result.state!.currentRoll).toBeNull();
    expect(result.state!.currentPlayerIndex).toBe(1);
    expect(result.state!.phase).toBe(GamePhase.ROLL);
  });
});

describe("handleReroll", () => {
  it("rerolls the dice and transitions to REROLL_CHOICE", () => {
    const state = roll(createState());
    const oldRoll = state.currentRoll!.value;
    const result = handleReroll(state, P0);
    expect(result.state).toBeDefined();
    expect(result.state!.phase).toBe(GamePhase.REROLL_CHOICE);
    expect(result.state!.previousRoll!.value).toBe(oldRoll);
    expect(result.state!.rerollUsed[0]).toBe(true);
  });

  it("prevents reroll when already used", () => {
    const state = roll(createState());
    state.rerollUsed[0] = true;
    expect(handleReroll(state, P0).error).toBeDefined();
  });
});

describe("reroll choice", () => {
  function reroll(state: GameState): GameState {
    const r = handleReroll(state, P0);
    if (!r.state) throw new Error(`Reroll failed: ${r.error}`);
    return r.state;
  }

  it("handleKeepRoll keeps current roll", () => {
    const state = reroll(roll(createState()));
    const kept = state.currentRoll!.value;
    const result = handleKeepRoll(state, P0);
    expect(result.state).toBeDefined();
    expect(result.state!.phase).toBe(GamePhase.ACTION);
    expect(result.state!.currentRoll!.value).toBe(kept);
    expect(result.state!.previousRoll).toBeNull();
  });

  it("handleUsePrevious reverts to previous roll", () => {
    const state = reroll(roll(createState()));
    const prev = state.previousRoll!.value;
    const result = handleUsePrevious(state, P0);
    expect(result.state).toBeDefined();
    expect(result.state!.phase).toBe(GamePhase.ACTION);
    expect(result.state!.currentRoll!.value).toBe(prev);
  });
});

describe("handlePlaceDice", () => {
  it("places dice in the specified lane", () => {
    const state = roll(createState());
    const value = state.currentRoll!.value;
    const result = handlePlaceDice(state, P0, 0);
    expect(result.state).toBeDefined();
    expect(result.state!.players[0].board.lanes[0].slots[0]!.value).toBe(value);
    expect(result.state!.currentRoll).toBeNull();
  });

  it("rejects placement on a full lane", () => {
    const state = roll(createState());
    state.players[0].board.lanes[0].slots = [
      { type: DiceType.NORMAL, value: 1 },
      { type: DiceType.NORMAL, value: 2 },
      { type: DiceType.NORMAL, value: 3 },
    ];
    expect(handlePlaceDice(state, P0, 0).error).toBeDefined();
  });

  it("rejects placement when opponent has matching dice in lane", () => {
    const state = roll(createState());
    state.currentRoll!.value = 5;
    state.players[1].board.lanes[0].slots[0] = { type: DiceType.NORMAL, value: 5 };
    expect(handlePlaceDice(state, P0, 0).error).toContain("counter");
  });

  it("transitions to PLACE_SHIELD when player has shield dice", () => {
    const state = roll(createState());
    state.players[0].shieldDice = { type: DiceType.SHIELD, value: 4 };
    const result = handlePlaceDice(state, P0, 0);
    expect(result.state).toBeDefined();
    expect(result.state!.phase).toBe(GamePhase.PLACE_SHIELD);
  });
});

describe("handleCounter", () => {
  it("removes opponent dice and grants shield", () => {
    const state = roll(createState());
    state.currentRoll!.value = 3;
    state.players[1].board.lanes[0].slots[0] = { type: DiceType.NORMAL, value: 3 };
    state.players[1].board.lanes[0].slots[1] = { type: DiceType.NORMAL, value: 3 };

    const result = handleCounter(state, P0, 0);
    expect(result.state).toBeDefined();
    expect(result.state!.players[1].board.lanes[0].slots[0]).toBeNull();
    expect(result.state!.players[1].board.lanes[0].slots[1]).toBeNull();
    expect(result.state!.players[0].shieldDice).not.toBeNull();
    expect(result.state!.players[0].shieldDice!.type).toBe(DiceType.SHIELD);
    expect(result.state!.currentRoll).toBeNull();
    expect(result.state!.phase).toBe(GamePhase.PLACE_SHIELD);
  });

  it("rejects counter when no matching dice exist", () => {
    const state = roll(createState());
    state.currentRoll!.value = 3;
    expect(handleCounter(state, P0, 0).error).toBeDefined();
  });
});

describe("handlePlaceShield", () => {
  it("places shield on own board", () => {
    const state = roll(createState());
    state.phase = GamePhase.PLACE_SHIELD;
    state.currentRoll = null;
    state.players[0].shieldDice = { type: DiceType.SHIELD, value: 5 };

    const result = handlePlaceShield(state, P0, 2, 0);
    expect(result.state).toBeDefined();
    expect(result.state!.players[0].board.lanes[2].slots[0]!.type).toBe(DiceType.SHIELD);
    expect(result.state!.players[0].shieldDice).toBeNull();
  });

  it("places shield on opponent board", () => {
    const state = roll(createState());
    state.phase = GamePhase.PLACE_SHIELD;
    state.currentRoll = null;
    state.players[0].shieldDice = { type: DiceType.SHIELD, value: 5 };

    const result = handlePlaceShield(state, P0, 1, 1);
    expect(result.state).toBeDefined();
    expect(result.state!.players[1].board.lanes[1].slots[0]!.type).toBe(DiceType.SHIELD);
  });
});

describe("game ending", () => {
  it("game over when both boards full after placement", () => {
    const state = roll(createState());
    fillExcept(state.players[0].board, 0, 0);
    fillAllSlots(state.players[1].board);

    const result = handlePlaceDice(state, P0, 0);
    expect(result.state).toBeDefined();
    expect(result.state!.phase).toBe(GamePhase.GAME_OVER);
    expect(result.state!.winner).not.toBeNull();
    expect(result.state!.laneScores[0]).not.toBeNull();
    expect(result.state!.totalScores[0]).not.toBeNull();
  });

  it("determines correct winner by lane wins", () => {
    const state = createState();
    fillAllSlots(state.players[0].board, 6);
    fillAllSlots(state.players[1].board, 1);

    const result = handlePass(state, P0);
    expect(result.state).toBeDefined();
    expect(result.state!.phase).toBe(GamePhase.GAME_OVER);
    expect(result.state!.winner).toBe(0);
  });
});

describe("handlePass", () => {
  it("passes turn to opponent", () => {
    const state = createState();
    const result = handlePass(state, P0);
    expect(result.state).toBeDefined();
    expect(result.state!.currentPlayerIndex).toBe(1);
    expect(result.state!.phase).toBe(GamePhase.ROLL);
  });

  it("ends game when both boards full", () => {
    const state = createState();
    fillAllSlots(state.players[1].board);
    state.currentPlayerIndex = 0;
    const result = handlePass(state, P0);
    expect(result.state).toBeDefined();
    expect(result.state!.phase).toBe(GamePhase.GAME_OVER);
  });
});
