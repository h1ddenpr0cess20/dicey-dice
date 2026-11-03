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

test('held state updates without decorative rings beneath dice', () => {
  const world = createDiceWorld(makeStage());
  world.setDice([{ id: 'd20-1', type: 'd20', value: 20, held: false }]);
  assert.equal(world.setHeld('d20-1', true), true);
  assert.equal(world.inspect()[0].held, true);
  assert.equal(world.inspect()[0].value, 20);
  assert.equal(world.dice[0].ring, undefined);
  assert.equal(world.dice[0].anchor.children.length, 1);
});

test('D4 lands flat on a triangular base instead of balancing on a vertex', () => {
  const stage = makeStage();
  const world = createDiceWorld(stage);
  world.setDice([{ id: 'd4-flat', type: 'd4', value: null, held: false }]);
  const die = world.dice[0];
  const face = die.prop.faces
    .map((entry) => ({
      number: entry.number,
      y: entry.normal.clone().applyQuaternion(die.prop.group.quaternion).y,
    }))
    .sort((a, b) => a.y - b.y)[0];
  assert.ok(face.y < -0.999, 'a triangular face points straight down');
  const vertices = die.prop.die.geometry.attributes.position;
  let lowest = Infinity;
  const point = new GFX.Vector3();
  for (let index = 0; index < vertices.count; index++) {
    point.fromBufferAttribute(vertices, index).applyQuaternion(die.prop.group.quaternion);
    lowest = Math.min(lowest, point.y);
  }
  const worldBottom = die.anchor.position.y + lowest * 0.83;
  assert.ok(Math.abs(worldBottom - 0.322) < 0.02, 'the resting face touches the felt');
  assert.equal(world.dice[0].baseY, die.anchor.position.y);
});

test('rolling a D4 leaves it on a triangular base and reads the resting facet', () => {
  const world = createDiceWorld(makeStage());
  world.setDice([{ id: 'd4-roll', type: 'd4', value: null, held: false }]);
  assert.equal(world.roll(['d4-roll'], () => 0.51), true);
  const results = finish(world);
  assert.equal(results.length, 1);
  const die = world.dice[0];
  const normals = die.prop.faces.map((face) =>
    face.normal.clone().applyQuaternion(die.prop.group.quaternion).y);
  assert.ok(Math.min(...normals) < -0.999, 'the D4 finishes with a whole face against the table');
  assert.equal(String(results[0].value), String(world.inspect()[0].value));
});
