# FACCLOSLOANDREDFIX-004: Update coverage_mapping Component Enum

## Summary

Add three new enum values (`nose_covering`, `mouth_covering`, `face_lower`) to the `covers` property enum in the coverage_mapping component schema.

## Context

The `clothing:coverage_mapping` component uses an enum to define valid clothing slot coverage areas. New clothing items targeting face slots need these values added to the enum for schema validation to pass.

## Files to Touch

### Must Modify (1 file)

1. `data/mods/clothing/components/coverage_mapping.component.json`

## Out of Scope

- DO NOT modify head entity files
- DO NOT modify the slot library
- DO NOT modify part files
- DO NOT modify any schemas in `data/schemas/`
- DO NOT add or remove any other enum values
- DO NOT modify any other properties in the component

## Implementation Details

Locate the `covers` property schema and add 3 new values to its `items.enum` array:

**Current (example):**
```json
{
  "covers": {
    "type": "array",
    "items": {
      "type": "string",
      "enum": [
        "torso_upper",
        "torso_lower",
        "legs",
        "feet",
        "head_gear",
        "hands",
        "left_arm_clothing",
        "right_arm_clothing"
      ]
    }
  }
}
```

**After modification:**
```json
{
  "covers": {
    "type": "array",
    "items": {
      "type": "string",
      "enum": [
        "torso_upper",
        "torso_lower",
        "legs",
        "feet",
        "head_gear",
        "hands",
        "left_arm_clothing",
        "right_arm_clothing",
        "nose_covering",
        "mouth_covering",
        "face_lower"
      ]
    }
  }
}
```

**Notes:**
- Add the 3 new values at the end of the enum array (or maintain alphabetical order if that's the convention)
- Verify the exact current structure by reading the file first
- The values must exactly match: `nose_covering`, `mouth_covering`, `face_lower`

## Acceptance Criteria

### Tests That Must Pass

1. Schema validation passes: `npm run validate`
2. Component file remains valid JSON
3. All existing clothing tests pass: `npm run test:unit -- --testPathPattern="clothing"`
4. All existing clothing integration tests pass: `npm run test:integration -- --testPathPattern="clothing"`

### Invariants That Must Remain True

1. **Existing enum values unchanged**: All pre-existing enum values remain exactly as they were
2. **Valid JSON structure**: File remains valid JSON with proper syntax
3. **No duplicates**: No duplicate values in the enum array
4. **Enum value format**: Values use snake_case (matching existing convention)
5. **Component ID unchanged**: The component's `id` property remains unchanged
6. **dataSchema structure**: Only the `items.enum` array within `covers` is modified

### Manual Verification

After implementation:
1. `npm run validate` completes without errors
2. Can validate a test payload with `covers: ["face_lower"]` against the schema
3. Existing clothing items with `covers` arrays still validate

## Dependencies

- None (independent of socket and library changes)

## Blocked By

- Nothing (can be done in parallel with other Phase 1 tickets)

## Blocks

- Nothing directly, but clothing items using new slots need this for validation
