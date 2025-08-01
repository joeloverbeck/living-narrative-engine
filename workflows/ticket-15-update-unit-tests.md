# Ticket 15: Update Unit Tests and Create Posturing Test Suite

## Overview
**Phase**: 4 - Test Migration  
**Priority**: High  
**Estimated Time**: 3-4 hours  
**Dependencies**: Ticket 14 (Integration Tests Update)  
**Implements**: Report section "Test Migration" - unit test updates and posturing test creation

## Objective
Update all unit tests related to positioning logic to use the new posturing namespace and create a comprehensive unit test suite for the posturing mod to ensure high-quality test coverage for the migrated positioning system.

## Background
**Test Files Requiring Updates** (from migration analysis):
- `/tests/unit/events/intimacyEventValidation.test.js`
- Unit tests for intimacy components referencing facing_away
- Unit tests for intimacy actions using positioning logic
- Unit tests for intimacy rules handling positioning events

**New Test Suite Required**:
- Unit tests for posturing components
- Unit tests for posturing events
- Unit tests for posturing actions
- Unit tests for posturing rules
- Unit tests for posturing conditions
- Unit tests for posturing scopes

**From Migration Analysis**:
- 34 total test files need updates
- Unit tests focus on individual component functionality
- New posturing tests ensure isolated functionality works correctly
- Critical for maintaining 80%+ code coverage

## Implementation Tasks

### Task 15.1: Update Existing Unit Tests for Namespace Changes
**Primary Unit Test Updates**:

#### intimacyEventValidation.test.js Updates
**File**: `tests/unit/events/intimacyEventValidation.test.js`

**Expected Current Structure**:
```javascript
describe('Intimacy Event Validation', () => {
  describe('actor_turned_around event', () => {
    it('should validate actor_turned_around event payload', () => {
      const event = {
        type: 'intimacy:actor_turned_around',  // ❌ UPDATE TO: posturing:actor_turned_around
        payload: {
          actor: 'actor1',
          turned_by: 'actor2'
        }
      };
      
      expect(validateEvent(event)).toBe(true);
    });
  });

  describe('actor_faced_everyone event', () => {
    it('should validate actor_faced_everyone event payload', () => {
      const event = {
        type: 'intimacy:actor_faced_everyone',  // ❌ UPDATE TO: posturing:actor_faced_everyone
        payload: {
          actor: 'actor1',
          faced: 'target1'
        }
      };
      
      expect(validateEvent(event)).toBe(true);
    });
  });
});
```

**Updated Structure**:
```javascript
describe('Intimacy Event Validation', () => {
  // Remove positioning event tests - they belong in posturing mod now
  
  describe('intimacy-specific events', () => {
    // Keep only intimacy-specific event tests
    // Remove actor_turned_around, actor_faced_everyone, actor_faced_forward tests
  });
});
```

#### Component Unit Tests Updates
**Search and Update**:
```javascript
// Find unit tests for facing_away component
// These should either be removed or updated to test posturing integration

// Current pattern:
describe('facing_away component', () => {
  it('should track actors facing away', () => {
    const component = createComponent('intimacy:facing_away', {
      facing_away_from: ['actor1']
    });
    // Test logic
  });
});

// Should be removed - component moved to posturing mod
```

### Task 15.2: Create Posturing Mod Unit Test Suite
**New Test Structure**:
```
tests/unit/posturing/
├── components/
│   └── facingAway.test.js
├── events/
│   ├── actorTurnedAround.test.js
│   ├── actorFacedEveryone.test.js
│   └── actorFacedForward.test.js
├── actions/
│   ├── turnAround.test.js
│   └── turnAroundToFace.test.js
├── rules/
│   ├── turnAround.test.js
│   └── turnAroundToFace.test.js
├── conditions/
│   ├── bothActorsFacingEachOther.test.js
│   ├── actorIsBehindEntity.test.js
│   ├── entityNotInFacingAway.test.js
│   ├── actorInEntityFacingAway.test.js
│   └── entityInFacingAway.test.js
└── scopes/
    ├── actorsImFacingAwayFrom.test.js
    └── closeActorsFacingAway.test.js (if migrated)
```

### Task 15.3: Create Posturing Component Unit Tests
**File**: `tests/unit/posturing/components/facingAway.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestBedClass } from '../../../common/testbed.js';

describe('posturing:facing_away Component', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  it('should create facing_away component with empty array', () => {
    const entity = testBed.createEntity();
    testBed.addComponent(entity, 'posturing:facing_away', {
      facing_away_from: []
    });

    const component = testBed.getComponent(entity, 'posturing:facing_away');
    expect(component.facing_away_from).toEqual([]);
  });

  it('should track multiple actors in facing_away list', () => {
    const entity = testBed.createEntity();
    const actor1 = testBed.createEntity();
    const actor2 = testBed.createEntity();

    testBed.addComponent(entity, 'posturing:facing_away', {
      facing_away_from: [actor1.id, actor2.id]
    });

    const component = testBed.getComponent(entity, 'posturing:facing_away');
    expect(component.facing_away_from).toContain(actor1.id);
    expect(component.facing_away_from).toContain(actor2.id);
  });

  it('should validate component schema', () => {
    const validData = { facing_away_from: ['actor1'] };
    const invalidData = { facing_away_from: 'not-an-array' };

    expect(testBed.validateComponentData('posturing:facing_away', validData)).toBe(true);
    expect(testBed.validateComponentData('posturing:facing_away', invalidData)).toBe(false);
  });
});
```

### Task 15.4: Create Posturing Event Unit Tests
**File**: `tests/unit/posturing/events/actorTurnedAround.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestBedClass } from '../../../common/testbed.js';

describe('posturing:actor_turned_around Event', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  it('should validate correct event payload', () => {
    const event = {
      type: 'posturing:actor_turned_around',
      payload: {
        actor: 'target-actor',
        turned_by: 'initiating-actor'
      }
    };

    expect(testBed.validateEvent(event)).toBe(true);
  });

  it('should reject invalid event payload', () => {
    const invalidEvent = {
      type: 'posturing:actor_turned_around',
      payload: {
        actor: 'target-actor'
        // Missing turned_by field
      }
    };

    expect(testBed.validateEvent(invalidEvent)).toBe(false);
  });

  it('should dispatch event correctly', () => {
    const event = {
      type: 'posturing:actor_turned_around',
      payload: {
        actor: 'target-actor',
        turned_by: 'initiating-actor'
      }
    };

    testBed.dispatchEvent(event);
    
    const dispatchedEvents = testBed.getDispatchedEvents();
    expect(dispatchedEvents).toContainEqual(
      expect.objectContaining({
        type: 'posturing:actor_turned_around',
        payload: expect.objectContaining({
          actor: 'target-actor',
          turned_by: 'initiating-actor'
        })
      })
    );
  });
});
```

### Task 15.5: Create Posturing Action Unit Tests
**File**: `tests/unit/posturing/actions/turnAround.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestBedClass } from '../../../common/testbed.js';

describe('posturing:turn_around Action', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  it('should register action correctly', () => {
    const action = testBed.getAction('posturing:turn_around');
    expect(action).toBeDefined();
    expect(action.id).toBe('posturing:turn_around');
    expect(action.name).toBe('Turn Around');
  });

  it('should have correct required components', () => {
    const action = testBed.getAction('posturing:turn_around');
    expect(action.required_components.actor).toContain('core:actor');
    expect(action.required_components.target).toContain('core:actor');
  });

  it('should add facing_away component to target', () => {
    const actor = testBed.createActor();
    const target = testBed.createActor();

    const actionData = {
      id: 'posturing:turn_around',
      actor: actor.id,
      target: target.id
    };

    testBed.executeAction(actionData);

    const targetEntity = testBed.getEntity(target.id);
    expect(targetEntity['posturing:facing_away']).toBeDefined();
    expect(targetEntity['posturing:facing_away'].facing_away_from).toContain(actor.id);
  });
});
```

### Task 15.6: Create Posturing Condition Unit Tests
**File**: `tests/unit/posturing/conditions/actorIsBehindEntity.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestBedClass } from '../../../common/testbed.js';

describe('posturing:actor-is-behind-entity Condition', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  it('should return true when actor is behind entity', () => {
    const actor = testBed.createActor();
    const target = testBed.createActor();

    // Set up target facing away from actor
    testBed.addComponent(target.id, 'posturing:facing_away', {
      facing_away_from: [actor.id]
    });

    const context = { actor: actor.id, target: target.id };
    const result = testBed.evaluateCondition('posturing:actor-is-behind-entity', context);

    expect(result).toBe(true);
  });

  it('should return false when actor is not behind entity', () => {
    const actor = testBed.createActor();
    const target = testBed.createActor();

    // Target not facing away from actor
    testBed.addComponent(target.id, 'posturing:facing_away', {
      facing_away_from: []
    });

    const context = { actor: actor.id, target: target.id };
    const result = testBed.evaluateCondition('posturing:actor-is-behind-entity', context);

    expect(result).toBe(false);
  });

  it('should handle missing facing_away component', () => {
    const actor = testBed.createActor();
    const target = testBed.createActor();

    const context = { actor: actor.id, target: target.id };
    const result = testBed.evaluateCondition('posturing:actor-is-behind-entity', context);

    expect(result).toBe(false);
  });
});
```

### Task 15.7: Search and Update Additional Unit Tests
**Comprehensive Unit Test Search**:
```bash
# Find all unit tests with positioning references
find tests/unit/ -name "*.js" -exec grep -l "intimacy:facing_away\|intimacy:actor_\|intimacy:turn_around\|intimacy:.*-facing\|intimacy:.*-behind" {} \;

# Update each found file:
# - Component references: intimacy:facing_away → posturing:facing_away
# - Event references: intimacy:actor_* → posturing:actor_*
# - Action references: intimacy:turn_around* → posturing:turn_around*
# - Condition references: intimacy:positioning-* → posturing:positioning-*
```

## Implementation Steps

### Step 1: Analyze Existing Unit Tests
```bash
# Navigate to unit tests
cd tests/unit/

# Create backup
cp -r . ../unit-backup/

# Find all unit tests with positioning references
echo "=== Unit Tests with Positioning References ==="
find . -name "*.js" -exec grep -l "intimacy:facing_away\|intimacy:actor_\|intimacy:turn_around\|intimacy:.*-facing\|intimacy:.*-behind" {} \;

# Analyze each file
for file in $(find . -name "*.js" -exec grep -l "intimacy:facing_away\|intimacy:actor_\|intimacy:turn_around" {} \;); do
  echo "=== $file ==="
  grep -n "intimacy:" "$file" | head -10
  echo ""
done
```

### Step 2: Update Existing Unit Tests
```bash
# Update component references
find . -name "*.js" -exec sed -i "s/'intimacy:facing_away'/'posturing:facing_away'/g" {} \;
find . -name "*.js" -exec sed -i 's/"intimacy:facing_away"/"posturing:facing_away"/g' {} \;

# Update event references
find . -name "*.js" -exec sed -i "s/'intimacy:actor_turned_around'/'posturing:actor_turned_around'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:actor_faced_everyone'/'posturing:actor_faced_everyone'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:actor_faced_forward'/'posturing:actor_faced_forward'/g" {} \;

# Update action references
find . -name "*.js" -exec sed -i "s/'intimacy:turn_around'/'posturing:turn_around'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:turn_around_to_face'/'posturing:turn_around_to_face'/g" {} \;

# Update condition references
find . -name "*.js" -exec sed -i "s/'intimacy:both-actors-facing-each-other'/'posturing:both-actors-facing-each-other'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:actor-is-behind-entity'/'posturing:actor-is-behind-entity'/g" {} \;
# ... (continue for all positioning conditions)
```

### Step 3: Create Posturing Test Directory Structure
```bash
# Create posturing test directories
mkdir -p tests/unit/posturing/components
mkdir -p tests/unit/posturing/events
mkdir -p tests/unit/posturing/actions
mkdir -p tests/unit/posturing/rules
mkdir -p tests/unit/posturing/conditions
mkdir -p tests/unit/posturing/scopes
```

### Step 4: Create Posturing Component Tests
```bash
# Create facingAway.test.js with comprehensive component tests
# Test component creation, validation, data manipulation
```

### Step 5: Create Posturing Event Tests
```bash
# Create event tests for all 3 positioning events:
# - actorTurnedAround.test.js
# - actorFacedEveryone.test.js  
# - actorFacedForward.test.js

# Test event validation, dispatching, payload structure
```

### Step 6: Create Posturing Action and Rule Tests
```bash
# Create action tests:
# - turnAround.test.js
# - turnAroundToFace.test.js

# Create rule tests:
# - turnAround.test.js
# - turnAroundToFace.test.js

# Test action registration, execution, rule handling
```

### Step 7: Create Posturing Condition Tests
```bash
# Create condition tests for all 5 positioning conditions:
# - bothActorsFacingEachOther.test.js
# - actorIsBehindEntity.test.js
# - entityNotInFacingAway.test.js
# - actorInEntityFacingAway.test.js
# - entityInFacingAway.test.js

# Test condition evaluation logic, edge cases
```

### Step 8: Create Posturing Scope Tests
```bash
# Create scope tests based on ticket 09 results:
# - actorsImFacingAwayFrom.test.js (if migrated)
# - closeActorsFacingAway.test.js (if migrated)

# Test scope DSL evaluation, entity filtering
```

### Step 9: Run Unit Tests and Validate Coverage
```bash
# Run all unit tests
npm run test:unit

# Check coverage
npm run test:unit -- --coverage

# Ensure coverage targets met:
# - Overall coverage: 80%+
# - Posturing mod coverage: 90%+
# - No regressions in existing coverage
```

## Acceptance Criteria

### ✅ Existing Unit Test Updates
- [ ] All `intimacy:facing_away` references updated to `posturing:facing_away`
- [ ] All positioning event references updated to posturing namespace
- [ ] All positioning action references updated to posturing namespace
- [ ] All positioning condition references updated to posturing namespace
- [ ] Tests moved from intimacy to posturing where appropriate

### ✅ New Posturing Test Suite
- [ ] Component tests created for `posturing:facing_away`
- [ ] Event tests created for all 3 positioning events
- [ ] Action tests created for 2 positioning actions
- [ ] Rule tests created for 2 positioning rules
- [ ] Condition tests created for 5 positioning conditions
- [ ] Scope tests created for migrated scopes

### ✅ Test Coverage Requirements
- [ ] Overall test coverage maintained at 80%+
- [ ] Posturing mod coverage at 90%+
- [ ] All critical code paths covered
- [ ] Edge cases and error conditions tested

### ✅ Test Quality Standards
- [ ] Tests follow project testing conventions
- [ ] Test names are descriptive and clear
- [ ] Test bed utilities used correctly
- [ ] Mocking and setup appropriate
- [ ] Assertions are comprehensive and specific

### ✅ Functional Validation
- [ ] All unit tests pass successfully
- [ ] No test failures due to namespace changes
- [ ] Tests properly validate isolated functionality
- [ ] Test execution time within acceptable limits

## Risk Assessment

### 🚨 Potential Issues
1. **Test Coverage Gaps**: Missing tests for new posturing functionality
2. **Complex Logic Testing**: Positioning logic may be complex to test in isolation
3. **Mock Data Complexity**: Setting up test scenarios for positioning may be complex
4. **Performance Impact**: New test suite may slow down test execution
5. **Test Maintenance**: More tests require more maintenance effort

### 🛡️ Risk Mitigation
1. **Comprehensive Coverage**: Create tests for all code paths and edge cases
2. **Test Utilities**: Create helper functions for complex positioning scenarios
3. **Mock Strategies**: Develop reusable mock data patterns
4. **Parallel Execution**: Optimize test execution through parallelization
5. **Documentation**: Document test patterns for future maintenance

## Test Cases

### Test Case 1: Component Functionality
```bash
npm run test:unit -- --grep "posturing.*component"
# Expected: All component tests pass
# Expected: Component creation, validation, manipulation work correctly
```

### Test Case 2: Event System
```bash
npm run test:unit -- --grep "posturing.*event"
# Expected: All event tests pass
# Expected: Event validation, dispatching, handling work correctly
```

### Test Case 3: Action and Rule System
```bash
npm run test:unit -- --grep "posturing.*(action|rule)"
# Expected: All action and rule tests pass
# Expected: Action execution and rule handling work correctly
```

### Test Case 4: Condition System
```bash
npm run test:unit -- --grep "posturing.*condition"
# Expected: All condition tests pass
# Expected: Condition evaluation logic works correctly
```

### Test Case 5: Scope System
```bash
npm run test:unit -- --grep "posturing.*scope"
# Expected: All scope tests pass
# Expected: Scope DSL evaluation works correctly
```

### Test Case 6: Coverage Validation
```bash
npm run test:unit -- --coverage
# Expected: Coverage targets met
# Expected: No significant coverage regressions
```

## File Changes Summary

### New Test Files Created
- `tests/unit/posturing/components/facingAway.test.js`
- `tests/unit/posturing/events/actorTurnedAround.test.js`
- `tests/unit/posturing/events/actorFacedEveryone.test.js`
- `tests/unit/posturing/events/actorFacedForward.test.js`
- `tests/unit/posturing/actions/turnAround.test.js`
- `tests/unit/posturing/actions/turnAroundToFace.test.js`
- `tests/unit/posturing/rules/turnAround.test.js`
- `tests/unit/posturing/rules/turnAroundToFace.test.js`
- `tests/unit/posturing/conditions/bothActorsFacingEachOther.test.js`
- `tests/unit/posturing/conditions/actorIsBehindEntity.test.js`
- `tests/unit/posturing/conditions/entityNotInFacingAway.test.js`
- `tests/unit/posturing/conditions/actorInEntityFacingAway.test.js`
- `tests/unit/posturing/conditions/entityInFacingAway.test.js`
- `tests/unit/posturing/scopes/actorsImFacingAwayFrom.test.js` (conditional)
- `tests/unit/posturing/scopes/closeActorsFacingAway.test.js` (conditional)

### Existing Test Files Updated
- `tests/unit/events/intimacyEventValidation.test.js`
- Any unit tests referencing positioning components, events, actions, or conditions

### Test Coverage Areas
- **Posturing Components**: Schema validation, data manipulation
- **Posturing Events**: Payload validation, dispatching, handling
- **Posturing Actions**: Registration, execution, effects
- **Posturing Rules**: Condition matching, action handling, event dispatching
- **Posturing Conditions**: Logic evaluation, edge cases, error handling
- **Posturing Scopes**: DSL evaluation, entity filtering, performance

## Success Metrics
- **90%+** test coverage for posturing mod
- **80%+** overall test coverage maintained
- **All** unit tests pass successfully
- **Comprehensive** test suite for positioning system

## Violence Mod Test Patterns
New posturing tests provide patterns for violence mod development:
- Component tests for combat-related components
- Event tests for combat events
- Action tests for combat actions
- Condition tests for combat requirements (e.g., backstab conditions)

## Dependencies for Next Tickets
- **Ticket 16**: Final validation will use unit test results
- **Future Development**: Test patterns guide new mod test development
- **Maintenance**: Test suite enables safe future refactoring

## Post-Implementation Validation
After completion:
1. **Complete Test Coverage**: Positioning system fully tested
2. **Test Quality**: High-quality, maintainable test suite
3. **Regression Prevention**: Tests prevent future breaking changes
4. **Development Velocity**: Good tests enable faster future development

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Test Migration Phase