# FRAIMMRIGSTR-006B: Add Rigid Structure Component to Exoskeletal Entities

## Status
Completed

## Summary
Add the `anatomy:has_rigid_structure` component to creature entity definitions that have exoskeletal structure (chitin for arthropods, shell for tortoises). This is a data-only change; the component schema already exists.

## Background
Exoskeletal creatures have rigid external structures that can fracture. This ticket covers non-bone rigid structures with appropriate `structureType` values:
- Spider/arthropod parts → `"chitin"`
- Tortoise shell parts → `"shell"`

## File List

### Files to Modify (~6 files)

#### Spider/Arthropod Parts (structureType: "chitin")
- `data/mods/anatomy-creatures/entities/definitions/spider_abdomen.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/spider_cephalothorax.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/spider_leg.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/spider_pedipalp.entity.json`

#### Tortoise Shell Parts (structureType: "shell")
- `data/mods/anatomy-creatures/entities/definitions/tortoise_carapace.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_plastron.entity.json`

## Out of Scope

### DO NOT Modify - Soft Tissue (No rigid structure)
- `spider_spinneret.entity.json` - silk-producing organ, soft tissue
- `*_tentacle.entity.json` - all tentacles are soft tissue
- `*_mantle.entity.json` - soft body mass
- Any eye, ear, or internal organ entities

### DO NOT Modify - Different Ticket
- Bony skeletal parts (FRAIMMRIGSTR-006A - bone)
- Human entities (FRAIMMRIGSTR-004, FRAIMMRIGSTR-005)

### DO NOT Modify - Other
- Source code in `src/`
- Tests (unless validation or new coverage requirements demand it)

## Implementation Details

### For Spider/Arthropod Parts
Add to the `components` object:
```json
"anatomy:has_rigid_structure": {
  "structureType": "chitin"
}
```

### For Tortoise Shell Parts
Add to the `components` object:
```json
"anatomy:has_rigid_structure": {
  "structureType": "shell"
}
```

### Structure Type Selection
- **chitin**: Spider legs, cephalothorax, abdomen, pedipalps (arthropod exoskeleton)
- **shell**: Tortoise carapace (dorsal shell), plastron (ventral shell)

Note: `spider_spinneret` is soft tissue (silk production) and should NOT have rigid structure.

## Acceptance Criteria

### Tests That Must Pass
```bash
npm run validate
npm run test:unit
```
- Schema validation passes for all modified files
- All unit tests continue to pass
- No validation errors in mod loading

### Invariants That Must Remain True
- All existing components in each file remain unchanged
- Only the new `anatomy:has_rigid_structure` component is added
- Spider parts use `"structureType": "chitin"`
- Tortoise shell parts use `"structureType": "shell"`
- JSON formatting remains consistent (2-space indentation)
- Spider spinneret is NOT modified

## Estimated Diff Size
~6 files, ~4 lines added per file = ~24 lines total

## Dependencies
- None (component schema already exists via FRAIMMRIGSTR-001)

## Blocked By
- None (component schema already exists)

## Blocks
- FRAIMMRIGSTR-008 (E2E tests need entity data)

## Outcome
- Added `anatomy:has_rigid_structure` with `"structureType": "chitin"` to spider abdomen, cephalothorax, leg, and pedipalp entity definitions.
- Added `anatomy:has_rigid_structure` with `"structureType": "shell"` to tortoise carapace and plastron entity definitions.
- No code changes or test edits were required beyond validation and unit test runs.
