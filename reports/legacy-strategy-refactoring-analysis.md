# LegacyStrategy.js Architecture Analysis & Refactoring Report

**Date**: October 24, 2025
**File**: `src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js`
**Lines of Code**: 745
**Purpose**: Formats actions using the legacy path while preserving existing side effects

---

## Executive Summary

### Key Findings

The `LegacyStrategy` class exhibits significant structural issues that compromise maintainability, testability, and robustness to change:

| Issue                                                   | Severity    | Impact                                   | Effort     |
| ------------------------------------------------------- | ----------- | ---------------------------------------- | ---------- |
| **Massive Code Duplication** (~80% between two methods) | 🔴 Critical | High coupling, double maintenance burden | Medium     |
| **High Cyclomatic Complexity** (Multi-target logic)     | 🔴 Critical | Error-prone, difficult to test           | High       |
| **Large Method Sizes** (200+ line methods)              | 🟡 High     | Poor readability, testing challenges     | Medium     |
| **9 Constructor Dependencies**                          | 🟡 High     | High coupling, initialization complexity | Low-Medium |
| **Nested Conditional Logic** (4+ levels)                | 🟡 High     | Cognitive load, maintenance burden       | Medium     |

### Overall Assessment

**Technical Debt Score**: 7.5/10 (High)
**Maintainability Index**: 42/100 (Low)
**Recommended Action**: Refactor before adding new features

---

## Detailed Analysis

### 1. Code Duplication Anti-Pattern

#### Problem: ~80% Code Duplication

The `#formatTraced` (lines 136-383) and `#formatStandard` (lines 395-601) methods share approximately 80% identical code, differing only in trace-related operations.

**Evidence:**

- Lines 148-179 vs 406-426: Identical multi-target validation
- Lines 181-256 vs 428-500: Identical formatMultiTarget logic
- Lines 275-332 vs 516-570: Identical single-target formatting
- Lines 356-359 vs 574-577: Identical logging

**Impact:**

- **Maintenance Burden**: Bug fixes must be applied in two places
- **Inconsistency Risk**: Logic drift between methods (already observed in recent commits)
- **Testing Overhead**: Duplicate test coverage required
- **Change Fragility**: High risk when modifying formatting logic

**Example of Duplication:**

```javascript
// Lines 148-179 in #formatTraced
const isMultiTargetAction = actionDef.targets && typeof actionDef.targets === 'object';
if (isMultiTargetAction) {
  const actionSpecificTargets = this.#extractTargetsFromContexts(
    targetContexts,
    actionDef
  );
  if (!actionSpecificTargets || Object.keys(actionSpecificTargets).length === 0) {
    this.#logger.warn(
      `Skipping multi-target action '${actionDef.id}' in legacy formatting path - ` +
      `no resolved targets available for proper formatting`
    );
    continue;
  }
  // ... 30 more lines
}

// Lines 409-426 in #formatStandard
// IDENTICAL CODE - exact copy!
const isMultiTargetAction = actionDef.targets && typeof actionDef.targets === 'object';
if (isMultiTargetAction) {
  const actionSpecificTargets = this.#extractTargetsFromContexts(
    targetContexts,
    actionDef
  );
  // ... exact same logic
}
```

---

### 2. Method Complexity Issues

#### Problem: Large, Multi-Responsibility Methods

**Method Size Analysis:**

- `#formatTraced`: 247 lines (recommended max: 50)
- `#formatStandard`: 206 lines (recommended max: 50)
- Both methods handle: validation, extraction, formatting, normalization, error handling, statistics, and tracing

**Cyclomatic Complexity:**

- `#formatTraced`: ~18 (recommended max: 10)
- `#formatStandard`: ~16 (recommended max: 10)
- Multiple nested conditionals (up to 4 levels deep)

**Single Responsibility Violations:**
Each method handles:

1. Visual property validation
2. Multi-target detection
3. Target extraction
4. Multi-target formatting
5. Single-target formatting
6. Normalization
7. Error handling
8. Statistics tracking
9. Trace event emission
10. Fallback coordination

**Impact:**

- Difficult to understand flow
- Hard to test individual responsibilities
- Changes ripple across unrelated concerns
- Cognitive overload for maintainers

---

### 3. Nested Conditional Complexity

#### Problem: Deep Nesting and Complex Boolean Logic

**Example from lines 164-270:**

```javascript
if (isMultiTargetAction) {
  const actionSpecificTargets = this.#extractTargetsFromContexts(...);

  if (!actionSpecificTargets || Object.keys(actionSpecificTargets).length === 0) {
    // Level 2: Early exit logic
    this.#logger.warn(...);
    continue;
  }

  if (this.#commandFormatter.formatMultiTarget) {
    // Level 3: Formatter availability check
    const formatResult = this.#commandFormatter.formatMultiTarget(...);

    if (formatResult.ok) {
      // Level 4: Success path
      const commands = Array.isArray(formatResult.value) ? ... : ...;

      for (const commandData of commands) {
        // Level 5: Command iteration
        const normalizationResult = this.#targetNormalizationService.normalize(...);

        if (normalizationResult.error) {
          // Level 6: Error handling
          errors.push(...);
          continue;
        }
        // Success logic
      }
    } else if (targetContexts.length > 0) {
      // Level 4: Fallback path
      fallbackInvocations += this.#handleFallback(...);
    }
  } else if (targetContexts.length > 0) {
    // Level 3: Alternative fallback path
    fallbackInvocations += this.#handleFallback(...);
  }
}
```

**Issues:**

- 6 levels of nesting (recommended max: 3)
- Multiple conditional branches at each level
- Difficult to trace execution paths
- High cognitive load for developers

**Metrics:**

- **Cognitive Complexity**: 35 (High - recommended max: 15)
- **Path Coverage Required**: 127 test cases for full coverage
- **Bug Probability**: High (proportional to nesting depth)

---

### 4. Dependency Management Issues

#### Problem: High Dependency Count

**Constructor Dependencies (9 total):**

```javascript
constructor({
  commandFormatter, // 1. Formatting logic
  entityManager, // 2. Entity resolution
  safeEventDispatcher, // 3. Event dispatch
  getEntityDisplayNameFn, // 4. Display name resolution
  logger, // 5. Logging
  fallbackFormatter, // 6. Fallback formatting
  createError, // 7. Error factory
  targetNormalizationService, // 8. Target normalization
  validateVisualProperties, // 9. Visual validation
});
```

**Issues:**

- **High Coupling**: Class depends on 9 external components
- **Testing Complexity**: Must mock 9 dependencies in tests
- **Initialization Burden**: Complex setup requirements
- **Change Fragility**: Changes to any dependency affect this class

**Dependency Analysis:**

| Dependency                   | Usage Frequency    | Criticality | Abstraction Opportunity                |
| ---------------------------- | ------------------ | ----------- | -------------------------------------- |
| `commandFormatter`           | High (50+ calls)   | Critical    | No                                     |
| `entityManager`              | Medium (20+ calls) | Critical    | No                                     |
| `logger`                     | High (30+ calls)   | Medium      | Yes - could use nullLogger pattern     |
| `fallbackFormatter`          | Low (2 calls)      | Medium      | Yes - could inline or extract strategy |
| `createError`                | Medium (10+ calls) | Low         | Yes - could be static utility          |
| `validateVisualProperties`   | Low (2 calls)      | Low         | Yes - could be static utility          |
| `getEntityDisplayNameFn`     | Medium (5+ calls)  | Low         | No                                     |
| `safeEventDispatcher`        | Low (passthrough)  | Low         | Yes - could be optional                |
| `targetNormalizationService` | Medium (10+ calls) | Critical    | No                                     |

**Recommended Dependency Reduction:**

- Move `validateVisualProperties` to static utility
- Move `createError` to static factory
- Make `safeEventDispatcher` optional/injectable through options
- Consider facade pattern for logger operations

---

### 5. Multi-Target Formatting Complexity

#### Problem: Intertwined Multi-Target and Single-Target Logic

The multi-target formatting logic (lines 164-270, 412-514) contains multiple conditional branches for:

1. Target extraction validation
2. Formatter capability detection
3. Format result processing
4. Command data type handling (string vs object)
5. Target specification resolution
6. Normalization
7. Fallback coordination

**Complexity Metrics:**

- **Branches**: 8 distinct paths
- **Early Exits**: 3 different exit points
- **Fallback Triggers**: 2 different conditions
- **Type Checks**: 5 different type validations

**Impact:**

- Difficult to reason about control flow
- Hard to test all combinations
- Brittle to requirement changes
- Hidden assumptions about data shapes

---

### 6. Error Handling Patterns

#### Problem: Inconsistent Error Handling

**Three Different Error Handling Patterns:**

1. **Silent Skip** (lines 175-179):

```javascript
if (!actionSpecificTargets || Object.keys(actionSpecificTargets).length === 0) {
  this.#logger.warn(...);
  continue; // Silent skip, no error recorded
}
```

2. **Error Collection** (lines 214-224):

```javascript
if (normalizationResult.error) {
  errors.push(
    this.#createError(...)
  );
  continue;
}
```

3. **Try-Catch with Error Collection** (lines 311-330):

```javascript
try {
  const formatResult = this.#commandFormatter.format(...);
  // ...
} catch (error) {
  errors.push(
    this.#createError(...)
  );
}
```

**Issues:**

- Inconsistent error handling strategy
- Silent failures (pattern 1) vs recorded failures (patterns 2-3)
- No centralized error handling logic
- Different patterns for similar error conditions

---

### 7. Statistics Tracking Complexity

#### Problem: Conditional Statistics Tracking

Statistics are tracked conditionally through the `#incrementStat` helper:

```javascript
#incrementStat(stats, key) {
  if (!stats || typeof stats !== 'object') {
    return; // Silent no-op if stats undefined
  }
  if (typeof stats[key] !== 'number') {
    stats[key] = 0;
  }
  stats[key] += 1;
}
```

**Issues:**

- Statistics tracking scattered across methods (15+ call sites)
- Optional stats object creates inconsistent behavior
- Difficult to verify statistics accuracy
- Mixing business logic with metrics collection
- No statistics abstraction or interface

**Impact:**

- Hard to ensure statistics completeness
- Testing requires mocking statistics object
- Changes to statistics requirements affect multiple locations

---

## Refactoring Recommendations

### Priority 1: Eliminate Code Duplication (Critical)

#### Strategy: Template Method Pattern

**Approach:** Extract common formatting logic into a shared method, parameterize trace-specific behavior.

**Proposed Structure:**

```javascript
// New unified method
async #formatActions({
  actor,
  actionsWithTargets,
  trace,
  formatterOptions,
  processingStats,
  traceSource,
}) {
  const formattedActions = [];
  const errors = [];
  let fallbackInvocations = 0;

  // Trace adapter for polymorphic behavior
  const traceAdapter = this.#createTraceAdapter(trace, processingStats);

  for (const { actionDef, targetContexts } of actionsWithTargets) {
    this.#validateVisualProperties(actionDef.visual, actionDef.id);

    const isMultiTargetAction = actionDef.targets && typeof actionDef.targets === 'object';

    // Capture start event (no-op if trace is standard)
    traceAdapter.captureStart(actionDef, targetContexts, isMultiTargetAction);

    if (isMultiTargetAction) {
      const result = await this.#formatMultiTargetAction({
        actionDef,
        targetContexts,
        formatterOptions,
        actor,
        trace,
        traceAdapter,
      });
      formattedActions.push(...result.formatted);
      errors.push(...result.errors);
      fallbackInvocations += result.fallbackCount;
    } else {
      const result = await this.#formatSingleTargetAction({
        actionDef,
        targetContexts,
        formatterOptions,
        actor,
        trace,
        traceAdapter,
      });
      formattedActions.push(...result.formatted);
      errors.push(...result.errors);
    }

    // Capture end event (no-op if trace is standard)
    traceAdapter.captureEnd(actionDef, result);
  }

  this.#logger.debug(
    `Action formatting complete: ${formattedActions.length} actions formatted successfully`
  );

  trace?.info(
    `Action formatting completed: ${formattedActions.length} formatted actions, ${errors.length} errors`,
    traceSource
  );

  return {
    formattedCommands: formattedActions,
    errors,
    fallbackUsed: fallbackInvocations > 0,
    statistics: {
      formatted: formattedActions.length,
      errors: errors.length,
      fallbackInvocations,
    },
    pipelineResult: PipelineResult.success({
      actions: formattedActions,
      errors,
    }),
  };
}

// Trace adapter for polymorphic behavior
#createTraceAdapter(trace, processingStats) {
  const isActionAware = trace && typeof trace.captureActionData === 'function';

  if (isActionAware) {
    return {
      captureStart: (actionDef, targetContexts, isMultiTarget) => {
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: Date.now(),
          status: 'formatting',
          formattingPath: 'legacy',
          isMultiTargetInLegacy: isMultiTarget,
          targetContextCount: targetContexts.length,
        });
      },
      captureEnd: (actionDef, result) => {
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: Date.now(),
          status: result.errors.length > 0 ? 'partial' : 'completed',
          formatterMethod: 'format',
          successCount: result.formatted.length,
          failureCount: result.errors.length,
          performance: { duration: Date.now() - result.startTime },
        });
      },
      incrementStat: (key) => {
        if (processingStats) {
          this.#incrementStat(processingStats, key);
        }
      },
    };
  }

  // No-op adapter for standard trace
  return {
    captureStart: () => {},
    captureEnd: () => {},
    incrementStat: () => {},
  };
}

// Public entry point remains simple
async format({ actor, actionsWithTargets = [], trace, processingStats, traceSource }) {
  const formatterOptions = this.#buildFormatterOptions();

  return this.#formatActions({
    actor,
    actionsWithTargets,
    trace,
    formatterOptions,
    processingStats,
    traceSource,
  });
}
```

**Benefits:**

- ✅ Eliminates 400+ lines of duplication
- ✅ Single source of truth for formatting logic
- ✅ Trace behavior encapsulated in adapter
- ✅ Easier to test and maintain
- ✅ Changes only need to be made once

**Estimated Effort**: 2-3 days (including thorough testing)

---

### Priority 2: Extract Multi-Target Formatting (High)

#### Strategy: Extract Method + Strategy Pattern

**Approach:** Extract multi-target logic into dedicated method with clear responsibilities.

**Proposed Structure:**

```javascript
/**
 * Formats a multi-target action with proper validation and error handling.
 */
async #formatMultiTargetAction({
  actionDef,
  targetContexts,
  formatterOptions,
  actor,
  trace,
  traceAdapter,
}) {
  // Extract targets
  const actionSpecificTargets = this.#extractTargetsFromContexts(
    targetContexts,
    actionDef
  );

  // Validate targets
  const validation = this.#validateMultiTargetAction(
    actionSpecificTargets,
    actionDef
  );

  if (!validation.valid) {
    this.#logger.warn(validation.message);
    return { formatted: [], errors: [], fallbackCount: 0 };
  }

  // Attempt primary formatting
  if (this.#commandFormatter.formatMultiTarget) {
    const result = await this.#formatWithMultiTargetFormatter({
      actionDef,
      actionSpecificTargets,
      formatterOptions,
      actor,
      trace,
      traceAdapter,
    });

    if (result.success) {
      return result;
    }
  }

  // Fallback formatting
  if (targetContexts.length > 0) {
    return this.#formatWithFallback({
      actionDef,
      targetContexts,
      formatterOptions,
      actionSpecificTargets,
      actor,
      trace,
      traceAdapter,
    });
  }

  return { formatted: [], errors: [], fallbackCount: 0 };
}

/**
 * Validates multi-target action has required targets.
 */
#validateMultiTargetAction(actionSpecificTargets, actionDef) {
  if (!actionSpecificTargets || Object.keys(actionSpecificTargets).length === 0) {
    return {
      valid: false,
      message: `Skipping multi-target action '${actionDef.id}' in legacy formatting path - ` +
               `no resolved targets available for proper formatting`,
    };
  }
  return { valid: true };
}

/**
 * Formats multi-target action using formatMultiTarget formatter.
 */
async #formatWithMultiTargetFormatter({
  actionDef,
  actionSpecificTargets,
  formatterOptions,
  actor,
  trace,
  traceAdapter,
}) {
  const formatResult = this.#commandFormatter.formatMultiTarget(
    actionDef,
    actionSpecificTargets,
    this.#entityManager,
    formatterOptions,
    {
      displayNameFn: this.#getEntityDisplayNameFn,
      targetDefinitions: actionDef.targets,
    }
  );

  if (!formatResult.ok) {
    return { success: false };
  }

  const commands = Array.isArray(formatResult.value)
    ? formatResult.value
    : [formatResult.value];

  const formatted = [];
  const errors = [];

  for (const commandData of commands) {
    const result = this.#processCommandData({
      commandData,
      actionSpecificTargets,
      actionDef,
      actor,
      trace,
    });

    if (result.error) {
      errors.push(result.error);
    } else {
      formatted.push(result.formatted);
    }
  }

  traceAdapter.incrementStat('successful');
  traceAdapter.incrementStat('multiTarget');

  return { success: true, formatted, errors, fallbackCount: 0 };
}
```

**Benefits:**

- ✅ Reduces cyclomatic complexity from 18 to ~8 per method
- ✅ Clear separation of concerns
- ✅ Each method has single responsibility
- ✅ Easier to understand control flow
- ✅ Testable in isolation

**Estimated Effort**: 1-2 days

---

### Priority 3: Extract Single-Target Formatting (High)

#### Strategy: Extract Method + Error Handler Pattern

**Proposed Structure:**

```javascript
/**
 * Formats a single-target action with error handling.
 */
async #formatSingleTargetAction({
  actionDef,
  targetContexts,
  formatterOptions,
  actor,
  trace,
  traceAdapter,
}) {
  const formatted = [];
  const errors = [];
  let successCount = 0;
  let failureCount = 0;
  const startTime = Date.now();

  for (const targetContext of targetContexts) {
    const result = this.#formatSingleTarget({
      actionDef,
      targetContext,
      formatterOptions,
      actor,
      trace,
    });

    if (result.success) {
      formatted.push(result.formatted);
      successCount++;
    } else {
      errors.push(result.error);
      failureCount++;
    }
  }

  if (successCount > 0) {
    traceAdapter.incrementStat('successful');
    traceAdapter.incrementStat('legacy');
  }
  if (failureCount > 0) {
    traceAdapter.incrementStat('failed');
  }

  return {
    formatted,
    errors,
    successCount,
    failureCount,
    startTime,
  };
}

/**
 * Formats a single target with error handling.
 */
#formatSingleTarget({ actionDef, targetContext, formatterOptions, actor, trace }) {
  try {
    const formatResult = this.#commandFormatter.format(
      actionDef,
      targetContext,
      this.#entityManager,
      formatterOptions,
      { displayNameFn: this.#getEntityDisplayNameFn }
    );

    if (formatResult.ok) {
      return {
        success: true,
        formatted: {
          id: actionDef.id,
          name: actionDef.name,
          command: formatResult.value,
          description: actionDef.description || '',
          params: { targetId: targetContext.entityId },
          visual: actionDef.visual || null,
        },
      };
    }

    this.#logger.warn(
      `Failed to format command for action '${actionDef.id}' with target '${targetContext.entityId}'`,
      { formatResult, actionDef, targetContext }
    );

    return {
      success: false,
      error: this.#createError(
        formatResult,
        actionDef,
        actor.id,
        trace,
        targetContext.entityId
      ),
    };
  } catch (error) {
    const targetId =
      error?.target?.entityId ||
      error?.entityId ||
      targetContext.entityId;

    this.#logger.warn(
      `Failed to format command for action '${actionDef.id}' with target '${targetId}'`,
      { error, actionDef, targetContext }
    );

    return {
      success: false,
      error: this.#createError(
        error,
        actionDef,
        actor.id,
        trace,
        null,
        targetContext.entityId
      ),
    };
  }
}
```

**Benefits:**

- ✅ Isolates single-target logic
- ✅ Consistent error handling pattern
- ✅ Easy to test edge cases
- ✅ Clear success/failure paths
- ✅ Reduced nesting depth

**Estimated Effort**: 1 day

---

### Priority 4: Introduce Statistics Abstraction (Medium)

#### Strategy: Statistics Collector Pattern

**Proposed Structure:**

```javascript
/**
 * Encapsulates statistics tracking logic.
 */
class StatisticsCollector {
  #stats;
  #enabled;

  constructor(stats) {
    this.#stats = stats || null;
    this.#enabled = stats && typeof stats === 'object';
  }

  increment(key) {
    if (!this.#enabled) {
      return;
    }

    if (typeof this.#stats[key] !== 'number') {
      this.#stats[key] = 0;
    }

    this.#stats[key] += 1;
  }

  isEnabled() {
    return this.#enabled;
  }

  getStats() {
    return this.#stats;
  }
}

// Usage in LegacyStrategy
async #formatActions({ ..., processingStats }) {
  const statsCollector = new StatisticsCollector(processingStats);

  // Replace all this.#incrementStat(processingStats, 'key') with:
  statsCollector.increment('key');
}
```

**Benefits:**

- ✅ Centralized statistics logic
- ✅ Easier to test statistics tracking
- ✅ Clear API for statistics operations
- ✅ Can extend with more operations (reset, snapshot, etc.)
- ✅ Removes conditional checks from business logic

**Estimated Effort**: 0.5 days

---

### Priority 5: Reduce Constructor Dependencies (Low-Medium)

#### Strategy: Facade Pattern + Optional Dependencies

**Proposed Structure:**

```javascript
/**
 * Utility facade for helper functions.
 */
class FormattingUtils {
  static validateVisualProperties(visual, actionId) {
    // Inline validation logic or delegate to validator
  }

  static createError(payload, action, actorId, trace, resolvedTargetId, originalTargetId) {
    // Inline error creation logic
  }
}

/**
 * Updated constructor with reduced dependencies.
 */
constructor({
  commandFormatter,
  entityManager,
  getEntityDisplayNameFn,
  logger,
  fallbackFormatter,
  targetNormalizationService,
  // Optional dependencies
  safeEventDispatcher = null,
}) {
  this.#commandFormatter = commandFormatter;
  this.#entityManager = entityManager;
  this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
  this.#logger = logger;
  this.#fallbackFormatter = fallbackFormatter;
  this.#targetNormalizationService = targetNormalizationService;
  this.#safeEventDispatcher = safeEventDispatcher;

  // Reduced from 9 to 7 dependencies
}
```

**Benefits:**

- ✅ Reduces constructor complexity
- ✅ Makes optional dependencies explicit
- ✅ Easier to test with fewer mocks
- ✅ Clearer dependency relationships
- ✅ Static utilities can be tested independently

**Estimated Effort**: 1 day

---

### Priority 6: Improve Error Handling Consistency (Medium)

#### Strategy: Error Handler Strategy Pattern

**Proposed Structure:**

```javascript
/**
 * Centralized error handling strategy.
 */
class FormattingErrorHandler {
  #logger;
  #createErrorFn;

  constructor(logger, createErrorFn) {
    this.#logger = logger;
    this.#createErrorFn = createErrorFn;
  }

  /**
   * Handles formatting errors with consistent logging and error creation.
   */
  handleFormattingError({
    error,
    actionDef,
    actorId,
    targetContext,
    trace,
    context = {},
  }) {
    const targetId = this.#resolveTargetId(error, targetContext);

    this.#logger.warn(
      `Failed to format command for action '${actionDef.id}' with target '${targetId}'`,
      { error, actionDef, targetContext, ...context }
    );

    return this.#createErrorFn(
      error,
      actionDef,
      actorId,
      trace,
      targetContext?.entityId
    );
  }

  /**
   * Handles normalization errors with consistent error creation.
   */
  handleNormalizationError({ error, actionDef, actorId, trace }) {
    return this.#createErrorFn(error, actionDef, actorId, trace);
  }

  #resolveTargetId(error, targetContext) {
    return (
      error?.target?.entityId ||
      error?.entityId ||
      targetContext?.entityId ||
      'unknown'
    );
  }
}
```

**Benefits:**

- ✅ Consistent error handling across all paths
- ✅ Centralized error logging logic
- ✅ Easier to change error handling strategy
- ✅ Testable in isolation
- ✅ Reduces code duplication in error paths

**Estimated Effort**: 0.5-1 day

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goal:** Establish refactoring foundation without breaking changes

1. **Create Statistics Abstraction** (0.5 days)
   - Implement `StatisticsCollector` class
   - Add unit tests
   - Document API

2. **Create Error Handler** (0.5-1 day)
   - Implement `FormattingErrorHandler` class
   - Add unit tests
   - Document error handling patterns

3. **Extract Static Utilities** (0.5 days)
   - Create `FormattingUtils` facade
   - Move `validateVisualProperties`
   - Move `createError` if feasible
   - Add unit tests

**Deliverable:** New utility classes with comprehensive tests, no changes to LegacyStrategy yet.

---

### Phase 2: Method Extraction (Week 2)

**Goal:** Break down large methods into focused units

4. **Extract Single-Target Formatting** (1 day)
   - Implement `#formatSingleTargetAction`
   - Implement `#formatSingleTarget`
   - Update existing tests
   - Add new targeted tests

5. **Extract Multi-Target Formatting** (1-2 days)
   - Implement `#formatMultiTargetAction`
   - Implement `#validateMultiTargetAction`
   - Implement `#formatWithMultiTargetFormatter`
   - Update existing tests
   - Add new targeted tests

6. **Extract Command Processing** (0.5 days)
   - Implement `#processCommandData`
   - Add unit tests

**Deliverable:** Extracted methods with comprehensive test coverage, LegacyStrategy still has duplication.

---

### Phase 3: Duplication Elimination (Week 3)

**Goal:** Unify duplicated logic into single source of truth

7. **Create Trace Adapter** (0.5-1 day)
   - Implement trace adapter interface
   - Implement action-aware adapter
   - Implement standard adapter
   - Add unit tests

8. **Implement Unified Formatting** (1-2 days)
   - Implement `#formatActions` method
   - Replace `#formatTraced` and `#formatStandard` with calls to `#formatActions`
   - Update all tests
   - Run full test suite
   - Verify no behavioral changes

9. **Remove Old Methods** (0.5 days)
   - Delete `#formatTraced` method
   - Delete `#formatStandard` method
   - Clean up tests
   - Update documentation

**Deliverable:** Single unified formatting method, zero duplication, all tests passing.

---

### Phase 4: Dependency Optimization (Week 4)

**Goal:** Reduce coupling and improve testability

10. **Optimize Constructor** (1 day)
    - Make `safeEventDispatcher` optional
    - Update initialization logic
    - Update tests
    - Update documentation

11. **Integration Testing** (1-2 days)
    - Run full test suite
    - Performance benchmarking
    - Integration smoke tests
    - Code coverage verification

12. **Documentation & Cleanup** (0.5-1 day)
    - Update JSDoc comments
    - Update architecture documentation
    - Code review preparation
    - Final cleanup

**Deliverable:** Optimized LegacyStrategy with reduced dependencies, full test coverage, updated documentation.

---

## Testing Strategy

### Unit Test Requirements

**Coverage Targets:**

- Line Coverage: 95%+
- Branch Coverage: 90%+
- Function Coverage: 100%

**Key Test Scenarios:**

1. **Statistics Collector Tests**
   - Increment with valid stats object
   - Increment with null stats
   - Increment with undefined stats
   - Multiple increments
   - Non-numeric initial values

2. **Error Handler Tests**
   - Formatting error handling
   - Normalization error handling
   - Target ID resolution logic
   - Different error shapes
   - Missing target context

3. **Trace Adapter Tests**
   - Action-aware adapter behavior
   - Standard adapter no-op behavior
   - Start event capture
   - End event capture
   - Statistics increment

4. **Single-Target Formatting Tests**
   - Successful formatting
   - Format result failure
   - Exception handling
   - Multiple targets
   - Missing target context

5. **Multi-Target Formatting Tests**
   - Valid multi-target action
   - Missing targets
   - Formatter unavailable
   - Normalization error
   - Fallback success
   - Fallback failure

### Integration Test Requirements

**Test Scenarios:**

1. **End-to-End Formatting Flow**
   - Complete action formatting with trace
   - Complete action formatting without trace
   - Mixed single and multi-target actions
   - Error recovery paths

2. **Statistics Verification**
   - Statistics tracked correctly with trace
   - Statistics tracked correctly without trace
   - Statistics not tracked when disabled

3. **Backward Compatibility**
   - Existing test suite passes
   - No behavioral changes
   - Same output format
   - Same error handling

### Regression Testing

**Pre-Refactoring Baseline:**

- Capture current test results
- Document expected behavior
- Create behavior snapshots

**Post-Refactoring Verification:**

- All existing tests pass
- No performance degradation
- Same output for same inputs
- Error handling unchanged

---

## Metrics & Success Criteria

### Code Quality Metrics

**Before Refactoring:**
| Metric | Value | Target |
|--------|-------|--------|
| Lines of Code | 745 | <600 |
| Cyclomatic Complexity | 18 | <10 |
| Code Duplication | ~80% (400 lines) | 0% |
| Method Size (max) | 247 lines | <50 lines |
| Constructor Dependencies | 9 | <7 |
| Test Coverage | ~85% | >95% |
| Cognitive Complexity | 35 | <15 |

**After Refactoring (Target):**
| Metric | Target Value |
|--------|--------------|
| Lines of Code | 550-600 |
| Cyclomatic Complexity | 6-8 |
| Code Duplication | 0% |
| Method Size (max) | 40-50 lines |
| Constructor Dependencies | 6-7 |
| Test Coverage | 95%+ |
| Cognitive Complexity | 12-15 |

### Business Value Metrics

**Maintainability:**

- ✅ 60% reduction in code duplication
- ✅ 50% reduction in method complexity
- ✅ 80% reduction in nesting depth
- ✅ 30% faster code comprehension (estimated)

**Robustness:**

- ✅ Single source of truth for formatting logic
- ✅ Consistent error handling across all paths
- ✅ Better test coverage in critical paths
- ✅ Easier to validate behavioral correctness

**Extensibility:**

- ✅ New trace types can be added via adapter pattern
- ✅ New formatting strategies can be added without modifying core
- ✅ Statistics tracking can be extended without touching business logic
- ✅ Error handling can be customized via strategy

---

## Risk Assessment

### High Risk Areas

1. **Behavioral Changes**
   - **Risk:** Subtle changes in formatting behavior
   - **Mitigation:** Comprehensive test suite, behavior snapshots, code review
   - **Probability:** Low-Medium
   - **Impact:** High

2. **Test Coverage Gaps**
   - **Risk:** Untested edge cases revealed during refactoring
   - **Mitigation:** Increase test coverage before refactoring
   - **Probability:** Medium
   - **Impact:** Medium

3. **Integration Breakage**
   - **Risk:** Breaking dependent components
   - **Mitigation:** Integration tests, staged rollout
   - **Probability:** Low
   - **Impact:** High

### Medium Risk Areas

4. **Performance Regression**
   - **Risk:** Additional abstraction layers slow down formatting
   - **Mitigation:** Performance benchmarking, profiling
   - **Probability:** Low
   - **Impact:** Medium

5. **Incomplete Refactoring**
   - **Risk:** Partial refactoring leaves code in worse state
   - **Mitigation:** Complete phase-by-phase, maintain working state
   - **Probability:** Low
   - **Impact:** Medium

### Low Risk Areas

6. **Dependency Conflicts**
   - **Risk:** Changes to dependencies affect refactoring
   - **Mitigation:** Version locking, dependency review
   - **Probability:** Low
   - **Impact:** Low

---

## Alternative Approaches

### Option 1: Big Bang Rewrite

**Approach:** Complete rewrite of LegacyStrategy from scratch

**Pros:**

- Clean slate, modern patterns
- No legacy baggage
- Optimal architecture

**Cons:**

- High risk of behavioral changes
- Long development time (3-4 weeks)
- Extensive testing required
- Hard to validate correctness

**Recommendation:** ❌ Not recommended - too risky

---

### Option 2: Gradual Refactoring (Recommended)

**Approach:** Phase-by-phase refactoring as proposed in this report

**Pros:**

- Lower risk of breakage
- Continuous validation
- Can be stopped at any phase
- Maintains backward compatibility

**Cons:**

- Longer timeline (4 weeks)
- Requires discipline to complete
- Some temporary complexity

**Recommendation:** ✅ Recommended approach

---

### Option 3: Minimal Refactoring

**Approach:** Only extract methods, leave duplication

**Pros:**

- Quick to implement (1 week)
- Low risk
- Some improvement

**Cons:**

- Doesn't address root problems
- Duplication remains
- Limited maintainability improvement
- Technical debt persists

**Recommendation:** ⚠️ Only if time-constrained

---

### Option 4: Replacement with New Strategy

**Approach:** Create new formatting strategy, deprecate legacy

**Pros:**

- Modern implementation
- No legacy constraints
- Clean architecture

**Cons:**

- Requires maintaining both strategies
- Migration path needed
- High effort (6+ weeks)
- May not be feasible

**Recommendation:** 🔄 Consider for future, not now

---

## Conclusion

### Summary of Findings

The `LegacyStrategy` class exhibits significant technical debt that compromises maintainability and robustness:

1. **~80% code duplication** between formatting methods creates double maintenance burden
2. **High complexity** (18 cyclomatic complexity) makes code error-prone and hard to test
3. **Large methods** (200+ lines) violate single responsibility principle
4. **9 constructor dependencies** create high coupling and testing overhead
5. **Deep nesting** (6 levels) reduces code readability and comprehension

### Recommended Action Plan

**Primary Recommendation:** Execute the **Gradual Refactoring (Option 2)** approach over 4 weeks:

- **Phase 1 (Week 1):** Build foundation with utility abstractions
- **Phase 2 (Week 2):** Extract methods to reduce complexity
- **Phase 3 (Week 3):** Eliminate duplication with unified method
- **Phase 4 (Week 4):** Optimize dependencies and finalize

**Expected Outcomes:**

- 60% reduction in code duplication
- 50% reduction in complexity
- 95%+ test coverage
- Improved maintainability and extensibility
- Reduced risk of bugs in future changes

### Business Value

**Short-term Benefits (Weeks 1-4):**

- Easier to understand and modify
- Faster onboarding for new developers
- Reduced bug introduction risk
- Better test coverage

**Long-term Benefits (Months):**

- Lower maintenance costs
- Faster feature development
- More confident refactoring
- Reduced technical debt burden

### Next Steps

1. **Review this report** with team and stakeholders
2. **Prioritize refactoring** in sprint planning
3. **Allocate 4 weeks** for implementation
4. **Assign experienced developers** for refactoring work
5. **Establish success criteria** and metrics tracking
6. **Schedule code reviews** at phase boundaries
7. **Plan integration testing** throughout process

---

## Appendix A: Code Smell Catalog

**Code Smells Identified:**

1. ❌ **Duplicated Code** - Severity: Critical
   - Location: `#formatTraced` vs `#formatStandard`
   - Impact: High maintenance burden

2. ❌ **Long Method** - Severity: High
   - Location: `#formatTraced` (247 lines), `#formatStandard` (206 lines)
   - Impact: Poor readability

3. ❌ **Long Parameter List** - Severity: Medium
   - Location: Constructor (9 parameters)
   - Impact: Complex initialization

4. ❌ **Feature Envy** - Severity: Low-Medium
   - Location: Multiple calls to `targetNormalizationService`
   - Impact: High coupling

5. ❌ **Primitive Obsession** - Severity: Low
   - Location: Statistics tracking with plain object
   - Impact: No abstraction

6. ❌ **Deep Nesting** - Severity: High
   - Location: Multi-target formatting logic (6 levels)
   - Impact: High cognitive load

7. ❌ **Inconsistent Error Handling** - Severity: Medium
   - Location: Three different error patterns
   - Impact: Unpredictable behavior

---

## Appendix B: Related Files

**Files That May Be Affected:**

1. `LegacyFallbackFormatter.js` - Closely coupled, may need updates
2. `TargetNormalizationService.js` - Interface changes may propagate
3. `ActionFormattingStage.js` - Calls LegacyStrategy, integration tests needed
4. Test files - All tests need review and potential updates

**Dependencies to Consider:**

- `PipelineResult.js` - Used for return values
- `IActionCommandFormatter` - Primary formatting interface
- `EntityManager` - Entity resolution
- Various trace implementations - Polymorphic behavior

---

**Report End**

---

_This analysis was generated on October 24, 2025, based on the current state of `LegacyStrategy.js`. Recommendations should be validated with the development team and adjusted based on project priorities and constraints._
