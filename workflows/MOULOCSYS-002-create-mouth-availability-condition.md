# MOULOCSYS-002: Create Mouth Availability Condition

**Phase**: Core Infrastructure  
**Priority**: Critical  
**Complexity**: Low  
**Dependencies**: MOULOCSYS-001 (mouth engagement component)  
**Estimated Time**: 2-3 hours

## Summary

Implement the `core:actor-mouth-available` condition that checks if an actor has a mouth that is not currently engaged/locked. This condition will be used by positioning actions and other systems to prevent conflicting mouth-based actions during activities like kissing, eating, or drinking.

## Technical Requirements

### File to Create

`data/mods/core/conditions/actor-mouth-available.condition.json`

### Condition Architecture

#### Condition Structure
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "core:actor-mouth-available",
  "description": "Checks if the actor has a mouth that is not currently engaged/locked. Returns true if the actor has a mouth part with core:mouth_engagement component where locked is false, or if the component doesn't exist on the mouth part.",
  "logic": {
    "or": [
      {
        "comment": "Check if actor has mouth part with unlocked engagement",
        "hasPartWithComponentValue": ["actor", "core:mouth_engagement", "locked", false]
      },
      {
        "comment": "Check if actor has mouth part without engagement component (implicitly available)",
        "and": [
          {
            "hasPartOfSubType": ["actor", "mouth"]
          },
          {
            "not": {
              "hasPartWithComponent": ["actor", "core:mouth_engagement"]
            }
          }
        ]
      }
    ]
  }
}
```

### Condition Logic Design

#### Logic Flow
1. **Primary Check**: Look for mouth parts with `core:mouth_engagement` where `locked: false`
2. **Fallback Check**: If no engagement component exists on mouth, consider it available
3. **Return**: True if mouth is available, false if locked or no mouth exists

#### JSON Logic Operations Used

##### `hasPartWithComponentValue`
- **Purpose**: Check if actor has a body part with specific component value
- **Parameters**: 
  - Entity scope ("actor")
  - Component ID ("core:mouth_engagement")
  - Property path ("locked")
  - Expected value (false)
- **Returns**: True if matching part found

##### `hasPartOfSubType`
- **Purpose**: Check if actor has a body part of specific subtype
- **Parameters**:
  - Entity scope ("actor")
  - Part subtype ("mouth")
- **Returns**: True if mouth part exists

##### `hasPartWithComponent`
- **Purpose**: Check if actor has a body part with specific component
- **Parameters**:
  - Entity scope ("actor")
  - Component ID ("core:mouth_engagement")
- **Returns**: True if any part has the component

### Alternative Implementations Considered

#### Simple Implementation (Rejected)
```json
{
  "logic": {
    "hasPartWithComponentValue": ["actor", "core:mouth_engagement", "locked", false]
  }
}
```
**Issue**: Fails for entities with mouth but no engagement component yet

#### Complex Implementation (Rejected)
```json
{
  "logic": {
    "and": [
      { "hasPartOfSubType": ["actor", "mouth"] },
      { "or": [
        { "hasPartWithComponentValue": ["actor", "core:mouth_engagement", "locked", false] },
        { "hasPartWithComponentValue": ["actor", "core:mouth_engagement", "forcedOverride", true] }
      ]}
    ]
  }
}
```
**Issue**: Over-complex, forcedOverride logic should be in handlers

## Implementation Details

### Condition Evaluation Context

#### Entity Resolution
- **"actor"**: Resolves to the entity performing the action
- **"target"**: Would resolve to action target (not used here)
- **Body Parts**: Accessed through anatomy system integration

#### Component Access Pattern
```javascript
// Pseudo-code for how the engine evaluates this condition
function evaluateActorMouthAvailable(actor) {
  // Get all body parts of the actor
  const bodyParts = getBodyParts(actor);
  
  // Find mouth parts
  const mouthParts = bodyParts.filter(part => part.subType === 'mouth');
  
  if (mouthParts.length === 0) {
    return false; // No mouth, not available
  }
  
  // Check each mouth part
  for (const mouth of mouthParts) {
    const engagement = getComponent(mouth, 'core:mouth_engagement');
    
    // If no engagement component or unlocked, mouth is available
    if (!engagement || engagement.locked === false) {
      return true;
    }
  }
  
  return false; // All mouths are locked
}
```

### Integration with Logic Engine

#### Custom Logic Functions
The condition uses these custom logic functions from the engine:
- `hasPartWithComponentValue`: Defined in `src/logic/customLogicFunctions.js`
- `hasPartOfSubType`: Defined in `src/logic/customLogicFunctions.js`
- `hasPartWithComponent`: Defined in `src/logic/customLogicFunctions.js`

#### Condition Registration
Condition is automatically loaded by:
1. Mod loader reads condition file
2. Registers with condition registry
3. Available for use in action prerequisites

## Acceptance Criteria

### Core Functionality
- [ ] **Unlocked Detection**: Returns true when mouth has `locked: false`
- [ ] **No Component Handling**: Returns true when mouth has no engagement component
- [ ] **Locked Detection**: Returns false when mouth has `locked: true`
- [ ] **No Mouth Handling**: Returns false when entity has no mouth part

### Edge Cases
- [ ] **Multiple Mouths**: Handles entities with multiple mouth parts correctly
- [ ] **Partial Locking**: Returns true if any mouth is available
- [ ] **Missing Anatomy**: Handles entities without anatomy:body gracefully
- [ ] **Component Migration**: Works during transition period when some mouths lack component

### Integration Requirements
- [ ] **Schema Valid**: Validates against condition.schema.json
- [ ] **Logic Valid**: JSON Logic expression is syntactically correct
- [ ] **ID Format**: Follows `core:actor-mouth-available` naming convention
- [ ] **Description Clear**: Explains what condition checks and when it returns true

## Testing Strategy

### Unit Test Structure

File: `tests/unit/mods/core/conditions/actorMouthAvailable.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('actor-mouth-available Condition', () => {
  let testBed;
  let conditionEvaluator;
  let entityManager;

  beforeEach(() => {
    testBed = createTestBed();
    conditionEvaluator = testBed.conditionEvaluator;
    entityManager = testBed.entityManager;
  });

  describe('Mouth Available Cases', () => {
    it('should return true when mouth is explicitly unlocked', async () => {
      // Setup: Actor with mouth part and unlocked engagement
      const actor = await createActorWithMouth(entityManager, {
        mouthEngagement: { locked: false, forcedOverride: false }
      });

      // Test condition
      const result = await conditionEvaluator.evaluate(
        'core:actor-mouth-available',
        { actor }
      );

      expect(result).toBe(true);
    });

    it('should return true when mouth has no engagement component', async () => {
      // Setup: Actor with mouth but no engagement component
      const actor = await createActorWithMouth(entityManager, {
        mouthEngagement: null // No component
      });

      const result = await conditionEvaluator.evaluate(
        'core:actor-mouth-available',
        { actor }
      );

      expect(result).toBe(true);
    });

    it('should return true when forcedOverride is true (even if locked)', async () => {
      // Setup: Actor with locked mouth but forcedOverride
      const actor = await createActorWithMouth(entityManager, {
        mouthEngagement: { locked: true, forcedOverride: true }
      });

      // Note: This might be handled by the handler, not the condition
      // Adjust test based on final implementation decision
    });
  });

  describe('Mouth Unavailable Cases', () => {
    it('should return false when mouth is locked', async () => {
      // Setup: Actor with locked mouth
      const actor = await createActorWithMouth(entityManager, {
        mouthEngagement: { locked: true, forcedOverride: false }
      });

      const result = await conditionEvaluator.evaluate(
        'core:actor-mouth-available',
        { actor }
      );

      expect(result).toBe(false);
    });

    it('should return false when entity has no mouth part', async () => {
      // Setup: Actor without mouth (e.g., creature without mouth)
      const actor = await createActorWithoutMouth(entityManager);

      const result = await conditionEvaluator.evaluate(
        'core:actor-mouth-available',
        { actor }
      );

      expect(result).toBe(false);
    });

    it('should return false when entity has no anatomy', async () => {
      // Setup: Basic entity without anatomy system
      const actor = await createBasicEntity(entityManager);

      const result = await conditionEvaluator.evaluate(
        'core:actor-mouth-available',
        { actor }
      );

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple mouth parts correctly', async () => {
      // Setup: Creature with multiple mouths, one locked
      const actor = await createMultiMouthCreature(entityManager, {
        mouth1: { locked: true },
        mouth2: { locked: false }
      });

      const result = await conditionEvaluator.evaluate(
        'core:actor-mouth-available',
        { actor }
      );

      expect(result).toBe(true); // At least one mouth available
    });

    it('should handle malformed engagement component gracefully', async () => {
      // Setup: Mouth with invalid engagement data
      const actor = await createActorWithMouth(entityManager, {
        mouthEngagement: { locked: "yes" } // Invalid type
      });

      // Should handle gracefully, likely treating as unavailable
      const result = await conditionEvaluator.evaluate(
        'core:actor-mouth-available',
        { actor }
      );

      expect(result).toBe(false);
    });
  });
});
```

### Integration Test Scenarios

File: `tests/integration/mods/core/mouthAvailabilityCondition.test.js`

```javascript
describe('Mouth Availability Condition - Integration', () => {
  it('should integrate with action prerequisites', async () => {
    // Setup positioning action with mouth availability prerequisite
    const action = {
      prerequisites: [{
        condition: { logic: { condition_ref: "core:actor-mouth-available" } },
        failureMessage: "Cannot do that while mouth is engaged."
      }]
    };

    // Test with available mouth
    const availableActor = await createActorWithAvailableMouth();
    expect(await canPerformAction(availableActor, action)).toBe(true);

    // Test with locked mouth
    const lockedActor = await createActorWithLockedMouth();
    expect(await canPerformAction(lockedActor, action)).toBe(false);
  });

  it('should work with intimacy mod kissing workflow', async () => {
    // Start kiss → mouth locked → condition returns false
    // End kiss → mouth unlocked → condition returns true
  });
});
```

## Performance Considerations

### Evaluation Performance
- **O(n) Complexity**: Where n = number of body parts
- **Early Exit**: Returns true on first available mouth
- **Minimal Queries**: Single pass through body parts
- **Cache Friendly**: Component data likely in cache

### Optimization Opportunities
- Cache mouth part references in anatomy system
- Pre-compute mouth availability during component updates
- Use bitwise flags for ultra-fast checks (future enhancement)

## Error Handling

### Condition Evaluation Errors
- **Missing Entity**: Returns false if actor is null/undefined
- **Invalid Logic**: Caught during condition registration
- **Component Errors**: Handled gracefully, treated as unavailable
- **Circular References**: Prevented by logic engine

### Debug Support
- Condition evaluation can be traced with debug logging
- Clear failure messages in prerequisites
- Component state visible in entity inspector

## Dependencies and Integration

### Required Systems
- **Anatomy System**: For body part access
- **Component System**: For mouth_engagement component
- **Logic Engine**: For condition evaluation
- **Entity Manager**: For component queries

### Used By
- **Positioning Actions**: kneel_before, turn_your_back, etc.
- **Eating System**: Future food consumption actions
- **Speech System**: Future dialogue actions
- **Intimacy System**: Kissing and related actions

## Future Enhancements

### Potential Improvements
1. **Partial Availability**: Support degrees of mouth engagement
2. **Reason Tracking**: Include why mouth is unavailable in result
3. **Priority System**: Some actions could override low-priority locks
4. **Timeout Support**: Auto-unlock after time period

### Backward Compatibility
- Condition ID must remain stable
- Logic structure can be enhanced but not breaking
- New fields in mouth_engagement won't affect this condition

## Definition of Done

- [ ] Condition file created with valid JSON
- [ ] Validates against condition.schema.json
- [ ] Logic expression syntactically correct
- [ ] Description clearly explains behavior
- [ ] Unit tests written and passing
- [ ] Integration tests planned
- [ ] Performance impact assessed
- [ ] Documentation complete
- [ ] Ready for use in action prerequisites