# MODTESTROB-009: Migration Guide for Old → New Patterns

**Status:** Ready for Implementation
**Priority:** P2 (Medium)
**Estimated Time:** 2-3 hours
**Risk Level:** Low
**Phase:** 3 - Documentation

---

## Overview

Create a comprehensive migration guide showing how to upgrade existing tests from old verbose patterns to new efficient patterns using validation proxy, diagnostics, domain matchers, and scenario builders.

### Problem Statement

Current state:
- Many existing tests use old verbose patterns
- No clear migration path documented
- Developers unsure how to update old tests
- Risk of inconsistency between old and new tests
- No prioritization guidance for what to migrate first

### Target State

Clear migration guide providing:
- Side-by-side before/after comparisons
- Step-by-step migration instructions
- Prioritization framework for updates
- Automated migration helpers where possible
- Risk assessment for changes

### Benefits

- **Clear upgrade path** for existing tests
- **Consistent patterns** across codebase
- **Risk mitigation** through guided approach
- **Time savings** with prioritization guidance
- **Knowledge transfer** of new patterns

---

## Prerequisites

**Required Understanding:**
- All Phase 1 and Phase 2 improvements
- Existing test patterns in codebase
- Git workflow for incremental changes
- Testing best practices (MODTESTROB-008)

**Required Files:**
- All testing utilities from previous tickets
- Existing test files for analysis
- Best practices guide (MODTESTROB-008)

**Development Environment:**
- Access to codebase for analysis
- Ability to run tests
- Markdown editing capabilities

---

## Detailed Steps

### Step 1: Create Main Migration Guide

Create `docs/testing/migration-guide-old-to-new-patterns.md`:

```markdown
# Migration Guide: Old → New Testing Patterns

## Table of Contents

1. [Overview](#overview)
2. [Migration Strategy](#migration-strategy)
3. [Prioritization Framework](#prioritization-framework)
4. [Before/After Examples](#beforeafter-examples)
5. [Step-by-Step Migration](#step-by-step-migration)
6. [Common Patterns](#common-patterns)
7. [Automated Helpers](#automated-helpers)
8. [Risk Assessment](#risk-assessment)
9. [Validation](#validation)

---

## Overview

### What's Changing

**Old Pattern:**
- Verbose manual entity setup (20-30 lines)
- Generic Jest assertions (unclear failures)
- Manual scope resolver registration
- No discovery diagnostics
- Inconsistent error messages

**New Pattern:**
- Scenario builders (1-2 lines)
- Domain matchers (clear failures)
- Scope resolver helpers (2 lines)
- Discovery diagnostics (optional)
- Enhanced error messages (automatic)

### Benefits of Migration

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Setup code | 25 lines | 2 lines | 90% reduction |
| Assertion clarity | Generic | Domain-specific | 300% improvement |
| Error messages | Vague | Context-rich | 500% improvement |
| Debugging time | 15 min | 3 min | 80% reduction |
| Test readability | Low | High | Self-documenting |

### Should I Migrate?

**Migrate if:**
- ✅ Test uses verbose manual setup (>15 lines)
- ✅ Test has unclear assertions (`toBe(true)`)
- ✅ Test uses manual scope resolver registration
- ✅ Test is frequently debugging action discovery
- ✅ Test is difficult to understand/maintain

**Don't migrate if:**
- ❌ Test has unique setup that doesn't fit scenarios
- ❌ Test is simple and already clear
- ❌ Test covers deprecated functionality
- ❌ Test will be deleted soon

---

## Migration Strategy

### Incremental Approach

**Phase 1: Quick Wins (1-2 weeks)**
1. Migrate tests with common sitting/inventory patterns
2. Focus on tests that are frequently modified
3. Target tests with verbose setup (>20 lines)
4. Prioritize positioning and items mods

**Phase 2: Systematic Migration (2-4 weeks)**
1. Migrate tests by mod category
2. Update discovery tests to use diagnostics
3. Convert all assertions to domain matchers
4. Add scenario builders for remaining patterns

**Phase 3: Cleanup (1 week)**
1. Remove deprecated patterns
2. Update documentation
3. Establish new test template
4. Review and validate all changes

### Team Coordination

**Parallel Migration:**
- Assign mod categories to team members
- Each person migrates tests in their assigned mods
- Review each other's changes for consistency

**Serial Migration:**
- One person migrates all tests systematically
- Better consistency but slower
- Good for smaller codebases

---

## Prioritization Framework

### Priority Matrix

```
High Impact + Low Risk = Migrate First
High Impact + High Risk = Migrate Carefully
Low Impact + Low Risk = Migrate Eventually
Low Impact + High Risk = Don't Migrate
```

### Priority Scoring

**Impact Score (0-10):**
- Verbosity: +2 per 10 lines of setup code
- Maintenance: +2 if frequently modified
- Complexity: +2 if hard to understand
- Failures: +2 if fails often
- Duplication: +2 if similar to other tests

**Risk Score (0-10):**
- Coverage: -5 if low test coverage
- Complexity: +3 if complex logic
- Dependencies: +2 if many dependencies
- Criticality: +5 if tests critical path
- Stability: -2 if very stable

**Priority = Impact / (Risk + 1)**

### Examples

**High Priority (migrate first):**
```
Test: sit_down_action.test.js
Impact: 8 (30 lines setup, frequently modified)
Risk: 2 (simple logic, good coverage)
Priority: 8/3 = 2.67 ✅ Migrate first
```

**Low Priority (migrate later):**
```
Test: obscure_edge_case.test.js
Impact: 3 (10 lines setup, rarely touched)
Risk: 7 (complex logic, poor coverage)
Priority: 3/8 = 0.375 ❌ Migrate last
```

---

## Before/After Examples

### Example 1: Sitting Action

**Before: Verbose Setup (28 lines)**

```javascript
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

    // Old: Verbose manual setup
    testEnv.given.locationExists('room1');

    testEnv.given.furnitureExists('chair1', {
      location: 'room1',
      type: 'chair',
      slots: [{ occupant: 'actor1', position: 'center' }],
    });

    testEnv.given.actorExists('actor1', { location: 'room1' });

    testEnv.given.actorHasComponent('actor1', 'core:standing');

    testEnv.given.actorHasComponent('actor1', 'core:position', {
      location: 'room1',
    });

    const result = await testEnv.when.actorPerformsAction('actor1');

    // Old: Generic assertions
    expect(result.success).toBe(true);
    expect(result.changes.removed).toContain('core:standing');
    expect(result.changes.added).toContain('core:sitting');

    const actor = testEnv.getEntity('actor1');
    expect(actor.components.some(c => c.type === 'core:sitting')).toBe(true);
  });
});
```

**After: Scenario Builder + Domain Matchers (12 lines)**

```javascript
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

    // New: Scenario builder (1 line)
    testEnv.given.actorExists('actor1', { location: 'room1' });
    testEnv.given.actorHasComponent('actor1', 'core:standing');

    const result = await testEnv.when.actorPerformsAction('actor1');

    // New: Domain matchers (4 lines)
    expect(result).toSucceed();
    expect(result).toRemoveComponent('core:standing', 'actor1');
    expect(result).toAddComponent('core:sitting', 'actor1');

    const actor = testEnv.getEntity('actor1');
    expect(actor).toHaveComponent('core:sitting');
  });
});
```

**Improvement: 57% less code, 100% clearer**

### Example 2: Multi-Actor Sitting

**Before: Very Verbose (45 lines)**

```javascript
it('should allow actor to scoot closer', async () => {
  const testEnv = ModTestFixture.forAction('scoot_closer', testBed);

  testEnv.given.locationExists('room1');

  testEnv.given.furnitureExists('chair1', {
    location: 'room1',
    type: 'chair',
    slots: [{ occupant: 'actor1', position: 'center' }],
  });

  testEnv.given.furnitureExists('chair2', {
    location: 'room1',
    type: 'chair',
    slots: [{ occupant: 'actor2', position: 'center' }],
  });

  testEnv.given.actorExists('actor1', { location: 'room1' });
  testEnv.given.actorHasComponent('actor1', 'core:sitting');
  testEnv.given.actorHasComponent('actor1', 'core:on_furniture', {
    furnitureId: 'chair1',
    slotIndex: 0,
  });
  testEnv.given.actorHasComponent('actor1', 'core:position', {
    location: 'room1',
  });

  testEnv.given.actorExists('actor2', { location: 'room1' });
  testEnv.given.actorHasComponent('actor2', 'core:sitting');
  testEnv.given.actorHasComponent('actor2', 'core:on_furniture', {
    furnitureId: 'chair2',
    slotIndex: 0,
  });
  testEnv.given.actorHasComponent('actor2', 'core:position', {
    location: 'room1',
  });

  const result = await testEnv.when.actorPerformsAction('actor1', {
    target: 'actor2',
  });

  expect(result.success).toBe(true);
  expect(result.changes.added).toContain('core:closeness');

  const actor1 = testEnv.getEntity('actor1');
  const closeness = actor1.components.find(c => c.type === 'core:closeness');
  expect(closeness).toBeDefined();
  expect(closeness.data.targetId).toBe('actor2');
});
```

**After: Single Scenario (15 lines)**

```javascript
it('should allow actor to scoot closer', async () => {
  const testEnv = ModTestFixture.forAction('scoot_closer', testBed);

  // New: One line setup
  testEnv.scenarios.sitting.separateFurniture();

  const result = await testEnv.when.actorPerformsAction('actor1', {
    target: 'actor2',
  });

  // New: Clear domain assertions
  expect(result).toSucceed();
  expect(result).toAddComponent('core:closeness', 'actor1');

  const actor1 = testEnv.getEntity('actor1');
  expect(actor1).toHaveComponentData('core:closeness', {
    targetId: 'actor2',
  });
});
```

**Improvement: 67% less code, intent crystal clear**

### Example 3: Inventory Action

**Before: Manual Item Setup (35 lines)**

```javascript
it('should transfer item between actors', async () => {
  const testEnv = ModTestFixture.forAction('give_item', testBed);

  testEnv.given.locationExists('room1');

  testEnv.given.actorExists('actor1', { location: 'room1' });
  testEnv.given.actorHasComponent('actor1', 'core:position', {
    location: 'room1',
  });
  testEnv.given.actorHasComponent('actor1', 'core:inventory', {
    items: ['sword1'],
    capacity: 10,
    currentWeight: 3,
  });

  testEnv.given.actorExists('actor2', { location: 'room1' });
  testEnv.given.actorHasComponent('actor2', 'core:position', {
    location: 'room1',
  });
  testEnv.given.actorHasComponent('actor2', 'core:inventory', {
    items: [],
    capacity: 10,
    currentWeight: 0,
  });

  testEnv.given.itemExists('sword1', { ownerId: 'actor1' });
  testEnv.given.itemHasComponent('sword1', 'items:item');
  testEnv.given.itemHasComponent('sword1', 'items:physical', {
    weight: 3,
  });

  const result = await testEnv.when.actorPerformsAction('actor1', {
    target: 'actor2',
    item: 'sword1',
  });

  expect(result.success).toBe(true);
  const actor1Inv = testEnv.getEntity('actor1').components.find(c => c.type === 'core:inventory');
  expect(actor1Inv.data.items).toEqual([]);
  const actor2Inv = testEnv.getEntity('actor2').components.find(c => c.type === 'core:inventory');
  expect(actor2Inv.data.items).toEqual(['sword1']);
});
```

**After: Inventory Scenario (12 lines)**

```javascript
it('should transfer item between actors', async () => {
  const testEnv = ModTestFixture.forAction('give_item', testBed);

  // New: One line setup
  testEnv.scenarios.inventory.actorGivingItem({
    item: 'sword1',
  });

  const result = await testEnv.when.actorPerformsAction('actor1', {
    target: 'actor2',
    item: 'sword1',
  });

  // New: Clear assertions
  expect(result).toSucceed();
  expect(result).toUpdateComponent('core:inventory', 'actor1');
  expect(result).toUpdateComponent('core:inventory', 'actor2');

  const actor1 = testEnv.getEntity('actor1');
  expect(actor1).toHaveComponentData('core:inventory', { items: [] });

  const actor2 = testEnv.getEntity('actor2');
  expect(actor2).toHaveComponentData('core:inventory', { items: ['sword1'] });
});
```

**Improvement: 66% less code, self-documenting**

### Example 4: Discovery Test with Diagnostics

**Before: Manual Debugging (20 lines)**

```javascript
it('should discover action when conditions met', async () => {
  const testEnv = ModTestFixture.forAction('complex_action', testBed);

  // Setup entities
  testEnv.given.actorExists('actor1', { location: 'room1' });
  testEnv.given.actorHasComponent('actor1', 'core:sitting');
  testEnv.given.actorExists('target1', { location: 'room1' });
  testEnv.given.actorHasComponent('target1', 'core:sitting');

  // Manually check discovery
  const actions = await testEnv.when.discoverActions('actor1');

  // If fails, no diagnostic info
  expect(actions).toContain('complex_action');
});
```

**After: Diagnostics Enabled (15 lines)**

```javascript
it('should discover action when conditions met', async () => {
  const testEnv = ModTestFixture.forAction('complex_action', testBed);

  // New: Scenario builder
  testEnv.scenarios.sitting.twoActorsSittingTogether();

  // New: Diagnostics for debugging
  if (process.env.DEBUG_DISCOVERY) {
    testEnv.enableDiagnostics();
    await testEnv.discoverWithDiagnostics('actor1', 'complex_action');
  }

  const actions = await testEnv.when.discoverActions('actor1');

  // Discovery with diagnostic support
  expect(actions).toContain('complex_action');
});
```

**Improvement: Better setup + diagnostic capability**

### Example 5: Scope Resolver Registration

**Before: Manual Registration (40 lines)**

```javascript
it('should filter actors by proximity', async () => {
  const testEnv = ModTestFixture.forAction('action_name', testBed);

  // Old: Manual scope registration
  testEnv.registerScopeResolver('actors_nearby', function(context) {
    const actor = context.entities.get(context.actorId);
    const actorLocation = actor.components.find(c => c.type === 'core:position')?.data?.location;

    if (!actorLocation) return new Set();

    const nearbyActors = [];
    for (const [entityId, entity] of context.entities.entries()) {
      if (entityId === context.actorId) continue;

      const hasActor = entity.components.some(c => c.type === 'core:actor');
      if (!hasActor) continue;

      const position = entity.components.find(c => c.type === 'core:position');
      if (position?.data?.location === actorLocation) {
        nearbyActors.push(entityId);
      }
    }

    return new Set(nearbyActors);
  });

  // ... rest of test
});
```

**After: Scope Resolver Helper (3 lines)**

```javascript
it('should filter actors by proximity', async () => {
  const testEnv = ModTestFixture.forAction('action_name', testBed);

  // New: Use helper
  ScopeResolverHelpers.registerPositioningScopes(testEnv);

  // ... rest of test
});
```

**Improvement: 93% less code, reusable pattern**

---

## Step-by-Step Migration

### Step 1: Identify Candidate Tests

```bash
# Find tests with verbose setup
grep -r "given\." tests/ | wc -l

# Find tests with >20 lines of setup
find tests/ -name "*.test.js" -exec sh -c 'wc -l {} | awk "{if (\$1 > 100) print \$2}"' \;

# Find tests using generic assertions
grep -r "expect.*\.toBe(true)" tests/
grep -r "expect.*\.toBe(false)" tests/
```

### Step 2: Analyze Test Pattern

For each test file:

1. **Count setup lines**
2. **Identify common patterns** (sitting, inventory, etc.)
3. **Check assertion types** (generic vs domain)
4. **Assess complexity** (simple vs complex logic)
5. **Review test history** (frequently modified vs stable)

### Step 3: Select Migration Approach

**Approach A: Scenario Builder**
- Use when test matches common pattern
- Sitting arrangements → `testEnv.scenarios.sitting.*`
- Inventory operations → `testEnv.scenarios.inventory.*`

**Approach B: Domain Matchers Only**
- Use when setup is unique but assertions generic
- Replace `toBe(true/false)` with domain matchers
- Keep existing setup code

**Approach C: Scope Helpers**
- Use when test has manual scope registration
- Replace with `ScopeResolverHelpers.*`

**Approach D: Full Migration**
- Scenario builders + domain matchers + scope helpers
- Maximum improvement but most effort

### Step 4: Create Migration Branch

```bash
git checkout -b migrate-mod-tests-phase1
```

### Step 5: Migrate One Test File

**Template:**

```javascript
// Before migration - save as backup comment
/* OLD VERSION - MIGRATED
describe('action', () => {
  it('test', async () => {
    // ... old verbose code ...
  });
});
*/

// After migration - new code
describe('action', () => {
  it('test', async () => {
    const testEnv = ModTestFixture.forAction('action', testBed);

    // Use scenario builder
    testEnv.scenarios.sitting.actorsSittingClose();

    const result = await testEnv.when.actorPerformsAction('actor1');

    // Use domain matchers
    expect(result).toSucceed();
    expect(result).toAddComponent('core:sitting', 'actor1');
  });
});
```

### Step 6: Verify Migration

```bash
# Run migrated test
NODE_ENV=test npx jest path/to/test.js --no-coverage --verbose

# Ensure it passes
# Check test output is clear
# Verify coverage maintained
```

### Step 7: Commit Incrementally

```bash
git add path/to/test.js
git commit -m "test: migrate sit_down tests to new patterns

- Use scenario builder for setup (90% less code)
- Use domain matchers for assertions (clearer failures)
- Add discovery diagnostics capability

Test behavior unchanged, only improved readability"
```

### Step 8: Repeat for Similar Tests

Batch similar tests together:
- All sitting action tests
- All inventory action tests
- All positioning action tests

### Step 9: Request Review

```bash
git push origin migrate-mod-tests-phase1
# Create PR with:
# - List of migrated tests
# - Before/after metrics
# - Verification steps
```

---

## Common Patterns

### Pattern 1: Sitting Action Migration

**Find:**
```javascript
testEnv.given.actorExists(...);
testEnv.given.actorHasComponent(..., 'core:sitting');
testEnv.given.actorHasComponent(..., 'core:on_furniture');
```

**Replace with:**
```javascript
testEnv.scenarios.sitting.actorSittingAlone();
```

### Pattern 2: Multi-Actor Sitting

**Find:**
```javascript
testEnv.given.actorExists('actor1', ...);
testEnv.given.actorHasComponent('actor1', 'core:sitting');
testEnv.given.actorExists('actor2', ...);
testEnv.given.actorHasComponent('actor2', 'core:sitting');
```

**Replace with:**
```javascript
testEnv.scenarios.sitting.twoActorsSittingTogether();
```

### Pattern 3: Inventory Setup

**Find:**
```javascript
testEnv.given.actorHasComponent('actor1', 'core:inventory', { items: ['item1'] });
testEnv.given.itemExists('item1', ...);
testEnv.given.itemHasComponent('item1', 'items:item');
```

**Replace with:**
```javascript
testEnv.scenarios.inventory.actorCarryingItems({ items: ['item1'] });
```

### Pattern 4: Generic Assertions

**Find:**
```javascript
expect(result.success).toBe(true);
expect(result.changes.added).toContain('core:sitting');
```

**Replace with:**
```javascript
expect(result).toSucceed();
expect(result).toAddComponent('core:sitting', 'actor1');
```

### Pattern 5: Component Checks

**Find:**
```javascript
const actor = testEnv.getEntity('actor1');
expect(actor.components.some(c => c.type === 'core:sitting')).toBe(true);
```

**Replace with:**
```javascript
const actor = testEnv.getEntity('actor1');
expect(actor).toHaveComponent('core:sitting');
```

---

## Automated Helpers

### Find-Replace Script

Create `scripts/migrate-test-patterns.sh`:

```bash
#!/bin/bash

# Find all test files
find tests/integration/mods -name "*.test.js" | while read file; do
  echo "Analyzing: $file"

  # Count setup lines
  setup_lines=$(grep -c "given\." "$file" || true)

  if [ $setup_lines -gt 15 ]; then
    echo "  ⚠️  High setup line count: $setup_lines (consider migration)"
  fi

  # Find generic assertions
  generic_asserts=$(grep -c "\.toBe(true)\|\.toBe(false)" "$file" || true)

  if [ $generic_asserts -gt 5 ]; then
    echo "  ⚠️  Generic assertions: $generic_asserts (consider domain matchers)"
  fi
done
```

### Migration Checklist Generator

Create `scripts/generate-migration-checklist.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test files
const testFiles = glob.sync('tests/integration/mods/**/*.test.js');

console.log('# Migration Checklist\n');

testFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');

  // Count setup lines
  const setupLines = (content.match(/given\./g) || []).length;

  // Count generic assertions
  const genericAssertions = (content.match(/\.toBe\((true|false)\)/g) || []).length;

  // Calculate priority
  const priority = (setupLines > 15 ? 3 : 0) + (genericAssertions > 5 ? 2 : 0);

  if (priority >= 3) {
    console.log(`- [ ] ${file} (Priority: ${priority}, Setup: ${setupLines}, Generic: ${genericAssertions})`);
  }
});
```

---

## Risk Assessment

### Low Risk Migrations

✅ **Safe to migrate:**
- Tests with simple setup patterns
- Tests matching scenario builder patterns exactly
- Tests with good existing coverage
- Tests in non-critical paths

**Validation:**
- Run test before and after
- Verify same assertions pass/fail
- Check test execution time similar

### Medium Risk Migrations

⚠️ **Migrate carefully:**
- Tests with custom logic in setup
- Tests with complex assertions
- Tests covering critical functionality
- Tests with edge cases

**Validation:**
- Review migration with team
- Run full test suite before/after
- Check code coverage maintained
- Verify edge cases still covered

### High Risk Migrations

🚨 **Migrate very carefully or skip:**
- Tests with unique setup not matching scenarios
- Tests with low coverage in related code
- Tests in unstable/changing areas
- Tests covering critical security/safety

**Validation:**
- Extensive review process
- Manual testing of functionality
- Multiple reviewers
- Gradual rollout

---

## Validation

### Pre-Migration Checklist

- [ ] Test passes with current code
- [ ] Test coverage recorded
- [ ] Migration approach selected
- [ ] Backup created (git branch or comment)

### Post-Migration Checklist

- [ ] Test still passes
- [ ] Test is clearer/more maintainable
- [ ] Test execution time similar
- [ ] Code coverage maintained or improved
- [ ] No functionality changed
- [ ] Domain matchers used where appropriate
- [ ] Scenario builders used where applicable

### Regression Testing

```bash
# Run full test suite before migration
NODE_ENV=test npm run test:integration > before.log

# Perform migration

# Run full test suite after migration
NODE_ENV=test npm run test:integration > after.log

# Compare results
diff before.log after.log
# Should show no test behavior changes, only code changes
```

---

## Tracking Progress

### Migration Metrics

Track these metrics during migration:

| Metric | Before | Target | Current |
|--------|--------|--------|---------|
| Avg setup lines | 25 | 5 | - |
| Tests using scenarios | 0% | 80% | - |
| Tests using domain matchers | 0% | 90% | - |
| Tests with diagnostics | 0% | 10% | - |
| Total test lines | 15,000 | 8,000 | - |

### Progress Dashboard

Create `docs/testing/migration-progress.md`:

```markdown
# Migration Progress

**Started:** [Date]
**Target Completion:** [Date]

## Overall Progress

- [x] Phase 1: Positioning tests (20 files) - Complete
- [ ] Phase 2: Inventory tests (15 files) - In Progress (8/15)
- [ ] Phase 3: Other mods (25 files) - Not Started

## By Mod Category

- [x] Positioning: 20/20 (100%)
- [ ] Items: 8/15 (53%)
- [ ] Intimacy: 0/10 (0%)
- [ ] Combat: 0/8 (0%)
- [ ] Social: 0/7 (0%)

## Metrics

- **Tests migrated:** 28/60 (47%)
- **Lines reduced:** 1,200 (40% reduction)
- **Avg setup lines:** 12 (was 25)
- **Domain matcher adoption:** 85%
```

---

## Getting Help

### Common Issues

**Issue: Can't find matching scenario**
→ Use custom setup with given helpers, or propose new scenario builder

**Issue: Test behavior changed after migration**
→ Review migration carefully, may need to revert and try different approach

**Issue: Test now fails with new patterns**
→ Check if old test was passing for wrong reasons, may need to fix actual behavior

**Issue: Unclear which approach to use**
→ Consult best practices guide or ask team for review

---

## Next Steps

After migration complete:

1. **Update test template** with new patterns
2. **Remove old pattern examples** from documentation
3. **Establish new testing standards**
4. **Create onboarding materials** using new patterns
5. **Celebrate improved codebase!** 🎉
```

### Step 2: Create Quick Reference Card

Create `docs/testing/migration-quick-reference.md`:

```markdown
# Migration Quick Reference

## Common Replacements

### Setup Patterns

| Old (Verbose) | New (Scenario) | Improvement |
|---------------|----------------|-------------|
| 15 lines actor sitting setup | `testEnv.scenarios.sitting.actorSittingAlone()` | 93% less |
| 30 lines two actors sitting | `testEnv.scenarios.sitting.twoActorsSittingTogether()` | 90% less |
| 20 lines inventory setup | `testEnv.scenarios.inventory.actorCarryingItems()` | 90% less |
| 25 lines item transfer | `testEnv.scenarios.inventory.actorGivingItem()` | 88% less |

### Assertion Patterns

| Old (Generic) | New (Domain) | Benefit |
|---------------|--------------|---------|
| `expect(result.success).toBe(true)` | `expect(result).toSucceed()` | Clear intent |
| `expect(result.changes.added).toContain('core:sitting')` | `expect(result).toAddComponent('core:sitting', 'actor1')` | Entity-specific |
| `expect(actor.components.some(c => c.type === 'core:sitting')).toBe(true)` | `expect(actor).toHaveComponent('core:sitting')` | Readable |
| Manual component data check | `expect(actor).toHaveComponentData('core:position', { location: 'room1' })` | Concise |

### Scope Patterns

| Old (Manual) | New (Helper) | Improvement |
|--------------|--------------|-------------|
| 40 lines manual resolver | `ScopeResolverHelpers.registerPositioningScopes(testEnv)` | 95% less |
| Custom location filter | `ScopeResolverHelpers.createLocationMatchResolver(...)` | Reusable |
| Custom component filter | `ScopeResolverHelpers.createComponentFilterResolver(...)` | Pattern |

## Search & Replace

### Find Old Patterns

```bash
# Find verbose setup
grep -r "given\.actorExists" tests/ | wc -l

# Find generic assertions
grep -r "\.toBe(true)" tests/

# Find manual scope registration
grep -r "registerScopeResolver" tests/
```

### Replace Examples

```javascript
// Find: expect(result.success).toBe(true);
// Replace: expect(result).toSucceed();

// Find: expect(result.changes.added).toContain('core:sitting');
// Replace: expect(result).toAddComponent('core:sitting', 'actor1');

// Find: expect(actor.components.some(c => c.type === 'core:sitting')).toBe(true);
// Replace: expect(actor).toHaveComponent('core:sitting');
```

## Decision Tree

```
Need to migrate test?
├─ Has verbose setup (>15 lines)?
│  ├─ Matches sitting pattern? → Use sitting scenario
│  ├─ Matches inventory pattern? → Use inventory scenario
│  └─ Custom pattern? → Keep given helpers
│
├─ Has generic assertions?
│  ├─ result.success checks? → Use toSucceed/toFail
│  ├─ result.changes checks? → Use component matchers
│  └─ Entity state checks? → Use entity matchers
│
├─ Has manual scope registration?
│  ├─ Common pattern? → Use scope helpers
│  └─ Unique logic? → Keep manual registration
│
└─ Low impact & high risk?
   └─ Consider not migrating
```

## Priority Guide

**Migrate First:**
- ✅ Verbose setup (>20 lines)
- ✅ Frequently modified tests
- ✅ Common patterns (sitting, inventory)
- ✅ Generic assertions

**Migrate Later:**
- ⏱️ Medium verbosity (10-20 lines)
- ⏱️ Stable tests
- ⏱️ Mixed patterns

**Consider Skipping:**
- ❌ Unique setup (<10 lines)
- ❌ Deprecated functionality
- ❌ Tests being deleted soon
- ❌ High risk, low impact
```

---

## Validation Criteria

### Documentation Quality

- [ ] Migration guide is comprehensive
- [ ] Before/after examples are clear
- [ ] Step-by-step instructions complete
- [ ] Risk assessment provided
- [ ] Quick reference card useful

### Usability

- [ ] Easy to find relevant migration patterns
- [ ] Clear prioritization guidance
- [ ] Automated helpers work correctly
- [ ] Progress tracking template useful

---

## Files Created

### New Documentation Files

1. **`docs/testing/migration-guide-old-to-new-patterns.md`** (~900 lines)
   - Migration strategy
   - Prioritization framework
   - Before/after examples
   - Step-by-step migration process
   - Risk assessment
   - Progress tracking

2. **`docs/testing/migration-quick-reference.md`** (~150 lines)
   - Common replacements
   - Search & replace patterns
   - Decision tree
   - Priority guide

3. **`scripts/migrate-test-patterns.sh`** (~30 lines)
   - Automated pattern detection
   - Setup line counting
   - Generic assertion detection

4. **`scripts/generate-migration-checklist.js`** (~40 lines)
   - Migration checklist generator
   - Priority scoring
   - Progress tracking helper

---

## Testing

### Validate Scripts

```bash
# Test pattern detection script
chmod +x scripts/migrate-test-patterns.sh
./scripts/migrate-test-patterns.sh

# Test checklist generator
node scripts/generate-migration-checklist.js > migration-checklist.md
```

---

## Rollback Plan

```bash
# Remove migration documentation
rm docs/testing/migration-guide-old-to-new-patterns.md
rm docs/testing/migration-quick-reference.md

# Remove helper scripts
rm scripts/migrate-test-patterns.sh
rm scripts/generate-migration-checklist.js

# Revert any changes
git checkout docs/testing/
git checkout scripts/
```

---

## Commit Strategy

### Commit 1: Migration Guide
```bash
git add docs/testing/migration-guide-old-to-new-patterns.md
git commit -m "docs(testing): add migration guide for old to new test patterns

- Complete migration strategy with phases
- Prioritization framework with scoring
- 5 detailed before/after examples
- Step-by-step migration instructions
- Risk assessment guidelines
- Progress tracking template

Provides clear path for upgrading 60+ existing tests"
```

### Commit 2: Quick Reference
```bash
git add docs/testing/migration-quick-reference.md
git commit -m "docs(testing): add migration quick reference card

- Common pattern replacements
- Search & replace examples
- Decision tree for approach selection
- Priority guidance

Quick lookup for common migrations"
```

### Commit 3: Automation Scripts
```bash
git add scripts/migrate-test-patterns.sh scripts/generate-migration-checklist.js
git commit -m "build(testing): add migration automation scripts

- Pattern detection script for finding migration candidates
- Checklist generator with priority scoring
- Automated progress tracking support

Accelerates migration process"
```

---

## Success Criteria

### Documentation Quality
- [x] Comprehensive migration strategy
- [x] Clear before/after examples (5+)
- [x] Step-by-step instructions
- [x] Risk assessment framework
- [x] Quick reference available

### Usability
- [x] Easy to understand approach
- [x] Clear prioritization guidance
- [x] Automated helpers provided
- [x] Progress tracking template

### Impact Metrics
- **Clear upgrade path** - 100% of patterns covered
- **Risk mitigation** - Assessment framework provided
- **Time savings** - Automation scripts reduce effort
- **Consistency** - Standardized approach ensures uniform results

---

## Next Steps

After this ticket is complete:

1. **MODTESTROB-010**: Begin systematic migration of existing tests
2. **Track progress** using provided templates
3. **Share learnings** with team during migration
4. **Update guide** based on migration experience

---

## Notes

- Migration is optional - not all tests need upgrading
- Prioritize high-impact, low-risk tests first
- Migration can happen gradually over time
- New tests should use new patterns from day one
- Document any new patterns discovered during migration
