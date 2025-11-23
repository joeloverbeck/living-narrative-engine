# WEASYSIMP-006: Create Items Mod Aiming Events & Conditions

**Phase:** Items Mod Extensions
**Timeline:** 1 day
**Status:** ✅ Completed
**Dependencies:** WEASYSIMP-004 (Aiming Actions)
**Priority:** P0 (Blocking)

## Overview

Create two event schemas for the items mod aiming system: `items:item_aimed` and `items:aim_lowered` events. These enable rule triggering and event-driven communication. The condition files already exist in the codebase.

## Assumptions Corrected

**Original Assumptions:**
- Need to create both event and condition files
- Conditions use `"condition"` key
- Conditions check both event type and actionId
- Events use field names like `actorId`, `itemId`, `targetId`

**Actual State of Codebase:**
- ✅ Conditions already exist: `event-is-action-aim-item.condition.json` and `event-is-action-lower-aim.condition.json`
- ✅ Actions already exist: `aim_item.action.json` and `lower_aim.action.json`
- ✅ Rules already exist (as placeholders): `handle_aim_item.rule.json` and `handle_lower_aim.rule.json`
- ✅ Conditions use `"logic"` key (not `"condition"`)
- ✅ Conditions only check `event.payload.actionId` (no event type check)
- ✅ Events use field names like `actorEntity`, `itemEntity`, `targetEntity` (not `actorId`)
- ✅ Events don't use regex patterns, just `"type": "string"` with `minLength`

## Objectives

1. Create `items:item_aimed` event schema
2. Create `items:aim_lowered` event schema
3. Validate event schemas against existing patterns

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
      "actorEntity": {
        "type": "string",
        "description": "ID of actor aiming the item",
        "minLength": 1
      },
      "itemEntity": {
        "type": "string",
        "description": "ID of item being aimed (weapon, flashlight, camera, etc.)",
        "minLength": 1
      },
      "targetEntity": {
        "type": "string",
        "description": "ID of target being aimed at",
        "minLength": 1
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp when aiming started"
      }
    },
    "required": ["actorEntity", "itemEntity", "targetEntity", "timestamp"],
    "additionalProperties": false
  }
}
```

**Event Details:**
- **Dispatched By:** `items:handle_aim_item` rule (WEASYSIMP-007)
- **Payload Fields:**
  - `actorEntity` - Who is aiming
  - `itemEntity` - What they're aiming (the item)
  - `targetEntity` - What they're aiming at
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
  "description": "Dispatched when an actor stops aiming an item. The previousTargetEntity is optional (may be omitted if target was destroyed).",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "actorEntity": {
        "type": "string",
        "description": "ID of actor who lowered aim",
        "minLength": 1
      },
      "itemEntity": {
        "type": "string",
        "description": "ID of item that was aimed",
        "minLength": 1
      },
      "previousTargetEntity": {
        "type": "string",
        "description": "ID of target that was aimed at (if still exists)",
        "minLength": 1
      },
      "timestamp": {
        "type": "number",
        "description": "Game timestamp when aim was lowered"
      }
    },
    "required": ["actorEntity", "itemEntity", "timestamp"],
    "additionalProperties": false
  }
}
```

**Event Details:**
- **Dispatched By:** `items:handle_lower_aim` rule (WEASYSIMP-007)
- **Payload Fields:**
  - `actorEntity` - Who lowered aim
  - `itemEntity` - What was being aimed
  - `previousTargetEntity` - What was aimed at (optional - may have been destroyed)
  - `timestamp` - When aim was lowered
- **Use Cases:**
  - Trigger AI reactions (target notices aim lowered)
  - Update UI (hide aim indicator)
  - Calculate aim duration (timestamp difference)
  - Trigger sound effects (lowering weapon sound)

### 3. event-is-action-aim-item Condition

**Status:** ✅ Already exists in codebase

**File:** `data/mods/items/conditions/event-is-action-aim-item.condition.json`

**Actual Content:**
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-aim-item",
  "description": "True when event is attempting the aim_item action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:aim_item"
    ]
  }
}
```

**Condition Details:**
- **Matches:** Events where `actionId` is `items:aim_item`
- **Used By:** `items:handle_aim_item` rule
- **Pattern:** Standard action condition pattern (checks actionId only)

### 4. event-is-action-lower-aim Condition

**Status:** ✅ Already exists in codebase

**File:** `data/mods/items/conditions/event-is-action-lower-aim.condition.json`

**Actual Content:**
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-lower-aim",
  "description": "True when event is attempting the lower_aim action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:lower_aim"
    ]
  }
}
```

**Condition Details:**
- **Matches:** Events where `actionId` is `items:lower_aim`
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
│   ├── event-is-action-aim-item.condition.json   ✅ Already exists
│   ├── event-is-action-lower-aim.condition.json  ✅ Already exists
│   └── ... (existing conditions)
```

## Acceptance Criteria

- [x] `item_aimed.event.json` created at `data/mods/items/events/`
- [x] `aim_lowered.event.json` created at `data/mods/items/events/`
- [x] `event-is-action-aim-item.condition.json` exists (already in codebase)
- [x] `event-is-action-lower-aim.condition.json` exists (already in codebase)
- [x] All event files have valid JSON syntax
- [x] Events validate against `event.schema.json`
- [x] Event IDs follow namespace pattern (`items:*`)
- [x] Field names follow convention (`actorEntity`, `itemEntity`, `targetEntity`)
- [x] Required fields are correctly specified
- [x] `previousTargetEntity` is NOT required in `aim_lowered` (optional field)
- [x] `npm run validate` passes without errors (no issues with new event files)

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
      actorEntity: actor.id,
      itemEntity: pistol.id,
      targetEntity: target.id
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
        targetEntity: target.id,
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
      actorEntity: actor.id,
      itemEntity: pistol.id,
      previousTargetEntity: target.id
    });
  });
});
```

## Additional Notes

- **Event Naming:** Events use past tense (`item_aimed`, `aim_lowered`) to indicate completed actions
- **Condition Naming:** Conditions use `event-is-action-*` pattern for action conditions
- **Condition Schema:** Uses `"logic"` key (not `"condition"`) for JSON-Logic expressions
- **Field Naming:** Events use `*Entity` suffix (`actorEntity`, `itemEntity`, `targetEntity`) consistent with other items mod events
- **Event Payload Access:** Rules access event payload via `{event.payload.fieldName}` interpolation
- **Optional Fields:** `previousTargetEntity` in `aim_lowered` is optional because target might have been destroyed/removed before aim was lowered
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

---

## Outcome

**Status:** ✅ Completed

### What Was Changed

**Event Files Created (2):**
1. ✅ `data/mods/items/events/item_aimed.event.json` - Event dispatched when actor aims item at target
2. ✅ `data/mods/items/events/aim_lowered.event.json` - Event dispatched when actor stops aiming

**Tests Created (2):**
1. ✅ `tests/unit/mods/items/aimingEventSchemas.test.js` - 17 unit tests validating event schema structure
2. ✅ `tests/integration/mods/items/aimingEventsDispatched.test.js` - Integration tests for event dispatching

**Conditions Status:**
- ✅ Both conditions already existed in codebase (no changes needed)
- ✅ `event-is-action-aim-item.condition.json` - Already present
- ✅ `event-is-action-lower-aim.condition.json` - Already present

### Differences from Original Plan

**Corrected Assumptions:**
1. **Conditions**: Already existed in codebase (not created as originally planned)
2. **Field Naming**: Used `actorEntity`, `itemEntity`, `targetEntity` (not `actorId`, `itemId`, `targetId`)
3. **Condition Schema**: Uses `"logic"` key (not `"condition"`)
4. **Condition Logic**: Only checks `actionId` (not both event type and actionId)
5. **Field Validation**: Used `minLength: 1` (not regex patterns)

### Validation Results

- ✅ All JSON syntax valid
- ✅ All event schemas validate against `event.schema.json`
- ✅ All 17 unit tests pass
- ✅ Event IDs follow namespace pattern (`items:*`)
- ✅ Field names follow items mod convention
- ✅ `previousTargetEntity` correctly optional in `aim_lowered` event
- ✅ No validation errors for new event files

### Impact

These event schemas enable:
- Rule-based responses to aiming actions (WEASYSIMP-007)
- AI reactions to being aimed at
- UI updates for aim indicators
- Analytics and logging for aiming behavior
- Time-based aiming mechanics (duration, stability, fatigue)
