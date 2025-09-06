# MOULOCSYS-010: Fix Turn Around Architectural Violation

**Phase**: Action Updates  
**Priority**: High  
**Complexity**: Low  
**Dependencies**: MOULOCSYS-002 (condition), MOULOCSYS-009 (positioning updates)  
**Estimated Time**: 2-3 hours

## Summary

Fix the architectural violation in `turn_around.action.json` where it incorrectly references `intimacy:kissing` in forbidden_components. The positioning mod cannot reference intimacy components due to dependency hierarchy. Replace this with the proper mouth availability prerequisite.

## Technical Requirements

### File to Modify

`data/mods/positioning/actions/turn_around.action.json`

### Current Violation

#### Existing (Incorrect) Code
```json
{
  "forbidden_components": {
    "actor": ["intimacy:kissing"]  // VIOLATION: positioning cannot reference intimacy
  }
}
```

### Correct Implementation

#### Updated turn_around.action.json
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:turn_around",
  "name": "Turn around",
  "description": "Turn around to face the opposite direction",
  "prerequisites": [
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-can-move"
        }
      },
      "failureMessage": "You cannot move right now."
    },
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-mouth-available"
        }
      },
      "failureMessage": "You cannot do that while your mouth is engaged."
    }
    // ... other existing prerequisites ...
  ],
  // Remove forbidden_components section entirely
  "parameters": [
    // ... existing parameters unchanged ...
  ],
  "consequences": [
    // ... existing consequences unchanged ...
  ]
}
```

## Problem Analysis

### Dependency Hierarchy Issue
```
core (base module)
  ↑
positioning (depends on core)
  ↑  
intimacy (depends on positioning + anatomy)
```

- ✅ `intimacy` can reference `positioning` components
- ❌ `positioning` cannot reference `intimacy` components
- ✅ `positioning` can reference `core` components

### Why This Violation Exists
1. **Historical**: Added before mouth engagement system
2. **Workaround**: Attempted to prevent turning during kissing
3. **Invalid**: Violates clean dependency architecture
4. **Temporary**: Never intended as permanent solution

## Acceptance Criteria

### Violation Removal
- [ ] **Forbidden Components Removed**: No intimacy:kissing reference
- [ ] **Prerequisites Added**: Mouth availability prerequisite added
- [ ] **Functionality Preserved**: Still prevents turning during kissing
- [ ] **Architecture Clean**: No cross-dependency violations

### Behavioral Requirements
- [ ] **Same Behavior**: Action unavailable during kissing (via mouth lock)
- [ ] **Better Architecture**: Uses proper dependency chain
- [ ] **Future Proof**: Works with any mouth-engaging activity
- [ ] **Clear Failure**: Appropriate error message shown

## Implementation Details

### Before/After Comparison

#### Before (Architectural Violation)
```json
{
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  }
}
```
- **Problem**: Positioning mod references intimacy mod
- **Limitation**: Only prevents kissing, not other mouth activities
- **Architecture**: Violates dependency hierarchy

#### After (Clean Architecture)  
```json
{
  "prerequisites": [
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-mouth-available"
        }
      },
      "failureMessage": "You cannot do that while your mouth is engaged."
    }
  ]
}
```
- **Solution**: Uses core component that positioning can reference
- **Extensible**: Prevents turning during any mouth activity
- **Architecture**: Respects dependency hierarchy

### Functional Equivalence

Both approaches prevent turning during kissing:

#### Old Way (Violation)
1. Kissing adds `intimacy:kissing` component
2. Action checks forbidden_components
3. Finds `intimacy:kissing` → action unavailable

#### New Way (Clean)
1. Kissing locks mouth via `LOCK_MOUTH_ENGAGEMENT`
2. Action checks `core:actor-mouth-available` prerequisite
3. Finds mouth locked → action unavailable

## Testing Strategy

### Regression Tests

File: `tests/unit/mods/positioning/turnAroundFix.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Turn Around Action - Architectural Fix', () => {
  let testBed;
  let actionSystem;
  let entityManager;

  beforeEach(() => {
    testBed = createTestBed();
    actionSystem = testBed.actionSystem;
    entityManager = testBed.entityManager;
  });

  describe('Architecture Compliance', () => {
    it('should not reference intimacy components', async () => {
      const actionDef = await actionSystem.getActionDefinition(
        'positioning:turn_around'
      );

      // Should not have forbidden_components
      expect(actionDef.forbidden_components).toBeUndefined();

      // Should not reference intimacy:kissing anywhere
      const actionJson = JSON.stringify(actionDef);
      expect(actionJson).not.toContain('intimacy:kissing');
    });

    it('should only reference core and positioning components', async () => {
      const actionDef = await actionSystem.getActionDefinition(
        'positioning:turn_around'
      );

      const actionJson = JSON.stringify(actionDef);
      
      // Can reference core components
      expect(actionJson).toContain('core:');
      
      // Can reference positioning components  
      expect(actionJson).toContain('positioning:');
      
      // Should not reference intimacy components
      expect(actionJson).not.toContain('intimacy:');
      
      // Should not reference anatomy components (wrong dependency)
      expect(actionJson).not.toContain('anatomy:');
    });
  });

  describe('Functional Behavior', () => {
    it('should be available when mouth is free', async () => {
      const actor = await createTestActor(entityManager, {
        hasMouth: true,
        mouthLocked: false,
        canMove: true
      });

      const canPerform = await actionSystem.canPerformAction(
        actor.id,
        'positioning:turn_around'
      );

      expect(canPerform.allowed).toBe(true);
    });

    it('should be unavailable when mouth is engaged', async () => {
      const actor = await createTestActor(entityManager, {
        hasMouth: true,
        mouthLocked: true,
        canMove: true
      });

      const canPerform = await actionSystem.canPerformAction(
        actor.id,
        'positioning:turn_around'
      );

      expect(canPerform.allowed).toBe(false);
      expect(canPerform.reason).toContain('mouth is engaged');
    });

    it('should work for entities without mouths', async () => {
      const actor = await createTestActor(entityManager, {
        hasMouth: false,
        canMove: true
      });

      const canPerform = await actionSystem.canPerformAction(
        actor.id,
        'positioning:turn_around'
      );

      expect(canPerform.allowed).toBe(true);
    });
  });
});
```

### Integration Tests

File: `tests/integration/mods/positioning/turnAroundKissingIntegration.test.js`

```javascript
describe('Turn Around - Kissing Integration', () => {
  let gameEngine;
  let actionSystem;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
    actionSystem = gameEngine.actionSystem;
  });

  it('should prevent turning during kissing (via mouth lock)', async () => {
    const actor1 = await createTestActor(gameEngine.entityManager, { hasMouth: true });
    const actor2 = await createTestActor(gameEngine.entityManager, { hasMouth: true });

    // Verify can turn initially
    let canTurn = await actionSystem.canPerformAction(
      actor1.id,
      'positioning:turn_around'
    );
    expect(canTurn.allowed).toBe(true);

    // Start kissing
    await actionSystem.performAction(
      actor1.id,
      'intimacy:lean_in_for_deep_kiss',
      { target_id: actor2.id }
    );

    // Should not be able to turn while kissing
    canTurn = await actionSystem.canPerformAction(
      actor1.id,
      'positioning:turn_around'
    );
    expect(canTurn.allowed).toBe(false);
    expect(canTurn.reason).toContain('mouth is engaged');

    // End kissing
    await actionSystem.performAction(
      actor1.id,
      'intimacy:break_kiss_gently',
      { target_id: actor2.id }
    );

    // Should be able to turn again
    canTurn = await actionSystem.canPerformAction(
      actor1.id,
      'positioning:turn_around'
    );
    expect(canTurn.allowed).toBe(true);
  });
});
```

## Validation Steps

### Manual Validation

#### 1. Dependency Analysis
```bash
# Check for any intimacy references in positioning mod
grep -r "intimacy:" data/mods/positioning/
# Should return no results after fix
```

#### 2. Action Loading
```bash
# Start game and verify action loads without errors
npm run dev
# Look for "turn_around" in action registry
# No dependency resolution errors
```

#### 3. Behavioral Testing  
```bash
# In game:
# 1. Start kiss between characters
# 2. Try to turn around
# 3. Should see "mouth is engaged" message
# 4. End kiss
# 5. Turn around should work again
```

## Risk Analysis

### Low Risk Change
- **Simple Fix**: Remove forbidden_components, add prerequisite
- **Same Behavior**: Functionality preserved through different mechanism  
- **Well Tested**: Mouth engagement system already tested
- **Reversible**: Easy to rollback if issues found

### Potential Issues
- **Timing**: Ensure intimacy mod loads after this fix
- **Caching**: Clear any action definition caches
- **UI**: Update any hardcoded UI dependencies

## Definition of Done

- [ ] forbidden_components section removed
- [ ] Mouth availability prerequisite added  
- [ ] JSON syntax valid
- [ ] No intimacy component references
- [ ] Action still prevents turning during kissing
- [ ] Architecture violation eliminated
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual validation complete