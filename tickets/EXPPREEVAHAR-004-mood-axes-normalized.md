# EXPPREEVAHAR-004: Add moodAxesNormalized and Document Value Ranges

## Summary

Add `moodAxesNormalized` to expression evaluation context and document the expected numeric ranges for all prerequisite context fields to remove ambiguity.

## Background

`moodAxes` values are raw (-100..100) while emotions and sexual states are normalized (0..1). Adding a normalized field plus explicit docs prevents accidental scale confusion.

## File List (Expected to Touch)

### Existing Files
- `src/expressions/expressionContextBuilder.js`
- `docs/json-logic/json-logic for modders.md`
- `tests/unit/expressions/expressionContextBuilder.test.js`

## Out of Scope (MUST NOT Change)

- Expression prerequisite validation rules (handled in EXPPREEVAHAR-001)
- Strict-mode behavior (handled in EXPPREEVAHAR-003)
- Expression data files in `data/mods/emotions/expressions/`

## Implementation Details

- Extend the context builder to include `moodAxesNormalized` with values mapped to `[-1, 1]` (raw value divided by 100, clamped if needed).
- Update the JSON Logic modder guide to explicitly list context roots and their ranges:
  - `emotions.*` in `[0, 1]`
  - `sexualStates.*` in `[0, 1]`
  - `sexualArousal` in `[0, 1]`
  - `moodAxes.*` in `[-100, 100]`
  - `moodAxesNormalized.*` in `[-1, 1]`
- Add unit coverage to confirm the normalized values are included and correctly scaled.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="expressionContextBuilder"`

### Invariants That Must Remain True

1. Existing `moodAxes` values remain raw (-100..100).
2. No existing context keys are renamed or removed.
3. Normalized values are deterministic for the same raw input.

