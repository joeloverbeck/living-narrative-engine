# Add Missing Validation Tests

**Status**: COMPLETED

## Files to Touch
- `tests/unit/anatomy/validators/RecipeBodyDescriptorValidator.test.js` (New or update)
- `tests/unit/anatomy/services/entityMatcherService.test.js` (Update)
- `tests/integration/anatomy/RecipeValidationFlow.test.js` (New or update)

## Out of Scope
- Modifying `RecipeBodyDescriptorValidator.js` or `entityMatcherService.js` logic (only tests).

## Acceptance Criteria

### Specific Tests
- **Body Descriptor Validator:**
    - Test: Invalid enumerated value (e.g., `height: "giganticish"`) fails.
    - Test: Valid enumerated value passes.
    - Test: Free-form descriptor (e.g., `smell`) accepts any string.
- **Entity Matcher Service:**
    - Test: `#matchesPropertyValues` returns `false` if entity lacks the component.
    - Test: `#matchesPropertyValues` returns `false` if value mismatches.
    - Test: `#matchesPropertyValues` returns `true` on exact match.
- **Integration:**
    - Test: Full recipe validation fails if blueprint is unregistered (mock manifest or use real one).

### Invariants
- Tests must pass with current code (this is filling coverage gaps).

---

## Outcome

### Resolution: Closed as Already Complete

Upon investigation, **all requested tests already exist** in the codebase. The ticket was based on outdated assumptions about test coverage.

### Discrepancies Found

| Ticket Claim | Reality | Resolution |
|--------------|---------|------------|
| `RecipeBodyDescriptorValidator.test.js` needs tests | File exists with 450 lines, all requested tests present | **No action needed** |
| Test: Invalid enum value fails | Covered in lines 212-234 | **Already exists** |
| Test: Valid enum value passes | Covered in lines 172-183 | **Already exists** |
| Test: Free-form descriptor accepts any string | Covered in lines 282-299 | **Already exists** |
| `entityMatcherService.test.js` needs `#matchesPropertyValues` tests | Method is PRIVATE (`#`), tested indirectly through public API | **Already covered** |
| `RecipeValidationFlow.test.js` integration test | File doesn't exist, but `recipeBodyDescriptorsValidation.integration.test.js` exists | **Naming mismatch** |
| Blueprint unregistered test | Exists in `BlueprintExistenceValidator.test.js` lines 98-114 | **Already exists** |

### Existing Test Coverage Locations

| Requested Test | Existing Location |
|----------------|-------------------|
| Invalid enum value fails | `tests/unit/anatomy/validation/validators/RecipeBodyDescriptorValidator.test.js:212-234` |
| Valid enum value passes | `tests/unit/anatomy/validation/validators/RecipeBodyDescriptorValidator.test.js:172-183` |
| Free-form descriptor accepts string | `tests/unit/anatomy/validation/validators/RecipeBodyDescriptorValidator.test.js:282-299` |
| Missing component returns false | `tests/unit/anatomy/services/entityMatcherService.test.js:130-140` (via `torso_missing_skin` scenario) |
| Value mismatch returns false | `tests/unit/anatomy/services/entityMatcherService.test.js:173-193` |
| Exact match returns true | `tests/unit/anatomy/services/entityMatcherService.test.js:91-111` |
| Blueprint unregistered fails | `tests/unit/anatomy/validation/validators/BlueprintExistenceValidator.test.js:98-114` |

### Notes

1. **Private Method Testing**: The ticket requested tests for `#matchesPropertyValues`, but this is a private method (JavaScript `#` prefix). Best practice is to test private methods indirectly through the public API, which the existing tests already do.

2. **File Path Discrepancy**: The ticket referenced `tests/unit/anatomy/validators/` but the actual path is `tests/unit/anatomy/validation/validators/`.

3. **Integration Test Naming**: The ticket suggested `RecipeValidationFlow.test.js` but the existing integration test is named `recipeBodyDescriptorsValidation.integration.test.js`.

### Changes Made
- **No source code changes** - all requested tests already exist
- **No new test files created** - coverage is complete
- Ticket moved to archive with this outcome documentation
