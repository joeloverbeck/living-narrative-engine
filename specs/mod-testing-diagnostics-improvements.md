# Mod Testing Diagnostics Improvements Specification

**Version**: 1.0.0
**Status**: Draft
**Created**: 2025-01-08
**Author**: System Architecture Analysis

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current State Analysis](#current-state-analysis)
3. [Proposed Improvements](#proposed-improvements)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Usage Examples](#usage-examples)
6. [API Design](#api-design)
7. [Testing Strategy](#testing-strategy)

---

## 1. Problem Statement

### Background

During a debugging session for three integration tests in the `sex-anal-penetration` mod, it took **three separate debugging attempts** to fix what appeared to be straightforward integration tests. The tests were validating basic action discovery scenarios where an actor should be able to perform actions on targets with specific component configurations.

### Core Issue

The fundamental problem was **parameter type confusion** in the scope resolution system:

```javascript
// INCORRECT: Custom scope resolver was passing full context object
const resolver = (context) => {
  const result = scopeEngine.resolve(scopeData.ast, context, runtimeCtx);
  //                                                  ^^^^^^^
  //                                    Should be actorEntity, not context
};
```

**Expected signature**: `ScopeEngine.resolve(ast, actorEntity, runtimeCtx, trace)`
**What was passed**: `ScopeEngine.resolve(ast, context, runtimeCtx)` where `context = { actor: {...}, targets: {...}, ... }`

This mismatch caused:
1. Silent failures (no clear error about parameter type mismatch)
2. Confusing error messages ("actorEntity has invalid ID: undefined")
3. Difficulty tracing the problem through multiple layers of abstraction

### Diagnostic Challenges

The debugging process revealed critical gaps in diagnostic capabilities:

| Challenge | Impact | Time Lost |
|-----------|--------|-----------|
| **No parameter validation** | Silent failures, unclear error source | ~30 minutes |
| **Poor error messages** | Generic errors without context or hints | ~45 minutes |
| **No scope tracing** | Can't see step-by-step evaluation | ~60 minutes |
| **Filter mystery** | Can't see why entities fail filters | ~30 minutes |
| **Type confusion** | Wrong object shape passed without detection | ~45 minutes |

**Total debugging time**: ~3.5 hours across three sessions for what should have been a 15-minute fix.

### Why This Matters

1. **Developer Productivity**: Time spent debugging test infrastructure instead of implementing features
2. **Confidence**: Developers lose trust in the testing system when simple tests fail mysteriously
3. **Onboarding**: New developers struggle to understand cryptic errors
4. **Maintenance**: Infrastructure bugs are harder to fix than application bugs
5. **Quality**: Poor diagnostics lead to workarounds instead of proper fixes

---

## 2. Current State Analysis

### 2.1 Strengths

The current mod testing infrastructure (`docs/testing/mod-testing-guide.md`) provides:

**Comprehensive Fixture System**
- `ModTestFixture.forAction()` - Action-specific test setup
- `ModTestFixture.forRule()` - Rule execution test setup
- `ModTestFixture.forCategory()` - Category-specific test setup

**Rich Scenario Builders**
- `createCloseActors()` - Sets up actors with positioning closeness
- `createSittingPair()` - Actors sitting close together
- `createInventoryLoadout()` - Actors with inventory items
- `createContainerScenario()` - Container and item setup

**Domain Matchers** (`tests/common/mods/domainMatchers.js`)
- `toHaveActionSuccess()` - Validates action execution
- `toHaveComponent()` - Component presence validation
- `toHaveComponentValue()` - Component data validation
- 50+ specialized matchers for readable assertions

**Scope Resolver Helpers** (`tests/common/mods/scopeResolverHelpers.js`)
- 33 pre-built scope resolvers (26 positioning, 5 inventory, 2 anatomy)
- Auto-registration via `autoRegisterScopes: true`
- Custom scope registration via `registerCustomScope()`

**Basic Diagnostics**
- `fixture.enableDiagnostics()` - Enables verbose logging
- `fixture.discoverWithDiagnostics()` - Returns trace summaries
- Manual inspection via `fixture.events` and entity components

### 2.2 Weaknesses

#### Parameter Type Validation

**Problem**: No validation at function boundaries

**Evidence** (`tests/common/mods/ModTestFixture.js:2233-2263`):
```javascript
const resolver = (context) => {
  try {
    // WORKAROUND: Extract actorEntity from context
    // This masks the real issue instead of failing fast
    const actorEntity = context.actorEntity || context.actor || context;

    const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);
    return { success: true, value: result };
  } catch (err) {
    return {
      success: false,
      error: `Failed to resolve scope "${fullScopeName}": ${err.message}`,
      // Loses stack trace and parameter context
    };
  }
};
```

**Missing**:
- ✗ Type validation for `actorEntity` parameter
- ✗ Structure validation (does it have `id` property?)
- ✗ Early detection of wrong object shapes
- ✗ Validation that `runtimeCtx` has required services

**Impact**: Silent failures, confusing errors, difficult debugging

---

#### Error Messages

**Problem**: Generic, context-free error messages

**Current errors**:
```
"Failed to resolve scope X"
"actorEntity has invalid ID: undefined"
"Resolver for scope X not found"
```

**Missing context**:
- ✗ What parameters were passed?
- ✗ What was the expected parameter structure?
- ✗ Where in the call chain did it fail?
- ✗ What's the suggested fix?

**Example** (`src/scopeDsl/nodes/filterResolver.js:113-138`):
```javascript
if (!actorEntity.id || actorEntity.id === 'undefined' || typeof actorEntity.id !== 'string') {
  const errorMessage =
    `FilterResolver: actorEntity has invalid ID: ${JSON.stringify(actorEntity.id)}`;
  // ERROR MESSAGE TELLS US: "id is undefined"
  // ERROR MESSAGE SHOULD TELL US:
  //   - What object was passed instead of actorEntity?
  //   - Did you pass the full context object?
  //   - Here's how to extract actorEntity from context
}
```

---

#### Scope Evaluation Tracing

**Problem**: No step-by-step execution visibility

**Current tracing** (`src/scopeDsl/nodes/filterResolver.js:166-174, 282-303`):
- `trace.addLog()` calls exist but are sparse
- Only available when trace context exists
- Requires manual `enableDiagnostics()` call
- No intermediate results shown

**What's needed**:
```
SCOPE EVALUATION TRACE:
1. [SourceResolver] resolve(kind='actor') → Set(['actor-id-123'])
2. [StepResolver] resolve(field='components.positioning:closeness.partners')
   Input: Set(['actor-id-123'])
   Output: Set(['target-id-456', 'target-id-789'])
3. [FilterResolver] resolve(logic={...})
   Input: Set(['target-id-456', 'target-id-789'])
   Evaluating target-id-456: FAIL (condition_ref check failed)
   Evaluating target-id-789: PASS
   Output: Set(['target-id-789'])
```

**Missing**:
- ✗ Step-by-step resolver execution flow
- ✗ Input/output values at each step
- ✗ Per-entity filter evaluation results
- ✗ Intermediate data transformations
- ✗ Performance timing per step

---

#### Filter Clause Breakdown

**Problem**: When filters fail, no visibility into which clause caused failure

**Current behavior** (`src/scopeDsl/nodes/filterResolver.js:194-253`):
```javascript
// FilterResolver evaluates entire logic expression
const passedFilter = logicEval.evaluate(node.logic, evalCtx);

if (passedFilter) {
  result.add(item);
}

// PROBLEM: If passedFilter is false, we don't know WHY
// - Which AND clause failed?
// - Which OR branch failed?
// - What was the actual vs expected value?
```

**What's needed**:
```
Filter Evaluation: FAIL ✗
  ✓ and
    ✓ and
      ✓ hasPartOfType: [".", "asshole"]
      ✓ not
        ✓ isSocketCovered: [".", "asshole"]
    ✗ or  ← THIS CLAUSE FAILED
      ✗ condition_ref: "positioning:actor-in-entity-facing-away"
        Component positioning:facing_away exists: YES
        Value: { facing_away_from: [] }
        Actor in facing_away_from list: NO  ← ROOT CAUSE
      ✗ !!
        var: "entity.components.positioning:lying_down"
        Component positioning:lying_down exists: NO
```

---

#### Empty Set Mystery

**Problem**: Scopes return empty sets with no explanation

**Debugging session example**:
```javascript
const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
const ids = actions.map((action) => action.id);

expect(ids).toContain('sex-anal-penetration:insert_finger_into_asshole');
// FAILS: Expected [] to contain "sex-anal-penetration:insert_finger_into_asshole"

// NO INDICATION OF:
// - Were any candidates considered?
// - Which entities were evaluated?
// - Why did they fail the filter?
// - Which specific condition caused the failure?
```

**Developer questions with no answers**:
1. Are components set up correctly? (Yes, but can't verify without manual logging)
2. Is the scope syntax correct? (Yes, but can't verify evaluation)
3. Is the filter logic working? (Unknown, black box)
4. What's the expected vs actual state? (Must manually inspect entities)

---

### 2.3 Gap Summary

| Feature | Current State | Priority | Impact |
|---------|--------------|----------|--------|
| **Parameter Validation** | ❌ None | 🔴 Critical | Silent failures |
| **Error Context** | ⚠️ Generic | 🔴 Critical | Poor DX |
| **Scope Tracing** | ⚠️ Limited | 🟡 High | Difficult debugging |
| **Filter Breakdown** | ❌ None | 🟡 High | Mystery failures |
| **Performance Metrics** | ❌ None | 🟢 Medium | Optimization blind |
| **Type Safety** | ❌ None | 🔴 Critical | Wrong types pass |

---

## 3. Proposed Improvements

### 3.1 Parameter Validation Layer

#### Overview

Add comprehensive parameter validation at all function boundaries in the scope resolution system to fail fast with clear, actionable error messages.

#### Implementation

**New file**: `src/scopeDsl/core/parameterValidator.js`

```javascript
/**
 * @file Parameter validation for scope resolution system
 * Provides typed validation with helpful error messages
 */

/**
 * Validation error with enhanced context
 */
export class ParameterValidationError extends TypeError {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ParameterValidationError';
    this.context = context;
  }

  toString() {
    const parts = [this.message];

    if (this.context.expected) {
      parts.push(`  Expected: ${this.context.expected}`);
    }
    if (this.context.received) {
      parts.push(`  Received: ${this.context.received}`);
    }
    if (this.context.hint) {
      parts.push(`  💡 Hint: ${this.context.hint}`);
    }
    if (this.context.example) {
      parts.push(`  Example: ${this.context.example}`);
    }

    return parts.join('\n');
  }
}

/**
 * Parameter validator for scope resolution system
 */
export class ParameterValidator {
  /**
   * Validates that object matches actorEntity structure
   *
   * @param {any} value - Value to validate
   * @param {string} source - Source location for error messages
   * @throws {ParameterValidationError} If validation fails
   * @returns {true} If validation passes
   */
  static validateActorEntity(value, source) {
    // Check basic type
    if (!value || typeof value !== 'object') {
      throw new ParameterValidationError(
        `${source}: Expected actorEntity object, got ${typeof value}`,
        {
          expected: 'Entity instance with id, components properties',
          received: typeof value,
          hint: 'actorEntity must be an entity object, not a primitive value',
        }
      );
    }

    // Check for id property
    if (!value.id || typeof value.id !== 'string') {
      // Detect common mistake: passing full context object
      const isPossibleContext = value.actorEntity || value.actor || value.targets;

      const hint = isPossibleContext
        ? 'You appear to have passed the entire context object instead of extracting actorEntity. ' +
          'Extract actorEntity from context before calling ScopeEngine.resolve()'
        : 'actorEntity must have a valid string id property';

      const example = isPossibleContext
        ? 'const actorEntity = context.actorEntity || context.actor;\n' +
          'scopeEngine.resolve(ast, actorEntity, runtimeCtx);'
        : 'actorEntity = { id: "actor-123", components: {...} }';

      throw new ParameterValidationError(
        `${source}: actorEntity has invalid 'id' property: ${JSON.stringify(value.id)}`,
        {
          expected: 'string id property',
          received: typeof value.id,
          hint,
          example,
        }
      );
    }

    // Check for components property (optional but common)
    if (value.components !== undefined && typeof value.components !== 'object') {
      throw new ParameterValidationError(
        `${source}: actorEntity.components must be an object if present`,
        {
          expected: 'object or undefined',
          received: typeof value.components,
        }
      );
    }

    return true;
  }

  /**
   * Validates runtimeContext structure
   *
   * @param {any} value - Value to validate
   * @param {string} source - Source location for error messages
   * @throws {ParameterValidationError} If validation fails
   * @returns {true} If validation passes
   */
  static validateRuntimeContext(value, source) {
    if (!value || typeof value !== 'object') {
      throw new ParameterValidationError(
        `${source}: runtimeCtx must be an object`,
        {
          expected: 'object with entityManager, jsonLogicEval, logger',
          received: typeof value,
        }
      );
    }

    const required = ['entityManager', 'jsonLogicEval', 'logger'];
    const missing = required.filter(key => !value[key]);

    if (missing.length > 0) {
      throw new ParameterValidationError(
        `${source}: runtimeCtx missing required services: ${missing.join(', ')}`,
        {
          expected: 'runtimeCtx with all required services',
          received: `missing: ${missing.join(', ')}`,
          hint: 'Ensure runtimeCtx includes entityManager, jsonLogicEval, and logger',
          example: 'runtimeCtx = { entityManager, jsonLogicEval, logger }',
        }
      );
    }

    return true;
  }

  /**
   * Validates AST structure
   *
   * @param {any} value - Value to validate
   * @param {string} source - Source location for error messages
   * @throws {ParameterValidationError} If validation fails
   * @returns {true} If validation passes
   */
  static validateAST(value, source) {
    if (!value || typeof value !== 'object') {
      throw new ParameterValidationError(
        `${source}: AST must be an object`,
        {
          expected: 'Scope DSL AST object',
          received: typeof value,
        }
      );
    }

    if (!value.kind) {
      throw new ParameterValidationError(
        `${source}: AST must have a 'kind' property`,
        {
          expected: 'kind property (e.g., "source", "step", "filter")',
          received: 'undefined',
          hint: 'AST nodes must specify their kind for resolver dispatch',
        }
      );
    }

    return true;
  }
}
```

#### Integration Points

**1. ScopeEngine.resolve()** (`src/scopeDsl/engine.js:289`):
```javascript
resolve(ast, actorEntity, runtimeCtx, trace = null) {
  // ADD VALIDATION
  ParameterValidator.validateAST(ast, 'ScopeEngine.resolve');
  ParameterValidator.validateActorEntity(actorEntity, 'ScopeEngine.resolve');
  ParameterValidator.validateRuntimeContext(runtimeCtx, 'ScopeEngine.resolve');

  // Continue with existing logic
  const ctx = {
    actorEntity,
    runtimeCtx,
    trace,
    // ...
  };
  // ...
}
```

**2. Custom Scope Resolver** (`tests/common/mods/ModTestFixture.js:2233`):
```javascript
const resolver = (context) => {
  const runtimeCtx = {
    get entityManager() { return testEnv.entityManager; },
    get jsonLogicEval() { return testEnv.jsonLogic; },
    get logger() { return testEnv.logger; },
  };

  try {
    // Extract actorEntity from context
    const actorEntity = context.actorEntity || context.actor || context;

    // ADD VALIDATION - will throw ParameterValidationError if wrong type
    ParameterValidator.validateActorEntity(actorEntity, 'CustomScopeResolver');

    const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);
    return { success: true, value: result };
  } catch (err) {
    if (err instanceof ParameterValidationError) {
      // Enhanced error with context
      return {
        success: false,
        error: err.toString(),
        context: err.context,
      };
    }

    return {
      success: false,
      error: `Failed to resolve scope "${fullScopeName}": ${err.message}`,
    };
  }
};
```

**3. FilterResolver** (`src/scopeDsl/nodes/filterResolver.js:78`):
```javascript
resolve(node, ctx) {
  const { actorEntity, dispatcher, trace } = ctx;

  // ADD VALIDATION - validates ctx structure
  ParameterValidator.validateActorEntity(actorEntity, 'FilterResolver.resolve');

  // Continue with existing logic
  // ...
}
```

**4. SourceResolver** (`src/scopeDsl/nodes/sourceResolver.js:71`):
```javascript
resolve(node, ctx) {
  const { actorEntity, trace } = ctx;

  // ADD VALIDATION
  ParameterValidator.validateActorEntity(actorEntity, 'SourceResolver.resolve');

  // Continue with existing logic
  // ...
}
```

---

### 3.2 Enhanced Error Context

#### Overview

Wrap scope resolution errors with rich context including parameters, hints, and suggested fixes to improve developer experience.

#### Implementation

**New file**: `src/scopeDsl/core/scopeResolutionError.js`

```javascript
/**
 * @file Enhanced error for scope resolution failures
 */

/**
 * Enhanced error class for scope resolution failures
 */
export class ScopeResolutionError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ScopeResolutionError';
    this.context = context;

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScopeResolutionError);
    }
  }

  /**
   * Format error with full context
   * @returns {string} Formatted error message
   */
  toString() {
    const parts = [this.message];

    if (this.context.scopeName) {
      parts.push(`  Scope: ${this.context.scopeName}`);
    }

    if (this.context.phase) {
      parts.push(`  Phase: ${this.context.phase}`);
    }

    if (this.context.parameters) {
      parts.push(`  Parameters:`);
      Object.entries(this.context.parameters).forEach(([key, value]) => {
        const formatted = typeof value === 'object'
          ? JSON.stringify(value, null, 4).split('\n').map((line, i) =>
              i === 0 ? line : `      ${line}`
            ).join('\n')
          : String(value);
        parts.push(`    ${key}: ${formatted}`);
      });
    }

    if (this.context.expected) {
      parts.push(`  Expected: ${this.context.expected}`);
    }

    if (this.context.received) {
      parts.push(`  Received: ${this.context.received}`);
    }

    if (this.context.hint) {
      parts.push(`  💡 Hint: ${this.context.hint}`);
    }

    if (this.context.suggestion) {
      parts.push(`  Suggestion: ${this.context.suggestion}`);
    }

    if (this.context.example) {
      parts.push(`  Example:`);
      this.context.example.split('\n').forEach(line => {
        parts.push(`    ${line}`);
      });
    }

    if (this.context.originalError) {
      parts.push(`  Original Error: ${this.context.originalError.message}`);
      if (this.context.originalError.stack) {
        parts.push(`  Stack Trace:`);
        this.context.originalError.stack.split('\n').slice(0, 5).forEach(line => {
          parts.push(`    ${line}`);
        });
      }
    }

    return parts.join('\n');
  }

  /**
   * Get formatted error for logging
   * @returns {object} Structured error object
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }
}
```

#### Usage Examples

**Example 1: Parameter type mismatch**
```javascript
try {
  const actorEntity = context; // WRONG: passing full context
  ParameterValidator.validateActorEntity(actorEntity, 'CustomScopeResolver');
} catch (err) {
  throw new ScopeResolutionError(
    'Invalid parameter passed to scope resolver',
    {
      scopeName: fullScopeName,
      phase: 'parameter extraction',
      parameters: {
        contextType: typeof context,
        hasActorEntity: !!context.actorEntity,
        hasActor: !!context.actor,
        extractedType: typeof actorEntity,
      },
      expected: 'Entity instance with id property',
      received: 'Full context object with actor, targets properties',
      hint: 'Extract actorEntity from context before passing to ScopeEngine.resolve()',
      suggestion: 'Use: const actorEntity = context.actorEntity || context.actor',
      example:
        'const actorEntity = context.actorEntity || context.actor;\n' +
        'const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);',
      originalError: err,
    }
  );
}
```

**Example 2: Scope not found**
```javascript
if (!scopeData) {
  throw new ScopeResolutionError(
    `Scope "${fullScopeName}" not found`,
    {
      scopeName: fullScopeName,
      phase: 'scope lookup',
      parameters: {
        requestedScope: fullScopeName,
        registeredScopes: Array.from(scopeRegistry.keys()),
      },
      hint: 'Check that the scope is registered and the name is correct',
      suggestion: 'Available scopes: ' + Array.from(scopeRegistry.keys()).slice(0, 5).join(', '),
    }
  );
}
```

**Example 3: Filter evaluation failure**
```javascript
try {
  const result = logicEval.evaluate(node.logic, evalCtx);
} catch (err) {
  throw new ScopeResolutionError(
    'Filter logic evaluation failed',
    {
      scopeName: currentScopeName,
      phase: 'filter evaluation',
      parameters: {
        entityId: item.id,
        filterLogic: node.logic,
        contextKeys: Object.keys(evalCtx),
      },
      hint: 'Check that JSON Logic expression is valid and context has required fields',
      originalError: err,
    }
  );
}
```

---

### 3.3 Scope Evaluation Tracer

#### Overview

Comprehensive tracing system that captures step-by-step scope evaluation with input/output at each resolver, filter evaluations per entity, and formatted trace output.

#### Implementation

**New file**: `tests/common/mods/scopeEvaluationTracer.js`

```javascript
/**
 * @file Scope evaluation tracer for detailed debugging
 */

/**
 * Tracer for scope evaluation with step-by-step logging
 */
export class ScopeEvaluationTracer {
  constructor() {
    this.steps = [];
    this.enabled = false;
    this.startTime = null;
  }

  /**
   * Enable tracing
   */
  enable() {
    this.enabled = true;
    this.startTime = Date.now();
    this.steps = [];
  }

  /**
   * Disable tracing
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Check if tracing is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Log a resolver step
   *
   * @param {string} resolverName - Name of resolver (e.g., 'SourceResolver')
   * @param {string} operation - Operation description
   * @param {any} input - Input value to resolver
   * @param {any} output - Output value from resolver
   * @param {object} details - Additional details
   */
  logStep(resolverName, operation, input, output, details = {}) {
    if (!this.enabled) return;

    this.steps.push({
      timestamp: Date.now(),
      type: 'RESOLVER_STEP',
      resolver: resolverName,
      operation,
      input: this._serializeValue(input),
      output: this._serializeValue(output),
      details,
    });
  }

  /**
   * Log a filter evaluation for a single entity
   *
   * @param {string} entityId - Entity being evaluated
   * @param {object} logic - JSON Logic expression
   * @param {boolean} result - Pass/fail result
   * @param {object} evalContext - Evaluation context
   * @param {object} breakdown - Clause-level breakdown (optional)
   */
  logFilterEvaluation(entityId, logic, result, evalContext, breakdown = null) {
    if (!this.enabled) return;

    this.steps.push({
      timestamp: Date.now(),
      type: 'FILTER_EVALUATION',
      entityId,
      logic,
      result,
      context: evalContext,
      breakdown,
    });
  }

  /**
   * Log an error during evaluation
   *
   * @param {string} phase - Phase where error occurred
   * @param {Error} error - Error object
   * @param {object} context - Error context
   */
  logError(phase, error, context = {}) {
    if (!this.enabled) return;

    this.steps.push({
      timestamp: Date.now(),
      type: 'ERROR',
      phase,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      context,
    });
  }

  /**
   * Serialize a value for storage
   * @private
   */
  _serializeValue(value) {
    if (value instanceof Set) {
      return {
        type: 'Set',
        size: value.size,
        values: Array.from(value).slice(0, 10), // Limit to first 10
      };
    }

    if (Array.isArray(value)) {
      return {
        type: 'Array',
        size: value.length,
        values: value.slice(0, 10),
      };
    }

    if (value && typeof value === 'object') {
      return {
        type: 'Object',
        keys: Object.keys(value),
      };
    }

    return {
      type: typeof value,
      value,
    };
  }

  /**
   * Get raw trace data
   * @returns {object} Trace data
   */
  getTrace() {
    return {
      steps: this.steps,
      summary: {
        totalSteps: this.steps.length,
        resolverSteps: this.steps.filter(s => s.type === 'RESOLVER_STEP').length,
        filterEvaluations: this.steps.filter(s => s.type === 'FILTER_EVALUATION').length,
        errors: this.steps.filter(s => s.type === 'ERROR').length,
        duration: this.startTime ? Date.now() - this.startTime : 0,
        resolversUsed: [...new Set(
          this.steps.filter(s => s.type === 'RESOLVER_STEP').map(s => s.resolver)
        )],
        finalOutput: this.steps.filter(s => s.type === 'RESOLVER_STEP').pop()?.output,
      },
    };
  }

  /**
   * Format trace as human-readable text
   * @returns {string} Formatted trace
   */
  format() {
    if (this.steps.length === 0) {
      return 'SCOPE EVALUATION TRACE: (empty - tracing not enabled)';
    }

    let output = 'SCOPE EVALUATION TRACE:\n';
    output += '='.repeat(80) + '\n\n';

    let stepNumber = 1;

    this.steps.forEach((step) => {
      if (step.type === 'RESOLVER_STEP') {
        output += `${stepNumber}. [${step.resolver}] ${step.operation}\n`;
        output += `   Input: ${this._formatValue(step.input)}\n`;
        output += `   Output: ${this._formatValue(step.output)}\n`;

        if (Object.keys(step.details).length > 0) {
          output += `   Details: ${JSON.stringify(step.details, null, 2)}\n`;
        }

        stepNumber++;
        output += '\n';
      }

      if (step.type === 'FILTER_EVALUATION') {
        output += `  ${stepNumber}. [FilterEval] Entity: ${step.entityId}\n`;
        output += `     Result: ${step.result ? 'PASS ✓' : 'FAIL ✗'}\n`;

        if (step.breakdown) {
          output += `     Breakdown:\n`;
          output += this._formatBreakdown(step.breakdown, 3);
        }

        if (!step.result && step.context) {
          output += `     Context: ${JSON.stringify(step.context, null, 2)}\n`;
        }

        stepNumber++;
        output += '\n';
      }

      if (step.type === 'ERROR') {
        output += `  ❌ ERROR in ${step.phase}: ${step.error.message}\n`;
        output += `     ${JSON.stringify(step.context, null, 2)}\n`;
        output += '\n';
      }
    });

    output += '='.repeat(80) + '\n';
    const summary = this.getTrace().summary;
    output += `Summary: ${summary.totalSteps} steps, `;
    output += `${summary.duration}ms, `;
    output += `Final size: ${summary.finalOutput?.size || 0}\n`;

    return output;
  }

  /**
   * Format a value for display
   * @private
   */
  _formatValue(value) {
    if (!value) return String(value);

    if (value.type === 'Set' || value.type === 'Array') {
      return `${value.type} (${value.size} items) ${JSON.stringify(value.values.slice(0, 3))}${value.size > 3 ? '...' : ''}`;
    }

    if (value.type === 'Object') {
      return `Object {${value.keys.slice(0, 5).join(', ')}${value.keys.length > 5 ? '...' : ''}}`;
    }

    return `${value.type}: ${value.value}`;
  }

  /**
   * Format breakdown structure
   * @private
   */
  _formatBreakdown(breakdown, indent = 0) {
    const prefix = '  '.repeat(indent);
    let output = '';

    if (Array.isArray(breakdown)) {
      breakdown.forEach(clause => {
        const symbol = clause.result ? '✓' : '✗';
        output += `${prefix}${symbol} ${clause.operator || 'clause'}`;

        if (clause.expression) {
          output += ` ${JSON.stringify(clause.expression)}`;
        }

        output += '\n';

        if (clause.children) {
          output += this._formatBreakdown(clause.children, indent + 1);
        }
      });
    }

    return output;
  }

  /**
   * Clear trace data
   */
  clear() {
    this.steps = [];
    this.startTime = null;
  }
}
```

#### Integration with ModTestFixture

**Extend ModTestFixture** (`tests/common/mods/ModTestFixture.js`):

```javascript
export class ModTestFixture {
  constructor() {
    // ...existing properties...
    this.scopeTracer = new ScopeEvaluationTracer();
  }

  /**
   * Enable scope evaluation tracing
   */
  enableScopeTracing() {
    this.scopeTracer.enable();
  }

  /**
   * Disable scope evaluation tracing
   */
  disableScopeTracing() {
    this.scopeTracer.disable();
  }

  /**
   * Get formatted scope trace
   * @returns {string} Formatted trace output
   */
  getScopeTrace() {
    return this.scopeTracer.format();
  }

  /**
   * Get raw scope trace data
   * @returns {object} Trace data
   */
  getScopeTraceData() {
    return this.scopeTracer.getTrace();
  }

  /**
   * Clear scope trace
   */
  clearScopeTrace() {
    this.scopeTracer.clear();
  }
}
```

#### Integration with ScopeEngine

**Modify ScopeEngine** (`src/scopeDsl/engine.js`):

```javascript
resolve(ast, actorEntity, runtimeCtx, trace = null) {
  // ...validation...

  const ctx = {
    actorEntity,
    runtimeCtx,
    trace,
    tracer: runtimeCtx.tracer, // ADD: tracer from runtimeCtx
    // ...
  };

  // Dispatch to resolver
  const result = this.dispatch(ast, ctx);

  return result;
}

dispatch(node, ctx) {
  const { kind } = node;
  const resolver = this.#resolvers.get(kind);

  if (!resolver) {
    throw new Error(`No resolver for node kind: ${kind}`);
  }

  // ADD: Log to tracer before resolution
  if (ctx.tracer?.isEnabled()) {
    const input = ctx.currentSet || ctx.actorEntity;
    const resolverName = resolver.constructor.name;

    const result = resolver.resolve(node, ctx);

    // ADD: Log to tracer after resolution
    ctx.tracer.logStep(
      resolverName,
      `resolve(kind='${kind}')`,
      input,
      result,
      { node }
    );

    return result;
  }

  // Normal execution without tracing
  return resolver.resolve(node, ctx);
}
```

#### Integration with FilterResolver

**Modify FilterResolver** (`src/scopeDsl/nodes/filterResolver.js`):

```javascript
resolve(node, ctx) {
  const { actorEntity, dispatcher, trace, tracer } = ctx;

  // ...validation...

  const result = new Set();
  const filterEvaluations = [];

  for (const item of currentSet) {
    const entityId = typeof item === 'string' ? item : item?.id;

    // ...build evalCtx...

    const passedFilter = logicEval.evaluate(node.logic, evalCtx);

    // ADD: Log to tracer
    if (tracer?.isEnabled()) {
      tracer.logFilterEvaluation(
        entityId,
        node.logic,
        passedFilter,
        evalCtx
      );
    }

    if (passedFilter) {
      result.add(item);
    }

    // ...existing trace logging...
  }

  return result;
}
```

---

### 3.4 Filter Clause Breakdown

#### Overview

Analyze JSON Logic expressions to provide clause-level breakdown showing which AND/OR branches passed or failed, with component presence diagnostics.

#### Implementation

**New file**: `tests/common/mods/filterClauseAnalyzer.js`

```javascript
/**
 * @file Filter clause breakdown analyzer
 * Provides detailed breakdown of JSON Logic filter evaluation
 */

/**
 * Analyzes JSON Logic filter evaluation with clause-level breakdown
 */
export class FilterClauseAnalyzer {
  /**
   * Evaluate JSON Logic with clause-level breakdown
   *
   * @param {object} logic - JSON Logic expression
   * @param {object} context - Evaluation context
   * @param {object} logicEval - JSON Logic evaluator
   * @returns {object} Breakdown object with results
   */
  static evaluateWithBreakdown(logic, context, logicEval) {
    const breakdown = {
      overall: false,
      clauses: [],
    };

    /**
     * Recursively evaluate clauses
     */
    const evaluateClause = (expr, path = []) => {
      if (!expr || typeof expr !== 'object') {
        const result = logicEval.evaluate(expr, context);
        return {
          path: path.join('.'),
          operator: 'primitive',
          expression: expr,
          result,
        };
      }

      const entries = Object.entries(expr);
      if (entries.length === 0) {
        return {
          path: path.join('.'),
          operator: 'empty',
          result: true,
        };
      }

      const [operator, operands] = entries[0];

      // Handle AND operator
      if (operator === 'and') {
        const operandArray = Array.isArray(operands) ? operands : [operands];
        const results = operandArray.map((operand, i) =>
          evaluateClause(operand, [...path, `and[${i}]`])
        );

        const passed = results.every(r => r.result);

        return {
          path: path.join('.'),
          operator: 'and',
          result: passed,
          children: results,
        };
      }

      // Handle OR operator
      if (operator === 'or') {
        const operandArray = Array.isArray(operands) ? operands : [operands];
        const results = operandArray.map((operand, i) =>
          evaluateClause(operand, [...path, `or[${i}]`])
        );

        const passed = results.some(r => r.result);

        return {
          path: path.join('.'),
          operator: 'or',
          result: passed,
          children: results,
        };
      }

      // Handle NOT operator
      if (operator === 'not' || operator === '!') {
        const innerResult = evaluateClause(operands, [...path, 'not']);

        return {
          path: path.join('.'),
          operator: 'not',
          result: !innerResult.result,
          children: [innerResult],
        };
      }

      // Handle DOUBLE NEGATION (!!)
      if (operator === '!!') {
        const innerResult = evaluateClause(operands, [...path, '!!']);

        return {
          path: path.join('.'),
          operator: '!!',
          result: !!innerResult.result,
          children: [innerResult],
        };
      }

      // Handle condition_ref (special case)
      if (operator === 'condition_ref') {
        const result = logicEval.evaluate(expr, context);

        return {
          path: path.join('.'),
          operator: 'condition_ref',
          expression: expr,
          result,
          metadata: {
            conditionName: operands,
          },
        };
      }

      // Handle custom operations (hasPartOfType, isSocketCovered, etc.)
      if (typeof operands === 'object' && !Array.isArray(operands)) {
        // Complex operand structure
        const result = logicEval.evaluate(expr, context);

        return {
          path: path.join('.'),
          operator,
          expression: expr,
          result,
        };
      }

      // Leaf condition - evaluate entire expression
      const result = logicEval.evaluate(expr, context);

      return {
        path: path.join('.'),
        operator,
        expression: expr,
        result,
      };
    };

    // Evaluate top-level expression
    const topLevel = evaluateClause(logic);
    breakdown.clauses.push(topLevel);
    breakdown.overall = topLevel.result;

    return breakdown;
  }

  /**
   * Format breakdown for human-readable output
   *
   * @param {object} breakdown - Breakdown object from evaluateWithBreakdown
   * @param {object} options - Formatting options
   * @returns {string} Formatted output
   */
  static format(breakdown, options = {}) {
    const {
      showExpression = true,
      maxDepth = 10,
      indent = 2,
    } = options;

    const formatClause = (clause, depth = 0) => {
      if (depth > maxDepth) {
        return '  '.repeat(depth) + '... (max depth)\n';
      }

      const prefix = '  '.repeat(depth);
      const symbol = clause.result ? '✓' : '✗';
      let output = `${prefix}${symbol} ${clause.operator}`;

      if (showExpression && clause.expression) {
        const exprStr = JSON.stringify(clause.expression);
        if (exprStr.length > 60) {
          output += ` ${exprStr.slice(0, 57)}...`;
        } else {
          output += ` ${exprStr}`;
        }
      }

      if (clause.metadata) {
        output += ` (${JSON.stringify(clause.metadata)})`;
      }

      output += '\n';

      if (clause.children) {
        clause.children.forEach(child => {
          output += formatClause(child, depth + 1);
        });
      }

      return output;
    };

    let output = `Filter Evaluation: ${breakdown.overall ? 'PASS ✓' : 'FAIL ✗'}\n`;
    breakdown.clauses.forEach(clause => {
      output += formatClause(clause, 0);
    });

    return output;
  }

  /**
   * Get failure reasons from breakdown
   *
   * @param {object} breakdown - Breakdown object
   * @returns {Array<object>} List of failure reasons
   */
  static getFailureReasons(breakdown) {
    const reasons = [];

    const collectFailures = (clause, parentPath = []) => {
      const currentPath = [...parentPath, clause.operator];

      if (!clause.result) {
        if (!clause.children || clause.children.length === 0) {
          // Leaf failure
          reasons.push({
            path: currentPath.join(' → '),
            operator: clause.operator,
            expression: clause.expression,
            metadata: clause.metadata,
          });
        } else {
          // Branch failure - recurse to find leaf failures
          clause.children.forEach(child => {
            collectFailures(child, currentPath);
          });
        }
      }
    };

    breakdown.clauses.forEach(clause => collectFailures(clause));

    return reasons;
  }

  /**
   * Get diagnostic summary
   *
   * @param {object} breakdown - Breakdown object
   * @returns {object} Diagnostic summary
   */
  static getDiagnosticSummary(breakdown) {
    const totalClauses = this._countClauses(breakdown.clauses);
    const passedClauses = this._countPassedClauses(breakdown.clauses);
    const failureReasons = this.getFailureReasons(breakdown);

    return {
      overall: breakdown.overall,
      totalClauses,
      passedClauses,
      failedClauses: totalClauses - passedClauses,
      passRate: totalClauses > 0 ? (passedClauses / totalClauses) : 0,
      failureReasons,
    };
  }

  /**
   * Count total clauses
   * @private
   */
  static _countClauses(clauses) {
    let count = 0;

    clauses.forEach(clause => {
      count++;
      if (clause.children) {
        count += this._countClauses(clause.children);
      }
    });

    return count;
  }

  /**
   * Count passed clauses
   * @private
   */
  static _countPassedClauses(clauses) {
    let count = 0;

    clauses.forEach(clause => {
      if (clause.result) count++;
      if (clause.children) {
        count += this._countPassedClauses(clause.children);
      }
    });

    return count;
  }
}
```

#### Integration with FilterResolver

**Modify FilterResolver** (`src/scopeDsl/nodes/filterResolver.js`):

```javascript
resolve(node, ctx) {
  const { actorEntity, dispatcher, trace, tracer } = ctx;

  // ...validation...

  const result = new Set();
  const filterEvaluations = [];

  for (const item of currentSet) {
    const entityId = typeof item === 'string' ? item : item?.id;

    // ...build evalCtx...

    // REPLACE simple evaluation with breakdown
    const breakdown = FilterClauseAnalyzer.evaluateWithBreakdown(
      node.logic,
      evalCtx,
      logicEval
    );

    const passedFilter = breakdown.overall;

    // Log to tracer with breakdown
    if (tracer?.isEnabled()) {
      tracer.logFilterEvaluation(
        entityId,
        node.logic,
        passedFilter,
        evalCtx,
        breakdown.clauses
      );
    }

    // Log to trace (existing diagnostic mode)
    if (trace || testEnv.diagnostics?.enabled) {
      filterEvaluations.push({
        entityId,
        passedFilter,
        breakdown: breakdown.clauses,
        formatted: FilterClauseAnalyzer.format(breakdown),
        summary: FilterClauseAnalyzer.getDiagnosticSummary(breakdown),
      });
    }

    if (passedFilter) {
      result.add(item);
    }
  }

  // ...existing trace logging...

  return result;
}
```

---

### 3.5 Performance Metrics

#### Overview

Add timing information to trace steps to identify performance bottlenecks and provide optimization suggestions.

#### Implementation

**Extend ScopeEvaluationTracer** (add to existing class):

```javascript
export class ScopeEvaluationTracer {
  // ...existing methods...

  /**
   * Log a resolver step with timing
   *
   * @param {string} resolverName - Name of resolver
   * @param {string} operation - Operation description
   * @param {any} input - Input value
   * @param {any} output - Output value
   * @param {object} details - Additional details
   * @param {number} duration - Execution time in ms
   */
  logStepWithTiming(resolverName, operation, input, output, details, duration) {
    if (!this.enabled) return;

    this.steps.push({
      timestamp: Date.now(),
      type: 'RESOLVER_STEP',
      resolver: resolverName,
      operation,
      input: this._serializeValue(input),
      output: this._serializeValue(output),
      details,
      duration, // ADD: duration in ms
    });
  }

  /**
   * Get performance summary
   * @returns {object} Performance metrics
   */
  getPerformanceSummary() {
    const resolverSteps = this.steps.filter(s => s.type === 'RESOLVER_STEP' && s.duration !== undefined);

    if (resolverSteps.length === 0) {
      return { message: 'No timing data available' };
    }

    const totalDuration = resolverSteps.reduce((sum, s) => sum + s.duration, 0);

    const byResolver = {};
    resolverSteps.forEach(step => {
      if (!byResolver[step.resolver]) {
        byResolver[step.resolver] = {
          count: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
        };
      }

      const stats = byResolver[step.resolver];
      stats.count++;
      stats.totalDuration += step.duration;
      stats.minDuration = Math.min(stats.minDuration, step.duration);
      stats.maxDuration = Math.max(stats.maxDuration, step.duration);
    });

    // Calculate averages and percentages
    Object.values(byResolver).forEach(stats => {
      stats.avgDuration = stats.totalDuration / stats.count;
      stats.percentage = (stats.totalDuration / totalDuration) * 100;
    });

    // Sort by total duration (slowest first)
    const sorted = Object.entries(byResolver)
      .sort((a, b) => b[1].totalDuration - a[1].totalDuration);

    return {
      totalDuration,
      resolverCount: resolverSteps.length,
      byResolver: Object.fromEntries(sorted),
      slowest: sorted[0],
    };
  }

  /**
   * Format performance summary
   * @returns {string} Formatted performance report
   */
  formatPerformance() {
    const summary = this.getPerformanceSummary();

    if (summary.message) {
      return summary.message;
    }

    let output = 'SCOPE EVALUATION PERFORMANCE:\n';
    output += '='.repeat(80) + '\n';
    output += `Total Duration: ${summary.totalDuration.toFixed(2)}ms\n`;
    output += `Total Steps: ${summary.resolverCount}\n\n`;

    output += 'Breakdown by Resolver:\n';
    Object.entries(summary.byResolver).forEach(([resolver, stats]) => {
      const bar = '█'.repeat(Math.floor(stats.percentage / 2));
      output += `  ${resolver}:\n`;
      output += `    Total: ${stats.totalDuration.toFixed(2)}ms (${stats.percentage.toFixed(1)}%)\n`;
      output += `    Count: ${stats.count} calls\n`;
      output += `    Avg: ${stats.avgDuration.toFixed(2)}ms\n`;
      output += `    Range: ${stats.minDuration.toFixed(2)}ms - ${stats.maxDuration.toFixed(2)}ms\n`;
      output += `    ${bar}\n`;
    });

    output += '\n';

    // Optimization suggestions
    if (summary.slowest[1].percentage > 50) {
      output += '💡 Optimization Suggestion:\n';
      output += `   ${summary.slowest[0]} is taking ${summary.slowest[1].percentage.toFixed(1)}% of execution time.\n`;
      output += `   Consider optimizing this resolver or caching results.\n`;
    }

    return output;
  }
}
```

#### Integration with ScopeEngine

```javascript
dispatch(node, ctx) {
  const { kind } = node;
  const resolver = this.#resolvers.get(kind);

  if (!resolver) {
    throw new Error(`No resolver for node kind: ${kind}`);
  }

  // ADD: Timing measurement
  if (ctx.tracer?.isEnabled()) {
    const input = ctx.currentSet || ctx.actorEntity;
    const resolverName = resolver.constructor.name;

    const startTime = performance.now();
    const result = resolver.resolve(node, ctx);
    const duration = performance.now() - startTime;

    ctx.tracer.logStepWithTiming(
      resolverName,
      `resolve(kind='${kind}')`,
      input,
      result,
      { node },
      duration
    );

    return result;
  }

  return resolver.resolve(node, ctx);
}
```

---

## 4. Implementation Roadmap

### Phase 1: Parameter Validation (Week 1)
**Priority**: 🔴 Critical
**Goal**: Eliminate silent failures and type confusion

**Tasks**:
1. Create `src/scopeDsl/core/parameterValidator.js`
2. Create `src/scopeDsl/core/parameterValidationError.js`
3. Integrate validation into:
   - `ScopeEngine.resolve()`
   - `FilterResolver.resolve()`
   - `SourceResolver.resolve()`
   - `ModTestFixture.registerCustomScope()`
   - `ScopeResolverHelpers.registerCustomScope()`
4. Write unit tests for parameter validation
5. Update integration tests to expect new error messages

**Success Criteria**:
- ✅ All parameter type mismatches throw `ParameterValidationError`
- ✅ Error messages include hints and examples
- ✅ 100% test coverage for validator class

---

### Phase 2: Enhanced Error Context (Week 2)
**Priority**: 🔴 Critical
**Goal**: Improve developer experience with clear, actionable errors

**Tasks**:
1. Create `src/scopeDsl/core/scopeResolutionError.js`
2. Wrap all scope resolution errors with `ScopeResolutionError`
3. Add context collection at error sites:
   - Scope name
   - Parameters
   - Hints and suggestions
   - Original error preservation
4. Update error handling in test fixtures
5. Create integration tests showing improved error messages

**Success Criteria**:
- ✅ All scope errors include full context
- ✅ Error messages provide fix suggestions
- ✅ Stack traces preserved for debugging

---

### Phase 3: Scope Evaluation Tracer (Week 3-4)
**Priority**: 🟡 High
**Goal**: Enable step-by-step debugging of scope evaluation

**Tasks**:
1. Create `tests/common/mods/scopeEvaluationTracer.js`
2. Extend `ModTestFixture` with tracer methods:
   - `enableScopeTracing()`
   - `getScopeTrace()`
   - `clearScopeTrace()`
3. Integrate tracer into:
   - `ScopeEngine.dispatch()`
   - `FilterResolver.resolve()`
   - `SourceResolver.resolve()`
   - `StepResolver.resolve()`
4. Add `runtimeCtx.tracer` to test environment setup
5. Create comprehensive tracing examples in tests
6. Document tracer API in `docs/testing/mod-testing-guide.md`

**Success Criteria**:
- ✅ Complete resolver execution flow captured
- ✅ Input/output logged at each step
- ✅ Filter evaluations logged per entity
- ✅ Formatted output is human-readable

---

### Phase 4: Filter Clause Breakdown (Week 5)
**Priority**: 🟡 High
**Goal**: Show exactly which filter clauses fail and why

**Tasks**:
1. Create `tests/common/mods/filterClauseAnalyzer.js`
2. Implement recursive JSON Logic evaluation with breakdown
3. Integrate breakdown into `FilterResolver`:
   - Replace simple `logicEval.evaluate()` calls
   - Log breakdown to tracer
   - Add breakdown to diagnostic output
4. Create helper methods:
   - `getFailureReasons()`
   - `getDiagnosticSummary()`
5. Add breakdown examples to documentation

**Success Criteria**:
- ✅ Clause-level pass/fail indication
- ✅ Shows which AND/OR branches failed
- ✅ Formatted output with visual indicators
- ✅ Failure reasons extracted automatically

---

### Phase 5: Performance Metrics (Week 6)
**Priority**: 🟢 Medium
**Goal**: Identify performance bottlenecks and provide optimization guidance

**Tasks**:
1. Add timing to `ScopeEvaluationTracer`
2. Measure resolver execution time
3. Add performance summary methods:
   - `getPerformanceSummary()`
   - `formatPerformance()`
4. Add optimization suggestions based on metrics
5. Create performance benchmarking tests
6. Document performance analysis in guide

**Success Criteria**:
- ✅ Per-step timing captured
- ✅ Performance summary shows bottlenecks
- ✅ Optimization suggestions provided
- ✅ Minimal overhead (<5%) when tracing disabled

---

## 5. Usage Examples

### Example 1: Parameter Type Confusion

#### Before (Current State)

```javascript
// Test file
it('should discover action when conditions met', async () => {
  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

  // Setup components...

  const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
  expect(actions.map(a => a.id)).toContain('my-mod:my-action');
});

// Test fails with:
// TypeError: Cannot read property 'id' of undefined
//   at FilterResolver.resolve (filterResolver.js:113)
```

**Developer experience**:
- Generic error message
- No indication of parameter type mismatch
- Must debug through multiple layers to find root cause
- Time lost: ~45 minutes

#### After (With Improvements)

```javascript
// Same test file

// Test fails with:
// ParameterValidationError: CustomScopeResolver: actorEntity has invalid 'id' property: undefined
//   Expected: string id property
//   Received: undefined
//   💡 Hint: You appear to have passed the entire context object instead of extracting actorEntity.
//           Extract actorEntity from context before calling ScopeEngine.resolve()
//   Example:
//     const actorEntity = context.actorEntity || context.actor;
//     scopeEngine.resolve(ast, actorEntity, runtimeCtx);
```

**Developer experience**:
- Clear error message with root cause
- Hint explains the mistake
- Example shows the fix
- Time saved: ~40 minutes

---

### Example 2: Empty Set Mystery

#### Before (Current State)

```javascript
// Test file
it('should discover action', async () => {
  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

  testFixture.testEnv.entityManager.addComponent(
    scenario.target.id,
    'positioning:facing_away',
    { facing_away_from: [scenario.actor.id] }
  );
  // ...more component setup...

  const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
  expect(actions.map(a => a.id)).toContain('my-mod:my-action');
});

// Test fails:
// Expected [] to contain "my-mod:my-action"
```

**Developer questions**:
- Why is the action not discovered?
- Are components set up correctly?
- Is the scope filter working?
- Which condition is failing?

**Debugging steps**:
1. Add manual logging to inspect components ✓
2. Manually verify scope syntax ✓
3. Guess which filter clause might be failing ✗
4. Add more logging to trace evaluation ✓
5. Eventually find that `facing_away_from` array is empty ✓

**Time lost**: ~60 minutes

#### After (With Improvements)

```javascript
// Test file
it('should discover action', async () => {
  testFixture.enableScopeTracing(); // ENABLE TRACING

  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

  testFixture.testEnv.entityManager.addComponent(
    scenario.target.id,
    'positioning:facing_away',
    { facing_away_from: [] } // BUG: Empty array
  );
  // ...more component setup...

  const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);

  if (actions.length === 0) {
    console.log(testFixture.getScopeTrace()); // GET TRACE
  }

  expect(actions.map(a => a.id)).toContain('my-mod:my-action');
});

// Console output:
// SCOPE EVALUATION TRACE:
// ================================================================================
//
// 1. [SourceResolver] resolve(kind='actor')
//    Input: Context object
//    Output: Set (1 item) ['actor-alice-123']
//
// 2. [StepResolver] resolve(field='components.positioning:closeness.partners')
//    Input: Set (1 item) ['actor-alice-123']
//    Output: Set (1 item) ['actor-bob-456']
//
// 3. [FilterResolver] Evaluating 1 entities
//
//    Entity: actor-bob-456
//    Result: FAIL ✗
//    Breakdown:
//      ✓ and
//        ✓ and
//          ✓ hasPartOfType: [".", "asshole"]
//          ✓ not
//            ✓ isSocketCovered: [".", "asshole"]
//        ✗ or  ← FAILED HERE
//          ✗ condition_ref: "positioning:actor-in-entity-facing-away"
//            Component positioning:facing_away exists: YES
//            Value: { facing_away_from: [] }
//            Actor in facing_away_from list: NO  ← ROOT CAUSE
//          ✗ !!
//            var: "entity.components.positioning:lying_down"
//            Component positioning:lying_down exists: NO
//
//    Output: Set (0 items) []
//
// ================================================================================
// Summary: 3 steps, 23ms, Final size: 0
//
// 💡 Diagnosis: Filter failed because:
//    - Target has asshole: YES
//    - Asshole is exposed: YES
//    - Target is facing away from actor: NO (facing_away_from = [])  ← FIX THIS
//    - Target is lying down: NO
```

**Developer experience**:
- Immediately sees step-by-step evaluation
- Filter breakdown shows exact clause that failed
- Diagnosis points to empty `facing_away_from` array
- Fix: Change `[]` to `[scenario.actor.id]`

**Time saved**: ~55 minutes

---

### Example 3: Performance Debugging

#### Before (Current State)

```javascript
// Test is slow but no visibility into why
it('should handle large entity sets', async () => {
  // Create 10,000 entities
  for (let i = 0; i < 10000; i++) {
    testFixture.createEntity(`entity-${i}`, []);
  }

  const actions = testFixture.testEnv.getAvailableActions('actor-1');

  // Takes 5+ seconds, no idea which part is slow
});
```

**Developer questions**:
- Which resolver is slow?
- Is it the filter evaluation?
- Is it component lookups?
- How can I optimize?

#### After (With Improvements)

```javascript
// Same test with tracing
it('should handle large entity sets', async () => {
  testFixture.enableScopeTracing();

  // Create 10,000 entities
  for (let i = 0; i < 10000; i++) {
    testFixture.createEntity(`entity-${i}`, []);
  }

  const actions = testFixture.testEnv.getAvailableActions('actor-1');

  console.log(testFixture.scopeTracer.formatPerformance());
});

// Console output:
// SCOPE EVALUATION PERFORMANCE:
// ================================================================================
// Total Duration: 5,234.56ms
// Total Steps: 3
//
// Breakdown by Resolver:
//   FilterResolver:
//     Total: 5,189.23ms (99.1%)  ← BOTTLENECK IDENTIFIED
//     Count: 1 calls
//     Avg: 5,189.23ms
//     Range: 5,189.23ms - 5,189.23ms
//     ██████████████████████████████████████████████████
//
//   StepResolver:
//     Total: 42.15ms (0.8%)
//     Count: 1 calls
//     Avg: 42.15ms
//     Range: 42.15ms - 42.15ms
//     ▌
//
//   SourceResolver:
//     Total: 3.18ms (0.1%)
//     Count: 1 calls
//     Avg: 3.18ms
//     Range: 3.18ms - 3.18ms
//     ▌
//
// 💡 Optimization Suggestion:
//    FilterResolver is taking 99.1% of execution time.
//    Consider optimizing filter evaluation or adding indexed component lookups.
```

**Developer experience**:
- Immediately identifies FilterResolver as bottleneck
- Knows to optimize filter evaluation
- Can add component indexing or caching
- Has metrics to verify optimization impact

**Time saved**: ~2 hours of profiling and guessing

---

## 6. API Design

### 6.1 ModTestFixture Extensions

```javascript
class ModTestFixture {
  /**
   * Enable scope evaluation tracing
   * @returns {void}
   */
  enableScopeTracing() {
    this.scopeTracer.enable();
  }

  /**
   * Disable scope evaluation tracing
   * @returns {void}
   */
  disableScopeTracing() {
    this.scopeTracer.disable();
  }

  /**
   * Get formatted scope trace output
   * @returns {string} Human-readable trace
   */
  getScopeTrace() {
    return this.scopeTracer.format();
  }

  /**
   * Get raw scope trace data
   * @returns {object} Trace data structure
   */
  getScopeTraceData() {
    return this.scopeTracer.getTrace();
  }

  /**
   * Get scope performance summary
   * @returns {object} Performance metrics
   */
  getScopePerformance() {
    return this.scopeTracer.getPerformanceSummary();
  }

  /**
   * Get formatted performance report
   * @returns {string} Human-readable performance report
   */
  getScopePerformanceReport() {
    return this.scopeTracer.formatPerformance();
  }

  /**
   * Get filter breakdown for last evaluation
   * @param {string} entityId - Optional entity ID to filter by
   * @returns {object} Filter breakdown
   */
  getFilterBreakdown(entityId = null) {
    const trace = this.scopeTracer.getTrace();
    const filterEvals = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

    if (entityId) {
      return filterEvals.find(e => e.entityId === entityId);
    }

    return filterEvals;
  }

  /**
   * Clear scope trace data
   * @returns {void}
   */
  clearScopeTrace() {
    this.scopeTracer.clear();
  }
}
```

### 6.2 Usage Patterns

**Pattern 1: Basic Tracing**
```javascript
it('test with tracing', async () => {
  testFixture.enableScopeTracing();

  // Perform operations...

  console.log(testFixture.getScopeTrace());
});
```

**Pattern 2: Conditional Tracing**
```javascript
it('test with conditional tracing', async () => {
  const actions = testFixture.testEnv.getAvailableActions(actor.id);

  if (actions.length === 0) {
    testFixture.enableScopeTracing();
    // Re-run to get trace
    testFixture.testEnv.getAvailableActions(actor.id);
    console.log(testFixture.getScopeTrace());
  }

  expect(actions).not.toHaveLength(0);
});
```

**Pattern 3: Performance Analysis**
```javascript
it('performance test', async () => {
  testFixture.enableScopeTracing();

  // Create large dataset
  for (let i = 0; i < 10000; i++) {
    testFixture.createEntity(`entity-${i}`, []);
  }

  testFixture.testEnv.getAvailableActions(actor.id);

  console.log(testFixture.getScopePerformanceReport());
});
```

**Pattern 4: Filter Breakdown Analysis**
```javascript
it('filter analysis', async () => {
  testFixture.enableScopeTracing();

  const actions = testFixture.testEnv.getAvailableActions(actor.id);

  const breakdown = testFixture.getFilterBreakdown('target-entity-id');

  if (breakdown && !breakdown.result) {
    console.log('Filter failed for target-entity-id:');
    console.log(FilterClauseAnalyzer.format(breakdown.breakdown));

    const reasons = FilterClauseAnalyzer.getFailureReasons(breakdown.breakdown);
    console.log('Failure reasons:', reasons);
  }
});
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Parameter Validation Tests** (`tests/unit/scopeDsl/core/parameterValidator.test.js`):
```javascript
describe('ParameterValidator', () => {
  describe('validateActorEntity', () => {
    it('should pass for valid entity', () => {
      const entity = { id: 'actor-123', components: {} };
      expect(() => {
        ParameterValidator.validateActorEntity(entity, 'test');
      }).not.toThrow();
    });

    it('should throw for undefined', () => {
      expect(() => {
        ParameterValidator.validateActorEntity(undefined, 'test');
      }).toThrow(ParameterValidationError);
    });

    it('should throw for object without id', () => {
      expect(() => {
        ParameterValidator.validateActorEntity({ components: {} }, 'test');
      }).toThrow(ParameterValidationError);
    });

    it('should detect context object and provide hint', () => {
      const context = { actor: {}, targets: {} };

      try {
        ParameterValidator.validateActorEntity(context, 'test');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ParameterValidationError);
        expect(err.context.hint).toContain('entire context object');
      }
    });
  });

  describe('validateRuntimeContext', () => {
    it('should pass for valid runtimeCtx', () => {
      const runtimeCtx = {
        entityManager: {},
        jsonLogicEval: {},
        logger: {},
      };

      expect(() => {
        ParameterValidator.validateRuntimeContext(runtimeCtx, 'test');
      }).not.toThrow();
    });

    it('should throw for missing services', () => {
      const runtimeCtx = { entityManager: {} }; // Missing logger, jsonLogicEval

      expect(() => {
        ParameterValidator.validateRuntimeContext(runtimeCtx, 'test');
      }).toThrow(ParameterValidationError);
    });
  });
});
```

**Filter Clause Analyzer Tests** (`tests/unit/common/mods/filterClauseAnalyzer.test.js`):
```javascript
describe('FilterClauseAnalyzer', () => {
  let jsonLogicEval;

  beforeEach(() => {
    jsonLogicEval = {
      evaluate: (logic, context) => {
        // Mock JSON Logic evaluation
        return true;
      },
    };
  });

  describe('evaluateWithBreakdown', () => {
    it('should handle AND operator', () => {
      const logic = {
        and: [
          { '==': [1, 1] },
          { '==': [2, 2] },
        ],
      };

      const breakdown = FilterClauseAnalyzer.evaluateWithBreakdown(
        logic,
        {},
        jsonLogicEval
      );

      expect(breakdown.overall).toBe(true);
      expect(breakdown.clauses).toHaveLength(1);
      expect(breakdown.clauses[0].operator).toBe('and');
      expect(breakdown.clauses[0].children).toHaveLength(2);
    });

    it('should handle OR operator', () => {
      const logic = {
        or: [
          { '==': [1, 2] }, // false
          { '==': [2, 2] }, // true
        ],
      };

      const breakdown = FilterClauseAnalyzer.evaluateWithBreakdown(
        logic,
        {},
        jsonLogicEval
      );

      expect(breakdown.overall).toBe(true);
      expect(breakdown.clauses[0].operator).toBe('or');
    });

    it('should handle nested logic', () => {
      const logic = {
        and: [
          {
            or: [
              { '==': [1, 1] },
              { '==': [2, 2] },
            ],
          },
          { '==': [3, 3] },
        ],
      };

      const breakdown = FilterClauseAnalyzer.evaluateWithBreakdown(
        logic,
        {},
        jsonLogicEval
      );

      expect(breakdown.clauses[0].children[0].operator).toBe('or');
      expect(breakdown.clauses[0].children[0].children).toHaveLength(2);
    });
  });

  describe('getFailureReasons', () => {
    it('should extract failure reasons', () => {
      jsonLogicEval.evaluate = (logic) => {
        if (logic['=='] && logic['=='][0] === 1) return false;
        return true;
      };

      const logic = {
        and: [
          { '==': [1, 2] }, // FAIL
          { '==': [2, 2] }, // PASS
        ],
      };

      const breakdown = FilterClauseAnalyzer.evaluateWithBreakdown(
        logic,
        {},
        jsonLogicEval
      );

      const reasons = FilterClauseAnalyzer.getFailureReasons(breakdown);

      expect(reasons).toHaveLength(1);
      expect(reasons[0].operator).toBe('==');
    });
  });
});
```

### 7.2 Integration Tests

**Scope Tracing Integration** (`tests/integration/scopeDsl/scopeTracingIntegration.test.js`):
```javascript
describe('Scope Tracing Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should capture complete trace', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const trace = testFixture.getScopeTraceData();

    expect(trace.steps.length).toBeGreaterThan(0);
    expect(trace.summary.resolversUsed).toContain('SourceResolver');
    expect(trace.summary.resolversUsed).toContain('FilterResolver');
  });

  it('should capture filter evaluations', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const filterEvals = testFixture.getFilterBreakdown();

    expect(filterEvals.length).toBeGreaterThan(0);
    expect(filterEvals[0]).toHaveProperty('entityId');
    expect(filterEvals[0]).toHaveProperty('result');
    expect(filterEvals[0]).toHaveProperty('breakdown');
  });

  it('should format trace as human-readable text', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const formatted = testFixture.getScopeTrace();

    expect(formatted).toContain('SCOPE EVALUATION TRACE');
    expect(formatted).toContain('SourceResolver');
    expect(formatted).toContain('Summary:');
  });
});
```

### 7.3 Performance Benchmarks

**Tracer Overhead Benchmark** (`tests/performance/scopeDsl/tracerOverhead.performance.test.js`):
```javascript
describe('Tracer Performance Overhead', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should have minimal overhead when disabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Benchmark without tracing
    const start1 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.getAvailableActions(scenario.actor.id);
    }
    const duration1 = performance.now() - start1;

    // Benchmark with tracing disabled (should have no overhead)
    testFixture.scopeTracer.disable();
    const start2 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.getAvailableActions(scenario.actor.id);
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;

    expect(overhead).toBeLessThan(5); // Less than 5% overhead
  });

  it('should have acceptable overhead when enabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Benchmark without tracing
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.getAvailableActions(scenario.actor.id);
    }
    const duration1 = performance.now() - start1;

    // Clear trace between runs
    testFixture.clearScopeTrace();

    // Benchmark with tracing enabled
    testFixture.enableScopeTracing();
    const start2 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.getAvailableActions(scenario.actor.id);
      testFixture.clearScopeTrace();
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;

    expect(overhead).toBeLessThan(30); // Less than 30% overhead with tracing
  });
});
```

### 7.4 Documentation Updates

**Update mod-testing-guide.md** (`docs/testing/mod-testing-guide.md`):

Add new section:

```markdown
## Debugging with Scope Tracing

### Overview

When scope resolution fails or returns unexpected results, use scope tracing to get step-by-step visibility into the evaluation process.

### Enabling Tracing

```javascript
testFixture.enableScopeTracing();
```

### Getting Trace Output

```javascript
// Get formatted trace
console.log(testFixture.getScopeTrace());

// Get raw trace data
const trace = testFixture.getScopeTraceData();

// Get filter breakdown
const breakdown = testFixture.getFilterBreakdown('entity-id');
```

### Example Usage

```javascript
it('should discover action with tracing', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

  // Setup components...

  const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);

  if (actions.length === 0) {
    // Print trace to see why no actions were discovered
    console.log(testFixture.getScopeTrace());

    // Get filter breakdown for specific entity
    const breakdown = testFixture.getFilterBreakdown('target-entity-id');
    console.log(FilterClauseAnalyzer.format(breakdown.breakdown));
  }

  expect(actions.map(a => a.id)).toContain('my-action');
});
```

### Performance Analysis

Get performance metrics to identify bottlenecks:

```javascript
testFixture.enableScopeTracing();

// Perform operations...

console.log(testFixture.getScopePerformanceReport());
```

### Best Practices

1. **Enable conditionally**: Only enable tracing when debugging failures
2. **Clear between runs**: Call `testFixture.clearScopeTrace()` to reset
3. **Use filter breakdown**: When entities don't match, analyze filter breakdown
4. **Check performance**: Use performance report to optimize slow scopes
```

---

## Summary

This specification provides a comprehensive plan to improve the mod testing infrastructure's diagnostic capabilities, directly addressing the issues encountered during the debugging session:

| Issue | Solution | Priority |
|-------|----------|----------|
| Parameter type confusion | ParameterValidator class | 🔴 Critical |
| Poor error messages | ScopeResolutionError wrapper | 🔴 Critical |
| No scope tracing | ScopeEvaluationTracer | 🟡 High |
| Filter mystery | FilterClauseAnalyzer | 🟡 High |
| Performance blind spots | Performance metrics | 🟢 Medium |

**Expected Impact**:
- **Debugging time**: 70% reduction (from 3.5 hours to ~1 hour for similar issues)
- **Developer confidence**: Higher trust in testing infrastructure
- **Onboarding**: Easier for new developers to understand errors
- **Code quality**: Better diagnostics lead to better fixes instead of workarounds

**Next Steps**:
1. Review and approve specification
2. Begin Phase 1 implementation (Parameter Validation)
3. Iterate through phases with continuous feedback
4. Update documentation as features are completed
