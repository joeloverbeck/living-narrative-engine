# HUNMETSYS-006: Mod Structure Setup

**Status:** Ready  
**Priority:** High  
**Estimated Effort:** 3 hours  
**Phase:** 2 - Mod Structure  
**Dependencies:** HUNMETSYS-001, HUNMETSYS-002 (component schemas exist)

## Objective

Create the complete metabolism mod directory structure and manifest file to organize all system content.

## Files to Touch

### New Files (2)
- `data/mods/metabolism/mod-manifest.json`
- `data/mods/metabolism/config/hunger_thresholds.json` (optional configuration)

### New Directories (7)
- `data/mods/metabolism/`
- `data/mods/metabolism/components/` (already has files from HUNMETSYS-001, 002)
- `data/mods/metabolism/actions/`
- `data/mods/metabolism/rules/`
- `data/mods/metabolism/conditions/`
- `data/mods/metabolism/scopes/`
- `data/mods/metabolism/entities/definitions/`

### Modified Files (1)
- `data/game.json` (add metabolism to mods array)

## Out of Scope

- ❌ Actual actions/rules/conditions content (covered in later tickets)
- ❌ Sample entity definitions (covered in HUNMETSYS-010)
- ❌ GOAP goals (covered in HUNMETSYS-013)
- ❌ Testing the full mod load (will happen incrementally)

## Implementation Details

### Mod Manifest

**File:** `data/mods/metabolism/mod-manifest.json`

**Required Fields:**
```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "metabolism",
  "version": "1.0.0",
  "name": "Metabolism System",
  "description": "Hunger, digestion, and energy management system",
  "dependencies": [
    { "id": "core", "version": "^1.0.0" },
    { "id": "anatomy", "version": "^1.0.0" }
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
    "entities": []
  }
}
```

**Note:** Actions, rules, conditions, scopes, and entities arrays will be populated in subsequent tickets.

### Hunger Thresholds Configuration (Optional)

**File:** `data/mods/metabolism/config/hunger_thresholds.json`

This is optional configuration data for reference. The actual threshold logic will be in UPDATE_HUNGER_STATE handler.

```json
{
  "thresholds": [
    {
      "state": "gluttonous",
      "min_percentage": 100,
      "max_percentage": 999
    },
    {
      "state": "satiated",
      "min_percentage": 75,
      "max_percentage": 100
    },
    {
      "state": "neutral",
      "min_percentage": 30,
      "max_percentage": 75
    },
    {
      "state": "hungry",
      "min_percentage": 10,
      "max_percentage": 30
    },
    {
      "state": "starving",
      "min_percentage": 0.1,
      "max_percentage": 10
    },
    {
      "state": "critical",
      "min_percentage": 0,
      "max_percentage": 0.1
    }
  ]
}
```

### Game Configuration

**File:** `data/game.json`

Add "metabolism" to the mods array after "anatomy":
```json
{
  "mods": ["core", "anatomy", "metabolism"]
}
```

## Acceptance Criteria

### Directory Structure
- [ ] All 7 directories created
- [ ] Component files from HUNMETSYS-001, 002 in components/ directory
- [ ] Empty placeholder directories ready for future content

### Mod Manifest
- [ ] Manifest validates against mod-manifest.schema.json
- [ ] Mod ID is "metabolism"
- [ ] Dependencies include core and anatomy
- [ ] All 4 component files listed in content.components
- [ ] Empty arrays for actions, rules, conditions, scopes, entities

### Game Configuration
- [ ] metabolism added to game.json mods array
- [ ] Positioned after anatomy (dependency order)

### Validation
```bash
npm run validate           # Mod manifest validates
npm run update-manifest    # Updates manifest if needed
npm run start             # Mod loads without errors
```

## Invariants

### Must Remain True
- Mod ID must be "metabolism" (matches all component namespaces)
- Dependencies must include anatomy (required for body composition)
- Directory structure must follow project conventions
- Manifest must list all component files

### System Invariants
- Existing mods continue to load correctly
- Core and anatomy mods load before metabolism
- Component files validate against their schemas
- No circular dependencies introduced

## References

- Spec: Lines 742-836 (Mod Structure)
- Spec: Lines 1314-1378 (Hunger Thresholds - for config file)
- Related: HUNMETSYS-001, 002 (component schemas being organized)
- Related: HUNMETSYS-007-010 (will populate content arrays)

## Definition of Done

- [ ] All directories created with correct structure
- [ ] Mod manifest created and validates
- [ ] Game.json updated with metabolism mod
- [ ] Manifest lists all existing component files
- [ ] Validation passes: `npm run validate`
- [ ] Mod loads successfully: `npm run start`
- [ ] Committed with message: "feat(metabolism): create mod structure and manifest"
