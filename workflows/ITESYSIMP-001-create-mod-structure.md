# ITESYSIMP-001: Create Items Mod Structure

**Phase:** 1 - Core Infrastructure
**Priority:** Critical
**Estimated Effort:** 30 minutes

## Goal

Set up the foundational directory structure and manifest for the items mod following the modding-first architecture.

## Context

The items system will be implemented as a standalone mod with complete ECS architecture. This ticket establishes the mod structure that all subsequent features will build upon.

## Tasks

### 1. Create Directory Structure

Create the following directory hierarchy:

```
data/mods/items/
├── mod-manifest.json
├── components/
├── actions/
├── rules/
├── conditions/
├── scopes/
├── events/
└── entities/
    └── definitions/
```

### 2. Create Mod Manifest

Create `data/mods/items/mod-manifest.json`:

```json
{
  "id": "items",
  "version": "1.0.0",
  "name": "Items System",
  "description": "Core items, inventory, and container system with multi-target actions",
  "dependencies": ["core", "positioning"],
  "components": [],
  "actions": [],
  "rules": [],
  "conditions": [],
  "scopes": [],
  "events": [],
  "entities": []
}
```

### 3. Register Mod

Add to `data/game.json`:

```json
{
  "mods": [
    "core",
    "positioning",
    "items"
  ]
}
```

## Validation

- [ ] All directories created
- [ ] Manifest has valid JSON structure
- [ ] Mod ID follows naming convention (lowercase, no special chars)
- [ ] Dependencies correctly reference existing mods
- [ ] Mod loads without errors in game.json

## Dependencies

None - this is the foundation ticket

## Next Steps

After completion, proceed to:
- ITESYSIMP-002: Implement marker components (items:item, items:portable)
