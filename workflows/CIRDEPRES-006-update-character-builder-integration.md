# CIRDEPRES-006: Update Character Builder Integration

**Phase:** 2 (Pattern 2 - Character Builder Cache Circularity)
**Estimated Effort:** 1 hour
**Dependencies:** CIRDEPRES-005 (events file and pure helpers created)
**Related Tickets:** CIRDEPRES-005, CIRDEPRES-007
**Pattern:** Character Builder Cache Circularity (3 cycles)

---

## Objective

Update `CoreMotivationsCacheManager.js` and `characterBuilderService.js` to import CHARACTER_BUILDER_EVENTS from the new dedicated events file, breaking the three-way circular dependency.

**Current State:** Services import events from each other, creating circular chain
**Target State:** Both services import from shared events file, no circular dependencies

---

## Background

### Current Circular Dependency

After CIRDEPRES-005, we have:
- ✅ `characterBuilderEvents.js` - Shared event constants (no dependencies)
- ✅ `cacheHelpers.js` - Pure functions (no service dependencies)

**But the circular dependency still exists because:**
1. `CoreMotivationsCacheManager.js` still imports from `characterBuilderService.js`
2. `characterBuilderService.js` still imports from `cacheHelpers.js`
3. `cacheHelpers.js` may still have type references

**This ticket breaks the cycle by:**
1. Update `CoreMotivationsCacheManager.js` to import from `characterBuilderEvents.js`
2. Update `characterBuilderService.js` to import from `characterBuilderEvents.js`
3. Add re-export in `characterBuilderService.js` for backward compatibility

---

## Implementation Steps

### 1. Update CoreMotivationsCacheManager.js

**File:** `src/characterBuilder/cache/CoreMotivationsCacheManager.js`

**Find (around line 12):**
```javascript
// OLD - Creates circular dependency
import { CHARACTER_BUILDER_EVENTS } from '../services/characterBuilderService.js';
```

**Change to:**
```javascript
// Import from dedicated events file - breaks circular dependency
import { CHARACTER_BUILDER_EVENTS } from '../events/characterBuilderEvents.js';
```

**Verify usage:**
- All uses of CHARACTER_BUILDER_EVENTS still work
- Event dispatching continues to function
- No other imports from characterBuilderService.js

**Find all CHARACTER_BUILDER_EVENTS usage in file:**
```bash
grep -n "CHARACTER_BUILDER_EVENTS" src/characterBuilder/cache/CoreMotivationsCacheManager.js
```

**Expected locations:**
- Import statement (updated above)
- Event dispatching in constructor (e.g., CACHE_INITIALIZED)
- Event dispatching in cache operations (e.g., CACHE_HIT, CACHE_MISS)

**No code changes needed for usage** - only import path changes

### 2. Update characterBuilderService.js

**File:** `src/characterBuilder/services/characterBuilderService.js`

**Step 2a: Update import at top of file**

**Find (around line 50-100):**
```javascript
// OLD - Event constants defined here
export const CHARACTER_BUILDER_EVENTS = {
  CACHE_INITIALIZED: 'core:cache_initialized',
  // ... 30+ event constants
};
```

**Remove the constant definition and replace with import:**
```javascript
// Import from dedicated events file
import { CHARACTER_BUILDER_EVENTS } from '../events/characterBuilderEvents.js';

// Re-export for backward compatibility
export { CHARACTER_BUILDER_EVENTS };
```

**Step 2b: Verify cache helpers import**

**Check (around line 22):**
```javascript
import { CacheKeys, CacheInvalidation, generateCacheKey } from '../cache/cacheHelpers.js';
```

**This import should now be safe because:**
- cacheHelpers.js is now pure functions (CIRDEPRES-005)
- No type imports back to CoreMotivationsCacheManager
- No circular dependency created

**Step 2c: Update all event usage**

**Search for event usage:**
```bash
grep -n "CHARACTER_BUILDER_EVENTS" src/characterBuilder/services/characterBuilderService.js
```

**Expected locations:**
- Import and re-export statements (updated above)
- Event dispatching in service methods (no changes needed)

**No code changes needed for usage** - events still work the same way

### 3. Remove Any Remaining Type Imports from cacheHelpers.js

**File:** `src/characterBuilder/cache/cacheHelpers.js`

**Verify (this should already be done in CIRDEPRES-005, but double-check):**

```javascript
// BAD - Would create circular dependency
/**
 * @param {import('./CoreMotivationsCacheManager.js').default} cache
 */

// GOOD - Pure function signature (no service type imports)
/**
 * @param {string} type - Invalidation type
 * @param {string} [param] - Optional parameter
 * @returns {RegExp} Invalidation pattern
 */
export function getInvalidationPattern(type, param = null) {
  // ...
}
```

**Check file for any service imports:**
```bash
grep -E "import.*CoreMotivations|import.*characterBuilder" src/characterBuilder/cache/cacheHelpers.js
```

**Expected result:** No matches (no service imports)

### 4. Verify Import Paths Are Correct

**Check all three files for circular imports:**

```bash
# CoreMotivationsCacheManager should only import from events
grep "^import" src/characterBuilder/cache/CoreMotivationsCacheManager.js

# characterBuilderService should import from events and cache helpers
grep "^import" src/characterBuilder/services/characterBuilderService.js

# cacheHelpers should have no service imports
grep "^import" src/characterBuilder/cache/cacheHelpers.js
```

**Expected results:**
- CoreMotivationsCacheManager: Imports from events, utils, interfaces (no service imports)
- characterBuilderService: Imports from events, cache helpers, utils (safe)
- cacheHelpers: No imports from services or managers (pure)

---

## Testing Requirements

### Circular Dependency Verification

**Test: Three-way circular dependency broken**

```javascript
describe('Character Builder - Circular Dependency Resolution', () => {
  it('should import all three modules without circular dependency', () => {
    // This test passes if imports don't throw
    expect(() => {
      require('../../../src/characterBuilder/events/characterBuilderEvents.js');
      require('../../../src/characterBuilder/cache/cacheHelpers.js');
      require('../../../src/characterBuilder/cache/CoreMotivationsCacheManager.js');
      require('../../../src/characterBuilder/services/characterBuilderService.js');
    }).not.toThrow();
  });

  it('should use events from dedicated file in cache manager', () => {
    const { CHARACTER_BUILDER_EVENTS } = require('../../../src/characterBuilder/events/characterBuilderEvents.js');
    const { CoreMotivationsCacheManager } = require('../../../src/characterBuilder/cache/CoreMotivationsCacheManager.js');

    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockEventBus = {
      dispatch: jest.fn(),
    };

    const mockSchemaValidator = {
      validate: jest.fn(),
    };

    const manager = new CoreMotivationsCacheManager({
      logger: mockLogger,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
    });

    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CHARACTER_BUILDER_EVENTS.CACHE_INITIALIZED,
      })
    );
  });

  it('should re-export events from characterBuilderService for backward compatibility', () => {
    const { CHARACTER_BUILDER_EVENTS: eventsFromFile } = require('../../../src/characterBuilder/events/characterBuilderEvents.js');
    const { CHARACTER_BUILDER_EVENTS: eventsFromService } = require('../../../src/characterBuilder/services/characterBuilderService.js');

    // Both should reference the same constants
    expect(eventsFromService.CACHE_INITIALIZED).toBe(eventsFromFile.CACHE_INITIALIZED);
    expect(eventsFromService.CONCEPT_CREATED).toBe(eventsFromFile.CONCEPT_CREATED);
  });
});
```

### Event Dispatching Tests

**Test: Events still work correctly**

```javascript
describe('Character Builder Service - Event Integration', () => {
  let service;
  let mockEventBus;

  beforeEach(() => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      invalidatePattern: jest.fn(),
    };

    const { CharacterBuilderService } = require('../../../src/characterBuilder/services/characterBuilderService.js');

    service = new CharacterBuilderService({
      logger: mockLogger,
      eventBus: mockEventBus,
      cacheManager: mockCacheManager,
      llmService: {},
      schemaValidator: {},
    });
  });

  it('should dispatch concept created event', async () => {
    const { CHARACTER_BUILDER_EVENTS } = require('../../../src/characterBuilder/events/characterBuilderEvents.js');

    const conceptData = { id: 'test-concept', name: 'Test' };
    await service.createConcept(conceptData);

    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED,
      })
    );
  });
});
```

### Cache Integration Tests

**Test: Cache operations work with new helpers**

```javascript
describe('Cache Manager - Cache Helpers Integration', () => {
  it('should use cache helpers for key generation', () => {
    const { generateCacheKey, CacheKeys } = require('../../../src/characterBuilder/cache/cacheHelpers.js');

    const key = generateCacheKey(CacheKeys.CONCEPT_BY_ID, { id: 'test-123' });
    expect(key).toBe('concepts:by-id:test-123');
  });

  it('should use cache helpers for invalidation patterns', () => {
    const { getInvalidationPattern } = require('../../../src/characterBuilder/cache/cacheHelpers.js');

    const pattern = getInvalidationPattern('CONCEPT_RELATED', 'test-123');
    expect(pattern.test('concepts:by-id:test-123')).toBe(true);
  });
});
```

---

## Acceptance Criteria

### Import Updates
- ✅ CoreMotivationsCacheManager imports from characterBuilderEvents.js
- ✅ characterBuilderService imports from characterBuilderEvents.js
- ✅ characterBuilderService re-exports events for backward compatibility
- ✅ No imports from characterBuilderService in CoreMotivationsCacheManager

### Code Quality
- ✅ All event dispatching still works correctly
- ✅ Cache operations function properly
- ✅ No type imports that create circular dependencies
- ✅ ESLint passes for all modified files
- ✅ TypeScript type checking passes

### Functionality
- ✅ Cache initialization dispatches CACHE_INITIALIZED event
- ✅ Service operations dispatch appropriate events
- ✅ Cache invalidation uses pure helper functions
- ✅ Backward compatibility maintained for existing code

### Testing
- ✅ Circular dependency verification tests pass
- ✅ Event dispatching tests pass
- ✅ Cache integration tests pass
- ✅ All existing tests continue to pass

---

## Files Modified

### Primary Changes
1. `src/characterBuilder/cache/CoreMotivationsCacheManager.js` - Update event import
2. `src/characterBuilder/services/characterBuilderService.js` - Import and re-export events

### Test Files
3. `tests/integration/characterBuilder/circularDependencyResolution.test.js` - Verification tests (NEW)
4. `tests/unit/characterBuilder/services/characterBuilderService.test.js` - Update event tests

---

## Risk Assessment

### Low Risk
- **Import changes only**: No logic modifications
- **Backward compatible**: Re-exports maintain existing API
- **Pure helpers**: No side effects from cache helper refactoring

### Potential Issues
- **Event dispatch failures**: If import path incorrect (mitigated by tests)
- **Backward compatibility breaks**: If re-export doesn't work (mitigated by verification tests)

### Mitigation
- Test event dispatching thoroughly
- Verify re-exports work correctly
- Run all character builder tests
- Check for any runtime errors

---

## Definition of Done

- ✅ CoreMotivationsCacheManager imports from characterBuilderEvents.js
- ✅ characterBuilderService imports and re-exports events
- ✅ No circular import warnings for character builder modules
- ✅ All event dispatching works correctly
- ✅ Cache operations function properly
- ✅ Circular dependency verification tests pass
- ✅ Event integration tests pass
- ✅ All existing tests pass
- ✅ ESLint passes for modified files
- ✅ TypeScript type checking passes
- ✅ Code reviewed and approved
- ✅ Changes committed with clear commit message
- ✅ Ready for CIRDEPRES-007 (final verification)

---

## Next Steps

After completing this ticket:
1. Proceed to **CIRDEPRES-007**: Final verification and documentation
2. Run dependency-cruiser to confirm 3 character builder cycles are eliminated
3. Verify total circular dependencies reduced from 30+ to 0

---

## Verification Commands

**Check imports are correct:**
```bash
# Should show import from events file
grep "CHARACTER_BUILDER_EVENTS" src/characterBuilder/cache/CoreMotivationsCacheManager.js

# Should show import and re-export from events file
grep "CHARACTER_BUILDER_EVENTS" src/characterBuilder/services/characterBuilderService.js
```

**Check for circular dependencies:**
```bash
npm run depcruise
```

**Expected:** No warnings for character builder modules

---

**Ticket created:** 2025-10-04
**Status:** Ready for implementation
**Implements:** Phase 2, Step 2 of circular dependency resolution
**Depends on:** CIRDEPRES-005 completed successfully
