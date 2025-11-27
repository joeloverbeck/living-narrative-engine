# OPEHANARCANA-004: PREPARE_ACTION_CONTEXT Unit Tests

**Status:** Ready
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-002 (handler implementation)

---

## Objective

Create comprehensive unit tests for `PrepareActionContextHandler` with 90%+ branch coverage, covering:
- Happy path scenarios
- Edge cases
- Error handling
- Parameter variations

---

## Files to Touch

### New Files
- `tests/unit/logic/operationHandlers/prepareActionContextHandler.test.js`

---

## Out of Scope

**DO NOT modify:**
- The handler implementation file
- Any schema files
- Any DI registration files
- Any integration test files (covered in OPEHANARCANA-005)
- Any rule files
- Any existing test files

---

## Implementation Details

### Test File Structure

```javascript
/**
 * @file Unit tests for PrepareActionContextHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrepareActionContextHandler from '../../../../src/logic/operationHandlers/prepareActionContextHandler.js';

describe('PrepareActionContextHandler', () => {
  let handler;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntityById: jest.fn(),
      getComponentData: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    handler = new PrepareActionContextHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor validation', () => {
    it('should throw if entityManager is missing', () => {
      expect(
        () => new PrepareActionContextHandler({ logger: mockLogger })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new PrepareActionContextHandler({ entityManager: mockEntityManager })
      ).toThrow();
    });

    it('should create handler with valid dependencies', () => {
      expect(handler).toBeDefined();
    });
  });

  describe('execute - happy path', () => {
    it('should set actorName from core:actor component', async () => {
      // Arrange
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'actor-1' && componentType === 'core:actor') {
            return { name: 'Alice' };
          }
          if (entityId === 'target-1' && componentType === 'core:actor') {
            return { name: 'Bob' };
          }
          if (entityId === 'actor-1' && componentType === 'core:position') {
            return { locationId: 'location-1' };
          }
          return null;
        }
      );

      const context = {
        event: {
          payload: {
            actorId: 'actor-1',
            targetId: 'target-1',
          },
        },
        parameters: {},
      };

      // Act
      const result = await handler.execute(context);

      // Assert
      expect(result.actorName).toBe('Alice');
      expect(result.targetName).toBe('Bob');
      expect(result.locationId).toBe('location-1');
      expect(result.targetId).toBe('target-1');
      expect(result.perceptionType).toBe('action_target_general');
    });

    it('should use custom perception_type when provided', async () => {
      mockEntityManager.getComponentData.mockReturnValue({ name: 'Test' });

      const context = {
        event: {
          payload: { actorId: 'a', targetId: 't' },
        },
        parameters: { perception_type: 'custom_type' },
      };

      const result = await handler.execute(context);

      expect(result.perceptionType).toBe('custom_type');
    });
  });

  describe('execute - name resolution fallbacks', () => {
    it('should fallback to core:item if core:actor not found', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return null;
          if (componentType === 'core:item') return { name: 'Sword' };
          if (componentType === 'core:position')
            return { locationId: 'loc-1' };
          return null;
        }
      );

      const context = {
        event: {
          payload: { actorId: 'item-1', targetId: 'item-2' },
        },
        parameters: {},
      };

      const result = await handler.execute(context);

      expect(result.actorName).toBe('Sword');
      expect(result.targetName).toBe('Sword');
    });

    it('should fallback to entityId if no name components found', async () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const context = {
        event: {
          payload: { actorId: 'entity-123', targetId: 'entity-456' },
        },
        parameters: {},
      };

      const result = await handler.execute(context);

      expect(result.actorName).toBe('entity-123');
      expect(result.targetName).toBe('entity-456');
    });

    it('should return "Unknown" for null entityId', async () => {
      const context = {
        event: {
          payload: { actorId: null, targetId: null },
        },
        parameters: {},
      };

      const result = await handler.execute(context);

      expect(result.actorName).toBe('Unknown');
      expect(result.targetName).toBe('Unknown');
    });
  });

  describe('execute - secondary entity handling', () => {
    it('should resolve secondary name when include_secondary is true', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') {
            return { name: `Name-${entityId}` };
          }
          if (componentType === 'core:position') {
            return { locationId: 'loc-1' };
          }
          return null;
        }
      );

      const context = {
        event: {
          payload: {
            actorId: 'actor-1',
            targetId: 'target-1',
            secondaryId: 'secondary-1',
          },
        },
        parameters: {
          include_secondary: true,
        },
      };

      const result = await handler.execute(context);

      expect(result.secondaryName).toBe('Name-secondary-1');
    });

    it('should use custom secondary_name_variable', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return { name: 'Test' };
          if (componentType === 'core:position')
            return { locationId: 'loc-1' };
          return null;
        }
      );

      const context = {
        event: {
          payload: {
            actorId: 'a',
            targetId: 't',
            secondaryId: 's',
          },
        },
        parameters: {
          include_secondary: true,
          secondary_name_variable: 'weaponName',
        },
      };

      const result = await handler.execute(context);

      expect(result.weaponName).toBe('Test');
      expect(result.secondaryName).toBeUndefined();
    });

    it('should not set secondary name when include_secondary is false', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return { name: 'Test' };
          if (componentType === 'core:position')
            return { locationId: 'loc-1' };
          return null;
        }
      );

      const context = {
        event: {
          payload: {
            actorId: 'a',
            targetId: 't',
            secondaryId: 's',
          },
        },
        parameters: {
          include_secondary: false,
        },
      };

      const result = await handler.execute(context);

      expect(result.secondaryName).toBeUndefined();
    });

    it('should not set secondary name when secondaryId is missing', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return { name: 'Test' };
          if (componentType === 'core:position')
            return { locationId: 'loc-1' };
          return null;
        }
      );

      const context = {
        event: {
          payload: {
            actorId: 'a',
            targetId: 't',
            // no secondaryId
          },
        },
        parameters: {
          include_secondary: true,
        },
      };

      const result = await handler.execute(context);

      expect(result.secondaryName).toBeUndefined();
    });
  });

  describe('execute - location handling', () => {
    it('should set locationId to null when position component missing', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return { name: 'Test' };
          if (componentType === 'core:position') return null;
          return null;
        }
      );

      const context = {
        event: {
          payload: { actorId: 'a', targetId: 't' },
        },
        parameters: {},
      };

      const result = await handler.execute(context);

      expect(result.locationId).toBeNull();
    });

    it('should handle position without locationId', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return { name: 'Test' };
          if (componentType === 'core:position') return {}; // no locationId
          return null;
        }
      );

      const context = {
        event: {
          payload: { actorId: 'a', targetId: 't' },
        },
        parameters: {},
      };

      const result = await handler.execute(context);

      expect(result.locationId).toBeNull();
    });
  });

  describe('execute - logging', () => {
    it('should log debug message on successful execution', async () => {
      mockEntityManager.getComponentData.mockReturnValue({ name: 'Test' });

      const context = {
        event: {
          payload: { actorId: 'a', targetId: 't' },
        },
        parameters: {},
      };

      await handler.execute(context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Prepared context'),
        expect.objectContaining({
          actorId: 'a',
          targetId: 't',
        })
      );
    });
  });

  describe('execute - context preservation', () => {
    it('should preserve existing context properties', async () => {
      mockEntityManager.getComponentData.mockReturnValue({ name: 'Test' });

      const context = {
        event: {
          payload: { actorId: 'a', targetId: 't' },
        },
        parameters: {},
        existingProperty: 'should-be-preserved',
        anotherProperty: 42,
      };

      const result = await handler.execute(context);

      expect(result.existingProperty).toBe('should-be-preserved');
      expect(result.anotherProperty).toBe(42);
    });
  });
});
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **All unit tests pass:**
   ```bash
   npm run test:unit -- tests/unit/logic/operationHandlers/prepareActionContextHandler.test.js
   ```

2. **Coverage meets requirements (90%+ branches):**
   ```bash
   npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operationHandlers/prepareActionContextHandler.js'
   ```

3. **ESLint passes on test file:**
   ```bash
   npx eslint tests/unit/logic/operationHandlers/prepareActionContextHandler.test.js
   ```

### Invariants That Must Remain True

1. No modifications to handler implementation
2. No modifications to other test files
3. Test file follows project testing conventions
4. All tests are isolated (proper mocking)

---

## Test Coverage Requirements

| Area | Min Coverage |
|------|-------------|
| Branches | 90% |
| Functions | 100% |
| Lines | 95% |
| Statements | 95% |

---

## Verification Steps

```bash
# 1. Run the specific test file
npm run test:unit -- tests/unit/logic/operationHandlers/prepareActionContextHandler.test.js --verbose

# 2. Check coverage
npm run test:unit -- tests/unit/logic/operationHandlers/prepareActionContextHandler.test.js --coverage --collectCoverageFrom='src/logic/operationHandlers/prepareActionContextHandler.js'

# 3. Verify no other tests are broken
npm run test:unit

# 4. Lint the test file
npx eslint tests/unit/logic/operationHandlers/prepareActionContextHandler.test.js
```

---

## Reference Files

- Test pattern: `tests/unit/logic/operationHandlers/getNameHandler.test.js`
- Test pattern: `tests/unit/logic/operationHandlers/setVariableHandler.test.js`
- Mock utilities: `tests/common/testBed.js`
