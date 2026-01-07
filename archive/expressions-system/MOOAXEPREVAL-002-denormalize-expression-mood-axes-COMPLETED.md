# MOOAXEPREVAL-002: De-normalize Mood Axes Thresholds in Expressions

## Summary

Update existing expression prerequisites that use normalized mood axis thresholds so they use raw -100..100 values, and fix the horror_revulsion spike check to avoid mixed scales by aligning all deltas to raw mood axis scale.

## Background

Several expressions compare mood axes against fractional values that appear normalized. The project standard is raw mood axes values in -100..100, and the horror_revulsion delta check currently mixes raw mood axes with normalized emotion deltas. Mood axes are defined as integers in `data/mods/core/components/mood.component.json`, while emotion/sexual state lookups in `data/mods/core/lookups/` use normalized 0..1 weights/gates, so mixed-scale comparisons inside expressions should favor raw mood axes and scale emotion deltas up (x100) instead of normalizing mood axes down.

## File List (Expected to Touch)

### Existing Files
- `data/mods/emotions/expressions/amused_chuckle.expression.json`
- `data/mods/emotions/expressions/confident_composure.expression.json`
- `data/mods/emotions/expressions/optimistic_lift.expression.json`
- `data/mods/emotions/expressions/horror_revulsion.expression.json`
- `tests/integration/expressions/expressionPrerequisites.complex.integration.test.js`

## Out of Scope (MUST NOT Change)

- Validator logic in `src/validation/`
- Validator logic in `src/validation/` (already enforces mood-axis integer thresholds + mixed-scale warnings)
- Any other mod data outside the four listed expression files

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate`
2. `npm run test:integration -- --runInBand --coverage=false tests/integration/expressions/expressionPrerequisites.complex.integration.test.js`

### Invariants That Must Remain True

1. Expression IDs, prerequisite counts, and file formatting remain unchanged aside from the specified numeric threshold updates.
2. Mood axes thresholds in these files are raw integer values in -100..100.
3. The horror_revulsion spike check uses a single scale (raw mood axes) with emotion deltas scaled to match.

## Status

Completed.

## Outcome

- Updated mood axis thresholds in the four expression files to raw -100..100 values.
- Reworked horror_revulsion spike check to scale emotion deltas by 100 and compare against a raw threshold.
- Updated the targeted integration test expectations to match the new raw thresholds and scaling.
