# MOULOCSYS-011: Intimacy Mod Integration  

**Phase**: Action Updates  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: MOULOCSYS-003 (lock handler), MOULOCSYS-004 (unlock handler), MOULOCSYS-006 (DI)  
**Estimated Time**: 4-5 hours

## Summary

Update intimacy mod kiss rules to use the mouth engagement locking system. Add `LOCK_MOUTH_ENGAGEMENT` operations when kisses begin and `UNLOCK_MOUTH_ENGAGEMENT` operations when kisses end. This ensures mouth availability is properly managed during intimate interactions.

## Technical Requirements

### Files to Modify

1. `data/mods/intimacy/rules/lean_in_for_deep_kiss.rule.json`
2. `data/mods/intimacy/rules/break_kiss_gently.rule.json`  
3. `data/mods/intimacy/rules/pull_back_breathlessly.rule.json`
4. `data/mods/intimacy/rules/pull_back_in_revulsion.rule.json`

### Integration Pattern

#### Kiss Start Rules - Add Locking Operations
```json
{
  "consequences": [
    // ... existing ADD_COMPONENT operations ...
    {
      "type": "LOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "LOCK_MOUTH_ENGAGEMENT", 
      "parameters": {
        "actor_id": "{event.payload.targetId}"
      }
    }
    // ... rest of existing consequences ...
  ]
}
```

#### Kiss End Rules - Add Unlocking Operations
```json
{
  "consequences": [
    {
      "type": "UNLOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "UNLOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.targetId}"
      }
    },
    // ... existing REMOVE_COMPONENT operations ...
    // ... rest of existing consequences ...
  ]
}
```

### Detailed Rule Updates

#### lean_in_for_deep_kiss.rule.json
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "intimacy:lean_in_for_deep_kiss",
  "description": "Start deep kiss between two characters",
  "event": "intimacy:lean_in_for_deep_kiss",
  "conditions": [
    // ... existing conditions unchanged ...
  ],
  "consequences": [
    // ADD_COMPONENT operations first
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_id": "{event.payload.actorId}",
        "component_id": "intimacy:kissing",
        "component_data": {
          "partner": "{event.payload.targetId}",
          "kiss_type": "deep",
          "started_at": "{current_timestamp}"
        }
      }
    },
    {
      "type": "ADD_COMPONENT", 
      "parameters": {
        "entity_id": "{event.payload.targetId}",
        "component_id": "intimacy:kissing",
        "component_data": {
          "partner": "{event.payload.actorId}",
          "kiss_type": "deep", 
          "started_at": "{current_timestamp}"
        }
      }
    },
    // Lock mouth engagement for both participants
    {
      "type": "LOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "LOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.targetId}"
      }
    }
    // ... other existing consequences unchanged ...
  ]
}
```

#### break_kiss_gently.rule.json
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json", 
  "id": "intimacy:break_kiss_gently",
  "description": "Gently end kiss between two characters",
  "event": "intimacy:break_kiss_gently",
  "conditions": [
    // ... existing conditions unchanged ...
  ],
  "consequences": [
    // Unlock mouth engagement FIRST (before removing components)
    {
      "type": "UNLOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "UNLOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.targetId}"
      }
    },
    // Then remove kissing components
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_id": "{event.payload.actorId}",
        "component_id": "intimacy:kissing"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_id": "{event.payload.targetId}",
        "component_id": "intimacy:kissing"
      }
    }
    // ... other existing consequences unchanged ...
  ]
}
```

#### pull_back_breathlessly.rule.json
```json
{
  "consequences": [
    // Unlock mouths first
    {
      "type": "UNLOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "UNLOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.targetId}"
      }
    },
    // Then remove kissing components
    // ... existing REMOVE_COMPONENT operations ...
    // ... other consequences ...
  ]
}
```

#### pull_back_in_revulsion.rule.json  
```json
{
  "consequences": [
    // Unlock mouths first
    {
      "type": "UNLOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "UNLOCK_MOUTH_ENGAGEMENT",
      "parameters": {
        "actor_id": "{event.payload.targetId}"
      }
    },
    // Then remove kissing components
    // ... existing REMOVE_COMPONENT operations ...
    // ... other consequences ...
  ]
}
```

## Implementation Details

### Operation Placement Strategy

#### Kiss Start Rules
1. **ADD_COMPONENT operations first** - Establish kissing state
2. **LOCK_MOUTH_ENGAGEMENT operations** - Prevent conflicting actions
3. **Other consequences** - Movement locks, notifications, etc.

#### Kiss End Rules  
1. **UNLOCK_MOUTH_ENGAGEMENT operations first** - Restore action availability
2. **REMOVE_COMPONENT operations** - Remove kissing state
3. **Other consequences** - Movement unlocks, notifications, etc.

### Error Recovery Considerations

#### Failed Lock Operations
- If mouth lock fails, kiss still proceeds
- Warning logged but not fatal error
- Positioning actions may remain available (degraded experience)

#### Failed Unlock Operations
- If unlock fails, mouth remains locked
- User may need to reload/restart to recover
- Critical for proper game state

### Parameter Validation

#### Template Variables
```json
{
  "actor_id": "{event.payload.actorId}"    // Must resolve to valid entity ID
}
```

#### Event Payload Requirements
- `actorId` must be string entity identifier
- `targetId` must be string entity identifier  
- Both entities must exist when rule executes

## Acceptance Criteria

### Rule Modifications
- [ ] **Kiss Start Rules**: Lock operations added to lean_in_for_deep_kiss
- [ ] **Kiss End Rules**: Unlock operations added to all 3 end kiss rules
- [ ] **Operation Order**: Unlock before remove in end rules
- [ ] **Parameter Binding**: Correct event payload references
- [ ] **JSON Valid**: All modified rules parse correctly

### Behavioral Integration  
- [ ] **Mouth Locks**: Kisses lock both participants' mouths
- [ ] **Mouth Unlocks**: Kiss endings unlock both participants' mouths
- [ ] **Action Prevention**: Positioning actions unavailable during kisses
- [ ] **Action Restoration**: Positioning actions available after kisses
- [ ] **Error Recovery**: Failed operations don't break kiss mechanics

## Testing Strategy

### Unit Tests

File: `tests/unit/mods/intimacy/mouthEngagementRules.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Intimacy Rules - Mouth Engagement Integration', () => {
  let testBed;
  let ruleEngine;
  let entityManager;
  let operationInterpreter;

  beforeEach(() => {
    testBed = createTestBed();
    ruleEngine = testBed.ruleEngine;
    entityManager = testBed.entityManager;
    operationInterpreter = testBed.operationInterpreter;
  });

  describe('Kiss Start Rules', () => {
    it('should lock mouths when starting deep kiss', async () => {
      const actor1 = await createTestActor(entityManager, { hasMouth: true });
      const actor2 = await createTestActor(entityManager, { hasMouth: true });

      // Execute lean_in_for_deep_kiss rule
      await ruleEngine.processEvent({
        type: 'intimacy:lean_in_for_deep_kiss',
        payload: {
          actorId: actor1.id,
          targetId: actor2.id
        }
      });

      // Verify both mouths locked
      expect(isMouthLocked(entityManager, actor1.id)).toBe(true);
      expect(isMouthLocked(entityManager, actor2.id)).toBe(true);

      // Verify kissing components added
      const kissing1 = entityManager.getComponentData(actor1.id, 'intimacy:kissing');
      const kissing2 = entityManager.getComponentData(actor2.id, 'intimacy:kissing');
      expect(kissing1.partner).toBe(actor2.id);
      expect(kissing2.partner).toBe(actor1.id);
    });
  });

  describe('Kiss End Rules', () => {
    it('should unlock mouths when breaking kiss gently', async () => {
      const actor1 = await createTestActor(entityManager, { 
        hasMouth: true,
        mouthLocked: true 
      });
      const actor2 = await createTestActor(entityManager, { 
        hasMouth: true,
        mouthLocked: true 
      });

      // Add kissing components
      await entityManager.addComponent(actor1.id, 'intimacy:kissing', {
        partner: actor2.id
      });
      await entityManager.addComponent(actor2.id, 'intimacy:kissing', {
        partner: actor1.id  
      });

      // Execute break_kiss_gently rule
      await ruleEngine.processEvent({
        type: 'intimacy:break_kiss_gently',
        payload: {
          actorId: actor1.id,
          targetId: actor2.id
        }
      });

      // Verify both mouths unlocked
      expect(isMouthLocked(entityManager, actor1.id)).toBe(false);
      expect(isMouthLocked(entityManager, actor2.id)).toBe(false);

      // Verify kissing components removed
      expect(entityManager.getComponentData(actor1.id, 'intimacy:kissing')).toBeNull();
      expect(entityManager.getComponentData(actor2.id, 'intimacy:kissing')).toBeNull();
    });

    it('should unlock mouths for all kiss ending variations', async () => {
      const endKissRules = [
        'intimacy:break_kiss_gently',
        'intimacy:pull_back_breathlessly',
        'intimacy:pull_back_in_revulsion'
      ];

      for (const ruleType of endKissRules) {
        const actor1 = await createTestActor(entityManager, { 
          hasMouth: true,
          mouthLocked: true 
        });
        const actor2 = await createTestActor(entityManager, { 
          hasMouth: true,
          mouthLocked: true 
        });

        await ruleEngine.processEvent({
          type: ruleType,
          payload: {
            actorId: actor1.id,
            targetId: actor2.id
          }
        });

        expect(isMouthLocked(entityManager, actor1.id)).toBe(false);
        expect(isMouthLocked(entityManager, actor2.id)).toBe(false);
      }
    });
  });
});
```

### Integration Tests

File: `tests/integration/mods/intimacy/kissingMouthEngagement.test.js`

```javascript
describe('Kissing - Mouth Engagement Integration', () => {
  let gameEngine;
  let actionSystem;
  let entityManager;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
    actionSystem = gameEngine.actionSystem;  
    entityManager = gameEngine.entityManager;
  });

  it('should complete full kiss workflow with mouth engagement', async () => {
    const actor1 = await createTestActor(entityManager, { hasMouth: true });
    const actor2 = await createTestActor(entityManager, { hasMouth: true });

    // 1. Initially both can perform positioning actions
    let canKneel1 = await actionSystem.canPerformAction(
      actor1.id,
      'positioning:kneel_before',
      { target_id: actor2.id }
    );
    let canKneel2 = await actionSystem.canPerformAction(
      actor2.id,
      'positioning:kneel_before',
      { target_id: actor1.id }
    );
    
    expect(canKneel1.allowed).toBe(true);
    expect(canKneel2.allowed).toBe(true);

    // 2. Start kissing
    await actionSystem.performAction(
      actor1.id,
      'intimacy:lean_in_for_deep_kiss',
      { target_id: actor2.id }
    );

    // 3. Both should have mouths locked and positioning unavailable
    expect(isMouthLocked(entityManager, actor1.id)).toBe(true);
    expect(isMouthLocked(entityManager, actor2.id)).toBe(true);

    canKneel1 = await actionSystem.canPerformAction(
      actor1.id,
      'positioning:kneel_before',
      { target_id: actor2.id }
    );
    canKneel2 = await actionSystem.canPerformAction(
      actor2.id,
      'positioning:kneel_before', 
      { target_id: actor1.id }
    );
    
    expect(canKneel1.allowed).toBe(false);
    expect(canKneel2.allowed).toBe(false);

    // 4. End kissing
    await actionSystem.performAction(
      actor1.id,
      'intimacy:break_kiss_gently',
      { target_id: actor2.id }
    );

    // 5. Both should have mouths unlocked and positioning available
    expect(isMouthLocked(entityManager, actor1.id)).toBe(false);
    expect(isMouthLocked(entityManager, actor2.id)).toBe(false);

    canKneel1 = await actionSystem.canPerformAction(
      actor1.id,
      'positioning:kneel_before',
      { target_id: actor2.id }
    );
    canKneel2 = await actionSystem.canPerformAction(
      actor2.id,
      'positioning:kneel_before',
      { target_id: actor1.id }
    );
    
    expect(canKneel1.allowed).toBe(true);
    expect(canKneel2.allowed).toBe(true);
  });

  it('should handle failed mouth operations gracefully', async () => {
    // Mock operation failure
    const mockOperationInterpreter = {
      execute: jest.fn().mockRejectedValue(new Error('Operation failed'))
    };
    
    // Kiss should still work even if mouth operations fail
    // (This tests graceful degradation)
  });
});
```

## Performance Considerations

### Rule Execution Impact
- **Additional Operations**: 2 extra operations per kiss start/end
- **Async Operations**: All operations async but execute sequentially
- **Error Handling**: Failed operations logged but don't block rule
- **Memory**: Minimal additional memory usage

### Operation Batching
- Consider batching lock operations for multi-participant scenarios
- Current implementation sufficient for pair interactions

## Error Handling Strategy

### Operation Failures
```javascript
// In rule consequences, operations are independent
// Failed LOCK_MOUTH_ENGAGEMENT doesn't prevent ADD_COMPONENT
// Failed UNLOCK_MOUTH_ENGAGEMENT doesn't prevent REMOVE_COMPONENT
```

### Recovery Mechanisms
- Failed locks: Manual reload recovers
- Failed unlocks: May require admin intervention
- Rule engine continues processing regardless

## Definition of Done

- [ ] All 4 intimacy rules updated with mouth operations
- [ ] Lock operations added to kiss start rule  
- [ ] Unlock operations added to all kiss end rules
- [ ] Operations placed in correct sequence
- [ ] JSON syntax valid for all files
- [ ] Parameter templates resolve correctly
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Full kiss workflow works with mouth engagement
- [ ] Positioning actions properly blocked during kisses