# FACCLOSLOANDREDFIX-007: Modify Loader to Auto-Merge Library Defaults

## Summary

Update `AnatomyBlueprintLoader` to automatically merge `defaultClothingSlotMappings` from the slot library into each part's `clothingSlotMappings`, with part-level mappings taking precedence.

## Context

This is the core loader change that enables the redundancy fix. After this change:
- Parts inherit clothing slot mappings from their library by default
- Parts can override specific mappings if needed
- Empty `clothingSlotMappings` in parts means "use all library defaults"

## Files to Touch

### Must Modify (1 file)

1. `src/loaders/anatomyBlueprintLoader.js`

### Test Files to Create/Modify

1. `tests/unit/loaders/anatomyBlueprintLoader.test.js` - add/update unit tests
2. `tests/integration/loaders/anatomyBlueprintLoader.integration.test.js` - add integration tests

## Out of Scope

- DO NOT modify schema files (handled in FACCLOSLOANDREDFIX-006)
- DO NOT modify slot library data (handled in FACCLOSLOANDREDFIX-008)
- DO NOT modify part files yet (handled in FACCLOSLOANDREDFIX-009)
- DO NOT modify entity files
- DO NOT change the overall loader architecture
- DO NOT modify how `$use` references are resolved (existing functionality)

## Implementation Details

### Location

The merge logic should be added to the method that processes parts and their clothing slot mappings. Based on the class structure, this is likely in:
- `_includePart` method, OR
- `_mergeSection` method, OR
- A new private method called by one of those

### Logic (Pseudocode)

```javascript
/**
 * Merges library default clothing slot mappings with part-specific mappings.
 * Part mappings override library defaults.
 *
 * @param {object} part - The part being processed
 * @param {object} library - The slot library with potential defaultClothingSlotMappings
 * @returns {object} Merged clothing slot mappings
 */
_mergeClothingSlotMappings(part, library) {
  // Start with library defaults (if present)
  const libraryDefaults = library?.defaultClothingSlotMappings ?? {};

  // Part mappings override defaults
  const partMappings = part?.clothingSlotMappings ?? {};

  // Shallow merge - part takes precedence
  return {
    ...libraryDefaults,
    ...partMappings
  };
}
```

### Integration Points

1. **Library Loading**: When a library is loaded, store/access its `defaultClothingSlotMappings`
2. **Part Processing**: When processing a part that references a library, call the merge function
3. **$use Resolution**: The merged result should still go through existing `$use` resolution

### Edge Cases to Handle

1. **Library has no defaults**: Use empty object, rely on part mappings only
2. **Part has no mappings**: Use library defaults entirely
3. **Both empty**: Result is empty object (valid state)
4. **Part explicitly sets a slot to different value**: Part value wins
5. **Part wants to disable a library default**: Consider supporting `null` or `false` value

## Acceptance Criteria

### Tests That Must Pass

1. All existing anatomy loader tests pass
2. All existing anatomy integration tests pass
3. All existing blueprint loading tests pass
4. Schema validation passes: `npm run validate`

### New Tests Required

#### Unit Tests

```javascript
describe('AnatomyBlueprintLoader - defaultClothingSlotMappings', () => {
  it('should merge library defaults into part without clothingSlotMappings', () => {
    // Given: library with defaultClothingSlotMappings, part with no mappings
    // When: loader processes part
    // Then: part gets library defaults
  });

  it('should allow part to override library defaults', () => {
    // Given: library with default "head_gear", part with different "head_gear"
    // When: loader processes part
    // Then: part's "head_gear" is used
  });

  it('should merge library defaults with part additions', () => {
    // Given: library with "head_gear", part with "tail_accessory"
    // When: loader processes part
    // Then: result has both "head_gear" and "tail_accessory"
  });

  it('should handle library without defaultClothingSlotMappings', () => {
    // Given: library without defaultClothingSlotMappings
    // When: loader processes part
    // Then: only part mappings are used (backward compat)
  });

  it('should handle part with empty clothingSlotMappings', () => {
    // Given: library with defaults, part with empty {}
    // When: loader processes part
    // Then: library defaults are used
  });
});
```

#### Integration Tests

```javascript
describe('AnatomyBlueprintLoader - library default inheritance integration', () => {
  it('should load blueprint with inherited clothing slots', async () => {
    // Full integration test with actual files
  });
});
```

### Invariants That Must Remain True

1. **Backward compatibility**: Existing blueprints with explicit mappings work unchanged
2. **$use resolution**: The `$use` directive continues to work after merge
3. **Part override priority**: Part-level mappings always override library defaults
4. **Library isolation**: Changes to one library don't affect parts using different libraries
5. **No side effects**: Merging doesn't modify the original library or part objects
6. **Error handling**: Invalid library or part structure produces clear error messages

### Manual Verification

After implementation:
1. Load a blueprint and verify it has clothing slots from library defaults
2. Verify a part with explicit override uses its own value
3. Verify existing game behavior is unchanged

## Performance Considerations

- Merging should be done once per part load, not repeatedly
- Use shallow merge (spread operator) for simplicity and performance
- Consider caching merged results if performance becomes an issue

## Dependencies

- FACCLOSLOANDREDFIX-006 (schema must support the property first)

## Blocked By

- FACCLOSLOANDREDFIX-006 (schema support needed)

## Blocks

- FACCLOSLOANDREDFIX-008 (slot library needs this to work before adding defaults)
- FACCLOSLOANDREDFIX-009 (can't remove redundant mappings until loader handles defaults)
