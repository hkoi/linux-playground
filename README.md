# Linux Playground

An interactive browser-based Linux terminal simulator built to assist teaching the **Introduction to Linux** lecture during [HKOI](https://hkoi.org/) training.

This is a vibed coded project.

## What it does

Students work through 6 guided mission levels, from basic navigation and file creation to compiling C++ with `g++` and running contest-style workflows. All inside a virtual filesystem that runs entirely in the browser.

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Deployment

The app deploys to **GitHub Pages** automatically on every push to `main` via the workflow in `.github/workflows/deploy.yml`.

To enable it on a new fork:

1. Go to **Settings > Pages** in your GitHub repo.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` — the site will be live at `https://<user>.github.io/linux-playground/`.

## Architecture

```
src/
  lib/
    virtualFS.js      Immutable tree-based virtual filesystem
    commandParser.js   Tokenizer + handlers for each shell command
    missions.js        Mission definitions with validator functions
  context/
    FileSystemContext.jsx   Global state, validation loop, localStorage persistence
  components/
    Terminal.jsx       Terminal UI with tab-completion and history
    MissionPanel.jsx   Mission sidebar with progress tracking and hints
  App.jsx             Responsive layout (desktop two-column, mobile tab toggle)
```

## Troubleshooting

**Mission appears stuck after refresh** — The app re-validates mission state on load. If you still hit an issue, click the reset button (top-right of the mission panel) twice to start fresh.

**State is persisted in localStorage** under the key `linux-playground-state`. Clearing site data in your browser fully resets everything.
