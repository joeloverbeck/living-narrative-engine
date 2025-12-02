# Add Missing Validation Tests

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
