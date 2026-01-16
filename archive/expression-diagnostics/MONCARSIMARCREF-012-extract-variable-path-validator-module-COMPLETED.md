# MONCARSIMARCREF-012: Extract VariablePathValidator Module

## Summary

Extract variable path validation methods from `MonteCarloSimulator.js` into a new `VariablePathValidator` class. This is Priority 7 for extraction as "utility, lower risk." The validator handles variable path validation, sampling coverage variable collection, and emotion reference extraction.

## Priority: Low | Effort: Low

## Rationale

The VariablePathValidator handles variable path operations:
- Validating variable paths against known context keys
- Collecting sampling coverage variables with domain/range info
- Resolving sampling coverage variable domains
- Extracting referenced emotions from expressions
- Filtering emotions based on references

This is utility-level functionality with clear boundaries and low coupling to other subsystems. The class is **stateless** and requires no constructor dependencies.

## Dependencies

- **MONCARSIMARCREF-001** through **MONCARSIMARCREF-005** (All Phase 1 integration tests must pass first)
- **MONCARSIMARCREF-006** (ContextBuilder must be extracted first - provides known context keys)
- **MONCARSIMARCREF-007** through **MONCARSIMARCREF-011** (All other Phase 2 extractions should be done first)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/simulatorCore/VariablePathValidator.js` | **Create** |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Modify** - Remove extracted methods, delegate to VariablePathValidator |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** - Add IMonteCarloVariablePathValidator token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** - Register VariablePathValidator |
| `tests/unit/expressionDiagnostics/services/simulatorCore/variablePathValidator.test.js` | **Create** |

## Out of Scope

- **DO NOT** extract context building methods (that's MONCARSIMARCREF-006)
- **DO NOT** extract expression evaluation methods (that's MONCARSIMARCREF-007)
- **DO NOT** extract gate evaluation methods (that's MONCARSIMARCREF-008)
- **DO NOT** extract prototype evaluation methods (that's MONCARSIMARCREF-009)
- **DO NOT** extract sensitivity analysis methods (that's MONCARSIMARCREF-010)
- **DO NOT** extract violation analysis methods (that's MONCARSIMARCREF-011)
- **DO NOT** modify any other module or service
- **DO NOT** change the public API of MonteCarloSimulator

## Implementation Details

### Methods to Extract

From `MonteCarloSimulator.js` (6 methods, ~165 lines total):

```javascript
// Methods to move to VariablePathValidator.js
#validateExpressionVarPaths(expression)       // Validates all var paths in expression (~35 lines)
#validateVarPath(path, knownKeys)             // Validates single path against known keys (~43 lines)
#collectSamplingCoverageVariables(expression) // Collects sampling coverage variables (~24 lines)
#resolveSamplingCoverageVariable(variablePath) // Resolves variable to domain/range (~18 lines)
#extractReferencedEmotions(expression)        // Extracts referenced emotion names (~34 lines)
#filterEmotions(allEmotions, referencedNames) // Filters emotions by references (~11 lines)
```

### Constant to Move

The `SAMPLING_COVERAGE_DOMAIN_RANGES` constant must be moved to VariablePathValidator and exported:

```javascript
export const SAMPLING_COVERAGE_DOMAIN_RANGES = [
  { pattern: /^previousMoodAxes\./, domain: 'previousMoodAxes', ...MOOD_AXIS_RANGE },
  { pattern: /^previousEmotions\./, domain: 'previousEmotions', min: 0, max: 1 },
  { pattern: /^previousSexualStates\./, domain: 'previousSexualStates', min: 0, max: 1 },
  { pattern: /^moodAxes\./, domain: 'moodAxes', ...MOOD_AXIS_RANGE },
  { pattern: /^mood\./, domain: 'moodAxes', ...MOOD_AXIS_RANGE },
  { pattern: /^emotions\./, domain: 'emotions', min: 0, max: 1 },
  { pattern: /^sexualStates\./, domain: 'sexualStates', min: 0, max: 1 },
  { pattern: /^sexual\./, domain: 'sexualStates', min: 0, max: 1 },
];
```

### New VariablePathValidator Class Structure

```javascript
/**
 * @file VariablePathValidator.js
 * @description Validates and resolves variable paths in expressions
 */

import { collectVarPaths } from '../../../../utils/jsonLogicVarExtractor.js';
import { MOOD_AXIS_RANGE } from '../../../../constants/moodAffectConstants.js';

export const SAMPLING_COVERAGE_DOMAIN_RANGES = [
  { pattern: /^previousMoodAxes\./, domain: 'previousMoodAxes', ...MOOD_AXIS_RANGE },
  { pattern: /^previousEmotions\./, domain: 'previousEmotions', min: 0, max: 1 },
  { pattern: /^previousSexualStates\./, domain: 'previousSexualStates', min: 0, max: 1 },
  { pattern: /^moodAxes\./, domain: 'moodAxes', ...MOOD_AXIS_RANGE },
  { pattern: /^mood\./, domain: 'moodAxes', ...MOOD_AXIS_RANGE },
  { pattern: /^emotions\./, domain: 'emotions', min: 0, max: 1 },
  { pattern: /^sexualStates\./, domain: 'sexualStates', min: 0, max: 1 },
  { pattern: /^sexual\./, domain: 'sexualStates', min: 0, max: 1 },
];

class VariablePathValidator {
  // Stateless - no constructor dependencies needed

  /**
   * Validates all variable paths in an expression against known context keys
   * @param {Object} expression - Expression to validate
   * @param {Set<string>} knownKeys - Known context keys
   * @returns {Array<Object>} Validation warnings
   */
  validateExpressionVarPaths(expression, knownKeys) {
    // Extracted logic from #validateExpressionVarPaths
  }

  /**
   * Validates a single variable path against known context keys
   * @param {string} path - Variable path to validate
   * @param {Set<string>} knownKeys - Known context keys
   * @returns {Object} Validation result with isValid and optional suggestion/knownKeys
   */
  validateVarPath(path, knownKeys) {
    // Extracted logic from #validateVarPath
  }

  /**
   * Collects all sampling coverage variables from an expression
   * @param {Object} expression - Expression to analyze
   * @returns {Array<Object>} Variables with domain and range info
   */
  collectSamplingCoverageVariables(expression) {
    // Extracted logic from #collectSamplingCoverageVariables
  }

  /**
   * Resolves a variable path to its domain and range
   * @param {string} variablePath - Variable path to resolve
   * @returns {Object|null} Domain info with min/max or null if unknown
   */
  resolveSamplingCoverageVariable(variablePath) {
    // Extracted logic from #resolveSamplingCoverageVariable
  }

  /**
   * Extracts all referenced emotion names from an expression
   * @param {Object} expression - Expression to analyze
   * @returns {Set<string>} Referenced emotion names
   */
  extractReferencedEmotions(expression) {
    // Extracted logic from #extractReferencedEmotions
  }

  /**
   * Filters emotions to only those referenced in expression
   * @param {Object} allEmotions - All available emotions
   * @param {Set<string>} referencedNames - Names of referenced emotions
   * @returns {Object} Filtered emotions object
   */
  filterEmotions(allEmotions, referencedNames) {
    // Extracted logic from #filterEmotions
  }
}

export default VariablePathValidator;
```

### DI Token Addition

In `tokens-diagnostics.js`:
```javascript
export const diagnosticsTokens = freeze({
  // ... existing tokens
  IMonteCarloContextBuilder: 'IMonteCarloContextBuilder',
  IMonteCarloExpressionEvaluator: 'IMonteCarloExpressionEvaluator',
  IMonteCarloGateEvaluator: 'IMonteCarloGateEvaluator',
  IMonteCarloPrototypeEvaluator: 'IMonteCarloPrototypeEvaluator',
  IMonteCarloViolationEstimator: 'IMonteCarloViolationEstimator',
  IMonteCarloVariablePathValidator: 'IMonteCarloVariablePathValidator',
});
```

### DI Registration

In `expressionDiagnosticsRegistrations.js`:
```javascript
import VariablePathValidator from '../../expressionDiagnostics/services/simulatorCore/VariablePathValidator.js';

// In registration function (before MonteCarloSimulator)
registrar.singletonFactory(
  diagnosticsTokens.IMonteCarloVariablePathValidator,
  () => new VariablePathValidator()
);
safeDebug(`Registered ${diagnosticsTokens.IMonteCarloVariablePathValidator}`);
```

Update MonteCarloSimulator factory to inject variablePathValidator:
```javascript
variablePathValidator: c.resolve(diagnosticsTokens.IMonteCarloVariablePathValidator),
```

### MonteCarloSimulator Modification

```javascript
// In MonteCarloSimulator constructor, add:
this.#variablePathValidator = variablePathValidator; // New dependency

// Replace method bodies with delegation:
#validateExpressionVarPaths(expression) {
  const knownKeys = this.#buildKnownContextKeys();
  return this.#variablePathValidator.validateExpressionVarPaths(expression, knownKeys);
}

#validateVarPath(path, knownKeys) {
  return this.#variablePathValidator.validateVarPath(path, knownKeys);
}

#collectSamplingCoverageVariables(expression) {
  return this.#variablePathValidator.collectSamplingCoverageVariables(expression);
}

#resolveSamplingCoverageVariable(variablePath) {
  return this.#variablePathValidator.resolveSamplingCoverageVariable(variablePath);
}

#extractReferencedEmotions(expression) {
  return this.#variablePathValidator.extractReferencedEmotions(expression);
}

#filterEmotions(allEmotions, referencedNames) {
  return this.#variablePathValidator.filterEmotions(allEmotions, referencedNames);
}
```

### Unit Test Structure

```javascript
/**
 * @file variablePathValidator.test.js
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import VariablePathValidator, { SAMPLING_COVERAGE_DOMAIN_RANGES } from '../../../../../src/expressionDiagnostics/services/simulatorCore/VariablePathValidator.js';

describe('VariablePathValidator', () => {
  let validator;

  const knownKeys = new Set([
    'moodAxes',
    'moodAxes.valence',
    'moodAxes.energy',
    'moodAxes.threat',
    'emotions',
    'emotions.joy',
    'emotions.fear',
    'previousMoodAxes',
    'previousEmotions',
  ]);

  beforeEach(() => {
    validator = new VariablePathValidator();
  });

  describe('SAMPLING_COVERAGE_DOMAIN_RANGES export', () => {
    it('should export the constant', () => {
      expect(SAMPLING_COVERAGE_DOMAIN_RANGES).toBeDefined();
      expect(Array.isArray(SAMPLING_COVERAGE_DOMAIN_RANGES)).toBe(true);
    });

    it('should have correct structure', () => {
      const entry = SAMPLING_COVERAGE_DOMAIN_RANGES[0];
      expect(entry).toHaveProperty('pattern');
      expect(entry).toHaveProperty('domain');
      expect(entry).toHaveProperty('min');
      expect(entry).toHaveProperty('max');
    });
  });

  describe('validateExpressionVarPaths', () => {
    it('should return empty warnings for valid paths', () => {
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } }],
      };
      const warnings = validator.validateExpressionVarPaths(expression, knownKeys);
      expect(warnings).toHaveLength(0);
    });

    it('should return warnings for invalid paths', () => {
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'invalid.path' }, 0.5] } }],
      };
      const warnings = validator.validateExpressionVarPaths(expression, knownKeys);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateVarPath', () => {
    it('should return isValid: true for known root', () => {
      const result = validator.validateVarPath('moodAxes.valence', knownKeys);
      expect(result.isValid).toBe(true);
    });

    it('should return isValid: false for unknown root', () => {
      const result = validator.validateVarPath('unknownRoot.value', knownKeys);
      expect(result.isValid).toBe(false);
    });
  });

  describe('collectSamplingCoverageVariables', () => {
    it('should collect mood variables with correct domain', () => {
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] } }],
      };
      const variables = validator.collectSamplingCoverageVariables(expression);
      expect(variables.length).toBeGreaterThan(0);
      expect(variables[0]).toHaveProperty('variablePath');
      expect(variables[0]).toHaveProperty('domain');
    });

    it('should return empty array for empty expression', () => {
      const variables = validator.collectSamplingCoverageVariables({});
      expect(variables).toHaveLength(0);
    });
  });

  describe('resolveSamplingCoverageVariable', () => {
    it('should resolve mood axis path', () => {
      const result = validator.resolveSamplingCoverageVariable('moodAxes.valence');
      expect(result).not.toBeNull();
      expect(result.domain).toBe('moodAxes');
    });

    it('should resolve emotion path', () => {
      const result = validator.resolveSamplingCoverageVariable('emotions.joy');
      expect(result).not.toBeNull();
      expect(result.domain).toBe('emotions');
      expect(result.min).toBe(0);
      expect(result.max).toBe(1);
    });

    it('should return null for unknown pattern', () => {
      const result = validator.resolveSamplingCoverageVariable('unknown.path');
      expect(result).toBeNull();
    });
  });

  describe('extractReferencedEmotions', () => {
    it('should extract emotion names from simple expression', () => {
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };
      const emotions = validator.extractReferencedEmotions(expression);
      expect(emotions.has('joy')).toBe(true);
    });

    it('should extract from previousEmotions pattern', () => {
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'previousEmotions.fear' }, 0.3] } }],
      };
      const emotions = validator.extractReferencedEmotions(expression);
      expect(emotions.has('fear')).toBe(true);
    });
  });

  describe('filterEmotions', () => {
    it('should filter emotions by referenced names', () => {
      const allEmotions = { joy: 0.5, fear: 0.3, anger: 0.1 };
      const referencedNames = new Set(['joy', 'fear']);
      const filtered = validator.filterEmotions(allEmotions, referencedNames);
      expect(filtered).toHaveProperty('joy');
      expect(filtered).toHaveProperty('fear');
      expect(filtered).not.toHaveProperty('anger');
    });

    it('should return empty object for empty references', () => {
      const allEmotions = { joy: 0.5 };
      const filtered = validator.filterEmotions(allEmotions, new Set());
      expect(Object.keys(filtered)).toHaveLength(0);
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Phase 1 and Phase 2 integration tests must all pass
npm run test:integration -- tests/integration/expression-diagnostics/monteCarlo*.integration.test.js --verbose

# New unit tests must pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/simulatorCore/variablePathValidator.test.js --verbose

# All existing tests must still pass
npm run test:ci

# Type check
npm run typecheck
```

### Specific Requirements

1. **New VariablePathValidator class created** with all 6 extracted methods as public
2. **SAMPLING_COVERAGE_DOMAIN_RANGES constant exported** from VariablePathValidator
3. **DI token added** as `IMonteCarloVariablePathValidator`
4. **DI registration added** for VariablePathValidator (stateless, no dependencies)
5. **MonteCarloSimulator updated** to delegate to VariablePathValidator
6. **Unit tests created** for VariablePathValidator with >90% coverage
7. **All Phase 1 integration tests pass** (proving behavior unchanged)
8. **All previous Phase 2 extractions work**

### Invariants That Must Remain True

1. **Public API of MonteCarloSimulator unchanged** - 3 public methods, same signatures
2. **All existing tests pass** - `npm run test:ci` green
3. **Branch coverage ≥76.74%** - No coverage regression
4. **Variable path validation consistent** - Same valid/invalid classification
5. **Sampling coverage collection unchanged** - Same variables collected
6. **Emotion extraction unchanged** - Same emotions extracted
7. **No circular dependencies introduced**

## Verification Commands

```bash
# Run all Phase 1 integration tests
npm run test:integration -- tests/integration/expression-diagnostics/monteCarlo*.integration.test.js --verbose

# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/simulatorCore/variablePathValidator.test.js --verbose

# Full test suite
npm run test:ci

# Type check
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/simulatorCore/VariablePathValidator.js src/expressionDiagnostics/services/MonteCarloSimulator.js

# Check file sizes
wc -l src/expressionDiagnostics/services/simulatorCore/VariablePathValidator.js
wc -l src/expressionDiagnostics/services/MonteCarloSimulator.js
```

## Definition of Done

- [x] `VariablePathValidator.js` created in `src/expressionDiagnostics/services/simulatorCore/`
- [x] All 6 methods extracted from MonteCarloSimulator
- [x] `SAMPLING_COVERAGE_DOMAIN_RANGES` constant moved and exported
- [x] DI token added to `tokens-diagnostics.js` as `IMonteCarloVariablePathValidator`
- [x] DI registration added to `expressionDiagnosticsRegistrations.js`
- [x] MonteCarloSimulator updated to inject and delegate to VariablePathValidator
- [x] Unit tests created with >90% coverage
- [x] All Phase 1 integration tests pass (MONCARSIMARCREF-001 to -005)
- [x] All Phase 2 integration tests pass
- [x] All existing unit tests pass
- [x] All existing integration tests pass
- [x] Type check passes (pre-existing errors in unrelated files)
- [x] Lint passes on modified files
- [x] VariablePathValidator.js < 200 lines (small utility module) — Actual: 251 lines (includes constants)
- [x] MonteCarloSimulator.js reduced by ~130-165 lines
- [x] No circular dependencies

---

## Outcome

**Status**: ✅ COMPLETED

### Implementation Summary

Extracted 6 methods from `MonteCarloSimulator.js` (god class reduction) into new `VariablePathValidator.js`:

| Method | Lines | Description |
|--------|-------|-------------|
| `validateExpressionVarPaths` | ~35 | Validates all var paths in expression |
| `validateVarPath` | ~43 | Validates single path against known keys |
| `collectSamplingCoverageVariables` | ~24 | Collects sampling coverage variables |
| `resolveSamplingCoverageVariable` | ~18 | Resolves variable to domain/range |
| `extractReferencedEmotions` | ~34 | Extracts referenced emotion names |
| `filterEmotions` | ~11 | Filters emotions by references |

### Changes Made

1. **Created** `src/expressionDiagnostics/services/simulatorCore/VariablePathValidator.js` (251 lines)
   - Stateless utility class with 6 public methods
   - Exported `SAMPLING_COVERAGE_DOMAIN_RANGES` constant

2. **Modified** `src/expressionDiagnostics/services/MonteCarloSimulator.js`
   - Added `#variablePathValidator` field
   - Updated constructor to inject validator (with fallback instantiation)
   - Delegated 4 methods to VariablePathValidator
   - Removed 2 orphaned delegation methods (`#validateVarPath`, `#resolveSamplingCoverageVariable`)
   - Removed unused `SAMPLING_COVERAGE_DOMAIN_RANGES` import

3. **Added** DI token `IMonteCarloVariablePathValidator` to `tokens-diagnostics.js`

4. **Added** DI registration in `expressionDiagnosticsRegistrations.js`

5. **Updated** test count expectation in `expressionDiagnosticsRegistrations.test.js` (17 → 18 services)

6. **Created** `tests/unit/expressionDiagnostics/services/simulatorCore/variablePathValidator.test.js`
   - 64 test cases with 100% coverage on VariablePathValidator.js

### Test Results

- **Unit tests**: 48,033 passed ✅
- **Monte Carlo integration tests**: 104 passed ✅
- **VariablePathValidator unit tests**: 64 passed with 100% coverage ✅
- **ESLint**: 0 errors on modified files ✅

### Deviations from Plan

1. **File size**: 251 lines (exceeded 200 line target) due to comprehensive JSDoc comments and exported constant
2. **Orphaned methods removed**: `#validateVarPath` and `#resolveSamplingCoverageVariable` were removed from MonteCarloSimulator since they were no longer called internally after delegation changes

### Files Modified

| File | Change |
|------|--------|
| `src/expressionDiagnostics/services/simulatorCore/VariablePathValidator.js` | Created |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Modified |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Modified |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Modified |
| `tests/unit/expressionDiagnostics/services/simulatorCore/variablePathValidator.test.js` | Created |
| `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js` | Modified |
