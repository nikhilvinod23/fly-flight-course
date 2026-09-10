# Forward Course

A bare-bones browser flight-course prototype for future neural-controller experiments.

## Current version

- Level 1: automatic forward motion with left/right movement only.
- Level 2: automatic forward motion with left/right/up/down movement.
- Five rings and two square targets per level.
- Keyboard and mouse controls.
- No glow, no turning controls, and no connectome integration yet.
- Static HTML, CSS, and JavaScript with no third-party dependencies.

## Controls

- Arrow keys or `WASD` move the craft.
- Mouse position moves the craft.
- `Space`, `F`, or mouse click fires.
- The craft always moves forward.

## Run locally

Open `index.html` in a browser, or serve the folder with any static web server.

## Future neural integration points

The game intentionally keeps the control surface small:

- horizontal movement: `-1` to `+1`
- vertical movement: `-1` to `+1` on level 2
- fire: a discrete event
- visual input: the rendered canvas frame

The connectome should eventually replace the keyboard/mouse input path while the course and scoring rules remain unchanged.
