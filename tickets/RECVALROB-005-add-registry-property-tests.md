# Add Body Descriptor Registry Property Tests

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
        - Assert that `RecipeBodyDescriptorValidator` accepts this value.
- **Registry Structure:**
    - Assert every entry has `id`, `displayName`, `description`, `displayOrder`.
    - Assert `validValues` is either `null` or an `Array`.

### Invariants
- Use `jest`.
- Must run via `npm run test:property`.