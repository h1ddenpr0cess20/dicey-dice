import * as GFX from 'madness-engine/gfx';
import { createDieProp } from 'madness-engine/props/dice';

const TABLE_X = -1.55;
const TABLE_TOP = 0.315;
const DIE_BASE_Y = TABLE_TOP + 0.57;
const DIE_SPACING = 1.88;
const UP = new GFX.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

function material(color, roughness = 0.6, metalness = 0) {
  return new GFX.MeshStandardMaterial({ color: new GFX.Color(color), roughness, metalness });
}

function makeBox(scene, width, height, depth, position, mat, name) {
  const mesh = new GFX.Mesh(new GFX.BoxGeometry(width, height, depth), mat);
  mesh.position.set(...position);
  mesh.name = name;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}

function randomUnitVector(random) {
  const z = random() * 2 - 1;
  const angle = random() * TAU;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return new GFX.Vector3(radius * Math.cos(angle), z, radius * Math.sin(angle)).normalize();
}

function disposeGroup(group) {
  group.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const entry of materials) {
      entry?.map?.dispose?.();
      entry?.dispose?.();
    }
  });
}

function createTable(scene) {
  const floor = new GFX.Mesh(
    new GFX.PlaneGeometry(200, 200),
    material('#11151e', 0.94),
  );
  floor.name = 'studio_floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.25;
  floor.receiveShadow = true;
  scene.add(floor);

  makeBox(scene, 10.35, 0.38, 6.3, [TABLE_X, -0.01, 0], material('#242b34', 0.38, 0.32), 'table_base');
  makeBox(scene, 10.05, 0.12, 6.02, [TABLE_X, 0.22, 0], material('#17252b', 0.32, 0.18), 'table_inlay');
  makeBox(scene, 9.92, 0.035, 5.88, [TABLE_X, 0.298, 0], material('#20383a', 0.66, 0.04), 'felt_surface');

  const trimMat = new GFX.MeshStandardMaterial({
    color: new GFX.Color('#79c8b6'),
    roughness: 0.28,
    metalness: 0.55,
    emissive: new GFX.Color('#153c36'),
    emissiveIntensity: 0.24,
  });
  makeBox(scene, 9.96, 0.045, 0.055, [TABLE_X, 0.32, -2.93], trimMat, 'rear_table_trim');
  makeBox(scene, 9.96, 0.045, 0.055, [TABLE_X, 0.32, 2.93], trimMat, 'front_table_trim');
  makeBox(scene, 0.055, 0.045, 5.9, [TABLE_X - 4.96, 0.32, 0], trimMat, 'left_table_trim');
  makeBox(scene, 0.055, 0.045, 5.9, [TABLE_X + 4.96, 0.32, 0], trimMat, 'right_table_trim');

  const markerMat = new GFX.MeshStandardMaterial({
    color: new GFX.Color('#5a978d'),
    roughness: 0.45,
    metalness: 0.2,
    transparent: true,
    opacity: 0.48,
  });
  for (let i = 0; i < 5; i++) {
    const x = TABLE_X + (i - 2) * DIE_SPACING;
    const ring = new GFX.Mesh(new GFX.TorusGeometry(0.69, 0.014, 8, 56), markerMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.345, 0);
    ring.name = `die_rest_${i + 1}`;
    scene.add(ring);
  }

  const pedestalMat = material('#151a22', 0.48, 0.34);
  makeBox(scene, 8.5, 0.18, 0.32, [TABLE_X, -0.31, -2.56], pedestalMat, 'front_table_apron');
  makeBox(scene, 8.5, 0.18, 0.32, [TABLE_X, -0.31, 2.56], pedestalMat, 'rear_table_apron');
}

function createDieSlot(scene, index, type, colors) {
  const anchor = new GFX.Group();
  anchor.name = `die_slot_${index + 1}`;
  anchor.position.set(TABLE_X + (index - 2) * DIE_SPACING, DIE_BASE_Y, 0);
  scene.add(anchor);

  const tumble = new GFX.Group();
  tumble.name = `die_tumble_${index + 1}`;
  anchor.add(tumble);

  const prop = createDieProp(GFX, type, {
    color: colors.resin,
    markingColor: colors.ink,
  });
  prop.group.scale.setScalar(0.94);
  tumble.add(prop.group);

  return { anchor, tumble, prop, baseY: DIE_BASE_Y, index };
}

function topFaceOf(die) {
  let highest = null;
  for (const face of die.prop.faces) {
    const worldNormal = face.normal.clone().applyQuaternion(die.prop.group.quaternion).normalize();
    if (!highest || worldNormal.y > highest.height) {
      highest = { height: worldNormal.y, number: Number(face.number) };
    }
  }
  if (!highest || highest.height < 0.999) {
    throw new Error(`D6 ${die.index + 1} did not settle on a readable upper face (dot=${highest?.height ?? 'n/a'}).`);
  }
  return highest.number;
}

export function createDiceWorld(stage, initialType = 'd6', initialColors = { resin: '#b8d8d0', ink: '#182a35' }) {
  const { scene } = stage;
  createTable(scene);

  const tableLight = new GFX.PointLight(new GFX.Color('#9be6d2'), 7.5, 13, 1.6);
  tableLight.position.set(TABLE_X - 1.5, 5.5, 1.8);
  scene.add(tableLight);

  let type = initialType;
  let colors = { ...initialColors };
  let dice = [];
  let animation = null;

  function buildDice() {
    for (const die of dice) {
      die.anchor.removeFromParent();
      disposeGroup(die.anchor);
    }
    dice = Array.from({ length: 5 }, (_, index) => createDieSlot(scene, index, type, colors));
  }

  function chooseTarget(die, random) {
    const faceIndex = Math.min(die.prop.faces.length - 1, Math.floor(random() * die.prop.faces.length));
    const face = die.prop.faces[faceIndex];
    const align = new GFX.Quaternion().setFromUnitVectors(face.normal.clone().normalize(), UP);
    const yaw = new GFX.Quaternion().setFromAxisAngle(UP, random() * TAU);
    return {
      quaternion: yaw.multiply(align),
      value: Number(face.number),
    };
  }

  function roll(random = Math.random) {
    if (animation) return false;
    const rollDice = dice.map((die) => {
      const target = chooseTarget(die, random);
      return {
        die,
        start: die.prop.group.quaternion.clone(),
        target: target.quaternion,
        spinAxis: randomUnitVector(random),
        spinTurns: 1.5 + random() * 1.6,
        lift: 0.45 + random() * 0.28,
      };
    });
    animation = { elapsed: 0, duration: 1.18, dice: rollDice };
    return true;
  }

  function update(dt) {
    if (!animation) return null;
    animation.elapsed = Math.min(animation.duration, animation.elapsed + dt);
    const progress = animation.elapsed / animation.duration;
    const ease = 1 - Math.pow(1 - progress, 3);

    for (const entry of animation.dice) {
      const { die } = entry;
      die.prop.group.quaternion.copy(entry.start).slerp(entry.target, ease);
      die.tumble.quaternion.setFromAxisAngle(entry.spinAxis, TAU * entry.spinTurns * Math.pow(1 - ease, 1.12));
      die.anchor.position.y = die.baseY + Math.sin(progress * Math.PI) * entry.lift * (1 - progress * 0.22);
      die.anchor.position.x = TABLE_X + (die.index - 2) * DIE_SPACING
        + Math.sin(progress * Math.PI * 2 + die.index) * 0.075 * (1 - progress);
    }

    if (progress < 1) return null;

    for (const entry of animation.dice) {
      entry.die.prop.group.quaternion.copy(entry.target);
      entry.die.tumble.quaternion.identity();
      entry.die.anchor.position.set(TABLE_X + (entry.die.index - 2) * DIE_SPACING, entry.die.baseY, 0);
    }
    animation = null;
    return dice.map(topFaceOf);
  }

  function setAppearance(nextType = type, nextColors = colors) {
    if (animation) return false;
    type = nextType;
    colors = { ...nextColors };
    buildDice();
    return true;
  }

  function isRolling() {
    return Boolean(animation);
  }

  function inspect() {
    return dice.map(topFaceOf);
  }

  buildDice();

  stage.target.set(TABLE_X - 1.35, 1.15, 0);

  return {
    roll,
    update,
    setAppearance,
    isRolling,
    inspect,
    get dice() { return dice; },
  };
}