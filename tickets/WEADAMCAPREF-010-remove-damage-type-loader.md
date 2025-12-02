# WEADAMCAPREF-010: Remove DamageTypeLoader and damage-type definitions

## Summary

Remove the `DamageTypeLoader` infrastructure and global damage type definition files. This cleanup is safe because damage type data now lives inline on weapon entities via the `damage_capabilities` component.

## Dependencies

- WEADAMCAPREF-004 (DamageTypeEffectsService no longer uses registry)
- WEADAMCAPREF-009 (weapons have damage_capabilities component)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/loaders/damageTypeLoader.js` | DELETE | No longer needed |
| `data/mods/anatomy/damage-types/slashing.json` | DELETE | Data now on weapons |
| `data/mods/anatomy/damage-types/piercing.json` | DELETE | Data now on weapons |
| `data/mods/anatomy/damage-types/blunt.json` | DELETE | Data now on weapons |
| `src/dependencyInjection/registrations/loadersRegistrations.js` | UPDATE | Remove DamageTypeLoader registration |
| `src/dependencyInjection/tokens/tokens-core.js` | UPDATE | Remove DamageTypeLoader token |
| `data/mods/anatomy/mod-manifest.json` | UPDATE | Remove damageTypes content reference |
| `tests/unit/loaders/damageTypeLoader.test.js` | DELETE | If exists |

## Out of Scope

- `can_cut` component removal (WEADAMCAPREF-011)
- DamageTypeEffectsService changes (done in WEADAMCAPREF-004)
- Any weapon entity changes
- Other loader files

## Implementation Details

### Delete Loader File

Remove `src/loaders/damageTypeLoader.js` entirely.

### Delete Damage Type Definitions

Remove the following files:
- `data/mods/anatomy/damage-types/slashing.json`
- `data/mods/anatomy/damage-types/piercing.json`
- `data/mods/anatomy/damage-types/blunt.json`

Also remove the `damage-types/` directory if empty after deletions.

### Update DI Registration

In `src/dependencyInjection/registrations/loadersRegistrations.js`, remove:
```javascript
// Remove this registration
registerLoader(tokens.DamageTypeLoader, DamageTypeLoader);
```

Also remove the import statement for DamageTypeLoader.

### Update Tokens

In `src/dependencyInjection/tokens/tokens-core.js`, remove:
```javascript
// Remove this line
DamageTypeLoader: 'DamageTypeLoader',
```

### Update Mod Manifest

In `data/mods/anatomy/mod-manifest.json`, remove the `damageTypes` content section:
```json
{
  "content": {
    // Remove: "damageTypes": ["damage-types/slashing.json", ...]
  }
}
```

### Delete Tests

If `tests/unit/loaders/damageTypeLoader.test.js` exists, delete it.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:ci` - All tests pass (no references to deleted files)
2. `npm run typecheck` - No type errors from removed tokens
3. `npm run validate` - Mod validation passes

### Verification Steps

1. Search codebase for `DamageTypeLoader` - should find no references
2. Search codebase for `damageTypes` registry access - should find no references
3. Game starts without errors about missing damage types
4. Combat still works (damage effects applied from weapon data)

### Invariants That Must Remain True

1. DamageTypeEffectsService still works (uses damageEntry directly)
2. ApplyDamageHandler still works (passes damageEntry to service)
3. No runtime errors from missing loader or registry data
4. Other loaders remain functional
5. Anatomy mod still loads other content correctly

## Risk Assessment

**Low Risk**: This removal is safe because:
1. DamageTypeEffectsService was already refactored to not use registry (WEADAMCAPREF-004)
2. ApplyDamageHandler was already refactored to pass damageEntry (WEADAMCAPREF-005)
3. Weapons already have damage_capabilities data (WEADAMCAPREF-009)

## Estimated Size

- 1 loader file deleted (~100 lines)
- 3 JSON definition files deleted (~50 lines each)
- 2 registration files updated (~5 lines each)
- 1 manifest file updated (~3 lines)
- 1 test file deleted (if exists, ~100 lines)
