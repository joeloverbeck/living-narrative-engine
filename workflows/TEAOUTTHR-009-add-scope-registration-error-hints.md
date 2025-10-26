# TEAOUTTHR-009: Add Scope Registration Hints to Error Messages

> **⚠️ Workflow Validated**: This workflow has been validated against the actual codebase by the workflow-assumptions-validator agent. All class names, method names, field names, and code locations have been corrected to match the current implementation.

## Overview
**Priority**: P2 (Long-term)
**Effort**: 4 hours
**Impact**: Medium
**Dependencies**: TEAOUTTHR-008 (Auto-registration must be implemented first)

## Problem Statement
When action discovery fails due to missing scope registration, developers see:
- Empty `availableActions` array `[]`
- No error message or guidance
- No indication that scope registration is the problem
- Must manually debug or consult documentation

**Current Experience**:
```javascript
const availableActions = await testFixture.discoverActions(scenario.actor.id);
expect(availableActions).toContain('violence:tear_out_throat');
// ❌ Test fails: Expected array containing 'violence:tear_out_throat', received []
// No hint about WHY it failed
```

**Desired Experience**:
```javascript
const availableActions = await testFixture.discoverActions(scenario.actor.id);
// ⚠️ Console Warning:
//    Action discovery found 0 actions for actor 'alice'
//
//    The action 'violence:tear_out_throat' uses scope 'positioning:actor_being_bitten_by_me'
//    which is not registered in the test environment.
//
//    Add this to your test setup:
//
//    beforeEach(async () => {
//      testFixture = await ModTestFixture.forAction('violence', 'tear_out_throat', {
//        autoRegisterScopes: true
//      });
//    });
//
//    Or use manual registration:
//
//    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
```

## Goals
1. Detect scope resolution failures in action discovery
2. Provide helpful console warnings with registration code examples
3. Identify known scopes and suggest appropriate registration method
4. Create self-documenting error messages that guide developers to solutions
5. Make scope errors immediately obvious without debugging

## Implementation Steps

### Step 1: Create Scope Registry for Known Scopes

**File**: `tests/common/mods/ModActionTestFixture.js` (instance class, extends BaseModTestFixture)

**Add Instance Property in Constructor**:
```javascript
/**
 * Registry of known scopes and their registration categories
 * Stored as instance property for access in instance methods
 * @private
 */
this._knownScopes = {
  positioning: [
    'positioning:furniture_actor_sitting_on',
    'positioning:actors_sitting_on_same_furniture',
    'positioning:closest_leftmost_occupant',
    'positioning:closest_rightmost_occupant',
    'positioning:furniture_allowing_sitting_at_location',
    'positioning:standing_actors_at_location',
    'positioning:sitting_actors',
    'positioning:kneeling_actors',
    'positioning:furniture_actor_behind',
    'positioning:actor_being_bitten_by_me',
    'positioning:close_actors_facing_each_other_or_behind_target',
    'positioning:close_actors',
    'positioning:close_actors_facing_each_other',
    // ... add more as discovered
  ],
  inventory: [
    'items:actor_inventory',
    'items:items_at_location',
    'items:containers_at_location',
    'items:equipped_items',
    'items:items_in_container',
    // ... add more as discovered
  ],
  anatomy: [
    'anatomy:body_parts',
    'anatomy:accessible_body_parts',
    'anatomy:covered_body_parts',
    // ... add more as discovered
  ],
};
```

---

### Step 2: Add Scope Detection Helper

**File**: `tests/common/mods/ModActionTestFixture.js`

**Add Instance Method**:
```javascript
/**
 * Detect which category a scope belongs to
 *
 * @private
 * @param {string} scopeName - Scope to categorize
 * @returns {string|null} Category name or null if unknown
 */
_detectScopeCategory(scopeName) {
  for (const [category, scopes] of Object.entries(this._knownScopes)) {
    if (scopes.includes(scopeName)) {
      return category;
    }
  }
  return null;
}
```

---

### Step 3: Load Action Definition Eagerly

**File**: `tests/common/mods/ModActionTestFixture.js`

**Add to initialize() method** (before it's needed for hints):
```javascript
async initialize() {
  // ... existing initialization ...

  // Load action definition eagerly so it's available for hint generation
  const actionLoader = this.testEnv.container.resolve('IActionLoader');
  this._actionDefinition = await actionLoader.loadAction(this.actionId);

  // ... rest of initialization ...
}
```

---

### Step 4: Add Hint Method with Correct Field Access

**File**: `tests/common/mods/ModActionTestFixture.js`

**Add Instance Method**:
```javascript
/**
 * Provide helpful hint when action discovery fails
 *
 * @private
 * @param {string} actorId - Actor ID
 * @param {string[]} availableActions - Discovered actions (empty)
 */
_provideActionDiscoveryHint(actorId, availableActions) {
  // Only provide hint if no actions discovered
  if (availableActions.length > 0) return;

  // Check if we have a loaded action definition
  if (!this._actionDefinition) return;

  const actionId = this._actionDefinition.id;

  // Extract scope name from action definition (verify actual schema structure)
  const scopeName = this._actionDefinition.targets;

  // Only provide hint if action uses a scope
  if (!scopeName) return;

  // Check if scope is known
  const category = this._detectScopeCategory(scopeName);

  if (category) {
    console.warn(`
⚠️  Action Discovery Hint

Action discovery returned 0 actions for actor '${actorId}'.

The action '${actionId}' uses scope '${scopeName}' which is not registered.

💡 Solution 1 (Recommended): Enable auto-registration

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    '${this.modId}',
    '${this.actionId.split(':')[1]}',
    { autoRegisterScopes: true }
  );
});

💡 Solution 2: Manual registration

import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('${this.modId}', '${this.actionId.split(':')[1]}');
  ScopeResolverHelpers.register${this._capitalize(category)}Scopes(testFixture.testEnv);
});

📚 Documentation: See docs/testing/mod-testing-guide.md#testing-actions-with-custom-scopes
    `.trim());
  } else {
    // Unknown scope - suggest custom resolver
    console.warn(`
⚠️  Action Discovery Hint

Action discovery returned 0 actions for actor '${actorId}'.

The action '${actionId}' uses scope '${scopeName}' which is not in the standard library.

💡 Solution: Create custom scope resolver

import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('${this.modId}', '${this.actionId.split(':')[1]}');

  // Register standard scopes first
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // Create custom resolver for ${scopeName}
  const customResolver = ScopeResolverHelpers.createComponentLookupResolver(
    '${scopeName}',
    {
      componentType: 'mod:component',  // Update with actual component
      sourceField: 'field',             // Update with actual field
      contextSource: 'actor'
    }
  );

  ScopeResolverHelpers._registerResolvers(
    testFixture.testEnv,
    testFixture.testEnv.entityManager,
    { '${scopeName}': customResolver }
  );
});

📚 Documentation: See docs/testing/scope-resolver-registry.md#creating-custom-scope-resolvers
    `.trim());
  }
}

/**
 * Capitalize first letter
 * @private
 */
_capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

---

### Step 5: Integrate Hint into discoverActions

**File**: `tests/common/mods/ModActionTestFixture.js`

**Update Method** (correct method name is `discoverActions`, not `getAvailableActions`):
```javascript
async discoverActions(actorId) {
  // ... existing action discovery logic ...

  const availableActions = /* discovery result */;

  // Provide hint if no actions discovered
  this._provideActionDiscoveryHint(actorId, availableActions);

  return availableActions;
}
```

**Note**: The actual method is at line 1670 in ModActionTestFixture.js

---

### Step 6: Add Opt-Out Mechanism

**File**: `tests/common/mods/ModActionTestFixture.js`

**Add to Constructor**:
```javascript
constructor(/* ... */) {
  // ... existing initialization ...

  this._suppressHints = false; // Default: show hints
}

/**
 * Suppress action discovery hints (for tests that expect empty results)
 */
suppressHints() {
  this._suppressHints = true;
}

/**
 * Enable action discovery hints
 */
enableHints() {
  this._suppressHints = false;
}
```

**Update Hint Method**:
```javascript
_provideActionDiscoveryHint(actorId, availableActions) {
  // Skip if hints suppressed
  if (this._suppressHints) return;

  // ... rest of implementation
}
```

---

### Step 7: Create Unit Tests

**File**: `tests/unit/common/mods/ModActionTestFixture.hints.test.js` (create)

**Test Suite**:
```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('ModTestFixture - Error Hints', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('scope registration hints', () => {
    it('should provide hint when known scope not registered', async () => {
      const testFixture = await ModTestFixture.forAction('violence', 'grab_neck');
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act - discover actions without registering scopes
      const availableActions = await testFixture.discoverActions(scenario.actor.id);

      // Assert - should have warned
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warning = consoleWarnSpy.mock.calls[0][0];
      expect(warning).toContain('Action Discovery Hint');
      expect(warning).toContain('positioning:close_actors');
      expect(warning).toContain('autoRegisterScopes: true');
      expect(warning).toContain('registerPositioningScopes');
    });

    it('should not provide hint when scopes registered', async () => {
      const testFixture = await ModTestFixture.forAction(
        'violence',
        'grab_neck',
        { autoRegisterScopes: true }
      );
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act
      const availableActions = await testFixture.discoverActions(scenario.actor.id);

      // Assert - should not have warned
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should provide custom resolver hint for unknown scopes', async () => {
      // Create action with custom scope
      const testFixture = await ModTestFixture.forAction('custom_mod', 'custom_action');
      // Assume custom_action uses unknown scope

      // Act
      const availableActions = await testFixture.discoverActions('actor1');

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warning = consoleWarnSpy.mock.calls[0][0];
      expect(warning).toContain('Create custom scope resolver');
      expect(warning).toContain('createComponentLookupResolver');
    });

    it('should allow suppressing hints', async () => {
      const testFixture = await ModTestFixture.forAction('violence', 'grab_neck');
      testFixture.suppressHints(); // Suppress hints

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act
      const availableActions = await testFixture.discoverActions(scenario.actor.id);

      // Assert - should not have warned
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
```

---

### Step 8: Update Documentation

**File**: `docs/testing/mod-testing-guide.md`

**Add Section** (after "Action Discovery Troubleshooting Checklist"):
```markdown
### Self-Documenting Error Hints

ModTestFixture provides automatic hints when action discovery fails due to missing scope registration:

\`\`\`javascript
const availableActions = await testFixture.discoverActions(scenario.actor.id);
// ⚠️ Console Warning:
//    Action discovery found 0 actions
//    The action uses scope 'positioning:close_actors' which is not registered
//    Solution: Enable auto-registration or call registerPositioningScopes()
\`\`\`

**Suppressing Hints** (for tests expecting empty results):
\`\`\`javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'grab_neck');
  testFixture.suppressHints(); // Don't warn for this test
});
\`\`\`
```

---

## Files to Modify
- `tests/common/mods/ModActionTestFixture.js` (add hint system to instance class)
- `tests/unit/common/mods/ModActionTestFixture.hints.test.js` (create)
- `docs/testing/mod-testing-guide.md` (document hints)

## Important Notes on Implementation

### Class Structure
- **ModTestFixture**: Factory class with static methods (`forAction`, `forRule`, etc.)
- **ModActionTestFixture**: Instance class (extends BaseModTestFixture) where hints should be added
- All instance methods and properties go in `ModActionTestFixture`, not `ModTestFixture`

### Field Names
- Use `this.modId` (not `this._modId`)
- Use `this.actionId` (not `this._actionName`)
- Action ID is namespaced format: `modId:actionName`
- Extract action name with `this.actionId.split(':')[1]`

### Method Names
- Actual method is `discoverActions(actorId)` (line 1670)
- NOT `getAvailableActions(actorId)`
- Integration point is in the `discoverActions` method

### Action Definition Loading
- Currently lazy-loaded in `executeAction()` method
- Must be loaded eagerly in `initialize()` for hint access
- Use `IActionLoader.loadAction(this.actionId)` to load
- Store in `this._actionDefinition` instance field

### Action Schema Verification Required
- Verify that action definitions actually have a `targets` field containing scope name
- Add defensive checks if field structure differs
- May need to adjust scope detection logic based on actual schema

## Acceptance Criteria
✅ Scope registry for known scopes added to ModActionTestFixture (instance property)
✅ Scope detection helper implemented (instance method)
✅ Action definition loaded eagerly in initialize() method
✅ Action discovery hints integrated into discoverActions method
✅ Hints suggest auto-registration for known scopes
✅ Hints suggest custom resolver for unknown scopes
✅ Opt-out mechanism (suppressHints) implemented
✅ Unit tests created (80%+ coverage)
✅ Documentation updated
✅ Hints are helpful, actionable, and copy-pasteable
✅ All code examples use correct class, method, and field names

## Testing Strategy

### Unit Testing
```bash
NODE_ENV=test npx jest tests/unit/common/mods/ModActionTestFixture.hints.test.js --no-coverage --verbose
```

### Manual Testing
```bash
# Create test that doesn't register scopes
# Verify helpful warning appears in console
NODE_ENV=test npx jest tests/integration/mods/violence/grab_neck_action_discovery.test.js --no-coverage --verbose
```

### Integration Testing
```bash
# All tests should still pass
NODE_ENV=test npm run test:integration
```

## Rollback Plan
If hints cause issues:
1. Add environment variable to disable hints globally
2. Make hints opt-in instead of opt-out
3. Reduce hint verbosity
4. Remove hints entirely (keep scope detection code for future use)

## Related Tickets
- TEAOUTTHR-001: Documentation that hints reference
- TEAOUTTHR-002: Troubleshooting checklist complemented by hints
- TEAOUTTHR-008: Auto-registration that hints recommend

## Success Metrics
- Developers immediately understand why action discovery failed
- Hints reduce debugging time from minutes to seconds
- Copy-pasteable code examples in hints
- Positive developer feedback on hint usefulness
- Reduced questions about empty availableActions arrays
