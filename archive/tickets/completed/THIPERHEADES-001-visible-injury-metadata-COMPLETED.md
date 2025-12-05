# THIPERHEADES-001: Expose visible/vital organ metadata in InjuryAggregationService

Status: Completed

Add explicit metadata to aggregated injury parts so downstream formatters can filter out vital organs when composing "visible injuries" text. Current service already exposes `vitalOrganCap` for health math but does **not** include a boolean/flag that callers can use to hide organs; there is no existing visibility marker for externals, so scope is limited to marking vital organs only.

## File list
- src/anatomy/services/injuryAggregationService.js
- tests/unit/anatomy/services/injuryAggregationService.test.js

## Out of scope
- Any formatter text changes (first-person or third-person).
- UI rendering or description composition updates.
- Dependency registration changes.

## Acceptance criteria
- Tests:
  - `npm run test:unit -- src/anatomy/services/injuryAggregationService.test.js` includes new/updated cases that confirm each aggregated body part carries an `isVitalOrgan` (or equivalent) flag derived from `anatomy:vital_organ` and that non-vital parts remain unaffected.
  - Existing InjuryAggregationService unit tests continue to pass without output regressions.
- Invariants:
  - Aggregate output shape (aside from the new boolean flag) remains backward compatible for current consumers, preserving `vitalOrganCap` and all health calculations.
  - No changes to first-person Physical Condition narrative generation or health state calculations.

## Outcome
- Added `isVitalOrgan` boolean to aggregated parts derived from `anatomy:vital_organ`, keeping `vitalOrganCap` intact.
- Verified unit coverage for vital vs. non-vital parts and error handling paths; no formatter or UI changes introduced.
