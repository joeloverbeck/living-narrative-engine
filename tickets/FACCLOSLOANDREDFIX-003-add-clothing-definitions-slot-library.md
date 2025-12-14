# FACCLOSLOANDREDFIX-003: Add Face Clothing Definitions to Slot Library

## Summary

Add three new clothing definition entries (`standard_nose_covering`, `standard_mouth_covering`, `standard_face_lower`) to the humanoid slot library's `clothingDefinitions` section.

## Context

The slot library defines reusable clothing slot specifications that parts can reference via `$use` directives. Before part files can map the new face slots, the library must define what those slots look like (which sockets they use, allowed layers, etc.).

## Files to Touch

### Must Modify (1 file)

1. `data/mods/anatomy/libraries/humanoid.slot-library.json`

## Out of Scope

- DO NOT modify head entity files (handled in FACCLOSLOANDREDFIX-001, FACCLOSLOANDREDFIX-002)
- DO NOT modify part files (handled in FACCLOSLOANDREDFIX-005)
- DO NOT modify coverage_mapping component (handled in FACCLOSLOANDREDFIX-004)
- DO NOT add `defaultClothingSlotMappings` yet (handled in FACCLOSLOANDREDFIX-008)
- DO NOT modify any schemas
- DO NOT modify `slotDefinitions` section
- DO NOT modify existing `clothingDefinitions` entries

## Implementation Details

Add the following 3 entries to the `clothingDefinitions` object in the slot library:

```json
{
  "clothingDefinitions": {
    // ... existing definitions remain unchanged ...

    "standard_nose_covering": {
      "anatomySockets": ["nose_covering"],
      "allowedLayers": ["base", "accessories"]
    },
    "standard_mouth_covering": {
      "anatomySockets": ["mouth_covering"],
      "allowedLayers": ["base", "armor"]
    },
    "standard_face_lower": {
      "anatomySockets": ["face_lower"],
      "allowedLayers": ["base", "outer", "armor"]
    }
  }
}
```

### Layer Rationale (for review reference)

- `nose_covering`:
  - `base`: functional items (nose clips)
  - `accessories`: decorative (nose rings)

- `mouth_covering`:
  - `base`: gags, mouthpieces
  - `armor`: protective mouth guards, bite guards

- `face_lower`:
  - `base`: cloth masks, veils
  - `outer`: cloaks with face coverage, hoods
  - `armor`: respirators, gas masks, protective gear

## Acceptance Criteria

### Tests That Must Pass

1. Schema validation passes: `npm run validate`
2. Slot library remains valid JSON: `JSON.parse()` succeeds
3. All existing anatomy tests pass: `npm run test:unit -- --testPathPattern="anatomy"`
4. All existing clothing tests pass: `npm run test:unit -- --testPathPattern="clothing"`

### Invariants That Must Remain True

1. **Existing definitions unchanged**: All pre-existing `clothingDefinitions` entries remain exactly as they were
2. **Valid JSON structure**: File remains valid JSON with proper syntax
3. **Socket references valid**: The `anatomySockets` arrays reference sockets that will exist after FACCLOSLOANDREDFIX-001/002
4. **Layer values valid**: All `allowedLayers` values are from the valid set: `underwear`, `base`, `armor`, `outer`, `accessories`
5. **Definition naming convention**: New definitions follow the `standard_*` naming pattern
6. **No duplicate keys**: No duplicate keys in `clothingDefinitions` object

### Manual Verification

After implementation:
1. `npm run validate` completes without errors
2. Can parse the file with `node -e "console.log(JSON.parse(require('fs').readFileSync('data/mods/anatomy/libraries/humanoid.slot-library.json')).clothingDefinitions)"`
3. Verify `standard_nose_covering`, `standard_mouth_covering`, `standard_face_lower` exist

## Dependencies

- FACCLOSLOANDREDFIX-001 and FACCLOSLOANDREDFIX-002 should complete first (creates the sockets these definitions reference)

## Blocked By

- Nothing (can be done in parallel, but socket references won't resolve until FACCLOSLOANDREDFIX-001/002)

## Blocks

- FACCLOSLOANDREDFIX-005 (part files need these definitions to $use)
- FACCLOSLOANDREDFIX-008 (defaultClothingSlotMappings will reference these definitions)
