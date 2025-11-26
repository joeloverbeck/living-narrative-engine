# NONDETACTSYS-002: Create Damage Types Mod with Marker Components

## Summary

Create the `damage-types` mod with marker components that indicate what types of damage an entity can deal. The initial implementation includes the `can_cut` marker component for slashing/cutting weapons.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/damage-types/mod-manifest.json` | Mod manifest with core dependency |
| `data/mods/damage-types/components/can_cut.component.json` | Marker for cutting damage capability |

## Files to Modify

| File | Change |
|------|--------|
| `data/game.json` | Add `damage-types` to the mods array |

## Implementation Details

### mod-manifest.json

```json
{
  "id": "damage-types",
  "version": "1.0.0",
  "name": "Damage Types System",
  "description": "Marker components for entity damage capabilities",
  "dependencies": ["core"]
}
```

### can_cut.component.json

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "damage-types:can_cut",
  "description": "Marker indicating entity can deal cutting damage",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

## Out of Scope

- **DO NOT** create additional damage type markers (can_pierce, can_bludgeon, etc.) - future tickets
- **DO NOT** create any service files in `src/`
- **DO NOT** modify weapon entity definitions (separate ticket NONDETACTSYS-015)
- **DO NOT** create tests (component validation is handled by existing schema validation)
- **DO NOT** modify any schema files
- **DO NOT** create damage calculation services

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate mod structure
npm run validate

# Full schema validation
npm run test:ci
```

### Invariants That Must Remain True

- [ ] All component files pass JSON schema validation
- [ ] Component ID follows `damage-types:[name]` namespace convention
- [ ] Component references the correct schema
- [ ] `data/game.json` contains `damage-types` in mods array
- [ ] Mod loads successfully in game initialization
- [ ] No modifications to existing mods or schemas

### Manual Verification

1. Run `npm run dev` and verify no errors during mod loading
2. Verify `damage-types` mod appears in loaded mods list
3. Verify `can_cut` component is registered

## Directory Structure

After completion:

```
data/mods/damage-types/
├── mod-manifest.json
└── components/
    └── can_cut.component.json
```

## Dependencies

- **Depends on**: Nothing (foundation ticket)
- **Blocked by**: Nothing
- **Blocks**: NONDETACTSYS-015 (weapon entities need damage type component to add)

## Reference Files

| File | Purpose |
|------|---------|
| `data/mods/core/mod-manifest.json` | Manifest pattern reference |
| `data/mods/anatomy/components/grabbable.component.json` | Marker component pattern (empty schema) |
| `data/schemas/component.schema.json` | Component schema reference |

## Future Extensibility

This mod is designed to support future damage types:
- `can_pierce` - Piercing damage (arrows, spears)
- `can_bludgeon` - Blunt damage (hammers, fists)
- `can_burn` - Fire damage
- `can_freeze` - Cold damage
- `can_shock` - Electrical damage

These will be added in future tickets as needed.
