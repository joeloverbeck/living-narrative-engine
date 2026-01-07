# EXPSIMEVALOGENH-002: Evaluation Log rendering order and badge

## Summary
Update the Evaluation Log UI to render evaluations in priority-desc order with an id tie-breaker, show the evaluation count in the header, and include a priority badge in each entry. Add or adjust styles and markup as needed.

## File list it expects to touch
- src/domUI/expressions-simulator/ExpressionsSimulatorController.js
- css/expressions-simulator.css
- expressions-simulator.html
- tests/unit/domUI/expressionsSimulatorController.test.js

## Out of scope
- Any changes to evaluation computation or registry behavior outside display logic.
- Refactors unrelated to Evaluation Log rendering.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- tests/unit/domUI/expressionsSimulatorController.test.js --runInBand`

### Invariants that must remain true
- Placeholder content still appears when evaluations are empty/null.
- Status messaging in the Evaluation Log panel remains unchanged.
- Sorting uses numeric priority (fallback 0) and tiebreaks by expression id ascending.

### Required coverage
- Unit tests validate evaluation count updates, priority badge rendering (including fallback `P0`), and ordering behavior.

## Status
Completed

## Outcome
- No code changes were required; the existing implementation already met the updated scope.
- Ticket scope was corrected to include the HTML header wrapper and unit test coverage called for in the spec.
