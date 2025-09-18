# COMMODMIG-009: Update Test Files

## Overview
Update 49+ test files affected by the companionship mod migration. This includes updating component references, action references, and test data factories to use the new companionship namespace.

## Prerequisites
- COMMODMIG-001 through COMMODMIG-008 (all migrations and updates complete)

## Acceptance Criteria
1. ✅ All test files updated with companionship namespace
2. ✅ Test data factories use new component IDs
3. ✅ Test fixtures updated with new namespaces
4. ✅ Integration tests reference correct mod paths
5. ✅ New companionship mod isolation tests created
6. ✅ All tests pass after updates

## Implementation Steps

### Step 1: Update Operation Handler Unit Tests

#### Update establishFollowRelationHandler.test.js
Location: `tests/unit/logic/operationHandlers/establishFollowRelationHandler.test.js`

```javascript
// Update imports
import { FOLLOWING_COMPONENT_ID, LEADING_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

// Update component references
// Before:
expect(entityManager.addComponent).toHaveBeenCalledWith('follower', 'core:following', { leaderId: 'leader' });

// After:
expect(entityManager.addComponent).toHaveBeenCalledWith('follower', FOLLOWING_COMPONENT_ID, { leaderId: 'leader' });
```

#### Update other operation handler tests similarly:
- `breakFollowRelationHandler.test.js`
- `checkFollowCycleHandler.test.js`
- `autoMoveFollowersHandler.test.js`
- `rebuildLeaderListCacheHandler.test.js`

### Step 2: Update Schema Validation Tests

#### Update follow.schema.test.js
Location: `tests/unit/schemas/follow.schema.test.js`

```javascript
// Update action references
// Before:
const followAction = {
  id: 'core:follow',
  // ...
};

// After:
const followAction = {
  id: 'companionship:follow',
  // ...
};
```

#### Update related schema tests:
- `dismiss.schema.test.js`
- `followAutoMove.schema.test.js`
- `stopFollowing.schema.test.js`

### Step 3: Update Action Discovery Tests

#### Update ActionDiscoveryWorkflow.e2e.test.js
Location: `tests/e2e/actions/ActionDiscoveryWorkflow.e2e.test.js`

```javascript
// Update expected action IDs
// Before:
expect(actions).toContain('core:follow');
expect(actions).toContain('core:dismiss');

// After:
expect(actions).toContain('companionship:follow');
expect(actions).toContain('companionship:dismiss');

// Update action file paths
// Before:
const followAction = loadAction('data/mods/core/actions/follow.action.json');

// After:
const followAction = loadAction('data/mods/companionship/actions/follow.action.json');
```

### Step 4: Update Rule Integration Tests

#### Update followRule.integration.test.js
Location: `tests/integration/core/rules/followRule.integration.test.js`

Move to: `tests/integration/companionship/rules/followRule.integration.test.js`

```javascript
// Update rule loading
// Before:
const rule = loadRule('data/mods/core/rules/follow.rule.json');

// After:
const rule = loadRule('data/mods/companionship/rules/follow.rule.json');

// Update component expectations
// Before:
expect(entity).toHaveComponent('core:following');

// After:
expect(entity).toHaveComponent('companionship:following');
```

#### Update related rule tests:
- `dismissRule.integration.test.js`
- `stopFollowingRule.integration.test.js`
- `followAutoMove.integration.test.js`

### Step 5: Update Test Data Factories

#### Update testDataFactory.js
Location: `tests/common/testDataFactory.js`

```javascript
// Update component creation helpers
// Before:
export function createFollowingComponent(leaderId) {
  return {
    componentId: 'core:following',
    data: { leaderId }
  };
}

// After:
export function createFollowingComponent(leaderId) {
  return {
    componentId: 'companionship:following',
    data: { leaderId }
  };
}

// Similar updates for leading component
```

#### Update actionTestUtilities.js
Location: `tests/common/actions/actionTestUtilities.js`

```javascript
// Update action ID constants
// Before:
export const FOLLOW_ACTION_ID = 'core:follow';
export const DISMISS_ACTION_ID = 'core:dismiss';

// After:
export const FOLLOW_ACTION_ID = 'companionship:follow';
export const DISMISS_ACTION_ID = 'companionship:dismiss';
```

### Step 6: Update Scope DSL Tests

#### Update scopeDefinitionParser.test.js
Location: `tests/unit/scopeDsl/scopeDefinitionParser.test.js`

```javascript
// Update scope references
// Before:
const scope = 'actor.core:leading.followers[]';

// After:
const scope = 'actor.companionship:leading.followers[]';
```

### Step 7: Update DOM UI Tests

#### Update rendering tests that display actions
Location: `tests/unit/domUI/`

```javascript
// Update expected colors for actions
// Before:
expect(actionElement.style.backgroundColor).toBe('#455a64');

// After:
expect(actionElement.style.backgroundColor).toBe('#00695c');
```

### Step 8: Create New Companionship Mod Tests

Create new test file: `tests/integration/companionship/modLoading.integration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Companionship Mod Loading', () => {
  let modLoader;

  beforeEach(() => {
    modLoader = createModLoader();
  });

  it('should load companionship mod successfully', async () => {
    const mod = await modLoader.load('companionship');

    expect(mod.id).toBe('companionship');
    expect(mod.dependencies).toContain('core');
    expect(mod.dependencies).toContain('movement');
  });

  it('should register all companionship components', async () => {
    await modLoader.load('companionship');

    expect(componentRegistry.has('companionship:following')).toBe(true);
    expect(componentRegistry.has('companionship:leading')).toBe(true);
  });

  it('should register all companionship actions', async () => {
    await modLoader.load('companionship');

    expect(actionRegistry.has('companionship:follow')).toBe(true);
    expect(actionRegistry.has('companionship:stop_following')).toBe(true);
    expect(actionRegistry.has('companionship:dismiss')).toBe(true);
  });
});
```

### Step 9: Run and Fix Tests Systematically

Run tests in groups to identify and fix issues:

```bash
# 1. Run unit tests for operation handlers
npm run test:unit -- tests/unit/logic/operationHandlers/

# 2. Run schema tests
npm run test:unit -- tests/unit/schemas/

# 3. Run action discovery tests
npm run test:e2e -- tests/e2e/actions/

# 4. Run rule integration tests
npm run test:integration -- tests/integration/companionship/

# 5. Run all tests
npm run test
```

## Major Test Categories to Update

### Unit Tests (25+ files)
- Operation handler tests (5 files)
- Schema validation tests (5 files)
- Scope DSL tests (3 files)
- Command processor tests (2 files)
- DOM UI tests (5 files)
- Utility function tests (5 files)

### Integration Tests (15+ files)
- Rule execution tests (4 files)
- Mod loading tests (2 files)
- Action discovery tests (3 files)
- Scope resolution tests (3 files)
- Save/load tests (3 files)

### E2E Tests (5+ files)
- Action workflow tests (2 files)
- Following behavior tests (2 files)
- UI interaction tests (1 file)

### Performance Tests (4+ files)
- Action discovery performance (2 files)
- Scope resolution performance (2 files)

## Common Test Update Patterns

### Component Reference Update
```javascript
// Before:
'core:following' → 'companionship:following'
'core:leading' → 'companionship:leading'

// After: Use constants where possible
import { FOLLOWING_COMPONENT_ID, LEADING_COMPONENT_ID } from '../src/constants/componentIds.js';
```

### Action Reference Update
```javascript
// Before:
'core:follow' → 'companionship:follow'
'core:dismiss' → 'companionship:dismiss'
'core:stop_following' → 'companionship:stop_following'
```

### File Path Update
```javascript
// Before:
'data/mods/core/actions/follow.action.json'

// After:
'data/mods/companionship/actions/follow.action.json'
```

### Color Assertion Update
```javascript
// Before:
backgroundColor: '#455a64'

// After:
backgroundColor: '#00695c'
```

## Notes
- Some tests may need to be moved to new directories (e.g., from core to companionship)
- Create new test directories as needed: `tests/integration/companionship/`, `tests/unit/companionship/`
- Consider using constants for component IDs in tests for easier future updates
- Run tests incrementally to catch issues early

## Dependencies
- Blocks: COMMODMIG-010 (final integration)
- Blocked by: COMMODMIG-001 through COMMODMIG-008

## Estimated Effort
- 3-4 hours (due to large number of files)

## Risk Assessment
- **High Volume**: 49+ files to update
- **Test Fragility**: Tests may have complex setup/teardown
- **Mitigation**: Update systematically by category, run tests frequently

## Success Metrics
- All test files updated with new namespaces
- No references to old core namespace in companionship tests
- All tests pass
- New companionship mod isolation tests pass
- Test coverage maintained at 80%+