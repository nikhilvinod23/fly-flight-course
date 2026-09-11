# Forward Course

A bare-bones browser flight-course prototype for future neural-controller experiments.

## Current version

- Level 1: automatic forward motion with left/right movement only.
- Level 2: automatic forward motion with left/right/up/down movement.
- Five rings and two square targets per level.
- Colored ring bands and visually separate target squares.
- Wider spacing between course objects for easier first-pass play.
- Center-locked crosshair with forward-only projectiles, target shatter feedback, and ring-color success pulses.
- Projectiles spawn at the craft's front tip, stay in world space as the craft moves, and shrink with distance.
- Level 1 ring placement requires active left/right alignment; coasting straight misses the course gates.
- Keyboard and mouse controls.
- No glow, no turning controls, and no connectome integration yet.
- Static HTML, CSS, and JavaScript with no third-party dependencies.

## Controls

- Arrow keys or `WASD` move the craft.
- Mouse position moves the craft.
- The crosshair stays centered; bullets always fire along its forward line.
- `Space`, `F`, or mouse click fires.
- The craft always moves forward.
- `Run again` resets the current level and starts a fresh course.
- `Previous level` returns to level 1 when level 2 is active.

## Run locally

Open `index.html` in a browser, or serve the folder with any static web server.

## Future neural integration points

The game intentionally keeps the control surface small:

- horizontal movement: `-1` to `+1`
- vertical movement: `-1` to `+1` on level 2
- fire: a discrete event
- visual input: the rendered canvas frame

The connectome should eventually replace the keyboard/mouse input path while the course and scoring rules remain unchanged.

## Static replay branch

The `static-replay-v1` branch contains a self-contained Level 1 scripted replay at `replay.html`. It has no neural model or server dependency and is intended as the first reviewable public viewer before adding GitHub Pages hosting.

## Neural replay branch

The `neural-replay-v1` branch adds `neural-replay.html`, a closed-loop browser prototype with ten spatially varied rings, a 48 × 27 camera-to-retina view, two-axis visual/motor/spontaneous activity, dopamine-style reward-modulated preferences, and a Three.js NeuroMechFly body panel.

The controller reads only the downsampled rendered image for horizontal/vertical steering and firing; game coordinates are retained for collision and reward bookkeeping. Learning now uses stronger reward-modulated preferences, longer eligibility traces, lower exploration noise, axis-specific ring credit, and a separate firing preference. Each episode applies deterministic spatial jitter to the ring layout so the controller is encouraged to respond to ring appearance rather than memorize one fixed route. The retinal salience channels, action-selection circuit, neural-location overlay, and flight animation remain educational approximations rather than validated predictions from the full fly connectome.

The 3D panel uses the simplified NeuroMechFly v2 mesh and rigging assets vendored by Xenova's Neural Canvas project. See `assets/neuromechfly/NOTICE` for source and license attribution. The adjacent brain preview uses the low-poly JRC2018U adult Drosophila atlas surface from `navis-flybrains`, with its license in `assets/brain/NAVIS_FLYBRAINS_LICENSE.txt`. The activity markers remain an educational pathway overlay rather than a full connectome firing reconstruction. If the body, atlas mesh, or browser loaders cannot be loaded, the display falls back gracefully.

The replay includes `Skip 5`, `Skip 10`, and `Skip 25` controls. These simulate complete training episodes asynchronously, preserve the learned preferences, and leave the next episode ready for visual inspection. A rolling ring-completion percentage is shown beside the neural activity readout.

## GitHub Pages

The repository's GitHub Pages source is the root of the `neural-replay-v1` branch. GitHub publishes updates to that branch automatically. The replay is available at:

`https://nikhilvinod23.github.io/fly-flight-course/neural-replay.html`

The footer links to `limitations.html`, which explains the construction, the schematic brain map, and the boundaries of the experiment.
