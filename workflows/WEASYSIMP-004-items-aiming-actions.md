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
# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/actions/aim_item.action.json'))" && echo "✓ aim_item valid JSON"
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/actions/lower_aim.action.json'))" && echo "✓ lower_aim valid JSON"

# Validate against schema
npm run validate

# Check action IDs
grep -q '"id": "items:aim_item"' data/mods/items/actions/aim_item.action.json && echo "✓ Correct ID for aim_item"
grep -q '"id": "items:lower_aim"' data/mods/items/actions/lower_aim.action.json && echo "✓ Correct ID for lower_aim"

# Verify generateCombinations
grep -q '"generateCombinations": true' data/mods/items/actions/aim_item.action.json && echo "✓ generateCombinations enabled"
```

### Color Contrast Validation

Use WebAIM contrast checker or similar tool:
- Background #004d61 vs Text #e0f7fa = Expected 12.74:1 (AAA)
- Hover #006978 vs Hover Text #ffffff = Expected 11.12:1 (AAA)

### Unit Test Stub

**File:** `tests/unit/mods/items/actions/aimingActions.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';

describe('Items Mod - Aiming Actions', () => {
  describe('items:aim_item action', () => {
    it('should have correct structure for dual-target aiming', () => {
      const action = require('../../../../../data/mods/items/actions/aim_item.action.json');
      expect(action.id).toBe('items:aim_item');
      expect(action.targets.primary.scope).toBe('items:aimable_targets');
      expect(action.targets.secondary.scope).toBe('items:aimable_items_in_inventory');
      expect(action.template).toBe('aim {item} at {target}');
      expect(action.generateCombinations).toBe(true);
    });
  });

  describe('items:lower_aim action', () => {
    it('should have correct structure for lowering aim', () => {
      const action = require('../../../../../data/mods/items/actions/lower_aim.action.json');
      expect(action.id).toBe('items:lower_aim');
      expect(action.targets.primary.scope).toBe('items:aimed_items_in_inventory');
      expect(action.template).toBe('lower {item}');
      expect(action.generateCombinations).toBe(true);
    });
  });
});
```

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
