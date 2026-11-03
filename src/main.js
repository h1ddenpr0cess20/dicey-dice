import { createAudio } from 'madness-engine/audio';
import { createStage } from 'madness-engine/stage';
import { defineView } from 'madness-engine/view';
import './style.css';
import {
  applyPreset as applyDicePreset,
  applyRoll,
  clearTray,
  createTrayState,
  DICE_CATALOG,
  diceToRoll,
  formatDieValue,
  getDiceCounts,
  setAllHeld,
  setDiceCount,
  setDieHeld,
} from './sim.js';
import { createDiceWorld } from './world.js';

const $ = (id) => document.getElementById(id);
const host = $('game');
const loading = $('loading');
const { createView } = defineView({
  home: { yaw: 0.04, pitch: 0.72, zoom: 1 },
  limits: { pitch: [0.28, 1.38], zoom: [0.4, 4.2] },
});
const COLORS_DEFAULT = { resin: '#b8d8d0', ink: '#182a35' };

let state = createTrayState();
let world = null;
let stage = null;
let audio = null;
let isRolling = false;
let toastTimer = null;
let lastResultText = '';

function announce(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 1900);
}

function setStatus(message) {
  $('result-total').textContent = message;
}

function currentColors() {
  return { resin: $('resin-color').value, ink: $('ink-color').value };
}

function renderCountControls() {
  const counts = getDiceCounts(state.dice);
  const root = $('dice-controls');
  root.replaceChildren();
  for (const entry of DICE_CATALOG) {
    const card = document.createElement('div');
    card.className = 'dice-type';
    const label = document.createElement('span');
    label.className = 'dice-type-label';
    label.textContent = entry.label;
    const stepper = document.createElement('div');
    stepper.className = 'stepper';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.setAttribute('aria-label', 'Remove one ' + entry.label);
    minus.disabled = isRolling || counts[entry.id] === 0;
    minus.dataset.changeType = entry.id;
    minus.dataset.changeBy = '-1';
    const count = document.createElement('b');
    count.textContent = String(counts[entry.id]);
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.setAttribute('aria-label', 'Add one ' + entry.label);
    plus.disabled = isRolling || state.dice.length >= 24 || counts[entry.id] >= 12;
    plus.dataset.changeType = entry.id;
    plus.dataset.changeBy = '1';
    stepper.append(minus, count, plus);
    card.append(label, stepper);
    root.append(card);
  }
}

function renderHistory() {
  const root = $('history-list');
  root.replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement('span');
    empty.className = 'history-empty';
    empty.textContent = 'Nothing rolled yet.';
    root.append(empty);
    return;
  }
  for (const roll of state.history) {
    const item = document.createElement('span');
    item.className = 'history-item';
    const number = document.createElement('b');
    number.textContent = '#' + roll.number;
    const text = document.createElement('span');
    text.textContent = roll.dice.map((die) =>
      DICE_CATALOG.find((entry) => entry.id === die.type).label.replace(' PIPS', '') +
      ' ' + formatDieValue(die.type, die.value) + (die.held ? '•' : ''),
    ).join('  /  ');
    item.append(number, text);
    root.append(item);
  }
}

function renderResults() {
  const root = $('result-dice');
  root.replaceChildren();
  const rolled = state.dice.filter((die) => die.value !== null);
  if (!rolled.length) {
    const empty = document.createElement('span');
    empty.className = 'empty-results';
    empty.textContent = state.dice.length ? 'Roll the tray to see your results. Keep dice to save them for the next throw.' : 'Add dice to your tray to get started.';
    root.append(empty);
    $('copy-results').disabled = true;
    lastResultText = '';
    return;
  }

  for (const die of state.dice) {
    const chip = document.createElement('div');
    chip.className = 'result-chip' + (die.held ? ' is-held' : '');
    const type = document.createElement('small');
    type.textContent = DICE_CATALOG.find((entry) => entry.id === die.type).label;
    const value = document.createElement('b');
    value.textContent = formatDieValue(die.type, die.value);
    const keep = document.createElement('button');
    keep.type = 'button';
    keep.className = 'keep-button';
    keep.textContent = die.held ? 'KEPT ✓' : 'KEEP';
    keep.disabled = isRolling || die.value === null;
    keep.setAttribute('aria-pressed', String(die.held));
    keep.setAttribute('aria-label', (die.held ? 'Release ' : 'Keep ') + type.textContent + ' ' + value.textContent);
    keep.addEventListener('click', () => toggleHeld(die.id));
    chip.append(type, value, keep);
    root.append(chip);
  }

  const total = rolled.reduce((sum, die) => sum + Number(die.value), 0);
  $('copy-results').disabled = false;
  $('result-total').textContent = rolled.length + ' dice · total ' + total;
  lastResultText = rolled.map((die) => {
    const label = DICE_CATALOG.find((entry) => entry.id === die.type).label;
    return label + ': ' + formatDieValue(die.type, die.value) + (die.held ? ' (kept)' : '');
  }).join(' | ') + ' | Total: ' + total;
}

function render() {
  const totalDice = state.dice.length;
  const unheld = diceToRoll(state).length;
  $('dice-count').textContent = String(totalDice).padStart(2, '0');
  $('pool-summary').textContent = totalDice + (totalDice === 1 ? ' die selected' : ' dice selected');
  $('roll-count').textContent = String(unheld).padStart(2, '0');
  $('roll-button').disabled = isRolling || unheld === 0;
  $('roll-all').disabled = isRolling || totalDice === 0;
  $('release-all').disabled = isRolling || !state.dice.some((die) => die.held);
  $('clear-pool').disabled = isRolling || totalDice === 0;
  $('roll-button').querySelector('b').textContent = isRolling ? 'ROLLING…' : 'ROLL UNHELD';
  $('roll-caption').textContent = unheld === totalDice ? 'Roll the whole tray' : unheld === 0 ? 'All dice are kept' : unheld + ' dice will roll · ' + (totalDice - unheld) + ' kept';
  $('roll-button').classList.toggle('is-rolling', isRolling);
  for (const button of $('preset-buttons').querySelectorAll('button')) button.disabled = isRolling;
  renderCountControls();
  renderResults();
  renderHistory();
}

function syncWorld() {
  if (!world || isRolling) return;
  world.setDice(state.dice, currentColors());
}

function toggleHeld(id) {
  if (isRolling) return;
  const die = state.dice.find((entry) => entry.id === id);
  if (!die || die.value === null) return;
  state = setDieHeld(state, id, !die.held);
  world?.setHeld(id, !die.held);
  render();
}

function changeCount(type, delta) {
  if (isRolling) return;
  state = setDiceCount(state, type, (getDiceCounts(state.dice)[type] ?? 0) + delta);
  syncWorld();
  render();
}

function startRoll(mode = 'unheld') {
  if (!world || isRolling) return;
  const ids = diceToRoll(state, mode);
  if (!ids.length) {
    announce('All dice are kept. Release some dice before rolling.');
    return;
  }
  if (!world.roll(ids)) return;
  isRolling = true;
  audio?.wake();
  setStatus('Dice tumbling…');
  render();
}

function rollAll() {
  if (isRolling || !state.dice.length) return;
  state = setAllHeld(state, false);
  for (const die of state.dice) world?.setHeld(die.id, false);
  startRoll('all');
}

function onThrowFinished(results) {
  isRolling = false;
  state = applyRoll(state, results);
  const count = results.length;
  const total = results.reduce((sum, entry) => sum + Number(entry.value), 0);
  setStatus(count + (count === 1 ? ' die rolled' : ' dice rolled') + ' · ' + total + ' points showing');
  audio?.tone?.({ freq: 340, to: 630, length: 0.19, gain: 0.13 });
  announce('Roll ' + state.rollCount + ' complete.');
  render();
}

function applyPreset(id) {
  if (isRolling) return;
  state = applyPresetState(id);
  syncWorld();
  render();
  announce('Dice set: ' + id.toUpperCase());
}

function applyPresetState(id) {
  return applyDicePreset(state, id);
}

function setColors(resin, ink) {
  if (isRolling) return;
  $('resin-color').value = resin;
  $('ink-color').value = ink;
  for (const button of document.querySelectorAll('.swatch')) {
    button.classList.toggle('selected', button.dataset.resin === resin && button.dataset.ink === ink);
  }
  syncWorld();
  render();
  announce('Dice finish updated.');
}

function installOrbitControls() {
  const pointers = new Map();
  let pinchDistance = 0;
  let previousSingle = null;

  const onUI = (target) => Boolean(
    target instanceof Element && target.closest('button,input,label,a,.control-dock,.result-shelf,.topbar'),
  );

  host.addEventListener('pointerdown', (event) => {
    if (onUI(event.target) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    host.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) previousSingle = { x: event.clientX, y: event.clientY };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      previousSingle = null;
    }
    host.classList.add('dragging');
  });

  host.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !stage) return;
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 0 && distance > 0) world.zoomBy(pinchDistance / distance);
      pinchDistance = distance;
      previousSingle = null;
      return;
    }
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    stage.view.turn(-dx * 0.006, dy * 0.0045);
    world.keepFramed();
    previousSingle = { x: event.clientX, y: event.clientY };
  });

  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
    previousSingle = pointers.size === 1 ? [...pointers.values()][0] : null;
    if (!pointers.size) host.classList.remove('dragging');
  };
  host.addEventListener('pointerup', endPointer);
  host.addEventListener('pointercancel', endPointer);
  host.addEventListener('lostpointercapture', endPointer);

  host.addEventListener('wheel', (event) => {
    if (onUI(event.target)) return;
    event.preventDefault();
    world.zoomBy(Math.exp(event.deltaY * 0.001));
  }, { passive: false });

  host.addEventListener('dblclick', (event) => {
    if (!onUI(event.target)) world.resetView();
  });
}

async function boot() {
  try {
    stage = await createStage(host, {
      view: createView(),
      backdrop: '#101814',
      label: 'dicey-virtual-tray',
      lens: { distance: 11, fov: 35 },
      shadows: true,
      shadowSize: 1536,
      lights: {
        hemisphere: { sky: '#dce9df', ground: '#18251e', intensity: 1.0 },
        key: { color: '#fff0d9', intensity: 2.55 },
        fill: { color: '#81c8b0', intensity: 0.62, offset: [5, 5, -4] },
      },
    });
    world = createDiceWorld(stage, COLORS_DEFAULT);
    world.setDice(state.dice, COLORS_DEFAULT);
    audio = createAudio({ storageKey: 'dicey.muted', glue: true });

    $('dice-controls').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-change-type]');
      if (button && !button.disabled) changeCount(button.dataset.changeType, Number(button.dataset.changeBy));
    });
    $('preset-buttons').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-preset]');
      if (button && !button.disabled) applyPreset(button.dataset.preset);
    });
    $('clear-pool').addEventListener('click', () => {
      if (isRolling) return;
      state = clearTray(state);
      syncWorld();
      render();
    });
    $('roll-button').addEventListener('click', () => startRoll('unheld'));
    $('roll-all').addEventListener('click', rollAll);
    $('release-all').addEventListener('click', () => {
      state = setAllHeld(state, false);
      for (const die of state.dice) world.setHeld(die.id, false);
      render();
    });
    $('copy-results').addEventListener('click', async () => {
      if (!lastResultText) return;
      try {
        await navigator.clipboard.writeText(lastResultText);
        announce('Results copied.');
      } catch {
        announce('Clipboard access is unavailable in this browser.');
      }
    });
    $('resin-color').addEventListener('change', () => setColors($('resin-color').value, $('ink-color').value));
    $('ink-color').addEventListener('change', () => setColors($('resin-color').value, $('ink-color').value));
    document.querySelectorAll('.swatch').forEach((button) => {
      button.addEventListener('click', () => setColors(button.dataset.resin, button.dataset.ink));
    });

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('button,input,select,textarea')) return;
      event.preventDefault();
      startRoll('unheld');
    });

    installOrbitControls();
    const resizeObserver = new ResizeObserver(() => {
      world.setLayout(host.clientWidth / Math.max(1, host.clientHeight));
    });
    resizeObserver.observe(host);

    stage.run((dt) => {
      stage.view.step(dt);
      const results = world.update(dt);
      if (results) onThrowFinished(results);
    });

    loading.classList.add('loaded');
    window.setTimeout(() => loading.remove(), 420);
    render();
    setStatus('Ready to roll');
  } catch (error) {
    console.error('Dicey failed to start:', error);
    loading.innerHTML = '<b>THE TRAY DID NOT LOAD</b><small>' + String(error?.message ?? error) + '</small>';
  }
}

boot();
