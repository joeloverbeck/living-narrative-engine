# WEASYSIMP-005: Create Items Mod Aiming Scopes

**Phase:** Items Mod Extensions
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-003 (Aiming Components)
**Priority:** P0 (Blocking)

## Overview

Create three scope DSL files for the items mod to support aiming functionality: `aimable_items_in_inventory`, `aimed_items_in_inventory`, and `aimable_targets`. These scopes enable action discovery and target filtering.

## Objectives

1. Create `items:aimable_items_in_inventory` scope
2. Create `items:aimed_items_in_inventory` scope
3. Create `items:aimable_targets` scope
4. Validate scope DSL syntax
5. Test scope resolution

## Technical Details

### 1. items:aimable_items_in_inventory Scope

**File to Create:** `data/mods/items/scopes/aimable_items_in_inventory.scope`

```scope-dsl
actor.components.items:inventory.items[][{"has": [{"var": "."}, "items:aimable"]}]
```

**Scope Breakdown:**
- `actor.components.items:inventory.items[]` - Access actor's inventory items array
- `[]` - Array iteration (process each item)
- `[{...}]` - JSON Logic filter
- `{"has": [{"var": "."}, "items:aimable"]}` - Check if current item has `items:aimable` component

**Returns:** All items in actor's inventory that have `items:aimable` component

**Example Results:**
```javascript
[
  "weapons:pistol_9mm",
  "items:flashlight",
  "items:camera"
]
```

### 2. items:aimed_items_in_inventory Scope

**File to Create:** `data/mods/items/scopes/aimed_items_in_inventory.scope`

```scope-dsl
actor.components.items:inventory.items[][{"has": [{"var": "."}, "items:aimed_at"]}]
```

**Scope Breakdown:**
- `actor.components.items:inventory.items[]` - Access actor's inventory items
- `{"has": [{"var": "."}, "items:aimed_at"]}` - Check for `items:aimed_at` component

**Returns:** All items in actor's inventory that are currently aimed (have `items:aimed_at` state component)

**Example Results:**
```javascript
[
  "weapons:rifle_556"  // Currently aimed at something
]
```

**Use Cases:**
- `items:lower_aim` action (only shows for items being aimed)
- Querying "what am I aiming?"
- Checking if actor has any aimed items

### 3. items:aimable_targets Scope

**File to Create:** `data/mods/items/scopes/aimable_targets.scope`

```scope-dsl
entities(core:actor)[{"and": [
  {"!=": [{"var": "id"}, {"var": "actor.id"}]},
  {"==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]}
]}]
```

**Scope Breakdown:**
- `entities(core:actor)` - Query all actor entities (can be extended to other entity types)
- `[{...}]` - JSON Logic filter with AND condition
- `{"!=": [{"var": "id"}, {"var": "actor.id"}]}` - Exclude the actor themselves
- Location check - Target must be at same location as actor

**Returns:** All actors at the actor's current location, excluding the actor

**Example Results:**
```javascript
[
  "core:hostile_entity_1",
  "core:hostile_entity_2",
  "core:npc_civilian"
]
```

**Future Extensions:**
- Can include other entity types: `entities(core:actor) | entities(items:container) | entities(environment:object)`
- Can add line-of-sight validation
- Can add range constraints based on item properties

### 4. Scope DSL Syntax Reference

**Key Patterns Used:**
- `.` - Field access (e.g., `actor.components`)
- `:` - Component namespacing (e.g., `items:inventory`)
- `[]` - Array iteration
- `[{...}]` - JSON Logic filter
- `{"has": [...]}` - Component existence check
- `{"var": "..."}` - Variable reference
- `{"and": [...]}`, `{"or": [...]}` - Logical operators
- `{"==": [a, b]}`, `{"!=": [a, b]}` - Comparison operators

### 5. Items Mod Scope Directory Structure

```
data/mods/items/
├── scopes/
│   ├── aimable_items_in_inventory.scope   ← Create
│   ├── aimed_items_in_inventory.scope     ← Create
│   ├── aimable_targets.scope              ← Create
│   └── ... (existing scopes)
```

## Acceptance Criteria

- [ ] `aimable_items_in_inventory.scope` created at `data/mods/items/scopes/`
- [ ] `aimed_items_in_inventory.scope` created at `data/mods/items/scopes/`
- [ ] `aimable_targets.scope` created at `data/mods/items/scopes/`
- [ ] All scopes use correct Scope DSL syntax
- [ ] Scope files have no file extension errors (.scope not .scope.json)
- [ ] Component references are correct (`items:aimable`, `items:aimed_at`, `core:actor`, `core:position`)
- [ ] JSON Logic syntax is valid
- [ ] `npm run scope:lint` passes without errors
- [ ] Scopes resolve correctly in test environment

## Testing Requirements

### Validation Commands

```bash
# Lint scope DSL files
npm run scope:lint

# Validate scope file names
ls data/mods/items/scopes/*.scope

# Check for syntax errors (basic)
cat data/mods/items/scopes/aimable_items_in_inventory.scope
cat data/mods/items/scopes/aimed_items_in_inventory.scope
cat data/mods/items/scopes/aimable_targets.scope
```

### Integration Test Stub

**File:** `tests/integration/mods/items/aimingScopeResolution.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Items Mod - Aiming Scope Resolution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:aim_item');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('items:aimable_items_in_inventory scope', () => {
    it('should return items with aimable component', () => {
      const actor = fixture.createActor('Test Actor');

      // Add aimable item
      const pistol = fixture.createEntity('weapons:pistol', {
        'items:item': {},
        'items:portable': {},
        'items:aimable': {}
      });

      // Add non-aimable item
      const book = fixture.createEntity('items:book', {
        'items:item': {},
        'items:portable': {}
      });

      fixture.addToInventory(actor.id, [pistol.id, book.id]);

      const result = fixture.resolveScope('items:aimable_items_in_inventory', { actor });

      expect(result).toContain(pistol.id);
      expect(result).not.toContain(book.id);
    });
  });

  describe('items:aimed_items_in_inventory scope', () => {
    it('should return only aimed items', () => {
      const actor = fixture.createActor('Test Actor');
      const target = fixture.createActor('Target');

      const pistol = fixture.createEntity('weapons:pistol', {
        'items:item': {},
        'items:portable': {},
        'items:aimable': {}
      });

      fixture.addToInventory(actor.id, [pistol.id]);

      // Initially no aimed items
      let result = fixture.resolveScope('items:aimed_items_in_inventory', { actor });
      expect(result).toHaveLength(0);

      // Aim the pistol
      fixture.addComponent(pistol.id, 'items:aimed_at', {
        targetId: target.id,
        aimedBy: actor.id,
        timestamp: Date.now()
      });

      // Now pistol appears in scope
      result = fixture.resolveScope('items:aimed_items_in_inventory', { actor });
      expect(result).toContain(pistol.id);
    });
  });

  describe('items:aimable_targets scope', () => {
    it('should return actors at same location excluding self', () => {
      const location = fixture.createLocation('Test Room');
      const actor = fixture.createActor('Actor', { locationId: location.id });
      const target1 = fixture.createActor('Target 1', { locationId: location.id });
      const target2 = fixture.createActor('Target 2', { locationId: location.id });
      const farTarget = fixture.createActor('Far Target', { locationId: 'other_location' });

      const result = fixture.resolveScope('items:aimable_targets', { actor });

      expect(result).toContain(target1.id);
      expect(result).toContain(target2.id);
      expect(result).not.toContain(actor.id); // Exclude self
      expect(result).not.toContain(farTarget.id); // Different location
    });
  });
});
```

## Additional Notes

- **Scope File Format:** Scope files use `.scope` extension, not `.scope.json`
- **Scope Naming:** Scope IDs match filenames (e.g., `aimable_items_in_inventory.scope` → `items:aimable_items_in_inventory`)
- **Component Checks:** The `has` operator checks for component existence on entities
- **Variable Context:** Scopes have access to:
  - `actor` - The actor performing the action
  - `entity` - Current entity being filtered (in array iterations)
  - `context` - Additional context variables
- **Performance:** Scope resolution is cached where possible; filters are evaluated lazily
- **Future Extensions:**
  - Add range checking to `aimable_targets` based on item properties
  - Add line-of-sight validation using positioning components
  - Extend `aimable_targets` to include non-actor entities (objects, containers)

## Related Tickets

- **Depends On:** WEASYSIMP-003 (Aiming Components)
- **Blocks:**
  - WEASYSIMP-004 (Aiming Actions) - actions reference these scopes
  - WEASYSIMP-007 (Aiming Rules) - rules may query these scopes
- **Required By:** All items mod aiming functionality
- **Reference:** See `data/mods/positioning/scopes/` for more scope DSL examples
