import assert from 'node:assert/strict';
import test from 'node:test';
import * as GFX from 'madness-engine/gfx';
import { createDiceWorld } from '../src/world.js';

function makeStage() {
  const view = {
    yaw: 0.04,
    pitch: 0.72,
    zoom: 1,
    aim: { yaw: 0.04, pitch: 0.72, zoom: 1 },
    reset() { this.aim.yaw = 0.04; this.aim.pitch = 0.72; },
  };
  return {
    scene: new GFX.Scene(),
    target: new GFX.Vector3(),
    view,
  };
}

function finishRoll(world) {
  for (let frame = 0; frame < 24; frame++) {
    const result = world.update(0.1);
    if (result) return result;
  }
  assert.fail('The D6 throw did not settle within the expected animation window.');
}

test('five numbered D6 props settle and report their actual upper faces', () => {
  const world = createDiceWorld(makeStage(), 'd6', { resin: '#b8d8d0', ink: '#182a35' });
  assert.equal(world.dice.length, 5);
  assert.ok(world.roll(() => 0.41));
  assert.equal(world.roll(() => 0.2), false, 'an active throw cannot be interrupted');
  const values = finishRoll(world);
  assert.equal(values.length, 5);
  assert.ok(values.every((value) => Number.isInteger(value) && value >= 1 && value <= 6));
  assert.deepEqual(world.inspect(), values);
});

test('the pip D6 variant reports values from the same settled face geometry', () => {
  const world = createDiceWorld(makeStage(), 'd6-pips', { resin: '#472d70', ink: '#f1d8a7' });
  assert.ok(world.dice.every((die) => die.prop.type === 'd6-pips'));
  assert.ok(world.roll(() => 0.73));
  const values = finishRoll(world);
  assert.equal(values.length, 5);
  assert.ok(values.every((value) => Number.isInteger(value) && value >= 1 && value <= 6));
});

test('portrait layout centers the dice into a three-plus-two arrangement', () => {
  const world = createDiceWorld(makeStage());
  world.setLayout(0.45);
  const positions = world.dice.map((die) => [die.baseX, die.baseZ]);
  assert.deepEqual(positions, [[-2.45, -1.2], [0, -1.2], [2.45, -1.2], [-1.225, 1.2], [1.225, 1.2]]);
  assert.ok(world.requiredZoom(0.45) > world.requiredZoom(1.6));
});

test('zoom framing responds to rotation and never asks for a clipped default frame', () => {
  const stage = makeStage();
  const world = createDiceWorld(stage);
  const initial = world.requiredZoom(1.4);
  stage.view.aim.yaw = Math.PI / 4;
  world.keepFramed();
  assert.ok(stage.view.aim.zoom >= world.requiredZoom(1.4));
  assert.ok(world.requiredZoom(1.4) > 0);
  assert.ok(initial > 0);
});

test('appearance changes rebuild all five dice and rolling remains available', () => {
  const world = createDiceWorld(makeStage());
  assert.equal(world.setAppearance('d6-pips', { resin: '#123456', ink: '#fedcba' }), true);
  assert.ok(world.dice.every((die) => die.prop.type === 'd6-pips'));
  assert.ok(world.dice.every((die) => die.prop.dieMat.color.getHexString() === '123456'));
  assert.ok(world.roll(() => 0.27));
  assert.equal(world.setAppearance('d6', { resin: '#ffffff', ink: '#000000' }), false);
  const values = finishRoll(world);
  assert.ok(values.every((value) => value >= 1 && value <= 6));
});