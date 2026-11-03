import assert from 'node:assert/strict';
import test from 'node:test';
import * as GFX from 'madness-engine/gfx';
import { createDiceWorld } from '../src/world.js';

function makeStage() {
  return {
    scene: new GFX.Scene(),
    target: new GFX.Vector3(),
  };
}

function finishRoll(world) {
  for (let frame = 0; frame < 20; frame++) {
    const result = world.update(0.1);
    if (result) return result;
  }
  assert.fail('The D6 throw did not settle within the expected animation window.');
}

test('five numbered D6 props settle with readable upper faces', () => {
  const world = createDiceWorld(makeStage(), 'd6', { resin: '#b8d8d0', ink: '#182a35' });
  assert.equal(world.dice.length, 5);
  assert.ok(world.roll(() => 0.41));
  const values = finishRoll(world);
  assert.equal(values.length, 5);
  assert.ok(values.every((value) => Number.isInteger(value) && value >= 1 && value <= 6));
  assert.deepEqual(world.inspect(), values);
});

test('the pip D6 variant also resolves from the settled geometry', () => {
  const world = createDiceWorld(makeStage(), 'd6-pips', { resin: '#472d70', ink: '#f1d8a7' });
  assert.equal(world.dice[0].prop.type, 'd6-pips');
  assert.ok(world.roll(() => 0.73));
  const values = finishRoll(world);
  assert.equal(values.length, 5);
  assert.ok(values.every((value) => Number.isInteger(value) && value >= 1 && value <= 6));
});

test('a new appearance rebuild preserves a working five-D6 table', () => {
  const world = createDiceWorld(makeStage());
  assert.equal(world.setAppearance('d6-pips', { resin: '#123456', ink: '#fedcba' }), true);
  assert.ok(world.dice.every((die) => die.prop.type === 'd6-pips'));
  assert.ok(world.dice.every((die) => die.prop.dieMat.color.getHexString() === '123456'));
  assert.ok(world.roll(() => 0.27));
  const values = finishRoll(world);
  assert.ok(values.every((value) => value >= 1 && value <= 6));
});
