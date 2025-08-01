# Ticket 14: Update Integration Tests for Positioning Logic

## Overview
**Phase**: 4 - Test Migration  
**Priority**: High  
**Estimated Time**: 4-5 hours  
**Dependencies**: Tickets 10-13 (Intimacy Refactoring Complete)  
**Implements**: Report section "Test Migration" - integration test updates

## Objective
Update all integration tests related to positioning logic to use the new posturing namespace, ensuring comprehensive test coverage validates the migrated positioning system and its integration with intimacy mod functionality.

## Background
**Test Files Requiring Updates** (from migration analysis):
- `/tests/integration/rules/stepBackRule.integration.test.js`
- `/tests/integration/rules/turnAroundToFaceRule.integration.test.js`
- `/tests/integration/rules/turnAroundRule.integration.test.js`
- Additional integration tests referencing positioning logic

**Namespace Updates Required**:
- Component references: `intimacy:facing_away` → `posturing:facing_away`
- Event references: `intimacy:actor_*` → `posturing:actor_*`
- Action references: `intimacy:turn_around*` → `posturing:turn_around*`
- Condition references: `intimacy:positioning-*` → `posturing:positioning-*`
- Scope references: Based on migration results from tickets 09

**From Migration Analysis**:
- 34 test files total require updates
- Integration tests validate cross-mod functionality
- Tests ensure positioning system works with intimacy actions
- Critical for verifying violence mod integration readiness

## Implementation Tasks

### Task 14.1: Identify All Integration Tests with Positioning References
**Search Strategy**:
```bash
# Find integration tests with positioning references
cd tests/integration/

# Search for component references
grep -r "intimacy:facing_away" . --include="*.js"

# Search for event references
grep -r "intimacy:actor_turned_around\|intimacy:actor_faced" . --include="*.js"

# Search for action references
grep -r "intimacy:turn_around" . --include="*.js"

# Search for condition references
grep -r "intimacy:.*-facing\|intimacy:.*-behind" . --include="*.js"

# Search for scope references
grep -r "facing_away\|close_actors_facing" . --include="*.js"
```

### Task 14.2: Update turnAroundRule Integration Test
**File**: `tests/integration/rules/turnAroundRule.integration.test.js`

**Expected Current Test Structure**:
```javascript
describe('Turn Around Rule Integration', () => {
  it('should turn actor around and update facing_away component', async () => {
    // Setup actors
    const actor = testBed.createActor();
    const target = testBed.createActor();
    
    // Attempt turn around action
    const actionEvent = {
      type: 'core:attempt_action',
      payload: {
        action: {
          id: 'intimacy:turn_around',  // ❌ UPDATE TO: posturing:turn_around
          actor: actor.id,
          target: target.id
        }
      }
    };
    
    // Execute action
    await testBed.dispatchEvent(actionEvent);
    
    // Verify component update
    const targetEntity = testBed.getEntity(target.id);
    expect(targetEntity['intimacy:facing_away']).toBeDefined();  // ❌ UPDATE TO: posturing:facing_away
    expect(targetEntity['intimacy:facing_away'].facing_away_from).toContain(actor.id);
    
    // Verify events dispatched
    expect(testBed.getDispatchedEvents()).toContainEqual(
      expect.objectContaining({
        type: 'intimacy:actor_turned_around',  // ❌ UPDATE TO: posturing:actor_turned_around
        payload: {
          actor: target.id,
          turned_by: actor.id
        }
      })
    );
  });
});
```

**Updated Test Structure**:
```javascript
describe('Turn Around Rule Integration', () => {
  it('should turn actor around and update facing_away component', async () => {
    // Setup actors
    const actor = testBed.createActor();
    const target = testBed.createActor();
    
    // Attempt turn around action
    const actionEvent = {
      type: 'core:attempt_action',
      payload: {
        action: {
          id: 'posturing:turn_around',  // ✅ UPDATED
          actor: actor.id,
          target: target.id
        }
      }
    };
    
    // Execute action
    await testBed.dispatchEvent(actionEvent);
    
    // Verify component update
    const targetEntity = testBed.getEntity(target.id);
    expect(targetEntity['posturing:facing_away']).toBeDefined();  // ✅ UPDATED
    expect(targetEntity['posturing:facing_away'].facing_away_from).toContain(actor.id);
    
    // Verify events dispatched
    expect(testBed.getDispatchedEvents()).toContainEqual(
      expect.objectContaining({
        type: 'posturing:actor_turned_around',  // ✅ UPDATED
        payload: {
          actor: target.id,
          turned_by: actor.id
        }
      })
    );
  });
});
```

### Task 14.3: Update turnAroundToFaceRule Integration Test
**File**: `tests/integration/rules/turnAroundToFaceRule.integration.test.js`

**Key Updates Required**:
```javascript
// Action reference update
id: 'intimacy:turn_around_to_face' → 'posturing:turn_around_to_face'

// Component reference updates
actor['intimacy:facing_away'] → actor['posturing:facing_away']

// Event reference updates
'intimacy:actor_faced_everyone' → 'posturing:actor_faced_everyone'

// Condition reference updates (if any)
'intimacy:entity-in-facing-away' → 'posturing:entity-in-facing-away'
```

### Task 14.4: Update stepBackRule Integration Test
**File**: `tests/integration/rules/stepBackRule.integration.test.js`

**Analysis Required**: Determine how step back rule relates to positioning:
- May reference facing_away component for positioning logic
- May use positioning conditions for rule logic
- May dispatch positioning events

**Expected Updates**:
```javascript
// If step back affects facing relationships:
targetEntity['intimacy:facing_away'] → targetEntity['posturing:facing_away']

// If step back uses positioning conditions:
'intimacy:both-actors-facing-each-other' → 'posturing:both-actors-facing-each-other'
```

### Task 14.5: Search and Update Additional Integration Tests
**Comprehensive Search**:
```bash
# Find all integration tests with positioning references
find tests/integration/ -name "*.js" -exec grep -l "intimacy:facing_away\|intimacy:actor_turned\|intimacy:actor_faced\|intimacy:turn_around" {} \;

# For each file found, update:
# - Component references
# - Event references  
# - Action references
# - Condition references
# - Scope references
```

### Task 14.6: Update Test Bed and Helper References
**Test Utilities Update**:
```javascript
// In test helpers and utilities:
// Update component creation helpers
createActorWithFacingAway(entityId) {
  return testBed.addComponent(entityId, 'posturing:facing_away', {  // ✅ UPDATED
    facing_away_from: []
  });
}

// Update event creation helpers
createTurnAroundEvent(actor, target) {
  return {
    type: 'posturing:actor_turned_around',  // ✅ UPDATED
    payload: { actor: target, turned_by: actor }
  };
}

// Update action creation helpers
createTurnAroundAction(actor, target) {
  return {
    id: 'posturing:turn_around',  // ✅ UPDATED
    actor: actor,
    target: target
  };
}
```

## Implementation Steps

### Step 1: Comprehensive Test Analysis
```bash
# Navigate to integration tests
cd tests/integration/

# Create backup
cp -r . ../integration-backup/

# Search for all positioning references
echo "=== Integration Tests with Positioning References ==="
find . -name "*.js" -exec grep -l "intimacy:facing_away\|intimacy:actor_\|intimacy:turn_around\|intimacy:.*-facing\|intimacy:.*-behind" {} \;

# Analyze each file
for file in $(find . -name "*.js" -exec grep -l "intimacy:facing_away\|intimacy:actor_\|intimacy:turn_around" {} \;); do
  echo "=== $file ==="
  grep -n "intimacy:" "$file"
  echo ""
done
```

### Step 2: Update Known Critical Integration Tests
```bash
# Update turnAroundRule.integration.test.js
# - Replace intimacy:turn_around with posturing:turn_around
# - Replace intimacy:facing_away with posturing:facing_away
# - Replace intimacy:actor_turned_around with posturing:actor_turned_around
# - Replace intimacy:actor_faced_forward with posturing:actor_faced_forward

# Update turnAroundToFaceRule.integration.test.js
# - Replace intimacy:turn_around_to_face with posturing:turn_around_to_face
# - Replace intimacy:facing_away with posturing:facing_away
# - Replace intimacy:actor_faced_everyone with posturing:actor_faced_everyone

# Update stepBackRule.integration.test.js
# - Update any positioning-related references found
```

### Step 3: Update Component References in All Tests
```bash
# Systematic replacement of component references
find . -name "*.js" -exec sed -i "s/'intimacy:facing_away'/'posturing:facing_away'/g" {} \;
find . -name "*.js" -exec sed -i 's/"intimacy:facing_away"/"posturing:facing_away"/g' {} \;
```

### Step 4: Update Event References in All Tests
```bash
# Systematic replacement of event references
find . -name "*.js" -exec sed -i "s/'intimacy:actor_turned_around'/'posturing:actor_turned_around'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:actor_faced_everyone'/'posturing:actor_faced_everyone'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:actor_faced_forward'/'posturing:actor_faced_forward'/g" {} \;

# Update with double quotes as well
find . -name "*.js" -exec sed -i 's/"intimacy:actor_turned_around"/"posturing:actor_turned_around"/g' {} \;
find . -name "*.js" -exec sed -i 's/"intimacy:actor_faced_everyone"/"posturing:actor_faced_everyone"/g' {} \;
find . -name "*.js" -exec sed -i 's/"intimacy:actor_faced_forward"/"posturing:actor_faced_forward"/g' {} \;
```

### Step 5: Update Action References in All Tests
```bash
# Systematic replacement of action references
find . -name "*.js" -exec sed -i "s/'intimacy:turn_around'/'posturing:turn_around'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:turn_around_to_face'/'posturing:turn_around_to_face'/g" {} \;

# Update with double quotes as well
find . -name "*.js" -exec sed -i 's/"intimacy:turn_around"/"posturing:turn_around"/g' {} \;
find . -name "*.js" -exec sed -i 's/"intimacy:turn_around_to_face"/"posturing:turn_around_to_face"/g' {} \;
```

### Step 6: Update Condition References in All Tests
```bash
# Update positioning condition references
find . -name "*.js" -exec sed -i "s/'intimacy:both-actors-facing-each-other'/'posturing:both-actors-facing-each-other'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:actor-is-behind-entity'/'posturing:actor-is-behind-entity'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:entity-not-in-facing-away'/'posturing:entity-not-in-facing-away'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:actor-in-entity-facing-away'/'posturing:actor-in-entity-facing-away'/g" {} \;
find . -name "*.js" -exec sed -i "s/'intimacy:entity-in-facing-away'/'posturing:entity-in-facing-away'/g" {} \;

# Update with double quotes as well
find . -name "*.js" -exec sed -i 's/"intimacy:both-actors-facing-each-other"/"posturing:both-actors-facing-each-other"/g' {} \;
find . -name "*.js" -exec sed -i 's/"intimacy:actor-is-behind-entity"/"posturing:actor-is-behind-entity"/g' {} \;
find . -name "*.js" -exec sed -i 's/"intimacy:entity-not-in-facing-away"/"posturing:entity-not-in-facing-away"/g' {} \;
find . -name "*.js" -exec sed -i 's/"intimacy:actor-in-entity-facing-away"/"posturing:actor-in-entity-facing-away"/g' {} \;
find . -name "*.js" -exec sed -i 's/"intimacy:entity-in-facing-away"/"posturing:entity-in-facing-away"/g' {} \;
```

### Step 7: Update Scope References (Based on Ticket 09 Results)
```bash
# If scopes migrated to posturing:
# find . -name "*.js" -exec sed -i "s/'intimacy:actors_im_facing_away_from'/'posturing:actors_im_facing_away_from'/g" {} \;
# find . -name "*.js" -exec sed -i "s/'intimacy:close_actors_facing_away'/'posturing:close_actors_facing_away'/g" {} \;
```

### Step 8: Run Integration Tests and Fix Issues
```bash
# Run integration tests
npm run test:integration

# Check for failures and fix:
# - Missing component references
# - Event type mismatches  
# - Action ID mismatches
# - Condition evaluation failures
# - Scope resolution issues
```

## Acceptance Criteria

### ✅ Reference Updates Completion
- [ ] All component references updated to `posturing:facing_away`
- [ ] All event references updated to posturing namespace
- [ ] All action references updated to posturing namespace
- [ ] All condition references updated to posturing namespace
- [ ] Scope references updated based on migration results

### ✅ Test Functionality Validation
- [ ] All integration tests pass successfully
- [ ] No test failures due to namespace changes
- [ ] Tests properly validate cross-mod integration
- [ ] Test coverage maintained or improved

### ✅ Specific Test File Updates
- [ ] `turnAroundRule.integration.test.js` updated and passing
- [ ] `turnAroundToFaceRule.integration.test.js` updated and passing
- [ ] `stepBackRule.integration.test.js` updated and passing
- [ ] All other positioning-related integration tests updated

### ✅ Test Infrastructure Updates
- [ ] Test bed helpers updated for posturing namespace
- [ ] Test utilities support posturing components and events
- [ ] Mock data creation uses correct namespaces
- [ ] Test assertions validate posturing system integration

## Risk Assessment

### 🚨 Potential Issues
1. **Test Failures**: Namespace changes might break test logic
2. **Missing References**: Some positioning references might be missed
3. **Test Bed Issues**: Test infrastructure might not support posturing namespace
4. **Integration Complexity**: Cross-mod integration tests might be complex to update
5. **Performance Impact**: Updated tests might run slower

### 🛡️ Risk Mitigation
1. **Systematic Approach**: Update tests methodically by category
2. **Comprehensive Search**: Use multiple search patterns to find all references
3. **Test Infrastructure Update**: Update test bed and helpers first
4. **Incremental Testing**: Run tests after each batch of updates
5. **Performance Monitoring**: Track test execution time

## Test Cases

### Test Case 1: Component Integration
```bash
# Run tests that validate posturing:facing_away component usage
npm run test:integration -- --grep "facing_away"
# Expected: All tests pass with posturing namespace
```

### Test Case 2: Event Integration
```bash
# Run tests that validate posturing event dispatching
npm run test:integration -- --grep "actor_turned_around|actor_faced"
# Expected: All tests pass with posturing events
```

### Test Case 3: Action Integration
```bash
# Run tests that validate posturing action handling
npm run test:integration -- --grep "turn_around"
# Expected: All tests pass with posturing actions
```

### Test Case 4: Cross-Mod Integration
```bash
# Run tests that validate intimacy + posturing integration
npm run test:integration -- --grep "intimacy.*posturing|posturing.*intimacy"
# Expected: Cross-mod integration works correctly
```

### Test Case 5: Regression Testing
```bash
# Run all integration tests
npm run test:integration
# Expected: All tests pass, no regressions introduced
```

## File Changes Summary

### Integration Test Files Updated
- `tests/integration/rules/turnAroundRule.integration.test.js`
- `tests/integration/rules/turnAroundToFaceRule.integration.test.js`
- `tests/integration/rules/stepBackRule.integration.test.js`
- Additional integration tests with positioning references

### Test Infrastructure Updates
- Test bed helpers for posturing namespace
- Mock data creation utilities
- Event assertion helpers
- Component creation utilities

### Namespace Changes Applied
- **Components**: `intimacy:facing_away` → `posturing:facing_away`
- **Events**: `intimacy:actor_*` → `posturing:actor_*`
- **Actions**: `intimacy:turn_around*` → `posturing:turn_around*`
- **Conditions**: `intimacy:positioning-*` → `posturing:positioning-*`
- **Scopes**: Conditional updates based on ticket 09

## Success Metrics
- **100%** integration test pass rate
- **Zero** test failures due to namespace changes
- **All** positioning-related integration tests updated
- **Maintained** or improved test coverage

## Cross-Mod Integration Validation

### Integration Test Coverage
- **Intimacy → Posturing**: Intimacy actions use posturing positioning
- **Posturing Independence**: Posturing system works independently
- **Event Flow**: Events flow correctly between mods
- **Component Access**: Cross-mod component access works
- **Condition Evaluation**: Cross-mod condition evaluation works

### Violence Mod Readiness
Updated integration tests demonstrate patterns for violence mod:
- Actions can use `posturing:facing_away` for positioning requirements
- Conditions like `posturing:actor-is-behind-entity` enable combat mechanics
- Events provide feedback for positioning changes in combat

## Dependencies for Next Tickets
- **Ticket 15**: Unit tests will build on integration test patterns
- **Ticket 16**: Final validation will use integration test results
- **Future Development**: Updated tests provide examples for new mod development

## Post-Implementation Validation
After completion:
1. **Test Coverage**: Comprehensive integration testing of positioning system
2. **Cross-Mod Validation**: Proven integration between intimacy and posturing
3. **Regression Prevention**: Tests prevent future breaking changes
4. **Development Support**: Tests provide examples for future mod integration

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Test Migration Phase