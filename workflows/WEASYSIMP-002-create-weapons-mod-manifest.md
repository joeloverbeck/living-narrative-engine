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
  - `items` provides inventory and portable items systems (aiming functionality will be added in WEASYSIMP-003-007)

### 3. Game Configuration Update

**File to Modify:** `data/game.json`

**Current state**: Check if `"weapons"` is already in the mods array. If not present, add it after `"items"`.

Current `data/game.json` structure includes many mods. Verify `"weapons"` appears in the load order after `"items"`:

```json
{
  "mods": [
    "core",
    ...
    "items",
    ...
    "weapons",  ← Ensure this is present after items
    ...
  ],
  "startWorld": "patrol:patrol"
}
```

**Load Order Rationale:**
1. `core` - Foundation components (actor, position)
2. `items` - Inventory system (aiming system will be added in Phase 2: WEASYSIMP-003-007)
3. `weapons` - Weapon-specific functionality (depends on items:inventory and future items:aimable component)

**Note**: The actual game.json contains many other mods (furniture, positioning, clothing, etc.). Ensure weapons is positioned after items to satisfy dependency requirements.

### 4. Validation Commands

```bash
# Validate manifest against schema
npm run validate

# Validate mod-specific references (after mod content is created)
npm run validate:mod -- --mod=weapons

# Check for schema errors
node -e "JSON.parse(require('fs').readFileSync('data/mods/weapons/mod-manifest.json'))" && echo "✓ Valid JSON"
```

## Acceptance Criteria

- [ ] `mod-manifest.json` exists or is updated at `data/mods/weapons/mod-manifest.json`
- [ ] Manifest includes all required fields (id, version, name) and recommended fields (description, author, gameVersion, dependencies)
- [ ] Dependencies correctly declare `core` and `items` with versions
- [ ] JSON is valid and parseable
- [ ] Manifest validates against `mod-manifest.schema.json`
- [ ] `data/game.json` includes weapons mod in correct load order (after items)
- [ ] `npm run validate` passes without errors
- [ ] Mod ID "weapons" is unique and not conflicting with other mods
- [ ] Manifest clarifies that aiming functionality is a future dependency (WEASYSIMP-003-007)

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
   node -e "const game = JSON.parse(require('fs').readFileSync('data/game.json')); console.log('Load order:', game.mods); console.log('Weapons position:', game.mods.indexOf('weapons'));"
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
- The weapons mod will depend on items mod for inventory functionality and the aiming system that will be added in Phase 2 (WEASYSIMP-003-007)
- **Important**: The aiming components (`items:aimable`, `items:aimed_at`) do not exist yet. They will be created in WEASYSIMP-003 before weapons-specific content
- Future versions can add optional dependencies for integration with other mods (e.g., damage systems, skills)

## Current State

**Note**: The weapons mod directory structure already exists at `data/mods/weapons/` with a basic manifest file. This workflow updates the manifest to include proper metadata (description, author, gameVersion) and declares the dependency on the items mod.

Existing structure:
```
data/mods/weapons/
├── mod-manifest.json  (basic manifest exists, needs enhancement)
├── actions/
├── components/
├── conditions/
├── entities/
├── events/
├── rules/
└── scopes/
```

## Related Tickets

- **Depends On:** WEASYSIMP-001 (Directory Structure)
- **Blocks:** All subsequent weapons mod content tickets (WEASYSIMP-008 through WEASYSIMP-019)
- **Phase Dependency**: Should be completed before WEASYSIMP-003 (Items Mod Aiming Components) to establish proper mod structure
- **Reference:** See `data/mods/items/mod-manifest.json` and `data/mods/positioning/mod-manifest.json` for examples
