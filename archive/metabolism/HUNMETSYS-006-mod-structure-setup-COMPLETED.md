# HUNMETSYS-006: Mod Structure Setup

**Status:** ✅ COMPLETED  
**Priority:** High  
**Actual Effort:** 30 minutes  
**Phase:** 2 - Mod Structure  
**Dependencies:** HUNMETSYS-001, HUNMETSYS-002 (component schemas exist)

## Objective

Complete the metabolism mod directory structure and update the manifest file to organize all system content. The basic structure already existed but needed completion.

## What Was Actually Changed

### Current State Assessment (Before Implementation)
- ✅ `data/mods/metabolism/` directory already existed
- ✅ `data/mods/metabolism/mod-manifest.json` already existed (needed updates)
- ✅ `data/mods/metabolism/components/` with all 4 component files already in place
- ❌ Missing content directories (5): `actions/`, `rules/`, `conditions/`, `scopes/`, `entities/definitions/`
- ❌ Manifest missing anatomy dependency
- ❌ Manifest missing empty content arrays for actions, rules, conditions, scopes, entities
- ❌ `data/game.json` missing metabolism mod registration
- ❌ No `lookups/hunger_thresholds.json` reference file

### Changes Made

#### 1. Created Missing Directories (7 total)
```bash
data/mods/metabolism/actions/
data/mods/metabolism/rules/
data/mods/metabolism/conditions/
data/mods/metabolism/scopes/
data/mods/metabolism/entities/
data/mods/metabolism/entities/definitions/
data/mods/metabolism/lookups/
```

#### 2. Updated Mod Manifest
**File:** `data/mods/metabolism/mod-manifest.json`

**Changes:**
- Added `anatomy` to dependencies array (version 1.0.0)
- Added empty content arrays: `actions`, `rules`, `conditions`, `scopes`
- Fixed `entities` structure from empty array `[]` to object with `definitions` and `instances` arrays
  - This was a critical schema fix discovered during validation

**Final Manifest:**
```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "metabolism",
  "version": "1.0.0",
  "name": "Metabolism System",
  "description": "Hunger, energy, and digestion system with fuel converters and consumable items",
  "author": "Living Narrative Engine",
  "gameVersion": "0.0.1",
  "dependencies": [
    {
      "id": "core",
      "version": "1.0.0"
    },
    {
      "id": "anatomy",
      "version": "1.0.0"
    }
  ],
  "content": {
    "components": [
      "fuel_converter.component.json",
      "fuel_source.component.json",
      "metabolic_store.component.json",
      "hunger_state.component.json"
    ],
    "actions": [],
    "rules": [],
    "conditions": [],
    "scopes": [],
    "entities": {
      "definitions": [],
      "instances": []
    }
  }
}
```

#### 3. Created Hunger Thresholds Lookup File
**File:** `data/mods/metabolism/lookups/hunger_thresholds.json`

This provides reference data for hunger state thresholds (6 states: gluttonous, satiated, neutral, hungry, starving, critical). The actual implementation logic will be in the UPDATE_HUNGER_STATE operation handler (future ticket).

Note: Per project conventions (CLAUDE.md), mods use `lookups/` directory, not `config/`.

#### 4. Registered Mod in Game Configuration
**File:** `data/game.json`

Added `"metabolism"` to mods array after `"anatomy"` to respect dependency order.

### Validation Results

✅ **Manifest Validation:** Passed (`npm run validate`)
- Initial validation caught schema error: entities must be object with definitions/instances, not array
- Fixed and re-validated successfully
- Metabolism mod has no dependency or cross-reference violations

✅ **Unit Tests:** All passed (35,325 tests)
```bash
Test Suites: 2180 passed, 2180 total
Tests:       35325 passed, 35325 total
```

✅ **Directory Structure:** Complete and correct
```
data/mods/metabolism/
├── actions/                    (empty, ready for future content)
├── components/                 (4 component files from HUNMETSYS-001, 002)
├── conditions/                 (empty, ready for future content)
├── entities/
│   └── definitions/           (empty, ready for future content)
├── lookups/
│   └── hunger_thresholds.json (reference data)
├── mod-manifest.json          (updated with anatomy dependency)
├── rules/                     (empty, ready for future content)
└── scopes/                    (empty, ready for future content)
```

## Key Learnings

### Schema Discovery
The mod-manifest schema requires `entities` to be an object with `definitions` and `instances` arrays, not a simple empty array. This wasn't immediately obvious from the ticket assumptions.

### Naming Convention Correction
The ticket initially referenced `config/hunger_thresholds.json`, but per CLAUDE.md project conventions, mods use `lookups/` directory for data reference files, not `config/`.

## Acceptance Criteria - All Met ✅

- ✅ All 7 required directories created (actions, rules, conditions, scopes, entities, entities/definitions, lookups)
- ✅ Component files remain in components/ directory unchanged
- ✅ Manifest validates against mod-manifest.schema.json
- ✅ Anatomy dependency added to dependencies array
- ✅ All required content arrays added with correct structure
- ✅ Existing components array unchanged (4 files listed)
- ✅ Metabolism added to game.json after anatomy (dependency order)
- ✅ Validation passes without metabolism violations
- ✅ All tests pass (35,325 unit tests)
- ✅ Optional lookups/hunger_thresholds.json created

## Invariants Verified ✅

- ✅ Mod ID is "metabolism" (matches all component namespaces)
- ✅ Dependencies include core and anatomy
- ✅ Directory structure follows project conventions (lookups/ not config/)
- ✅ Manifest lists all component files correctly
- ✅ Component files not modified
- ✅ Existing mods continue to load correctly
- ✅ No circular dependencies introduced

## Files Modified

### Created (8 total)
1. `data/mods/metabolism/actions/` (directory)
2. `data/mods/metabolism/rules/` (directory)
3. `data/mods/metabolism/conditions/` (directory)
4. `data/mods/metabolism/scopes/` (directory)
5. `data/mods/metabolism/entities/` (directory)
6. `data/mods/metabolism/entities/definitions/` (directory)
7. `data/mods/metabolism/lookups/` (directory)
8. `data/mods/metabolism/lookups/hunger_thresholds.json` (file)

### Modified (2 total)
1. `data/mods/metabolism/mod-manifest.json` - Added anatomy dependency and fixed content arrays structure
2. `data/game.json` - Added metabolism to mods array after anatomy

## Next Steps

The mod structure is now ready for content population:
- HUNMETSYS-007: Add consumption operation handlers
- HUNMETSYS-008: Add digestion operation handlers
- HUNMETSYS-009: Add burn energy operation handler
- HUNMETSYS-010: Add sample consumable entities
- HUNMETSYS-011+: Rules, conditions, scopes, actions

## Outcome Summary

**Estimated:** 3 hours → **Actual:** 30 minutes

The task was completed faster than estimated because:
1. Basic directory structure and manifest already existed
2. Component files were already in place from HUNMETSYS-001, 002
3. Only needed to add missing directories, update manifest, and register in game.json

**Key Achievement:** Discovered and fixed critical schema requirement (entities structure) during validation, preventing future issues.

**Commit:** `feat(metabolism): complete mod structure and update manifest`

**Completion Date:** 2025-11-20
