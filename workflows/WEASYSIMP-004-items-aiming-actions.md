# WEASYSIMP-004: Create Items Mod Aiming Actions

**Phase:** Items Mod Extensions
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-003 (Aiming Components)
**Priority:** P0 (Blocking)

## Overview

Create two actions in the items mod for aiming functionality: `items:aim_item` (aim an aimable item at a target) and `items:lower_aim` (stop aiming). These actions provide the foundation for all aiming-based gameplay including weapons, flashlights, and cameras.

## Objectives

1. Create `items:aim_item` action with dual-target system
2. Create `items:lower_aim` action
3. Define action templates and visual styling
4. Reference scopes (created in WEASYSIMP-005)
5. Validate action schemas

## Technical Details

### 1. items:aim_item Action

**File to Create:** `data/mods/items/actions/aim_item.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:aim_item",
  "name": "Aim Item",
  "description": "Aim an aimable item at a target entity. The item must have items:aimable component and be in actor's inventory.",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
    "primary": {
      "scope": "items:aimable_targets",
      "placeholder": "target",
      "description": "Entity to aim at"
    },
    "secondary": {
      "scope": "items:aimable_items_in_inventory",
      "placeholder": "item",
      "description": "Aimable item to use (weapon, flashlight, camera, etc.)"
    }
  },
  "template": "aim {item} at {target}",
  "visual": {
    "backgroundColor": "#004d61",
    "textColor": "#e0f7fa",
    "hoverBackgroundColor": "#006978",
    "hoverTextColor": "#ffffff"
  }
}
```

**Action Design Notes:**
- **Target System:** Dual-target (primary = what to aim at, secondary = what to aim with)
- **generateCombinations:** `true` - creates action for every valid target/item pair
- **Required Components:** Actor must have `items:inventory` (items are in inventory)
- **Scopes:**
  - `items:aimable_targets` - All entities at same location (excluding self)
  - `items:aimable_items_in_inventory` - Inventory items with `items:aimable` component
- **Template:** Natural language format using placeholders
- **Color Scheme:** Teal theme (contrast ratio 12.74:1, AAA compliant)
  - Distinct from weapons mod (Arctic Steel) but complementary
  - Suitable for general utility actions

### 2. items:lower_aim Action

**File to Create:** `data/mods/items/actions/lower_aim.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:lower_aim",
  "name": "Lower Aim",
  "description": "Stop aiming an item. Removes the items:aimed_at component from the item, ending the aimed state.",
  "generateCombinations": true,
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
    "primary": {
      "scope": "items:aimed_items_in_inventory",
      "placeholder": "item",
      "description": "Item currently being aimed (has items:aimed_at component)"
    }
  },
  "template": "lower {item}",
  "visual": {
    "backgroundColor": "#004d61",
    "textColor": "#e0f7fa",
    "hoverBackgroundColor": "#006978",
    "hoverTextColor": "#ffffff"
  }
}
```

**Action Design Notes:**
- **Target System:** Single target (the aimed item)
- **Required Components:** Actor must have `items:inventory`
- **Scope:** `items:aimed_items_in_inventory` - Items with `items:aimed_at` component
- **Template:** Simple imperative format
- **Color Scheme:** Same as `aim_item` for visual consistency

### 3. Action Field Details

#### Shared Fields

| Field | Value | Purpose |
|-------|-------|---------|
| `generateCombinations` | `true` | Auto-generate actions for all valid scope results |
| `required_components.actor` | `["items:inventory"]` | Ensure actor can hold items |
| `visual.backgroundColor` | `#004d61` | Teal background (AAA compliant) |
| `visual.textColor` | `#e0f7fa` | Light cyan text (AAA compliant) |

#### aim_item Specific

| Field | Value | Purpose |
|-------|-------|---------|
| `targets.primary.scope` | `items:aimable_targets` | Who/what to aim at |
| `targets.secondary.scope` | `items:aimable_items_in_inventory` | What to aim with |
| `template` | `"aim {item} at {target}"` | Natural action description |

#### lower_aim Specific

| Field | Value | Purpose |
|-------|-------|---------|
| `targets.primary.scope` | `items:aimed_items_in_inventory` | Item currently aimed |
| `template` | `"lower {item}"` | Simple imperative |

### 4. Color Scheme Validation

**Teal Utility Theme:**
- **Normal:** #004d61 (bg) / #e0f7fa (text) = 12.74:1 contrast ✅ AAA
- **Hover:** #006978 (bg) / #ffffff (text) = 11.12:1 contrast ✅ AAA
- **Rationale:** Teal conveys utility/tools, distinct from weapons (Arctic Steel), complementary to items mod theme

### 5. Scope References

These actions reference scopes that will be created in WEASYSIMP-005:
- `items:aimable_items_in_inventory`
- `items:aimed_items_in_inventory`
- `items:aimable_targets`

**Note:** Scopes must exist before actions can be used, but action files can be created first (validated in integration tests).

## Acceptance Criteria

- [ ] `aim_item.action.json` created at `data/mods/items/actions/`
- [ ] `lower_aim.action.json` created at `data/mods/items/actions/`
- [ ] Both actions have valid JSON syntax
- [ ] Both actions validate against `action.schema.json`
- [ ] Action IDs follow namespace pattern (`items:*`)
- [ ] `generateCombinations` is `true` for both actions
- [ ] Templates use correct placeholder syntax (`{item}`, `{target}`)
- [ ] Visual color scheme meets WCAG AAA standards (contrast > 7:1)
- [ ] Scope references are correct (will be created in WEASYSIMP-005)
- [ ] `npm run validate` passes without errors
- [ ] Color contrast validation passes

## Testing Requirements

### Validation Commands

```bash
# Primary validation (validates JSON syntax, schema compliance, and mod structure)
npm run validate

# Optional: Check action IDs (npm run validate covers this)
grep -q '"id": "items:aim_item"' data/mods/items/actions/aim_item.action.json && echo "✓ Correct ID for aim_item"
grep -q '"id": "items:lower_aim"' data/mods/items/actions/lower_aim.action.json && echo "✓ Correct ID for lower_aim"
```

### Color Contrast Validation

Use WebAIM contrast checker or similar tool:
- Background #004d61 vs Text #e0f7fa = Expected 12.74:1 (AAA)
- Hover #006978 vs Hover Text #ffffff = Expected 11.12:1 (AAA)

### Integration Tests

Following the established items mod testing pattern (see `giveItemActionDiscovery.test.js`, `dropItemActionDiscovery.test.js`), create two integration test files:

**File 1:** `tests/integration/mods/items/aimItemActionDiscovery.test.js`

```javascript
/**
 * @file Integration tests for the items:aim_item action definition.
 * @description Tests that the aim_item action is properly defined and structured.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import aimItemAction from '../../../../data/mods/items/actions/aim_item.action.json' assert { type: 'json' };

describe('items:aim_item action definition', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:aim_item');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(aimItemAction).toBeDefined();
    expect(aimItemAction.id).toBe('items:aim_item');
    expect(aimItemAction.name).toBe('Aim Item');
    expect(aimItemAction.description).toBe(
      'Aim an aimable item at a target entity. The item must have items:aimable component and be in actor\'s inventory.'
    );
    expect(aimItemAction.template).toBe('aim {item} at {target}');
  });

  it('should use correct scope for primary targets', () => {
    expect(aimItemAction.targets).toBeDefined();
    expect(aimItemAction.targets.primary).toBeDefined();
    expect(aimItemAction.targets.primary.scope).toBe('items:aimable_targets');
    expect(aimItemAction.targets.primary.placeholder).toBe('target');
    expect(aimItemAction.targets.primary.description).toBe('Entity to aim at');
  });

  it('should use correct scope for secondary targets (aimable items)', () => {
    expect(aimItemAction.targets).toBeDefined();
    expect(aimItemAction.targets.secondary).toBeDefined();
    expect(aimItemAction.targets.secondary.scope).toBe(
      'items:aimable_items_in_inventory'
    );
    expect(aimItemAction.targets.secondary.placeholder).toBe('item');
    expect(aimItemAction.targets.secondary.description).toBe(
      'Aimable item to use (weapon, flashlight, camera, etc.)'
    );
  });

  it('should generate combinations for multiple targets', () => {
    expect(aimItemAction.generateCombinations).toBe(true);
  });

  it('should require actor to have inventory', () => {
    expect(aimItemAction.required_components).toBeDefined();
    expect(aimItemAction.required_components.actor).toEqual(['items:inventory']);
  });
});
```

**File 2:** `tests/integration/mods/items/lowerAimActionDiscovery.test.js`

```javascript
/**
 * @file Integration tests for the items:lower_aim action definition.
 * @description Tests that the lower_aim action is properly defined and structured.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import lowerAimAction from '../../../../data/mods/items/actions/lower_aim.action.json' assert { type: 'json' };

describe('items:lower_aim action definition', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:lower_aim');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(lowerAimAction).toBeDefined();
    expect(lowerAimAction.id).toBe('items:lower_aim');
    expect(lowerAimAction.name).toBe('Lower Aim');
    expect(lowerAimAction.description).toBe(
      'Stop aiming an item. Removes the items:aimed_at component from the item, ending the aimed state.'
    );
    expect(lowerAimAction.template).toBe('lower {item}');
  });

  it('should use correct scope for primary targets (aimed items)', () => {
    expect(lowerAimAction.targets).toBeDefined();
    expect(lowerAimAction.targets.primary).toBeDefined();
    expect(lowerAimAction.targets.primary.scope).toBe(
      'items:aimed_items_in_inventory'
    );
    expect(lowerAimAction.targets.primary.placeholder).toBe('item');
    expect(lowerAimAction.targets.primary.description).toBe(
      'Item currently being aimed (has items:aimed_at component)'
    );
  });

  it('should generate combinations for multiple targets', () => {
    expect(lowerAimAction.generateCombinations).toBe(true);
  });

  it('should require actor to have inventory', () => {
    expect(lowerAimAction.required_components).toBeDefined();
    expect(lowerAimAction.required_components.actor).toEqual(['items:inventory']);
  });
});
```

**Testing Notes:**
- Tests follow the established items mod pattern (see existing action discovery tests)
- Use `ModTestFixture.forAction('items', 'items:action_name')` with full namespaced ID
- Import action JSON with ES6 `import ... assert { type: 'json' }` syntax
- Test file names follow `{actionName}ActionDiscovery.test.js` pattern (camelCase)
- Tests are integration tests, not unit tests (located in `tests/integration/mods/items/`)
- Focus on action structure validation; detailed discovery behavior tests can be added later
- Reference: `docs/testing/mod-testing-guide.md` for complete testing patterns

## Additional Notes

- **Action Discovery:** Both actions will appear in the action list when their conditions are met:
  - `aim_item`: When actor has aimable items in inventory and targets are present
  - `lower_aim`: When actor has aimed items in inventory
- **Template Rendering:** The `{item}` and `{target}` placeholders are replaced with entity names at runtime
- **Future Extensions:**
  - Could add `aim_mode` target for different aim stances (hip, aimed, scoped)
  - Could add range validation (can't aim at targets too far away)
  - Could add line-of-sight validation (obstacles blocking aim)
- **Weapons Integration:** The weapons mod's `shoot_weapon` action will require `items:aimed_at` component, creating dependency on these actions
- **Reusability:** These actions work with any aimable item, not just weapons:
  - Flashlights: aim to illuminate target
  - Cameras: aim to photograph target
  - Binoculars: aim to observe target
  - Laser pointers: aim to mark target

## Related Tickets

- **Depends On:** WEASYSIMP-003 (Aiming Components)
- **Blocks:**
  - WEASYSIMP-005 (Aiming Scopes) - scopes must be created for actions to work
  - WEASYSIMP-007 (Aiming Rules) - rules handle these action events
- **Required By:**
  - WEASYSIMP-011 (Shoot Weapon) - requires `items:aimed_at` state
  - All weapons mod actions that require aiming
- **Reference:** See `data/mods/items/actions/` for existing action examples
