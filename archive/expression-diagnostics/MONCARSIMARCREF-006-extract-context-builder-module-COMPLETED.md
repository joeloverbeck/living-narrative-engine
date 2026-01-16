# MONCARSIMARCREF-006: Extract ContextBuilder Module

## Summary

Extract context building methods from `MonteCarloSimulator.js` into a new `ContextBuilder` class. This is the first module extraction, but the current implementation is moderately coupled to shared constants, registry lookups, and axis normalization utilities. The extraction should preserve that coupling without changing behavior.

## Status: Completed

## Priority: High | Effort: Medium

## Rationale

The ContextBuilder is responsible for:
- Building evaluation contexts with mood/sexual/emotion states
- Normalizing gate contexts
- Initializing histogram and sample reservoir structures
- Enumerating known context keys

These responsibilities are reasonably isolated but depend on shared constants (`moodAffectConstants.js`), normalization utilities (`axisNormalizationUtils.js`), and registry lookups for prototypes. The extraction must keep those dependencies intact.

## Dependencies

- **MONCARSIMARCREF-001** through **MONCARSIMARCREF-005** (Phase 1 integration tests already exist in `tests/integration/expression-diagnostics/` and must remain green)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js` | **Create** |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Modify** - Remove extracted methods, delegate to ContextBuilder |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** - Add ContextBuilder token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** - Register ContextBuilder |
| `tests/unit/expressionDiagnostics/services/simulatorCore/contextBuilder.test.js` | **Create** |

## Out of Scope

- **DO NOT** extract expression evaluation methods (that's MONCARSIMARCREF-007)
- **DO NOT** extract gate evaluation methods (that's MONCARSIMARCREF-008)
- **DO NOT** extract prototype evaluation methods (that's MONCARSIMARCREF-009)
- **DO NOT** extract sensitivity analysis methods (that's MONCARSIMARCREF-010)
- **DO NOT** extract violation analysis methods (that's MONCARSIMARCREF-011)
- **DO NOT** extract variable path validation methods (that's MONCARSIMARCREF-012)
- **DO NOT** modify any other module or service
- **DO NOT** change the public API of MonteCarloSimulator

## Implementation Details

### Methods to Extract

From `MonteCarloSimulator.js` (current locations; line numbers may drift):

```javascript
// Methods to move to ContextBuilder.js
#buildContext()                           // ~lines 1163-1257
#buildKnownContextKeys()                  // ~lines 2856-2920
#normalizeGateContext()                   // Related to gate context
#recordMoodRegimeAxisHistograms()         // Histogram recording
#recordMoodRegimeSampleReservoir()        // Sample storage recording (includes histogramAxes)
#initializeMoodRegimeAxisHistograms()     // Histogram initialization
#initializeMoodRegimeSampleReservoir()    // Sample reservoir initialization (limit only)
#getAxisHistogramSpec()                   // Histogram spec helper (private)
#getHistogramBinIndex()                   // Histogram bin helper (private)
#resolveGateAxisRawValue()                // Axis value lookup helper (private)
```

Keep these **in MonteCarloSimulator** for now because they are used by non-context subsystems:

```javascript
#normalizeMoodAxisValue()                 // Gate compatibility logic
#resolveValue()                           // Violation/ceiling analysis
```

### New ContextBuilder Class Structure

```javascript
/**
 * @file ContextBuilder.js
 * @description Builds and manages simulation contexts for Monte Carlo evaluation
 */

import { validateDependency } from '../../../../utils/dependencyUtils.js';

class ContextBuilder {
  #dataRegistry;
  #emotionCalculatorAdapter;

  /**
   * @param {Object} deps
   * @param {import('../../../interfaces/ILogger.js').ILogger} [deps.logger]
   * @param {import('../../../interfaces/IDataRegistry.js').IDataRegistry} deps.dataRegistry
   * @param {import('../../../interfaces/IEmotionCalculatorAdapter.js').IEmotionCalculatorAdapter} deps.emotionCalculatorAdapter
   */
  constructor({ logger, dataRegistry, emotionCalculatorAdapter }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(emotionCalculatorAdapter, 'IEmotionCalculatorAdapter', logger, {
      requiredMethods: [
        'calculateEmotionsFiltered',
        'calculateEmotionTracesFiltered',
        'calculateSexualStateTraces',
        'calculateSexualArousal',
        'calculateSexualStates',
      ],
    });

    this.#dataRegistry = dataRegistry;
    this.#emotionCalculatorAdapter = emotionCalculatorAdapter;
  }

  /**
   * Builds evaluation context for a single sample
   * @param {Object} options
   * @returns {Object} Evaluation context
   */
  buildContext(options) {
    // Extracted logic from #buildContext
  }

  /**
   * Builds set of known context keys for the expression
   * @param {Object} expression
   * @returns {Set<string>} Known context keys
   */
  buildKnownContextKeys(expression) {
    // Extracted logic from #buildKnownContextKeys
  }

  /**
   * Normalizes gate context for evaluation
   * @param {Object} context
   * @param {Object} gates
   * @returns {Object} Normalized gate context
   */
  normalizeGateContext(context, usePrevious) {
    // Extracted logic from #normalizeGateContext
  }

  /**
   * Initializes histogram structure for mood regime tracking
   * @param {Object} config
   * @returns {Object} Initialized histogram structure
   */
  initializeMoodRegimeAxisHistograms(trackedGateAxes) {
    // Extracted logic
  }

  /**
   * Records values to mood regime axis histograms
   * @param {Object} histograms
   * @param {Object} context
   */
  recordMoodRegimeAxisHistograms(histograms, context) {
    // Extracted logic
  }

  /**
   * Initializes sample reservoir structure
   * @param {Object} config
   * @returns {Object} Initialized reservoir structure
   */
  initializeMoodRegimeSampleReservoir(limit) {
    // Extracted logic
  }

  /**
   * Records sample to reservoir
   * @param {Object} reservoir
   * @param {Object} context
   */
  recordMoodRegimeSampleReservoir(reservoir, histogramAxes, context) {
    // Extracted logic
  }
}

export default ContextBuilder;
```

### DI Token Addition

In `tokens-diagnostics.js`:
```javascript
export const diagnosticsTokens = freeze({
  // ... existing tokens
  IMonteCarloContextBuilder: 'IMonteCarloContextBuilder',
});
```

### DI Registration

In `expressionDiagnosticsRegistrations.js`:
```javascript
import ContextBuilder from '../../expressionDiagnostics/services/simulatorCore/ContextBuilder.js';

// In registration function
registrar.singletonFactory(diagnosticsTokens.IMonteCarloContextBuilder, (c) =>
  new ContextBuilder({
    logger: c.resolve(tokens.ILogger),
    dataRegistry: c.resolve(tokens.IDataRegistry),
    emotionCalculatorAdapter: c.resolve(tokens.IEmotionCalculatorAdapter),
  })
);
```

### MonteCarloSimulator Modification

Replace extracted methods with delegation:

```javascript
// In MonteCarloSimulator constructor, add:
this.#contextBuilder =
  contextBuilder ?? new ContextBuilder({ logger, dataRegistry, emotionCalculatorAdapter });

// Replace method bodies with:
#buildContext(options) {
  return this.#contextBuilder.buildContext(options);
}

// Similar for all other extracted methods
```

### Unit Test Structure

```javascript
/**
 * @file contextBuilder.test.js
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ContextBuilder from '../../../../../src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js';

describe('ContextBuilder', () => {
  let contextBuilder;
  let mockLogger;
  let mockDataRegistry;
  let mockEmotionCalculatorAdapter;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    mockDataRegistry = { get: jest.fn() };
    mockEmotionCalculatorAdapter = {
      calculateEmotionsFiltered: jest.fn(),
      calculateEmotionTracesFiltered: jest.fn(),
      calculateSexualStateTraces: jest.fn(),
      calculateSexualArousal: jest.fn(),
      calculateSexualStates: jest.fn(),
    };

    contextBuilder = new ContextBuilder({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
    });
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => new ContextBuilder({})).toThrow();
    });
  });

  describe('buildContext', () => {
    // Tests matching integration test expectations
  });

  // ... tests for each public method
});
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Phase 1 integration tests must all pass
npm run test:integration -- --testPathPatterns tests/integration/expression-diagnostics/monteCarloContextBuilding.integration.test.js --coverage=false --verbose

# New unit tests must pass
npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/simulatorCore/contextBuilder.test.js --coverage=false --verbose

// Full-suite runs (test:ci/typecheck) are optional unless explicitly requested.
```

### Specific Requirements

1. **New ContextBuilder class created** with all extracted methods as public
2. **DI token added** for ContextBuilder
3. **DI registration added** for ContextBuilder
4. **MonteCarloSimulator updated** to delegate to ContextBuilder
5. **Unit tests created** for ContextBuilder
6. **Context-building integration test passes** (proving behavior unchanged)

### Invariants That Must Remain True

1. **Public API of MonteCarloSimulator unchanged** - 3 public methods, same signatures
2. **All existing tests pass** - `npm run test:ci` green (full-suite only)
3. **Branch coverage ≥76.74%** - No coverage regression (full-suite only)
4. **MonteCarloSimulator.js reduced** (expected to shrink with helper extraction)
5. **ContextBuilder.js < 400 lines**
6. **No circular dependencies introduced**

## Verification Commands

```bash
# Run all Phase 1 integration tests
npm run test:integration -- --testPathPatterns tests/integration/expression-diagnostics/monteCarloContextBuilding.integration.test.js --coverage=false --verbose

# Run new unit tests
npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/simulatorCore/contextBuilder.test.js --coverage=false --verbose

# Full test suite (optional unless requested)
npm run test:ci

# Type check (optional unless requested)
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js src/expressionDiagnostics/services/MonteCarloSimulator.js

# Check file sizes
wc -l src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js
wc -l src/expressionDiagnostics/services/MonteCarloSimulator.js
```

## Definition of Done

- [x] `ContextBuilder.js` created in `src/expressionDiagnostics/services/simulatorCore/`
- [x] Context-building methods extracted from MonteCarloSimulator (including histogram helpers)
- [x] DI token added to `tokens-diagnostics.js`
- [x] DI registration added to `expressionDiagnosticsRegistrations.js`
- [x] MonteCarloSimulator updated to inject and delegate to ContextBuilder
- [x] Unit tests created for ContextBuilder
- [x] Context-building integration test passes (MONCARSIMARCREF-001 to -005)
- [x] ContextBuilder unit tests pass
- [ ] Full unit test suite passes (not run in this change)
- [ ] Full integration test suite passes (not run in this change)
- [ ] Type check passes (not run in this change)
- [ ] Lint passes on modified files (not run in this change)
- [x] ContextBuilder.js < 400 lines
- [x] MonteCarloSimulator.js reduced (targeted extraction)
- [x] No circular dependencies

## Outcome

Extracted context building, gate normalization, and histogram/reservoir helpers into `ContextBuilder`, updated DI wiring to use an `IMonteCarloContextBuilder`, and delegated from `MonteCarloSimulator` with an internal fallback for backward compatibility. Left `#normalizeMoodAxisValue` and `#resolveValue` in `MonteCarloSimulator` because they support non-context subsystems. Added focused unit coverage for the new module and validated the existing context-building integration test.
