import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPreset, applyRoll, clearTray, createTrayState, diceToRoll,
  DICE_CATALOG, formatDieValue, getDiceCounts, MAX_DICE,
  setAllHeld, setDiceCount, setDieHeld,
  createSavedPreset, normalizeSavedPresets, applySavedPreset, MAX_SAVED_PRESETS,
  createSavedColorCombo, normalizeSavedColorCombos, MAX_SAVED_COLOR_COMBOS,
} from '../src/sim.js';

test('the default tray starts with five pip-marked D6', () => {
  const state = createTrayState();
  assert.equal(state.dice.length, 5);
  assert.equal(getDiceCounts(state.dice)['d6-pips'], 5);
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

test('Yahtzee, Farkle, craps, D&D and percentile presets map to useful pools', () => {
  const yahtzee = applyPreset(createTrayState(), 'yahtzee');
  assert.deepEqual(getDiceCounts(yahtzee.dice), { d4: 0, d6: 0, 'd6-pips': 5, d8: 0, d10: 0, d100: 0, d12: 0, d20: 0 });
  assert.equal(getDiceCounts(applyPreset(yahtzee, 'farkle').dice)['d6-pips'], 6);
  assert.equal(getDiceCounts(applyPreset(yahtzee, 'craps').dice)['d6-pips'], 2);
  assert.equal(applyPreset(yahtzee, 'dnd').dice.length, 7);
  assert.equal(getDiceCounts(applyPreset(yahtzee, 'percentile').dice).d100, 1);
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

test('custom presets preserve dice counts and colors', () => {
  const state = createTrayState({ 'd6-pips': 4, d20: 1 });
  const preset = createSavedPreset('Friday table', state, { resin: '#6f5b9a', ink: '#f2e6ff' }, 'friday');
  assert.equal(preset.counts['d6-pips'], 4);
  assert.equal(preset.resin, '#6f5b9a');
  assert.deepEqual(getDiceCounts(applySavedPreset(createTrayState(), preset).dice), getDiceCounts(state.dice));
});
test('custom color combos preserve named resin and marking colors', () => {
  const combo = createSavedColorCombo('Moonstone', { resin: '#6F5B9A', ink: '#F2E6FF' }, 'moonstone');
  assert.deepEqual(combo, { id: 'moonstone', name: 'Moonstone', resin: '#6f5b9a', ink: '#f2e6ff' });
});

test('custom color combos reject invalid names and colors', () => {
  assert.throws(() => createSavedColorCombo(' ', { resin: '#ffffff', ink: '#000000' }), /name/);
  assert.throws(() => createSavedColorCombo('Too long '.repeat(4), { resin: '#ffffff', ink: '#000000' }), /24 characters/);
  assert.throws(() => createSavedColorCombo('Broken', { resin: 'red', ink: '#000000' }), /valid resin and marking/);
});

test('saved color combos are sanitized, deduplicated, and capped', () => {
  const combos = Array.from({ length: MAX_SAVED_COLOR_COMBOS + 3 }, (_, index) =>
    createSavedColorCombo('Combo ' + index, { resin: '#ffffff', ink: '#000000' }, 'combo-' + index));
  const list = normalizeSavedColorCombos([combos[0], combos[0], { ...combos[1], name: combos[0].name }, { ...combos[2], ink: 'transparent' }, ...combos]);
  assert.equal(list.length, MAX_SAVED_COLOR_COMBOS);
  assert.equal(list[0].id, 'combo-0');
  assert.equal(list.some((combo) => combo.id === 'combo-2'), false);
});

test('custom presets reject blank names and empty trays', () => {
  assert.throws(() => createSavedPreset(' ', createTrayState(), {}), /name/);
  assert.throws(() => createSavedPreset('Empty', clearTray(createTrayState()), {}), /at least one die/);
});
test('saved presets are sanitized, deduplicated and capped', () => {
  const valid = createSavedPreset('Valid', createTrayState({ d20: 1 }), {}, 'saved-1');
  const list = normalizeSavedPresets([valid, valid, {id:'empty',name:'Empty',counts:{}}, ...Array.from({length:MAX_SAVED_PRESETS+2},(_,i)=>createSavedPreset('Pool '+i,createTrayState({d6:i+1}),{},'id-'+i))]);
  assert.ok(list.length <= MAX_SAVED_PRESETS);
  assert.equal(list[0].id, 'saved-1');
  assert.equal(list.some(p => p.id === 'empty'), false);
});
