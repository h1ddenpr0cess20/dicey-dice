export const TARGET_SCORE = 100;
export const DICE_COUNT = 5;

export function createGameState() {
  return {
    bankedScore: 0,
    turnScore: 0,
    lastRoll: [],
    lastRollTotal: 0,
    lastOutcome: 'ready',
    won: false,
    rollsTaken: 0,
    turnsCompleted: 0,
  };
}

function validateValues(values) {
  if (!Array.isArray(values) || values.length !== DICE_COUNT) {
    throw new TypeError(`A throw must contain exactly ${DICE_COUNT} dice.`);
  }
  for (const value of values) {
    if (!Number.isInteger(value) || value < 1 || value > 6) {
      throw new RangeError(`D6 face values must be integers from 1 to 6; received ${value}.`);
    }
  }
}

/** Apply a completed throw. Values are read from the rendered dice, not generated here. */
export function resolveRoll(state, values) {
  validateValues(values);
  if (state.won) return state;

  const roll = [...values];
  const total = roll.reduce((sum, value) => sum + value, 0);
  const hasOne = roll.includes(1);

  if (hasOne) {
    return {
      ...state,
      turnScore: 0,
      lastRoll: roll,
      lastRollTotal: total,
      lastOutcome: 'bust',
      rollsTaken: state.rollsTaken + 1,
    };
  }

  return {
    ...state,
    turnScore: state.turnScore + total,
    lastRoll: roll,
    lastRollTotal: total,
    lastOutcome: 'safe',
    rollsTaken: state.rollsTaken + 1,
  };
}

export function bankPoints(state, target = TARGET_SCORE) {
  if (state.won || state.turnScore <= 0) return state;

  const bankedScore = state.bankedScore + state.turnScore;
  const won = bankedScore >= target;
  return {
    ...state,
    bankedScore,
    turnScore: 0,
    won,
    lastOutcome: won ? 'won' : 'banked',
    turnsCompleted: state.turnsCompleted + 1,
  };
}
