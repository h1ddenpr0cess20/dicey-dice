# Dicey — The Virtual Dice Tray

A browser-based 3D dice tray for tabletop nights, roleplaying games, classic dice games, and house rules. Built with Madness Engine.

## Features

- Full standard polyhedral dice set: D4, D6, pip D6, D8, D10, percentile D%, D12, and D20.
- Build mixed pools of up to 24 dice, with up to 12 of any one type.
- Quick setups for Yahtzee, Farkle, craps, D&D, and percentile rolls.
- Pip-marked D6 are the default for general games; the D&D preset uses a numbered D6.
- Roll all dice or reroll only dice that are not kept.
- Keep individual results between throws, or release all kept dice.
- Custom resin and marking colours, with curated colour swatches.
- Readable per-die results, totals, copyable result summaries, and the last ten throws.
- Drag-to-orbit 3D stage, mouse-wheel zoom, touch pinch zoom, and double-click camera reset.
- Responsive tray layout for desktop, tablet, and mobile.

Dicey is a general-purpose dice tray. Presets configure useful dice pools; they do not impose game-specific scoring rules.

## Development

The app uses the Madness Engine package and its createDieProp polyhedral dice.

Run the simulation and 3D world tests with:

    npm test

## Controls

- Drag the stage to rotate the view.
- Scroll or pinch to zoom.
- Double-click the stage to reset the camera.
- Press Space or choose Roll Unheld to roll every die not currently kept.
- Choose Keep under an individual result to set it aside.
- Roll All releases and rerolls the entire pool.
