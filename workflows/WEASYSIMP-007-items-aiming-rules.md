# WEASYSIMP-007: Create Items Mod Aiming Rules

**Phase:** Items Mod Extensions
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-003, WEASYSIMP-006 (Components, Events & Conditions)
**Priority:** P0 (Blocking)

## Overview

Create two rule files for the items mod aiming system: `handle_aim_item` and `handle_lower_aim`. These rules execute when aiming actions are decided, managing the `items:aimed_at` component lifecycle and dispatching events.

## Objectives

1. Create `items:handle_aim_item` rule
2. Create `items:handle_lower_aim` rule
3. Implement component manipulation operations
4. Implement event dispatching
5. Validate rule schemas

## Technical Details

### 1. items:handle_aim_item Rule

**File to Create:** `data/mods/items/rules/handle_aim_item.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "items:handle_aim_item",
  "description": "Handles the aim_item action by adding items:aimed_at component to the item and dispatching item_aimed event",
  "condition": "items:event-is-action-aim-item",
  "actions": [
    {
      "type": "GET_TIMESTAMP",
      "parameters": {
        "result_variable": "currentTimestamp"
      }
    },
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "{event.payload.secondaryId}",
        "component_type": "items:aimed_at",
        "value": {
          "targetId": "{event.payload.targetId}",
          "aimedBy": "{event.payload.actorId}",
          "timestamp": "{context.currentTimestamp}"
        }
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "items:item_aimed",
        "payload": {
          "actorId": "{event.payload.actorId}",
          "itemId": "{event.payload.secondaryId}",
          "targetId": "{event.payload.targetId}",
          "timestamp": "{context.currentTimestamp}"
        }
      }
    },
    {
      "type": "END_TURN",
      "parameters": {
        "entityId": "{event.payload.actorId}",
        "success": true
      }
    }
  ]
}
```

**Rule Operation Sequence:**
1. **GET_TIMESTAMP** - Get current game timestamp for aim tracking
2. **ADD_COMPONENT** - Add `items:aimed_at` to the item (secondary target)
   - `entity_ref` = item ID (from `event.payload.secondaryId`)
   - Component data includes `targetId`, `aimedBy`, `timestamp`
3. **DISPATCH_EVENT** - Dispatch `items:item_aimed` event
4. **END_TURN** - Complete actor's turn successfully

**Key Interpolations:**
- `{event.payload.actorId}` - Actor performing action
- `{event.payload.targetId}` - Primary target (what's being aimed at)
- `{event.payload.secondaryId}` - Secondary target (the item being aimed)
- `{context.currentTimestamp}` - Timestamp from GET_TIMESTAMP operation

### 2. items:handle_lower_aim Rule

**File to Create:** `data/mods/items/rules/handle_lower_aim.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "items:handle_lower_aim",
  "description": "Handles the lower_aim action by removing items:aimed_at component and dispatching aim_lowered event",
  "condition": "items:event-is-action-lower-aim",
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "{event.payload.targetId}",
        "component_type": "items:aimed_at",
        "result_variable": "aimedAtData"
      }
    },
    {
      "type": "GET_TIMESTAMP",
      "parameters": {
        "result_variable": "currentTimestamp"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "{event.payload.targetId}",
        "component_type": "items:aimed_at"
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "items:aim_lowered",
        "payload": {
          "actorId": "{event.payload.actorId}",
          "itemId": "{event.payload.targetId}",
          "previousTargetId": "{context.aimedAtData.targetId}",
          "timestamp": "{context.currentTimestamp}"
        }
      }
    },
    {
      "type": "END_TURN",
      "parameters": {
        "entityId": "{event.payload.actorId}",
        "success": true
      }
    }
  ]
}
```

**Rule Operation Sequence:**
1. **QUERY_COMPONENT** - Retrieve `items:aimed_at` data before removing it
   - Stores in `context.aimedAtData` to access `targetId` for event
2. **GET_TIMESTAMP** - Get current game timestamp
3. **REMOVE_COMPONENT** - Remove `items:aimed_at` from item (primary target)
4. **DISPATCH_EVENT** - Dispatch `items:aim_lowered` event with previous target info
5. **END_TURN** - Complete actor's turn successfully

**Key Interpolations:**
- `{event.payload.targetId}` - The item (primary target in lower_aim action)
- `{context.aimedAtData.targetId}` - What was being aimed at (retrieved from QUERY_COMPONENT)

### 3. Rule File Naming

**Convention:** `handle_<action_name>.rule.json`
- `handle_aim_item.rule.json` for `items:aim_item` action
- `handle_lower_aim.rule.json` for `items:lower_aim` action

### 4. Directory Structure

```
data/mods/items/
├── rules/
│   ├── handle_aim_item.rule.json    ← Create
│   ├── handle_lower_aim.rule.json   ← Create
│   └── ... (existing rules)
```

## Acceptance Criteria

- [ ] `handle_aim_item.rule.json` created at `data/mods/items/rules/`
- [ ] `handle_lower_aim.rule.json` created at `data/mods/items/rules/`
- [ ] Both rules have valid JSON syntax
- [ ] Both rules validate against `rule.schema.json`
- [ ] Rule IDs follow namespace pattern (`items:*`)
- [ ] Conditions reference correct condition IDs
- [ ] Operations use correct types (GET_TIMESTAMP, ADD_COMPONENT, REMOVE_COMPONENT, DISPATCH_EVENT, END_TURN)
- [ ] Entity references use correct payload paths
- [ ] Interpolation syntax is correct (`{event.payload.*}`, `{context.*}`)
- [ ] Event types match event schemas (items:item_aimed, items:aim_lowered)
- [ ] `npm run validate` passes without errors

## Testing Requirements

### Validation Commands

```bash
# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/rules/handle_aim_item.rule.json'))" && echo "✓ handle_aim_item valid"
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/rules/handle_lower_aim.rule.json'))" && echo "✓ handle_lower_aim valid"

# Validate against schema
npm run validate

# Check rule IDs and conditions
grep -q '"id": "items:handle_aim_item"' data/mods/items/rules/handle_aim_item.rule.json && echo "✓ Correct ID"
grep -q '"condition": "items:event-is-action-aim-item"' data/mods/items/rules/handle_aim_item.rule.json && echo "✓ Correct condition"
```

### Integration Test

**File:** `tests/integration/mods/items/aimingRuleExecution.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Items Mod - Aiming Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:aim_item');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('handle_aim_item rule', () => {
    it('should add aimed_at component when aiming', async () => {
      const actor = fixture.createActor('Actor');
      const target = fixture.createActor('Target');
      const pistol = fixture.createEntity('weapons:pistol', {
        'items:item': {},
        'items:portable': {},
        'items:aimable': {}
      });

      fixture.addToInventory(actor.id, [pistol.id]);

      // Initially no aimed_at component
      expect(fixture.getComponent(pistol.id, 'items:aimed_at')).toBeUndefined();

      // Execute aim action
      await fixture.executeAction(actor.id, 'items:aim_item', {
        primary: target.id,
        secondary: pistol.id
      });

      // Verify aimed_at component added
      const aimedAt = fixture.getComponent(pistol.id, 'items:aimed_at');
      expect(aimedAt).toBeDefined();
      expect(aimedAt.targetId).toBe(target.id);
      expect(aimedAt.aimedBy).toBe(actor.id);
      expect(aimedAt.timestamp).toBeGreaterThan(0);

      // Verify event dispatched
      const events = fixture.getDispatchedEvents('items:item_aimed');
      expect(events).toHaveLength(1);
    });
  });

  describe('handle_lower_aim rule', () => {
    it('should remove aimed_at component when lowering aim', async () => {
      const actor = fixture.createActor('Actor');
      const target = fixture.createActor('Target');
      const pistol = fixture.createEntity('weapons:pistol', {
        'items:item': {},
        'items:portable': {},
        'items:aimable': {},
        'items:aimed_at': {
          targetId: target.id,
          aimedBy: actor.id,
          timestamp: 1000
        }
      });

      fixture.addToInventory(actor.id, [pistol.id]);

      // Initially has aimed_at component
      expect(fixture.getComponent(pistol.id, 'items:aimed_at')).toBeDefined();

      // Execute lower aim action
      await fixture.executeAction(actor.id, 'items:lower_aim', {
        primary: pistol.id
      });

      // Verify aimed_at component removed
      expect(fixture.getComponent(pistol.id, 'items:aimed_at')).toBeUndefined();

      // Verify event dispatched
      const events = fixture.getDispatchedEvents('items:aim_lowered');
      expect(events).toHaveLength(1);
      expect(events[0].payload.previousTargetId).toBe(target.id);
    });
  });
});
```

## Additional Notes

- **Component Lifecycle:** The `items:aimed_at` component is transient:
  - Created by `handle_aim_item` rule
  - Destroyed by `handle_lower_aim` rule
  - Never persisted to save files if actor logs out while aiming
- **Operation Order:** Query component BEFORE removing it to access data for events
- **Timestamp Usage:** GET_TIMESTAMP operation provides consistent game time across operations
- **Error Handling:** If ADD_COMPONENT fails, END_TURN with success:false (future enhancement)
- **Future Extensions:**
  - Add aim stability calculation (longer aim = more accurate)
  - Add fatigue penalties for long-term aiming
  - Auto-lower aim after timeout period
  - Prevent aiming while performing other actions (hands busy)

## Related Tickets

- **Depends On:**
  - WEASYSIMP-003 (Components) - manipulates these components
  - WEASYSIMP-006 (Events & Conditions) - uses conditions, dispatches events
- **Blocks:** WEASYSIMP-011 (Shoot Weapon) - requires aimed_at component
- **Completes:** Items mod aiming system foundation
- **Reference:** See `data/mods/items/rules/` for existing rule examples
