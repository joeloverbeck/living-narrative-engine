# MONCARSIMARCREF-013: Convert MonteCarloSimulator to Facade

## Summary

Convert the now-refactored `MonteCarloSimulator.js` into a cleaner Facade class by removing unnecessary pass-through wrapper methods. The class should directly call the extracted modules where possible, keeping only essential private methods.

## Priority: High | Effort: Low

## Rationale

**Updated Analysis (January 2026)**: The original ticket assumptions were outdated:

| Original Claim | Actual State | Notes |
|----------------|--------------|-------|
| File is ~3,607 lines | **1,694 lines** | Already reduced by ~53% through module extraction |
| 7 modules need injection | **6 modules already integrated** | ContextBuilder, ExpressionEvaluator, GateEvaluator, PrototypeEvaluator, ViolationEstimator, VariablePathValidator |
| DI registration needs updating | **Already complete** | See `expressionDiagnosticsRegistrations.js` |
| Target ~150-200 lines | **Not realistic** | Target ~1,100-1,200 lines is achievable |
| SensitivityAnalyzer is a module | **Separate service** | `computeThresholdSensitivity` and `computeExpressionSensitivity` are public methods with ~150 lines of logic in the simulator itself |

The Facade pattern after this cleanup will:
- Maintain backward compatibility with the 3 public methods
- Remove ~44 pass-through wrapper methods
- Keep essential private methods that do actual work
- Make the overall system easier to understand and maintain

## Dependencies

- **MONCARSIMARCREF-001** through **MONCARSIMARCREF-005** ✅ Complete
- **MONCARSIMARCREF-006** through **MONCARSIMARCREF-012** ✅ Complete

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Refactor** - Remove pass-through wrapper methods, inline direct module calls |

## Out of Scope

- **DO NOT** change the 3 public method signatures
- **DO NOT** add new public methods
- **DO NOT** modify the extracted modules
- **DO NOT** change the DI tokens for existing services
- **DO NOT** alter integration test behavior
- **DO NOT** modify DI registration (already correct)

## Implementation Details

### Pass-Through Wrappers to Remove

Remove these methods and replace with direct module calls at call sites:

```javascript
// ContextBuilder delegation - REMOVE wrappers, call directly:
#initializeMoodRegimeAxisHistograms → this.#contextBuilder.initializeMoodRegimeAxisHistograms
#initializeMoodRegimeSampleReservoir → this.#contextBuilder.initializeMoodRegimeSampleReservoir
#recordMoodRegimeAxisHistograms → this.#contextBuilder.recordMoodRegimeAxisHistograms
#recordMoodRegimeSampleReservoir → this.#contextBuilder.recordMoodRegimeSampleReservoir
#buildContext → this.#contextBuilder.buildContext
#buildKnownContextKeys → this.#contextBuilder.buildKnownContextKeys

// ExpressionEvaluator delegation - REMOVE wrappers, call directly:
#initClauseTracking → this.#expressionEvaluator.initClauseTracking
#evaluatePrerequisite → this.#expressionEvaluator.evaluatePrerequisite
#finalizeClauseResults → this.#expressionEvaluator.finalizeClauseResults
#buildHierarchicalTree → this.#expressionEvaluator.buildHierarchicalTree
#evaluateThresholdCondition → this.#expressionEvaluator.evaluateThresholdCondition

// GateEvaluator delegation - REMOVE wrappers, call directly:
#checkPrototypeCompatibility → this.#gateEvaluator.checkPrototypeCompatibility
#buildAxisIntervalsFromMoodConstraints → this.#gateEvaluator.buildAxisIntervalsFromMoodConstraints
#denormalizeGateThreshold → this.#gateEvaluator.denormalizeGateThreshold
#resolveGateContext → this.#gateEvaluator.resolveGateContext

// PrototypeEvaluator delegation - REMOVE wrappers, call directly:
#extractPrototypeReferences → this.#prototypeEvaluator.extractPrototypeReferences
#preparePrototypeEvaluationTargets → this.#prototypeEvaluator.preparePrototypeEvaluationTargets
#initializePrototypeEvaluationSummary → this.#prototypeEvaluator.initializePrototypeEvaluationSummary
#createPrototypeEvaluationStats → this.#prototypeEvaluator.createPrototypeEvaluationStats
#evaluatePrototypeSample → this.#prototypeEvaluator.evaluatePrototypeSample
#recordPrototypeEvaluation → this.#prototypeEvaluator.recordPrototypeEvaluation
#collectPrototypeReferencesFromLogic → this.#prototypeEvaluator.collectPrototypeReferencesFromLogic
#getPrototype → this.#prototypeEvaluator.getPrototype

// VariablePathValidator delegation - REMOVE wrappers, call directly:
#extractReferencedEmotions → this.#variablePathValidator.extractReferencedEmotions
#filterEmotions → this.#variablePathValidator.filterEmotions
#collectSamplingCoverageVariables → this.#variablePathValidator.collectSamplingCoverageVariables
```

### Private Methods to KEEP

These provide real value or contain actual logic:

```javascript
// Essential helpers with actual logic (KEEP):
#yieldToEventLoop()                     // async yielding (7 lines)
#calculateConfidenceInterval()           // statistical calculation (12 lines)
#getZScore()                            // z-score lookup (6 lines)
#getNestedValue()                       // utility for nested access (3 lines)
#evaluateMoodConstraints()              // mood evaluation logic (8 lines)
#validateExpressionVarPaths()           // orchestrates validation calls (7 lines)
#updatePrototypeEvaluationSummary()     // context resolution logic (28 lines)
#replaceThresholdInLogic()              // sensitivity helper (10 lines)
#replaceThresholdRecursive()            // sensitivity helper (35 lines)
#normalizeMoodAxisValue()               // simple conversion (3 lines)

// Methods with binding callbacks (KEEP - cannot inline):
#evaluateWithTracking()                 // binds gateOutcomeRecorder (13 lines)
#buildGateClampRegimePlan()            // binds buildHierarchicalTree (7 lines)
#computeGateCompatibility()            // binds extractPrototypeReferences (8 lines)
#recordGateOutcomeIfApplicable()       // binds evaluatePrototypeSample (10 lines)
#countFailedClauses()                  // binds evaluatePrerequisite (8 lines)
#getFailedLeavesSummary()              // binds evaluatePrerequisite (9 lines)
```

### Target Facade Structure After Cleanup

```javascript
class MonteCarloSimulator {
  // 10 private fields: #dataRegistry, #logger, #emotionCalculatorAdapter,
  //   #randomStateGenerator, #contextBuilder, #expressionEvaluator,
  //   #gateEvaluator, #prototypeEvaluator, #violationEstimator, #variablePathValidator

  // Constructor with validation (~180 lines)

  // 3 public methods:
  async simulate(expression, config)                    // Main orchestration (~400 lines)
  computeThresholdSensitivity(...)                     // Sensitivity analysis (~60 lines)
  computeExpressionSensitivity(...)                    // Expression sensitivity (~80 lines)

  // ~15 essential private methods (~200 lines total):
  // - Utility methods (yield, confidence, z-score, nested value, normalize)
  // - Methods with callback bindings (cannot inline)
  // - Logic methods (mood constraints, var path validation, prototype summary)
  // - Sensitivity helpers (threshold replacement)
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# All Phase 1 integration tests must pass
npm run test:integration -- tests/integration/expression-diagnostics/monteCarlo*.integration.test.js --verbose

# All Phase 2 module unit tests must pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/simulatorCore/*.test.js --verbose

# Existing facade unit tests must pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloSimulator*.test.js --verbose

# Full test suite
npm run test:ci

# Type check
npm run typecheck
```

### Specific Requirements

1. **MonteCarloSimulator.js reduced to ~1,100-1,200 lines** (from 1,694)
2. **All 3 public methods preserved** with identical signatures
3. **Pass-through wrappers removed** - direct module calls inlined
4. **Essential private methods retained** - utility, binding, and logic methods
5. **All existing tests pass** - `npm run test:ci` green

### Invariants That Must Remain True

1. **Public API unchanged** - `simulate()`, `computeThresholdSensitivity()`, `computeExpressionSensitivity()`
2. **Method signatures unchanged** - Same parameters, same return types
3. **All existing tests pass** - `npm run test:ci` green
4. **Branch coverage maintained** - No coverage regression
5. **Trigger rates unchanged** - Same probabilities for same inputs
6. **Sensitivity curves unchanged** - Same analysis results
7. **No circular dependencies** - Clean dependency graph
8. **Performance within 5%** - No significant slowdown

## Verification Commands

```bash
# Run all Phase 1 integration tests
npm run test:integration -- tests/integration/expression-diagnostics/monteCarlo*.integration.test.js --verbose

# Run all module unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/simulatorCore/*.test.js --verbose

# Run facade unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloSimulator*.test.js --verbose

# Full test suite
npm run test:ci

# Type check
npm run typecheck

# Lint facade
npx eslint src/expressionDiagnostics/services/MonteCarloSimulator.js

# Check file size (should be ~1,100-1,200 lines)
wc -l src/expressionDiagnostics/services/MonteCarloSimulator.js
```

## Definition of Done

- [ ] Pass-through wrapper methods removed from MonteCarloSimulator.js
- [ ] Direct module calls inlined at call sites
- [ ] Essential private methods retained
- [ ] File size reduced from ~1,694 lines to ~1,100-1,200 lines
- [ ] All 3 public methods preserved with identical signatures
- [ ] All Phase 1 integration tests pass
- [ ] All Phase 2 module unit tests pass
- [ ] All existing tests pass
- [ ] Type check passes
- [ ] Lint passes
- [ ] Performance within 5% of original
