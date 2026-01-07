# Expressions simulator previous-state capture

## Goal
Add a manual "record current state" flow in the expressions simulator so prerequisite evaluation can use realistic `previous*` values instead of zeroed defaults. The new UI must show the recorded values and support scrolling when the recorded data exceeds available space.

## Background
- The simulator currently builds expression contexts via `ExpressionContextBuilder` using current mood axes and sexual state inputs.
- `previousEmotions`, `previousSexualStates`, and `previousMoodAxes` are only populated when a previous state is provided; otherwise they default to all zeros.
- The simulator currently sets `previousState` after every trigger evaluation, but there is no way to explicitly capture a previous turn without first triggering an evaluation.
- Expressions often compare current values against `previous*` values (see `docs/modding/expressions-prerequisites-context.md`).

## Requirements
1. Add a new UI block in the Inputs area that lets the user record the current state for use as the `previous*` values in the expression context.
2. The record action must capture:
   - `previousMoodAxes` from the current mood axis values.
   - `previousEmotions` from the current mood axes + sexual state calculation.
   - `previousSexualStates` from the current mood axes + sexual state calculation.
3. The new UI block must display the recorded values grouped into sections (mood axes, emotions, sexual states). The display must be scrollable if content overflows.
4. When a recorded state exists, triggering an expression must use the recorded values as the `previous*` context. The recorded values should persist until the user records again (do not overwrite them on each trigger).
5. If no recorded state exists, `previous*` should remain zeroed as it does today.
6. The UI must fit within the existing layout. Either:
   - Use available space inside the Sexual State panel, or
   - Allow the Sexual State panel to shrink to its content height and place a new panel directly beneath it.
7. Provide a clear empty state message in the recorded-state display when nothing has been captured yet.
8. Ensure accessibility: the record button must be focusable, and the recorded-state sections should use headings or labels to make the structure clear.

## UX / UI details
- New block title: "Recorded Previous State".
- Primary button: "Record Current State".
- Recorded values layout (each should be a structured section with a short label and list):
  - "Mood Axes" (raw values).
  - "Emotions" (normalized values 0..1).
  - "Sexual States" (normalized values 0..1).
- Numeric formatting: keep mood axes as integers; show normalized values with a fixed precision (e.g., 2-3 decimals).
- Scroll behavior: limit recorded-state display height (e.g., `max-height`) and set `overflow-y: auto`.

## Data flow and state changes
- Add a new controller state key (e.g., `recordedPreviousState`) that stores the captured values.
- On "Record Current State":
  - Calculate emotions/sexual states using the same calculator as `#updateDerivedOutputs`.
  - Store `{ moodAxes, emotions, sexualStates }` in `recordedPreviousState`.
  - Re-render the recorded-state display.
- On "Trigger Expression":
  - Pass `recordedPreviousState` (if present) to `buildContext` as the `previousState` argument.
  - Do not overwrite `recordedPreviousState` after evaluation.
- Keep `#state.previousState` only if needed for backward compatibility; otherwise replace it with the recorded state reference to avoid confusion.

## Files to update
- `expressions-simulator.html`
  - Add new block markup under the Sexual State panel or directly below it in the Inputs grid.
  - Add elements for the record button and the recorded-state display container.
- `css/expressions-simulator.css`
  - Style the new block to match existing panels.
  - Add scroll styles for the recorded-state display.
- `src/domUI/expressions-simulator/ExpressionsSimulatorController.js`
  - Add DOM bindings for the new block.
  - Add state + handler for recording current state.
  - Update evaluation flow to use the recorded values.
  - Add rendering helper for the recorded-state sections.

## Edge cases / error handling
- If component schemas are unavailable, the record button should remain functional but display an error or placeholder in the recorded-state panel.
- If the emotion calculator throws, log a warning and leave the recorded-state display unchanged.
- Ensure the record button is disabled only if the simulator initialization failed (same gating as trigger button).

## Testing requirements
Add comprehensive tests covering:
- Recording current state stores `previousMoodAxes`, `previousEmotions`, and `previousSexualStates` with expected keys and values.
- Triggering expressions after recording uses the recorded values in the context builder.
- Triggering expressions without recording keeps previous values zeroed.
- Recorded-state UI rendering:
  - shows empty state text when nothing recorded.
  - shows structured sections and scroll container when data exists.
- Regression coverage for any refactoring of `previousState` in the controller.

Suggested locations:
- Unit tests for `ExpressionsSimulatorController` (new tests under `tests/unit/` or extend existing simulator tests if any) with DOM fixtures.
- Integration test updates (if needed) in `tests/integration/expressions-simulator.entrypoint.realModules.integration.test.js` to verify end-to-end behavior.

## Open questions
- Do we want an optional "Use last trigger as previous" toggle, or should the recorded state be the sole source of `previous*` until overwritten?
- Should the recorded-state panel include a timestamp or turn counter to make it obvious when the capture occurred?
