# MODTESTROB-010: Update Existing Tests with New Patterns

**Epic**: Mod Testing Robustness Enhancement  
**Priority**: P2 (Documentation & Migration)  
**Estimated Effort**: 8-10 hours  
**Dependencies**: MODTESTROB-005, MODTESTROB-006, MODTESTROB-007, MODTESTROB-009

---

## Overview

### Problem Statement

After implementing domain matchers, scenario builders, and migration guides, we need to systematically update existing test files to use the new patterns. Currently, 60+ test files use verbose old patterns, making them:

- **Harder to maintain**: 20-30 lines of setup code per test
- **Less clear**: Intent obscured by implementation details
- **Inconsistent**: Different setup approaches across files
- **Prone to errors**: Manual setup increases chance of mistakes

### Target Outcome

Migrate existing test files to use new testing patterns, achieving:

- **90% setup code reduction** in positioning tests
- **85% setup code reduction** in inventory tests
- **70% assertion clarity improvement** via domain matchers
- **Zero behavior changes** - only refactoring existing tests
- **100% test pass rate maintained** throughout migration

### Benefits

1. **Improved Maintainability**: Consistent patterns across all test files
2. **Better Readability**: Clear, intent-revealing tests
3. **Reduced Duplication**: Shared scenario builders eliminate repetition
4. **Faster Test Writing**: New tests follow proven patterns
5. **Validated Patterns**: Real-world usage proves pattern effectiveness

---

## Prerequisites

### Required Tickets

- ✅ MODTESTROB-005 (Enhanced Test Assertions)
- ✅ MODTESTROB-006 (Sitting Scenario Builders)
- ✅ MODTESTROB-007 (Inventory Scenario Builders)
- ✅ MODTESTROB-009 (Migration Guide)

### Development Environment

```bash
# Verify test infrastructure
npm run test:unit -- tests/common/mods/domainMatchers.test.js
npm run test:unit -- tests/common/mods/sittingScenarios.test.js
npm run test:unit -- tests/common/mods/inventoryScenarios.test.js

# All should pass
```

### Knowledge Requirements

- Understanding of ModTestFixture pattern
- Familiarity with domain matchers (toSucceed, toAddComponent, etc.)
- Knowledge of scenario builders (sitting, inventory)
- Understanding of test file structure

---

## Detailed Steps

### Step 1: Identify Migration Candidates

**Duration**: 30 minutes

#### 1.1: Generate Migration Candidate List

```bash
# Run detection script from MODTESTROB-009
cd /home/joeloverbeck/projects/living-narrative-engine
chmod +x scripts/migrate-test-patterns.sh
./scripts/migrate-test-patterns.sh > migration-candidates.txt

# Review candidates
cat migration-candidates.txt
```

**Expected Output**:
```
=== Mod Action Test Migration Candidates ===

High Priority (Sitting Actions):
  tests/integration/mods/positioning/sit_down_action.test.js
  tests/integration/mods/positioning/stand_up_action.test.js
  tests/integration/mods/positioning/scoot_closer_action.test.js
  tests/integration/mods/positioning/kneel_before_action.test.js

High Priority (Inventory Actions):
  tests/integration/mods/items/give_item_action.test.js
  tests/integration/mods/items/drop_item_action.test.js
  tests/integration/mods/items/pick_up_item_action.test.js
  tests/integration/mods/items/open_container_action.test.js

Medium Priority (Complex Positioning):
  tests/integration/mods/positioning/turn_around_action.test.js
  tests/integration/mods/positioning/lie_down_action.test.js
  tests/integration/mods/positioning/get_up_from_lying_action.test.js

Medium Priority (Inventory + Containers):
  tests/integration/mods/items/take_from_container_action.test.js
  tests/integration/mods/items/put_in_container_action.test.js

Low Priority (Special Cases):
  tests/integration/mods/positioning/bend_over_action.test.js
  tests/integration/mods/positioning/straddle_waist_action.test.js
```

#### 1.2: Generate Prioritized Checklist

```bash
# Generate migration checklist with impact scoring
node scripts/generate-migration-checklist.js

# Review checklist
cat migration-checklist.md
```

**Expected Output** - `migration-checklist.md`:
```markdown
# Test Migration Prioritization Checklist

## Phase 1: Quick Wins (Priority Score > 5.0)

### sit_down_action.test.js
- **Impact**: 9 (setup reduction: 28 → 4 lines)
- **Risk**: 2 (simple sitting scenario)
- **Priority Score**: 9 / (2 + 1) = 3.0
- **Estimated Time**: 20 minutes
- **Dependencies**: None
- **Pattern**: Use `scenarios.sitting.actorSittingAlone()`

### stand_up_action.test.js
- **Impact**: 9 (setup reduction: 26 → 3 lines)
- **Risk**: 2 (simple standing scenario)
- **Priority Score**: 9 / (2 + 1) = 3.0
- **Estimated Time**: 20 minutes
- **Dependencies**: None
- **Pattern**: Use `scenarios.sitting.actorSittingAlone()` + remove sitting component

[... continues for all files ...]
```

#### 1.3: Select Initial Migration Batch

**Criteria for Batch 1** (targeting 2-3 hours of work):
- High-impact, low-risk files (Priority Score > 5.0)
- Simple scenarios (sitting/inventory only)
- No cross-dependencies
- Good examples for validating patterns

**Selected Files**:
1. `tests/integration/mods/positioning/sit_down_action.test.js`
2. `tests/integration/mods/positioning/stand_up_action.test.js`
3. `tests/integration/mods/items/give_item_action.test.js`
4. `tests/integration/mods/items/drop_item_action.test.js`

**Validation**:
```bash
# Verify all selected files exist and have tests
for file in \
  "tests/integration/mods/positioning/sit_down_action.test.js" \
  "tests/integration/mods/positioning/stand_up_action.test.js" \
  "tests/integration/mods/items/give_item_action.test.js" \
  "tests/integration/mods/items/drop_item_action.test.js"; do
  echo "Checking $file..."
  test -f "$file" && echo "✓ Exists" || echo "✗ Missing"
  grep -c "describe\\|it" "$file" && echo "✓ Has tests"
done
```

---

### Step 2: Migrate Sitting Action Tests

**Duration**: 1.5 hours

#### 2.1: Migrate sit_down_action.test.js

**Current File Analysis**:
```bash
# Count lines in current implementation
wc -l tests/integration/mods/positioning/sit_down_action.test.js

# Identify setup patterns
grep -A 20 "given\." tests/integration/mods/positioning/sit_down_action.test.js | head -30
```

**Before** (typical test - 45 lines):
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('sit_down action - basic sitting scenarios', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should allow standing actor to sit on empty chair', async () => {
    const testEnv = ModTestFixture.forAction('sit_down', testBed);

    // Setup location
    testEnv.given.locationExists('room1');
    
    // Setup furniture
    testEnv.given.furnitureExists('chair1', {
      location: 'room1',
      type: 'chair',
      slots: [{ occupant: null, position: 'center' }],
    });
    
    // Setup actor
    testEnv.given.actorExists('actor1', { location: 'room1' });
    testEnv.given.actorHasComponent('actor1', 'core:standing');
    testEnv.given.actorHasComponent('actor1', 'positioning:spatial_position', {
      x: 5,
      y: 5,
      facing: 'north',
    });

    // Execute action
    const result = await testEnv.when.actorPerformsAction('actor1', {
      furniture: 'chair1',
    });

    // Assertions
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.changes.removed).toContain('core:standing');
    expect(result.changes.added).toContain('core:sitting');
    
    // Verify sitting component
    const sittingComponent = result.entityStates.actor1.components.find(
      (c) => c.id === 'core:sitting'
    );
    expect(sittingComponent).toBeDefined();
    expect(sittingComponent.data.furniture).toBe('chair1');
  });
});
```

**After** (migrated - 18 lines):
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('sit_down action - basic sitting scenarios', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should allow standing actor to sit on empty chair', async () => {
    const testEnv = ModTestFixture.forAction('sit_down', testBed);

    // Use scenario builder for initial state
    testEnv.given.locationExists('room1');
    testEnv.given.furnitureExists('chair1', {
      location: 'room1',
      type: 'chair',
      slots: [{ occupant: null, position: 'center' }],
    });
    testEnv.given.actorExists('actor1', { location: 'room1' });
    testEnv.given.actorHasComponent('actor1', 'core:standing');

    // Execute action
    const result = await testEnv.when.actorPerformsAction('actor1', {
      furniture: 'chair1',
    });

    // Use domain matchers for clear assertions
    expect(result).toSucceed();
    expect(result).toRemoveComponent('core:standing', 'actor1');
    expect(result).toAddComponent('core:sitting', 'actor1');
    expect(result).toHaveComponentData('core:sitting', 'actor1', {
      furniture: 'chair1',
    });
  });
});
```

**Migration Script** - `scripts/migrate-sit-down-test.sh`:
```bash
#!/bin/bash
set -e

FILE="tests/integration/mods/positioning/sit_down_action.test.js"
BACKUP="${FILE}.backup"

echo "Migrating sit_down_action.test.js..."

# Create backup
cp "$FILE" "$BACKUP"
echo "✓ Backup created at $BACKUP"

# Run tests before migration
echo "Running tests before migration..."
NODE_ENV=test npm run test:integration -- "$FILE" --silent
BEFORE_STATUS=$?

if [ $BEFORE_STATUS -ne 0 ]; then
  echo "✗ Tests failing before migration. Fix tests first."
  exit 1
fi
echo "✓ Tests pass before migration"

# Apply migrations (manual for now - pattern too complex for sed)
echo "Apply manual migrations following migration guide..."
echo "  1. Replace verbose setup with scenario builders"
echo "  2. Replace manual assertions with domain matchers"
echo "  3. Simplify component data checks"
echo ""
echo "Press Enter when manual migration complete..."
read

# Run tests after migration
echo "Running tests after migration..."
NODE_ENV=test npm run test:integration -- "$FILE" --silent
AFTER_STATUS=$?

if [ $AFTER_STATUS -ne 0 ]; then
  echo "✗ Tests failing after migration. Review changes."
  echo "Restore backup with: cp $BACKUP $FILE"
  exit 1
fi

echo "✓ Tests pass after migration"

# Compare line counts
BEFORE_LINES=$(wc -l < "$BACKUP")
AFTER_LINES=$(wc -l < "$FILE")
REDUCTION=$((BEFORE_LINES - AFTER_LINES))
PERCENT=$((REDUCTION * 100 / BEFORE_LINES))

echo ""
echo "Migration Summary:"
echo "  Before: $BEFORE_LINES lines"
echo "  After:  $AFTER_LINES lines"
echo "  Reduction: $REDUCTION lines ($PERCENT%)"
echo ""
echo "✓ Migration complete"
```

**Validation Commands**:
```bash
# Run migration script
chmod +x scripts/migrate-sit-down-test.sh
./scripts/migrate-sit-down-test.sh

# Manual verification
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/sit_down_action.test.js --verbose

# Compare before/after
diff tests/integration/mods/positioning/sit_down_action.test.js.backup \
     tests/integration/mods/positioning/sit_down_action.test.js
```

**Expected Metrics**:
- Lines reduced: 45 → 18 (60% reduction)
- Setup clarity: Manual setup → Scenario builder
- Assertion clarity: Manual checks → Domain matchers
- Test pass rate: 100% maintained

---

#### 2.2: Migrate stand_up_action.test.js

**Before** (typical test - 42 lines):
```javascript
describe('stand_up action - basic standing scenarios', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should allow sitting actor to stand up', async () => {
    const testEnv = ModTestFixture.forAction('stand_up', testBed);

    // Setup location
    testEnv.given.locationExists('room1');
    
    // Setup furniture with sitting actor
    testEnv.given.furnitureExists('chair1', {
      location: 'room1',
      type: 'chair',
      slots: [{ occupant: 'actor1', position: 'center' }],
    });
    
    // Setup sitting actor
    testEnv.given.actorExists('actor1', { location: 'room1' });
    testEnv.given.actorHasComponent('actor1', 'core:sitting', {
      furniture: 'chair1',
    });
    testEnv.given.actorHasComponent('actor1', 'positioning:spatial_position', {
      x: 5,
      y: 5,
      facing: 'north',
    });

    // Execute action
    const result = await testEnv.when.actorPerformsAction('actor1');

    // Assertions
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.changes.removed).toContain('core:sitting');
    expect(result.changes.added).toContain('core:standing');
    
    // Verify furniture slot freed
    const furnitureComponent = result.entityStates.chair1.components.find(
      (c) => c.id === 'positioning:furniture'
    );
    expect(furnitureComponent.data.slots[0].occupant).toBeNull();
  });
});
```

**After** (migrated - 16 lines):
```javascript
describe('stand_up action - basic standing scenarios', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should allow sitting actor to stand up', async () => {
    const testEnv = ModTestFixture.forAction('stand_up', testBed);

    // Use scenario builder - actor already sitting
    const { actor1, furniture } = testEnv.scenarios.sitting.actorSittingAlone({
      actor: 'actor1',
      furniture: 'chair1',
      location: 'room1',
    });

    // Execute action
    const result = await testEnv.when.actorPerformsAction(actor1);

    // Use domain matchers
    expect(result).toSucceed();
    expect(result).toRemoveComponent('core:sitting', actor1);
    expect(result).toAddComponent('core:standing', actor1);
    expect(result).toHaveComponentData('positioning:furniture', furniture, {
      slots: [{ occupant: null, position: 'center' }],
    });
  });
});
```

**Migration Steps**:

1. **Identify scenario pattern**: Actor sitting alone on furniture
2. **Replace setup**: Use `scenarios.sitting.actorSittingAlone()`
3. **Replace assertions**: Use domain matchers (toSucceed, toRemoveComponent, toAddComponent)
4. **Verify furniture state**: Use toHaveComponentData for furniture slot check
5. **Test**: Ensure all tests pass with identical behavior

**Validation**:
```bash
# Run stand_up tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/stand_up_action.test.js

# Compare line count
wc -l tests/integration/mods/positioning/stand_up_action.test.js.backup \
      tests/integration/mods/positioning/stand_up_action.test.js
```

**Expected Metrics**:
- Lines reduced: 42 → 16 (62% reduction)
- Scenario builder usage: 1 (actorSittingAlone)
- Domain matcher usage: 4 (toSucceed, toRemoveComponent, toAddComponent, toHaveComponentData)

---

### Step 3: Migrate Inventory Action Tests

**Duration**: 1.5 hours

#### 3.1: Migrate give_item_action.test.js

**Before** (typical test - 48 lines):
```javascript
describe('give_item action - basic giving scenarios', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should allow actor to give item to nearby actor', async () => {
    const testEnv = ModTestFixture.forAction('give_item', testBed);

    // Setup location
    testEnv.given.locationExists('room1');
    
    // Setup giver with item
    testEnv.given.actorExists('actor1', { location: 'room1' });
    testEnv.given.actorHasComponent('actor1', 'core:inventory', {
      items: ['sword1'],
      capacity: 10,
      currentWeight: 3,
    });
    
    // Setup item
    testEnv.given.itemExists('sword1', {
      ownerId: 'actor1',
      location: null,
    });
    testEnv.given.itemHasComponent('sword1', 'items:item');
    testEnv.given.itemHasComponent('sword1', 'items:physical', {
      weight: 3,
    });
    
    // Setup receiver
    testEnv.given.actorExists('actor2', { location: 'room1' });
    testEnv.given.actorHasComponent('actor2', 'core:inventory', {
      items: [],
      capacity: 10,
      currentWeight: 0,
    });

    // Execute action
    const result = await testEnv.when.actorPerformsAction('actor1', {
      item: 'sword1',
      recipient: 'actor2',
    });

    // Assertions
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    
    // Verify giver inventory updated
    const giverInventory = result.entityStates.actor1.components.find(
      (c) => c.id === 'core:inventory'
    );
    expect(giverInventory.data.items).not.toContain('sword1');
    
    // Verify receiver inventory updated
    const receiverInventory = result.entityStates.actor2.components.find(
      (c) => c.id === 'core:inventory'
    );
    expect(receiverInventory.data.items).toContain('sword1');
  });
});
```

**After** (migrated - 20 lines):
```javascript
describe('give_item action - basic giving scenarios', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should allow actor to give item to nearby actor', async () => {
    const testEnv = ModTestFixture.forAction('give_item', testBed);

    // Use scenario builder for actor carrying item
    const { actor: giver, items } = testEnv.scenarios.inventory.actorCarryingItems({
      actor: 'actor1',
      items: ['sword1'],
      location: 'room1',
      totalWeight: 3,
    });
    
    // Setup receiver with empty inventory
    const { actor: receiver } = testEnv.scenarios.inventory.actorWithEmptyInventory({
      actor: 'actor2',
      location: 'room1',
    });

    // Execute action
    const result = await testEnv.when.actorPerformsAction(giver, {
      item: items[0],
      recipient: receiver,
    });

    // Use domain matchers
    expect(result).toSucceed();
    expect(result).toUpdateComponent('core:inventory', giver, {
      items: [], // Item removed from giver
    });
    expect(result).toUpdateComponent('core:inventory', receiver, {
      items: [items[0]], // Item added to receiver
    });
  });
});
```

**Migration Steps**:

1. **Identify scenario patterns**: 
   - Actor carrying items → `scenarios.inventory.actorCarryingItems()`
   - Empty inventory → `scenarios.inventory.actorWithEmptyInventory()`
2. **Replace setup**: Use both scenario builders
3. **Replace assertions**: Use toSucceed and toUpdateComponent
4. **Simplify checks**: Domain matchers handle inventory updates
5. **Test**: Verify behavior unchanged

**Validation**:
```bash
# Run give_item tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/items/give_item_action.test.js

# Verify metrics
echo "Lines Before: $(wc -l < tests/integration/mods/items/give_item_action.test.js.backup)"
echo "Lines After: $(wc -l < tests/integration/mods/items/give_item_action.test.js)"
```

**Expected Metrics**:
- Lines reduced: 48 → 20 (58% reduction)
- Scenario builders used: 2 (actorCarryingItems, actorWithEmptyInventory)
- Domain matchers used: 3 (toSucceed, toUpdateComponent × 2)

---

#### 3.2: Migrate drop_item_action.test.js

**Before** (typical test - 45 lines):
```javascript
describe('drop_item action - basic dropping scenarios', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should allow actor to drop item at current location', async () => {
    const testEnv = ModTestFixture.forAction('drop_item', testBed);

    // Setup location
    testEnv.given.locationExists('room1');
    testEnv.given.locationHasComponent('room1', 'positioning:item_container', {
      items: [],
    });
    
    // Setup actor with item
    testEnv.given.actorExists('actor1', { location: 'room1' });
    testEnv.given.actorHasComponent('actor1', 'core:inventory', {
      items: ['apple1'],
      capacity: 10,
      currentWeight: 1,
    });
    
    // Setup item
    testEnv.given.itemExists('apple1', {
      ownerId: 'actor1',
      location: null,
    });
    testEnv.given.itemHasComponent('apple1', 'items:item');
    testEnv.given.itemHasComponent('apple1', 'items:physical', {
      weight: 1,
    });

    // Execute action
    const result = await testEnv.when.actorPerformsAction('actor1', {
      item: 'apple1',
    });

    // Assertions
    expect(result.success).toBe(true);
    
    // Verify item removed from inventory
    const actorInventory = result.entityStates.actor1.components.find(
      (c) => c.id === 'core:inventory'
    );
    expect(actorInventory.data.items).not.toContain('apple1');
    
    // Verify item now at location
    const locationContainer = result.entityStates.room1.components.find(
      (c) => c.id === 'positioning:item_container'
    );
    expect(locationContainer.data.items).toContain('apple1');
  });
});
```

**After** (migrated - 19 lines):
```javascript
describe('drop_item action - basic dropping scenarios', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should allow actor to drop item at current location', async () => {
    const testEnv = ModTestFixture.forAction('drop_item', testBed);

    // Use scenario builder for actor carrying item
    const { actor, items, location } = testEnv.scenarios.inventory.actorCarryingItems({
      actor: 'actor1',
      items: ['apple1'],
      location: 'room1',
      totalWeight: 1,
    });
    
    // Add item_container to location
    testEnv.given.locationHasComponent(location, 'positioning:item_container', {
      items: [],
    });

    // Execute action
    const result = await testEnv.when.actorPerformsAction(actor, {
      item: items[0],
    });

    // Use domain matchers
    expect(result).toSucceed();
    expect(result).toUpdateComponent('core:inventory', actor, {
      items: [], // Item removed
    });
    expect(result).toUpdateComponent('positioning:item_container', location, {
      items: [items[0]], // Item at location
    });
  });
});
```

**Migration Steps**:

1. **Identify scenario**: Actor carrying items → `scenarios.inventory.actorCarryingItems()`
2. **Replace setup**: Use scenario builder, add item_container manually
3. **Replace assertions**: Use toSucceed and toUpdateComponent
4. **Simplify state checks**: Domain matchers for inventory and location updates
5. **Test**: Ensure dropping behavior preserved

**Validation**:
```bash
# Run drop_item tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/items/drop_item_action.test.js

# Compare metrics
diff tests/integration/mods/items/drop_item_action.test.js.backup \
     tests/integration/mods/items/drop_item_action.test.js | wc -l
```

**Expected Metrics**:
- Lines reduced: 45 → 19 (58% reduction)
- Scenario builders used: 1 (actorCarryingItems)
- Domain matchers used: 3 (toSucceed, toUpdateComponent × 2)

---

### Step 4: Validate Batch 1 Migrations

**Duration**: 30 minutes

#### 4.1: Run Complete Test Suite

```bash
# Run all migrated tests
NODE_ENV=test npm run test:integration -- \
  tests/integration/mods/positioning/sit_down_action.test.js \
  tests/integration/mods/positioning/stand_up_action.test.js \
  tests/integration/mods/items/give_item_action.test.js \
  tests/integration/mods/items/drop_item_action.test.js \
  --verbose

# Should show 100% pass rate
```

**Expected Output**:
```
PASS tests/integration/mods/positioning/sit_down_action.test.js
PASS tests/integration/mods/positioning/stand_up_action.test.js
PASS tests/integration/mods/items/give_item_action.test.js
PASS tests/integration/mods/items/drop_item_action.test.js

Test Suites: 4 passed, 4 total
Tests:       20 passed, 20 total
```

#### 4.2: Verify Behavior Unchanged

```bash
# Compare test results before/after migration
# Run against backup files
NODE_ENV=test npm run test:integration -- \
  tests/integration/mods/positioning/sit_down_action.test.js.backup \
  --silent > before-results.txt

# Run against migrated files
NODE_ENV=test npm run test:integration -- \
  tests/integration/mods/positioning/sit_down_action.test.js \
  --silent > after-results.txt

# Compare (should be identical except line numbers)
diff before-results.txt after-results.txt
```

**Validation Checklist**:
- ✅ All tests pass
- ✅ Same number of test cases
- ✅ Same test descriptions
- ✅ Same assertions (different syntax, same behavior)
- ✅ No new test failures
- ✅ No skipped tests
- ✅ Coverage maintained or improved

#### 4.3: Measure Impact

**Metrics Collection** - `scripts/measure-migration-impact.sh`:
```bash
#!/bin/bash
set -e

echo "=== Migration Impact Metrics ==="
echo ""

MIGRATED_FILES=(
  "tests/integration/mods/positioning/sit_down_action.test.js"
  "tests/integration/mods/positioning/stand_up_action.test.js"
  "tests/integration/mods/items/give_item_action.test.js"
  "tests/integration/mods/items/drop_item_action.test.js"
)

total_before=0
total_after=0

for file in "${MIGRATED_FILES[@]}"; do
  backup="${file}.backup"
  
  if [ ! -f "$backup" ]; then
    echo "⚠️  Backup not found: $backup"
    continue
  fi
  
  before=$(wc -l < "$backup")
  after=$(wc -l < "$file")
  reduction=$((before - after))
  percent=$((reduction * 100 / before))
  
  total_before=$((total_before + before))
  total_after=$((total_after + after))
  
  echo "$(basename $file):"
  echo "  Before: $before lines"
  echo "  After:  $after lines"
  echo "  Reduction: $reduction lines ($percent%)"
  echo ""
done

total_reduction=$((total_before - total_after))
total_percent=$((total_reduction * 100 / total_before))

echo "=== Totals ==="
echo "Total Before: $total_before lines"
echo "Total After:  $total_after lines"
echo "Total Reduction: $total_reduction lines ($total_percent%)"
echo ""

# Count pattern usage
echo "=== Pattern Usage ==="
echo "Domain Matchers:"
grep -rh "toSucceed\|toFail\|toAddComponent\|toRemoveComponent\|toUpdateComponent" \
  "${MIGRATED_FILES[@]}" | wc -l

echo "Scenario Builders (sitting):"
grep -rh "scenarios.sitting" "${MIGRATED_FILES[@]}" | wc -l

echo "Scenario Builders (inventory):"
grep -rh "scenarios.inventory" "${MIGRATED_FILES[@]}" | wc -l
```

**Run Impact Measurement**:
```bash
chmod +x scripts/measure-migration-impact.sh
./scripts/measure-migration-impact.sh
```

**Expected Output**:
```
=== Migration Impact Metrics ===

sit_down_action.test.js:
  Before: 45 lines
  After:  18 lines
  Reduction: 27 lines (60%)

stand_up_action.test.js:
  Before: 42 lines
  After:  16 lines
  Reduction: 26 lines (62%)

give_item_action.test.js:
  Before: 48 lines
  After:  20 lines
  Reduction: 28 lines (58%)

drop_item_action.test.js:
  Before: 45 lines
  After:  19 lines
  Reduction: 26 lines (58%)

=== Totals ===
Total Before: 180 lines
Total After:  73 lines
Total Reduction: 107 lines (59%)

=== Pattern Usage ===
Domain Matchers: 12
Scenario Builders (sitting): 2
Scenario Builders (inventory): 3
```

---

### Step 5: Create Migration Progress Tracker

**Duration**: 30 minutes

#### 5.1: Initialize Progress Tracking Document

**File**: `docs/testing/migration-progress.md`

```markdown
# Test Migration Progress Tracker

**Last Updated**: 2024-01-15  
**Total Files**: 60  
**Migrated**: 4 (7%)  
**In Progress**: 0  
**Remaining**: 56 (93%)

---

## Migration Metrics

### Overall Progress

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Lines | 180 | 73 | -107 (-59%) |
| Avg Lines/Test | 45 | 18 | -27 (-60%) |
| Setup Clarity | Manual | Scenarios | +85% |
| Assertion Clarity | Manual | Matchers | +70% |

### Pattern Adoption

| Pattern | Usage Count | Adoption Rate |
|---------|-------------|---------------|
| Domain Matchers | 12 | 100% (4/4 files) |
| Sitting Scenarios | 2 | 50% (2/4 files) |
| Inventory Scenarios | 3 | 50% (2/4 files) |

---

## Migration Batches

### ✅ Batch 1: Quick Wins (Completed)

**Status**: Complete  
**Duration**: 3 hours  
**Risk**: Low  
**Impact**: High

| File | Status | Lines Before | Lines After | Reduction |
|------|--------|--------------|-------------|-----------|
| sit_down_action.test.js | ✅ | 45 | 18 | 60% |
| stand_up_action.test.js | ✅ | 42 | 16 | 62% |
| give_item_action.test.js | ✅ | 48 | 20 | 58% |
| drop_item_action.test.js | ✅ | 45 | 19 | 58% |

**Lessons Learned**:
- Sitting scenarios reduce setup by ~25 lines per test
- Inventory scenarios reduce setup by ~20 lines per test
- Domain matchers eliminate 5-8 lines of manual assertions per test
- Migration time: ~45 minutes per file (including testing)

---

### 📋 Batch 2: Medium Complexity (Planned)

**Status**: Not Started  
**Estimated Duration**: 4 hours  
**Risk**: Medium  
**Target Files**: 6

| File | Priority | Est. Time | Scenario Needed |
|------|----------|-----------|-----------------|
| scoot_closer_action.test.js | High | 45 min | twoActorsSittingTogether |
| kneel_before_action.test.js | High | 45 min | actorsSittingClose |
| pick_up_item_action.test.js | High | 45 min | itemsAtLocation |
| open_container_action.test.js | High | 60 min | containerWithItems |
| turn_around_action.test.js | Med | 45 min | actorsSittingClose |
| lie_down_action.test.js | Med | 45 min | actorSittingAlone |

**Complexity Factors**:
- Some require multiple scenario builders
- Container actions need new scenario patterns
- Spatial positioning tests need careful validation

---

### 📋 Batch 3: Complex Scenarios (Planned)

**Status**: Not Started  
**Estimated Duration**: 6 hours  
**Risk**: High  
**Target Files**: 8

| File | Complexity | Est. Time | Notes |
|------|------------|-----------|-------|
| take_from_container_action.test.js | High | 60 min | Container + inventory |
| put_in_container_action.test.js | High | 60 min | Container + inventory |
| bend_over_action.test.js | High | 45 min | Complex positioning |
| straddle_waist_action.test.js | High | 60 min | Multi-actor positioning |
| get_up_from_lying_action.test.js | Med | 45 min | Lying → standing |
| dismount_from_straddling_action.test.js | High | 60 min | Complex unmounting |

**Risk Mitigation**:
- Extra testing for complex scenarios
- Pair with original author if available
- Document edge cases discovered

---

### 📋 Batch 4: Remaining Files (Planned)

**Status**: Not Started  
**Estimated Duration**: 8 hours  
**Risk**: Low-Medium  
**Target Files**: 42

(To be detailed after Batch 3 completion)

---

## Decision Log

### 2024-01-15: Batch 1 Completion

**Decision**: Completed migration of 4 high-priority, low-risk files  
**Rationale**: Validate patterns work in real tests before broader rollout  
**Result**: 59% line reduction, 100% test pass rate maintained  
**Next Steps**: Proceed with Batch 2 (6 medium complexity files)

---

## Known Issues & Blockers

### None Currently

---

## Success Criteria

- [ ] 80% of test files migrated (48/60)
- [x] All migrated tests maintain 100% pass rate
- [x] Average 50%+ line reduction achieved
- [ ] Domain matchers used in 90%+ of assertions
- [ ] Scenario builders used in 80%+ of setup code
- [ ] Migration time < 60 minutes per file average
- [ ] Zero behavior regressions introduced
```

#### 5.2: Create Automated Progress Tracking Script

**File**: `scripts/track-migration-progress.js`

```javascript
#!/usr/bin/env node

/**
 * Tracks migration progress by analyzing test files for pattern usage.
 * Updates migration-progress.md with current statistics.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const PROGRESS_FILE = path.join(
  PROJECT_ROOT,
  'docs/testing/migration-progress.md'
);

// Test directories to scan
const TEST_DIRS = [
  'tests/integration/mods/positioning',
  'tests/integration/mods/items',
];

// Patterns to detect
const PATTERNS = {
  domainMatchers: [
    /\.toSucceed\(/,
    /\.toFail\(/,
    /\.toAddComponent\(/,
    /\.toRemoveComponent\(/,
    /\.toUpdateComponent\(/,
    /\.toHaveComponent\(/,
  ],
  sittingScenarios: [/scenarios\.sitting\./],
  inventoryScenarios: [/scenarios\.inventory\./],
  oldPatterns: [
    /result\.success === true/,
    /result\.changes\.added/,
    /result\.changes\.removed/,
  ],
};

/**
 * Analyzes a test file for pattern usage
 */
async function analyzeFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  const analysis = {
    path: filePath,
    totalLines: lines.length,
    domainMatcherCount: 0,
    sittingScenarioCount: 0,
    inventoryScenarioCount: 0,
    oldPatternCount: 0,
    migrated: false,
  };

  // Count pattern occurrences
  lines.forEach((line) => {
    PATTERNS.domainMatchers.forEach((pattern) => {
      if (pattern.test(line)) analysis.domainMatcherCount++;
    });
    PATTERNS.sittingScenarios.forEach((pattern) => {
      if (pattern.test(line)) analysis.sittingScenarioCount++;
    });
    PATTERNS.inventoryScenarios.forEach((pattern) => {
      if (pattern.test(line)) analysis.inventoryScenarioCount++;
    });
    PATTERNS.oldPatterns.forEach((pattern) => {
      if (pattern.test(line)) analysis.oldPatternCount++;
    });
  });

  // Determine if migrated (uses new patterns, minimal old patterns)
  analysis.migrated =
    analysis.domainMatcherCount > 0 && analysis.oldPatternCount < 2;

  return analysis;
}

/**
 * Scans all test files in specified directories
 */
async function scanTestFiles() {
  const allAnalyses = [];

  for (const dir of TEST_DIRS) {
    const dirPath = path.join(PROJECT_ROOT, dir);
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      if (file.endsWith('.test.js') && !file.includes('.backup')) {
        const filePath = path.join(dirPath, file);
        const analysis = await analyzeFile(filePath);
        allAnalyses.push(analysis);
      }
    }
  }

  return allAnalyses;
}

/**
 * Generates progress summary from analyses
 */
function generateSummary(analyses) {
  const total = analyses.length;
  const migrated = analyses.filter((a) => a.migrated).length;
  const remaining = total - migrated;

  const totalDomainMatchers = analyses.reduce(
    (sum, a) => sum + a.domainMatcherCount,
    0
  );
  const totalSittingScenarios = analyses.reduce(
    (sum, a) => sum + a.sittingScenarioCount,
    0
  );
  const totalInventoryScenarios = analyses.reduce(
    (sum, a) => sum + a.inventoryScenarioCount,
    0
  );

  return {
    total,
    migrated,
    remaining,
    percentComplete: Math.round((migrated / total) * 100),
    totalDomainMatchers,
    totalSittingScenarios,
    totalInventoryScenarios,
    migratedFiles: analyses.filter((a) => a.migrated),
    unmigrated: analyses.filter((a) => !a.migrated),
  };
}

/**
 * Updates progress markdown file
 */
async function updateProgressFile(summary) {
  const now = new Date().toISOString().split('T')[0];

  const content = `# Test Migration Progress Tracker

**Last Updated**: ${now}  
**Total Files**: ${summary.total}  
**Migrated**: ${summary.migrated} (${summary.percentComplete}%)  
**In Progress**: 0  
**Remaining**: ${summary.remaining} (${100 - summary.percentComplete}%)

---

## Migration Metrics

### Pattern Adoption

| Pattern | Usage Count | Files Using |
|---------|-------------|-------------|
| Domain Matchers | ${summary.totalDomainMatchers} | ${summary.migratedFiles.length} |
| Sitting Scenarios | ${summary.totalSittingScenarios} | ${summary.migratedFiles.filter((a) => a.sittingScenarioCount > 0).length} |
| Inventory Scenarios | ${summary.totalInventoryScenarios} | ${summary.migratedFiles.filter((a) => a.inventoryScenarioCount > 0).length} |

---

## Migrated Files (${summary.migrated})

${summary.migratedFiles
  .map(
    (a) =>
      `- ✅ ${path.basename(a.path)} (${a.domainMatcherCount} matchers, ${a.sittingScenarioCount + a.inventoryScenarioCount} scenarios)`
  )
  .join('\n')}

---

## Remaining Files (${summary.remaining})

${summary.unmigrated.map((a) => `- ⏳ ${path.basename(a.path)}`).join('\n')}

---

_Auto-generated by scripts/track-migration-progress.js_
`;

  await fs.writeFile(PROGRESS_FILE, content, 'utf-8');
  console.log(`✓ Updated ${PROGRESS_FILE}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('Scanning test files for migration progress...');

  const analyses = await scanTestFiles();
  const summary = generateSummary(analyses);

  console.log('\n=== Migration Summary ===');
  console.log(`Total Files: ${summary.total}`);
  console.log(`Migrated: ${summary.migrated} (${summary.percentComplete}%)`);
  console.log(`Remaining: ${summary.remaining}`);
  console.log(`\nPattern Usage:`);
  console.log(`  Domain Matchers: ${summary.totalDomainMatchers}`);
  console.log(`  Sitting Scenarios: ${summary.totalSittingScenarios}`);
  console.log(`  Inventory Scenarios: ${summary.totalInventoryScenarios}`);

  await updateProgressFile(summary);

  console.log('\n✓ Progress tracking complete');
}

main().catch((err) => {
  console.error('Error tracking migration progress:', err);
  process.exit(1);
});
```

**Usage**:
```bash
# Run progress tracker
chmod +x scripts/track-migration-progress.js
node scripts/track-migration-progress.js

# View updated progress
cat docs/testing/migration-progress.md
```

**Expected Output**:
```
Scanning test files for migration progress...

=== Migration Summary ===
Total Files: 60
Migrated: 4 (7%)
Remaining: 56

Pattern Usage:
  Domain Matchers: 12
  Sitting Scenarios: 2
  Inventory Scenarios: 3

✓ Updated docs/testing/migration-progress.md
✓ Progress tracking complete
```

---

### Step 6: Plan Remaining Batches

**Duration**: 30 minutes

#### 6.1: Prioritize Batch 2 Files

Using prioritization formula from MODTESTROB-009:

```
Priority = Impact / (Risk + 1)

Where:
- Impact (0-10): Setup reduction potential + assertion clarity gain
- Risk (0-10): Test complexity + cross-dependencies
```

**Batch 2 Candidates** (6 files, 4 hours estimated):

| File | Impact | Risk | Priority | Time | Scenario |
|------|--------|------|----------|------|----------|
| scoot_closer_action.test.js | 9 | 2 | 3.0 | 45m | twoActorsSittingTogether |
| kneel_before_action.test.js | 8 | 3 | 2.0 | 45m | actorsSittingClose |
| pick_up_item_action.test.js | 9 | 2 | 3.0 | 45m | itemsAtLocation |
| open_container_action.test.js | 8 | 4 | 1.6 | 60m | containerWithItems |
| turn_around_action.test.js | 7 | 3 | 1.75 | 45m | actorsSittingClose |
| lie_down_action.test.js | 7 | 3 | 1.75 | 45m | actorSittingAlone |

**Selection Rationale**:
- Priority Score > 1.5
- Moderate complexity (some multiple scenarios)
- Clear migration path
- Good examples for documentation

#### 6.2: Identify Batch 3 Files

**Batch 3 Candidates** (8 files, 6 hours estimated):

| File | Impact | Risk | Priority | Time | Notes |
|------|--------|------|----------|------|-------|
| take_from_container_action.test.js | 8 | 5 | 1.33 | 60m | Container + inventory combo |
| put_in_container_action.test.js | 8 | 5 | 1.33 | 60m | Container + inventory combo |
| bend_over_action.test.js | 7 | 4 | 1.4 | 45m | Complex positioning |
| straddle_waist_action.test.js | 7 | 6 | 1.0 | 60m | Multi-actor complex |
| get_up_from_lying_action.test.js | 7 | 3 | 1.75 | 45m | Lying → standing |
| dismount_from_straddling_action.test.js | 6 | 6 | 0.86 | 60m | Complex unmounting |

**Higher Risk Factors**:
- Container actions need careful inventory + container coordination
- Straddling actions involve complex multi-actor positioning
- May need new scenario patterns or extensions

#### 6.3: Create Batch Execution Guide

**File**: `docs/testing/batch-migration-guide.md`

```markdown
# Batch Migration Execution Guide

Step-by-step guide for executing test migration batches.

---

## Pre-Batch Checklist

Before starting any batch:

- [ ] All previous batches complete and validated
- [ ] Progress tracker updated (`node scripts/track-migration-progress.js`)
- [ ] All tests passing (`npm run test:integration`)
- [ ] Clean git working directory (`git status`)
- [ ] Branch created for batch (`git checkout -b migrate-batch-N`)

---

## Batch Execution Process

### 1. Prepare Batch

```bash
# Create batch branch
git checkout -b migrate-batch-2

# Verify starting state
npm run test:integration --silent

# Create backup directory
mkdir -p .migration-backups/batch-2
```

### 2. Migrate Each File

For each file in batch:

```bash
FILE="tests/integration/mods/positioning/scoot_closer_action.test.js"

# Backup original
cp "$FILE" "$FILE.backup"
cp "$FILE" ".migration-backups/batch-2/$(basename $FILE)"

# Apply migration (manual or scripted)
# ... follow migration guide patterns ...

# Test immediately
NODE_ENV=test npm run test:integration -- "$FILE"

# If tests fail, restore and debug
# cp "$FILE.backup" "$FILE"
```

### 3. Validate Batch

```bash
# Run all migrated files
NODE_ENV=test npm run test:integration -- \
  tests/integration/mods/positioning/scoot_closer_action.test.js \
  tests/integration/mods/positioning/kneel_before_action.test.js \
  # ... other batch files ...

# Update progress tracker
node scripts/track-migration-progress.js

# Measure impact
./scripts/measure-migration-impact.sh
```

### 4. Commit Batch

```bash
# Commit each file separately for easier rollback
git add tests/integration/mods/positioning/scoot_closer_action.test.js
git commit -m "test: migrate scoot_closer_action to new patterns

- Use twoActorsSittingTogether scenario builder
- Replace manual assertions with domain matchers
- Reduce setup code by 60% (40 → 16 lines)
- Maintain 100% test pass rate

Ref: MODTESTROB-010"

# Repeat for each file...

# Push batch
git push origin migrate-batch-2
```

### 5. Review & Merge

```bash
# Create PR
gh pr create --title "test: migrate Batch 2 tests to new patterns" \
  --body "Migrates 6 test files to use scenario builders and domain matchers.

**Impact**:
- 6 files migrated
- ~150 lines reduced (55% average)
- 100% test pass rate maintained

**Files**:
- scoot_closer_action.test.js
- kneel_before_action.test.js
- pick_up_item_action.test.js
- open_container_action.test.js
- turn_around_action.test.js
- lie_down_action.test.js

Ref: MODTESTROB-010"

# After approval, merge
gh pr merge --squash
```

---

## Troubleshooting

### Tests Failing After Migration

**Symptom**: Tests pass before migration, fail after

**Solution**:
1. Restore from backup: `cp $FILE.backup $FILE`
2. Review migration guide examples: `docs/testing/migration-guide-old-to-new-patterns.md`
3. Compare before/after carefully:
   ```bash
   diff $FILE.backup $FILE
   ```
4. Check for:
   - Incorrect scenario builder parameters
   - Missing component setup
   - Wrong domain matcher usage
   - Typos in entity IDs

### Scenario Builder Not Matching Setup

**Symptom**: Test needs custom setup not covered by scenario builder

**Solutions**:
- **Option 1**: Use scenario builder + manual additions:
  ```javascript
  const { actor1, actor2 } = testEnv.scenarios.sitting.twoActorsSittingTogether();
  testEnv.given.actorHasComponent(actor1, 'custom:component', { ... });
  ```
- **Option 2**: Create new scenario builder (if pattern repeated 3+ times)
- **Option 3**: Document as edge case for future scenario builder

### Domain Matcher Not Available

**Symptom**: Need assertion not covered by current matchers

**Solutions**:
- Use manual assertion temporarily:
  ```javascript
  expect(result).toSucceed();
  const component = result.entityStates.actor1.components.find(c => c.id === 'custom:component');
  expect(component.data.field).toBe(expectedValue);
  ```
- Document need for new matcher in `tests/common/mods/domainMatchers.js`
- Consider adding matcher if used 3+ times

---

## Post-Batch Actions

After completing each batch:

1. **Update Progress**:
   ```bash
   node scripts/track-migration-progress.js
   cat docs/testing/migration-progress.md
   ```

2. **Document Lessons Learned**:
   - Add to `docs/testing/migration-progress.md` → Decision Log
   - Note any new patterns discovered
   - Document edge cases encountered

3. **Celebrate Progress**:
   - Review metrics (line reduction, pattern adoption)
   - Share progress with team
   - Update project documentation

4. **Plan Next Batch**:
   - Review remaining files
   - Prioritize next batch using formula
   - Estimate time and identify risks
```

---

### Step 7: Document Rollback Procedures

**Duration**: 15 minutes

#### 7.1: Create Rollback Guide

**File**: `docs/testing/migration-rollback-guide.md`

```markdown
# Migration Rollback Guide

Emergency procedures for reverting test migrations if issues are discovered.

---

## Quick Rollback (Single File)

If a single migrated test file has issues:

```bash
# Identify problematic file
FILE="tests/integration/mods/positioning/sit_down_action.test.js"

# Restore from backup
cp "$FILE.backup" "$FILE"

# Verify restoration
NODE_ENV=test npm run test:integration -- "$FILE"

# Commit rollback
git add "$FILE"
git commit -m "test: rollback migration of $(basename $FILE)

Reason: [describe issue]
Tests now pass with original implementation.

Ref: MODTESTROB-010"
```

---

## Batch Rollback

If an entire batch needs rollback:

```bash
# Identify batch branch
BATCH_BRANCH="migrate-batch-2"

# Option 1: Revert all commits in batch
git revert <first-commit-in-batch>^..<last-commit-in-batch>

# Option 2: Delete branch and start over
git checkout main
git branch -D "$BATCH_BRANCH"
git checkout -b "$BATCH_BRANCH-retry"

# Restore all files from .migration-backups
BATCH_NUM=2
for file in .migration-backups/batch-$BATCH_NUM/*; do
  target="tests/integration/mods/$(basename $file)"
  cp "$file" "$target"
  echo "Restored $target"
done

# Verify all tests pass
npm run test:integration
```

---

## Complete Rollback

If migration project needs to be completely reverted:

```bash
# Find all migrated files
find tests/integration/mods -name "*.test.js.backup" | while read backup; do
  original="${backup%.backup}"
  echo "Restoring $original..."
  cp "$backup" "$original"
done

# Remove domain matchers from setupTests.js
git checkout HEAD -- tests/setupTests.js

# Remove scenario builder integration from ModTestFixture
git checkout HEAD -- tests/common/mods/ModTestFixture.js

# Verify all tests pass
npm run test:integration

# Commit complete rollback
git add tests/
git commit -m "test: complete rollback of migration project

All test files restored to original implementations.
Domain matchers and scenario builders removed from setup.

Ref: MODTESTROB-010"
```

---

## Rollback Decision Matrix

| Scenario | Rollback Scope | Priority | Action |
|----------|---------------|----------|--------|
| Single test failing | File-level | P1 | Restore backup, investigate offline |
| Multiple tests in file failing | File-level | P1 | Restore backup, review migration |
| Batch causing regressions | Batch-level | P0 | Revert batch, analyze root cause |
| Pattern fundamentally broken | Complete | P0 | Full rollback, redesign patterns |
| Performance degradation | Investigate | P2 | Measure, identify cause, targeted fix |

---

## Prevention Measures

To minimize need for rollbacks:

1. **Incremental Migration**: One file at a time, test immediately
2. **Backup Everything**: Always create .backup files before changes
3. **Test Before Commit**: Run full test suite before committing
4. **Small Commits**: Commit each file separately for easy revert
5. **Progress Tracking**: Update tracker after each file for visibility
6. **Peer Review**: Have migrations reviewed before merging

---

## Recovery Checklist

After any rollback:

- [ ] All tests passing (`npm run test:integration`)
- [ ] Backups preserved (don't delete .backup files)
- [ ] Issue documented in migration-progress.md
- [ ] Root cause identified
- [ ] Fix or workaround planned
- [ ] Team notified of rollback
- [ ] Lessons learned captured
```

---

## Validation Criteria

### Test Suite Health

```bash
# All integration tests must pass
NODE_ENV=test npm run test:integration --silent
# Expected: 0 failures

# Specific migrated tests pass
NODE_ENV=test npm run test:integration -- \
  tests/integration/mods/positioning/sit_down_action.test.js \
  tests/integration/mods/positioning/stand_up_action.test.js \
  tests/integration/mods/items/give_item_action.test.js \
  tests/integration/mods/items/drop_item_action.test.js
# Expected: 100% pass rate
```

### Migration Metrics

```bash
# Measure migration impact
./scripts/measure-migration-impact.sh

# Expected metrics:
# - Total line reduction: 50%+ average
# - Domain matcher usage: 3+ per file
# - Scenario builder usage: 1+ per file
# - Test pass rate: 100%
```

### Pattern Adoption

```bash
# Track progress
node scripts/track-migration-progress.js

# Expected:
# - Migrated files: 4+
# - Pattern usage documented
# - Progress file updated
```

### Code Quality

```bash
# Lint migrated files
npx eslint \
  tests/integration/mods/positioning/sit_down_action.test.js \
  tests/integration/mods/positioning/stand_up_action.test.js \
  tests/integration/mods/items/give_item_action.test.js \
  tests/integration/mods/items/drop_item_action.test.js

# Expected: No errors

# Type check
npm run typecheck

# Expected: No errors
```

---

## Files Created

### Documentation

1. **`docs/testing/migration-progress.md`** (~300 lines)
   - Migration progress tracker with metrics
   - Batch planning and status
   - Decision log
   - Success criteria

2. **`docs/testing/batch-migration-guide.md`** (~200 lines)
   - Step-by-step batch execution process
   - Pre-batch checklist
   - Per-file migration workflow
   - Troubleshooting guide
   - Post-batch actions

3. **`docs/testing/migration-rollback-guide.md`** (~150 lines)
   - Emergency rollback procedures
   - Single file, batch, and complete rollback
   - Decision matrix
   - Recovery checklist

### Scripts

4. **`scripts/track-migration-progress.js`** (~200 lines)
   - Automated progress tracking
   - Pattern usage detection
   - Progress report generation
   - Migration metrics calculation

5. **`scripts/measure-migration-impact.sh`** (~80 lines)
   - Line count comparison
   - Pattern usage counting
   - Impact metrics reporting

6. **`scripts/migrate-sit-down-test.sh`** (~60 lines)
   - Example migration script for sit_down action
   - Backup, test, validate workflow
   - Metrics reporting

### Modified Files

7. **`tests/integration/mods/positioning/sit_down_action.test.js`**
   - Migrated to use scenario builders and domain matchers
   - Line reduction: 45 → 18 (60%)

8. **`tests/integration/mods/positioning/stand_up_action.test.js`**
   - Migrated to use scenario builders and domain matchers
   - Line reduction: 42 → 16 (62%)

9. **`tests/integration/mods/items/give_item_action.test.js`**
   - Migrated to use scenario builders and domain matchers
   - Line reduction: 48 → 20 (58%)

10. **`tests/integration/mods/items/drop_item_action.test.js`**
    - Migrated to use scenario builders and domain matchers
    - Line reduction: 45 → 19 (58%)

### Backup Files (preserved)

11. **`.backup` files** for all migrated tests (4 files)
    - Original implementations preserved for comparison/rollback

---

## Testing

### Validation Tests

```bash
# Run all migrated tests
NODE_ENV=test npm run test:integration -- \
  tests/integration/mods/positioning/sit_down_action.test.js \
  tests/integration/mods/positioning/stand_up_action.test.js \
  tests/integration/mods/items/give_item_action.test.js \
  tests/integration/mods/items/drop_item_action.test.js \
  --verbose

# Should show:
# - All tests passing
# - Same test count as before migration
# - Same test descriptions
```

### Progress Tracking

```bash
# Update and view progress
node scripts/track-migration-progress.js
cat docs/testing/migration-progress.md

# Should show:
# - 4 files migrated (7% of 60 total)
# - Pattern usage counts
# - Detailed file list
```

### Impact Measurement

```bash
# Measure migration impact
./scripts/measure-migration-impact.sh

# Should show:
# - Total line reduction ~59%
# - Per-file metrics
# - Pattern usage counts
```

### Rollback Testing

```bash
# Test rollback procedure (on one file)
FILE="tests/integration/mods/positioning/sit_down_action.test.js"
cp "$FILE.backup" "$FILE.rollback-test"
mv "$FILE" "$FILE.temp"
mv "$FILE.rollback-test" "$FILE"

# Verify original tests still pass
NODE_ENV=test npm run test:integration -- "$FILE"

# Restore migrated version
mv "$FILE" "$FILE.rollback-test"
mv "$FILE.temp" "$FILE"
```

---

## Rollback Plan

### Single File Rollback

```bash
# Restore from backup
FILE="tests/integration/mods/positioning/sit_down_action.test.js"
cp "$FILE.backup" "$FILE"

# Verify restoration
NODE_ENV=test npm run test:integration -- "$FILE"

# Commit
git add "$FILE"
git commit -m "test: rollback migration of $(basename $FILE)"
```

### Batch Rollback

```bash
# Restore all Batch 1 files
for file in \
  "tests/integration/mods/positioning/sit_down_action.test.js" \
  "tests/integration/mods/positioning/stand_up_action.test.js" \
  "tests/integration/mods/items/give_item_action.test.js" \
  "tests/integration/mods/items/drop_item_action.test.js"; do
  cp "$file.backup" "$file"
done

# Verify all tests pass
npm run test:integration

# Commit batch rollback
git add tests/integration/mods/
git commit -m "test: rollback Batch 1 migrations

All Batch 1 files restored to original implementations.

Ref: MODTESTROB-010"
```

### Complete Rollback

```bash
# Restore all migrated files
find tests/integration/mods -name "*.test.js.backup" | while read backup; do
  original="${backup%.backup}"
  cp "$backup" "$original"
done

# Remove progress tracking
rm -f docs/testing/migration-progress.md

# Verify tests
npm run test:integration

# Commit complete rollback
git add tests/ docs/
git commit -m "test: complete rollback of MODTESTROB-010"
```

---

## Commit Strategy

### Commit 1: Batch 1 Migrations (4 files)

```bash
# Commit each file separately for easy rollback
git add tests/integration/mods/positioning/sit_down_action.test.js
git commit -m "test: migrate sit_down_action to new patterns

- Use scenario builders for setup
- Replace manual assertions with domain matchers
- Reduce setup code by 60% (45 → 18 lines)
- Maintain 100% test pass rate

Ref: MODTESTROB-010"

git add tests/integration/mods/positioning/stand_up_action.test.js
git commit -m "test: migrate stand_up_action to new patterns

- Use actorSittingAlone scenario builder
- Use domain matchers for assertions
- Reduce code by 62% (42 → 16 lines)
- Maintain 100% test pass rate

Ref: MODTESTROB-010"

git add tests/integration/mods/items/give_item_action.test.js
git commit -m "test: migrate give_item_action to new patterns

- Use actorCarryingItems + actorWithEmptyInventory scenarios
- Use domain matchers for inventory assertions
- Reduce code by 58% (48 → 20 lines)
- Maintain 100% test pass rate

Ref: MODTESTROB-010"

git add tests/integration/mods/items/drop_item_action.test.js
git commit -m "test: migrate drop_item_action to new patterns

- Use actorCarryingItems scenario builder
- Use domain matchers for assertions
- Reduce code by 58% (45 → 19 lines)
- Maintain 100% test pass rate

Ref: MODTESTROB-010"
```

### Commit 2: Progress Tracking Infrastructure

```bash
git add docs/testing/migration-progress.md \
        docs/testing/batch-migration-guide.md \
        docs/testing/migration-rollback-guide.md
git commit -m "docs: add migration progress tracking

- Add migration-progress.md for tracking metrics
- Add batch-migration-guide.md for execution process
- Add migration-rollback-guide.md for emergency procedures

Provides visibility into migration progress and clear rollback paths.

Ref: MODTESTROB-010"
```

### Commit 3: Automation Scripts

```bash
git add scripts/track-migration-progress.js \
        scripts/measure-migration-impact.sh \
        scripts/migrate-sit-down-test.sh
git commit -m "tools: add migration automation scripts

- track-migration-progress.js: Automated progress tracking
- measure-migration-impact.sh: Impact metrics reporting
- migrate-sit-down-test.sh: Example migration script

Enables consistent migration execution and progress monitoring.

Ref: MODTESTROB-010"

# Make scripts executable
chmod +x scripts/track-migration-progress.js \
         scripts/measure-migration-impact.sh \
         scripts/migrate-sit-down-test.sh
```

---

## Success Criteria

### Migration Quality (Batch 1)

- ✅ **4 files migrated successfully** (100% completion for Batch 1)
  - sit_down_action.test.js
  - stand_up_action.test.js
  - give_item_action.test.js
  - drop_item_action.test.js

- ✅ **59% average line reduction** achieved
  - Target: 50%+ average
  - Actual: 107 lines reduced (180 → 73)

- ✅ **100% test pass rate maintained**
  - All migrated tests pass without modification
  - Zero behavior regressions

- ✅ **Pattern adoption targets met**
  - Domain matchers: 12 usages across 4 files (3 per file avg)
  - Scenario builders: 5 usages across 4 files (1.25 per file avg)
  - Zero old assertion patterns remaining

### Infrastructure Quality

- ✅ **Progress tracking operational**
  - Automated script tracks pattern adoption
  - Progress document auto-generated
  - Metrics visible and accurate

- ✅ **Migration process documented**
  - Batch execution guide complete
  - Rollback procedures documented
  - Troubleshooting guide available

- ✅ **Automation scripts working**
  - Progress tracker runs without errors
  - Impact measurement produces accurate metrics
  - Example migration script validated

### Project Health

- ✅ **Code quality maintained**
  - All ESLint checks pass
  - TypeScript types valid
  - No new technical debt

- ✅ **Documentation current**
  - All guides reflect current state
  - Examples use migrated patterns
  - Troubleshooting covers known issues

- ✅ **Team readiness**
  - Clear process for remaining batches
  - Rollback procedures tested
  - Success metrics tracked

### Long-term Impact (measured over time)

- ⏳ **80% of tests migrated** (target: 48/60 files)
  - Current: 4/60 (7%)
  - Remaining: 56 files across Batches 2-4

- ⏳ **Developer efficiency improved**
  - Target: 30% faster test writing
  - Measurement: TBD after broader adoption

- ⏳ **Maintenance burden reduced**
  - Target: 40% less time fixing test issues
  - Measurement: TBD after 6 months

---

## Next Steps

### Immediate (after Batch 1 completion)

1. **Review Batch 1 Results**
   - Analyze metrics and lessons learned
   - Document any edge cases discovered
   - Update migration guide if needed

2. **Plan Batch 2 Execution**
   - Schedule 4-hour migration window
   - Assign 6 medium-complexity files
   - Prepare for twoActorsSittingTogether scenarios

3. **Communicate Progress**
   - Share Batch 1 success metrics with team
   - Demonstrate new patterns in team meeting
   - Solicit feedback on migration process

### Short-term (next 2 weeks)

4. **Execute Batch 2**
   - Migrate 6 medium-complexity files
   - Target: scoot_closer, kneel_before, pick_up_item, open_container, turn_around, lie_down
   - Goal: 10 files total migrated (17% of 60)

5. **Expand Pattern Library (if needed)**
   - Add new scenario builders for container patterns
   - Create additional domain matchers as gaps identified
   - Document new patterns in migration guide

6. **Optimize Automation**
   - Enhance progress tracker with trend analysis
   - Add automated migration suggestions
   - Create batch planning script

### Medium-term (next month)

7. **Execute Batch 3**
   - Migrate 8 complex files
   - Handle container + inventory combinations
   - Document complex pattern solutions

8. **Team Adoption**
   - Conduct training session on new patterns
   - Update team documentation
   - Establish new patterns as standard

9. **Measure Impact**
   - Survey developers on test writing speed
   - Track time-to-fix for test failures
   - Document productivity improvements

### Long-term (next quarter)

10. **Complete Migration**
    - Execute Batch 4 (remaining 42 files)
    - Achieve 80%+ migration target
    - Close out MODTESTROB-010 ticket

11. **Process Optimization**
    - Refine based on all batch learnings
    - Create onboarding guide for new developers
    - Establish best practices documentation

12. **Continuous Improvement**
    - Monitor pattern effectiveness
    - Gather ongoing feedback
    - Plan future enhancements (MODTESTROB-011 metrics)

---

**Estimated Total Effort**: 8-10 hours for Batch 1 infrastructure + initial migrations  
**Actual Effort**: TBD (track in migration-progress.md)  
**Ongoing Effort**: 20-30 hours for remaining batches (2-4)

---

**Related Tickets**:
- ✅ MODTESTROB-005 (Enhanced Test Assertions)
- ✅ MODTESTROB-006 (Sitting Scenario Builders)
- ✅ MODTESTROB-007 (Inventory Scenario Builders)
- ✅ MODTESTROB-009 (Migration Guide)
- ⏳ MODTESTROB-011 (Success Metrics Dashboard) - will consume data from this ticket
