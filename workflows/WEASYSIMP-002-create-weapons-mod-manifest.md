# WEASYSIMP-002: Create Weapons Mod Manifest

**Phase:** Foundation
**Timeline:** 0.5 days
**Status:** Not Started
**Dependencies:** WEASYSIMP-001 (Directory Structure)
**Priority:** P0 (Blocking)

## Overview

Create the mod manifest file for the weapons mod, defining its metadata, dependencies, and configuration. The manifest must declare dependencies on both `core` and `items` mods.

## Objectives

1. Create `mod-manifest.json` following the manifest schema
2. Define mod ID, version, and metadata
3. Declare dependencies on core and items mods
4. Validate manifest against schema
5. Update `game.json` to include weapons mod in load order

## Technical Details

### 1. Mod Manifest File

**File to Create:** `data/mods/weapons/mod-manifest.json`

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "weapons",
  "version": "1.0.0",
  "name": "Weapons System",
  "description": "Firearms, ammunition, reloading, and shooting mechanics. Includes weapons, ammunition containers, and combat actions for tactical gameplay scenarios.",
  "author": "Living Narrative Engine",
  "gameVersion": "0.0.1",
  "dependencies": [
    {
      "id": "core",
      "version": "1.0.0"
    },
    {
      "id": "items",
      "version": "1.0.0"
    }
  ]
}
```

### 2. Manifest Field Explanations

- **id**: `"weapons"` - Unique identifier used for namespacing (e.g., `weapons:pistol`)
- **version**: `"1.0.0"` - Semantic versioning for the mod
- **name**: Human-readable display name
- **description**: Comprehensive description of mod functionality
- **author**: Mod creator attribution
- **gameVersion**: Compatible game version
- **dependencies**: Required mods that must load before weapons mod
  - `core` provides essential components (actor, position, name, description)
  - `items` provides inventory, portable items, and aiming functionality

### 3. Game Configuration Update

**File to Modify:** `game.json`

Add `"weapons"` to the `mods` array in load order (after `items`):

```json
{
  "mods": [
    "core",
    "items",
    "weapons"
  ]
}
```

**Load Order Rationale:**
1. `core` - Foundation components (actor, position)
2. `items` - Inventory and aiming system
3. `weapons` - Weapon-specific functionality (depends on items:aimable, items:inventory)

### 4. Validation Commands

```bash
# Validate manifest against schema
npm run validate

# Validate mod can be loaded
npm run validate:mod:weapons

# Check for schema errors
node -e "JSON.parse(require('fs').readFileSync('data/mods/weapons/mod-manifest.json'))" && echo "✓ Valid JSON"
```

## Acceptance Criteria

- [ ] `mod-manifest.json` created at `data/mods/weapons/mod-manifest.json`
- [ ] Manifest includes all required fields (id, version, name, description, author, gameVersion, dependencies)
- [ ] Dependencies correctly declare `core` and `items`
- [ ] JSON is valid and parseable
- [ ] Manifest validates against `mod-manifest.schema.json`
- [ ] `game.json` updated with weapons mod in correct load order
- [ ] `npm run validate` passes without errors
- [ ] Mod ID "weapons" is unique and not used by other mods

## Testing Requirements

### Manual Validation

1. **JSON Syntax:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/mods/weapons/mod-manifest.json'))" && echo "✓ Valid JSON"
   ```

2. **Schema Validation:**
   ```bash
   npm run validate
   ```

3. **Load Order Check:**
   ```bash
   node -e "const game = JSON.parse(require('fs').readFileSync('game.json')); console.log('Load order:', game.mods); console.log('Weapons position:', game.mods.indexOf('weapons'));"
   ```

### Expected Output

```
✓ Valid JSON
✓ Manifest validates against schema
✓ Load order: [ 'core', 'items', 'weapons' ]
✓ Weapons position: 2
```

## Additional Notes

- The mod ID "weapons" will be used as namespace prefix for all content IDs (e.g., `weapons:pistol`, `weapons:ammunition`)
- Version 1.0.0 follows semantic versioning: MAJOR.MINOR.PATCH
- Dependencies must match the version numbers of installed mods
- The weapons mod extends items mod's aiming functionality, so items must load first
- Future versions can add optional dependencies for integration with other mods (e.g., damage systems, skills)

## Related Tickets

- **Depends On:** WEASYSIMP-001 (Directory Structure)
- **Blocks:** All subsequent weapons mod content tickets (WEASYSIMP-008 through WEASYSIMP-019)
- **Reference:** See `data/mods/items/mod-manifest.json` and `data/mods/positioning/mod-manifest.json` for examples
