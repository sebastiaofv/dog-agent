# Agent Fetch

A browser game where a secret-agent dog catches falling complaints and files them into 16 Productos, each containing five Materias.

Play: https://sebastiaofv.github.io/dog-agent/

## Controls

- Move with Left/Right or A/D, or drag across the play area.
- Jump with Space, Up or W. Mobile also has movement and Jump buttons.
- Classify a caught case, then click **Continue mission** after filing completes. Confirmation stays open until you continue.

## Local development

`index.html` is the game source and includes its artwork, so it also works as a standalone file. The previous HTML filename redirects to it.

To serve it locally:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000/.

## Validation

```sh
node tests/game-regression.cjs
```

These deterministic tests run the actual game script with DOM fixtures. They cover jumping, mobile input, classification, missing animation events, manual confirmation and background-tab recovery. Check layout visually in a browser as well.

The original generated jump sprite and its generation prompt are in `assets/`.

## Deployment

The GitHub Pages workflow tests and deploys pushes to `main`. It can also be started manually from the Actions tab. Pages uses GitHub Actions as its publishing source.
