# Project conventions

- Use `https://github.com/sebastiaofv/dog-agent.git` as this project's canonical repository for future work, as requested by the user.
- Edit `src/game.js`, `src/styles.css` and `src/body.html`, then run `python3 scripts/build-game.py` to rebuild the standalone `index.html`. The older HTML filename is a compatibility redirect.
- Filing confirmation must stay open until the player clicks **Continuar misión**, or **Ver resultado** for the final case. Preserve that behavior across timers, outside taps, Escape, resizing and tab switching.
- Run `python3 scripts/build-game.py --check` and `node tests/game-regression.cjs` after changes. These tests use DOM fixtures; visually check responsive layout separately.
- Keep large artwork URLs in direct image declarations; oversized CSS custom properties previously made popup images disappear.
- Pushes to `main` publish through GitHub Pages. Keep deployment changes compatible with the repository path `/dog-agent/`.
