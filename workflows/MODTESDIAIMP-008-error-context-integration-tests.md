# MODTESDIAIMP-008: Write Error Context Integration Tests

**Phase**: 2 - Enhanced Error Context
**Priority**: 🔴 Critical
**Estimated Effort**: 3 hours
**Dependencies**: MODTESDIAIMP-006, MODTESDIAIMP-007

---

## Overview

Create comprehensive integration tests verifying that scope resolution errors are properly wrapped with context throughout the system, providing actionable error messages for debugging.

## Objectives

- Verify error wrapping at all integration points
- Validate error context completeness
- Ensure error chain preservation
- Test error formatting quality
- Verify hints and suggestions are helpful

## ⚠️ Workflow Corrections (2024-11-09)

This workflow has been updated to align with actual codebase implementation:

1. **Test File Already Exists**: `errorWrappingIntegration.test.js` contains 450 lines of error wrapping tests
   - Task: Extend existing tests rather than create new file
   - Existing coverage: ScopeRegistry errors, FilterResolver errors, error formatting

2. **No `resolveCustomScope()` Method**: ModTestFixture does not have this method
   - Actual API: `registerCustomScope(modId, scopeName, options)` for registration
   - Testing pattern: Use direct ScopeEngine instantiation or action execution

3. **ScopeEngine Class Location**: `src/scopeDsl/engine.js` (class name is `ScopeEngine`)
   - Import: `import ScopeEngine from '../../../src/scopeDsl/engine.js'`
   - Usage: `const engine = new ScopeEngine(); engine.resolve(ast, actorEntity, runtimeCtx)`

4. **Result Pattern**: Direct `resolve()` calls return `Set<string>` or throw errors
   - No result object wrapper for direct engine calls
   - Result object pattern only applies to custom scope resolvers

**Verified Against**:
- `/home/user/living-narrative-engine/tests/integration/scopeDsl/errorWrappingIntegration.test.js` (existing)
- `/home/user/living-narrative-engine/tests/common/mods/ModTestFixture.js` (lines 2144-2326)
- `/home/user/living-narrative-engine/src/scopeDsl/engine.js` (lines 291-296)
- `/home/user/living-narrative-engine/tests/integration/scopeDsl/parameterValidationIntegration.test.js` (reference)

---

## Test Files

### Main Integration Test Suite
**File**: `tests/integration/scopeDsl/errorWrappingIntegration.test.js` ⚠️ **ALREADY EXISTS** (extend, don't recreate)

### Supporting Test Files
- Modify existing integration tests to expect enhanced errors
- Add examples to documentation tests

## Test Specifications

### Suite 1: Parameter Validation Error Wrapping (Direct ScopeEngine Testing)

⚠️ **CORRECTED**: Uses direct ScopeEngine instantiation instead of non-existent `resolveCustomScope()` method

```javascript
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { ParameterValidationError } from '../../../src/scopeDsl/errors/parameterValidationError.js';
import { ScopeResolutionError } from '../../../src/scopeDsl/errors/scopeResolutionError.js';

describe('Parameter Validation Error Wrapping', () => {
  let scopeEngine;
  let mockEntityManager;
  let mockLogger;
  let runtimeCtx;

  beforeEach(() => {
    scopeEngine = new ScopeEngine();

    mockEntityManager = {
      getEntity: (id) => ({ id, components: {} }),
      getEntities: () => [],
      hasComponent: () => false,
      getComponentData: () => null,
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    runtimeCtx = {
      entityManager: mockEntityManager,
      logger: mockLogger,
    };
  });

  it('should throw ParameterValidationError when actorEntity is invalid', () => {
    const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
    const invalidActorEntity = { name: 'Test' }; // Missing 'id' property

    expect(() => {
      scopeEngine.resolve(validAST, invalidActorEntity, runtimeCtx);
    }).toThrow(ParameterValidationError);
  });

  it('should include helpful context in ParameterValidationError', () => {
    const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
    const invalidActorEntity = undefined;

    let caughtError;
    try {
      scopeEngine.resolve(validAST, invalidActorEntity, runtimeCtx);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ParameterValidationError);
    expect(caughtError.context.expected).toBeDefined();
    expect(caughtError.context.received).toBeDefined();
    expect(caughtError.context.hint).toBeDefined();
  });

  it('should preserve error chain in validation errors', () => {
    const invalidAST = null;
    const actorEntity = { id: 'actor1' };

    let caughtError;
    try {
      scopeEngine.resolve(invalidAST, actorEntity, runtimeCtx);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ParameterValidationError);
    expect(caughtError.stack).toBeDefined();
    expect(caughtError.message).toBeTruthy();
  });
});
```

### Suite 2: Scope Not Found Error Wrapping (ScopeRegistry Testing)

✅ **ALREADY IMPLEMENTED**: See existing `errorWrappingIntegration.test.js` lines 12-111

⚠️ **Note**: This suite already exists in the codebase with comprehensive coverage. Add new tests only if gaps are identified.

```javascript
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { ScopeResolutionError } from '../../../src/scopeDsl/errors/scopeResolutionError.js';

describe('Scope Not Found Error Wrapping', () => {
  let registry;

  beforeEach(() => {
    registry = new ScopeRegistry();
    registry.initialize({
      'core:test_scope': {
        expr: 'actor.items[]',
        ast: { type: 'Source', name: 'actor' },
      },
      'positioning:close_actors': {
        expr: 'close_actors',
        ast: { type: 'Source', name: 'close_actors' },
      },
    });
  });

  it('should wrap "not found" with registered scopes list', () => {
    expect(() => {
      registry.getScopeOrThrow('nonexistent:scope');
    }).toThrow(ScopeResolutionError);
  });

  it('should provide spelling suggestion', () => {
    let caughtError;
    try {
      registry.getScopeOrThrow('positioning:close');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ScopeResolutionError);
    expect(caughtError.context.suggestion).toBeDefined();
    expect(caughtError.context.suggestion).toContain('Available scopes');
  });

  it('should include phase: scope lookup', () => {
    let caughtError;
    try {
      registry.getScopeOrThrow('missing:scope');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError.context.phase).toBe('scope lookup');
  });

  it('should list available scopes in suggestion', () => {
    let caughtError;
    try {
      registry.getScopeOrThrow('unknown:scope');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError.context.example).toBeDefined();
    expect(caughtError.context.example).toContain('core:test_scope');
  });
});
```

### Suite 3: Filter Evaluation Error Wrapping (FilterResolver Testing)

✅ **ALREADY IMPLEMENTED**: See existing `errorWrappingIntegration.test.js` lines 114-272

⚠️ **Note**: Comprehensive filter error tests already exist. Add new tests only for uncovered scenarios.

```javascript
import createFilterResolver from '../../../src/scopeDsl/nodes/filterResolver.js';
import { ScopeResolutionError } from '../../../src/scopeDsl/errors/scopeResolutionError.js';

describe('Filter Evaluation Error Wrapping', () => {
  let filterResolver;
  let mockLogicEval;
  let mockEntitiesGateway;
  let mockLocationProvider;

  beforeEach(() => {
    mockLogicEval = {
      evaluate: jest.fn(),
    };

    mockEntitiesGateway = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };

    mockLocationProvider = {
      getLocation: jest.fn(() => ({ id: 'location1' })),
    };

    filterResolver = createFilterResolver({
      logicEval: mockLogicEval,
      entitiesGateway: mockEntitiesGateway,
      locationProvider: mockLocationProvider,
    });
  });

  it('should wrap JSON Logic evaluation errors', () => {
    const error = new Error('Could not resolve condition_ref: test_condition');
    mockLogicEval.evaluate.mockImplementation(() => {
      throw error;
    });

    const node = {
      type: 'Filter',
      parent: { type: 'Source', name: 'actor' },
      logic: { '==': [{ var: 'test' }, true] },
    };

    const mockDispatcher = {
      resolve: jest.fn(() => new Set(['entity1'])),
    };

    const ctx = {
      actorEntity: { id: 'actor1' },
      dispatcher: mockDispatcher,
      runtimeCtx: {},
    };

    expect(() => {
      filterResolver.resolve(node, ctx);
    }).toThrow(ScopeResolutionError);
  });

  it('should include entity ID in error context', () => {
    const error = new Error('Could not resolve condition_ref: missing');
    mockLogicEval.evaluate.mockImplementation(() => {
      throw error;
    });

    const node = {
      type: 'Filter',
      parent: { type: 'Source', name: 'actor' },
      logic: { '==': [{ var: 'test' }, true] },
    };

    const mockDispatcher = {
      resolve: jest.fn(() => new Set(['entity123'])),
    };

    const ctx = {
      actorEntity: { id: 'actor1' },
      dispatcher: mockDispatcher,
      runtimeCtx: {},
    };

    let caughtError;
    try {
      filterResolver.resolve(node, ctx);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ScopeResolutionError);
    expect(caughtError.context.parameters).toBeDefined();
    expect(caughtError.context.parameters.entityId).toBe('entity123');
  });

  it('should include filter logic in error context', () => {
    const error = new Error('Could not resolve condition_ref: test');
    mockLogicEval.evaluate.mockImplementation(() => {
      throw error;
    });

    const filterLogic = { '==': [{ var: 'field' }, 'value'] };
    const node = {
      type: 'Filter',
      parent: { type: 'Source', name: 'actor' },
      logic: filterLogic,
    };

    const mockDispatcher = {
      resolve: jest.fn(() => new Set(['entity1'])),
    };

    const ctx = {
      actorEntity: { id: 'actor1' },
      dispatcher: mockDispatcher,
      runtimeCtx: {},
    };

    let caughtError;
    try {
      filterResolver.resolve(node, ctx);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ScopeResolutionError);
    expect(caughtError.context.parameters.filterLogic).toEqual(filterLogic);
  });

  it('should preserve original JSON Logic error', () => {
    const originalError = new Error('Could not resolve condition_ref: missing_condition');
    mockLogicEval.evaluate.mockImplementation(() => {
      throw originalError;
    });

    const node = {
      type: 'Filter',
      parent: { type: 'Source', name: 'actor' },
      logic: { '==': [{ var: 'test' }, true] },
    };

    const mockDispatcher = {
      resolve: jest.fn(() => new Set(['entity1'])),
    };

    const ctx = {
      actorEntity: { id: 'actor1' },
      dispatcher: mockDispatcher,
      runtimeCtx: {},
    };

    let caughtError;
    try {
      filterResolver.resolve(node, ctx);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ScopeResolutionError);
    expect(caughtError.context.originalError).toBeDefined();
    expect(caughtError.context.originalError.message).toContain('Could not resolve condition_ref');
  });
});
```

### Suite 4: Error Chain Preservation

✅ **ALREADY IMPLEMENTED**: See existing `errorWrappingIntegration.test.js` lines 274-323

⚠️ **Note**: Error chain preservation tests already exist with full coverage. Review before adding duplicates.

```javascript
describe('Error Chain Preservation', () => {
  it('should maintain original error message', () => {
    const registry = new ScopeRegistry();
    registry.initialize({});

    let caughtError;
    try {
      registry.getScopeOrThrow('test:scope');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError.message).toContain('not found');
  });

  it('should maintain original stack trace', () => {
    const registry = new ScopeRegistry();
    registry.initialize({});

    let caughtError;
    try {
      registry.getScopeOrThrow('test:scope');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError.stack).toBeDefined();
    expect(caughtError.stack).toContain('ScopeResolutionError');
  });

  it('should not double-wrap ScopeResolutionError', () => {
    const registry = new ScopeRegistry();
    registry.initialize({});

    let caughtError;
    try {
      registry.getScopeOrThrow('test:scope');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ScopeResolutionError);
    expect(caughtError.name).toBe('ScopeResolutionError');
    // Verify it's not wrapped multiple times
    expect(caughtError.context.originalError).toBeUndefined();
  });
});
```

### Suite 5: Error Formatting Quality

✅ **ALREADY IMPLEMENTED**: See existing `errorWrappingIntegration.test.js` lines 325-391

⚠️ **Note**: Comprehensive formatting tests already exist. Only add if new formatting features are added.

```javascript
describe('Error Formatting Quality', () => {
  it('should format error with all context sections', () => {
    const registry = new ScopeRegistry();
    registry.initialize({
      'core:items': { expr: 'items', ast: { type: 'Source', name: 'items' } },
    });

    let caughtError;
    try {
      registry.getScopeOrThrow('unknown:scope');
    } catch (err) {
      caughtError = err;
    }

    const formatted = caughtError.toString();
    expect(formatted).toContain('Scope:');
    expect(formatted).toContain('Phase:');
    expect(formatted).toContain('Parameters:');
    expect(formatted).toContain('Hint:');
    expect(formatted).toContain('Suggestion:');
  });

  it('should include hints and suggestions', () => {
    const registry = new ScopeRegistry();
    registry.initialize({
      'test:scope1': { expr: 'test1', ast: { type: 'Source', name: 'test1' } },
    });

    let caughtError;
    try {
      registry.getScopeOrThrow('missing:scope');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError.context.hint).toBeDefined();
    expect(caughtError.context.suggestion).toBeDefined();
  });

  it('should provide actionable error messages', () => {
    const registry = new ScopeRegistry();
    registry.initialize({
      'positioning:close': { expr: 'close', ast: { type: 'Source', name: 'close' } },
    });

    let caughtError;
    try {
      registry.getScopeOrThrow('positioning:far');
    } catch (err) {
      caughtError = err;
    }

    const message = caughtError.toString();
    expect(message).toContain('positioning:far');
    expect(message.toLowerCase()).toContain('registered');
    expect(caughtError.context.example).toBeDefined();
  });
});
```

### Suite 6: Real-World Error Scenarios

⚠️ **NEW TESTS NEEDED**: These scenario-based tests would provide valuable debugging examples

**Implementation Strategy**: Use ModTestFixture with actual mod actions to reproduce real error scenarios

```javascript
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { ScopeResolutionError } from '../../../src/scopeDsl/errors/scopeResolutionError.js';
import { ParameterValidationError } from '../../../src/scopeDsl/errors/parameterValidationError.js';

describe('Real-World Error Scenarios', () => {
  describe('Context object passed to resolve (common mistake)', () => {
    it('should detect when full context is passed instead of actorEntity', () => {
      const scopeEngine = new ScopeEngine();
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };

      // Common mistake: passing full context instead of actorEntity
      const wrongContext = {
        actor: { id: 'actor1' },
        targets: [{ id: 'target1' }],
      };

      const runtimeCtx = {
        entityManager: {
          getEntity: (id) => ({ id, components: {} }),
          getEntities: () => [],
        },
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      };

      let caughtError;
      try {
        // Wrong: passing wrongContext as actorEntity
        scopeEngine.resolve(validAST, wrongContext, runtimeCtx);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ParameterValidationError);
      expect(caughtError.context.hint).toBeDefined();
      expect(caughtError.context.example).toBeDefined();
    });
  });

  describe('Scope not found (typo scenario)', () => {
    it('should suggest similar scope names when typo detected', () => {
      const registry = new ScopeRegistry();
      registry.initialize({
        'positioning:close_actors': { expr: 'close', ast: { type: 'Source', name: 'close' } },
      });

      let caughtError;
      try {
        // Typo: "clsoe" instead of "close"
        registry.getScopeOrThrow('positioning:clsoe_actors');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.context.suggestion).toContain('Available scopes');
      expect(caughtError.context.hint).toBeDefined();
    });
  });

  describe('Missing runtime services', () => {
    it('should explain when entityManager is missing from runtimeCtx', () => {
      const scopeEngine = new ScopeEngine();
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const actorEntity = { id: 'actor1' };

      // Missing entityManager
      const incompleteRuntimeCtx = {
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      };

      let caughtError;
      try {
        scopeEngine.resolve(validAST, actorEntity, incompleteRuntimeCtx);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ParameterValidationError);
      expect(caughtError.message).toContain('entityManager');
      expect(caughtError.context.hint).toBeDefined();
    });
  });
});
```

## Implementation Summary

### Current State (What Already Exists)

✅ **File**: `tests/integration/scopeDsl/errorWrappingIntegration.test.js` contains 450 lines covering:
- ScopeRegistry scope-not-found errors (lines 12-111)
- FilterResolver filter evaluation errors (lines 114-272)
- Error chain preservation (lines 274-323)
- Error formatting quality (lines 325-391)
- ScopeResolutionError context validation (lines 393-449)

✅ **Dependencies Completed**:
- MODTESDIAIMP-006: `ScopeResolutionError` class created and tested
- MODTESDIAIMP-007: Error wrapping integrated across scope system

### What's Actually Needed

Based on the corrected test suites above, the following work remains:

#### 1. **Extend Existing Test File** (don't create new file)
- Add Suite 6 tests (Real-World Error Scenarios) to existing `errorWrappingIntegration.test.js`
- These are the only truly missing tests from the spec

#### 2. **Optional: Add Parameter Validation Tests**
- Suite 1 tests could be added if more direct ScopeEngine parameter validation coverage is desired
- Note: Basic parameter validation is already tested in `parameterValidationIntegration.test.js`

#### 3. **Gap Analysis**
Review existing tests against acceptance criteria:
- ✅ Parameter validation errors: Covered in `parameterValidationIntegration.test.js`
- ✅ Scope lookup errors: Fully covered
- ✅ Filter evaluation errors: Fully covered
- ✅ Error chain preservation: Fully covered
- ✅ Error formatting: Fully covered
- ⚠️ Real-world scenarios: **Missing** - needs implementation

### Recommended Approach

1. **Review Existing Coverage**: Run existing tests to confirm all pass
   ```bash
   npm run test:integration -- tests/integration/scopeDsl/errorWrappingIntegration.test.js
   ```

2. **Add Real-World Scenarios**: Append Suite 6 tests to existing file
   - Focus on common debugging scenarios
   - Use actual error cases from development experience

3. **Update Documentation**: Add error handling examples to mod testing guide

## Acceptance Criteria

### Error Wrapping Coverage
- ✅ Parameter validation errors wrapped
- ✅ Scope lookup errors wrapped
- ✅ Filter evaluation errors wrapped
- ✅ Generic scope errors wrapped
- ✅ All wrapping preserves original error

### Error Context Completeness
- ✅ Scope name always included
- ✅ Phase always included
- ✅ Parameters included when relevant
- ✅ Hints provided for common mistakes
- ✅ Examples provided when helpful

### Error Chain Integrity
- ✅ Original errors accessible via originalError
- ✅ Stack traces preserved
- ✅ No double-wrapping of ScopeResolutionError
- ✅ Error chain traversable

### Formatting Quality
- ✅ toString() output is human-readable
- ✅ Sections properly formatted
- ✅ Indentation consistent
- ✅ Examples properly displayed

### Real-World Utility
- ✅ Errors from spec examples provide helpful guidance
- ✅ Common mistakes detected and explained
- ✅ Suggestions are actionable

## Test Execution

```bash
# Run error wrapping integration tests
npm run test:integration -- tests/integration/scopeDsl/errorWrappingIntegration.test.js

# Run with verbose output to see error messages
npm run test:integration -- tests/integration/scopeDsl/errorWrappingIntegration.test.js --verbose

# Run all scopeDsl integration tests
npm run test:integration -- tests/integration/scopeDsl/
```

## Documentation Requirements

Add examples to:
- JSDoc in `ScopeResolutionError` class
- Error handling guide in `docs/testing/mod-testing-guide.md`
- Troubleshooting section with common error patterns

## Success Metrics

- ✅ All tests pass
- ✅ 100% coverage of error wrapping code paths
- ✅ No eslint errors
- ✅ Error messages verified as helpful (human review)

## Example Test Output

```javascript
✓ should wrap ParameterValidationError with scope context
✓ should include scope name in wrapped error
✓ should provide parameter extraction hint
✓ should preserve original error

Error message example:
ScopeResolutionError: Invalid parameter passed to scope resolver
  Scope: positioning:close_actors
  Phase: parameter extraction
  Parameters:
    contextType: object
    hasActorEntity: false
  💡 Hint: Extract actorEntity from context before passing...
  Example:
    const actorEntity = context.actorEntity || context.actor;
```

## References

- **Spec Section**: 7. Testing Strategy (lines 2236-2303)
- **Example Section**: 5. Usage Examples (lines 1837-2086)
- **Related Tickets**:
  - MODTESDIAIMP-006 (ScopeResolutionError class)
  - MODTESDIAIMP-007 (Error wrapping integration)
