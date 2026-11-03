import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPreset, applyRoll, clearTray, createTrayState, diceToRoll,
  DICE_CATALOG, formatDieValue, getDiceCounts, MAX_DICE,
  setAllHeld, setDiceCount, setDieHeld,
} from '../src/sim.js';

test('the default tray starts with five numbered D6', () => {
  const state = createTrayState();
  assert.equal(state.dice.length, 5);
  assert.equal(getDiceCounts(state.dice).d6, 5);
});

test('all standard RPG dice types have selectable pools', () => {
  const state = DICE_CATALOG.reduce((current, entry) => setDiceCount(current, entry.id, 1), clearTray(createTrayState()));
  assert.equal(state.dice.length, 8);
  assert.deepEqual(new Set(state.dice.map((die) => die.type)), new Set(DICE_CATALOG.map((entry) => entry.id)));
});

test('pool changes preserve existing results and enforce the global cap', () => {
  let state = createTrayState({ d6: 2 });
  state = applyRoll(state, state.dice.map((die, index) => ({ id: die.id, value: index + 2 })), 100);
  const firstId = state.dice[0].id;
  state = setDiceCount(state, 'd6', 4);
  assert.equal(state.dice.length, 4);
  assert.equal(state.dice[0].id, firstId);
  assert.equal(state.dice[0].value, 2);
  state = setDiceCount(state, 'd20', MAX_DICE);
  assert.equal(state.dice.length, MAX_DICE);
});

test('Yahtzee, Farkle, craps, D&D, percentile and poker presets map to useful pools', () => {
  const yahtzee = applyPreset(createTrayState(), 'yahtzee');
  assert.deepEqual(getDiceCounts(yahtzee.dice), { d4: 0, d6: 5, 'd6-pips': 0, d8: 0, d10: 0, d100: 0, d12: 0, d20: 0 });
  assert.equal(getDiceCounts(applyPreset(yahtzee, 'farkle').dice).d6, 6);
  assert.equal(getDiceCounts(applyPreset(yahtzee, 'craps').dice).d6, 2);
  assert.equal(applyPreset(yahtzee, 'dnd').dice.length, 7);
  assert.equal(getDiceCounts(applyPreset(yahtzee, 'percentile').dice).d100, 1);
  assert.equal(getDiceCounts(applyPreset(yahtzee, 'poker').dice)['d6-pips'], 5);
});

test('kept dice are excluded from rerolls and released dice return to the pool', () => {
  let state = createTrayState({ d6: 5 });
  state = applyRoll(state, state.dice.map((die, index) => ({ id: die.id, value: index + 1 })));
  state = setDieHeld(state, state.dice[1].id, true);
  state = setDieHeld(state, state.dice[3].id, true);
  assert.equal(diceToRoll(state).length, 3);
  assert.equal(diceToRoll(state, 'all').length, 5);
  const keptValue = state.dice[1].value;
  const reroll = diceToRoll(state).map((id, index) => ({ id, value: index + 2 }));
  state = applyRoll(state, reroll, 200);
  assert.equal(state.dice[1].value, keptValue);
  assert.equal(state.dice[1].held, true);
  state = setAllHeld(state, false);
  assert.equal(diceToRoll(state).length, 5);
});

test('percentile values retain two-digit display including 00', () => {
  assert.equal(formatDieValue('d100', '00'), '00');
  assert.equal(formatDieValue('d100', '70'), '70');
});

test('only valid faces can be committed and held dice cannot be rolled', () => {
  const state = createTrayState({ d20: 1 });
  assert.throws(() => applyRoll(state, [{ id: state.dice[0].id, value: 21 }]), /Invalid d20/);
  const rolled = applyRoll(state, [{ id: state.dice[0].id, value: 20 }]);
  const held = setDieHeld(rolled, state.dice[0].id, true);
  assert.throws(() => applyRoll(held, [{ id: state.dice[0].id, value: 8 }]), /kept die/);
});

test('roll history keeps the latest ten results', () => {
  let state = createTrayState({ d4: 1 });
  for (let index = 0; index < 12; index++) {
    state = applyRoll(state, [{ id: state.dice[0].id, value: (index % 4) + 1 }], index);
  }
  assert.equal(state.history.length, 10);
  assert.equal(state.history[0].number, 12);
  assert.equal(state.history.at(-1).number, 3);
});

test('clearing the tray removes the dice without retaining old history', () => {
  const rolled = applyRoll(createTrayState(), [{ id: 'd6-1', value: 6 }]);
  const cleared = clearTray(rolled);
  assert.equal(cleared.dice.length, 0);
  assert.equal(cleared.history.length, 0);
});