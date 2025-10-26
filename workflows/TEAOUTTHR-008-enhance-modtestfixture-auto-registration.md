# TEAOUTTHR-008: Enhance ModTestFixture with Auto-Registration

## Overview
**Priority**: P2 (Long-term)
**Effort**: 16 hours
**Impact**: High
**Dependencies**:
- TEAOUTTHR-001 (Documentation patterns)
- TEAOUTTHR-004, TEAOUTTHR-005 (Migration patterns)
- TEAOUTTHR-006 (Expanded scope coverage)

## Problem Statement
Even with ScopeResolverHelpers, developers must manually call registration methods in every test:

```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'grab_neck');

  // REQUIRED manual call - easy to forget
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
```

This creates friction:
- Easy to forget, causing mysterious empty `availableActions` arrays
- Repetitive boilerplate across all test files
- No guidance on which scopes to register
- Doesn't follow "convention over configuration" principle

## Goals
1. Add optional `autoRegisterScopes` parameter to `ModTestFixture.forAction()`
2. Support selective scope category registration via `scopeCategories` parameter
3. Maintain full backward compatibility (opt-in behavior)
4. Provide intelligent defaults for common use cases
5. Document new API thoroughly
6. Update TypeScript types and JSDoc
7. Create migration guide for existing tests

## Implementation Steps

### Step 1: Enhance ModTestFixture.forAction Signature

**File**: `tests/common/mods/ModTestFixture.js`

**Current Signature**:
```javascript
/**
 * @param {string} modId - Mod identifier
 * @param {string} actionName - Action name without prefix
 */
static async forAction(modId, actionName) {
  // ... existing implementation
}
```

**Enhanced Signature**:
```javascript
/**
 * Create test fixture for mod action
 *
 * @param {string} modId - Mod identifier
 * @param {string} actionName - Action name without prefix (not fullActionId)
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.autoRegisterScopes=false] - Auto-register dependency mod scopes
 * @param {string[]} [options.scopeCategories=['positioning']] - Which scope categories to register
 * @returns {Promise<ModTestFixture>}
 *
 * @example
 * // Manual scope registration (backward compatible)
 * const fixture = await ModTestFixture.forAction('violence', 'grab_neck');
 * ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
 *
 * @example
 * // Auto-register positioning scopes
 * const fixture = await ModTestFixture.forAction(
 *   'violence',
 *   'grab_neck',
 *   { autoRegisterScopes: true }
 * );
 *
 * @example
 * // Auto-register multiple scope categories
 * const fixture = await ModTestFixture.forAction(
 *   'intimacy',
 *   'caress_face',
 *   {
 *     autoRegisterScopes: true,
 *     scopeCategories: ['positioning', 'anatomy']
 *   }
 * );
 */
static async forAction(modId, actionName, options = {}) {
  const {
    autoRegisterScopes = false,
    scopeCategories = ['positioning'],
  } = options;

  // Create fixture with existing logic
  const testFixture = await this._createFixture(modId, actionName);

  // Auto-register scopes if requested
  if (autoRegisterScopes) {
    this._registerScopeCategories(testFixture.testEnv, scopeCategories);
  }

  return testFixture;
}
```

---

### Step 2: Implement _registerScopeCategories Helper

**File**: `tests/common/mods/ModTestFixture.js`

**Add Private Static Method**:
```javascript
/**
 * Register scope categories based on configuration
 *
 * @private
 * @param {object} testEnv - Test environment
 * @param {string[]} categories - Scope categories to register
 */
static _registerScopeCategories(testEnv, categories) {
  const { ScopeResolverHelpers } = require('./scopeResolverHelpers.js');

  for (const category of categories) {
    switch (category) {
      case 'positioning':
        ScopeResolverHelpers.registerPositioningScopes(testEnv);
        break;

      case 'inventory':
      case 'items':
        ScopeResolverHelpers.registerInventoryScopes(testEnv);
        break;

      case 'anatomy':
        ScopeResolverHelpers.registerAnatomyScopes(testEnv);
        break;

      default:
        console.warn(
          `Unknown scope category "${category}". Valid categories: positioning, inventory, anatomy`
        );
    }
  }
}
```

---

### Step 3: Add Validation for Options Parameter

**File**: `tests/common/mods/ModTestFixture.js`

**Add Validation Function**:
```javascript
/**
 * Validate forAction options
 *
 * @private
 * @param {object} options - Options to validate
 * @throws {Error} If options are invalid
 */
static _validateForActionOptions(options) {
  if (typeof options !== 'object' || options === null) {
    throw new Error('Options must be an object');
  }

  const { autoRegisterScopes, scopeCategories } = options;

  if (autoRegisterScopes !== undefined && typeof autoRegisterScopes !== 'boolean') {
    throw new Error('autoRegisterScopes must be a boolean');
  }

  if (scopeCategories !== undefined) {
    if (!Array.isArray(scopeCategories)) {
      throw new Error('scopeCategories must be an array');
    }

    const validCategories = ['positioning', 'inventory', 'items', 'anatomy'];
    const invalidCategories = scopeCategories.filter(
      (cat) => !validCategories.includes(cat)
    );

    if (invalidCategories.length > 0) {
      throw new Error(
        `Invalid scope categories: ${invalidCategories.join(', ')}. ` +
          `Valid categories: ${validCategories.join(', ')}`
      );
    }
  }
}
```

**Update forAction to Use Validation**:
```javascript
static async forAction(modId, actionName, options = {}) {
  // Validate options
  this._validateForActionOptions(options);

  const {
    autoRegisterScopes = false,
    scopeCategories = ['positioning'],
  } = options;

  // ... rest of implementation
}
```

---

### Step 4: Add Unit Tests for New API

**File**: `tests/unit/common/mods/ModTestFixture.autoRegistration.test.js` (create)

**Test Suite**:
```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

// Mock ScopeResolverHelpers
jest.mock('../../../common/mods/scopeResolverHelpers.js');

describe('ModTestFixture - Auto-Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('forAction with autoRegisterScopes', () => {
    it('should not auto-register scopes by default', async () => {
      // Act
      const fixture = await ModTestFixture.forAction('violence', 'grab_neck');

      // Assert
      expect(ScopeResolverHelpers.registerPositioningScopes).not.toHaveBeenCalled();
    });

    it('should auto-register positioning scopes when enabled', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'violence',
        'grab_neck',
        { autoRegisterScopes: true }
      );

      // Assert
      expect(ScopeResolverHelpers.registerPositioningScopes).toHaveBeenCalledWith(
        fixture.testEnv
      );
    });

    it('should auto-register multiple scope categories', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'intimacy',
        'caress_face',
        {
          autoRegisterScopes: true,
          scopeCategories: ['positioning', 'anatomy'],
        }
      );

      // Assert
      expect(ScopeResolverHelpers.registerPositioningScopes).toHaveBeenCalledWith(
        fixture.testEnv
      );
      expect(ScopeResolverHelpers.registerAnatomyScopes).toHaveBeenCalledWith(
        fixture.testEnv
      );
    });

    it('should accept "items" alias for inventory category', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'items',
        'pick_up_item',
        {
          autoRegisterScopes: true,
          scopeCategories: ['items'],
        }
      );

      // Assert
      expect(ScopeResolverHelpers.registerInventoryScopes).toHaveBeenCalledWith(
        fixture.testEnv
      );
    });
  });

  describe('options validation', () => {
    it('should reject non-boolean autoRegisterScopes', async () => {
      // Act & Assert
      await expect(
        ModTestFixture.forAction('violence', 'grab_neck', {
          autoRegisterScopes: 'true', // ❌ string instead of boolean
        })
      ).rejects.toThrow('autoRegisterScopes must be a boolean');
    });

    it('should reject non-array scopeCategories', async () => {
      // Act & Assert
      await expect(
        ModTestFixture.forAction('violence', 'grab_neck', {
          autoRegisterScopes: true,
          scopeCategories: 'positioning', // ❌ string instead of array
        })
      ).rejects.toThrow('scopeCategories must be an array');
    });

    it('should reject invalid scope categories', async () => {
      // Act & Assert
      await expect(
        ModTestFixture.forAction('violence', 'grab_neck', {
          autoRegisterScopes: true,
          scopeCategories: ['positioning', 'invalid_category'],
        })
      ).rejects.toThrow('Invalid scope categories: invalid_category');
    });

    it('should accept all valid scope categories', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'mod',
        'action',
        {
          autoRegisterScopes: true,
          scopeCategories: ['positioning', 'inventory', 'anatomy'],
        }
      );

      // Assert - should not throw
      expect(fixture).toBeDefined();
    });
  });

  describe('backward compatibility', () => {
    it('should work without options parameter', async () => {
      // Act
      const fixture = await ModTestFixture.forAction('violence', 'grab_neck');

      // Assert
      expect(fixture).toBeDefined();
      expect(ScopeResolverHelpers.registerPositioningScopes).not.toHaveBeenCalled();
    });

    it('should work with empty options object', async () => {
      // Act
      const fixture = await ModTestFixture.forAction('violence', 'grab_neck', {});

      // Assert
      expect(fixture).toBeDefined();
      expect(ScopeResolverHelpers.registerPositioningScopes).not.toHaveBeenCalled();
    });
  });
});
```

---

### Step 5: Create Integration Tests

**File**: `tests/integration/common/mods/ModTestFixture.autoRegistration.integration.test.js`

**Test Real Scope Registration**:
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('ModTestFixture - Auto-Registration Integration', () => {
  let testFixture;

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('should discover action when scopes auto-registered', async () => {
    // Arrange
    testFixture = await ModTestFixture.forAction(
      'violence',
      'grab_neck',
      { autoRegisterScopes: true }
    );

    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

    // Act
    const availableActions = await testFixture.getAvailableActions(scenario.actor.id);

    // Assert
    expect(availableActions).toContain('violence:grab_neck');
  });

  it('should work with multiple scope categories', async () => {
    // Arrange
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'caress_face',
      {
        autoRegisterScopes: true,
        scopeCategories: ['positioning', 'anatomy'],
      }
    );

    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

    // Act
    const availableActions = await testFixture.getAvailableActions(scenario.actor.id);

    // Assert
    expect(availableActions).toContain('intimacy:caress_face');
  });

  it('should maintain backward compatibility with manual registration', async () => {
    // Arrange
    testFixture = await ModTestFixture.forAction('violence', 'grab_neck');
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

    // Act
    const availableActions = await testFixture.getAvailableActions(scenario.actor.id);

    // Assert
    expect(availableActions).toContain('violence:grab_neck');
  });
});
```

---

### Step 6: Update Documentation

#### 6.1: Update mod-testing-guide.md

**Location**: "Quick Start" section

**Add**:
```markdown
### Zero-Config Testing (Recommended)

For most actions, you can enable auto-registration to eliminate scope configuration boilerplate:

\`\`\`javascript
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('violence:grab_neck - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    // Auto-register positioning scopes
    testFixture = await ModTestFixture.forAction(
      'violence',
      'grab_neck',
      { autoRegisterScopes: true }
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should discover action when actor and target are close', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
    const availableActions = await testFixture.getAvailableActions(scenario.actor.id);

    expect(availableActions).toContain('violence:grab_neck');
  });
});
\`\`\`

**Multiple Scope Categories**:

\`\`\`javascript
testFixture = await ModTestFixture.forAction(
  'intimacy',
  'caress_face',
  {
    autoRegisterScopes: true,
    scopeCategories: ['positioning', 'anatomy']
  }
);
\`\`\`

**Backward Compatible** - Manual registration still works:

\`\`\`javascript
testFixture = await ModTestFixture.forAction('violence', 'grab_neck');
ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
\`\`\`
```

#### 6.2: Update API Reference Section

**Add to ModTestFixture API section**:
```markdown
#### forAction(modId, actionName, [options])

Create test fixture for mod action.

**Parameters**:
- `modId` (string): Mod identifier
- `actionName` (string): Action name without prefix (not fullActionId)
- `options` (object, optional): Configuration options
  - `autoRegisterScopes` (boolean): Auto-register dependency mod scopes (default: false)
  - `scopeCategories` (string[]): Scope categories to register (default: ['positioning'])

**Valid Scope Categories**:
- `'positioning'` - Sitting, standing, closeness, facing scopes
- `'inventory'` or `'items'` - Item, container, inventory scopes
- `'anatomy'` - Body part, anatomy interaction scopes

**Examples**:
[Include examples from above]
```

---

### Step 7: Create Migration Guide

**File**: `docs/testing/TEAOUTTHR-008-auto-registration-migration.md`

**Content**:
```markdown
# Migration Guide: Auto-Registration in ModTestFixture

## Overview
ModTestFixture now supports automatic scope registration, eliminating manual `ScopeResolverHelpers.register*Scopes()` calls.

## Migration Pattern

### Before (Manual Registration)
\`\`\`javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('violence', 'grab_neck');
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
\`\`\`

### After (Auto-Registration)
\`\`\`javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    'violence',
    'grab_neck',
    { autoRegisterScopes: true }
  );
});
\`\`\`

**Benefits**:
- 2 lines → 1 line
- No import of ScopeResolverHelpers needed
- Explicit opt-in behavior
- Easy to forget → Impossible to forget

## When to Use Auto-Registration

✅ **Use Auto-Registration** when:
- Action uses standard positioning/inventory/anatomy scopes
- You want zero-config testing
- You're creating new tests

⚠️ **Use Manual Registration** when:
- Action uses custom scopes (not in standard library)
- You need fine-grained control over registered scopes
- Migrating existing tests (optional)

## Multiple Scope Categories

\`\`\`javascript
// Before
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('intimacy', 'caress_face');
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);
});

// After
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    'intimacy',
    'caress_face',
    {
      autoRegisterScopes: true,
      scopeCategories: ['positioning', 'anatomy']
    }
  );
});
\`\`\`

## Backward Compatibility

No changes required to existing tests - auto-registration is opt-in. Your tests will continue to work with manual registration.
```

---

## Files to Modify
- `tests/common/mods/ModTestFixture.js` (enhance API)
- `tests/unit/common/mods/ModTestFixture.autoRegistration.test.js` (create)
- `tests/integration/common/mods/ModTestFixture.autoRegistration.integration.test.js` (create)
- `docs/testing/mod-testing-guide.md` (update Quick Start and API sections)
- `docs/testing/TEAOUTTHR-008-auto-registration-migration.md` (create)

## Acceptance Criteria
✅ `autoRegisterScopes` parameter added to `forAction()`
✅ `scopeCategories` parameter supports positioning, inventory, anatomy
✅ Options validation implemented with clear error messages
✅ Backward compatibility maintained (opt-in behavior)
✅ Unit tests created (80%+ coverage)
✅ Integration tests verify real scope registration
✅ JSDoc updated with examples
✅ Documentation updated in mod-testing-guide.md
✅ Migration guide created
✅ All existing tests pass without modification

## Testing Strategy

### Unit Testing
```bash
NODE_ENV=test npx jest tests/unit/common/mods/ModTestFixture.autoRegistration.test.js --no-coverage --verbose
```

### Integration Testing
```bash
NODE_ENV=test npx jest tests/integration/common/mods/ModTestFixture.autoRegistration.integration.test.js --no-coverage --verbose
```

### Regression Testing
```bash
# All existing tests should still pass
NODE_ENV=test npm run test:unit
NODE_ENV=test npm run test:integration
```

## Rollback Plan
If auto-registration causes issues:
1. Keep new API but default `autoRegisterScopes` to `false`
2. Document as experimental feature
3. Gather feedback from developers
4. Iterate on implementation

## Related Tickets
- TEAOUTTHR-001: Documentation on ScopeResolverHelpers
- TEAOUTTHR-006: Expanded scope coverage enables auto-registration
- TEAOUTTHR-007: Registry documentation helps developers choose scope categories

## Success Metrics
- Zero-config testing for 90% of actions
- Test setup reduced from 2+ lines to 1 line (50% reduction)
- No manual scope registration needed for standard scopes
- Backward compatibility: 100% of existing tests work unchanged
- Developer satisfaction: Positive feedback on reduced boilerplate
