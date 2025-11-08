# TESDATREG-007: Integration Test Helpers for Custom Scopes

**Priority**: Low
**Category**: Testing Infrastructure
**Timeline**: Long-term (Next Quarter)
**Effort**: Medium (1 week)
**Related Report**: reports/test-dataregistry-scope-dsl-issues.md

## ✅ Workflow Validation Status

**This workflow has been validated against actual production code.**

### Key Assumptions Verified

✅ **Scope Resolution API**: Test environment uses `testEnv.unifiedScopeResolver.resolveSync(scopeName, context)`
✅ **Scope Registration**: Done via `ScopeResolverHelpers._registerResolvers()` which wraps the resolver
✅ **Test Environment Structure**: No direct `scopeEngine` property; uses `unifiedScopeResolver`
✅ **Component Mutation**: Available via `testEnv.componentMutationService.addComponents()`
✅ **Existing Fixtures**: `ModTestFixture` and `ModEntityScenarios` provide comprehensive scenario builders
✅ **Condition Validation**: `ScopeConditionAnalyzer` already exists for validating condition_refs
✅ **Custom Scope Registration**: `ModTestFixture.registerCustomScope()` already implemented with auto-loading

### Corrections from Initial Draft

- ✏️ **Scope API**: Changed from `scopeEngine.resolve()` to `unifiedScopeResolver.resolveSync()`
- ✏️ **Custom Matchers**: Updated to pass testEnv/context as parameters, not via `this`
- ✏️ **Fixture Builders**: Removed new `ScopeTestingFixtures` class - use existing infrastructure
- ✏️ **Diagnostics**: Updated to use actual test environment structure
- ✏️ **Condition Refs**: Integrated with existing `ScopeConditionAnalyzer`

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
 *
 * NOTE: Test environment uses unifiedScopeResolver.resolveSync() for scope resolution,
 * not a direct scopeEngine property. Scopes are registered via ScopeResolverHelpers.
 */
class ScopeResolutionDiagnostics {
  /**
   * Resolves a scope with detailed tracing.
   *
   * @param {string} scopeName - The scope to resolve (e.g., 'positioning:close_actors')
   * @param {object} context - Resolution context (e.g., { actor: {...}, target: {...} })
   * @param {object} testEnv - Test environment with unifiedScopeResolver
   * @returns {DiagnosticResult} Resolution result with trace
   */
  static traceResolution(scopeName, context, testEnv)

  /**
   * Validates that a scope can be resolved.
   *
   * @param {string} scopeName - The scope to validate
   * @param {object} testEnv - Test environment
   * @returns {ValidationResult} Validation details
   */
  static validateScope(scopeName, testEnv)

  /**
   * Checks if all condition_refs in a scope file are valid.
   * Uses existing ScopeConditionAnalyzer from tests/common/engine/scopeConditionAnalyzer.js
   *
   * @param {string} modId - The mod ID (e.g., 'positioning')
   * @param {string} scopeName - The scope name without .scope extension
   * @param {object} testEnv - Test environment
   * @returns {ReferenceCheckResult} Check results
   */
  static checkConditionRefs(modId, scopeName, testEnv)

  /**
   * Profiles scope resolution performance.
   *
   * @param {string} scopeName - The scope to profile
   * @param {object} context - Resolution context
   * @param {object} testEnv - Test environment
   * @param {number} iterations - Number of iterations
   * @returns {PerformanceProfile} Performance metrics
   */
  static profile(scopeName, context, testEnv, iterations = 100)
}
```

### 2. Custom Jest Matchers

```javascript
/**
 * Custom matchers for scope testing.
 *
 * NOTE: These matchers need testEnv and context passed as parameters,
 * not accessed via 'this'. The test environment structure doesn't support
 * direct 'this.testEnv' access in matchers.
 */
expect.extend({
  /**
   * Asserts that a scope resolves to expected entity IDs.
   *
   * @param {string} scopeName - Scope name (e.g., 'positioning:close_actors')
   * @param {object} context - Resolution context (e.g., { actor, target })
   * @param {object} testEnv - Test environment with unifiedScopeResolver
   * @param {string[]} expectedEntityIds - Expected entity IDs
   */
  toResolveToEntities(scopeName, context, testEnv, expectedEntityIds) {
    // Implementation using testEnv.unifiedScopeResolver.resolveSync()
  },

  /**
   * Asserts that a scope resolves to at least one entity.
   *
   * @param {string} scopeName - Scope name
   * @param {object} context - Resolution context
   * @param {object} testEnv - Test environment
   */
  toResolveToAtLeastOne(scopeName, context, testEnv) {
    // Implementation
  },

  /**
   * Asserts that a scope resolves to empty set.
   *
   * @param {string} scopeName - Scope name
   * @param {object} context - Resolution context
   * @param {object} testEnv - Test environment
   */
  toResolveToEmptySet(scopeName, context, testEnv) {
    // Implementation
  },

  /**
   * Asserts that a scope includes a specific entity.
   *
   * @param {string} scopeName - Scope name
   * @param {object} context - Resolution context
   * @param {object} testEnv - Test environment
   * @param {string} entityId - Expected entity ID to find
   */
  toIncludeEntity(scopeName, context, testEnv, entityId) {
    // Implementation
  },

  /**
   * Asserts that all condition_refs in a scope file are valid.
   * Uses ScopeConditionAnalyzer which already exists in the codebase.
   *
   * @param {string} modId - Mod ID
   * @param {string} scopeName - Scope name without .scope extension
   */
  toHaveValidConditionRefs(modId, scopeName) {
    // Implementation using ScopeConditionAnalyzer
  },
});
```

### 3. Scope Testing Fixture Builders

**NOTE:** The codebase already has extensive fixture builders in `ModEntityScenarios`
and `ModTestFixture` convenience methods. No new `ScopeTestingFixtures` class is needed.

**Existing Fixture Methods (already available):**

```javascript
// In ModTestFixture (convenience wrappers):
testFixture.createStandardActorTarget(names, options)  // Basic actor-target setup
testFixture.createCloseActors(names, options)          // Close proximity setup
testFixture.createSittingPair(options)                 // Sitting scenarios
testFixture.createInventoryLoadout(options)            // Inventory scenarios
testFixture.createAnatomyScenario(names, bodyParts, options) // Anatomy scenarios
testFixture.createMultiActorScenario(names, options)   // Multi-actor scenarios

// In ModEntityScenarios (lower-level builders):
ModEntityScenarios.createActorTargetPair(options)
ModEntityScenarios.createSittingArrangement(options)
ModEntityScenarios.createInventoryTransfer(options)
ModEntityScenarios.createPositioningScenario(options)
// ... and many more

// Component mutation (already available):
testEnv.componentMutationService.addComponents(entityId, components)
```

**Recommended Approach:**
Instead of creating a new class, add documentation and examples showing how to use
existing fixture methods for scope testing. If specific scope-testing patterns emerge,
add them as methods to `ModEntityScenarios` or `ModTestFixture`.

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
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import { ScopeResolutionDiagnostics } from '../../../common/diagnostics/scopeResolutionDiagnostics.js';

describe('actors_with_exposed_asshole_accessible_from_behind Scope', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'push_glans_into_asshole'
    );

    // Register positioning scopes first (dependencies)
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Register the custom scope (auto-loads condition dependencies)
    await testFixture.registerCustomScope(
      'sex-anal-penetration',
      'actors_with_exposed_asshole_accessible_from_behind'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Validation', () => {
    it('should have valid condition_refs', async () => {
      const modId = 'sex-anal-penetration';
      const scopeName = 'actors_with_exposed_asshole_accessible_from_behind';

      // Use ScopeConditionAnalyzer (already exists in codebase)
      const validation = await ScopeResolutionDiagnostics.checkConditionRefs(
        modId,
        scopeName,
        testFixture.testEnv
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Resolution', () => {
    it('should resolve when conditions are met', async () => {
      // Use existing fixture methods from ModTestFixture
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob'], {
        closeProximity: true,
      });

      // Add positioning components for the scenario
      testFixture.testEnv.componentMutationService.addComponents(
        scenario.actor.id,
        [{ type: 'positioning:actor_position', data: { facing: 180 } }]
      );
      testFixture.testEnv.componentMutationService.addComponents(
        scenario.target.id,
        [{ type: 'positioning:actor_position', data: { facing: 0 } }]
      );

      // Resolve scope using unifiedScopeResolver
      const scopeName = 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind';
      const context = { actor: scenario.actor, target: scenario.target };

      const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        scopeName,
        context
      );

      expect(result.success).toBe(true);
      expect(result.value).toContain(scenario.target.id);
    });

    it('should not resolve when conditions are not met', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob'], {
        closeProximity: true,
      });

      // Same facing direction - should not resolve
      testFixture.testEnv.componentMutationService.addComponents(
        scenario.actor.id,
        [{ type: 'positioning:actor_position', data: { facing: 0 } }]
      );
      testFixture.testEnv.componentMutationService.addComponents(
        scenario.target.id,
        [{ type: 'positioning:actor_position', data: { facing: 0 } }]
      );

      const scopeName = 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind';
      const context = { actor: scenario.actor, target: scenario.target };

      const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        scopeName,
        context
      );

      expect(result.success).toBe(true);
      expect(result.value.size).toBe(0);
    });
  });

  describe('Diagnostics', () => {
    it('should provide diagnostic trace', async () => {
      const scenario = testFixture.createStandardActorTarget();
      const scopeName = 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind';
      const context = { actor: scenario.actor, target: scenario.target };

      const trace = ScopeResolutionDiagnostics.traceResolution(
        scopeName,
        context,
        testFixture.testEnv
      );

      expect(trace.success).toBeDefined();
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

import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import ScopeConditionAnalyzer from '../engine/scopeConditionAnalyzer.js';
import { promises as fs } from 'fs';
import { resolve } from 'path';

/**
 * Provides diagnostics for scope resolution in tests.
 * Works with the actual test environment structure using unifiedScopeResolver.
 */
class ScopeResolutionDiagnostics {
  /**
   * Traces scope resolution step-by-step.
   *
   * @param {string} scopeName - Full scope name (e.g., 'positioning:close_actors')
   * @param {object} context - Resolution context
   * @param {object} testEnv - Test environment with unifiedScopeResolver
   * @returns {object} Diagnostic trace
   */
  static traceResolution(scopeName, context, testEnv) {
    const trace = {
      scopeName,
      timestamp: Date.now(),
      steps: [],
      success: false,
      finalResult: null,
      error: null,
    };

    try {
      // Step 1: Check if resolver exists (try to resolve)
      trace.steps.push({
        step: 'Check scope registration',
        result: true,
        details: `Attempting to resolve scope "${scopeName}"`,
      });

      // Step 2: Validate context
      trace.steps.push({
        step: 'Validate context',
        result: context !== null && typeof context === 'object',
        details: `Context keys: ${Object.keys(context).join(', ')}`,
      });

      // Step 3: Attempt resolution using unifiedScopeResolver
      const startTime = performance.now();
      const resolveResult = testEnv.unifiedScopeResolver.resolveSync(
        scopeName,
        context
      );
      const duration = performance.now() - startTime;

      if (!resolveResult.success) {
        trace.error = resolveResult.error || 'Resolution failed';
        trace.steps.push({
          step: 'Resolve scope',
          result: false,
          details: `Resolution failed: ${resolveResult.error}`,
          duration,
        });
        return trace;
      }

      trace.steps.push({
        step: 'Resolve scope',
        result: true,
        details: `Resolved to ${resolveResult.value?.size || 0} entities in ${duration.toFixed(2)}ms`,
        duration,
      });

      // Step 4: Inspect results
      trace.steps.push({
        step: 'Inspect results',
        result: true,
        details: {
          entityCount: resolveResult.value?.size || 0,
          entityIds: Array.from(resolveResult.value || []),
        },
      });

      trace.success = true;
      trace.finalResult = resolveResult.value;
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
   *
   * @param {string} scopeName - Scope name
   * @param {object} testEnv - Test environment
   * @returns {object} Validation result
   */
  static validateScope(scopeName, testEnv) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Try a test resolution with empty context
    try {
      const result = testEnv.unifiedScopeResolver.resolveSync(scopeName, {});

      if (!result.success) {
        validation.valid = false;
        validation.errors.push(
          `Scope resolution failed: ${result.error || 'unknown error'}`
        );
      }
    } catch (err) {
      validation.valid = false;
      validation.errors.push(`Exception during resolution: ${err.message}`);
    }

    return validation;
  }

  /**
   * Checks all condition_refs in a scope file are valid.
   * Uses existing ScopeConditionAnalyzer.
   *
   * @param {string} modId - Mod ID
   * @param {string} scopeName - Scope name without .scope extension
   * @param {object} testEnv - Test environment
   * @returns {Promise<object>} Validation result
   */
  static async checkConditionRefs(modId, scopeName, testEnv) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      references: [],
    };

    try {
      // Read scope file
      const scopePath = resolve(
        process.cwd(),
        `data/mods/${modId}/scopes/${scopeName}.scope`
      );
      const scopeContent = await fs.readFile(scopePath, 'utf-8');

      // Parse scope definitions
      const parsedScopes = parseScopeDefinitions(scopeContent, scopePath);
      const fullScopeName = `${modId}:${scopeName}`;
      const scopeData = parsedScopes.get(fullScopeName);

      if (!scopeData) {
        result.valid = false;
        result.errors.push(`Scope "${fullScopeName}" not found in file`);
        return result;
      }

      // Extract condition references
      const conditionRefs = ScopeConditionAnalyzer.extractConditionRefs(scopeData);
      result.references = Array.from(conditionRefs);

      // Validate conditions exist
      const validation = await ScopeConditionAnalyzer.validateConditions(
        conditionRefs,
        scopePath
      );

      if (validation.missing.length > 0) {
        result.valid = false;
        result.errors.push(...validation.missing.map(id => `Missing condition: ${id}`));
      }

      if (validation.warnings.length > 0) {
        result.warnings.push(...validation.warnings);
      }
    } catch (err) {
      result.valid = false;
      result.errors.push(`Failed to check condition refs: ${err.message}`);
    }

    return result;
  }

  /**
   * Profiles scope resolution performance.
   *
   * @param {string} scopeName - Scope name
   * @param {object} context - Resolution context
   * @param {object} testEnv - Test environment
   * @param {number} iterations - Number of iterations
   * @returns {object} Performance metrics
   */
  static profile(scopeName, context, testEnv, iterations = 100) {
    const timings = [];
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = testEnv.unifiedScopeResolver.resolveSync(scopeName, context);
      const duration = performance.now() - start;

      timings.push(duration);
      results.push(result.value?.size || 0);
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
   *
   * @param {string} scopeName - Scope name
   * @param {object} context - Resolution context
   * @param {object} testEnv - Test environment
   * @returns {string} Formatted report
   */
  static generateFailureReport(scopeName, context, testEnv) {
    const trace = this.traceResolution(scopeName, context, testEnv);
    const validation = this.validateScope(scopeName, testEnv);

    let report = `Scope Resolution Failure Report\n`;
    report += `${'='.repeat(50)}\n\n`;
    report += `Scope: ${scopeName}\n`;
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
      if (typeof step.details === 'string') {
        report += `     ${step.details}\n`;
      } else {
        report += `     ${JSON.stringify(step.details, null, 2)}\n`;
      }
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
import ScopeResolutionDiagnostics from '../diagnostics/scopeResolutionDiagnostics.js';

/**
 * Custom Jest matchers for scope testing.
 * These matchers work with the actual test environment structure.
 */
const scopeMatchers = {
  /**
   * Asserts scope resolves to expected entity IDs.
   * Usage: expect({ scopeName, context, testEnv }).toResolveToEntities(expectedIds)
   */
  toResolveToEntities(received, expectedEntityIds) {
    const { scopeName, context, testEnv } = received;

    try {
      const result = testEnv.unifiedScopeResolver.resolveSync(scopeName, context);

      if (!result.success) {
        return {
          pass: false,
          message: () => `Scope resolution failed: ${result.error}`,
        };
      }

      const actualIds = Array.from(result.value || []).sort();
      const expectedIds = Array.from(expectedEntityIds).sort();
      const pass = JSON.stringify(actualIds) === JSON.stringify(expectedIds);

      const message = () => {
        const hint = matcherHint('toResolveToEntities', 'scope', 'expectedEntityIds');
        return (
          hint +
          '\n\n' +
          `Scope: ${scopeName}\n` +
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

  /**
   * Asserts scope resolves to at least one entity.
   * Usage: expect({ scopeName, context, testEnv }).toResolveToAtLeastOne()
   */
  toResolveToAtLeastOne(received) {
    const { scopeName, context, testEnv } = received;

    try {
      const result = testEnv.unifiedScopeResolver.resolveSync(scopeName, context);

      if (!result.success) {
        return {
          pass: false,
          message: () => `Scope resolution failed: ${result.error}`,
        };
      }

      const pass = result.value?.size > 0;

      const message = () => {
        const hint = matcherHint('toResolveToAtLeastOne', 'scope');
        return (
          hint +
          '\n\n' +
          `Scope: ${scopeName}\n` +
          `Expected: at least 1 entity\n` +
          `Received: ${result.value?.size || 0} entities`
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

  /**
   * Asserts scope resolves to empty set.
   * Usage: expect({ scopeName, context, testEnv }).toResolveToEmptySet()
   */
  toResolveToEmptySet(received) {
    const { scopeName, context, testEnv } = received;

    try {
      const result = testEnv.unifiedScopeResolver.resolveSync(scopeName, context);

      if (!result.success) {
        return {
          pass: false,
          message: () => `Scope resolution failed: ${result.error}`,
        };
      }

      const pass = !result.value || result.value.size === 0;
      const entityIds = result.value ? Array.from(result.value) : [];

      const message = () => {
        const hint = matcherHint('toResolveToEmptySet', 'scope');
        return (
          hint +
          '\n\n' +
          `Scope: ${scopeName}\n` +
          `Expected: 0 entities\n` +
          `Received: ${entityIds.length} entities${entityIds.length > 0 ? `: ${entityIds.join(', ')}` : ''}`
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

  /**
   * Asserts condition_refs in a scope file are valid.
   * Usage: expect({ modId, scopeName }).toHaveValidConditionRefs()
   */
  async toHaveValidConditionRefs(received) {
    const { modId, scopeName } = received;

    const validation = await ScopeResolutionDiagnostics.checkConditionRefs(
      modId,
      scopeName,
      null // testEnv not needed for file-based validation
    );

    const pass = validation.valid;

    const message = () => {
      const hint = matcherHint('toHaveValidConditionRefs', 'scope');

      if (pass) {
        return hint + `\n\nScope: ${modId}:${scopeName}\nAll condition_refs are valid`;
      }

      return (
        hint +
        '\n\n' +
        `Scope: ${modId}:${scopeName}\n` +
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

**NOTE:** No new fixture class is needed. The codebase already has comprehensive fixture
builders in `ModEntityScenarios` and convenience methods in `ModTestFixture`.

**Existing capabilities cover all scope testing needs:**

```javascript
// Example: Use existing fixture methods for scope testing
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob'], {
  closeProximity: true,
});

// Add custom components using componentMutationService
testFixture.testEnv.componentMutationService.addComponents(
  scenario.actor.id,
  [
    { type: 'positioning:actor_position', data: { facing: 180 } },
    { type: 'custom:component', data: { value: 42 } },
  ]
);

// Use specialized scenario methods
const sittingScenario = testFixture.createSittingPair({
  actorName: 'Alice',
  targetName: 'Bob',
  furniture: 'Couch',
});

// Use inventory/items scenarios
const inventoryScenario = testFixture.createInventoryLoadout({
  actorName: 'Alice',
  items: ['Sword', 'Shield', 'Potion'],
});
```

**If additional scope-specific patterns emerge during implementation,
add them as methods to `ModEntityScenarios` or `ModTestFixture` rather
than creating a new class.**

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
