# EXPSIM-001: Add Expressions Simulator menu entry and page skeleton

## Status
Completed

## Goal
Add the new "Emotions" section in `index.html` and create a static `expressions-simulator.html` page shell (with CSS hookup) so the simulator is reachable and visually consistent with other tools. This ticket only covers the HTML/CSS scaffold and menu wiring, not the simulator logic.

## File list
- index.html
- expressions-simulator.html
- css/expressions-simulator.css

## Out of scope
- No JavaScript behavior, data wiring, or new entry points (the simulator controller and bootstrapping are tracked separately).
- No changes to expression evaluation logic or services.
- No modifications to existing simulator pages beyond the new menu section.

## Acceptance criteria
### Specific tests that must pass
- No new automated tests are required for this ticket; full simulator tests belong to the later controller/bootstrapping work.
- Existing lint/test suites must remain green when run by the team.

### Invariants that must remain true
- The runtime game UI layout stays unchanged aside from the new menu entry.
- The new page uses existing global styling via `css/style.css` and does not introduce new shared CSS variables.

## Implementation notes
- Follow the UI/UX requirements in `specs/expressions-simulator.md` for the menu copy, title, and link.
- Mirror structure and back-to-menu link patterns from `damage-simulator.html`.
- Include placeholder sections for mood inputs, sexual state inputs, and expression results (static markup only).
- Create a dedicated `css/expressions-simulator.css` and link it from the new page.

## Outcome
- Added the Emotions section and Expressions Simulator button to `index.html`, including navigation wiring.
- Created `expressions-simulator.html` with static panels and placeholders only (no controller/bootstrapping yet).
- Added `css/expressions-simulator.css` for layout and styling to mirror existing tool pages.
