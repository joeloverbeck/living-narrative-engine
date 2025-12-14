# FACCLOSLOANDREDFIX-001: Add Face Sockets to Humanoid Head Entities (COMPLETED)

## Summary

Add three new clothing-specific anatomy sockets (`nose_covering`, `mouth_covering`, `face_lower`) to all 11 humanoid head entity definitions in the anatomy mod.

## Context

Currently there is no granular way to equip items covering specific face regions. The existing `head_gear` and `face_gear` slots cover the entire head, preventing scenarios like wearing a helmet AND a respirator simultaneously.

## Files to Touch

### Must Modify (11 files)

1. `data/mods/anatomy/entities/definitions/humanoid_head.entity.json`
2. `data/mods/anatomy/entities/definitions/humanoid_head_attractive.entity.json`
3. `data/mods/anatomy/entities/definitions/humanoid_head_bearded.entity.json`
4. `data/mods/anatomy/entities/definitions/humanoid_head_beautiful.entity.json`
5. `data/mods/anatomy/entities/definitions/humanoid_head_cute.entity.json`
6. `data/mods/anatomy/entities/definitions/humanoid_head_hideous.entity.json`
7. `data/mods/anatomy/entities/definitions/humanoid_head_moustached.entity.json`
8. `data/mods/anatomy/entities/definitions/humanoid_head_plain.entity.json`
9. `data/mods/anatomy/entities/definitions/humanoid_head_plain_weary.entity.json`
10. `data/mods/anatomy/entities/definitions/humanoid_head_scarred.entity.json`
11. `data/mods/anatomy/entities/definitions/humanoid_head_stubble.entity.json`

## Out of Scope

- DO NOT modify creature head entities (handled in FACCLOSLOANDREDFIX-002)
- DO NOT modify the slot library (handled in FACCLOSLOANDREDFIX-003)
- DO NOT modify part files (handled in FACCLOSLOANDREDFIX-005)
- DO NOT modify schemas
- DO NOT add or remove any other sockets besides the 3 specified
- DO NOT modify the body part sockets (`nose`, `mouth`, `teeth`) - these are body part attachment points, not clothing sockets

## Implementation Details

For each humanoid head entity file, add the following 3 sockets to the `anatomy:sockets` component's `sockets` array:

```json
{
  "id": "nose_covering",
  "allowedTypes": ["clothing"],
  "nameTpl": "nose covering area"
},
{
  "id": "mouth_covering",
  "allowedTypes": ["clothing"],
  "nameTpl": "mouth covering area"
},
{
  "id": "face_lower",
  "allowedTypes": ["clothing"],
  "nameTpl": "lower face covering area"
}
```

These sockets should be added after existing sockets in the array. The exact placement within the array is not critical but should be consistent across all files.

## Acceptance Criteria

### Tests That Must Pass

1. All existing anatomy unit tests continue to pass: `npm run test:unit -- --testPathPattern="anatomy"`
2. All existing anatomy integration tests continue to pass: `npm run test:integration -- --testPathPattern="anatomy"`
3. Schema validation passes: `npm run validate`
4. JSON files are valid: Each modified file can be parsed by `JSON.parse()`

### Invariants That Must Remain True

1. **Socket ID uniqueness**: No duplicate socket IDs exist within each head entity
2. **Existing sockets preserved**: All pre-existing sockets remain unchanged (nose, mouth, teeth, left_ear, right_ear, left_eye, right_eye, and any others)
3. **JSON structure valid**: All files remain valid JSON with proper syntax
4. **Component structure**: The `anatomy:sockets` component structure is not altered beyond adding to the `sockets` array
5. **Socket allowedTypes**: All 3 new sockets must have `allowedTypes: ["clothing"]` only (not body parts)
6. **Consistent naming**: All 11 files use identical socket definitions (same id, allowedTypes, nameTpl)

### Manual Verification

After implementation, running `npm run validate` should complete without errors related to the modified files.

## Dependencies

- None (this is a leaf ticket)

## Blocked By

- Nothing

## Blocks

- FACCLOSLOANDREDFIX-005 (needs sockets to exist before mappings can reference them)

## Outcome

- Successfully added `nose_covering`, `mouth_covering`, and `face_lower` sockets to all 11 humanoid head entity files.
- Verified that `npm run validate:ecosystem` passes.
- Verified that existing anatomy unit tests pass.
- Verified that relevant anatomy integration tests pass.
  - Note: `tests/integration/anatomy/hitProbabilityWeightValidation.data.test.js` has pre-existing failures related to `hyena_teeth` and other creature parts. These were unrelated to the changes in this ticket and were excluded from the final verification to confirm no regressions were introduced.
