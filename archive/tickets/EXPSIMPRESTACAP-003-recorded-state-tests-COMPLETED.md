# EXPSIMPRESTACAP-003: Tests for recorded previous state behavior

## Summary
Existing unit coverage already exercises recorded previous-state capture, reuse in expression evaluation, and formatted UI rendering. The remaining gap is an explicit assertion that the empty recorded-state view renders on initialization. No integration coverage is required.

## Files
- `tests/unit/domUI/expressionsSimulatorController.test.js` (extend with empty-state render assertion)

## Out of scope
- Controller/UI implementation changes (already shipped).
- Integration test updates.
- Snapshot rewrites unrelated to recorded previous state.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand` (or the minimal unit test command the repo uses for controller tests).

### Invariants that must remain true
- Triggering expressions without recording still uses zeroed `previous*` values.
- Recording current state persists and is used for subsequent triggers until re-recorded.
- Recorded-state UI shows empty state text when no data is recorded.
- Recorded-state UI shows three labeled sections (mood axes, emotions, sexual states) with normalized values formatted to fixed precision when data exists.

## Test coverage checklist
- Record action stores `previousMoodAxes`, `previousEmotions`, and `previousSexualStates` with expected keys/values.
- Trigger after record passes recorded values into the context builder.
- Trigger without record keeps previous values zeroed.
- UI render: empty state text renders on initialization; populated state shows labeled sections with formatted values.

## Status
- [ ] Not started
- [ ] In progress
- [x] Completed

## Outcome
Updated scope to reflect existing controller/unit coverage and added a single unit assertion for the recorded-state empty view. No production code changes; no integration tests added.
