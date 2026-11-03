# Dicey — Five Alive

A small, playable 3D D6 game built to demonstrate the standalone dice props introduced in Madness Engine PR [#41](https://github.com/h1ddenpr0cess20/madness-engine/pull/41).

**Five Alive** is a push-your-luck race to 100. Roll all five dice. A throw without a one adds the face-value total to the turn pot. Any one busts the turn and clears the unbanked points. Bank a safe pot before risking another throw.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Use **Roll Dice** or press Space. Bank points to secure them. Start a new game to reset the scoreboard.

## 3D D6 demo

- The stage is full-viewport: the dice are the focus, not a dashboard or split-pane layout.
- The five-die table is centered on the stage. Landscape uses one row; narrow/portrait screens use a centered three-plus-two layout.
- Both engine D6 prop styles are supported: `d6` (numbered faces) and `d6-pips` (pip faces).
- Resin and marking ink can be changed independently.
- All five props animate together. Results are read after settling by transforming each face normal through its final die and tumble quaternions and selecting the greatest world-up dot product.
- The score and result strip use that geometry read. There is no unrelated second random score roll.
- A settled top face must be within 0.001 of world-up or the reader throws an error rather than silently displaying a value.

## Engine pin

The dependency is pinned to Madness Engine merge commit [`d65c12844b6f83f697ef1895a1a2b56fe7474247`](https://github.com/h1ddenpr0cess20/madness-engine/commit/d65c12844b6f83f697ef1895a1a2b56fe7474247), which merged the RPG dice props in PR #41. The standalone D6 entrypoints are exported from `madness-engine/props/dice`.

## Verify

```sh
npm test
npm run build
```

The world tests cover both D6 variants, settled face reads, style/colour rebuilds, and the narrow-screen table arrangement. Run these commands in an environment able to fetch the pinned GitHub engine dependency.
