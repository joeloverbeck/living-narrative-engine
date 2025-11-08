# TESDATREG-007: Integration Test Helpers for Custom Scopes

**Priority**: Low
**Category**: Testing Infrastructure
**Timeline**: Long-term (Next Quarter)
**Effort**: Medium (1 week)
**Related Report**: reports/test-dataregistry-scope-dsl-issues.md

## Overview

Create specialized integration test helpers for testing mods with custom scopes, providing diagnostic tools for debugging scope resolution failures, and adding validation that warns when `condition_ref` points to non-existent conditions. This ticket focuses on improving the developer experience when testing complex scope interactions.

## Problem Statement

While short-term and mid-term tickets (TESDATREG-001 through TESDATREG-004) address the immediate pain points, there's still a need for:

1. **Better diagnostics** when scope resolution fails
2. **Debugging tools** to inspect scope resolution step-by-step
3. **Validation helpers** to catch common errors early
4. **Assertion helpers** for testing scope behavior
5. **Fixture builders** for common scope testing scenarios
6. **Performance profiling** for complex scope chains

Developers currently have to:
- Add manual logging to understand why a scope didn't resolve
- Manually inspect entity state to debug filtering
- Write repetitive setup code for common scenarios
- Debug scope issues without clear error messages

## Success Criteria

- [ ] Scope resolution diagnostic tool that shows step-by-step execution
- [ ] Custom Jest matchers for scope testing assertions
- [ ] Fixture builders for common scope testing scenarios
- [ ] Validation helper that checks condition_ref references
- [ ] Performance profiling for scope resolution
- [ ] Integration test template generator
- [ ] Clear error messages for common failure modes
- [ ] Unit tests for all helpers (90%+ coverage)
- [ ] Integration tests demonstrating usage
- [ ] Comprehensive documentation with examples

## Proposed Features

### 1. Scope Resolution Diagnostics

```javascript
/**
 * Provides detailed diagnostics for scope resolution.
 */
class ScopeResolutionDiagnostics {
  /**
   * Resolves a scope with detailed tracing.
   *
   * @param {string} scopeId - The scope to resolve
   * @param {object} context - Resolution context
   * @param {object} runtimeCtx - Runtime context
   * @returns {DiagnosticResult} Resolution result with trace
   */
  static traceResolution(scopeId, context, runtimeCtx)

  /**
   * Validates that a scope can be resolved.
   *
   * @param {string} scopeId - The scope to validate
   * @param {object} testEnv - Test environment
   * @returns {ValidationResult} Validation details
   */
  static validateScope(scopeId, testEnv)

  /**
   * Checks if all condition_refs in a scope are valid.
   *
   * @param {string} scopeId - The scope to check
   * @param {object} testEnv - Test environment
   * @returns {ReferenceCheckResult} Check results
   */
  static checkConditionRefs(scopeId, testEnv)

  /**
   * Profiles scope resolution performance.
   *
   * @param {string} scopeId - The scope to profile
   * @param {object} context - Resolution context
   * @param {object} runtimeCtx - Runtime context
   * @param {number} iterations - Number of iterations
   * @returns {PerformanceProfile} Performance metrics
   */
  static profile(scopeId, context, runtimeCtx, iterations = 100)
}
```

### 2. Custom Jest Matchers

```javascript
/**
 * Custom matchers for scope testing.
 */
expect.extend({
  /**
   * Asserts that a scope resolves to expected entity IDs.
   */
  toResolveToEntities(scopeId, expectedEntityIds) {
    // Implementation
  },

  /**
   * Asserts that a scope resolves to at least one entity.
   */
  toResolveToAtLeastOne(scopeId) {
    // Implementation
  },

  /**
   * Asserts that a scope resolves to empty set.
   */
  toResolveToEmptySet(scopeId) {
    // Implementation
  },

  /**
   * Asserts that a scope includes a specific entity.
   */
  toIncludeEntity(scopeId, entityId) {
    // Implementation
  },

  /**
   * Asserts that all condition_refs are valid.
   */
  toHaveValidConditionRefs(scopeId) {
    // Implementation
  },
});
```

### 3. Scope Testing Fixture Builders

```javascript
/**
 * Specialized fixture builders for scope testing.
 */
class ScopeTestingFixtures {
  /**
   * Creates a test scenario with positioning setup for scope testing.
   */
  static createPositioningScenario(options)

  /**
   * Creates a test scenario with inventory setup.
   */
  static createInventoryScenario(options)

  /**
   * Creates a test scenario with anatomy setup.
   */
  static createAnatomyScenario(options)

  /**
   * Creates actors at various distances for proximity testing.
   */
  static createProximityScenario(distances)

  /**
   * Creates actors with various facing directions.
   */
  static createFacingScenario(configurations)

  /**
   * Creates actors with specific component configurations.
   */
  static createComponentScenario(componentConfigs)
}
```

### 4. Integration Test Template Generator

```bash
# Generate test template for a custom scope
npm run generate:scope-test -- \
  --mod sex-anal-penetration \
  --scope actors_with_exposed_asshole_accessible_from_behind \
  --output tests/integration/mods/sex-anal-penetration/custom-scope.test.js
```

Generates:
```javascript
describe('actors_with_exposed_asshole_accessible_from_behind Scope', () => {
  let testFixture;
  let diagnostics;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(/* ... */);
    diagnostics = new ScopeResolutionDiagnostics(testFixture.testEnv);

    // Auto-generated scope registration
    await testFixture.registerCustomScope(/* ... */);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Validation', () => {
    it('should have valid condition_refs', () => {
      const scopeId = 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind';
      expect(scopeId).toHaveValidConditionRefs();
    });
  });

  describe('Resolution', () => {
    it('should resolve when conditions are met', async () => {
      // Auto-generated scenario setup based on scope definition
      const scenario = ScopeTestingFixtures.createPositioningScenario({
        actorFacing: 180,
        targetFacing: 0,
        distance: 1.5,
      });

      // Auto-generated assertions
      const scopeId = 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind';
      expect(scopeId).toResolveToEntities([scenario.target.id]);
    });

    it('should not resolve when conditions are not met', async () => {
      // Auto-generated negative test scenario
      const scenario = ScopeTestingFixtures.createPositioningScenario({
        actorFacing: 0,
        targetFacing: 0,
        distance: 1.5,
      });

      const scopeId = 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind';
      expect(scopeId).toResolveToEmptySet();
    });
  });

  describe('Diagnostics', () => {
    it('should provide diagnostic trace', () => {
      const scenario = /* ... */;
      const trace = diagnostics.traceResolution(/* ... */);

      expect(trace.success).toBe(true);
      expect(trace.steps).toBeDefined();
      expect(trace.finalResult).toBeDefined();
    });
  });
});
```

## Implementation Details

### Files to Create

1. **`tests/common/diagnostics/scopeResolutionDiagnostics.js`**
   - Diagnostic tracing
   - Validation helpers
   - Performance profiling

2. **`tests/common/matchers/scopeMatchers.js`**
   - Custom Jest matchers
   - Assertion helpers

3. **`tests/common/fixtures/scopeTestingFixtures.js`**
   - Specialized fixture builders
   - Common scenario creators

4. **`scripts/generate-scope-test.js`**
   - Template generator CLI
   - Auto-generates test scaffolding

5. **`tests/common/diagnostics/scopeValidator.js`**
   - Pre-test validation
   - Condition ref checking

### Detailed Implementation

#### ScopeResolutionDiagnostics

```javascript
// tests/common/diagnostics/scopeResolutionDiagnostics.js

class ScopeResolutionDiagnostics {
  #testEnv;
  #traceEnabled = false;

  constructor(testEnv) {
    this.#testEnv = testEnv;
  }

  /**
   * Enables detailed tracing for diagnostics.
   */
  enableTracing() {
    this.#traceEnabled = true;
  }

  /**
   * Traces scope resolution step-by-step.
   */
  traceResolution(scopeId, context, runtimeCtx) {
    const trace = {
      scopeId,
      timestamp: Date.now(),
      steps: [],
      success: false,
      finalResult: null,
      error: null,
    };

    try {
      // Step 1: Check if resolver exists
      trace.steps.push({
        step: 'Check resolver registration',
        result: this.#testEnv.scopeEngine.resolvers.has(scopeId),
        details: this.#testEnv.scopeEngine.resolvers.has(scopeId)
          ? 'Resolver found'
          : `Resolver not found. Available: ${Array.from(this.#testEnv.scopeEngine.resolvers.keys()).join(', ')}`,
      });

      if (!this.#testEnv.scopeEngine.resolvers.has(scopeId)) {
        trace.error = `No resolver registered for scope "${scopeId}"`;
        return trace;
      }

      // Step 2: Validate context
      trace.steps.push({
        step: 'Validate context',
        result: context !== null && typeof context === 'object',
        details: `Context: ${JSON.stringify(context, null, 2)}`,
      });

      // Step 3: Attempt resolution
      const startTime = Date.now();
      const result = this.#testEnv.scopeEngine.resolve(scopeId, context, runtimeCtx);
      const duration = Date.now() - startTime;

      trace.steps.push({
        step: 'Resolve scope',
        result: true,
        details: `Resolved to ${result.size} entities in ${duration}ms`,
        duration,
      });

      // Step 4: Inspect results
      trace.steps.push({
        step: 'Inspect results',
        result: true,
        details: {
          entityCount: result.size,
          entityIds: Array.from(result),
        },
      });

      trace.success = true;
      trace.finalResult = result;
    } catch (err) {
      trace.error = err.message;
      trace.steps.push({
        step: 'Error occurred',
        result: false,
        details: err.stack,
      });
    }

    return trace;
  }

  /**
   * Validates that a scope is properly set up.
   */
  validateScope(scopeId, testEnv = this.#testEnv) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check resolver registration
    if (!testEnv.scopeEngine.resolvers.has(scopeId)) {
      validation.valid = false;
      validation.errors.push(`No resolver registered for scope "${scopeId}"`);
      return validation;
    }

    // Check for condition_refs
    const refCheck = this.checkConditionRefs(scopeId, testEnv);
    if (!refCheck.valid) {
      validation.valid = false;
      validation.errors.push(...refCheck.errors);
    }
    validation.warnings.push(...refCheck.warnings);

    return validation;
  }

  /**
   * Checks all condition_refs in a scope are valid.
   */
  checkConditionRefs(scopeId, testEnv = this.#testEnv) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      references: [],
    };

    // This would need to parse the scope definition and check refs
    // For now, placeholder implementation
    result.warnings.push('condition_ref validation not yet implemented');

    return result;
  }

  /**
   * Profiles scope resolution performance.
   */
  profile(scopeId, context, runtimeCtx, iterations = 100) {
    const timings = [];
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = this.#testEnv.scopeEngine.resolve(scopeId, context, runtimeCtx);
      const duration = performance.now() - start;

      timings.push(duration);
      results.push(result.size);
    }

    // Calculate statistics
    const sorted = timings.sort((a, b) => a - b);
    const mean = timings.reduce((sum, t) => sum + t, 0) / timings.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      iterations,
      timings: {
        mean,
        median,
        min,
        max,
        p95,
        p99,
      },
      resultSizes: {
        mean: results.reduce((sum, r) => sum + r, 0) / results.length,
        min: Math.min(...results),
        max: Math.max(...results),
      },
    };
  }

  /**
   * Generates a detailed report for a failed scope resolution.
   */
  generateFailureReport(scopeId, context, runtimeCtx) {
    const trace = this.traceResolution(scopeId, context, runtimeCtx);
    const validation = this.validateScope(scopeId);

    let report = `Scope Resolution Failure Report\n`;
    report += `${'='.repeat(50)}\n\n`;
    report += `Scope: ${scopeId}\n`;
    report += `Timestamp: ${new Date(trace.timestamp).toISOString()}\n\n`;

    report += `Validation:\n`;
    if (validation.valid) {
      report += `  ✓ Scope is properly configured\n`;
    } else {
      report += `  ✗ Scope has configuration issues:\n`;
      validation.errors.forEach(err => {
        report += `    - ${err}\n`;
      });
    }

    if (validation.warnings.length > 0) {
      report += `  Warnings:\n`;
      validation.warnings.forEach(warn => {
        report += `    - ${warn}\n`;
      });
    }

    report += `\nResolution Trace:\n`;
    trace.steps.forEach((step, i) => {
      const icon = step.result ? '✓' : '✗';
      report += `  ${i + 1}. ${icon} ${step.step}\n`;
      report += `     ${step.details}\n`;
    });

    if (trace.error) {
      report += `\nError: ${trace.error}\n`;
    }

    return report;
  }
}

export default ScopeResolutionDiagnostics;
```

#### Custom Jest Matchers

```javascript
// tests/common/matchers/scopeMatchers.js

import { matcherHint, printReceived, printExpected } from 'jest-matcher-utils';

const scopeMatchers = {
  toResolveToEntities(scopeId, expectedEntityIds, context, runtimeCtx) {
    const testEnv = this.testEnv; // Assume injected via test setup

    try {
      const result = testEnv.scopeEngine.resolve(scopeId, context, runtimeCtx);
      const actualIds = Array.from(result).sort();
      const expectedIds = Array.from(expectedEntityIds).sort();

      const pass = JSON.stringify(actualIds) === JSON.stringify(expectedIds);

      const message = () => {
        const hint = matcherHint(
          'toResolveToEntities',
          scopeId,
          'expectedEntityIds'
        );

        return (
          hint +
          '\n\n' +
          `Expected: ${printExpected(expectedIds)}\n` +
          `Received: ${printReceived(actualIds)}`
        );
      };

      return { pass, message };
    } catch (err) {
      return {
        pass: false,
        message: () => `Scope resolution failed: ${err.message}`,
      };
    }
  },

  toResolveToAtLeastOne(scopeId, context, runtimeCtx) {
    const testEnv = this.testEnv;

    try {
      const result = testEnv.scopeEngine.resolve(scopeId, context, runtimeCtx);
      const pass = result.size > 0;

      const message = () => {
        const hint = matcherHint('toResolveToAtLeastOne', scopeId);
        return (
          hint +
          '\n\n' +
          `Expected: at least 1 entity\n` +
          `Received: ${result.size} entities`
        );
      };

      return { pass, message };
    } catch (err) {
      return {
        pass: false,
        message: () => `Scope resolution failed: ${err.message}`,
      };
    }
  },

  toResolveToEmptySet(scopeId, context, runtimeCtx) {
    const testEnv = this.testEnv;

    try {
      const result = testEnv.scopeEngine.resolve(scopeId, context, runtimeCtx);
      const pass = result.size === 0;

      const message = () => {
        const hint = matcherHint('toResolveToEmptySet', scopeId);
        return (
          hint +
          '\n\n' +
          `Expected: 0 entities\n` +
          `Received: ${result.size} entities: ${Array.from(result).join(', ')}`
        );
      };

      return { pass, message };
    } catch (err) {
      return {
        pass: false,
        message: () => `Scope resolution failed: ${err.message}`,
      };
    }
  },

  toHaveValidConditionRefs(scopeId) {
    const testEnv = this.testEnv;
    const diagnostics = new ScopeResolutionDiagnostics(testEnv);

    const validation = diagnostics.checkConditionRefs(scopeId, testEnv);
    const pass = validation.valid;

    const message = () => {
      const hint = matcherHint('toHaveValidConditionRefs', scopeId);

      if (pass) {
        return hint + '\n\nAll condition_refs are valid';
      }

      return (
        hint +
        '\n\n' +
        'Invalid condition_refs:\n' +
        validation.errors.map(err => `  - ${err}`).join('\n')
      );
    };

    return { pass, message };
  },
};

export default scopeMatchers;
```

#### Scope Testing Fixtures

```javascript
// tests/common/fixtures/scopeTestingFixtures.js

class ScopeTestingFixtures {
  /**
   * Creates a positioning scenario for scope testing.
   */
  static createPositioningScenario(testFixture, options = {}) {
    const {
      actorPosition = { x: 0, y: 0, z: 0 },
      targetPosition = { x: 1, y: 0, z: 0 },
      actorFacing = 0,
      targetFacing = 180,
      actorComponents = [],
      targetComponents = [],
    } = options;

    const scenario = testFixture.createStandardActorTarget();

    // Add positioning components
    testFixture.testEnv.componentMutationService.addComponents(
      scenario.actor.id,
      [
        {
          type: 'positioning:actor_position',
          data: { ...actorPosition, facing: actorFacing },
        },
        ...actorComponents,
      ]
    );

    testFixture.testEnv.componentMutationService.addComponents(
      scenario.target.id,
      [
        {
          type: 'positioning:actor_position',
          data: { ...targetPosition, facing: targetFacing },
        },
        ...targetComponents,
      ]
    );

    return scenario;
  }

  /**
   * Creates multiple actors at specific distances.
   */
  static createProximityScenario(testFixture, distances) {
    const actors = [];

    for (let i = 0; i < distances.length; i++) {
      const actor = testFixture.createActorEntity(`Actor${i}`);

      testFixture.testEnv.componentMutationService.addComponents(actor.id, [
        {
          type: 'positioning:actor_position',
          data: { x: distances[i], y: 0, z: 0, facing: 0 },
        },
      ]);

      actors.push({ id: actor.id, distance: distances[i] });
    }

    return actors;
  }

  /**
   * Creates actors with various facing configurations.
   */
  static createFacingScenario(testFixture, configurations) {
    const actors = [];

    for (const config of configurations) {
      const actor = testFixture.createActorEntity(config.name);

      testFixture.testEnv.componentMutationService.addComponents(actor.id, [
        {
          type: 'positioning:actor_position',
          data: {
            x: config.position.x,
            y: config.position.y,
            z: config.position.z,
            facing: config.facing,
          },
        },
      ]);

      actors.push({ id: actor.id, ...config });
    }

    return actors;
  }
}

export default ScopeTestingFixtures;
```

## Testing Requirements

### Unit Tests

1. **`tests/unit/common/diagnostics/scopeResolutionDiagnostics.test.js`**
   - Tracing functionality
   - Validation logic
   - Performance profiling

2. **`tests/unit/common/matchers/scopeMatchers.test.js`**
   - Each custom matcher
   - Edge cases

3. **`tests/unit/common/fixtures/scopeTestingFixtures.test.js`**
   - Fixture builders
   - Scenario creation

### Integration Tests

1. **`tests/integration/common/scopeDiagnostics.integration.test.js`**
   - Real scope tracing
   - Actual failure diagnostics
   - Performance profiling with real data

2. **`tests/integration/common/scopeMatchers.integration.test.js`**
   - Matchers with real scopes
   - Complex scenarios

## Documentation Updates

1. **Create**: `docs/testing/scope-testing-helpers.md`
   - Diagnostic tools guide
   - Custom matcher reference
   - Fixture builder examples

2. **Update**: `docs/testing/mod-testing-guide.md`
   - Add section on diagnostics
   - Show matcher usage examples

## Acceptance Tests

- [ ] Diagnostic tracing works with real scopes
- [ ] All custom matchers work correctly
- [ ] Fixture builders create valid scenarios
- [ ] Validation catches common errors
- [ ] Performance profiling provides useful metrics
- [ ] Template generator creates working tests
- [ ] Error messages are clear and actionable
- [ ] Unit tests achieve 90%+ coverage
- [ ] Integration tests demonstrate real usage
- [ ] Documentation is comprehensive with examples

## Dependencies

- **TESDATREG-004**: Uses `registerCustomScope()` method
- **TESDATREG-006**: Can leverage condition dependency graph

## Blockers

None

## Related Tickets

- All previous TESDATREG tickets (builds on all improvements)

## Implementation Checklist

- [ ] Implement ScopeResolutionDiagnostics class
- [ ] Add tracing functionality
- [ ] Add validation helpers
- [ ] Add performance profiling
- [ ] Implement custom Jest matchers
- [ ] Implement ScopeTestingFixtures class
- [ ] Create fixture builders
- [ ] Implement test template generator
- [ ] Create unit tests for all components
- [ ] Create integration tests
- [ ] Write comprehensive documentation
- [ ] Create usage examples
- [ ] Run full test suite
- [ ] Run `npm run typecheck`
- [ ] Run `npx eslint` on modified files

## Notes

- Focus on developer experience and useful error messages
- Diagnostic tools should be easy to use
- Matchers should follow Jest conventions
- Documentation should include many examples
- Consider adding diagnostic output to test reports
