# Agent Fetch — Operación expediente

A standalone secret-agent arcade game in Spanish. A beagle agent catches fictional bank complaints, files them into 16 Productos with their configured Materias, and works toward a twelve-case mission.

Play: https://sebastiaofv.github.io/dog-agent/

## Mission rules

- Archive **12 complaints** to complete a mission. Confirm the final filing with **Ver resultado** to see the mission report.
- Missing **10 falling complaints** ends the mission. **Reiniciar misión** starts fresh.
- A ground catch earns **50 points**; an airborne catch earns **100**.
- Classification earns **100 points**, multiplied by consecutive classifications: ×2 from three, ×3 from six and ×4 from nine.
- Missing or skipping a case resets the streak. Mission completion adds a bonus based on remaining opportunities.
- The personal best and sound preference are saved locally when browser storage is available.

All complaint names and details are fictional. Producto/Materia assignments are a simulation.

## Controls

- Move with Left/Right or A/D, or drag across the play area.
- Jump with Space, Up or W; mobile has movement and jump buttons.
- **Pausa**, Escape or **Seguir misión** pauses/resumes play. The sound button toggles synthesized sound effects.
- Filing dialogs wait for **Continuar misión**. Outside taps, Escape, timers and tab switching do not dismiss them.

## Development

Edit `src/game.js`, `src/styles.css` and `src/body.html`, then rebuild the standalone page:

```sh
python3 scripts/build-game.py
```

`index.html` embeds all required artwork, styles and logic; it also works offline as a standalone file. The older HTML filename is a compatibility redirect. The build has no third-party dependencies.

To serve locally:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000/.

## Validation

```sh
python3 scripts/build-game.py --check
node tests/game-regression.cjs
```

Deterministic DOM fixtures exercise the actual compiled script: scoring and streaks, victory and final confirmation, personal best and sound persistence, blocked storage, jumping and mobile input, failure at ten misses, restart, all Producto/Materia counts, animation fallback and background-tab recovery. Check rendering in a browser separately.

Source PNGs, lossless WebP copies and ImageGen prompts live in `assets/`. Embedded artwork uses direct CSS image declarations because oversized custom properties can be discarded by browsers.

## Deployment

The GitHub Pages workflow checks the standalone build, runs the game checks and deploys pushes to `main`. It can also be started from the Actions tab. Pages uses GitHub Actions as its publishing source.
