# CLOREMBLO-005: Add Execution-Time Blocking Validation to Removal Rules

**Category**: Clothing System Enhancement
**Priority**: High
**Estimated Effort**: 2-3 hours
**Phase**: 4 - Rule Integration

---

## Overview

Add execution-time validation to clothing removal rules using IF operations with the `isRemovalBlocked` operator. This provides a second layer of validation (in addition to scope filtering) and enables clear error messaging when removal is blocked.

---

## Background

The blocking system has two layers of protection:
1. **Scope Filtering** (CLOREMBLO-004): Blocked items don't appear in `topmost_clothing` scope during action discovery
2. **Execution Validation** (this ticket): Double-check removal is allowed before unequipping during rule execution

This dual approach:
- **Discovery Time**: Prevents blocked items from appearing in action lists (scope filtering)
- **Execution Time**: Validates removal is still allowed when rule executes (IF operation check)
- Provides clear error messages when removal fails
- Follows defense-in-depth principle (state could change between discovery and execution)

### Why NOT Use Action Prerequisites?

Action prerequisites are evaluated during action DISCOVERY (before target resolution), so they:
- Cannot access target information (targets not yet resolved)
- Only have `actor` context available, not target item context
- Are unsuitable for validating specific target items

Instead, we use IF operations in the RULE to check blocking during EXECUTION when both actor and target are known.

---

## Requirements

### Approach: IF Operations in Rules

We'll add IF operations at the start of each removal rule to:
1. Check if the target item's removal is blocked using `isRemovalBlocked` operator
2. If blocked, emit an error message and skip the unequip operation
3. If not blocked, proceed with normal unequip flow

**Operator Context Paths**:
- `remove_clothing` rule: Uses `actor` (wearer) and `target` (item) paths
- `remove_others_clothing` rule: Uses `primary` (wearer) and `secondary` (item) paths

---

## Implementation Tasks

### 1. Update remove_clothing Rule

**File**: `data/mods/clothing/rules/handle_remove_clothing.rule.json`

**Changes**: Wrap the UNEQUIP_CLOTHING operation in an IF operation that checks blocking.

**Current UNEQUIP_CLOTHING operation** (line 31-38):
```json
{
  "type": "UNEQUIP_CLOTHING",
  "parameters": {
    "entity_ref": "actor",
    "clothing_item_id": "{event.payload.targetId}",
    "cascade_unequip": false,
    "destination": "ground"
  }
}
```

**New structure with IF operation**:
```json
{
  "type": "IF",
  "parameters": {
    "condition": {
      "!": {
        "isRemovalBlocked": ["actor", "target"]
      }
    },
    "then_actions": [
      {
        "type": "UNEQUIP_CLOTHING",
        "parameters": {
          "entity_ref": "actor",
          "clothing_item_id": "{event.payload.targetId}",
          "cascade_unequip": false,
          "destination": "ground"
        }
      },
      {
        "type": "REGENERATE_DESCRIPTION",
        "parameters": {
          "entity_ref": "actor"
        }
      },
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "variable_name": "logMessage",
          "value": "{context.actorName} removes their {context.targetName}."
        }
      },
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "variable_name": "perceptionType",
          "value": "action_target_general"
        }
      },
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "variable_name": "locationId",
          "value": "{context.actorPosition.locationId}"
        }
      },
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "variable_name": "targetId",
          "value": "{event.payload.targetId}"
        }
      },
      {
        "macro": "core:logSuccessAndEndTurn"
      }
    ],
    "else_actions": [
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "variable_name": "logMessage",
          "value": "{context.actorName} cannot remove their {context.targetName} - it is blocked by other clothing."
        }
      },
      {
        "type": "DISPATCH_EVENT",
        "parameters": {
          "event_type": "core:action_failed",
          "payload": {
            "actorId": "{event.payload.actorId}",
            "actionId": "{event.payload.actionId}",
            "reason": "removal_blocked",
            "message": "{context.logMessage}"
          }
        }
      }
    ]
  }
}
```

**Rationale**:
- Checks `!isRemovalBlocked(actor, target)` - returns true if NOT blocked
- Uses entity ref paths: `actor` (the wearer) and `target` (the clothing item)
- If not blocked: proceeds with unequip and success messaging
- If blocked: emits error message and action_failed event, skips unequip

### 2. Update remove_others_clothing Rule

**File**: `data/mods/clothing/rules/handle_remove_others_clothing.rule.json`

**Changes**: Similar IF operation wrapping, using `primary` and `secondary` entity refs.

**Current UNEQUIP_CLOTHING operation** (line 40-47):
```json
{
  "type": "UNEQUIP_CLOTHING",
  "parameters": {
    "entity_ref": "primary",
    "clothing_item_id": "{event.payload.secondaryId}",
    "cascade_unequip": false,
    "destination": "ground"
  }
}
```

**New structure with IF operation**:
```json
{
  "type": "IF",
  "parameters": {
    "condition": {
      "!": {
        "isRemovalBlocked": ["primary", "secondary"]
      }
    },
    "then_actions": [
      {
        "type": "UNEQUIP_CLOTHING",
        "parameters": {
          "entity_ref": "primary",
          "clothing_item_id": "{event.payload.secondaryId}",
          "cascade_unequip": false,
          "destination": "ground"
        }
      },
      {
        "type": "REGENERATE_DESCRIPTION",
        "parameters": {
          "entity_ref": "primary"
        }
      },
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "variable_name": "logMessage",
          "value": "{context.actorName} removes {context.primaryName}'s {context.secondaryName}."
        }
      },
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "variable_name": "perceptionType",
          "value": "action_target_general"
        }
      },
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "variable_name": "locationId",
          "value": "{context.actorPosition.locationId}"
        }
      },
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "variable_name": "targetId",
          "value": "{event.payload.primaryId}"
        }
      },
      {
        "macro": "core:logSuccessAndEndTurn"
      }
    ],
    "else_actions": [
      {
        "type": "SET_VARIABLE",
        "parameters": {
          "variable_name": "logMessage",
          "value": "{context.actorName} cannot remove {context.primaryName}'s {context.secondaryName} - it is blocked by other clothing."
        }
      },
      {
        "type": "DISPATCH_EVENT",
        "parameters": {
          "event_type": "core:action_failed",
          "payload": {
            "actorId": "{event.payload.actorId}",
            "actionId": "{event.payload.actionId}",
            "reason": "removal_blocked",
            "message": "{context.logMessage}"
          }
        }
      }
    ]
  }
}
```

**Rationale**:
- Uses entity ref paths: `primary` (the person wearing the clothes) and `secondary` (the clothing item)
- Same validation logic as remove_clothing
- Adjusted error message for "other person" context

### 3. Create Integration Tests

**File**: `tests/integration/clothing/removeClothingRuleBlocking.integration.test.js`

**Test Coverage**: Verify that rules correctly check blocking and emit appropriate events.

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Remove Clothing Rule - Blocking Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('clothing', 'clothing:remove_clothing');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should emit action_failed event when trying to remove blocked clothing', async () => {
    // Arrange: Create actor with belt blocking pants
    const actor = fixture.createEntity({
      id: 'actor1',
      components: [
        { componentId: 'core:name', text: 'John' },
        { componentId: 'core:position', locationId: 'room1' },
        {
          componentId: 'clothing:equipment',
          equipped: {
            torso_lower: { accessories: ['belt1'] },
            legs: { base: ['pants1'] }
          }
        }
      ]
    });

    const belt = fixture.createEntity({
      id: 'belt1',
      components: [
        { componentId: 'core:name', text: 'belt' },
        {
          componentId: 'clothing:wearable',
          layer: 'accessories',
          equipmentSlots: { primary: 'torso_lower' }
        },
        {
          componentId: 'clothing:blocks_removal',
          blockedSlots: [{
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first'
          }]
        }
      ]
    });

    const pants = fixture.createEntity({
      id: 'pants1',
      components: [
        { componentId: 'core:name', text: 'pants' },
        {
          componentId: 'clothing:wearable',
          layer: 'base',
          equipmentSlots: { primary: 'legs' }
        }
      ]
    });

    fixture.reset([actor, belt, pants]);

    // Act: Try to remove pants via action
    await fixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'clothing:remove_clothing',
      targetId: 'pants1',
      originalInput: 'remove pants'
    });

    // Assert: Should have action_failed event, not perceptible_event
    const failedEvent = fixture.events.find(e => e.eventType === 'core:action_failed');
    expect(failedEvent).toBeDefined();
    expect(failedEvent.payload.reason).toBe('removal_blocked');
    expect(failedEvent.payload.message).toContain('blocked');

    // Should NOT have perceptible event (action didn't succeed)
    const perceptibleEvent = fixture.events.find(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvent).toBeUndefined();
  });

  it('should successfully remove clothing when not blocked', async () => {
    // Arrange: Create actor with just a shirt (no blockers)
    const actor = fixture.createEntity({
      id: 'actor1',
      components: [
        { componentId: 'core:name', text: 'John' },
        { componentId: 'core:position', locationId: 'room1' },
        {
          componentId: 'clothing:equipment',
          equipped: {
            torso_upper: { base: ['shirt1'] }
          }
        }
      ]
    });

    const shirt = fixture.createEntity({
      id: 'shirt1',
      components: [
        { componentId: 'core:name', text: 'shirt' },
        {
          componentId: 'clothing:wearable',
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' }
        }
      ]
    });

    fixture.reset([actor, shirt]);

    // Act: Remove shirt
    await fixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'clothing:remove_clothing',
      targetId: 'shirt1',
      originalInput: 'remove shirt'
    });

    // Assert: Should have perceptible_event (success)
    const perceptibleEvent = fixture.events.find(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('John');
    expect(perceptibleEvent.payload.descriptionText).toContain('shirt');
  });
});

describe('Remove Others Clothing Rule - Blocking Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('clothing', 'clothing:remove_others_clothing');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should emit action_failed when trying to remove blocked clothing from another person', async () => {
    // Arrange: Create actor and target with blocked clothing
    const scenario = fixture.createStandardActorTarget(['John', 'Jane']);

    const belt = fixture.createEntity({
      id: 'belt1',
      components: [
        { componentId: 'core:name', text: 'belt' },
        {
          componentId: 'clothing:wearable',
          layer: 'accessories',
          equipmentSlots: { primary: 'torso_lower' }
        },
        {
          componentId: 'clothing:blocks_removal',
          blockedSlots: [{
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first'
          }]
        }
      ]
    });

    const pants = fixture.createEntity({
      id: 'pants1',
      components: [
        { componentId: 'core:name', text: 'pants' },
        {
          componentId: 'clothing:wearable',
          layer: 'base',
          equipmentSlots: { primary: 'legs' }
        }
      ]
    });

    // Add equipment to Jane
    fixture.testEnv.entityManager.addComponent(scenario.target.id, 'clothing:equipment', {
      equipped: {
        torso_lower: { accessories: ['belt1'] },
        legs: { base: ['pants1'] }
      }
    });

    fixture.reset([scenario.actor, scenario.target, belt, pants]);

    // Act: John tries to remove Jane's pants
    await fixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:remove_others_clothing',
      primaryId: scenario.target.id,
      secondaryId: 'pants1',
      originalInput: "remove Jane's pants"
    });

    // Assert
    const failedEvent = fixture.events.find(e => e.eventType === 'core:action_failed');
    expect(failedEvent).toBeDefined();
    expect(failedEvent.payload.reason).toBe('removal_blocked');
  });
});
```

### 4. Run Tests

```bash
# Integration tests
NODE_ENV=test npm run test:integration -- tests/integration/clothing/removeClothingRuleBlocking.integration.test.js
```

---

## Validation

### Schema Validation

```bash
npm run validate
```

Expected: All rule schemas valid with IF operation structure.

### Integration Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/clothing/removeClothingRuleBlocking.integration.test.js
```

Expected: All tests pass, blocking properly prevents unequip and emits action_failed events.

### Type Checking

```bash
npm run typecheck
```

Expected: No errors.

### Manual Testing

1. Equip belt and pants on a character
2. Try to remove pants - should fail with error message
3. Remove belt first
4. Try to remove pants again - should succeed

### Full Test Suite

```bash
npm run test:ci
```

Expected: No regressions, all tests pass.

---

## Acceptance Criteria

- [ ] `remove_clothing` rule updated with IF operation for blocking validation
- [ ] `remove_others_clothing` rule updated with IF operation for blocking validation
- [ ] IF operations use correct entity ref paths (`actor`/`target` and `primary`/`secondary`)
- [ ] IF operations use `isRemovalBlocked` operator with negation
- [ ] Blocked removal emits `action_failed` event with appropriate message
- [ ] Successful removal proceeds with normal unequip flow
- [ ] Rules validate successfully
- [ ] Integration tests created and passing
- [ ] Schema validation passes
- [ ] Type checking passes
- [ ] No regressions in existing tests

---

## Notes

### Why Both Scope Filtering AND Execution Validation?

1. **Scope Filtering** (Discovery Time): Prevents blocked items from appearing in action lists
2. **Execution Validation** (Execution Time): Safety check when rule actually runs

**Benefits of Dual Approach**:
- **Defense in Depth**: Two layers of protection
- **State Changes**: Validates blocking hasn't changed between discovery and execution
- **Clear Errors**: IF operation provides specific error messages via action_failed events
- **Fail-Safe**: If scope filtering somehow fails, execution validation still prevents invalid removal

### Entity Reference Paths

The IF operations use entity reference paths available in rule execution context:

**remove_clothing rule**:
- `actor`: The entity wearing the clothing (from `event.payload.actorId`)
- `target`: The clothing item being removed (from `event.payload.targetId`)

**remove_others_clothing rule**:
- `primary`: The entity wearing the clothing (from `event.payload.primaryId`)
- `secondary`: The clothing item being removed (from `event.payload.secondaryId`)

These entity refs are automatically resolved by the rule execution system to actual entity objects.

### Error Handling

When blocking is detected:
- IF operation's `else_actions` branch executes
- Emits `core:action_failed` event with:
  - `reason: "removal_blocked"`
  - User-friendly error message
- Skips the UNEQUIP_CLOTHING operation entirely
- Prevents state corruption from partial unequipping

---

## Common Pitfalls

**Pitfall**: Forgetting negation operator in IF condition
**Solution**: Must use `"!": { "isRemovalBlocked": [...] }` because operator returns `true` when blocked

**Pitfall**: Wrong entity ref paths for each rule
**Solution**:
- `remove_clothing`: Use `actor` and `target`
- `remove_others_clothing`: Use `primary` and `secondary`

**Pitfall**: Not moving all success operations into `then_actions`
**Solution**: Move UNEQUIP, REGENERATE_DESCRIPTION, SET_VARIABLE, and macro into `then_actions` block

**Pitfall**: Forgetting to emit action_failed event in else branch
**Solution**: Always include DISPATCH_EVENT with action_failed in `else_actions`

---

## Example Execution Flow

### Scenario: Trying to Remove Blocked Pants

```
1. Actor wearing: belt (blocks legs/base), pants (legs/base)
2. User selects "remove pants" action (pants appears in action list due to topmost_clothing scope)
3. Rule executes: handle_remove_clothing fires for attempt_action event
4. IF operation evaluates: isRemovalBlocked(actor, pants) = true
5. Negation: !true = false
6. IF condition fails, else_actions branch executes:
   - Sets error message in context
   - Dispatches action_failed event
7. UNEQUIP_CLOTHING is skipped (only in then_actions)
8. Player sees error message: "cannot remove pants - blocked by other clothing"
```

### Scenario: Removing Unblocked Shirt

```
1. Actor wearing: shirt (torso_upper/base), no blockers
2. User selects "remove shirt" action
3. Rule executes: handle_remove_clothing fires
4. IF operation evaluates: isRemovalBlocked(actor, shirt) = false
5. Negation: !false = true
6. IF condition passes, then_actions branch executes:
   - Unequips shirt
   - Regenerates description
   - Sets success message
   - Logs perceptible event
7. Player sees success: "John removes their shirt"
```

---

## Related Tickets

- **CLOREMBLO-002**: Implement IsRemovalBlockedOperator (prerequisite) - REQUIRED
- **CLOREMBLO-003**: Register operator in DI container (prerequisite) - REQUIRED
- **CLOREMBLO-004**: Integrate blocking into scope resolver (complementary) - Works at discovery time
- **CLOREMBLO-006**: Update belt entities (uses this validation)
- **CLOREMBLO-007**: Create comprehensive test suite (validates this)

---

## Implementation Checklist

### Pre-Implementation Verification
- [ ] Verify CLOREMBLO-002 completed (isRemovalBlocked operator exists)
- [ ] Verify CLOREMBLO-003 completed (operator registered in DI)
- [ ] Review IF operation schema structure
- [ ] Review current rule files to understand structure

### Implementation
- [ ] Update `handle_remove_clothing.rule.json` with IF operation
- [ ] Update `handle_remove_others_clothing.rule.json` with IF operation
- [ ] Validate rule JSON structure

### Testing
- [ ] Create integration tests
- [ ] Run integration tests locally
- [ ] Manual testing with belt/pants scenario
- [ ] Verify action_failed events emit correctly

### Validation
- [ ] Run `npm run validate`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run test:ci`
- [ ] No regressions in existing tests

### Documentation
- [ ] Update related workflow tickets if needed
- [ ] Document any edge cases discovered during testing
