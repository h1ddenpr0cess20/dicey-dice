import assert from 'node:assert/strict';
import test from 'node:test';
import { bankPoints, createGameState, DICE_COUNT, resolveRoll, TARGET_SCORE } from '../src/sim.js';

test('a safe throw adds all five actual face values to the turn pot', () => {
  const next = resolveRoll(createGameState(), [2, 3, 4, 5, 6]);
  assert.equal(next.lastRollTotal, 20);
  assert.equal(next.turnScore, 20);
  assert.equal(next.bankedScore, 0);
  assert.equal(next.lastOutcome, 'safe');
  assert.equal(next.rollsTaken, 1);
});

test('a one busts the entire unbanked turn without touching banked points', () => {
  const before = { ...createGameState(), bankedScore: 35, turnScore: 24 };
  const next = resolveRoll(before, [6, 1, 4, 5, 3]);
  assert.equal(next.bankedScore, 35);
  assert.equal(next.turnScore, 0);
  assert.equal(next.lastRollTotal, 19);
  assert.equal(next.lastOutcome, 'bust');
});

test('multiple safe throws accumulate before banking', () => {
  const first = resolveRoll(createGameState(), [2, 2, 3, 4, 5]);
  const second = resolveRoll(first, [6, 4, 3, 2, 5]);
  assert.equal(first.turnScore, 16);
  assert.equal(second.turnScore, 36);
  assert.equal(second.rollsTaken, 2);
});

test('banking moves the turn pot into the safe total and clears the pot', () => {
  const rolled = resolveRoll(createGameState(), [2, 3, 4, 5, 6]);
  const banked = bankPoints(rolled);
  assert.equal(banked.bankedScore, 20);
  assert.equal(banked.turnScore, 0);
  assert.equal(banked.lastOutcome, 'banked');
  assert.equal(banked.turnsCompleted, 1);
});

test('reaching or passing the target wins the game', () => {
  const nearWin = { ...createGameState(), bankedScore: TARGET_SCORE - 14, turnScore: 14 };
  const won = bankPoints(nearWin);
  assert.equal(won.bankedScore, TARGET_SCORE);
  assert.equal(won.won, true);
  assert.equal(won.lastOutcome, 'won');
  assert.equal(bankPoints(won), won, 'a completed game cannot bank again');
});

test('banking an empty turn is a no-op', () => {
  const state = createGameState();
  assert.equal(bankPoints(state), state);
});

test('roll values must represent five valid six-sided dice', () => {
  assert.throws(() => resolveRoll(createGameState(), [1, 2, 3, 4]), /exactly 5/);
  assert.throws(() => resolveRoll(createGameState(), [1, 2, 3, 4, 7]), /from 1 to 6/);
  assert.throws(() => resolveRoll(createGameState(), [1, 2, 3, 4, 2.5]), /integers/);
  assert.equal(DICE_COUNT, 5);
});
