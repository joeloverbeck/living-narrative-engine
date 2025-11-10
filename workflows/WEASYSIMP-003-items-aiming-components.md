# WEASYSIMP-003: Create Items Mod Aiming Components

**Phase:** Items Mod Extensions
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** None (extends existing items mod)
**Priority:** P0 (Blocking)

## Overview

Create two components in the items mod to support aiming functionality: `items:aimable` (marker component) and `items:aimed_at` (state component). These provide the foundation for aiming any item (weapons, flashlights, cameras) at targets.

## Objectives

1. Create `items:aimable` marker component
2. Create `items:aimed_at` state component with target tracking
3. Validate component schemas
4. Update items mod manifest if needed
5. Prepare for action/scope creation

## Technical Details

### 1. items:aimable Component (Marker)

**File to Create:** `data/mods/items/components/aimable.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:aimable",
  "description": "Marker component indicating an item can be aimed at targets. Applies to weapons, flashlights, cameras, and similar directional items. Items with this component can be used with aim_item and lower_aim actions.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Component Design Notes:**
- **Type:** Marker component (no data fields)
- **Purpose:** Flag items that support aiming actions
- **Usage:** Applied to any item that can be pointed/aimed (weapons, flashlights, cameras, binoculars)
- **Pattern:** Follows existing marker components like `items:portable`, `items:item`
- **Enables:** Scope filtering for aimable items in inventory

### 2. items:aimed_at Component (State)

**File to Create:** `data/mods/items/components/aimed_at.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:aimed_at",
  "description": "State component tracking what an aimable item is currently aimed at. Present only when item is actively aimed. Removed when aim is lowered.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "targetId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "Entity ID of the target being aimed at (format: modId:identifier)"
      },
      "aimedBy": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "Entity ID of the actor aiming the item"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp when aiming started (from GET_TIMESTAMP operation)"
      }
    },
    "required": ["targetId", "aimedBy", "timestamp"],
    "additionalProperties": false
  }
}
```

**Component Design Notes:**
- **Type:** State component (transient, present only while aiming)
- **Purpose:** Track active aiming state
- **Lifecycle:**
  - **Added:** When `items:aim_item` action executes
  - **Removed:** When `items:lower_aim` action executes or actor switches targets
- **Pattern:** Similar to transient state components like `positioning:bending_over`, `weapons:jammed`
- **Usage:** Enables queries for "what am I aiming at?" and "is this item aimed?"

### 3. Component Field Details

#### items:aimed_at Fields

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `targetId` | string | Yes | Entity ID of aim target (e.g., `core:hostile_entity_1`) |
| `aimedBy` | string | Yes | Entity ID of actor (e.g., `core:sentinel_alpha`) |
| `timestamp` | number | Yes | Game time when aim started (for duration tracking) |

**Field Validation:**
- `targetId` and `aimedBy` must match pattern: `modId:identifier`
- `timestamp` must be positive number (from `GET_TIMESTAMP` operation)

### 4. Component Integration

**Items Mod Structure:**
```
data/mods/items/
├── components/
│   ├── aimable.component.json        ← Create
│   ├── aimed_at.component.json       ← Create
│   ├── item.component.json           ← Existing
│   ├── portable.component.json       ← Existing
│   └── ...
```

**No Manifest Update Required:**
- Component discovery is automatic via file system scanning
- Items mod manifest already exists and doesn't need modification

## Acceptance Criteria

- [ ] `aimable.component.json` created at `data/mods/items/components/`
- [ ] `aimed_at.component.json` created at `data/mods/items/components/`
- [ ] Both components have valid JSON syntax
- [ ] Both components validate against `component.schema.json`
- [ ] Component IDs follow namespace pattern (`items:*`)
- [ ] `items:aimable` has empty properties object (marker component)
- [ ] `items:aimed_at` has all three required fields with correct types
- [ ] Patterns for entity IDs are correct (`^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$`)
- [ ] Descriptions clearly explain component purpose and usage
- [ ] `npm run validate` passes without errors

## Testing Requirements

### Validation Commands

```bash
# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/components/aimable.component.json'))" && echo "✓ aimable.component.json valid"
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/components/aimed_at.component.json'))" && echo "✓ aimed_at.component.json valid"

# Validate against schema
npm run validate

# Check component ID namespacing
grep -q '"id": "items:aimable"' data/mods/items/components/aimable.component.json && echo "✓ Correct ID for aimable"
grep -q '"id": "items:aimed_at"' data/mods/items/components/aimed_at.component.json && echo "✓ Correct ID for aimed_at"
```

### Unit Test Creation (Optional for Components)

Create basic unit tests if project requires component validation tests:

**File:** `tests/unit/mods/items/components/aimingComponents.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';

describe('Items Mod - Aiming Components', () => {
  describe('items:aimable component', () => {
    it('should be a valid marker component with empty schema', () => {
      const aimable = require('../../../../../data/mods/items/components/aimable.component.json');
      expect(aimable.id).toBe('items:aimable');
      expect(aimable.dataSchema.properties).toEqual({});
    });
  });

  describe('items:aimed_at component', () => {
    it('should have required fields for state tracking', () => {
      const aimedAt = require('../../../../../data/mods/items/components/aimed_at.component.json');
      expect(aimedAt.id).toBe('items:aimed_at');
      expect(aimedAt.dataSchema.required).toEqual(['targetId', 'aimedBy', 'timestamp']);
      expect(aimedAt.dataSchema.properties.targetId.type).toBe('string');
      expect(aimedAt.dataSchema.properties.aimedBy.type).toBe('string');
      expect(aimedAt.dataSchema.properties.timestamp.type).toBe('number');
    });
  });
});
```

## Additional Notes

- **Component Reusability:** `items:aimable` can be added to ANY item that supports aiming (not just weapons)
  - Weapons: pistols, rifles, shotguns
  - Non-weapons: flashlights, cameras, binoculars, laser pointers
- **State Component Pattern:** `items:aimed_at` exists only while actively aiming
  - Don't persist in save files for items not currently aimed
  - Component is added/removed by rule handlers, not manually
- **Timestamp Usage:** The `timestamp` field enables:
  - Tracking how long an item has been aimed
  - Implementing aim stability mechanics (longer aim = more accuracy)
  - Creating time-based constraints (must aim for X seconds before action)
- **Future Extensions:**
  - Could add `accuracy_bonus` field to `items:aimed_at` for aim duration effects
  - Could add `aim_mode` field for different aim stances (hip fire, aimed, scoped)

## Related Tickets

- **Blocks:**
  - WEASYSIMP-004 (Items Mod Aiming Actions) - requires these components
  - WEASYSIMP-005 (Items Mod Aiming Scopes) - scopes filter by these components
  - WEASYSIMP-007 (Items Mod Aiming Rules) - rules add/remove these components
- **Required By:** All weapons mod shooting actions (require `items:aimed_at` component)
- **Pattern Reference:** See `items:portable`, `items:item` for marker component examples
