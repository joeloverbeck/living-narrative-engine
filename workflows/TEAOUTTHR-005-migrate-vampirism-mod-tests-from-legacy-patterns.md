# TEAOUTTHR-005: Migrate Vampirism Mod Tests from Legacy Patterns

## Overview
**Priority**: P1 (Medium-term)
**Effort**: 4 hours
**Impact**: Medium
**Dependencies**:
- TEAOUTTHR-001 (ScopeResolverHelpers documentation)
- TEAOUTTHR-004 (Violence mod migration as pattern reference)

## Problem Statement
Vampirism mod tests use the **legacy** `createActionDiscoveryBed` pattern, which:
- Is deprecated per docs/testing/MODTESTROB-009-migration-guide.md
- Uses mock-based approach instead of ModTestFixture
- Requires SimpleEntityManager instead of test fixture's entity manager
- Contains 40+ lines of manual mock implementations
- Doesn't align with current testing standards

Primary file affected:
- `tests/integration/mods/vampirism/drink_blood_action_discovery.test.js` (~500 lines)

## Goals
1. Migrate from legacy `createActionDiscoveryBed` to modern `ModTestFixture.forAction`
2. Replace mock-based scope resolution with ScopeResolverHelpers
3. Eliminate SimpleEntityManager usage
4. Reduce test code by ~40 lines
5. Align vampirism tests with current testing standards
6. Establish consistent pattern for vampirism mod

## Implementation Steps

### Step 1: Analyze Current Implementation

**File**: `tests/integration/mods/vampirism/drink_blood_action_discovery.test.js`

**Current Pattern**:
```javascript
import { createActionDiscoveryBed } from '../../../common/actionDiscoveryBed.js';
import { SimpleEntityManager } from '../../../common/SimpleEntityManager.js';

describe('vampirism:drink_blood - Action Discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();

    // Legacy mock-based approach
    const simpleEntityManager = new SimpleEntityManager();
    testBed.mocks.entityManager = simpleEntityManager;

    // 40+ lines of manual mock implementation
    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      (_scopeName, actorEntity) => {
        // Complex manual scope resolution logic...
      }
    );
  });
});
```

**Required Scopes** (identify from action definition):
- Check `data/mods/vampirism/actions/drink_blood.action.json` for `targets` field
- Expected: positioning-related scopes (likely `positioning:actor_being_bitten_by_me` or similar)

---

### Step 2: Create Migration Plan

#### 2.1: Import Statements Update

**Remove Legacy Imports**:
```javascript
import { createActionDiscoveryBed } from '../../../common/actionDiscoveryBed.js';
import { SimpleEntityManager } from '../../../common/SimpleEntityManager.js';
```

**Add Modern Imports**:
```javascript
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
```

#### 2.2: Test Structure Transformation

**Remove**:
```javascript
let testBed;

beforeEach(() => {
  testBed = createActionDiscoveryBed();
  const simpleEntityManager = new SimpleEntityManager();
  testBed.mocks.entityManager = simpleEntityManager;

  testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(...);
});

afterEach(() => {
  testBed.cleanup();
});
```

**Replace With**:
```javascript
let testFixture;

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('vampirism', 'drink_blood');

  // Register positioning scopes
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // If drink_blood uses custom scopes, add resolver
  // (determine from action definition analysis)
});

afterEach(() => {
  testFixture.cleanup();
});
```

---

### Step 3: Entity Creation Migration

#### 3.1: Room Creation

**Remove**:
```javascript
const room = testBed.createMockLocation('room1', 'Test Room');
```

**Replace With**:
```javascript
const room = testFixture.createEntity({
  id: 'room1',
  name: 'Test Room',
  components: {
    'core:location': { name: 'Test Room' },
  },
});
```

Or use ModEntityScenarios if available:
```javascript
const room = ModEntityScenarios.createRoom('room1', 'Test Room');
```

#### 3.2: Actor/Target Creation

**Remove**:
```javascript
const actor = testBed.createMockActor('alice', 'Alice', 'room1', {
  components: { /* ... */ }
});

const target = testBed.createMockActor('bob', 'Bob', 'room1', {
  components: { /* ... */ }
});
```

**Replace With**:
```javascript
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
// Adds additional components as needed
scenario.actor.components['positioning:biting_neck'] = {
  bitten_entity_id: scenario.target.id,
  initiated: true,
  consented: false,
};
```

Or manual creation:
```javascript
const actor = testFixture.createEntity({
  id: 'alice',
  name: 'Alice',
  components: {
    'core:position': { locationId: 'room1' },
    'positioning:closeness': { partners: ['bob'] },
    'positioning:biting_neck': {
      bitten_entity_id: 'bob',
      initiated: true,
      consented: false,
    },
  },
});
```

---

### Step 4: Action Discovery Call Migration

#### 4.1: Discovery Method Update

**Remove**:
```javascript
const availableActions = await testBed.discoverActions('alice');
```

**Replace With**:
```javascript
const availableActions = await testFixture.getAvailableActions(scenario.actor.id);
```

#### 4.2: Reset Pattern Update

**Remove**:
```javascript
testBed.reset();
testBed.addEntity(room);
testBed.addEntity(actor);
testBed.addEntity(target);
```

**Replace With**:
```javascript
testFixture.reset([room, scenario.actor, scenario.target]);
```

---

### Step 5: Assertion Updates

#### 5.1: Action Discovery Assertions

**No changes needed** - assertions should remain the same:
```javascript
expect(availableActions).toContain('vampirism:drink_blood');
expect(availableActions).not.toContain('vampirism:drink_blood');
```

#### 5.2: Diagnostic Enablement (if needed)

**Add for debugging**:
```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('vampirism', 'drink_blood');
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // Enable for debugging only
  // testFixture.enableDiagnostics();
});
```

---

### Step 6: Complete Migration Checklist

For each test case in the file:

- [ ] Remove `testBed` variable, add `testFixture`
- [ ] Update `beforeEach` to use `ModTestFixture.forAction`
- [ ] Add `ScopeResolverHelpers.registerPositioningScopes`
- [ ] Remove SimpleEntityManager usage
- [ ] Convert entity creation to `testFixture.createEntity` or scenario helpers
- [ ] Update `discoverActions` to `getAvailableActions`
- [ ] Update `testBed.reset()` to `testFixture.reset([entities])`
- [ ] Remove mock implementations
- [ ] Verify assertions still work
- [ ] Test passes

---

### Step 7: Verify Migration

#### 7.1: Run Migrated Test
```bash
NODE_ENV=test npx jest tests/integration/mods/vampirism/drink_blood_action_discovery.test.js --no-coverage --verbose
```

#### 7.2: Run Full Vampirism Test Suite
```bash
NODE_ENV=test npx jest tests/integration/mods/vampirism/ --no-coverage --silent
```

Expected output:
```
PASS  tests/integration/mods/vampirism/drink_blood_action_discovery.test.js
PASS  tests/integration/mods/vampirism/drink_blood_action.test.js
PASS  tests/integration/mods/vampirism/bite_neck_action_discovery.test.js
PASS  tests/integration/mods/vampirism/bite_neck_action.test.js
```

---

### Step 8: Update Vampirism Test Documentation

**File**: `tests/integration/mods/vampirism/README.md` (create if doesn't exist)

**Content**:
```markdown
# Vampirism Mod Tests

## Testing Pattern

All vampirism mod tests use the ModTestFixture pattern with ScopeResolverHelpers.

### Standard Setup

\`\`\`javascript
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('vampirism:{action} - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('vampirism', '{action}');
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });
});
\`\`\`

## Migration History

- **2025-10-26**: Migrated from legacy createActionDiscoveryBed to ModTestFixture (TEAOUTTHR-005)
  - Removed SimpleEntityManager usage
  - Replaced mock-based scope resolution with ScopeResolverHelpers
  - Aligned with current testing standards
  - Reduced boilerplate by ~40 lines
```

---

## Files to Modify
- `tests/integration/mods/vampirism/drink_blood_action_discovery.test.js`
- `tests/integration/mods/vampirism/README.md` (create)

## Acceptance Criteria
✅ Legacy createActionDiscoveryBed pattern removed
✅ SimpleEntityManager usage eliminated
✅ ModTestFixture.forAction pattern adopted
✅ ScopeResolverHelpers.registerPositioningScopes used
✅ Mock-based approach replaced with fixture-based
✅ All vampirism mod tests pass after migration
✅ Test code reduced by ~40 lines
✅ README.md documenting new pattern created
✅ Pattern matches violence mod (TEAOUTTHR-004) for consistency

## Testing Strategy

### Pre-Migration Baseline
```bash
# Capture baseline
NODE_ENV=test npx jest tests/integration/mods/vampirism/ --no-coverage --silent > vampirism-baseline.txt
```

### During Migration
```bash
# Test after each major change
NODE_ENV=test npx jest tests/integration/mods/vampirism/drink_blood_action_discovery.test.js --no-coverage --verbose
```

### Post-Migration Verification
```bash
# Full vampirism suite
NODE_ENV=test npx jest tests/integration/mods/vampirism/ --no-coverage --silent

# Compare with baseline
diff vampirism-baseline.txt vampirism-migrated.txt
```

### Regression Testing
```bash
# Full integration suite
NODE_ENV=test npm run test:integration -- --silent
```

## Rollback Plan
If migration causes test failures:
1. Git checkout original file
2. Compare action definition scopes with registered scopes
3. Verify entity creation matches original mock setup
4. Check for differences in scope resolution logic
5. Review MODTESTROB-009 migration guide for patterns

## Common Migration Challenges

### Challenge 1: Entity Relationship Setup
**Issue**: SimpleEntityManager handled relationships differently

**Solution**: Explicitly set reciprocal components
```javascript
// Actor biting target's neck
actor.components['positioning:biting_neck'] = {
  bitten_entity_id: target.id,
  initiated: true,
  consented: false,
};

// Target being bitten
target.components['positioning:being_bitten_in_neck'] = {
  biting_entity_id: actor.id,
};
```

### Challenge 2: Custom Scope Requirements
**Issue**: drink_blood may use vampirism-specific scopes

**Solution**: Check action definition and add custom resolver if needed
```javascript
const customResolver = ScopeResolverHelpers.createComponentLookupResolver(
  'vampirism:custom_scope',
  { componentType: 'vampirism:component', sourceField: 'field', contextSource: 'actor' }
);

ScopeResolverHelpers._registerResolvers(
  testFixture.testEnv,
  testFixture.testEnv.entityManager,
  { 'vampirism:custom_scope': customResolver }
);
```

### Challenge 3: Mock Behavior Differences
**Issue**: Mocks behaved differently than real implementations

**Solution**: Use real entity manager and scope resolvers (already in ModTestFixture)

## Related Tickets
- TEAOUTTHR-001: ScopeResolverHelpers documentation
- TEAOUTTHR-004: Violence mod migration (pattern reference)
- TEAOUTTHR-006: May add vampirism-specific scopes to helpers library

## Success Metrics
- Legacy pattern eliminated: 1 file migrated
- Test code reduction: ~40 lines
- Pattern consistency: Matches violence mod approach
- Test execution time: No degradation
- All tests passing: 100% success rate
