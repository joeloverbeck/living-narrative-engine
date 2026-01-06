# EXPSIM-003: Render inputs and derived emotion/sexual-state text

## Status
Completed

## Goal
Implement controller logic to render mood/sexual-state inputs from component schemas and update the derived "Current: ..." outputs on input changes.

## File list
- src/domUI/expressions-simulator/ExpressionsSimulatorController.js
- expressions-simulator.html
- css/expressions-simulator.css

## Out of scope
- No expression evaluation or dispatch.
- No changes to data registry content.
- No updates to existing emotional/sexual state panels.

## Acceptance criteria
### Specific tests that must pass
- New unit tests for input rendering and derived text updates.
- Existing lint/test suites must remain green when run by the team.

### Invariants that must remain true
- Input min/max/default values come directly from `dataSchema.properties` for `core:mood` and `core:sexual_state`.
- Derived text formatting matches `EmotionalStatePanel` and `SexualStatePanel` wording ("Current: ...").
- Inputs remain accessible: labels, readouts, and keyboard-friendly controls.

## Implementation notes
- Use `dataRegistry.get('components', 'core:mood')` and `dataRegistry.get('components', 'core:sexual_state')`.
- Render range + number inputs with synchronized values and a readout.
- Use `EmotionCalculatorService.calculateEmotions(...)` + `formatEmotionsForPrompt(...)` for mood output (matching `EmotionalStatePanel`).
- Use `calculateSexualArousal(...)` then `calculateSexualStates(...)` + `formatSexualStatesForPrompt(...)` for sexual-state output (matching `SexualStatePanel`).

## Outcome
- Rendered mood/sexual inputs and derived "Current: ..." outputs in the simulator controller and page, with schema-driven defaults.
- Added controller unit tests for input rendering and derived text updates, matching the adjusted service usage.
