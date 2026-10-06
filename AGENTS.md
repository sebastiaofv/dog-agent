# Project conventions

- Use `https://github.com/sebastiaofv/dog-agent.git` as this project's canonical repository for future work, as requested by the user.
- Edit `index.html`; keep the game standalone by embedding required artwork. The older HTML filename is a compatibility redirect.
- Filing confirmation must stay open until the player clicks **Continue mission**. Preserve that behavior across timers, outside taps, Escape, resizing and tab switching.
- Run `node tests/game-regression.cjs` after behavior changes. These tests use DOM fixtures; visually check responsive layout separately.
- Pushes to `main` publish through GitHub Pages. Keep deployment changes compatible with the repository path `/dog-agent/`.
