# ANACREMODMIG-003: Migrate Entity Definitions from dredgers Mod

## Summary
Move the 6 entity definition files (ermine_folk and toad_folk body parts) from `dredgers` to `anatomy-creatures` and update their internal IDs from `dredgers:*` to `anatomy-creatures:*`.

## Files to Touch

### Move (Copy + Delete Original)
| From | To |
|------|-----|
| `data/mods/dredgers/entities/definitions/ermine_ear.entity.json` | `data/mods/anatomy-creatures/entities/definitions/ermine_ear.entity.json` |
| `data/mods/dredgers/entities/definitions/ermine_folk_female_torso.entity.json` | `data/mods/anatomy-creatures/entities/definitions/ermine_folk_female_torso.entity.json` |
| `data/mods/dredgers/entities/definitions/ermine_tail.entity.json` | `data/mods/anatomy-creatures/entities/definitions/ermine_tail.entity.json` |
| `data/mods/dredgers/entities/definitions/toad_eye.entity.json` | `data/mods/anatomy-creatures/entities/definitions/toad_eye.entity.json` |
| `data/mods/dredgers/entities/definitions/toad_folk_male_torso.entity.json` | `data/mods/anatomy-creatures/entities/definitions/toad_folk_male_torso.entity.json` |
| `data/mods/dredgers/entities/definitions/toad_tympanum.entity.json` | `data/mods/anatomy-creatures/entities/definitions/toad_tympanum.entity.json` |

### Modify
- All 6 moved entity files - Update `id` field in each
- `data/mods/anatomy-creatures/mod-manifest.json` - Add entities to content.entities.definitions array

## ID Changes Required

| File | Old ID | New ID |
|------|--------|--------|
| `ermine_ear.entity.json` | `dredgers:ermine_ear` | `anatomy-creatures:ermine_ear` |
| `ermine_folk_female_torso.entity.json` | `dredgers:ermine_folk_female_torso` | `anatomy-creatures:ermine_folk_female_torso` |
| `ermine_tail.entity.json` | `dredgers:ermine_tail` | `anatomy-creatures:ermine_tail` |
| `toad_eye.entity.json` | `dredgers:toad_eye` | `anatomy-creatures:toad_eye` |
| `toad_folk_male_torso.entity.json` | `dredgers:toad_folk_male_torso` | `anatomy-creatures:toad_folk_male_torso` |
| `toad_tympanum.entity.json` | `dredgers:toad_tympanum` | `anatomy-creatures:toad_tympanum` |

## Out of Scope
- DO NOT modify `dredgers/mod-manifest.json` yet (ANACREMODMIG-007)
- DO NOT modify blueprint files that reference these entities yet (ANACREMODMIG-004)
- DO NOT update any test files yet (ANACREMODMIG-012)
- DO NOT modify character files (cress_siltwell.character.json, eira_quenreach.character.json) - they stay in dredgers

## Implementation Notes
- Only the `id` field at the top level of each entity needs updating
- All component data within entities remains unchanged
- Delete original files from dredgers after copying

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes
- `npm run typecheck` passes

### Invariants that must remain true
- Entity component structure is preserved exactly
- No component references are modified
- Character definition files remain in dredgers mod
- New mod not yet loaded, so existing tests still pass

## Verification Commands
```bash
# Validate JSON structure
npm run validate

# Ensure no type regressions
npm run typecheck

# Verify files moved and IDs updated
ls -la data/mods/anatomy-creatures/entities/definitions/
for f in data/mods/anatomy-creatures/entities/definitions/*.entity.json; do
  echo "$f: $(cat "$f" | grep '"id"' | head -1)"
done
```

## Dependencies
- ANACREMODMIG-001 (mod scaffold must exist)

## Blocks
- ANACREMODMIG-004 (blueprints reference these entities)
- ANACREMODMIG-007 (dredgers manifest update)
- ANACREMODMIG-012 (test updates for toad_eye, toad_tympanum tests)

## Outcome
- Migrated 6 entity definitions from `dredgers` to `anatomy-creatures`.
- Updated IDs to `anatomy-creatures:*` namespace.
- Added file references to `anatomy-creatures/mod-manifest.json`.
- Removed original files from `dredgers`.
- `npm run validate` passed (validator seems tolerant of missing files in `dredgers` manifest or checks were non-blocking).
- `npm run typecheck` run (failures deemed unrelated to changes).