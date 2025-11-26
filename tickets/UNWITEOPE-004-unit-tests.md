# UNWITEOPE-004: Unit Tests for UnwieldItemHandler

## Summary

Create comprehensive unit tests for the `UnwieldItemHandler` class, covering all execution paths including idempotent behavior, validation errors, single/multiple wielded items, and component cleanup.

## Files to Create

| File | Purpose |
|------|---------|
| `tests/unit/logic/operationHandlers/unwieldItemHandler.test.js` | Unit test suite |

## Test Cases Required

| Test Case | Description | Expected Behavior |
|-----------|-------------|-------------------|
| Invalid actor_id (empty) | `actor_id` is empty string | Returns `{ success: false }`, dispatches error |
| Invalid actor_id (missing) | `actor_id` is undefined | Returns `{ success: false }`, dispatches error |
| Invalid item_id (empty) | `item_id` is empty string | Returns `{ success: false }`, dispatches error |
| Invalid item_id (missing) | `item_id` is undefined | Returns `{ success: false }`, dispatches error |
| No wielding component | Actor has no `positioning:wielding` | Returns `{ success: true, wasWielding: false }` |
| Item not in wielded_item_ids | Item exists but not wielded | Returns `{ success: true, wasWielding: false }` |
| Single wielded item | Actor wields only this item | Removes component, unlocks appendages, returns `{ success: true, wasWielding: true }` |
| Multiple wielded items | Actor wields multiple items | Removes item from array, keeps component, unlocks appendages |
| Two-handed weapon | Item requires 2 hands | Unlocks correct number of appendages |
| No requires_grabbing component | Item has no grabbing requirements | Defaults to 1 hand, proceeds normally |
| Event dispatch | Successful unwield | Dispatches `items:item_unwielded` with correct payload |
| Remaining items in event | Multiple items, one unwielded | Event includes remaining wielded items array |

## Implementation Details

### Test Structure

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('UnwieldItemHandler', () => {
  describe('Parameter Validation', () => {
    it('should return error when actor_id is empty', async () => { /* ... */ });
    it('should return error when actor_id is missing', async () => { /* ... */ });
    it('should return error when item_id is empty', async () => { /* ... */ });
    it('should return error when item_id is missing', async () => { /* ... */ });
  });

  describe('Idempotent Behavior', () => {
    it('should succeed when actor has no wielding component', async () => { /* ... */ });
    it('should succeed when item is not in wielded_item_ids', async () => { /* ... */ });
  });

  describe('Single Item Wielding', () => {
    it('should remove wielding component when unwielding only item', async () => { /* ... */ });
    it('should unlock grabbing appendages for single item', async () => { /* ... */ });
  });

  describe('Multiple Items Wielding', () => {
    it('should keep component when other items still wielded', async () => { /* ... */ });
    it('should only unlock appendages for specified item', async () => { /* ... */ });
  });

  describe('Grabbing Requirements', () => {
    it('should handle two-handed weapons correctly', async () => { /* ... */ });
    it('should default to 1 hand when no requires_grabbing component', async () => { /* ... */ });
  });

  describe('Event Dispatch', () => {
    it('should dispatch items:item_unwielded on successful unwield', async () => { /* ... */ });
    it('should include remaining items in event payload', async () => { /* ... */ });
    it('should not dispatch event when item was not wielded', async () => { /* ... */ });
  });
});
```

### Mock Setup Pattern

```javascript
const createMockEntityManager = () => ({
  getComponent: jest.fn(),
  updateComponent: jest.fn(),
  removeComponent: jest.fn(),
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockEventDispatcher = () => ({
  dispatch: jest.fn(),
});

const createHandler = (overrides = {}) => {
  return new UnwieldItemHandler({
    logger: createMockLogger(),
    entityManager: createMockEntityManager(),
    safeEventDispatcher: createMockEventDispatcher(),
    ...overrides,
  });
};
```

### Key Test Data Patterns

```javascript
// Single wielded item
const singleWieldedComponent = {
  wielded_item_ids: ['item-001'],
};

// Multiple wielded items
const multipleWieldedComponent = {
  wielded_item_ids: ['item-001', 'item-002', 'item-003'],
};

// Two-handed weapon
const twoHandedRequirement = {
  handsRequired: 2,
};

// Context for execute()
const createContext = (actorId, itemId) => ({
  parameters: { actor_id: actorId, item_id: itemId },
});
```

## Out of Scope

- **DO NOT** create the schema (UNWITEOPE-001)
- **DO NOT** create the handler (UNWITEOPE-002)
- **DO NOT** modify DI registrations (UNWITEOPE-003)
- **DO NOT** create integration tests (UNWITEOPE-007)
- **DO NOT** modify any rule files (UNWITEOPE-005, UNWITEOPE-006)
- **DO NOT** test actual rule execution (integration tests)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Run the unit tests
NODE_ENV=test npx jest tests/unit/logic/operationHandlers/unwieldItemHandler.test.js --no-coverage --verbose

# Run with coverage
NODE_ENV=test npx jest tests/unit/logic/operationHandlers/unwieldItemHandler.test.js --coverage

# Full unit test suite
npm run test:unit
```

### Coverage Requirements

- [ ] 90%+ line coverage
- [ ] 80%+ branch coverage
- [ ] All 12 test cases pass

### Invariants That Must Remain True

- [ ] Tests use `@jest/globals` imports
- [ ] Tests follow Arrange-Act-Assert pattern
- [ ] All mocks are properly reset between tests
- [ ] No real file system or network access
- [ ] Tests are deterministic (no random data)
- [ ] No modifications to files outside the file list

## Dependencies

- **Depends on**: UNWITEOPE-002 (handler to test), UNWITEOPE-003 (DI for imports)
- **Blocked by**: UNWITEOPE-003
- **Blocks**: None (can run in parallel with UNWITEOPE-005, 006)

## Reference Files

| File | Purpose |
|------|---------|
| `tests/unit/logic/operationHandlers/unlockGrabbingHandler.test.js` | Similar test pattern |
| `tests/unit/logic/operationHandlers/dropItemAtLocationHandler.test.js` | Similar test structure |
| `tests/common/testBed.js` | Test utility patterns |
