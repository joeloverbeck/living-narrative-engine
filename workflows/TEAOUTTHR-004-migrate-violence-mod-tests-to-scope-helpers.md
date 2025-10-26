# TEAOUTTHR-004: Migrate Violence Mod Tests to Use ScopeResolverHelpers

## Overview
**Priority**: P1 (Medium-term)
**Effort**: 4 hours
**Impact**: Medium
**Dependencies**: TEAOUTTHR-001 (Documentation reference)

## Problem Statement
Violence mod tests currently use manual scope resolution with 40+ lines of boilerplate code per test file. This approach:
- Creates maintenance burden (duplicate scope logic)
- Increases test complexity and cognitive load
- Makes tests harder to understand and modify
- Doesn't establish consistent testing patterns for the codebase

Files affected:
- `tests/integration/mods/violence/grab_neck_action_discovery.test.js` (~400 lines)
- `tests/integration/mods/violence/tear_out_throat_action_discovery.test.js` (~450 lines)

## Goals
1. Replace manual scope resolution with ScopeResolverHelpers calls
2. Reduce test code by ~35 lines per file (~70 lines total)
3. Establish consistent pattern for violence mod tests
4. Eliminate manual scope implementation errors
5. Improve test maintainability

## Implementation Steps

### Step 1: Migrate grab_neck_action_discovery.test.js

**File**: `tests/integration/mods/violence/grab_neck_action_discovery.test.js`

#### 1.1: Add Import Statement
**Location**: Top of file after existing imports

**Add**:
```javascript
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
```

#### 1.2: Replace Manual Scope Configuration
**Location**: `beforeEach` block

**Remove** (~40 lines):
```javascript
let configureActionDiscovery;

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', ACTION_ID);

  configureActionDiscovery = () => {
    const { testEnv } = testFixture;
    if (!testEnv) return;

    testEnv.actionIndex.buildIndex([grabNeckAction]);

    const scopeResolver = testEnv.unifiedScopeResolver;
    const originalResolve =
      scopeResolver.__grabNeckOriginalResolve ||
      scopeResolver.resolveSync.bind(scopeResolver);

    scopeResolver.__grabNeckOriginalResolve = originalResolve;
    scopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'positioning:close_actors_facing_each_other_or_behind_target') {
        // 30+ lines of manual scope implementation...
      }
      return originalResolve(scopeName, context);
    };
  };
});
```

**Replace With** (~2 lines):
```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', ACTION_ID);

  // Register positioning scopes (replaces 40+ lines of manual implementation)
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
```

#### 1.3: Remove configureActionDiscovery Calls
**Location**: After every `testFixture.reset()` call throughout the file

**Remove**:
```javascript
testFixture.reset([room, scenario.actor, scenario.target]);
configureActionDiscovery(); // ← Remove this line
```

**Replace With**:
```javascript
testFixture.reset([room, scenario.actor, scenario.target]);
```

#### 1.4: Remove entityHelpers Import
**Location**: Top of file

**Remove** (if exists):
```javascript
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';
```

#### 1.5: Remove clearEntityCache Calls
**Location**: `afterEach` block

**Remove** (if exists):
```javascript
afterEach(() => {
  clearEntityCache(); // ← Remove this line
  testFixture.cleanup();
});
```

**Replace With**:
```javascript
afterEach(() => {
  testFixture.cleanup();
});
```

#### 1.6: Verify Tests Pass
```bash
NODE_ENV=test npx jest tests/integration/mods/violence/grab_neck_action_discovery.test.js --no-coverage --verbose
```

---

### Step 2: Migrate tear_out_throat_action_discovery.test.js

**File**: `tests/integration/mods/violence/tear_out_throat_action_discovery.test.js`

#### 2.1: Add Import Statement
**Location**: Top of file after existing imports

**Add**:
```javascript
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
```

#### 2.2: Replace Manual Scope Configuration
**Location**: `beforeEach` block

**Current Implementation** (~45 lines):
```javascript
let configureActionDiscovery;

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', ACTION_ID);

  configureActionDiscovery = () => {
    const { testEnv } = testFixture;
    testEnv.actionIndex.buildIndex([tearOutThroatAction]);

    const scopeResolver = testEnv.unifiedScopeResolver;
    const originalResolve = scopeResolver.resolveSync.bind(scopeResolver);

    scopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'positioning:actor_being_bitten_by_me') {
        // 35+ lines of manual component lookup logic...
      }
      return originalResolve(scopeName, context);
    };
  };
});
```

**Replace With** (~7 lines):
```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', ACTION_ID);

  // Register standard positioning scopes
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // Add custom scope for biting relationship
  const bitingResolver = ScopeResolverHelpers.createComponentLookupResolver(
    'positioning:actor_being_bitten_by_me',
    {
      componentType: 'positioning:biting_neck',
      sourceField: 'bitten_entity_id',
      contextSource: 'actor',
    }
  );

  ScopeResolverHelpers._registerResolvers(
    testFixture.testEnv,
    testFixture.testEnv.entityManager,
    { 'positioning:actor_being_bitten_by_me': bitingResolver }
  );
});
```

#### 2.3: Remove configureActionDiscovery Calls
**Location**: After every `testFixture.reset()` call

**Remove**:
```javascript
testFixture.reset([room, scenario.actor, scenario.target]);
configureActionDiscovery();
```

**Replace With**:
```javascript
testFixture.reset([room, scenario.actor, scenario.target]);
```

#### 2.4: Remove Unused Imports
**Location**: Top of file

**Remove**:
```javascript
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';
```

#### 2.5: Simplify afterEach
**Location**: `afterEach` block

**Replace**:
```javascript
afterEach(() => {
  clearEntityCache();
  testFixture.cleanup();
});
```

**With**:
```javascript
afterEach(() => {
  testFixture.cleanup();
});
```

#### 2.6: Verify Tests Pass
```bash
NODE_ENV=test npx jest tests/integration/mods/violence/tear_out_throat_action_discovery.test.js --no-coverage --verbose
```

---

### Step 3: Run Full Violence Mod Test Suite
**Verify** all violence mod tests still pass after migration:

```bash
NODE_ENV=test npx jest tests/integration/mods/violence/ --no-coverage --silent
```

Expected output:
```
PASS  tests/integration/mods/violence/grab_neck_action_discovery.test.js
PASS  tests/integration/mods/violence/grab_neck_action.test.js
PASS  tests/integration/mods/violence/tear_out_throat_action_discovery.test.js
PASS  tests/integration/mods/violence/tear_out_throat_action.test.js
PASS  tests/integration/mods/violence/slap_action_discovery.test.js
PASS  tests/integration/mods/violence/slap_action.test.js
```

---

### Step 4: Update Test Documentation
**File**: `tests/integration/mods/violence/README.md` (create if doesn't exist)

**Add**:
```markdown
# Violence Mod Tests

## Testing Pattern

All violence mod tests use the ModTestFixture pattern with ScopeResolverHelpers for scope registration.

### Standard Setup

\`\`\`javascript
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('violence:{action} - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('violence', '{action}');
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });
});
\`\`\`

### Custom Scopes

For actions requiring custom scope resolvers (e.g., tear_out_throat), use factory methods:

\`\`\`javascript
const customResolver = ScopeResolverHelpers.createComponentLookupResolver(
  'positioning:custom_scope',
  { componentType: 'mod:component', sourceField: 'field', contextSource: 'actor' }
);

ScopeResolverHelpers._registerResolvers(
  testFixture.testEnv,
  testFixture.testEnv.entityManager,
  { 'positioning:custom_scope': customResolver }
);
\`\`\`

## Migration History

- **2025-10-26**: Migrated from manual scope resolution to ScopeResolverHelpers (TEAOUTTHR-004)
  - Reduced boilerplate from 40+ lines to 1-7 lines per test
  - Improved maintainability and consistency
```

---

## Files to Modify
- `tests/integration/mods/violence/grab_neck_action_discovery.test.js`
- `tests/integration/mods/violence/tear_out_throat_action_discovery.test.js`
- `tests/integration/mods/violence/README.md` (create)

## Acceptance Criteria
✅ Manual scope resolution removed from both test files
✅ ScopeResolverHelpers.registerPositioningScopes() used in both files
✅ Custom scope resolver created for tear_out_throat using factory method
✅ clearEntityCache() calls removed
✅ configureActionDiscovery() functions removed
✅ All violence mod tests pass after migration
✅ Test code reduced by ~70 lines total
✅ README.md documenting new pattern created

## Testing Strategy

### Pre-Migration Baseline
```bash
# Capture baseline test results
NODE_ENV=test npx jest tests/integration/mods/violence/ --no-coverage --silent > baseline.txt
```

### Migration Verification
```bash
# Test after each file migration
NODE_ENV=test npx jest tests/integration/mods/violence/grab_neck_action_discovery.test.js --no-coverage
NODE_ENV=test npx jest tests/integration/mods/violence/tear_out_throat_action_discovery.test.js --no-coverage

# Test full suite
NODE_ENV=test npx jest tests/integration/mods/violence/ --no-coverage --silent
```

### Regression Testing
```bash
# Run complete integration test suite
NODE_ENV=test npm run test:integration -- --silent
```

## Rollback Plan
If tests fail after migration:
1. Git checkout original files
2. Review ScopeResolverHelpers implementation
3. Verify scope registration covers all required scopes
4. Check for custom scope implementation differences

## Related Tickets
- TEAOUTTHR-001: Provides documentation on ScopeResolverHelpers usage
- TEAOUTTHR-005: Similar migration for vampirism mod (can reuse patterns)
- TEAOUTTHR-006: May identify additional scopes to add to helpers library

## Success Metrics
- Test code reduction: ~70 lines removed (35 lines × 2 files)
- Manual scope implementations eliminated: 2 → 0
- Test maintainability improved: Single source of truth for scope logic
- Pattern consistency: All violence tests use same approach
- Test execution time: No degradation (same or better)
