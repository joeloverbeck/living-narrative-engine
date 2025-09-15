# MOVMODMIG-008: Implement Comprehensive Testing

## Overview
Create and execute comprehensive test suites for all migrated movement components, including unit tests, integration tests, and visual validation.

## Current State
- **Movement Components**: Migrated but not fully tested
- **Test Coverage**: No dedicated tests for movement mod
- **Visual Testing**: Explorer Cyan theme not validated

## Objectives
1. Create unit tests for all movement components
2. Implement integration tests for cross-mod communication
3. Validate visual theme compliance (WCAG)
4. Test error scenarios and edge cases
5. Ensure 80%+ test coverage

## Technical Requirements

### Test Structure
```
tests/
├── unit/mods/movement/
│   ├── actions/
│   │   └── go.test.js
│   ├── rules/
│   │   └── go.rule.test.js
│   ├── conditions/
│   │   ├── event-is-action-go.test.js
│   │   ├── actor-can-move.test.js
│   │   └── exit-is-unblocked.test.js
│   └── scopes/
│       └── clear_directions.test.js
├── integration/mods/movement/
│   ├── modLoading.test.js
│   ├── crossModReferences.test.js
│   └── movementFlow.test.js
└── visual/
    └── explorerCyan.test.js
```

## Implementation Steps

### Step 1: Unit Tests for Actions
```javascript
// tests/unit/mods/movement/actions/go.test.js
describe('Movement Go Action', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should have movement namespace', () => {
    const action = testBed.loadAction('movement:go');
    expect(action.id).toBe('movement:go');
  });

  it('should have Explorer Cyan colors', () => {
    const action = testBed.loadAction('movement:go');
    expect(action.visual.backgroundColor).toBe('#006064');
    expect(action.visual.textColor).toBe('#e0f7fa');
  });

  it('should reference movement scope', () => {
    const action = testBed.loadAction('movement:go');
    expect(action.scope).toBe('movement:clear_directions');
  });

  it('should have prerequisite condition', () => {
    const action = testBed.loadAction('movement:go');
    expect(action.prerequisite.condition).toBe('movement:actor-can-move');
  });
});
```

### Step 2: Unit Tests for Conditions
```javascript
// tests/unit/mods/movement/conditions/actor-can-move.test.js
describe('Actor Can Move Condition', () => {
  it('should evaluate true when actor has legs and not paralyzed', () => {
    const context = {
      actor: {
        anatomy: { legs: true },
        status: { paralyzed: false }
      }
    };
    const condition = loadCondition('movement:actor-can-move');
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('should evaluate false when actor is paralyzed', () => {
    const context = {
      actor: {
        anatomy: { legs: true },
        status: { paralyzed: true }
      }
    };
    const condition = loadCondition('movement:actor-can-move');
    expect(evaluateCondition(condition, context)).toBe(false);
  });
});
```

### Step 3: Integration Tests
```javascript
// tests/integration/mods/movement/movementFlow.test.js
describe('Movement Flow Integration', () => {
  it('should complete full movement flow', async () => {
    // Setup
    const game = await setupGame(['core', 'movement']);
    const player = game.getEntity('player');
    const initialLocation = player.location;

    // Action
    const goAction = game.getAction('movement:go');
    const directions = game.resolveScope(goAction.scope, { actor: player });
    const targetDirection = directions[0];

    // Execute
    await game.executeAction('movement:go', {
      actor: player,
      target: targetDirection
    });

    // Assert
    expect(player.location).not.toBe(initialLocation);
    expect(game.getEvents()).toContainEvent('entity_moved');
  });
});
```

### Step 4: Visual/WCAG Tests
```javascript
// tests/visual/explorerCyan.test.js
describe('Explorer Cyan Theme Compliance', () => {
  it('should meet WCAG AAA for normal state', () => {
    const bg = '#006064';
    const text = '#e0f7fa';
    const contrast = calculateContrastRatio(bg, text);
    expect(contrast).toBeGreaterThanOrEqual(7); // AAA requires 7:1
    expect(contrast).toBeCloseTo(12.3, 1);
  });

  it('should meet WCAG AA for hover state', () => {
    const bg = '#00838f';
    const text = '#ffffff';
    const contrast = calculateContrastRatio(bg, text);
    expect(contrast).toBeGreaterThanOrEqual(4.5); // AA requires 4.5:1
    expect(contrast).toBeCloseTo(5.8, 1);
  });
});
```

### Step 5: Cross-Mod Reference Tests
```javascript
// tests/integration/mods/movement/crossModReferences.test.js
describe('Cross-Mod References', () => {
  it('should resolve movement conditions from positioning mod', () => {
    const turnAroundAction = loadAction('positioning:turn_around');
    const condition = loadCondition(turnAroundAction.prerequisite.condition);
    expect(condition).toBeDefined();
    expect(condition.id).toBe('movement:actor-can-move');
  });

  it('should handle compatibility aliases', () => {
    const oldReference = 'core:actor-can-move';
    const resolved = resolveReference(oldReference);
    expect(resolved).toBe('movement:actor-can-move');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('deprecated')
    );
  });
});
```

### Step 6: Edge Cases and Error Scenarios
```javascript
describe('Movement Error Handling', () => {
  it('should handle missing exits gracefully', () => {
    const context = { actor: { location: { exits: [] } } };
    const scope = loadScope('movement:clear_directions');
    const result = resolveScope(scope, context);
    expect(result).toEqual([]);
  });

  it('should handle invalid action targets', () => {
    expect(() => {
      executeAction('movement:go', {
        actor: 'player',
        target: 'invalid-direction'
      });
    }).toThrow('Invalid movement target');
  });
});
```

## Test Coverage Requirements
- **Unit Tests**: 90% coverage for individual components
- **Integration Tests**: 80% coverage for workflows
- **Visual Tests**: 100% coverage for WCAG compliance
- **Error Scenarios**: All edge cases covered

## Validation Criteria
- [ ] All unit tests created and passing
- [ ] Integration tests validate workflows
- [ ] Visual tests confirm WCAG compliance
- [ ] Cross-mod tests pass
- [ ] Edge cases handled
- [ ] Coverage targets met

## Dependencies
- **Requires**: MOVMODMIG-004, MOVMODMIG-005, MOVMODMIG-006
- **Blocks**: MOVMODMIG-009

## Estimated Effort
**Story Points**: 5
**Time Estimate**: 4-5 hours

## Acceptance Criteria
- [ ] Test coverage > 80%
- [ ] All tests passing
- [ ] WCAG compliance verified
- [ ] Cross-mod communication tested
- [ ] Error handling validated
- [ ] Test documentation complete