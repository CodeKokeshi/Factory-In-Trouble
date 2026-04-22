# Broken Factory

## Game

Broken Factory is a fast-paced top-down conveyor management game where the system keeps getting worse and your job is to keep the line alive.

You are managing food flow, not building machines. Items spawn, move through belt layouts, and must be delivered to the correct chest lanes before the system clogs.

### Core Loop

- Four food types: condiments, carbs, protein, greens.
- Drag and drop items between lanes to recover bad routing.
- Build score through clean chest deliveries and combo multiplier growth.
- Survive escalating pressure as belt speed and spawn pace ramp with score.

### Modes

- Campaign:
	- 9 levels with fixed quotas and increasing complexity.
	- A level is cleared when accepted boxes reach its quota.
	- Level unlock progress is saved.
- Endless:
	- No quota end condition.
	- You play until the line jams beyond recovery.

### Failure Condition

- You lose when the system is fully clogged for longer than a short grace window.
- In practical terms: spawns are blocked, lane intakes are blocked, and the line cannot recover in time.

### Interaction Model

- Primary control is pointer/touch drag-and-drop on items.
- Items can be swapped with other items or dropped into valid lane slots.
- Dragging engages temporary slow-motion for precision handling.
- Pause menu and draft choices support keyboard/controller navigation.

### Incident System

- 🪲 Beetles:
	- Spawn as jam hazards.
	- Can be tapped to splat or dragged and flicked away.
- 🚁 Drone sabotage:
	- Picks items and drops them into wrong lanes.
- 🔀 Lane swap incident:
	- Active lanes can exchange assignments/expectations mid-run.
- 🔧 Claw breakdown:
	- Lane claws can overheat and temporarily stop handling.
- 🌫️ Steam hazard:
	- Obscures chest-side lane segments and reduces visibility.

Campaign progression introduces incidents by level index, while endless keeps incidents active together (including steam).

### Draft Card Progression

During runs, a draft system offers 3-card choices from rescue, control, and greed archetypes. Drafts trigger by score milestones and high-pressure states.

Current catalog:

- Coolant Flush
- Smart Sort Protocol
- Emergency Brake
- Overflow Purge
- Inserter Calibration
- Chest Priority Mode
- Belt Rephase
- Predictive Pull
- Turbo Shift
- Combo Furnace
- Risky Throughput
- Fragile Jackpot

These cards apply temporary modifiers to speed, spawn behavior, scoring, combo handling, jam recovery, and routing stability.

### Audio and Presentation

- Layered SFX and adaptive music behavior react to pressure, jam load, and combo state.
- Distinct menu, gameplay, victory, and defeat music flows.
- Loading scene performs scene-ready handoff before gameplay activation.

## Tech Stack

### Runtime and Framework

- JavaScript (ES modules)
- Phaser 3.90.0
- Phaser Arcade Physics (no gravity)

### Build and Tooling

- Vite 5.4.11
- npm scripts:
	- `npm run dev`
	- `npm run build`
	- `npm run preview`

### App Structure

- Entry point: `src/main.js`
- Core scenes:
	- `BootScene`
	- `MainMenuScene`
	- `LevelSelectScene`
	- `LoadingScene`
	- `GameScene`
- Data modules:
	- `src/data/levels.js`
	- `src/data/campaignProgress.js`

### Rendering and Layout

- Fixed internal game resolution: 1280x720
- Phaser scale mode: FIT + centered canvas
- Fullscreen container via CSS (`#game-container` uses viewport sizing)

### Assets and Content Pipeline

- Food/chest/beetle sprites loaded via Vite `import.meta.glob`.
- Music tracks and SFX sources loaded from local assets.
- Web fonts loaded from Google Fonts in `index.html`.

### Persistence

- Browser localStorage stores:
	- Campaign completion state
	- Per-incident tutorial "do not show again" preferences
	- Campaign debug unlock cycling state

### Input Support

- Pointer/touch drag interactions for gameplay item control.
- Keyboard input for pause and draft/selection flows.
- Gamepad enabled in Phaser input config (used in navigation/audio unlock paths).