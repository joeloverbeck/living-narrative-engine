# EXPSIMEVALOGENH-001: Evaluation Log header count markup

## Summary
Add the Evaluation Log header wrapper and count element in `expressions-simulator.html`, align the count in `css/expressions-simulator.css`, and wire the count/badge/order updates in `ExpressionsSimulatorController` with unit coverage.

## File list it expects to touch
- expressions-simulator.html
- css/expressions-simulator.css
- src/domUI/expressions-simulator/ExpressionsSimulatorController.js
- tests/unit/domUI/expressionsSimulatorController.test.js

## Out of scope
- Changes to matching-expression ordering in the matches list (only evaluation log ordering updates).
- Styling or behavior beyond the Evaluation Log panel.

## Acceptance criteria
- Evaluation Log header shows `Evaluated: --` before evaluation, and `Evaluated: <count>` after evaluation runs.
- Evaluation entries render in descending priority order (tie-breaker by expression id asc).
- Each evaluation entry shows a priority badge (`P<priority>`, fallback `P0`).
- Placeholder and status messaging remain unchanged when no evaluations exist.
### Specific tests that must pass
- `npm run test:unit -- tests/unit/domUI/expressionsSimulatorController.test.js --runInBand`

### Invariants that must remain true
- Existing Evaluation Log placeholder and status messaging remain unchanged.
- No changes to gameplay data or `data/mods/` content.
- No changes to matching-expression ordering in the matches list.

## Status
Completed

## Outcome
- Updated `expressions-simulator.html` with the Evaluation Log header wrapper and count element.
- Added Evaluation Log header and priority badge styling in `css/expressions-simulator.css`.
- Implemented count updates, priority sorting, and badge rendering in `ExpressionsSimulatorController`, plus unit coverage.
