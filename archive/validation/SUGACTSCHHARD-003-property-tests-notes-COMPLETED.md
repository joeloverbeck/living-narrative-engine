# SUGACTSCHHARD-003: Property tests for suggested_action notes schema

## Goal
Add property-based coverage (tests only) to ensure `core:suggested_action` payload validation holds across mixed note arrays (with/without `subjectType`), rejects additional properties, and preserves nullable optionals. Current schema already permits `subjectType` via `structuredNote` in `common.schema.json`; the aim is to guard against regressions rather than alter the payload schema.

## File list
- tests/property/events/suggestedActionEvent.payload.property.test.js (new)
- tests/unit/schemas/suggestedActionEvent.schema.test.js (shared helpers/constants as needed)
- jest.config.property.js (only if new test suite needs wiring; already present)

## Out of scope
- Changing runtime workflow logic or dispatcher behavior
- Altering schema definitions beyond helper reuse for the property test
- Adding new dependencies beyond existing `fast-check`

## Acceptance criteria
- **Tests:**
  - `npm run test:property -- tests/property/events/suggestedActionEvent.payload.property.test.js`
  - `npm run test:unit -- tests/unit/schemas/suggestedActionEvent.schema.test.js`
- **Invariants:**
  - Property tests cover both typed and legacy notes and enforce `additionalProperties: false`
  - Optional fields (`suggestedIndex`, `descriptor`, `speech`, `thoughts`, `notes`) remain nullable as specified
  - Schema `$id`/event IDs stay unchanged and are referenced consistently in property generators

## Status
Completed.

## Outcome
- Added property-based payload validation covering mixed typed/legacy notes, nullable optionals, and additionalProperties rejections; no schema or runtime changes needed.
- Acceptance commands updated to the existing Jest scripts (`test:property`, `test:unit`).

## Tests
- `npx jest --config jest.config.property.js --env=node --runInBand tests/property/events/suggestedActionEvent.payload.property.test.js`
- `npm run test:unit -- --runInBand tests/unit/schemas/suggestedActionEvent.schema.test.js`
