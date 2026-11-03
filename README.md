# Dicey — The Virtual Dice Tray

Dicey is a browser-based 3D dice tray for tabletop games, roleplaying sessions, and custom dice pools. It combines a configurable polyhedral dice set with a physics-driven 3D tray, individual result controls, saved setups, and reusable color palettes.

## Screenshots
5d6 with default color scheme:
<img width="1089" height="1279" alt="dicey-dice vercel app_" src="https://github.com/user-attachments/assets/087621c9-f246-4e8d-9d1c-3408bc4a5e3e" />
A full set of dice for roleplaying, with custom colors:
<img width="1089" height="1279" alt="dicey-dice vercel app_ (1)" src="https://github.com/user-attachments/assets/a4493919-644e-4f8f-9028-02c82742e1a9" />



## Contents

- [Features](#features)
- [Getting started](#getting-started)
- [Using the tray](#using-the-tray)
- [Saved setups and colors](#saved-setups-and-colors)
- [Controls](#controls)
- [Development](#development)
- [Project structure](#project-structure)
- [Dice geometry](#dice-geometry)

## Features

### Dice and rolling

- Eight selectable die types: D4, numbered D6, pip-marked D6, D8, D10, percentile D% (D100), D12, and D20.
- Mixed dice pools with up to **24 dice total** and **12 dice of each type**.
- Quick setups for Yahtzee, Farkle, craps, D&D, and percentile rolls.
- Roll the full tray or reroll only dice that are not kept.
- Keep individual dice between throws and release kept dice when they are ready to roll again.
- A latest-results shelf with per-die values and a total.
- A rolling history containing the last 10 throws.

### Appearance and personalization

- Tray-wide resin and marking colors, with direct color pickers.
- Six built-in color swatches.
- Up to 12 named custom color combinations, saved separately from dice setups.
- Custom color swatches display both colors and can be applied or deleted individually.
- Up to 12 named dice setups. Each saved setup includes its dice composition **and** its resin and marking colors.

### 3D interaction and layout

- Drag to orbit the camera.
- Mouse-wheel or touch-pinch zoom.
- Double-click the stage to reset the camera.
- Responsive controls for desktop, tablet, and mobile layouts.

Dicey is a general-purpose dice tray. Quick setups configure useful dice pools; they do not apply game-specific scoring rules.

## Getting started

### Requirements

- Node.js (with npm)
- Git

### Install and run locally

```sh
git clone https://github.com/h1ddenpr0cess20/dicey-dice.git
cd dicey-dice
npm install
npm run dev
```

Vite prints the local development URL in the terminal when the server starts.

### Production build

```sh
npm run build
npm run preview
```

The production bundle is written to `dist/`.

## Using the tray

1. Choose a quick setup or build a pool by changing the count for each die type.
2. Customize resin and marking colors with the color pickers or built-in swatches.
3. Roll the tray. Use the individual **Keep** controls to set results aside.
4. Use **Roll Unheld** to reroll dice that are not kept, **Roll All** to reroll the whole pool, or **Release Kept** to return kept dice to the next roll.
5. Review the latest results and the last 10 throws in the roll history.

The dice pool can contain any mix of supported die types, subject to the total and per-type limits.

## Saved setups and colors

Dicey has two independent save libraries:

**Saved setups** capture the current dice counts together with the current resin and marking colors. Choose **Save Setup**, enter a name, and save it. Selecting a saved setup restores its dice pool and both colors. A setup requires at least one die.

**Saved color combinations** capture only the current resin and marking colors. Choose the circular **+** swatch next to the built-in palettes, enter a name, and save it. Select a saved swatch to apply its colors without changing the dice pool. The small **×** control removes a saved combination.

Both libraries support up to 12 entries. Names must be unique within their own library.

Saved setups and color combinations are stored in the browser's local storage. They persist across reloads in the same browser and site origin, but they are not synced to an account or shared between browsers/devices. Clearing the site's browser storage removes them.

## Controls

| Action | Control |
| --- | --- |
| Orbit the 3D tray | Drag on the stage |
| Zoom | Mouse wheel or touch pinch |
| Reset camera | Double-click the stage |
| Roll unkept dice | **Roll Unheld** or press **Space** |
| Roll every die | **Roll All** |
| Keep a result | Select **Keep** on its result chip |
| Unkeep every die | **Release Kept** |
| Change the dice pool | Use the plus/minus controls under **Build Your Pool** |
| Change resin or markings | Use the color pickers or palette swatches |
| Save a dice setup | **Save Setup** |
| Save a color combination | Select the circular **+** swatch |
| Apply a saved color combination | Select its saved swatch |
| Delete a saved item | Select the **×** beside that item |

The Space shortcut is ignored while focus is in a button or form control.

## Development

Dicey uses [Vite](https://vite.dev/) for local development and builds, and [Madness Engine](https://github.com/h1ddenpr0cess20/madness-engine) for the 3D stage, dice meshes, physics, and face-reading pipeline.

The engine dependency is pinned to merge commit [`64742baccbfc9ade128cd497baf00e1807d5d8de`](https://github.com/h1ddenpr0cess20/madness-engine/commit/64742baccbfc9ade128cd497baf00e1807d5d8de), which includes the D4 corner-numeral redesign from [PR #43](https://github.com/h1ddenpr0cess20/madness-engine/pull/43).

### Commands

```sh
npm run dev      # Start the Vite development server
npm test         # Run simulation and 3D world tests
npm run build    # Create the production build in dist/
npm run preview  # Serve the production build locally
```

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | App shell and control markup |
| `src/main.js` | UI rendering, event handling, saved data, and engine integration |
| `src/sim.js` | Dice pool state, presets, roll results, and saved-data validation |
| `src/world.js` | 3D dice world and stage behavior |
| `src/style.css` | Layout, responsive behavior, and visual styling |
| `test/sim.test.js` | Dice simulation, presets, and saved-data tests |
| `test/world.test.js` | 3D world tests |
| `vite.config.js` | Vite build configuration |

## Dice geometry

Dicey uses Madness Engine's 3D dice meshes and face-reading pipeline. The D4 lands on a triangular face; its engine face value corresponds to the number on the opposite top vertex, matching the corner numerals displayed on the die.
