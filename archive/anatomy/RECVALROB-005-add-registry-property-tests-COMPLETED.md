# Add Body Descriptor Registry Property Tests

**Status: ✅ COMPLETED**

## Files to Touch

- `tests/property/anatomy/bodyDescriptorRegistry.property.test.js` (New file)

## Out of Scope

- Changing `bodyDescriptorRegistry.js`.
- Changing `RecipeBodyDescriptorValidator.js`.

## Acceptance Criteria

### Specific Tests

- **Descriptor Exhaustiveness:**
  - Iterate over every key in `BODY_DESCRIPTOR_REGISTRY`.
  - If `validValues` is not null:
    - Iterate over every value in `validValues`.
    - Assert that `validateDescriptorValue(key, value)` returns `true`.
- **Registry Structure:**
  - Assert every entry has the 9 required properties:
    - `schemaProperty` (string)
    - `displayLabel` (string)
    - `displayKey` (string)
    - `dataPath` (string)
    - `validValues` (array | null)
    - `displayOrder` (number)
    - `extractor` (function)
    - `formatter` (function)
    - `required` (boolean)
  - Assert `validValues` is either `null` or an `Array`.

### Invariants

- Use `jest` with `fast-check` for property-based testing.
- Must run via `npm run test:property`.

---

## Outcome

### What Was Originally Planned

The original ticket incorrectly assumed the registry had:

- `id`, `displayName`, `description`, `displayOrder` fields

### What Was Actually Changed

1. **Ticket Corrected**: Updated assumptions to match actual registry structure with 9 properties:
   - `schemaProperty`, `displayLabel`, `displayKey`, `dataPath`, `validValues`, `displayOrder`, `extractor`, `formatter`, `required`

2. **Property Test File Created**: `tests/property/anatomy/bodyDescriptorRegistry.property.test.js`
   - 15 property-based tests covering:
     - Descriptor exhaustiveness (valid values accepted)
     - Invalid value rejection for enumerated descriptors
     - Free-form descriptor acceptance
     - Registry structure validation
     - Consistency checks (unique displayOrder, key-schemaProperty matching)
     - Extractor/formatter behavior

3. **Tests Verified**: All 15 tests pass via `npm run test:property`

### Files Modified

| File                                                             | Action                   |
| ---------------------------------------------------------------- | ------------------------ |
| `tickets/RECVALROB-005-add-registry-property-tests.md`           | Corrected, then archived |
| `tests/property/anatomy/bodyDescriptorRegistry.property.test.js` | Created (new)            |

### Test Coverage Summary

```
PASS tests/property/anatomy/bodyDescriptorRegistry.property.test.js
  Body Descriptor Registry - Property Tests
    Descriptor Exhaustiveness
      ✓ should accept all validValues for each descriptor via validateDescriptorValue
      ✓ should reject invalid values for enumerated descriptors
      ✓ should accept any non-empty string for free-form descriptors
    Registry Structure
      ✓ should have all required properties for each entry
      ✓ should have validValues as null or Array for each entry
      ✓ should have positive displayOrder for each entry
      ✓ should have callable extractor function for each entry
      ✓ should have callable formatter function for each entry
      ✓ should have boolean required field for each entry
      ✓ should have string type for schemaProperty, displayLabel, displayKey, dataPath
    Registry Consistency
      ✓ should have unique displayOrder values across entries
      ✓ should match registry keys with schemaProperty values
      ✓ should have valid dataPath format for each entry
    Extractor and Formatter Behavior
      ✓ should not throw when extractor is called with undefined body component
      ✓ should return string from formatter for any value

Tests: 15 passed
```
