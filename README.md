# Anomaly Zone Mini-Game

A procedural browser mini-game and Foundry VTT module for hazardous-zone exploration in post-apocalyptic / science-fiction tabletop campaigns.

The project turns exploration into a small hidden-information system: the GM configures a zone, players move through an unknown grid, use tools to probe nearby cells, discover loot and try to reach an exit without walking into anomalies or dangerous radiation.

> Inspired by the general atmosphere of post-apocalyptic exploration games. This is an independent fan-made tabletop utility and is not affiliated with any referenced commercial franchise.

## Highlights

- procedural grid generation;
- reproducible generation based on seed/salt;
- guaranteed safe route to at least one exit;
- configurable anomaly and radiation density;
- multiple anomaly behaviours;
- hidden caches and artifacts;
- weighted loot configuration;
- player exploration tools;
- GM reveal/debug mode;
- responsive large-grid UI;
- Foundry VTT integration files;
- standalone web application workflow.

## Gameplay systems

### Procedural zone

The generator can configure:

- grid dimensions;
- anomaly density;
- radiation density;
- number of caches;
- artifact placement;
- exits;
- weighted loot.

A deterministic random generator makes a zone reproducible from the same configuration.

### Safe-path constraint

The generator preserves at least one traversable route between the entry point and an exit. This keeps random generation from producing an unwinnable map.

### Player tools

The exploration layer includes tools for revealing or evaluating nearby danger, including:

- directed anomaly probing;
- local radiation scanning;
- artifact scanning.

### GM mode

The GM can reveal hidden zone information for administration, debugging or running the encounter.

## Foundry VTT

The repository includes `module.json` and `module.js` integration files in addition to the standalone application.

This allows the project to be used as a tabletop utility rather than only as a separate browser game.

## Tech stack

| Area | Technology |
| --- | --- |
| UI | React 19 |
| Language | TypeScript |
| Build | Vite, esbuild |
| Styling | Tailwind CSS |
| Icons / motion | Lucide React, Motion |
| Support layer | Node.js, Express, WebSocket |
| VTT integration | Foundry module files |

## Local development

```bash
git clone https://github.com/theDAREK497/ANOMALY-ZONE-mini-game.git
cd ANOMALY-ZONE-mini-game
npm ci
npm run dev
```

Type-check/lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
npm start
```

## Repository structure

The project contains both application and integration layers:

```text
src/                 React/TypeScript application code
server.ts            Node support/server layer
module.json          Foundry VTT module metadata
module.js            Foundry VTT integration code
app-template.html    embedded/application template
db_*.json            configurable local game data
dist/                 built output
```

## Engineering focus

The interesting part of this project is not only the UI. It is the combination of:

- constrained procedural generation;
- deterministic randomness;
- hidden information;
- GM/player interaction;
- configurable game data;
- embedding the result into an existing tabletop platform.

## Status

Active side project / tabletop utility.

Future work can include stronger automated tests around generator invariants, versioned Foundry compatibility, packaging/release automation and cleaner separation between standalone and VTT-specific layers.
