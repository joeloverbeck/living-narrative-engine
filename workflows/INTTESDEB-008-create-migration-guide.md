# INTTESDEB-008: Create Migration Guide with Before/After Examples

## Metadata
- **Status**: Ready for Implementation
- **Priority**: Low (Phase 3)
- **Effort**: 0.5 days
- **Dependencies**: All Phase 1 and Phase 2 tickets (INTTESDEB-001 through INTTESDEB-006)
- **File Created**: `/docs/testing/action-integration-test-migration.md`

## Problem Statement

Existing integration tests use old patterns (manual entity creation, generic assertions, no validation). Developers need:
1. **Step-by-step migration guide** from old to new patterns
2. **Before/after examples** showing the transformation
3. **Decision framework** for when to migrate
4. **Common pitfalls** to avoid during migration

Without a clear migration path, developers may be reluctant to adopt new utilities or may use them incorrectly.

## Acceptance Criteria

✅ **Migration Strategy Document**
- When to migrate (criteria for migration priority)
- Migration process (step-by-step)
- Backward compatibility notes
- Gradual adoption strategy

✅ **Before/After Examples**
- Complete test transformation examples
- Line-by-line comparison
- Explains benefits of each change
- Shows 50-70% code reduction

✅ **Common Migration Patterns**
- Manual entity creation → `createActorTargetScenario()`
- Generic assertions → custom matchers
- No validation → automatic validation
- No diagnostics → diagnostic discovery

✅ **Pitfall Guide**
- Common mistakes during migration
- How to debug migration issues
- Compatibility concerns
- Performance considerations

## Implementation Details

### File Location
`/docs/testing/action-integration-test-migration.md` (new file)

### Document Structure

```markdown
# Action Integration Test Migration Guide

Step-by-step guide for migrating existing integration tests to use new debugging utilities.

## Table of Contents

1. [Should You Migrate?](#should-you-migrate)
2. [Migration Strategy](#migration-strategy)
3. [Step-by-Step Migration](#step-by-step-migration)
4. [Complete Examples](#complete-examples)
5. [Common Patterns](#common-patterns)
6. [Troubleshooting Migration](#troubleshooting-migration)
7. [FAQ](#faq)

## Should You Migrate?

### Migration Priority Matrix

**High Priority** (Migrate First):
- Tests that frequently fail with cryptic errors
- Tests with extensive manual entity setup (>20 lines)
- Tests for complex action discovery scenarios
- Tests currently broken or flaky

**Medium Priority** (Migrate When Touched):
- Tests that work but are verbose
- Tests with generic assertions
- Tests modified during feature development

**Low Priority** (Optional):
- Simple, stable tests
- Tests with minimal setup
- Tests that rarely fail

### Benefits of Migration

**Before Migration:**
```javascript
// 32 lines of setup code
const entityManager = new SimpleEntityManager();
const actor = entityManager.createEntity('actor1');
entityManager.addComponent('actor1', 'core:name', { name: 'Alice' });
// ... 28 more lines ...

const actions = service.discoverActionsForActor(actor);
expect(actions.some(a => a.id === 'test:action')).toBe(true);
// Fails with: "Expected true but got false" 😞
```

**After Migration:**
```javascript
// 8 lines total
const { actor, target } = testBed.createActorTargetScenario();

const result = testBed.discoverActionsWithDiagnostics(actor);

expect(result).toHaveActionForTarget('test:action', 'target1');
// Fails with detailed debugging information 😊
```

**Improvements:**
- ✅ 75% less code
- ✅ Automatic entity validation
- ✅ Detailed error messages
- ✅ Diagnostic capabilities

## Migration Strategy

### Recommended Approach

1. **Don't migrate all at once** - Gradual adoption is fine
2. **Start with failing tests** - Get immediate benefit
3. **Use new patterns for new tests** - Prevent future tech debt
4. **Backward compatible** - Old tests continue to work

### Coexistence

Old and new patterns can coexist:

```javascript
describe('My Tests', () => {
  it('old test (not migrated)', () => {
    // Old pattern still works
    const entityManager = new SimpleEntityManager();
    // ...
  });

  it('new test (migrated)', () => {
    // New pattern
    const { actor, target } = testBed.createActorTargetScenario();
    // ...
  });
});
```

## Step-by-Step Migration

### Step 1: Update Imports

**Before:**
```javascript
import { createMockEntityManager } from '../../common/entityManager.js';
import { SimpleEntityManager } from '../../../src/entities/simpleEntityManager.js';
```

**After:**
```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js'; // Auto-extends Jest
```

### Step 2: Setup Test Bed

**Before:**
```javascript
describe('Action Discovery', () => {
  let entityManager;
  let service;

  beforeEach(() => {
    entityManager = new SimpleEntityManager();
    service = createActionDiscoveryService(entityManager);
  });
});
```

**After:**
```javascript
describe('Action Discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });
});
```

### Step 3: Replace Entity Creation

**Before:**
```javascript
// Manual entity creation (15+ lines)
const actor = entityManager.createEntity('actor1');
entityManager.addComponent('actor1', 'core:name', { name: 'Alice' });
entityManager.addComponent('actor1', 'core:position', { locationId: 'tavern' });
entityManager.addComponent('actor1', 'positioning:standing', {});

const target = entityManager.createEntity('target1');
entityManager.addComponent('target1', 'core:name', { name: 'Bob' });
entityManager.addComponent('target1', 'core:position', { locationId: 'tavern' });

// Manual closeness establishment
const actorCloseness = { partners: ['target1'] };
entityManager.addComponent('actor1', 'positioning:closeness', actorCloseness);
const targetCloseness = { partners: ['actor1'] };
entityManager.addComponent('target1', 'positioning:closeness', targetCloseness);
```

**After:**
```javascript
// One-line scenario setup
const { actor, target } = testBed.createActorTargetScenario({
  actorComponents: {
    'core:name': { name: 'Alice' },
    'positioning:standing': {},
  },
  targetComponents: {
    'core:name': { name: 'Bob' },
  },
  location: 'tavern',
  closeProximity: true,
});
```

**Benefits:**
- ✅ 75% less code
- ✅ Automatic validation
- ✅ Bidirectional relationships established correctly
- ✅ Clear intent

### Step 4: Replace Assertions

**Before:**
```javascript
const actions = service.discoverActionsForActor(actor);
expect(actions.some(a => a.id === 'test:action')).toBe(true);

// Fails with:
// "Expected true but got false"
```

**After:**
```javascript
const result = testBed.discoverActionsWithDiagnostics(actor);
expect(result).toHaveActionForTarget('test:action', 'target1');

// Fails with:
// Expected to find action 'test:action' with target 'target1'
//
// ❌ Action 'test:action' was NOT discovered
//
// Actions discovered: 2
//   1. positioning:turn_around → target1
//   2. positioning:kneel_before → target1
//
// Possible reasons:
//   1. ComponentFilteringStage: Actor missing required components
//   2. MultiTargetResolutionStage: Scope returned no targets
//   ...
```

**Benefits:**
- ✅ Clear failure reasons
- ✅ Lists what was discovered
- ✅ Suggests debugging steps
- ✅ Pipeline-aware diagnostics

### Step 5: Add Diagnostics (Optional)

**For Complex Tests:**
```javascript
const result = testBed.discoverActionsWithDiagnostics(actor, {
  includeDiagnostics: true,
  traceScopeResolution: true,
});

expect(result).toHaveActionForTarget('test:action', 'target1');

// Debug if needed
if (result.actions.length === 0) {
  console.log(testBed.formatDiagnosticSummary(result.diagnostics));
}
```

## Complete Examples

### Example 1: Basic Action Discovery

**Before (42 lines):**
```javascript
describe('Place Hands on Shoulders Action', () => {
  let entityManager;
  let service;

  beforeEach(() => {
    entityManager = new SimpleEntityManager();
    // ... setup service ...
  });

  it('should discover action when actors are close and facing', () => {
    // Create actor
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent('actor1', 'core:name', { name: 'Alice' });
    entityManager.addComponent('actor1', 'core:position', { locationId: 'tavern' });
    entityManager.addComponent('actor1', 'positioning:standing', {});
    entityManager.addComponent('actor1', 'positioning:facing', {
      direction: 'toward',
      entityId: 'target1',
    });

    // Create target
    const target = entityManager.createEntity('target1');
    entityManager.addComponent('target1', 'core:name', { name: 'Bob' });
    entityManager.addComponent('target1', 'core:position', { locationId: 'tavern' });
    entityManager.addComponent('target1', 'positioning:standing', {});
    entityManager.addComponent('target1', 'positioning:facing', {
      direction: 'toward',
      entityId: 'actor1',
    });

    // Establish closeness
    const actorCloseness = { partners: ['target1'] };
    entityManager.addComponent('actor1', 'positioning:closeness', actorCloseness);
    const targetCloseness = { partners: ['actor1'] };
    entityManager.addComponent('target1', 'positioning:closeness', targetCloseness);

    // Test
    const actions = service.discoverActionsForActor(actor);
    const found = actions.some(a =>
      a.id === 'affection:place_hands_on_shoulders' &&
      a.target === 'target1'
    );

    expect(found).toBe(true);
  });
});
```

**After (15 lines):**
```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js';

describe('Place Hands on Shoulders Action', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('should discover action when actors are close and facing', () => {
    const { actor, target } = testBed.createActorTargetScenario({
      actorComponents: {
        'positioning:facing': { direction: 'toward', entityId: 'target1' },
      },
      targetComponents: {
        'positioning:facing': { direction: 'toward', entityId: 'actor1' },
      },
    });

    const result = testBed.discoverActionsWithDiagnostics(actor);

    expect(result).toHaveActionForTarget('affection:place_hands_on_shoulders', 'target1');
  });
});
```

**Improvements:**
- 64% code reduction (42 → 15 lines)
- Automatic validation
- Better error messages
- Clearer intent

[Continue with more examples...]

## Common Patterns

### Pattern 1: Multiple Targets

**Before:**
```javascript
// Create multiple targets manually
const target1 = entityManager.createEntity('target1');
// ... 10 lines of setup ...
const target2 = entityManager.createEntity('target2');
// ... 10 more lines of setup ...
// ... establish closeness for both ...
```

**After:**
```javascript
// Create first scenario
const { actor, target: target1 } = testBed.createActorTargetScenario({
  targetId: 'target1',
});

// Create second target
const target2 = testBed.createActorWithValidation('target2', {
  location: 'test-location',
});

testBed.establishClosenessWithValidation(actor, target2);
```

### Pattern 2: Kneeling Scenario

**Before:**
```javascript
// Manual kneeling setup (error-prone)
const actor = entityManager.createEntity('actor1');
// ...
entityManager.addComponent('actor1', 'positioning:kneeling_before', {
  entityId: target, // BUG: should be target.id
});
// Bug not caught until action discovery fails
```

**After:**
```javascript
// Automatic validation catches bugs
const { actor, target } = testBed.createActorTargetScenario({
  actorComponents: {
    'positioning:kneeling_before': { entityId: 'target1' },
  },
});
// ✅ Validation would catch: entityId: target (if we made that mistake)
```

[Continue with more patterns...]

## Troubleshooting Migration

### Issue 1: Test Bed Not Found

**Error:**
```
Cannot find module '../../common/actions/actionDiscoveryServiceTestBed.js'
```

**Solution:**
Verify correct path from your test file:
```javascript
// From /tests/integration/mods/affection/
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';

// From /tests/integration/actions/
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
```

### Issue 2: Custom Matchers Not Working

**Error:**
```
expect(...).toHaveActionForTarget is not a function
```

**Solution:**
Import action matchers:
```javascript
import '../../common/actionMatchers.js'; // Must be relative to your test file
```

### Issue 3: Entity Validation Fails

**Error:**
```
❌ ENTITY DOUBLE-NESTING DETECTED!
entity.id should be STRING but is object
```

**Solution:**
This is actually catching a bug! Check where you're passing entities:
```javascript
// ❌ Wrong
testBed.establishClosenessWithValidation(actorEntity, targetEntity);

// ✅ Correct
testBed.establishClosenessWithValidation(actorEntity.id, targetEntity.id);
// OR (entities are acceptable too)
testBed.establishClosenessWithValidation(actorEntity, targetEntity); // method handles this
```

[Continue with more issues...]

## FAQ

### Q: Do I need to migrate all tests at once?

**A:** No! Old and new patterns can coexist. Migrate gradually, starting with tests that would benefit most.

### Q: What if I encounter a scenario the test bed doesn't support?

**A:** Test bed methods are helpers, not requirements. You can still use manual setup when needed, but with validation:

```javascript
const actor = new ModEntityBuilder('actor1')
  .withComponent(...)
  .validate() // Add validation even for manual setup
  .build();
```

### Q: Will migration break existing tests?

**A:** No. Old patterns continue to work. Only migrate tests you want to improve.

### Q: Should I use diagnostics in all tests?

**A:** No. Use diagnostics when:
- Test is complex or frequently fails
- You're debugging action discovery issues
- You want to understand pipeline behavior

For simple, stable tests, basic discovery is sufficient.

### Q: How do I handle custom entity configurations not supported by scenarios?

**A:** Use `createActorWithValidation()` for custom setups:

```javascript
const actor = testBed.createActorWithValidation('actor1', {
  components: {
    // Any custom components
    'mod:custom_component': { customData: 'value' },
  },
});
```

[Continue with more FAQs...]
```

## Testing Requirements

This ticket focuses on documentation, but examples should be verified:

### Example Validation
- All code examples should be runnable
- Before/after comparisons should be accurate
- Migration steps should be tested
- Common pitfalls should be based on real issues

## Implementation Steps

1. **Create Document Structure**
   - Create `/docs/testing/action-integration-test-migration.md`
   - Add table of contents
   - Create section structure

2. **Write Migration Strategy**
   - Decision matrix for migration priority
   - Gradual adoption approach
   - Coexistence strategy

3. **Create Step-by-Step Guide**
   - Import updates
   - Test bed setup
   - Entity creation replacement
   - Assertion replacement
   - Diagnostic addition

4. **Write Complete Examples**
   - Before/after for basic discovery
   - Before/after for complex scenarios
   - Show code reduction metrics
   - Highlight benefits

5. **Document Common Patterns**
   - Multiple targets
   - Kneeling scenarios
   - Custom components
   - Diagnostic debugging

6. **Write Troubleshooting Section**
   - Common migration errors
   - Solutions and workarounds
   - When to use fallback patterns

7. **Create FAQ**
   - Address common concerns
   - Provide migration guidance
   - Explain design decisions

8. **Review and Polish**
   - Verify all examples work
   - Check for clarity
   - Add cross-references to usage doc

## Success Metrics

- **Clarity**: Migration steps are easy to follow
- **Completeness**: Covers all common migration scenarios
- **Usefulness**: Developers can migrate tests successfully
- **Adoption**: Developers reference guide during migration

## Related Tickets

- **Documents Migration For**: All implementation tickets (INTTESDEB-001 through INTTESDEB-006)
- **Complements**: INTTESDEB-007 (Usage documentation)
- **Referenced By**: INTTESDEB-009 (Project docs)
- **Supports**: INTTESDEB-010 (Optional test migration)

## References

- Spec: `/specs/integration-test-debugging-improvements-revised.spec.md` (lines 1016-1041)
- Spec Example: Lines 1102-1240 (before/after comparison)
- All implementation tickets for feature references
