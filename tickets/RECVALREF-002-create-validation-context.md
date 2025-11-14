# RECVALREF-002: Create ValidationContext Class

**Phase:** 1 - Foundation & Interfaces
**Priority:** P0 - Critical
**Estimated Effort:** 3 hours
**Dependencies:** RECVALREF-001

## Context

Validators currently receive dependencies through ad-hoc parameters, resulting in:
- Tight coupling to infrastructure (DataRegistry, SlotGenerator, etc.)
- Difficult to mock for testing
- Inconsistent dependency injection
- No shared state management between validators

This ticket creates an immutable context object for dependency injection and state sharing.

## Objectives

1. Create immutable `ValidationContext` class
2. Encapsulate all validator dependencies
3. Provide metadata management for inter-validator state sharing
4. Support context derivation for configuration overrides
5. Ensure proper dependency validation

## Implementation Details

### File to Create

`src/anatomy/validation/core/ValidationContext.js`

### Class Specification

```javascript
/**
 * @file Validation context for dependency injection and state sharing
 */

import { assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Immutable validation context
 */
export class ValidationContext {
  #dataRegistry;
  #schemaValidator;
  #blueprintProcessor;
  #logger;
  #config;
  #metadata;

  constructor({ dataRegistry, schemaValidator, blueprintProcessor, logger, config = {} }) {
    assertPresent(dataRegistry, 'dataRegistry is required');
    assertPresent(schemaValidator, 'schemaValidator is required');
    assertPresent(blueprintProcessor, 'blueprintProcessor is required');
    assertPresent(logger, 'logger is required');

    this.#dataRegistry = dataRegistry;
    this.#schemaValidator = schemaValidator;
    this.#blueprintProcessor = blueprintProcessor;
    this.#logger = logger;
    this.#config = Object.freeze({ ...config });
    this.#metadata = new Map();
  }

  // Immutable getters
  get dataRegistry() {
    return this.#dataRegistry;
  }

  get schemaValidator() {
    return this.#schemaValidator;
  }

  get blueprintProcessor() {
    return this.#blueprintProcessor;
  }

  get logger() {
    return this.#logger;
  }

  get config() {
    return this.#config;
  }

  // Metadata management (for validator state sharing)
  setMetadata(key, value) {
    this.#metadata.set(key, value);
  }

  getMetadata(key) {
    return this.#metadata.get(key);
  }

  hasMetadata(key) {
    return this.#metadata.has(key);
  }

  // Create derived context with updated config
  withConfig(updates) {
    return new ValidationContext({
      dataRegistry: this.#dataRegistry,
      schemaValidator: this.#schemaValidator,
      blueprintProcessor: this.#blueprintProcessor,
      logger: this.#logger,
      config: { ...this.#config, ...updates },
    });
  }
}
```

## Testing Requirements

### Unit Tests

**File:** `tests/unit/anatomy/validation/core/ValidationContext.test.js`

**Test Cases:**
1. ✅ Should create context with all required dependencies
2. ✅ Should throw when dataRegistry missing
3. ✅ Should throw when schemaValidator missing
4. ✅ Should throw when blueprintProcessor missing
5. ✅ Should throw when logger missing
6. ✅ Should freeze config object (immutability)
7. ✅ Should provide immutable getters
8. ✅ Should manage metadata correctly
9. ✅ Should create derived context with updated config
10. ✅ Should not mutate original context when creating derived context

### Example Tests

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ValidationContext } from '../../../../../src/anatomy/validation/core/ValidationContext.js';
import { createTestBed } from '../../../../common/testBed.js';

describe('ValidationContext', () => {
  let testBed;
  let mockDeps;

  beforeEach(() => {
    testBed = createTestBed();
    mockDeps = {
      dataRegistry: testBed.createMock('dataRegistry', ['get', 'getAll']),
      schemaValidator: testBed.createMock('schemaValidator', ['validate']),
      blueprintProcessor: testBed.createMock('blueprintProcessor', ['process']),
      logger: testBed.createMockLogger(),
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('constructor', () => {
    it('should create context with all dependencies', () => {
      const context = new ValidationContext(mockDeps);

      expect(context.dataRegistry).toBe(mockDeps.dataRegistry);
      expect(context.schemaValidator).toBe(mockDeps.schemaValidator);
      expect(context.blueprintProcessor).toBe(mockDeps.blueprintProcessor);
      expect(context.logger).toBe(mockDeps.logger);
    });

    it('should throw when dataRegistry missing', () => {
      const { dataRegistry, ...depsWithoutRegistry } = mockDeps;

      expect(() => new ValidationContext(depsWithoutRegistry)).toThrow('dataRegistry is required');
    });

    it('should freeze config object for immutability', () => {
      const config = { key: 'value' };
      const context = new ValidationContext({ ...mockDeps, config });

      expect(() => {
        context.config.key = 'modified';
      }).toThrow();
    });
  });

  describe('metadata management', () => {
    it('should set and get metadata', () => {
      const context = new ValidationContext(mockDeps);

      context.setMetadata('testKey', 'testValue');

      expect(context.getMetadata('testKey')).toBe('testValue');
      expect(context.hasMetadata('testKey')).toBe(true);
    });

    it('should return undefined for non-existent metadata', () => {
      const context = new ValidationContext(mockDeps);

      expect(context.getMetadata('nonExistent')).toBeUndefined();
      expect(context.hasMetadata('nonExistent')).toBe(false);
    });
  });

  describe('withConfig', () => {
    it('should create derived context with updated config', () => {
      const context = new ValidationContext({
        ...mockDeps,
        config: { original: 'value' },
      });

      const derived = context.withConfig({ additional: 'setting' });

      expect(derived.config).toEqual({
        original: 'value',
        additional: 'setting',
      });
    });

    it('should not mutate original context', () => {
      const context = new ValidationContext({
        ...mockDeps,
        config: { original: 'value' },
      });

      const derived = context.withConfig({ additional: 'setting' });

      expect(context.config).toEqual({ original: 'value' });
      expect(derived.config).not.toBe(context.config);
    });
  });
});
```

## Acceptance Criteria

- [ ] `ValidationContext` class created in correct location
- [ ] All dependencies properly validated in constructor
- [ ] Immutable getters implemented for all dependencies
- [ ] Config object frozen to prevent mutations
- [ ] Metadata management methods implemented
- [ ] `withConfig()` creates new instance without mutating original
- [ ] Unit tests achieve 90%+ branch coverage
- [ ] All tests pass
- [ ] Code follows project guidelines
- [ ] No ESLint violations

## Integration Points

This context will be passed to all validators through the `validate(recipe, context)` method defined in `IValidator`.

## Related Tickets

- RECVALREF-001 (prerequisite)
- RECVALREF-010 (uses this context)
- RECVALREF-020 (pipeline uses this context)

## References

- **Recommendations:** `reports/recipe-validation-refactoring-recommendations.md` (Phase 1.2)
- **Analysis:** `reports/recipe-validation-architecture-analysis.md` (Section: Tight Coupling to Infrastructure)
- **Project Guidelines:** `CLAUDE.md` (Dependency Injection Pattern)
