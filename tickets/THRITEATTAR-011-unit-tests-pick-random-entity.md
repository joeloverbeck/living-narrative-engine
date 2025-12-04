# THRITEATTAR-011: Create Unit Tests for PICK_RANDOM_ENTITY Handler

## Summary

Create comprehensive unit tests for the `PickRandomEntityHandler` to verify all functionality including entity selection, filtering, exclusions, and edge cases.

## Files to Create

| File | Purpose |
|------|---------|
| `tests/unit/logic/operationHandlers/pickRandomEntityHandler.test.js` | Unit test suite |

## Test Cases to Implement

### 1. Basic Functionality

```javascript
describe('PickRandomEntityHandler', () => {
  describe('basic functionality', () => {
    it('should return a random entity from location');
    it('should store result in the specified context variable');
    it('should handle location with single entity');
    it('should handle location with multiple entities');
  });
});
```

### 2. Entity Exclusion

```javascript
describe('entity exclusion', () => {
  it('should exclude entities in exclude_entities array');
  it('should exclude multiple entities simultaneously');
  it('should handle context reference in exclude_entities');
  it('should handle event payload reference in exclude_entities');
  it('should return null when all entities are excluded');
});
```

### 3. Component Filtering - Required

```javascript
describe('require_components filtering', () => {
  it('should only return entities with ALL required components');
  it('should return null when no entity has required component');
  it('should handle single required component');
  it('should handle multiple required components (AND logic)');
});
```

### 4. Component Filtering - Excluded

```javascript
describe('exclude_components filtering', () => {
  it('should exclude entities with ANY excluded component');
  it('should handle single excluded component');
  it('should handle multiple excluded components (OR logic)');
  it('should return null when all entities have excluded components');
});
```

### 5. Combined Filtering

```javascript
describe('combined filtering', () => {
  it('should apply exclusions AND component filters together');
  it('should handle complex filtering scenario');
  it('should prioritize exclusions over component filters');
});
```

### 6. Edge Cases

```javascript
describe('edge cases', () => {
  it('should return null for empty location');
  it('should return null for invalid location_id');
  it('should return null when location_id is null');
  it('should handle missing components gracefully');
  it('should handle empty exclude_entities array');
  it('should handle empty require_components array');
  it('should handle empty exclude_components array');
});
```

### 7. Randomness

```javascript
describe('randomness', () => {
  it('should eventually return different entities on repeated calls');
  it('should have uniform distribution (statistical test)');
});
```

### 8. Context Resolution

```javascript
describe('context resolution', () => {
  it('should resolve {context.variable} patterns');
  it('should resolve {event.payload.property} patterns');
  it('should handle literal string values');
});
```

## Test Implementation Pattern

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PickRandomEntityHandler from '../../../../src/logic/operationHandlers/pickRandomEntityHandler.js';

describe('PickRandomEntityHandler', () => {
  let handler;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntitiesInLocation: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    handler = new PickRandomEntityHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  // Tests here...
});
```

## Out of Scope

- **DO NOT** create integration tests (THRITEATTAR-012)
- **DO NOT** modify the handler implementation (THRITEATTAR-006)
- **DO NOT** test other handlers
- **DO NOT** test the full rule execution flow

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit tests/unit/logic/operationHandlers/pickRandomEntityHandler.test.js` passes
2. All test cases cover the scenarios listed above
3. Test coverage ≥80% for the handler file
4. No flaky tests (randomness tests use proper statistical methods)

### Invariants That Must Remain True

1. All existing unit tests continue to pass
2. Tests follow project test patterns
3. Tests use proper mocking (no real entity manager)
4. Tests are deterministic (seed random when needed)

## Validation Commands

```bash
# Run the specific test file
npm run test:unit tests/unit/logic/operationHandlers/pickRandomEntityHandler.test.js

# Run with coverage
npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operationHandlers/pickRandomEntityHandler.js'

# Run all unit tests to ensure no regressions
npm run test:unit
```

## Reference Files

For understanding test patterns:
- `tests/unit/logic/operationHandlers/getDamageCapabilitiesHandler.test.js` - Similar handler test
- `tests/unit/logic/operationHandlers/setVariableHandler.test.js` - Simple handler test pattern
- `tests/common/testBed.js` - Test utilities

## Dependencies

- THRITEATTAR-006 (handler must exist to test)
- THRITEATTAR-007 (DI must be set up for handler resolution)

## Blocks

- None (tests can run independently)
