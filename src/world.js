import * as GFX from 'madness-engine/gfx';
import { createDieProp } from 'madness-engine/props/dice';

const TABLE_TOP = 0.31;
const DIE_BASE_Y = TABLE_TOP + 0.56;
const DIE_SCALE = 0.83;
const DIE_SPACING = 1.52;
const DIE_RADIUS = 0.92;
const CAMERA_DISTANCE = 11;
const CAMERA_FOV = 35;
const TARGET_Y = 0.85;
const UP = new GFX.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

function mat(color, roughness = 0.5, metalness = 0) {
  return new GFX.MeshStandardMaterial({ color: new GFX.Color(color), roughness, metalness });
}

function addBox(parent, width, height, depth, position, material, name) {
  const mesh = new GFX.Mesh(new GFX.BoxGeometry(width, height, depth), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
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

function layoutFor(count, aspect) {
  if (count === 0) return { positions: [], columns: 1, rows: 1 };
  const columns = Math.min(count, aspect < 0.78 ? 3 : aspect < 1.05 ? 4 : aspect < 1.42 ? 5 : 6);
  const rows = Math.ceil(count / columns);
  const positions = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowCount = Math.min(columns, count - row * columns);
    return [
      (column - (rowCount - 1) / 2) * DIE_SPACING,
      (row - (rows - 1) / 2) * DIE_SPACING,
    ];
  });
  return { positions, columns, rows };
}

function createTable(scene, columns, rows) {
  const halfWidth = Math.max(3.9, (columns * DIE_SPACING) / 2 + 0.9);
  const halfDepth = Math.max(2.8, (rows * DIE_SPACING) / 2 + 0.9);
  const width = halfWidth * 2;
  const depth = halfDepth * 2;
  const group = new GFX.Group();
  group.name = 'dice_tray_table';

  addBox(group, width + 0.24, 0.4, depth + 0.24, [0, -0.01, 0], mat('#241e17', 0.34, 0.24), 'walnut_table_base');
  addBox(group, width + 0.04, 0.1, depth + 0.04, [0, 0.225, 0], mat('#17241d', 0.32, 0.16), 'dark_table_inlay');
  addBox(group, width - 0.12, 0.035, depth - 0.12, [0, 0.294, 0], mat('#244637', 0.76, 0.02), 'green_felt');

  const brass = mat('#b48c51', 0.3, 0.68);
  addBox(group, width - 0.02, 0.035, 0.045, [0, 0.319, -halfDepth + 0.05], brass, 'rear_brass_rail');
  addBox(group, width - 0.02, 0.035, 0.045, [0, 0.319, halfDepth - 0.05], brass, 'front_brass_rail');
  addBox(group, 0.045, 0.035, depth - 0.02, [-halfWidth + 0.05, 0.319, 0], brass, 'left_brass_rail');
  addBox(group, 0.045, 0.035, depth - 0.02, [halfWidth - 0.05, 0.319, 0], brass, 'right_brass_rail');

  const under = mat('#171812', 0.42, 0.25);
  addBox(group, width - 1, 0.18, 0.25, [0, -0.31, -halfDepth + 0.2], under, 'rear_apron');
  addBox(group, width - 1, 0.18, 0.25, [0, -0.31, halfDepth - 0.2], under, 'front_apron');
  scene.add(group);

  const floor = scene.getObjectByName('dice_studio_floor');
  if (!floor) {
    const ground = new GFX.Mesh(new GFX.PlaneGeometry(200, 200), mat('#101711', 0.96));
    ground.name = 'dice_studio_floor';
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.29;
    ground.receiveShadow = true;
    scene.add(ground);
  }
  return { group, halfWidth, halfDepth };
}

function orientationForValue(prop, value, index) {
  let face = value === null || value === undefined
    ? prop.faces[index % prop.faces.length]
    : prop.faces.find((entry) => String(entry.number) === String(value));
  face ??= prop.faces[0];
  const align = new GFX.Quaternion().setFromUnitVectors(face.normal.clone().normalize(), UP);
  const yaw = new GFX.Quaternion().setFromAxisAngle(UP, index * 0.63 + 0.3);
  return yaw.multiply(align);
}

function createDieSlot(scene, spec, index, position, colors) {
  const anchor = new GFX.Group();
  anchor.name = 'die_' + spec.id;
  anchor.position.set(position[0], DIE_BASE_Y, position[1]);
  scene.add(anchor);

  const tumble = new GFX.Group();
  tumble.name = 'die_tumble_' + spec.id;
  anchor.add(tumble);

  const prop = createDieProp(GFX, spec.type, {
    color: colors.resin,
    markingColor: colors.ink,
  });
  prop.group.scale.setScalar(DIE_SCALE);
  prop.group.quaternion.copy(orientationForValue(prop, spec.value, index));
  tumble.add(prop.group);

  const ringMaterial = mat(spec.held ? '#d4ad70' : '#80ad96', 0.4, 0.25);
  ringMaterial.transparent = true;
  ringMaterial.opacity = spec.held ? 0.9 : 0.32;
  const ring = new GFX.Mesh(new GFX.TorusGeometry(0.55, 0.012, 8, 48), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.48;
  ring.name = 'hold_ring_' + spec.id;
  anchor.add(ring);

  return {
    id: spec.id,
    index,
    type: spec.type,
    anchor,
    tumble,
    prop,
    ring,
    held: Boolean(spec.held),
    value: spec.value ?? null,
    baseY: DIE_BASE_Y,
    baseX: position[0],
    baseZ: position[1],
  };
}

function topFaceOf(die) {
  let highest = null;
  for (const face of die.prop.faces) {
    const normal = face.normal.clone()
      .applyQuaternion(die.prop.group.quaternion)
      .applyQuaternion(die.tumble.quaternion)
      .normalize();
    if (!highest || normal.y > highest.height) {
      highest = { height: normal.y, value: face.number };
    }
  }
  if (!highest || highest.height < 0.999) {
    throw new Error(die.type.toUpperCase() + ' did not settle on a readable upper face.');
  }
  return highest.value;
}

function randomUnitVector(random) {
  const z = random() * 2 - 1;
  const angle = random() * TAU;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return new GFX.Vector3(radius * Math.cos(angle), z, radius * Math.sin(angle)).normalize();
}

export function createDiceWorld(
  stage,
  initialColors = { resin: '#b8d8d0', ink: '#182a35' },
) {
  const { scene } = stage;
  stage.target.set(0, TARGET_Y, 0);
  let colors = { ...initialColors };
  let dice = [];
  let table = null;
  let positions = [];
  let columns = 1;
  let rows = 1;
  let aspect = 1.6;
  let animation = null;

  const hemiFill = new GFX.PointLight(new GFX.Color('#bad7c5'), 6.2, 16, 1.45);
  hemiFill.position.set(-1.5, 5.6, 2.1);
  scene.add(hemiFill);

  function requiredZoom(nextAspect = aspect) {
    const yaw = stage.view.aim.yaw;
    const pitch = stage.view.aim.pitch;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    const screenRight = (x, z) => x * cy - z * sy;
    const screenUp = (x, y, z) => -x * sy * sp + y * cp - z * cy * sp;
    let halfWidth = table?.halfWidth ?? 4;
    let halfHeight = table?.halfDepth ?? 3;
    for (const die of dice) {
      halfWidth = Math.max(halfWidth, Math.abs(screenRight(die.baseX, die.baseZ)) + DIE_RADIUS);
      halfHeight = Math.max(halfHeight, Math.abs(screenUp(die.baseX, DIE_BASE_Y - TARGET_Y, die.baseZ)) + DIE_RADIUS);
    }
    const safeAspect = Math.max(0.25, nextAspect);
    const fov = CAMERA_FOV * Math.max(1, Math.min(1.75, 0.8 / safeAspect));
    const tangent = Math.tan((fov * Math.PI / 180) / 2);
    const distance = Math.max(halfWidth / (tangent * safeAspect), halfHeight / tangent) * 1.16;
    return Math.max(0.45, distance / CAMERA_DISTANCE);
  }

  function updateCamera({ reset = false } = {}) {
    const fit = requiredZoom();
    stage.view.aim.zoom = reset ? fit : Math.max(stage.view.aim.zoom, fit);
  }

  function layout(aspectValue = aspect) {
    aspect = Number.isFinite(aspectValue) && aspectValue > 0 ? aspectValue : 1.6;
    const next = layoutFor(dice.length, aspect);
    positions = next.positions;
    columns = next.columns;
    rows = next.rows;

    for (let index = 0; index < dice.length; index++) {
      const [x, z] = positions[index];
      const die = dice[index];
      die.baseX = x;
      die.baseZ = z;
      if (!animation) {
        die.anchor.position.set(x, die.baseY, z);
      } else {
        const entry = animation.dice.find((candidate) => candidate.die === die);
        if (entry) {
          entry.baseX = x;
          entry.baseZ = z;
        }
      }
    }

    if (table?.group) {
      table.group.removeFromParent();
      disposeGroup(table.group);
    }
    table = createTable(scene, Math.max(1, columns), Math.max(1, rows));
    for (let index = 0; index < dice.length; index++) {
      dice[index].ring.position.set(0, -0.48, 0);
    }
    updateCamera();
  }

  function setDice(specs, nextColors = colors) {
    if (animation) return false;
    colors = { ...nextColors };
    const old = new Map(dice.map((die) => [die.id, die]));
    for (const die of dice) {
      die.anchor.removeFromParent();
      disposeGroup(die.anchor);
    }
    dice = specs.map((spec, index) => {
      const previous = old.get(spec.id);
      const position = positions[index] ?? [0, 0];
      const carry = {
        ...spec,
        held: spec.held ?? previous?.held ?? false,
        value: spec.value ?? previous?.value ?? null,
      };
      return createDieSlot(scene, carry, index, position, colors);
    });
    layout(aspect);
    return true;
  }

  function roll(ids, random = Math.random) {
    if (animation || !Array.isArray(ids) || ids.length === 0) return false;
    const byId = new Map(dice.map((die) => [die.id, die]));
    const selected = ids.map((id) => byId.get(id));
    if (selected.some((die) => !die || die.held)) return false;

    animation = {
      elapsed: 0,
      duration: 1.2,
      dice: selected.map((die) => {
        const face = die.prop.faces[Math.min(die.prop.faces.length - 1, Math.floor(random() * die.prop.faces.length))];
        const align = new GFX.Quaternion().setFromUnitVectors(face.normal.clone().normalize(), UP);
        const yaw = new GFX.Quaternion().setFromAxisAngle(UP, random() * TAU);
        return {
          die,
          start: die.prop.group.quaternion.clone(),
          target: yaw.multiply(align),
          spinAxis: randomUnitVector(random),
          turns: 1.7 + random() * 1.5,
          lift: 0.35 + random() * 0.24,
          baseX: die.baseX,
          baseZ: die.baseZ,
        };
      }),
    };
    return true;
  }

  function update(dt) {
    if (!animation) return null;
    animation.elapsed = Math.min(animation.duration, animation.elapsed + Math.max(0, dt));
    const progress = animation.elapsed / animation.duration;
    const ease = 1 - Math.pow(1 - progress, 3.2);

    for (const entry of animation.dice) {
      const { die } = entry;
      die.prop.group.quaternion.copy(entry.start).slerp(entry.target, ease);
      die.tumble.quaternion.setFromAxisAngle(entry.spinAxis, TAU * entry.turns * Math.pow(1 - ease, 1.08));
      die.anchor.position.y = die.baseY + Math.sin(progress * Math.PI) * entry.lift * (1 - progress * 0.22);
      die.anchor.position.x = entry.baseX + Math.sin(progress * Math.PI * 2 + die.index * 0.8) * 0.07 * (1 - progress);
      die.anchor.position.z = entry.baseZ + Math.cos(progress * Math.PI * 2 + die.index) * 0.05 * (1 - progress);
    }
    if (progress < 1) return null;

    const results = [];
    for (const entry of animation.dice) {
      const die = entry.die;
      die.prop.group.quaternion.copy(entry.target);
      die.tumble.quaternion.identity();
      die.anchor.position.set(entry.baseX, die.baseY, entry.baseZ);
      die.value = topFaceOf(die);
      results.push({ id: die.id, value: die.value });
    }
    animation = null;
    return results;
  }

  function setHeld(id, held) {
    const die = dice.find((entry) => entry.id === id);
    if (!die) return false;
    die.held = Boolean(held);
    die.ring.material.color.set(die.held ? '#d4ad70' : '#80ad96');
    die.ring.material.opacity = die.held ? 0.9 : 0.32;
    return true;
  }

  function zoomBy(factor) {
    const minimum = requiredZoom();
    stage.view.aim.zoom = Math.max(minimum, Math.min(4.2, stage.view.aim.zoom * factor));
    return stage.view.aim.zoom;
  }

  function keepFramed() {
    updateCamera();
  }

  function resetView() {
    stage.view.reset();
    stage.view.aim.zoom = requiredZoom();
  }

  function inspect() {
    return dice.map((die) => ({ id: die.id, type: die.type, value: die.value, held: die.held }));
  }

  function dispose() {
    if (animation) animation = null;
    for (const die of dice) {
      die.anchor.removeFromParent();
      disposeGroup(die.anchor);
    }
    dice = [];
    table?.group?.removeFromParent();
    if (table?.group) disposeGroup(table.group);
    hemiFill.removeFromParent();
  }

  return {
    setDice,
    setLayout: layout,
    roll,
    update,
    setHeld,
    zoomBy,
    keepFramed,
    resetView,
    requiredZoom,
    inspect,
    dispose,
    isRolling: () => Boolean(animation),
    get dice() { return dice; },
  };
}
