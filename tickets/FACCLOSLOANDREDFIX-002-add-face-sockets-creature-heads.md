# FACCLOSLOANDREDFIX-002: Add Face Sockets to Creature Head Entities

## Summary

Add three new clothing-specific anatomy sockets (`nose_covering`, `mouth_covering`, `face_lower`) to creature head entity definitions in the anatomy-creatures mod that have humanoid-compatible facial structures.

## Context

Creature variants (cat-girls, hyena-folk, toad-folk, etc.) need the same face covering capability as humanoids for consistency. Non-humanoid creatures (dragons, krakens, chickens) may not need these sockets.

## Files to Touch

### Must Evaluate and Potentially Modify

Review each creature head entity and add face sockets if the creature has a humanoid-style face:

1. `data/mods/anatomy-creatures/entities/definitions/hyena_folk_head.entity.json` - **ADD** (humanoid hybrid)
2. `data/mods/anatomy-creatures/entities/definitions/toad_folk_head.entity.json` - **ADD** (humanoid hybrid)
3. `data/mods/anatomy-creatures/entities/definitions/centaur_head.entity.json` - **ADD** (humanoid face)

### Files to NOT Modify (non-humanoid faces)

These creatures have non-humanoid facial structures and should NOT receive face covering sockets:

- `data/mods/anatomy-creatures/entities/definitions/dragon_head.entity.json` - muzzle-based
- `data/mods/anatomy-creatures/entities/definitions/kraken_head.entity.json` - tentacle-based
- `data/mods/anatomy-creatures/entities/definitions/chicken_head*.entity.json` - beak-based
- `data/mods/anatomy-creatures/entities/definitions/tortoise_head.entity.json` - shell-based

## Out of Scope

- DO NOT modify humanoid head entities (handled in FACCLOSLOANDREDFIX-001)
- DO NOT modify the slot library (handled in FACCLOSLOANDREDFIX-003)
- DO NOT modify part files (handled in FACCLOSLOANDREDFIX-005)
- DO NOT modify schemas
- DO NOT add sockets to non-humanoid creature heads (dragons, krakens, chickens, tortoises)
- DO NOT add or remove any other sockets besides the 3 specified

## Implementation Details

For each applicable creature head entity file, add the following 3 sockets to the `anatomy:sockets` component's `sockets` array:

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

**Decision Criteria for Adding Sockets:**
- Entity represents a humanoid hybrid (folk variants) → ADD sockets
- Entity has a humanoid-style face structure → ADD sockets
- Entity has muzzle/beak/tentacle face → DO NOT add sockets

## Acceptance Criteria

### Tests That Must Pass

1. All existing anatomy-creatures unit tests continue to pass: `npm run test:unit -- --testPathPattern="anatomy-creatures"`
2. All existing anatomy-creatures integration tests continue to pass: `npm run test:integration -- --testPathPattern="anatomy-creatures"`
3. Schema validation passes: `npm run validate`
4. JSON files are valid: Each modified file can be parsed by `JSON.parse()`

### Invariants That Must Remain True

1. **Socket ID uniqueness**: No duplicate socket IDs exist within each head entity
2. **Existing sockets preserved**: All pre-existing sockets remain unchanged
3. **JSON structure valid**: All files remain valid JSON with proper syntax
4. **Component structure**: The `anatomy:sockets` component structure is not altered beyond adding to the `sockets` array
5. **Socket allowedTypes**: All 3 new sockets must have `allowedTypes: ["clothing"]` only
6. **Consistent with humanoid**: Socket definitions match exactly those in FACCLOSLOANDREDFIX-001
7. **Non-humanoid untouched**: Dragon, kraken, chicken, tortoise heads remain completely unchanged

### Manual Verification

After implementation:
1. `npm run validate` completes without errors
2. Verify hyena_folk_head.entity.json contains the 3 new sockets
3. Verify dragon_head.entity.json does NOT contain the new sockets

## Dependencies

- FACCLOSLOANDREDFIX-001 should be done first (establishes the pattern)

## Blocked By

- Nothing (can run in parallel with FACCLOSLOANDREDFIX-001)

## Blocks

- FACCLOSLOANDREDFIX-005 (needs sockets to exist before mappings can reference them)
