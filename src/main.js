import { createAudio } from 'madness-engine/audio';
import { createStage } from 'madness-engine/stage';
import { defineView } from 'madness-engine/view';
import './style.css';
import { bankPoints, createGameState, resolveRoll } from './sim.js';
import { createDiceWorld } from './world.js';

const $ = (id) => document.getElementById(id);
const host = $('game');
const loading = $('loading');
const { createView } = defineView({
  home: { yaw: 0.04, pitch: 0.72, zoom: 1 },
  limits: { pitch: [0.28, 1.38], zoom: [0.45, 3.8] },
});

let state = createGameState();
let world = null;
let stage = null;
let audio = null;
let isRolling = false;
let dieType = 'd6';
let toastTimer = null;

function announce(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 1800);
}

function setStatus(message) {
  $('throw-status').textContent = message;
}

function renderReadings(values = null) {
  const container = $('die-readings');
  container.replaceChildren();
  for (let index = 0; index < 5; index++) {
    const chip = document.createElement('span');
    chip.className = 'reading' + (values?.[index] === 1 ? ' bust' : '');
    const label = document.createElement('small');
    label.textContent = String(index + 1).padStart(2, '0');
    const value = document.createElement('b');
    value.textContent = values ? String(values[index]) : '—';
    chip.append(label, value);
    container.append(chip);
  }
}

function render() {
  $('banked-score').textContent = String(state.bankedScore).padStart(3, '0');
  $('turn-score').textContent = String(state.turnScore).padStart(3, '0');
  $('roll-button').disabled = isRolling || state.won;
  $('bank-button').disabled = isRolling || state.turnScore <= 0 || state.won;
  $('number-style').disabled = isRolling;
  $('pip-style').disabled = isRolling;
  $('resin-color').disabled = isRolling;
  $('ink-color').disabled = isRolling;
  $('roll-button').classList.toggle('rolling', isRolling);
}

function syncStyleButtons() {
  const numbered = dieType === 'd6';
  $('number-style').classList.toggle('selected', numbered);
  $('number-style').setAttribute('aria-pressed', String(numbered));
  $('pip-style').classList.toggle('selected', !numbered);
  $('pip-style').setAttribute('aria-pressed', String(!numbered));
}

function changeAppearance() {
  if (isRolling || !world) return;
  const colors = { resin: $('resin-color').value, ink: $('ink-color').value };
  if (!world.setAppearance(dieType, colors)) return;
  syncStyleButtons();
  renderReadings();
  setStatus(dieType === 'd6' ? 'Numbered D6 props ready.' : 'Pip-marked D6 props ready.');
  announce('Five dice rebuilt with the selected finish.');
}

function startRoll() {
  if (!world || isRolling || state.won || !world.roll()) return;
  isRolling = true;
  audio?.wake();
  setStatus('Rolling. Reading each settled upper face…');
  render();
}

function bankTurn() {
  if (isRolling || state.turnScore <= 0 || state.won) return;
  state = bankPoints(state);
  if (state.won) {
    setStatus('A century. You called it perfectly.');
    announce('100 points banked. Five Alive!');
    audio?.jingle?.([72, 76, 79, 84], { length: 0.18, gain: 0.18 });
  } else {
    setStatus('Points locked. The next throw is yours.');
    announce('Points banked safely.');
    audio?.tone?.({ freq: 540, to: 760, length: 0.16, gain: 0.13 });
  }
  render();
}

function newGame() {
  if (isRolling) return;
  state = createGameState();
  renderReadings();
  setStatus('Fresh table. Five dice. Your move.');
  render();
  announce('New game started.');
}

function finishThrow(values) {
  isRolling = false;
  const atRisk = state.turnScore;
  state = resolveRoll(state, values);
  renderReadings(values);

  if (state.lastOutcome === 'bust') {
    setStatus(atRisk > 0
      ? 'BUST — a one wiped out ' + atRisk + ' unbanked points.'
      : 'BUST — a one. No points this turn.');
    audio?.burst?.({ length: 0.24, freq: 190, sweep: 68, gain: 0.28 });
    announce('A one. Turn score lost.');
  } else {
    setStatus('Safe throw — ' + state.lastRollTotal + ' added. Bank it or risk another roll.');
    audio?.tone?.({ freq: 330, to: 620, length: 0.2, gain: 0.14 });
  }
  render();
}

function installOrbitControls() {
  const activePointers = new Map();
  let lastPinchDistance = 0;
  let lastSinglePointer = null;

  const isUiTarget = (target) => Boolean(
    target instanceof Element && target.closest('button, input, label, a, .scoreboard, .topbar'),
  );

  host.addEventListener('pointerdown', (event) => {
    if (isUiTarget(event.target)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    host.setPointerCapture?.(event.pointerId);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size === 1) {
      lastSinglePointer = { x: event.clientX, y: event.clientY };
    } else if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      lastPinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      lastSinglePointer = null;
    }
    host.classList.add('dragging');
  });

  host.addEventListener('pointermove', (event) => {
    if (!activePointers.has(event.pointerId) || !stage || !world) return;
    event.preventDefault();
    const previous = activePointers.get(event.pointerId);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size >= 2) {
      const [a, b] = [...activePointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinchDistance > 0 && distance > 0) {
        world.zoomBy(lastPinchDistance / distance);
      }
      lastPinchDistance = distance;
      lastSinglePointer = null;
      return;
    }

    if (lastSinglePointer) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      stage.view.turn(-dx * 0.006, dy * 0.0045);
      world.keepFramed();
    }
    lastSinglePointer = { x: event.clientX, y: event.clientY };
  });

  const endPointer = (event) => {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) lastPinchDistance = 0;
    lastSinglePointer = activePointers.size === 1
      ? [...activePointers.values()][0]
      : null;
    if (activePointers.size === 0) host.classList.remove('dragging');
  };
  host.addEventListener('pointerup', endPointer);
  host.addEventListener('pointercancel', endPointer);
  host.addEventListener('lostpointercapture', endPointer);

  host.addEventListener('wheel', (event) => {
    if (!world || isUiTarget(event.target)) return;
    event.preventDefault();
    world.zoomBy(Math.exp(event.deltaY * 0.001));
  }, { passive: false });

  host.addEventListener('dblclick', (event) => {
    if (!world || isUiTarget(event.target)) return;
    event.preventDefault();
    world.resetView();
  });
}

async function boot() {
  try {
    stage = await createStage(host, {
      view: createView(),
      backdrop: '#101814',
      label: 'dicey-five-alive',
      lens: { distance: 11, fov: 35 },
      shadows: true,
      shadowSize: 1536,
      lights: {
        hemisphere: { sky: '#dce9df', ground: '#18251e', intensity: 1.0 },
        key: { color: '#fff0d9', intensity: 2.55 },
        fill: { color: '#81c8b0', intensity: 0.62, offset: [5, 5, -4] },
      },
    });

    world = createDiceWorld(stage, dieType, {
      resin: $('resin-color').value,
      ink: $('ink-color').value,
    });
    world.setLayout(host.clientWidth / Math.max(1, host.clientHeight));
    audio = createAudio({ storageKey: 'dicey.muted', glue: true });

    $('roll-button').addEventListener('click', startRoll);
    $('bank-button').addEventListener('click', bankTurn);
    $('new-game-button').addEventListener('click', newGame);
    $('number-style').addEventListener('click', () => {
      if (isRolling || dieType === 'd6') return;
      dieType = 'd6';
      changeAppearance();
    });
    $('pip-style').addEventListener('click', () => {
      if (isRolling || dieType === 'd6-pips') return;
      dieType = 'd6-pips';
      changeAppearance();
    });
    $('resin-color').addEventListener('change', changeAppearance);
    $('ink-color').addEventListener('change', changeAppearance);

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('button, input, select, textarea')) return;
      event.preventDefault();
      startRoll();
    });

    installOrbitControls();
    const resizeObserver = new ResizeObserver(() => {
      world.setLayout(host.clientWidth / Math.max(1, host.clientHeight));
    });
    resizeObserver.observe(host);

    stage.run((dt) => {
      stage.view.step(dt);
      const values = world.update(dt);
      if (values) finishThrow(values);
    });

    loading.classList.add('loaded');
    window.setTimeout(() => loading.remove(), 420);
    render();
    setStatus('Drag the table to orbit. Roll when ready.');
  } catch (error) {
    console.error('Dicey could not start:', error);
    loading.innerHTML = '<b>THE TABLE DID NOT LOAD</b><small>' +
      String(error?.message ?? error) + '</small>';
  }
}

boot();