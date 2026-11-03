import { createAudio } from 'madness-engine/audio';
import { createStage } from 'madness-engine/stage';
import { defineView } from 'madness-engine/view';
import './style.css';
import {
  applyPreset as applyDicePreset,
  applyRoll,
  applySavedPreset, createSavedPreset, normalizeSavedPresets, MAX_SAVED_PRESETS,
  createSavedColorCombo, normalizeSavedColorCombos, MAX_SAVED_COLOR_COMBOS,
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
  limits: { pitch: [0.28, 1.38], zoom: [0.4, 8] },
});
const COLORS_DEFAULT = { resin: '#b8d8d0', ink: '#182a35' };

let state = createTrayState();
let world = null;
let stage = null;
let audio = null;
let isRolling = false;
let toastTimer = null;

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

function currentColors() { return { resin: $('resin-color').value, ink: $('ink-color').value }; }
const STORAGE_KEY = 'dicey.saved-presets.v1';
let savedPresets = [];
const COLOR_COMBO_STORAGE_KEY = 'dicey.saved-color-combos.v1';
let savedColorCombos = [];
let colorComboSequence = 0;
function loadSavedColorCombos() {
  try {
    savedColorCombos = normalizeSavedColorCombos(JSON.parse(localStorage.getItem(COLOR_COMBO_STORAGE_KEY) || '[]'));
  } catch {
    savedColorCombos = [];
  }
}
function persistSavedColorCombos() {
  try {
    localStorage.setItem(COLOR_COMBO_STORAGE_KEY, JSON.stringify(savedColorCombos));
    return true;
  } catch {
    return false;
  }
}
function renderSavedColorCombos() {
  const root = $('saved-color-combos');
  root.replaceChildren();
  const colors = currentColors();

  for (const combo of savedColorCombos) {
    const item = document.createElement('span');
    item.className = 'saved-color-combo';

    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'swatch saved-color-combo-load';
    apply.dataset.loadColorCombo = combo.id;
    apply.dataset.resin = combo.resin;
    apply.dataset.ink = combo.ink;
    apply.style.setProperty('--combo-resin', combo.resin);
    apply.style.setProperty('--combo-ink', combo.ink);
    apply.classList.toggle('selected', colors.resin === combo.resin && colors.ink === combo.ink);
    apply.disabled = isRolling;
    apply.title = combo.name;
    apply.setAttribute('aria-label', 'Apply ' + combo.name + ' color combination');

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'saved-color-combo-remove';
    remove.dataset.removeColorCombo = combo.id;
    remove.textContent = '×';
    remove.disabled = isRolling;
    remove.title = 'Delete ' + combo.name;
    remove.setAttribute('aria-label', 'Delete ' + combo.name + ' color combination');

    item.append(apply, remove);
    root.append(item);
  }
  $('save-color-combo').disabled = isRolling || savedColorCombos.length >= MAX_SAVED_COLOR_COMBOS;
}
function saveCurrentColorCombo() {
  const input = $('save-color-combo-name');
  const name = input.value.trim();
  if (!name) {
    input.setCustomValidity('Enter a color combination name.');
    input.reportValidity();
    return;
  }
  if (savedColorCombos.some((combo) => combo.name.toLowerCase() === name.toLowerCase())) {
    input.setCustomValidity('That color combination name already exists.');
    input.reportValidity();
    return;
  }
  if (savedColorCombos.length >= MAX_SAVED_COLOR_COMBOS) {
    announce('Maximum of ' + MAX_SAVED_COLOR_COMBOS + ' saved color combinations.');
    return;
  }

  input.setCustomValidity('');
  const id = 'colors-' + Date.now().toString(36) + '-' + (++colorComboSequence).toString(36);
  const combo = createSavedColorCombo(name, currentColors(), id);
  savedColorCombos = [combo, ...savedColorCombos];
  const persisted = persistSavedColorCombos();
  renderSavedColorCombos();
  $('save-color-combo-dialog').close();
  input.value = '';
  announce(persisted
    ? 'Saved colors: ' + combo.name
    : 'Saved for this session only; browser storage is unavailable.');
}
function loadCustomColorCombo(id) {
  const combo = savedColorCombos.find((entry) => entry.id === id);
  if (!combo || isRolling) return;
  setColors(combo.resin, combo.ink);
  announce('Applied colors: ' + combo.name);
}
function deleteCustomColorCombo(id) {
  if (isRolling) return;
  savedColorCombos = savedColorCombos.filter((combo) => combo.id !== id);
  const persisted = persistSavedColorCombos();
  renderSavedColorCombos();
  if (!persisted) announce('Deleted for this session only; browser storage is unavailable.');
}
function loadSavedPresets() { try { savedPresets = normalizeSavedPresets(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')); } catch { savedPresets=[]; } }
function persistSavedPresets() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(savedPresets)); } catch { announce('Browser storage is unavailable.'); } }
function renderSavedPresets() {
 const root=$('saved-preset-buttons'); root.replaceChildren();
 for(const p of savedPresets) {
  const wrap=document.createElement('span'); wrap.className='saved-preset-item';
  const load=document.createElement('button'); load.type='button'; load.className='saved-preset-load'; load.dataset.loadPreset=p.id; load.textContent=p.name; load.disabled=isRolling;
  const del=document.createElement('button'); del.type='button'; del.className='saved-preset-remove'; del.dataset.removePreset=p.id; del.textContent='×'; del.setAttribute('aria-label','Delete '+p.name); del.disabled=isRolling;
  wrap.append(load,del); root.append(wrap);
 }
}
function saveCurrentPreset() {
 const input=$('save-preset-name'), name=input.value.trim();
 if(!name){input.setCustomValidity('Enter a preset name.');input.reportValidity();return;}
 if(savedPresets.some(p=>p.name.toLowerCase()===name.toLowerCase())){input.setCustomValidity('That preset name already exists.');input.reportValidity();return;}
 if(savedPresets.length>=MAX_SAVED_PRESETS){announce('Maximum of '+MAX_SAVED_PRESETS+' saved presets.');return;}
 input.setCustomValidity('');
 const p=createSavedPreset(name,state,currentColors(),'custom-'+Date.now().toString(36));
 savedPresets=[p,...savedPresets];persistSavedPresets();renderSavedPresets();$('save-preset-dialog').close();input.value='';announce('Saved '+p.name);
}
function loadCustomPreset(id) {
 const p=savedPresets.find(x=>x.id===id);if(!p||isRolling)return;
 state=applySavedPreset(state,p);$('resin-color').value=p.resin;$('ink-color').value=p.ink;
 document.querySelectorAll('.swatch').forEach(b=>b.classList.toggle('selected',b.dataset.resin===p.resin&&b.dataset.ink===p.ink));
 syncWorld();render();announce('Loaded '+p.name);
}
function deleteCustomPreset(id) { savedPresets=savedPresets.filter(p=>p.id!==id);persistSavedPresets();renderSavedPresets(); }

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
  $('result-total').textContent = rolled.length + ' dice · total ' + total;
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
  renderSavedPresets();
  renderSavedColorCombos();
  $('save-preset').disabled=isRolling||totalDice===0||savedPresets.length>=MAX_SAVED_PRESETS;
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
    loadSavedPresets();
    loadSavedColorCombos();
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
      const b=event.target.closest('button[data-preset]');const l=event.target.closest('[data-load-preset]');const d=event.target.closest('[data-remove-preset]');
      if(b&&!b.disabled)applyPreset(b.dataset.preset);else if(l&&!l.disabled)loadCustomPreset(l.dataset.loadPreset);else if(d&&!d.disabled)deleteCustomPreset(d.dataset.removePreset);
    });
    $('save-preset').addEventListener('click',()=>{if(isRolling||!state.dice.length)return;$('save-preset-name').value='';$('save-preset-name').setCustomValidity('');$('save-preset-dialog').showModal();$('save-preset-name').focus();});
    $('confirm-save-preset').addEventListener('click',saveCurrentPreset);
    $('save-preset-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveCurrentPreset();}});
    $('saved-color-combos').addEventListener('click', (event) => {
      const apply = event.target.closest('button[data-load-color-combo]');
      const remove = event.target.closest('button[data-remove-color-combo]');
      if (apply && !apply.disabled) loadCustomColorCombo(apply.dataset.loadColorCombo);
      else if (remove && !remove.disabled) deleteCustomColorCombo(remove.dataset.removeColorCombo);
    });
    $('save-color-combo').addEventListener('click', () => {
      if (isRolling || savedColorCombos.length >= MAX_SAVED_COLOR_COMBOS) return;
      const input = $('save-color-combo-name');
      input.value = '';
      input.setCustomValidity('');
      $('save-color-combo-dialog').showModal();
      input.focus();
    });
    $('confirm-save-color-combo').addEventListener('click', saveCurrentColorCombo);
    $('save-color-combo-name').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveCurrentColorCombo();
      }
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
    const dock=$('control-dock');const syncDock=()=>document.documentElement.style.setProperty('--dock-height',Math.ceil(dock.getBoundingClientRect().height)+'px');const dockObserver=new ResizeObserver(syncDock);dockObserver.observe(dock);window.addEventListener('resize',syncDock,{passive:true});syncDock();

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
