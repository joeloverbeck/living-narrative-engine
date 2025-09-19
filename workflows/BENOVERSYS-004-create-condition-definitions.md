# BENOVERSYS-004: Create Condition Definitions

## Overview
Create two condition definitions that detect when bend_over and straighten_up actions are attempted. These conditions will be used by the rule system to trigger appropriate handlers when actors attempt to bend over surfaces or straighten up.

## Prerequisites
- BENOVERSYS-003 completed (action definitions exist)
- Understanding of condition schema and JSON Logic
- Knowledge of event structure for ACTION_ATTEMPTED events

## Acceptance Criteria
1. `event-is-action-bend-over` condition correctly identifies bend_over attempts
2. `event-is-action-straighten-up` condition correctly identifies straighten_up attempts
3. Both conditions use proper JSON Logic syntax
4. Conditions validate against condition schema
5. Conditions integrate with rule system properly

## Implementation Steps

### Step 1: Create event-is-action-bend-over Condition
Create `data/mods/positioning/conditions/event-is-action-bend-over.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-bend-over",
  "description": "Checks if the event is a bend_over action attempt",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:bend_over"
    ]
  }
}
```

**Key Elements:**
- Uses JSON Logic equality operator (`==`)
- Checks `event.payload.actionId` field from ACTION_ATTEMPTED events
- Matches against the specific action ID `positioning:bend_over`
- Simple boolean condition for rule triggering

### Step 2: Create event-is-action-straighten-up Condition
Create `data/mods/positioning/conditions/event-is-action-straighten-up.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-straighten-up",
  "description": "Checks if the event is a straighten_up action attempt",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:straighten_up"
    ]
  }
}
```

**Key Elements:**
- Identical structure to bend-over condition
- Matches `positioning:straighten_up` action ID
- Will trigger the corresponding rule handler

### Step 3: Validate Condition Schemas
Run validation for both conditions:

```bash
# Validate event-is-action-bend-over condition
npm run validate-condition data/mods/positioning/conditions/event-is-action-bend-over.condition.json

# Validate event-is-action-straighten-up condition
npm run validate-condition data/mods/positioning/conditions/event-is-action-straighten-up.condition.json
```

### Step 4: Update Positioning Mod Manifest
Add the new conditions to `data/mods/positioning/mod-manifest.json`:

```json
{
  "conditions": [
    // ... existing conditions
    "positioning:event-is-action-bend-over",
    "positioning:event-is-action-straighten-up"
  ]
}
```

## Testing Requirements

### Unit Tests

1. **Condition Logic Tests**:
```javascript
describe('Bending action conditions', () => {
  it('should identify bend_over action events', () => {
    const bendOverCondition = loadCondition('positioning:event-is-action-bend-over');

    const bendOverEvent = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: 'positioning:bend_over',
        actorId: 'test:actor',
        targetId: 'test:counter'
      }
    };

    const result = evaluateCondition(bendOverCondition, { event: bendOverEvent });
    expect(result).toBe(true);
  });

  it('should not match other action events', () => {
    const bendOverCondition = loadCondition('positioning:event-is-action-bend-over');

    const sitDownEvent = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: 'positioning:sit_down',
        actorId: 'test:actor',
        targetId: 'test:chair'
      }
    };

    const result = evaluateCondition(bendOverCondition, { event: sitDownEvent });
    expect(result).toBe(false);
  });

  it('should identify straighten_up action events', () => {
    const straightenCondition = loadCondition('positioning:event-is-action-straighten-up');

    const straightenEvent = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: 'positioning:straighten_up',
        actorId: 'test:actor',
        targetId: 'test:counter'
      }
    };

    const result = evaluateCondition(straightenCondition, { event: straightenEvent });
    expect(result).toBe(true);
  });
});
```

2. **JSON Logic Evaluation Tests**:
```javascript
describe('Condition JSON Logic', () => {
  it('should handle missing event payload gracefully', () => {
    const condition = loadCondition('positioning:event-is-action-bend-over');

    const malformedEvent = {
      type: 'ACTION_ATTEMPTED'
      // missing payload
    };

    const result = evaluateCondition(condition, { event: malformedEvent });
    expect(result).toBe(false);
  });

  it('should handle null actionId', () => {
    const condition = loadCondition('positioning:event-is-action-bend-over');

    const nullActionEvent = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: null
      }
    };

    const result = evaluateCondition(condition, { event: nullActionEvent });
    expect(result).toBe(false);
  });
});
```

### Integration Tests

1. **Rule System Integration**:
```javascript
describe('Condition-Rule integration', () => {
  it('should trigger bend_over rule when condition matches', async () => {
    const event = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: 'positioning:bend_over',
        actorId: 'test:actor',
        targetId: 'test:counter'
      }
    };

    await eventBus.dispatch(event);

    // Verify the handle_bend_over rule was triggered
    const bendOverRule = getRuleExecutions('positioning:handle_bend_over');
    expect(bendOverRule.length).toBe(1);
  });

  it('should not trigger rules for non-matching events', async () => {
    const event = {
      type: 'ENTITY_CREATED',
      payload: {
        entityId: 'test:entity'
      }
    };

    await eventBus.dispatch(event);

    // Verify no bending rules were triggered
    const bendOverRule = getRuleExecutions('positioning:handle_bend_over');
    const straightenRule = getRuleExecutions('positioning:handle_straighten_up');
    expect(bendOverRule.length).toBe(0);
    expect(straightenRule.length).toBe(0);
  });
});
```

2. **Event Flow Tests**:
```javascript
describe('Complete event flow', () => {
  it('should process bend_over action from UI to rule', async () => {
    // User clicks bend_over action in UI
    const actionButton = {
      actionId: 'positioning:bend_over',
      targetId: 'kitchen:counter'
    };

    // UI dispatches ACTION_ATTEMPTED event
    await ui.performAction(actionButton);

    // Condition should match and trigger rule
    const ruleExecutions = await waitForRuleExecution();
    expect(ruleExecutions[0].ruleId).toBe('positioning:handle_bend_over');
  });
});
```

## Code Examples

### Example Condition Evaluation Context
```javascript
// Context provided to condition evaluation
const context = {
  event: {
    type: 'ACTION_ATTEMPTED',
    payload: {
      actionId: 'positioning:bend_over',
      actorId: 'player:001',
      targetId: 'furniture:counter_01'
    },
    timestamp: Date.now()
  },
  actor: actorEntity,
  target: targetEntity,
  gameState: currentGameState
};

// Condition evaluation
const shouldTrigger = jsonLogic.apply(
  condition.logic,
  context
);
```

### Example Rule Using Conditions
```json
{
  "id": "positioning:handle_bend_over",
  "conditions": ["positioning:event-is-action-bend-over"],
  "operations": [
    // ... operations to handle bending over
  ]
}
```

## Notes
- Conditions follow the exact same pattern as existing positioning conditions
- Simple equality check is sufficient for action detection
- JSON Logic provides reliable, predictable evaluation
- Conditions are reusable if other rules need to detect these actions
- Future enhancement: Could add compound conditions for complex scenarios

## Dependencies
- Blocks: BENOVERSYS-005, BENOVERSYS-006 (rules need these conditions)
- Blocked by: BENOVERSYS-003 (requires action IDs to match against)

## Estimated Effort
- 20 minutes implementation
- 30 minutes testing and validation

## Risk Assessment
- **Very Low Risk**: Conditions are simple equality checks
- **Mitigation**: Thorough testing of JSON Logic evaluation
- **Recovery**: Simple file modification if logic needs adjustment

## Success Metrics
- Both condition files created with correct JSON Logic
- Condition validation passes
- Conditions correctly identify matching events
- Integration with rule system confirmed
- No false positives or false negatives in testing