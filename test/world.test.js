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
  return { scene: new GFX.Scene(), target: new GFX.Vector3(), view };
}

function finish(world) {
  for (let frame = 0; frame < 20; frame++) {
    const result = world.update(0.1);
    if (result) return result;
  }
  assert.fail('Dice animation did not settle.');
}

test('every standard engine die can be created, rolled and read from its top face', () => {
  const world = createDiceWorld(makeStage());
  const types = ['d4', 'd6', 'd6-pips', 'd8', 'd10', 'd100', 'd12', 'd20'];
  const specs = types.map((type, index) => ({ id: type + '-test', type, value: null, held: false }));
  assert.equal(world.setDice(specs), true);
  assert.equal(world.dice.length, types.length);
  assert.equal(world.roll(specs.map((die) => die.id), () => 0.37), true);
  const results = finish(world);
  assert.equal(results.length, types.length);
  for (const result of results) {
    const die = specs.find((entry) => entry.id === result.id);
    const actual = world.inspect().find((entry) => entry.id === result.id);
    assert.equal(String(result.value), String(actual.value));
    assert.ok(world.dice.find((entry) => entry.id === result.id).prop.faces.some((face) => String(face.number) === String(result.value)));
  }
});

test('held dice are left untouched while the remaining dice roll', () => {
  const world = createDiceWorld(makeStage());
  const specs = [
    { id: 'kept', type: 'd6', value: 4, held: true },
    { id: 'reroll', type: 'd20', value: 17, held: false },
  ];
  world.setDice(specs);
  const before = world.inspect();
  assert.equal(world.roll(['reroll'], () => 0.2), true);
  const results = finish(world);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'reroll');
  const after = world.inspect();
  assert.equal(after.find((die) => die.id === 'kept').value, before.find((die) => die.id === 'kept').value);
});

test('portrait and landscape layouts reposition all dice and reframe the camera', () => {
  const stage = makeStage();
  const world = createDiceWorld(stage);
  const specs = Array.from({ length: 18 }, (_, index) => ({
    id: 'd6-' + index, type: 'd6', value: null, held: false,
  }));
  world.setDice(specs);
  world.setLayout(0.45);
  const portrait = world.dice.map((die) => [die.baseX, die.baseZ]);
  assert.equal(new Set(portrait.map((point) => point[0])).size, 3);
  const portraitZoom = world.requiredZoom();
  world.setLayout(1.8);
  assert.ok(new Set(world.dice.map((die) => die.baseX)).size > 3);
  assert.ok(portraitZoom > 0);
  assert.ok(stage.view.aim.zoom >= world.requiredZoom());
});

test('dice finish and hold rings update without changing the result face', () => {
  const world = createDiceWorld(makeStage());
  world.setDice([{ id: 'd20-1', type: 'd20', value: 20, held: false }]);
  assert.equal(world.setHeld('d20-1', true), true);
  assert.equal(world.inspect()[0].held, true);
  assert.equal(world.inspect()[0].value, 20);
});