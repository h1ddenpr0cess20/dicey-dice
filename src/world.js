import * as GFX from 'madness-engine/gfx';
import { createDieProp } from 'madness-engine/props/dice';

const TABLE_TOP = 0.315;
const DIE_BASE_Y = TABLE_TOP + 0.57;
const DIE_SPACING = 1.88;
const DIE_SCALE = 0.94;
const DIE_RADIUS = 0.9;
const TARGET_Y = 0.9;
const CAMERA_DISTANCE = 11;
const CAMERA_FOV = 35;
const UP = new GFX.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

function standardMaterial(color, roughness = 0.6, metalness = 0) {
  return new GFX.MeshStandardMaterial({ color: new GFX.Color(color), roughness, metalness });
}

function addBox(scene, width, height, depth, position, material, name) {
  const mesh = new GFX.Mesh(new GFX.BoxGeometry(width, height, depth), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
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
    for (const material of materials) {
      material?.map?.dispose?.();
      material?.dispose?.();
    }
  });
}

function positionsForAspect(aspect) {
  if (aspect < 0.9) {
    return [
      [-2.45, -1.2], [0, -1.2], [2.45, -1.2],
      [-1.225, 1.2], [1.225, 1.2],
    ];
  }
  return Array.from({ length: 5 }, (_, index) => [(index - 2) * DIE_SPACING, 0]);
}

function createTable(scene) {
  const floor = new GFX.Mesh(new GFX.PlaneGeometry(200, 200), standardMaterial('#101711', 0.96));
  floor.name = 'studio_floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.29;
  floor.receiveShadow = true;
  scene.add(floor);

  const tableParts = [];
  const part = (...args) => tableParts.push(addBox(scene, ...args));

  part(10.68, 0.42, 6.72, [0, -0.01, 0], standardMaterial('#241d16', 0.34, 0.22), 'walnut_table_base');
  part(10.42, 0.11, 6.46, [0, 0.225, 0], standardMaterial('#15241d', 0.32, 0.16), 'dark_table_inlay');
  part(10.16, 0.035, 6.2, [0, 0.298, 0], standardMaterial('#244538', 0.74, 0.02), 'green_felt');

  const brass = new GFX.MeshStandardMaterial({
    color: new GFX.Color('#b38b50'),
    roughness: 0.3,
    metalness: 0.68,
    emissive: new GFX.Color('#3c2812'),
    emissiveIntensity: 0.1,
  });
  part(10.35, 0.035, 0.045, [0, 0.322, -3.19], brass, 'rear_brass_rail');
  part(10.35, 0.035, 0.045, [0, 0.322, 3.19], brass, 'front_brass_rail');
  part(0.045, 0.035, 6.35, [-5.15, 0.322, 0], brass, 'left_brass_rail');
  part(0.045, 0.035, 6.35, [5.15, 0.322, 0], brass, 'right_brass_rail');

  const markerMaterial = new GFX.MeshStandardMaterial({
    color: new GFX.Color('#8ab7a1'),
    roughness: 0.42,
    metalness: 0.25,
    transparent: true,
    opacity: 0.32,
  });
  const rings = [];
  for (let index = 0; index < 5; index++) {
    const ring = new GFX.Mesh(new GFX.TorusGeometry(0.7, 0.012, 8, 52), markerMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.348, 0);
    ring.name = 'die_rest_' + (index + 1);
    scene.add(ring);
    rings.push(ring);
  }

  const apron = standardMaterial('#171812', 0.42, 0.25);
  part(8.8, 0.18, 0.29, [0, -0.31, -2.71], apron, 'rear_table_apron');
  part(8.8, 0.18, 0.29, [0, -0.31, 2.71], apron, 'front_table_apron');

  return { rings };
}

function createDieSlot(scene, index, type, colors, position) {
  const anchor = new GFX.Group();
  anchor.name = 'die_slot_' + (index + 1);
  anchor.position.set(position[0], DIE_BASE_Y, position[1]);
  scene.add(anchor);

  const tumble = new GFX.Group();
  tumble.name = 'die_tumble_' + (index + 1);
  anchor.add(tumble);

  const prop = createDieProp(GFX, type, {
    color: colors.resin,
    markingColor: colors.ink,
  });
  prop.group.scale.setScalar(DIE_SCALE);
  tumble.add(prop.group);

  return {
    anchor, tumble, prop, baseY: DIE_BASE_Y, index,
    baseX: position[0], baseZ: position[1],
  };
}

function topFaceOf(die) {
  let highest = null;
  for (const face of die.prop.faces) {
    const worldNormal = face.normal.clone()
      .applyQuaternion(die.prop.group.quaternion)
      .applyQuaternion(die.tumble.quaternion)
      .normalize();
    if (!highest || worldNormal.y > highest.height) {
      highest = { height: worldNormal.y, value: Number(face.number) };
    }
  }
  if (!highest || highest.height < 0.999) {
    throw new Error('D6 ' + (die.index + 1) +
      ' did not settle on a readable upper face (dot=' + (highest?.height ?? 'n/a') + ').');
  }
  return highest.value;
}

export function createDiceWorld(
  stage,
  initialType = 'd6',
  initialColors = { resin: '#b8d8d0', ink: '#182a35' },
) {
  const { scene } = stage;
  const table = createTable(scene);
  const tableLight = new GFX.PointLight(new GFX.Color('#c0d9c1'), 8, 16, 1.5);
  tableLight.position.set(-1.6, 5.8, 2.2);
  scene.add(tableLight);

  let type = initialType;
  let colors = { ...initialColors };
  let dice = [];
  let animation = null;
  let currentAspect = 1.6;
  let positions = positionsForAspect(currentAspect);

  function requiredZoom(aspect = currentAspect) {
    const yaw = stage.view.aim.yaw;
    const pitch = stage.view.aim.pitch;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    const right = (x, z) => x * cy - z * sy;
    const up = (x, y, z) => -x * sy * sp + y * cp - z * cy * sp;

    let halfWidth = 0;
    let halfHeight = 0;
    for (const [x, z] of positions) {
      halfWidth = Math.max(halfWidth, Math.abs(right(x, z)) + DIE_RADIUS);
      halfHeight = Math.max(halfHeight, Math.abs(up(x, DIE_BASE_Y - TARGET_Y, z)) + DIE_RADIUS);
    }

    // Include the tabletop corners so the table itself also stays in frame.
    const tableHalfWidth = 5.34;
    const tableHalfDepth = 3.36;
    for (const x of [-tableHalfWidth, tableHalfWidth]) {
      for (const z of [-tableHalfDepth, tableHalfDepth]) {
        halfWidth = Math.max(halfWidth, Math.abs(right(x, z)));
        halfHeight = Math.max(halfHeight, Math.abs(up(x, 0.32 - TARGET_Y, z)));
      }
    }

    const safeAspect = Math.max(0.25, aspect);
    const fov = CAMERA_FOV * Math.max(1, Math.min(1.75, 0.8 / safeAspect));
    const tangent = Math.tan((fov * Math.PI / 180) / 2);
    const distanceForWidth = halfWidth / (tangent * safeAspect);
    const distanceForHeight = halfHeight / tangent;
    return Math.max(0.55, Math.max(distanceForWidth, distanceForHeight) * 1.16 / CAMERA_DISTANCE);
  }

  function applyLayout(aspect, { resetZoom = false } = {}) {
    const oldRequired = requiredZoom(currentAspect);
    const oldRatio = stage.view.aim.zoom / oldRequired;
    currentAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1.6;
    positions = positionsForAspect(currentAspect);

    for (let index = 0; index < 5; index++) {
      const [x, z] = positions[index];
      table.rings[index].position.set(x, 0.348, z);
      if (dice[index]) {
        dice[index].baseX = x;
        dice[index].baseZ = z;
        if (!animation) {
          dice[index].anchor.position.set(x, dice[index].baseY, z);
        } else {
          const entry = animation.dice.find((candidate) => candidate.die === dice[index]);
          if (entry) {
            entry.baseX = x;
            entry.baseZ = z;
          }
        }
      }
    }

    const fit = requiredZoom(currentAspect);
    stage.view.aim.zoom = resetZoom ? fit : Math.max(fit, fit * oldRatio);
    return fit;
  }

  function buildDice() {
    for (const die of dice) {
      die.anchor.removeFromParent();
      disposeGroup(die.anchor);
    }
    dice = positions.map((position, index) => createDieSlot(scene, index, type, colors, position));
  }

  function chooseTarget(die, random) {
    const faceIndex = Math.min(die.prop.faces.length - 1, Math.floor(random() * die.prop.faces.length));
    const face = die.prop.faces[faceIndex];
    const align = new GFX.Quaternion().setFromUnitVectors(face.normal.clone().normalize(), UP);
    const yaw = new GFX.Quaternion().setFromAxisAngle(UP, random() * TAU);
    return yaw.multiply(align);
  }

  function roll(random = Math.random) {
    if (animation) return false;
    animation = {
      elapsed: 0,
      duration: 1.28,
      dice: dice.map((die) => ({
        die,
        start: die.prop.group.quaternion.clone(),
        target: chooseTarget(die, random),
        spinAxis: randomUnitVector(random),
        spinTurns: 1.7 + random() * 1.5,
        lift: 0.42 + random() * 0.24,
        baseX: die.baseX,
        baseZ: die.baseZ,
      })),
    };
    return true;
  }

  function update(dt) {
    if (!animation) return null;
    animation.elapsed = Math.min(animation.duration, animation.elapsed + Math.max(0, dt));
    const progress = animation.elapsed / animation.duration;
    const settle = 1 - Math.pow(1 - progress, 3.4);

    for (const entry of animation.dice) {
      const die = entry.die;
      die.prop.group.quaternion.copy(entry.start).slerp(entry.target, settle);
      die.tumble.quaternion.setFromAxisAngle(
        entry.spinAxis,
        TAU * entry.spinTurns * Math.pow(1 - settle, 1.08),
      );
      die.anchor.position.y = die.baseY +
        Math.sin(progress * Math.PI) * entry.lift * (1 - progress * 0.2);
      die.anchor.position.x = entry.baseX +
        Math.sin(progress * Math.PI * 2 + die.index * 0.8) * 0.075 * (1 - progress);
      die.anchor.position.z = entry.baseZ +
        Math.cos(progress * Math.PI * 2 + die.index) * 0.055 * (1 - progress);
    }

    if (progress < 1) return null;

    for (const entry of animation.dice) {
      entry.die.prop.group.quaternion.copy(entry.target);
      entry.die.tumble.quaternion.identity();
      entry.die.anchor.position.set(entry.baseX, entry.die.baseY, entry.baseZ);
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

  function zoomBy(factor) {
    const min = requiredZoom(currentAspect);
    stage.view.aim.zoom = Math.max(min, Math.min(3.8, stage.view.aim.zoom * factor));
    return stage.view.aim.zoom;
  }

  function keepFramed() {
    stage.view.aim.zoom = Math.max(stage.view.aim.zoom, requiredZoom(currentAspect));
  }

  function resetView() {
    stage.view.reset();
    stage.view.aim.zoom = requiredZoom(currentAspect);
  }

  applyLayout(currentAspect, { resetZoom: true });
  buildDice();
  stage.target.set(0, TARGET_Y, 0);

  return {
    roll,
    update,
    setAppearance,
    setLayout: (aspect) => applyLayout(aspect),
    zoomBy,
    keepFramed,
    resetView,
    requiredZoom,
    inspect: () => dice.map(topFaceOf),
    isRolling: () => Boolean(animation),
    get dice() { return dice; },
  };
}