# WEASYSIMP-006: Create Items Mod Aiming Events & Conditions

**Phase:** Items Mod Extensions
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-004 (Aiming Actions)
**Priority:** P0 (Blocking)

## Overview

Create two event schemas and two condition files for the items mod aiming system: `items:item_aimed` and `items:aim_lowered` events, plus conditions `event-is-action-aim-item` and `event-is-action-lower-aim`. These enable rule triggering and event-driven communication.

## Objectives

1. Create `items:item_aimed` event schema
2. Create `items:aim_lowered` event schema
3. Create `event-is-action-aim-item` condition
4. Create `event-is-action-lower-aim` condition
5. Validate event and condition schemas

## Technical Details

### 1. items:item_aimed Event

**File to Create:** `data/mods/items/events/item_aimed.event.json`

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:item_aimed",
  "description": "Dispatched when an actor aims an item at a target. Contains actor, item, target, and timestamp information.",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "ID of actor aiming the item"
      },
      "itemId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "ID of item being aimed (weapon, flashlight, camera, etc.)"
      },
      "targetId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "ID of target being aimed at"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp when aiming started"
      }
    },
    "required": ["actorId", "itemId", "targetId", "timestamp"],
    "additionalProperties": false
  }
}
```

**Event Details:**
- **Dispatched By:** `items:handle_aim_item` rule (WEASYSIMP-007)
- **Payload Fields:**
  - `actorId` - Who is aiming
  - `itemId` - What they're aiming (the item)
  - `targetId` - What they're aiming at
  - `timestamp` - When aiming started (from GET_TIMESTAMP operation)
- **Use Cases:**
  - Trigger AI reactions (target notices being aimed at)
  - Update UI (show aim indicator)
  - Log aiming events for analytics
  - Trigger sound effects (raising weapon sound)

### 2. items:aim_lowered Event

**File to Create:** `data/mods/items/events/aim_lowered.event.json`

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:aim_lowered",
  "description": "Dispatched when an actor stops aiming an item. The previousTargetId is optional (may be omitted if target was destroyed).",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "ID of actor who lowered aim"
      },
      "itemId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "ID of item that was aimed"
      },
      "previousTargetId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "ID of target that was aimed at (if still exists)"
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp when aim was lowered"
      }
    },
    "required": ["actorId", "itemId", "timestamp"],
    "additionalProperties": false
  }
}
```

**Event Details:**
- **Dispatched By:** `items:handle_lower_aim` rule (WEASYSIMP-007)
- **Payload Fields:**
  - `actorId` - Who lowered aim
  - `itemId` - What was being aimed
  - `previousTargetId` - What was aimed at (optional - may have been destroyed)
  - `timestamp` - When aim was lowered
- **Use Cases:**
  - Trigger AI reactions (target notices aim lowered)
  - Update UI (hide aim indicator)
  - Calculate aim duration (timestamp difference)
  - Trigger sound effects (lowering weapon sound)

### 3. event-is-action-aim-item Condition

**File to Create:** `data/mods/items/conditions/event-is-action-aim-item.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-aim-item",
  "description": "Condition that matches when the event is an ACTION_DECIDED event for the aim_item action",
  "condition": {
    "and": [
      {
        "==": [
          { "var": "event.type" },
          "ACTION_DECIDED"
        ]
      },
      {
        "==": [
          { "var": "event.payload.actionId" },
          "items:aim_item"
        ]
      }
    ]
  }
}
```

**Condition Details:**
- **Matches:** `ACTION_DECIDED` events where `actionId` is `items:aim_item`
- **Used By:** `items:handle_aim_item` rule
- **Pattern:** Standard action condition pattern (checks event type + action ID)

### 4. event-is-action-lower-aim Condition

**File to Create:** `data/mods/items/conditions/event-is-action-lower-aim.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-lower-aim",
  "description": "Condition that matches when the event is an ACTION_DECIDED event for the lower_aim action",
  "condition": {
    "and": [
      {
        "==": [
          { "var": "event.type" },
          "ACTION_DECIDED"
        ]
      },
      {
        "==": [
          { "var": "event.payload.actionId" },
          "items:lower_aim"
        ]
      }
    ]
  }
}
```

**Condition Details:**
- **Matches:** `ACTION_DECIDED` events where `actionId` is `items:lower_aim`
- **Used By:** `items:handle_lower_aim` rule
- **Pattern:** Standard action condition pattern

### 5. Directory Structure

```
data/mods/items/
├── events/
│   ├── item_aimed.event.json       ← Create
│   ├── aim_lowered.event.json      ← Create
│   └── ... (existing events)
├── conditions/
│   ├── event-is-action-aim-item.condition.json   ← Create
│   ├── event-is-action-lower-aim.condition.json  ← Create
│   └── ... (existing conditions)
```

## Acceptance Criteria

- [ ] `item_aimed.event.json` created at `data/mods/items/events/`
- [ ] `aim_lowered.event.json` created at `data/mods/items/events/`
- [ ] `event-is-action-aim-item.condition.json` created at `data/mods/items/conditions/`
- [ ] `event-is-action-lower-aim.condition.json` created at `data/mods/items/conditions/`
- [ ] All files have valid JSON syntax
- [ ] Events validate against `event.schema.json`
- [ ] Conditions validate against `condition.schema.json`
- [ ] Event IDs follow namespace pattern (`items:*`)
- [ ] Condition IDs follow namespace pattern (`items:*`)
- [ ] Entity ID patterns are correct (`^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$`)
- [ ] Required fields are correctly specified
- [ ] `previousTargetId` is NOT required in `aim_lowered` (optional field)
- [ ] `npm run validate` passes without errors

## Testing Requirements

### Validation Commands

```bash
# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/events/item_aimed.event.json'))" && echo "✓ item_aimed valid"
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/events/aim_lowered.event.json'))" && echo "✓ aim_lowered valid"
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/conditions/event-is-action-aim-item.condition.json'))" && echo "✓ aim-item condition valid"
node -e "JSON.parse(require('fs').readFileSync('data/mods/items/conditions/event-is-action-lower-aim.condition.json'))" && echo "✓ lower-aim condition valid"

# Validate against schemas
npm run validate

# Check event IDs
grep -q '"id": "items:item_aimed"' data/mods/items/events/item_aimed.event.json && echo "✓ Correct event ID"
grep -q '"id": "items:aim_lowered"' data/mods/items/events/aim_lowered.event.json && echo "✓ Correct event ID"
```

### Integration Test Stub

**File:** `tests/integration/mods/items/aimingEventsDispatched.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Items Mod - Aiming Events', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:aim_item');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should dispatch item_aimed event when aiming', async () => {
    const actor = fixture.createActor('Actor');
    const target = fixture.createActor('Target');
    const pistol = fixture.createEntity('weapons:pistol', {
      'items:item': {},
      'items:portable': {},
      'items:aimable': {}
    });

    fixture.addToInventory(actor.id, [pistol.id]);

    await fixture.executeAction(actor.id, 'items:aim_item', {
      primary: target.id,
      secondary: pistol.id
    });

    const events = fixture.getDispatchedEvents('items:item_aimed');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      actorId: actor.id,
      itemId: pistol.id,
      targetId: target.id
    });
    expect(events[0].payload.timestamp).toBeDefined();
  });

  it('should dispatch aim_lowered event when lowering aim', async () => {
    const actor = fixture.createActor('Actor');
    const target = fixture.createActor('Target');
    const pistol = fixture.createEntity('weapons:pistol', {
      'items:item': {},
      'items:portable': {},
      'items:aimable': {},
      'items:aimed_at': {
        targetId: target.id,
        aimedBy: actor.id,
        timestamp: Date.now()
      }
    });

    fixture.addToInventory(actor.id, [pistol.id]);

    await fixture.executeAction(actor.id, 'items:lower_aim', {
      primary: pistol.id
    });

    const events = fixture.getDispatchedEvents('items:aim_lowered');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      actorId: actor.id,
      itemId: pistol.id,
      previousTargetId: target.id
    });
  });
});
```

## Additional Notes

- **Event Naming:** Events use past tense (`item_aimed`, `aim_lowered`) to indicate completed actions
- **Condition Naming:** Conditions use `event-is-action-*` pattern for action conditions
- **Event Payload Access:** Rules access event payload via `{event.payload.fieldName}` interpolation
- **Optional Fields:** `previousTargetId` in `aim_lowered` is optional because target might have been destroyed/removed before aim was lowered
- **Timestamp Usage:** Timestamps enable:
  - Calculating aim duration
  - Ordering events chronologically
  - Implementing time-based mechanics (aim stability, fatigue)
- **Future Extensions:**
  - Could add `aimDuration` calculated field to `aim_lowered` event
  - Could add `itemType` field to categorize different aimable items
  - Could add `aimMode` field for different aim stances

## Related Tickets

- **Depends On:** WEASYSIMP-004 (Aiming Actions)
- **Blocks:** WEASYSIMP-007 (Aiming Rules) - rules dispatch these events
- **Required By:** All aiming functionality in items and weapons mods
- **Reference:** See `data/mods/items/events/` and `data/mods/items/conditions/` for existing examples
