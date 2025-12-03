# WEADAMCAPREF-010: Remove DamageTypeLoader and damage-type definitions

**Status: COMPLETED**

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
| `src/loaders/loaderMeta.js` | UPDATE | Remove damageTypes metadata entry |
| `src/loaders/defaultLoaderConfig.js` | UPDATE | Remove damageTypeLoader parameter and mapping |
| `data/mods/anatomy/mod-manifest.json` | UPDATE | Remove damageTypes content reference |
| `tests/unit/loaders/damageTypeLoader.test.js` | DELETE | If exists (verified: does not exist) |

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

### Update Loader Meta

In `src/loaders/loaderMeta.js`, remove the damageTypes entry:
```javascript
// Remove this entry
damageTypes: {
  contentKey: 'damageTypes',
  diskFolder: 'damage-types',
  phase: 'definitions',
  registryKey: 'damageTypes',
},
```

### Update Default Loader Config

In `src/loaders/defaultLoaderConfig.js`, remove:
1. JSDoc parameter: `@param {BaseManifestItemLoaderInterface} deps.damageTypeLoader`
2. Function parameter: `damageTypeLoader,`
3. Config mapping: `damageTypes: damageTypeLoader,`

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

No test file exists for DamageTypeLoader (verified).

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

## Outcome

### What Was Actually Changed

All planned changes were implemented as specified:

**Files Deleted:**
- `src/loaders/damageTypeLoader.js` (59 lines)
- `data/mods/anatomy/damage-types/blunt.json`
- `data/mods/anatomy/damage-types/piercing.json`
- `data/mods/anatomy/damage-types/slashing.json`
- `data/mods/anatomy/damage-types/` directory

**Files Updated:**
- `src/dependencyInjection/tokens/tokens-core.js` - Removed `DamageTypeLoader` token
- `src/dependencyInjection/registrations/loadersRegistrations.js` - Removed import, registration, and ContentLoadManager config
- `src/loaders/loaderMeta.js` - Removed `damageTypes` metadata entry
- `src/loaders/defaultLoaderConfig.js` - Removed JSDoc param, function param, and config mapping
- `data/mods/anatomy/mod-manifest.json` - Removed `damageTypes` content section

**Tests Updated:**
- `tests/unit/config/registrations/loadersRegistrations.additionalCoverage.test.js` - Removed DamageTypeLoader from stub values
- `tests/unit/loaders/defaultLoaderConfig.test.js` - Removed damageTypeLoader from test deps and expectations
- `tests/unit/anatomy/damage-types.schema.test.js` - Updated to use inline test data instead of importing deleted JSON files

### Verification Results

- `npm run validate` - PASSED (0 cross-reference violations)
- All 794 loader tests pass
- No references to `DamageTypeLoader` remain in src/ or tests/
- damage-type.schema.json retained (still used for inline weapon damage capabilities)

### Differences From Original Plan

The original ticket was missing two files that required updates:
1. `src/loaders/loaderMeta.js` - Had damageTypes metadata entry
2. `src/loaders/defaultLoaderConfig.js` - Had damageTypeLoader parameter

These were added to the ticket during implementation before code changes began.
