# MODTESTROB-008: Comprehensive Testing Best Practices Guide

**Status:** Ready for Implementation
**Priority:** P2 (Medium)
**Estimated Time:** 3-4 hours
**Risk Level:** Low
**Phase:** 3 - Documentation

---

## Overview

Create a comprehensive guide documenting best practices, patterns, and anti-patterns for mod action testing using the new testing infrastructure (validation proxy, diagnostic mode, domain matchers, scenario builders).

### Problem Statement

Current state:
- Testing knowledge scattered across individual test files
- No centralized documentation of best practices
- Developers repeat common mistakes
- Inconsistent testing approaches across mods
- New developers struggle to write effective tests

### Target State

Comprehensive guide providing:
- Clear testing patterns and examples
- Common pitfalls and how to avoid them
- Decision trees for tool selection
- Performance optimization tips
- Complete workflow examples

### Benefits

- **Faster onboarding** for new developers
- **Consistent testing quality** across all mods
- **Reduced debugging time** with better patterns
- **Knowledge sharing** of effective approaches
- **Reference documentation** for all testing tools

---

## Prerequisites

**Required Understanding:**
- All Phase 1 and Phase 2 improvements:
  - Action validation proxy (MODTESTROB-001)
  - Discovery diagnostic mode (MODTESTROB-002)
  - Enhanced error messages (MODTESTROB-003)
  - Scope resolver helpers (MODTESTROB-004)
  - Domain matchers (MODTESTROB-005)
  - Sitting scenarios (MODTESTROB-006)
  - Inventory scenarios (MODTESTROB-007)
- ModTestFixture API and patterns
- Jest testing framework

**Required Files:**
- All testing utilities from Phase 1 and Phase 2
- Existing test files for example extraction
- Documentation structure in `docs/testing/`

**Development Environment:**
- Markdown editing capabilities
- Access to codebase for examples

---

## Detailed Steps

### Step 1: Create Main Best Practices Guide

Create `docs/testing/mod-action-testing-best-practices.md`:

```markdown
# Mod Action Testing - Best Practices Guide

## Table of Contents

1. [Quick Start](#quick-start)
2. [Testing Workflow](#testing-workflow)
3. [Tool Selection](#tool-selection)
4. [Common Patterns](#common-patterns)
5. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
6. [Performance Optimization](#performance-optimization)
7. [Debugging Tips](#debugging-tips)
8. [Complete Examples](#complete-examples)

---

## Quick Start

### Your First Action Test

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('sit_down action', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should make standing actor sit', async () => {
    const testEnv = ModTestFixture.forAction('sit_down', testBed);

    // Use scenario builder for setup
    testEnv.scenarios.sitting.actorSittingAlone({
      actor: 'actor1',
    });

    // Execute action
    const result = await testEnv.when.actorPerformsAction('actor1');

    // Use domain matchers for assertions
    expect(result).toSucceed();
    expect(result).toRemoveComponent('core:standing', 'actor1');
    expect(result).toAddComponent('core:sitting', 'actor1');
  });
});
```

### Key Principles

1. **Use Scenario Builders** - Eliminate boilerplate setup
2. **Use Domain Matchers** - Clear, intent-revealing assertions
3. **Test Real Behavior** - Don't mock the action execution
4. **Validate Errors** - Test failure cases with good error messages
5. **Keep Tests Focused** - One behavior per test

---

## Testing Workflow

### Standard Test Structure

```javascript
describe('ActionName action', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Success Cases', () => {
    it('should perform primary behavior', async () => {
      // Arrange: Use scenario builders
      // Act: Execute action
      // Assert: Use domain matchers
    });

    it('should handle edge case X', async () => {
      // ...
    });
  });

  describe('Failure Cases', () => {
    it('should fail when precondition missing', async () => {
      // ...
    });

    it('should provide clear error message', async () => {
      // ...
    });
  });

  describe('Side Effects', () => {
    it('should dispatch expected events', async () => {
      // ...
    });

    it('should update related entities', async () => {
      // ...
    });
  });
});
```

### Test Categories

**1. Success Cases**
- Primary behavior with minimal setup
- Edge cases that should succeed
- Boundary conditions

**2. Failure Cases**
- Missing preconditions
- Invalid parameters
- Validation failures

**3. Side Effects**
- Event dispatching
- Related entity updates
- State transitions

---

## Tool Selection

### Decision Tree

```
Need to write action test?
├─ Setting up entities?
│  ├─ Common pattern? → Use Scenario Builder
│  └─ Custom setup? → Use given helpers
│
├─ Making assertions?
│  ├─ Action result? → Use Domain Matchers
│  └─ Complex logic? → Use standard Jest matchers
│
├─ Action not discovered?
│  └─ Enable Discovery Diagnostics
│
├─ Action execution failing?
│  └─ Use Enhanced Error Messages
│
└─ Need custom scope patterns?
   └─ Use Scope Resolver Helpers
```

### When to Use Each Tool

**Scenario Builders** (`testEnv.scenarios.*`)
- ✅ Common sitting/inventory setups
- ✅ Multi-entity arrangements
- ✅ Typical test scenarios
- ❌ Highly custom one-off setups

**Domain Matchers** (`expect(result).to*`)
- ✅ Action success/failure checks
- ✅ Component lifecycle assertions
- ✅ Entity state validation
- ❌ Complex custom logic validation

**Discovery Diagnostics** (`testEnv.enableDiagnostics()`)
- ✅ Action not appearing in discovery
- ✅ Scope resolver debugging
- ✅ Understanding filter pipeline
- ❌ Action executes but fails (use error messages)

**Validation Proxy** (automatic)
- ✅ Catches typos in action definitions
- ✅ Validates action structure
- ✅ Pre-execution validation
- ❌ Runtime execution errors (use error messages)

**Scope Resolver Helpers** (`ScopeResolverHelpers.*`)
- ✅ Reusable scope patterns
- ✅ Complex filtering logic
- ✅ Category-based scopes
- ❌ One-off custom filters

---

## Common Patterns

### Pattern 1: Simple Action Test

```javascript
it('should perform basic action', async () => {
  const testEnv = ModTestFixture.forAction('action_name', testBed);

  // Setup with scenario
  testEnv.scenarios.sitting.actorsSittingClose();

  // Execute
  const result = await testEnv.when.actorPerformsAction('actor1');

  // Assert
  expect(result).toSucceed();
  expect(result).toAddComponent('core:new_state', 'actor1');
});
```

### Pattern 2: Multi-Entity Action

```javascript
it('should affect multiple entities', async () => {
  const testEnv = ModTestFixture.forAction('kneel_before', testBed);

  // Setup
  testEnv.scenarios.sitting.standingNearSitting({
    standingActor: 'actor1',
    sittingActor: 'actor2',
  });

  // Execute
  const result = await testEnv.when.actorPerformsAction('actor1', {
    target: 'actor2',
  });

  // Assert - check both entities
  expect(result).toSucceed();
  expect(result).toAddComponent('core:kneeling', 'actor1');
  expect(result).toAddComponent('core:kneeling_before', 'actor1');

  // Target unchanged
  const target = testEnv.getEntity('actor2');
  expect(target).toHaveComponent('core:sitting');
});
```

### Pattern 3: Testing Failure Cases

```javascript
it('should fail with clear message when actor missing', async () => {
  const testEnv = ModTestFixture.forAction('sit_down', testBed);

  // Don't create actor - expect failure
  const result = await testEnv.when.actorPerformsAction('nonexistent');

  expect(result).toFail();
  expect(result).toHaveValidationError('Actor entity');
  expect(result).toHaveValidationError('does not exist');
});
```

### Pattern 4: Testing Component Data

```javascript
it('should set correct component data', async () => {
  const testEnv = ModTestFixture.forAction('turn_around', testBed);

  testEnv.scenarios.sitting.twoActorsSittingTogether();

  const result = await testEnv.when.actorPerformsAction('actor1');

  expect(result).toSucceed();

  const actor = testEnv.getEntity('actor1');
  expect(actor).toHaveComponentData('core:facing_away', {
    targetId: 'actor2',
  });
});
```

### Pattern 5: Testing Event Dispatching

```javascript
it('should dispatch component lifecycle events', async () => {
  const testEnv = ModTestFixture.forAction('sit_down', testBed);

  testEnv.given.actorExists('actor1', { location: 'room1' });
  testEnv.given.actorHasComponent('actor1', 'core:standing');

  const result = await testEnv.when.actorPerformsAction('actor1');

  expect(result).toSucceed();
  expect(result).toDispatchEvent('COMPONENTS_BATCH_REMOVED');
  expect(result).toDispatchEvent('COMPONENTS_BATCH_ADDED');
});
```

### Pattern 6: Custom Setup with Given Helpers

```javascript
it('should handle custom scenario', async () => {
  const testEnv = ModTestFixture.forAction('custom_action', testBed);

  // When scenario builders don't fit, use given helpers
  testEnv.given.locationExists('custom_location');
  testEnv.given.actorExists('actor1', { location: 'custom_location' });
  testEnv.given.actorHasComponent('actor1', 'custom:component', {
    customField: 'value',
  });

  const result = await testEnv.when.actorPerformsAction('actor1');

  expect(result).toSucceed();
});
```

### Pattern 7: Testing with Scope Diagnostics

```javascript
it('should discover action with complex filters', async () => {
  const testEnv = ModTestFixture.forAction('complex_action', testBed);

  // Enable diagnostics for debugging
  testEnv.enableDiagnostics();

  testEnv.scenarios.sitting.twoActorsSittingTogether();

  // This will output diagnostic trace
  const result = await testEnv.discoverWithDiagnostics('actor1', 'complex_action');

  // Check discovery succeeded
  expect(result.discovered).toBe(true);
});
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Verbose Setup

**Don't:**
```javascript
// 30 lines of manual setup
testEnv.given.locationExists('room1');
testEnv.given.actorExists('actor1', { location: 'room1' });
testEnv.given.actorHasComponent('actor1', 'core:sitting');
testEnv.given.actorHasComponent('actor1', 'core:on_furniture', { ... });
testEnv.given.furnitureExists('couch1', { ... });
testEnv.given.actorExists('actor2', { location: 'room1' });
testEnv.given.actorHasComponent('actor2', 'core:sitting');
// ... 20 more lines ...
```

**Do:**
```javascript
// 1 line with scenario builder
testEnv.scenarios.sitting.twoActorsSittingTogether();
```

### ❌ Anti-Pattern 2: Generic Assertions

**Don't:**
```javascript
expect(result.success).toBe(true);
expect(result.changes.added).toContain('core:sitting');
expect(result.changes.removed).toContain('core:standing');
```

**Do:**
```javascript
expect(result).toSucceed();
expect(result).toAddComponent('core:sitting', 'actor1');
expect(result).toRemoveComponent('core:standing', 'actor1');
```

### ❌ Anti-Pattern 3: Testing Implementation Details

**Don't:**
```javascript
// Testing internal execution steps
expect(ruleEngine.evaluate).toHaveBeenCalled();
expect(operationHandler.execute).toHaveBeenCalled();
```

**Do:**
```javascript
// Test observable behavior
expect(result).toSucceed();
expect(actor).toHaveComponent('core:sitting');
```

### ❌ Anti-Pattern 4: Multiple Behaviors in One Test

**Don't:**
```javascript
it('should handle all sitting scenarios', async () => {
  // Test sitting alone
  // Test sitting together
  // Test standing up
  // Test scooting closer
  // ... too many behaviors
});
```

**Do:**
```javascript
it('should make actor sit alone', async () => {
  // Single focused behavior
});

it('should make actor sit next to another', async () => {
  // Different focused behavior
});
```

### ❌ Anti-Pattern 5: Ignoring Failure Cases

**Don't:**
```javascript
describe('sit_down action', () => {
  it('should make actor sit', async () => {
    // Only test success case
  });
});
```

**Do:**
```javascript
describe('sit_down action', () => {
  it('should make actor sit', async () => {
    // Test success
  });

  it('should fail when actor already sitting', async () => {
    // Test failure
  });

  it('should fail when furniture occupied', async () => {
    // Test another failure case
  });
});
```

### ❌ Anti-Pattern 6: Skipping Entity State Verification

**Don't:**
```javascript
const result = await testEnv.when.actorPerformsAction('actor1');
expect(result).toSucceed();
// Don't verify actual entity state changed
```

**Do:**
```javascript
const result = await testEnv.when.actorPerformsAction('actor1');
expect(result).toSucceed();

// Verify entity state
const actor = testEnv.getEntity('actor1');
expect(actor).toHaveComponent('core:sitting');
expect(actor).not.toHaveComponent('core:standing');
```

### ❌ Anti-Pattern 7: Hardcoded Entity IDs Throughout

**Don't:**
```javascript
testEnv.given.actorExists('actor1', ...);
// Later
const result = await testEnv.when.actorPerformsAction('actor1');
// Later
const actor = testEnv.getEntity('actor1');
// 'actor1' hardcoded 50 times
```

**Do:**
```javascript
const { actor } = testEnv.scenarios.sitting.actorSittingAlone({
  actor: 'hero',
});
// Use returned ID consistently
```

---

## Performance Optimization

### Tip 1: Reuse Test Bed Efficiently

```javascript
// Good: Create once per test
beforeEach(() => {
  testBed = createTestBed();
});

afterEach(() => {
  testBed.cleanup();
});

// Bad: Create multiple times in same test
it('test', () => {
  const testBed1 = createTestBed(); // Wasteful
  const testBed2 = createTestBed();
});
```

### Tip 2: Use Scenario Builders

```javascript
// Faster: Pre-built patterns
testEnv.scenarios.sitting.twoActorsSittingTogether();

// Slower: Manual setup
testEnv.given.actorExists(...)
testEnv.given.actorHasComponent(...)
// ... 20 more calls
```

### Tip 3: Batch Entity Creation

```javascript
// Good: Use scenarios that batch operations
testEnv.scenarios.inventory.actorCarryingItems({
  items: ['item1', 'item2', 'item3'],
});

// Bad: Create items one by one
testEnv.given.itemExists('item1', ...);
testEnv.given.itemExists('item2', ...);
testEnv.given.itemExists('item3', ...);
```

### Tip 4: Minimize Diagnostics

```javascript
// Only enable when debugging
if (process.env.DEBUG_TESTS) {
  testEnv.enableDiagnostics();
}

// Don't leave always enabled
testEnv.enableDiagnostics(); // Slows down tests
```

---

## Debugging Tips

### Problem: Action Not Discovered

**Solution: Enable Discovery Diagnostics**

```javascript
testEnv.enableDiagnostics();
const result = await testEnv.discoverWithDiagnostics('actor1', 'action_id');

// Check output for:
// - Scope resolution results
// - Filter pipeline steps
// - Diagnostic hints
```

### Problem: Action Execution Failing

**Solution: Check Enhanced Error Messages**

```javascript
const result = await testEnv.when.actorPerformsAction('actor1');

expect(result).toFail();
console.log(result.validationErrors); // Pre-flight checks
console.log(result.errors); // Execution errors
```

### Problem: Unexpected Component Changes

**Solution: Verify Changes by Entity**

```javascript
const result = await testEnv.when.actorPerformsAction('actor1');

// Check specific entity changes
expect(result).toAddComponent('core:sitting', 'actor1');
expect(result).not.toAddComponent('core:sitting', 'actor2');

// Get full entity state
const actor = testEnv.getEntity('actor1');
console.log(actor.components);
```

### Problem: Test Flakiness

**Solution: Ensure Clean State**

```javascript
afterEach(() => {
  testBed.cleanup(); // Critical for consistency
});

// Avoid shared state between tests
let sharedVar; // Bad - state leak

// Use beforeEach for setup
beforeEach(() => {
  testBed = createTestBed(); // Fresh state
});
```

### Problem: Slow Tests

**Solution: Profile and Optimize**

```javascript
// Measure setup time
console.time('setup');
testEnv.scenarios.sitting.twoActorsSittingTogether();
console.timeEnd('setup');

// Measure execution time
console.time('execution');
const result = await testEnv.when.actorPerformsAction('actor1');
console.timeEnd('execution');
```

---

## Complete Examples

### Example 1: Positioning Action with All Tools

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('scoot_closer action - Complete Example', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Success Cases', () => {
    it('should move actor closer to sitting target', async () => {
      const testEnv = ModTestFixture.forAction('scoot_closer', testBed);

      // Use scenario builder
      testEnv.scenarios.sitting.separateFurniture({
        actor1: 'mover',
        actor2: 'target',
      });

      // Execute
      const result = await testEnv.when.actorPerformsAction('mover', {
        target: 'target',
      });

      // Use domain matchers
      expect(result).toSucceed();
      expect(result).toAddComponent('core:closeness', 'mover');
      expect(result).toDispatchEvent('COMPONENTS_BATCH_ADDED');

      // Verify entity state
      const mover = testEnv.getEntity('mover');
      expect(mover).toHaveComponentData('core:closeness', {
        targetId: 'target',
        level: 'close',
      });
    });

    it('should handle edge case: already adjacent', async () => {
      const testEnv = ModTestFixture.forAction('scoot_closer', testBed);

      testEnv.scenarios.sitting.twoActorsSittingTogether();

      const result = await testEnv.when.actorPerformsAction('actor1', {
        target: 'actor2',
      });

      // Should succeed but no position change
      expect(result).toSucceed();
    });
  });

  describe('Failure Cases', () => {
    it('should fail when target not sitting', async () => {
      const testEnv = ModTestFixture.forAction('scoot_closer', testBed);

      testEnv.given.actorExists('actor1', { location: 'room1' });
      testEnv.given.actorHasComponent('actor1', 'core:sitting');
      testEnv.given.actorExists('target', { location: 'room1' });
      testEnv.given.actorHasComponent('target', 'core:standing');

      const result = await testEnv.when.actorPerformsAction('actor1', {
        target: 'target',
      });

      expect(result).toFail();
      expect(result).toHaveValidationError('Required component');
      expect(result).toHaveValidationError('sitting');
    });

    it('should fail when actors in different rooms', async () => {
      const testEnv = ModTestFixture.forAction('scoot_closer', testBed);

      testEnv.given.locationExists('room1');
      testEnv.given.locationExists('room2');

      testEnv.scenarios.sitting.actorSittingAlone({
        actor: 'actor1',
        location: 'room1',
      });

      testEnv.scenarios.sitting.actorSittingAlone({
        actor: 'target',
        location: 'room2',
      });

      const result = await testEnv.when.actorPerformsAction('actor1', {
        target: 'target',
      });

      expect(result).toFail();
      expect(result).toHaveValidationError('same location');
    });
  });

  describe('Discovery', () => {
    it('should be discoverable with valid setup', async () => {
      const testEnv = ModTestFixture.forAction('scoot_closer', testBed);

      testEnv.scenarios.sitting.separateFurniture();

      const discovered = await testEnv.when.discoverActions('actor1');

      expect(discovered).toContain('scoot_closer');
    });

    it('should not be discoverable when target missing', async () => {
      const testEnv = ModTestFixture.forAction('scoot_closer', testBed);

      testEnv.scenarios.sitting.actorSittingAlone();

      const discovered = await testEnv.when.discoverActions('actor1');

      expect(discovered).not.toContain('scoot_closer');
    });
  });
});
```

### Example 2: Inventory Action with All Tools

```javascript
describe('give_item action - Complete Example', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Success Cases', () => {
    it('should transfer item between actors', async () => {
      const testEnv = ModTestFixture.forAction('give_item', testBed);

      // Use inventory scenario
      const { giver, receiver, item } = testEnv.scenarios.inventory.actorGivingItem({
        giver: 'alice',
        receiver: 'bob',
        item: 'sword',
      });

      // Execute
      const result = await testEnv.when.actorPerformsAction(giver, {
        target: receiver,
        item: item,
      });

      // Verify success
      expect(result).toSucceed();
      expect(result).toUpdateComponent('core:inventory', giver);
      expect(result).toUpdateComponent('core:inventory', receiver);

      // Verify inventory changes
      const giverEntity = testEnv.getEntity(giver);
      expect(giverEntity).toHaveComponentData('core:inventory', {
        items: [],
      });

      const receiverEntity = testEnv.getEntity(receiver);
      expect(receiverEntity).toHaveComponentData('core:inventory', {
        items: ['sword'],
      });
    });
  });

  describe('Failure Cases', () => {
    it('should fail when receiver inventory full', async () => {
      const testEnv = ModTestFixture.forAction('give_item', testBed);

      testEnv.scenarios.inventory.actorGivingItem({
        receiverHasSpace: false,
      });

      const result = await testEnv.when.actorPerformsAction('actor1', {
        target: 'actor2',
        item: 'item1',
      });

      expect(result).toFail();
      expect(result).toHaveValidationError('capacity');
    });

    it('should fail when item not in giver inventory', async () => {
      const testEnv = ModTestFixture.forAction('give_item', testBed);

      testEnv.scenarios.inventory.actorGivingItem();

      const result = await testEnv.when.actorPerformsAction('actor1', {
        target: 'actor2',
        item: 'nonexistent',
      });

      expect(result).toFail();
      expect(result).toHaveValidationError('not found in inventory');
    });
  });
});
```

---

## Quick Reference

### Scenario Builders

**Sitting:**
- `twoActorsSittingTogether()`
- `actorsSittingClose()`
- `actorSittingAlone()`
- `standingNearSitting()`
- `multipleActorsSitting()`
- `separateFurniture()`
- `sittingWithStandingBehind()`
- `kneelingBeforeSitting()`

**Inventory:**
- `actorCarryingItems()`
- `actorWithWeapon()`
- `itemsAtLocation()`
- `actorWithFullInventory()`
- `actorWithEmptyInventory()`
- `containerWithItems()`
- `actorGivingItem()`
- `actorDroppingItem()`
- `actorPickingUpItem()`
- `actorOpeningContainer()`
- `actorPuttingItemInContainer()`

### Domain Matchers

**Action Results:**
- `toSucceed()`
- `toFail()`
- `toAddComponent(type, entityId?)`
- `toRemoveComponent(type, entityId?)`
- `toUpdateComponent(type, entityId?)`
- `toDispatchEvent(eventType)`
- `toHaveValidationError(text)`

**Entity State:**
- `toHaveComponent(type)`
- `toBeAt(locationId)`
- `toHaveComponentData(type, data)`

### Diagnostics

```javascript
// Enable diagnostics
testEnv.enableDiagnostics();

// Discover with trace
const result = await testEnv.discoverWithDiagnostics(actorId, expectedActionId);
```

---

## Additional Resources

- [Domain Matchers Guide](./action-discovery-testing-toolkit.md#domain-matchers)
- [Scenario Helper Catalog – Seating](./mod-testing-guide.md#seating-scenarios)
- [Scenario Helper Catalog – Inventory](./mod-testing-guide.md#inventory-scenarios)
- [Scope Resolver Helpers Guide](./scope-resolver-helpers-guide.md)

---

## Contributing

When adding new patterns to this guide:

1. Provide complete code examples
2. Show both good and bad approaches
3. Explain the reasoning behind patterns
4. Include real-world scenarios
5. Keep examples focused and concise

---

## Feedback

Found a better pattern? Have suggestions for improvements?

Please share your insights so this guide can evolve with the team's collective knowledge.
```

### Step 2: Create Troubleshooting Guide

Create `docs/testing/troubleshooting-mod-action-tests.md`:

```markdown
# Troubleshooting Mod Action Tests

Quick reference for diagnosing and fixing common test issues.

## Quick Diagnosis Checklist

```
Test failing?
├─ Action not discovered? → See "Discovery Issues"
├─ Action fails validation? → See "Validation Errors"
├─ Action execution error? → See "Execution Errors"
├─ Wrong component changes? → See "State Verification"
├─ Test is flaky? → See "Flakiness"
└─ Test is slow? → See "Performance"
```

---

## Discovery Issues

### Symptom: Action not appearing in discovery

**Diagnostic Steps:**

1. **Enable Discovery Diagnostics**
```javascript
testEnv.enableDiagnostics();
const result = await testEnv.discoverWithDiagnostics('actor1', 'action_id');
```

2. **Check Output for:**
   - Scope resolution failures
   - Filter rejections
   - Missing required components

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Missing required components | Add missing components to actor/target |
| Forbidden components present | Remove forbidden components |
| Wrong location | Ensure entities in same location |
| Scope filter failure | Check scope resolver logic |
| Target requirements not met | Verify target has required components |

**Example Fix:**

```javascript
// Problem: Action requires core:standing but actor has core:sitting
testEnv.given.actorHasComponent('actor1', 'core:sitting'); // Wrong

// Solution: Add correct component
testEnv.given.actorHasComponent('actor1', 'core:standing'); // Right
```

---

## Validation Errors

### Symptom: Action fails pre-flight validation

**Diagnostic Steps:**

1. **Check Validation Errors**
```javascript
const result = await testEnv.when.actorPerformsAction('actor1');
console.log(result.validationErrors);
```

2. **Common Validation Failures:**

**Entity Existence:**
```
Error: "Actor entity 'actor1' does not exist"
Solution: testEnv.given.actorExists('actor1', { location: 'room1' });
```

**Required Components:**
```
Error: "Required component 'core:standing' not found on actor"
Solution: testEnv.given.actorHasComponent('actor1', 'core:standing');
```

**Forbidden Components:**
```
Error: "Forbidden component 'core:sitting' found on actor"
Solution: Don't add forbidden components, or remove them first
```

**Component Data:**
```
Error: "Component 'core:position' missing required field 'location'"
Solution: Provide complete component data
testEnv.given.actorHasComponent('actor1', 'core:position', {
  location: 'room1', // Required field
});
```

---

## Execution Errors

### Symptom: Action validation passes but execution fails

**Diagnostic Steps:**

1. **Check Execution Errors**
```javascript
const result = await testEnv.when.actorPerformsAction('actor1');
console.log(result.errors);
```

2. **Common Execution Failures:**

**Operation Handler Errors:**
```
Error: "Operation handler 'addComponent' failed: Invalid component type"
Solution: Ensure component types are properly namespaced (e.g., 'core:sitting')
```

**Rule Execution Errors:**
```
Error: "Rule condition evaluation failed"
Solution: Check rule definition and ensure all required data available
```

**Event Bus Errors:**
```
Error: "Event dispatch failed: Invalid event type"
Solution: Verify event type matches registered events
```

---

## State Verification

### Symptom: Assertions fail unexpectedly

**Diagnostic Steps:**

1. **Inspect Entity State**
```javascript
const actor = testEnv.getEntity('actor1');
console.log('Components:', actor.components);
console.log('Component types:', actor.components.map(c => c.type));
```

2. **Check Result Changes**
```javascript
const result = await testEnv.when.actorPerformsAction('actor1');
console.log('Added:', result.changes.added);
console.log('Removed:', result.changes.removed);
console.log('Updated:', result.changes.updated);
```

**Common Issues:**

**Wrong Entity ID:**
```javascript
// Problem
expect(result).toAddComponent('core:sitting', 'wrong_id');

// Solution
expect(result).toAddComponent('core:sitting', 'actor1');
```

**Component Type Mismatch:**
```javascript
// Problem
expect(actor).toHaveComponent('sitting'); // Missing namespace

// Solution
expect(actor).toHaveComponent('core:sitting'); // With namespace
```

---

## Flakiness

### Symptom: Test passes sometimes, fails other times

**Common Causes and Solutions:**

**1. Shared State Between Tests**
```javascript
// Problem: State leak
let sharedTestEnv; // Bad

// Solution: Fresh state per test
beforeEach(() => {
  testBed = createTestBed();
});

afterEach(() => {
  testBed.cleanup(); // Critical!
});
```

**2. Async Timing Issues**
```javascript
// Problem: Not awaiting async calls
testEnv.when.actorPerformsAction('actor1'); // Missing await

// Solution: Always await
await testEnv.when.actorPerformsAction('actor1');
```

**3. Entity ID Conflicts**
```javascript
// Problem: Reusing IDs across tests
testEnv.given.actorExists('actor1', ...);

// Solution: Use unique IDs or clean up properly
afterEach(() => {
  testBed.cleanup(); // Removes all entities
});
```

---

## Performance

### Symptom: Tests are slow

**Diagnostic Steps:**

1. **Profile Test Execution**
```javascript
console.time('setup');
testEnv.scenarios.sitting.twoActorsSittingTogether();
console.timeEnd('setup');

console.time('execution');
await testEnv.when.actorPerformsAction('actor1');
console.timeEnd('execution');
```

2. **Common Bottlenecks:**

| Cause | Solution |
|-------|----------|
| Verbose manual setup | Use scenario builders |
| Many individual entity creations | Batch with scenarios |
| Diagnostics always enabled | Only enable when debugging |
| Not cleaning up | Ensure afterEach cleanup |
| Too many assertions | Focus on essential checks |

**Optimization Example:**

```javascript
// Slow: Manual setup (200ms)
testEnv.given.actorExists('actor1', ...);
testEnv.given.actorHasComponent(...);
// ... 20 more calls

// Fast: Scenario builder (20ms)
testEnv.scenarios.sitting.twoActorsSittingTogether();
```

---

## Error Message Reference

### Validation Errors

```
"Actor entity '{id}' does not exist"
→ Create actor with testEnv.given.actorExists()

"Target entity '{id}' does not exist"
→ Create target entity

"Required component '{type}' not found on actor"
→ Add component with testEnv.given.actorHasComponent()

"Forbidden component '{type}' found on actor"
→ Don't add forbidden component to actor

"Component '{type}' missing required field '{field}'"
→ Provide complete component data

"Actor and target must be in same location"
→ Ensure both entities at same location

"Inventory capacity exceeded"
→ Reduce items or increase capacity

"Container is locked"
→ Unlock container or provide key
```

### Execution Errors

```
"Rule condition evaluation failed"
→ Check rule definition and required data

"Operation handler '{handler}' not found"
→ Verify operation is registered

"Invalid component type: '{type}'"
→ Use namespaced format (e.g., 'core:sitting')

"Event dispatch failed"
→ Check event type is registered
```

---

## Getting Help

1. **Check this guide first** - Most issues are covered here
2. **Enable diagnostics** - Get detailed execution trace
3. **Simplify the test** - Remove complexity to isolate issue
4. **Check similar tests** - See how others handle similar scenarios
5. **Ask the team** - Share diagnostic output when asking for help

---

## Debug Workflow

```
1. Test fails
   ↓
2. Read error message
   ↓
3. Enable diagnostics if discovery/scope issue
   ↓
4. Check validation/execution errors
   ↓
5. Inspect entity state
   ↓
6. Simplify test to isolate issue
   ↓
7. Consult this guide
   ↓
8. Apply fix
   ↓
9. Verify test passes
   ↓
10. Add similar test for edge case if needed
```
```

### Step 3: Create Testing Checklist

Create `docs/testing/action-test-checklist.md`:

```markdown
# Action Test Checklist

Use this checklist to ensure comprehensive test coverage for mod actions.

## Pre-Implementation

- [ ] Read action specification/requirements
- [ ] Identify all target types (primary, secondary, tertiary)
- [ ] List required components for actor and targets
- [ ] List forbidden components for actor and targets
- [ ] Note expected component changes (add/remove/update)
- [ ] Identify edge cases and boundary conditions
- [ ] Determine if existing scenarios apply

## Test File Setup

- [ ] Import required testing utilities
- [ ] Set up testBed with beforeEach/afterEach
- [ ] Import scenario builders if applicable
- [ ] Register domain matchers (automatic via setupTests.js)

## Success Cases

- [ ] Test primary behavior with minimal setup
- [ ] Test with single target (if applicable)
- [ ] Test with multiple targets (if applicable)
- [ ] Test edge case: boundary conditions
- [ ] Test edge case: maximum values
- [ ] Verify component additions
- [ ] Verify component removals
- [ ] Verify component updates
- [ ] Verify entity state after action

## Failure Cases

- [ ] Test with missing actor entity
- [ ] Test with missing target entity
- [ ] Test with missing required actor component
- [ ] Test with missing required target component
- [ ] Test with forbidden actor component present
- [ ] Test with forbidden target component present
- [ ] Test with invalid parameters
- [ ] Verify error messages are clear

## Discovery Tests

- [ ] Test action is discoverable with valid setup
- [ ] Test action not discoverable with invalid setup
- [ ] Test scope filters work correctly
- [ ] Test target filtering works correctly

## Side Effects

- [ ] Verify correct events dispatched
- [ ] Verify event payloads are correct
- [ ] Test multi-entity effects (if applicable)
- [ ] Test location changes (if applicable)
- [ ] Test inventory changes (if applicable)

## Code Quality

- [ ] Tests use scenario builders where applicable
- [ ] Tests use domain matchers for assertions
- [ ] Each test focused on single behavior
- [ ] Test names clearly describe what's tested
- [ ] Tests are independent (no shared state)
- [ ] Cleanup in afterEach hook

## Documentation

- [ ] Complex setup patterns documented
- [ ] Edge cases explained
- [ ] Known limitations noted
- [ ] Related actions referenced

## Performance

- [ ] Tests run in < 100ms each
- [ ] No unnecessary entity creation
- [ ] Scenario builders used efficiently
- [ ] Diagnostics disabled by default

## Before Committing

- [ ] All tests pass
- [ ] Test coverage > 80%
- [ ] ESLint passes
- [ ] No console.log statements left
- [ ] Test file properly organized
```

---

## Validation Criteria

### Documentation Quality

- [ ] Best practices guide is comprehensive
- [ ] All major patterns documented with examples
- [ ] Anti-patterns clearly explained
- [ ] Troubleshooting guide covers common issues
- [ ] Checklist is complete and actionable

### Content Completeness

- [ ] Quick start section for beginners
- [ ] Decision trees for tool selection
- [ ] Complete examples for all scenarios
- [ ] Performance optimization tips included
- [ ] Debugging workflows documented

### Usability

- [ ] Table of contents for easy navigation
- [ ] Code examples are copy-paste ready
- [ ] Clear section headings
- [ ] Consistent formatting throughout
- [ ] Links to related documentation

---

## Files Created

### New Documentation Files

1. **`docs/testing/mod-action-testing-best-practices.md`** (~800 lines)
   - Complete testing guide
   - Patterns and anti-patterns
   - Tool selection guidance
   - Performance tips
   - Debugging workflows
   - Complete examples

2. **`docs/testing/troubleshooting-mod-action-tests.md`** (~350 lines)
   - Quick diagnosis checklist
   - Discovery issue resolution
   - Validation error solutions
   - Execution error handling
   - Flakiness debugging
   - Performance optimization

3. **`docs/testing/action-test-checklist.md`** (~150 lines)
   - Pre-implementation checklist
   - Test coverage checklist
   - Quality checklist
   - Performance checklist

---

## Testing

### Validate Documentation

```bash
# Check markdown formatting
npx markdownlint docs/testing/*.md

# Verify all links work
# (Manual check or use markdown-link-check tool)

# Ensure code examples are syntactically valid
# (Manual review or extract and lint)
```

---

## Rollback Plan

```bash
# Remove documentation files
rm docs/testing/mod-action-testing-best-practices.md
rm docs/testing/troubleshooting-mod-action-tests.md
rm docs/testing/action-test-checklist.md

# Revert any other documentation changes
git checkout docs/testing/
```

---

## Commit Strategy

### Commit 1: Best Practices Guide
```bash
git add docs/testing/mod-action-testing-best-practices.md
git commit -m "docs(testing): add comprehensive mod action testing best practices guide

- Quick start guide for beginners
- Common patterns and anti-patterns
- Tool selection decision trees
- Performance optimization tips
- Complete workflow examples
- Debugging strategies
- Quick reference section

Provides centralized testing knowledge for team"
```

### Commit 2: Troubleshooting Guide
```bash
git add docs/testing/troubleshooting-mod-action-tests.md
git commit -m "docs(testing): add troubleshooting guide for mod action tests

- Quick diagnosis workflows
- Discovery issue resolution
- Validation error solutions
- Execution error handling
- Flakiness debugging strategies
- Performance optimization
- Error message reference

Accelerates debugging and problem resolution"
```

### Commit 3: Testing Checklist
```bash
git add docs/testing/action-test-checklist.md
git commit -m "docs(testing): add action test checklist

- Pre-implementation checklist
- Comprehensive test coverage checklist
- Code quality checklist
- Performance checklist

Ensures consistent test quality across all actions"
```

---

## Success Criteria

### Documentation Quality
- [x] Comprehensive coverage of all testing tools
- [x] Clear examples for all patterns
- [x] Anti-patterns identified and explained
- [x] Troubleshooting workflows complete
- [x] Checklists actionable and complete

### Usability
- [x] Easy navigation with table of contents
- [x] Code examples are complete and tested
- [x] Quick reference sections included
- [x] Links to related documentation provided
- [x] Consistent formatting throughout

### Impact Metrics
- **Onboarding time reduced** - New developers can write tests faster
- **Test quality improved** - Consistent patterns across team
- **Debugging time reduced** - Clear troubleshooting workflows
- **Knowledge sharing** - Centralized best practices
- **Reference documentation** - Quick answers to common questions

---

## Next Steps

After this ticket is complete:

1. **MODTESTROB-009**: Create migration guide for old patterns
2. **MODTESTROB-010**: Update existing tests with new patterns
3. **MODTESTROB-011**: Create success metrics dashboard

---

## Notes

- Documentation should be updated as new patterns emerge
- Examples should be kept in sync with actual test utilities
- Gather feedback from team to improve content
- Consider adding diagrams/flowcharts for complex workflows
- Keep documentation concise but comprehensive
