# Improve Part Availability Error Messages

**Status**: ✅ COMPLETED

## Files Touched

- `src/anatomy/validation/validators/PartAvailabilityValidator.js`
- `tests/unit/anatomy/validation/validators/PartAvailabilityValidator.test.js`

## Out of Scope

- Changing the logic of `EntityMatcherService`.
- Changing the schema of `PartAvailabilityValidator` output structure (only message/details content).

## Acceptance Criteria

### Specific Tests

- **Unit Test (`tests/unit/anatomy/validation/validators/PartAvailabilityValidator.test.js`):**
  - Mock `EntityMatcherService` to return no matches.
  - Create a recipe slot with `properties` filter.
  - Assert the error message contains a hint: "Check that 'properties' matches exact values in entity components. It is a filter, not an override."
  - Create a recipe slot WITHOUT `properties`.
  - Assert the error message DOES NOT contain the specific hint about properties (or keeps it generic).

### Invariants

- Existing error codes/types (`PART_UNAVAILABLE`) must remain the same to avoid breaking downstream tools.
- The validator must still fail (severity: error) when parts are missing.

---

## Outcome

### Originally Planned

- Add conditional hint to error messages when `properties` filter is used
- Add tests to verify hint presence/absence based on properties usage

### Actually Changed

**PartAvailabilityValidator.js:**

- Added `hasProperties` check before building error messages
- Slot message now conditionally appends: `. Check that 'properties' matches exact values in entity components. It is a filter, not an override.`
- Pattern message now conditionally appends the same hint

**PartAvailabilityValidator.test.js:**

- Updated existing test `records PART_UNAVAILABLE error when a slot has no matches` to expect the hint (since it uses properties)
- Updated existing test `aggregates multiple slot and pattern errors` to expect the hint on pattern error
- Added new test: `includes properties filter hint when slot uses properties`
- Added new test: `excludes properties filter hint when slot has no properties`

### Test Results

All 12 tests pass:

- 3 constructor tests
- 9 performValidation tests (including 2 new tests)

### Ticket Correction Made

Fixed test file path from `tests/unit/anatomy/validators/` to `tests/unit/anatomy/validation/validators/`
