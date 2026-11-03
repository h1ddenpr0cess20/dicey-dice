export const MAX_DICE = 24;
export const MAX_PER_TYPE = 12;

export const DICE_CATALOG = Object.freeze([
  { id: 'd4', label: 'D4', faces: [1, 2, 3, 4] },
  { id: 'd6', label: 'D6', faces: [1, 2, 3, 4, 5, 6] },
  { id: 'd6-pips', label: 'D6 PIPS', faces: [1, 2, 3, 4, 5, 6] },
  { id: 'd8', label: 'D8', faces: [1, 2, 3, 4, 5, 6, 7, 8] },
  { id: 'd10', label: 'D10', faces: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: 'd100', label: 'D%', faces: ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90'] },
  { id: 'd12', label: 'D12', faces: Array.from({ length: 12 }, (_, i) => i + 1) },
  { id: 'd20', label: 'D20', faces: Array.from({ length: 20 }, (_, i) => i + 1) },
]);

export const PRESETS = Object.freeze([
  { id: 'yahtzee', label: 'YAHTZEE', detail: '5 × D6', counts: { d6: 5 } },
  { id: 'farkle', label: 'FARKLE', detail: '6 × D6', counts: { d6: 6 } },
  { id: 'craps', label: 'CRAPS', detail: '2 × D6', counts: { d6: 2 } },
  { id: 'dnd', label: 'D&D SET', detail: 'Polyhedral', counts: { d4: 1, d6: 1, d8: 1, d10: 1, d100: 1, d12: 1, d20: 1 } },
  { id: 'percentile', label: 'PERCENTILE', detail: 'D10 + D%', counts: { d10: 1, d100: 1 } },
  { id: 'poker', label: 'POKER DICE', detail: '5 × Pips', counts: { 'd6-pips': 5 } },
]);

const TYPE_BY_ID = new Map(DICE_CATALOG.map((entry) => [entry.id, entry]));

function emptyCounts() {
  return Object.fromEntries(DICE_CATALOG.map(({ id }) => [id, 0]));
}

export function getDiceCounts(dice) {
  const counts = emptyCounts();
  for (const die of dice) counts[die.type] = (counts[die.type] ?? 0) + 1;
  return counts;
}

function createDie(type, id) {
  return { id, type, value: null, held: false };
}

function buildPool(counts, previous = []) {
  const oldByType = new Map(DICE_CATALOG.map(({ id }) => [id, previous.filter((die) => die.type === id)]));
  const used = new Set(previous.map((die) => die.id));
  const next = [];
  for (const { id: type } of DICE_CATALOG) {
    const wanted = Math.max(0, Math.min(MAX_PER_TYPE, Math.floor(Number(counts[type]) || 0)));
    const existing = oldByType.get(type);
    for (let index = 0; index < wanted; index++) {
      if (existing[index]) {
        next.push(existing[index]);
        continue;
      }
      let serial = 1;
      while (used.has(type + '-' + serial)) serial++;
      const die = createDie(type, type + '-' + serial);
      used.add(die.id);
      next.push(die);
    }
  }
  return next;
}

export function createTrayState(counts = { d6: 5 }) {
  const normalized = { ...emptyCounts(), ...counts };
  let total = Object.values(normalized).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  if (total > MAX_DICE) {
    for (const { id } of DICE_CATALOG) {
      if (total <= MAX_DICE) break;
      const removed = Math.min(normalized[id], total - MAX_DICE);
      normalized[id] -= removed;
      total -= removed;
    }
  }
  return {
    dice: buildPool(normalized),
    history: [],
    rollCount: 0,
    lastRoll: null,
  };
}

export function setDiceCount(state, type, requestedCount) {
  if (!TYPE_BY_ID.has(type)) throw new RangeError('Unknown die type: ' + type);
  const count = Math.max(0, Math.min(MAX_PER_TYPE, Math.floor(Number(requestedCount) || 0)));
  const counts = getDiceCounts(state.dice);
  const otherDice = state.dice.length - counts[type];
  counts[type] = Math.min(count, MAX_DICE - otherDice);
  return { ...state, dice: buildPool(counts, state.dice), lastRoll: null };
}

export function applyPreset(state, presetId) {
  const preset = PRESETS.find((entry) => entry.id === presetId);
  if (!preset) throw new RangeError('Unknown dice preset: ' + presetId);
  return createTrayState(preset.counts);
}

export function clearTray(state) {
  return createTrayState(emptyCounts());
}

export function setDieHeld(state, id, held) {
  const die = state.dice.find((entry) => entry.id === id);
  if (!die || die.value === null) return state;
  return {
    ...state,
    dice: state.dice.map((entry) => entry.id === id ? { ...entry, held: Boolean(held) } : entry),
  };
}

export function setAllHeld(state, held) {
  return {
    ...state,
    dice: state.dice.map((die) => die.value === null ? die : { ...die, held: Boolean(held) }),
  };
}

export function diceToRoll(state, mode = 'unheld') {
  if (mode === 'all') return state.dice.map((die) => die.id);
  return state.dice.filter((die) => !die.held).map((die) => die.id);
}

export function applyRoll(state, results, rolledAt = Date.now()) {
  if (!Array.isArray(results) || results.length === 0) return state;
  const resultById = new Map(results.map(({ id, value }) => [id, value]));
  if (resultById.size !== results.length) throw new TypeError('A throw cannot contain duplicate dice.');

  for (const { id, value } of results) {
    const die = state.dice.find((entry) => entry.id === id);
    if (!die) throw new RangeError('A result belongs to a die outside the tray: ' + id);
    if (die.held) throw new Error('A kept die cannot be rolled: ' + id);
    const validFaces = TYPE_BY_ID.get(die.type).faces;
    if (!validFaces.some((face) => String(face) === String(value))) {
      throw new RangeError('Invalid ' + die.type + ' face: ' + value);
    }
  }

  const dice = state.dice.map((die) => resultById.has(die.id)
    ? { ...die, value: resultById.get(die.id), held: false }
    : die);
  const scoredDice = dice.filter((die) => die.value !== null);
  const total = scoredDice.reduce((sum, die) => sum + Number(die.value), 0);
  const rollCount = state.rollCount + 1;
  const snapshot = {
    number: rollCount,
    at: rolledAt,
    rolledIds: results.map(({ id }) => id),
    dice: scoredDice.map(({ id, type, value, held }) => ({ id, type, value, held })),
    total,
  };
  return {
    ...state,
    dice,
    rollCount,
    lastRoll: snapshot,
    history: [snapshot, ...state.history].slice(0, 10),
  };
}

export function formatDieValue(type, value) {
  if (value === null || value === undefined) return '—';
  if (type === 'd100') return String(value).padStart(2, '0');
  return String(value);
}

export function formatResults(dice) {
  return dice
    .filter((die) => die.value !== null)
    .map((die) => formatDieValue(die.type, die.value))
    .join(', ');
}
