# Dicey — Five Alive

A compact, playable D6 game built specifically to demo the standalone dice props introduced in Madness Engine PR [#41](https://github.com/h1ddenpr0cess20/madness-engine/pull/41).

**Game:** Five Alive is a push-your-luck race to 100. Roll all five dice. A throw without a one adds the face-value total to the turn pot. Any one busts the turn and clears the unbanked points. Bank a safe pot before risking another throw.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use **Roll the dice** or press Space. Bank points to secure them. Start a new game to reset the scoreboard.

## D6 demo coverage

- Both engine D6 props are exercised: `d6` (numbered faces) and `d6-pips` (pip faces).
- Resin and marking ink can be changed independently with the colour.
- Five physical D6 prop groups animate together on the table.
- Each result is read after the animation by transforming every source face normal through the die's final quaternion and selecting the face with the greatest world-up dot product. The score and face-reader UI are populated from that geometry read; there is no second, unrelated random score roll.
- A settled face must be within 0.001 of world-up or the reader throws an error rather than silently reporting a value.

## Engine pin

The dependency is pinned to Madness Engine merge commit [`d65c12844b6f83f697ef1895a1a2b56fe7474247`](https://github.com/h1ddenpr0cess20/madness-engine/commit/d65c12844b6f83f697ef1895a1a2b56fe7474247), which merged the RPG dice props in PR #41. The standalone D6 entrypoints are exported from `madness-engine/props/dice`.

## Verify

```sh
npm test
npm run build
```

The simulation tests cover the score rules and validation. The 3D face reader is exercised at runtime by every completed roll. A successful production build should be run in an environment able to fetch GitHub dependencies.
