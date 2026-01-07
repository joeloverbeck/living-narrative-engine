# EXPSIMPRESTACAP-001: Add Recorded Previous State UI block

## Status
Completed

## Summary
Add the "Recorded Previous State" panel markup in the expressions simulator Inputs area, placed directly beneath the Sexual State panel, and style it to match existing panels. The panel must include a record button, a scrollable recorded-state display region, section headings, and an empty-state message.

## Files
- `expressions-simulator.html`
- `css/expressions-simulator.css`

## Out of scope
- Controller/data logic for recording state or wiring the button (handled in EXPSIMPRESTACAP-002).
- Any changes to expression evaluation or context building.
- New tests (handled in EXPSIMPRESTACAP-003); existing suites should still pass.

## Acceptance criteria
### Specific tests that must pass
- No new tests required in this ticket; existing tests should continue to pass.

### Invariants that must remain true
- Inputs layout still fits within the current grid structure and keeps the Sexual State panel intact with the recorded-state panel directly beneath it.
- The new UI block does not introduce non-ASCII characters or new fonts.
- Existing button styles and panel styles remain unchanged outside the new block.

## Notes
- Block title: "Recorded Previous State".
- Button label: "Record Current State" (button can be inert for now).
- Recorded-state container shows empty-state text when no data is present.
- Display area has `max-height` and `overflow-y: auto` applied for scroll behavior.
- Ensure labels/headings for sections (Mood Axes, Emotions, Sexual States) are present in markup for accessibility; content can be placeholders until wired in.

## Outcome
- Added the Recorded Previous State panel beneath the Sexual State panel with button, empty-state message, and placeholder section headings/lists.
- Implemented scrollable display styles and layout adjustments for the new panel; no controller logic or tests were added in this ticket.
