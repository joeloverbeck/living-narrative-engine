# Improve Part Availability Error Messages

## Files to Touch
- `src/anatomy/validation/validators/PartAvailabilityValidator.js`

## Out of Scope
- Changing the logic of `EntityMatcherService`.
- Changing the schema of `PartAvailabilityValidator` output structure (only message/details content).

## Acceptance Criteria

### Specific Tests
- **Unit Test (`tests/unit/anatomy/validators/PartAvailabilityValidator.test.js`):**
    - Mock `EntityMatcherService` to return no matches.
    - Create a recipe slot with `properties` filter.
    - Assert the error message contains a hint: "Check that 'properties' matches exact values in entity components. It is a filter, not an override."
    - Create a recipe slot WITHOUT `properties`.
    - Assert the error message DOES NOT contain the specific hint about properties (or keeps it generic).

### Invariants
- Existing error codes/types (`PART_UNAVAILABLE`) must remain the same to avoid breaking downstream tools.
- The validator must still fail (severity: error) when parts are missing.
