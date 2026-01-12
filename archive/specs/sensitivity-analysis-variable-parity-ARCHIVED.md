# Sensitivity Analysis Variable Parity Fix

## Goal

Fix the parity issue where the "Global Expression Sensitivity" section does not include `sexualArousal` and related scalar variables, despite these variables appearing in the "most tunable" recommendations in Top Blockers. Both analysis paths should recognize the same set of tunable variables.

## Motivation

Content creators using expression diagnostics see inconsistent information:

1. **Top Blockers** shows: `most tunable: sexualArousal >= 0.35 (6.54%)`
2. **Global Expression Sensitivity** section: Does NOT include `sexualArousal` in its analysis

This creates confusion:
- Users are told to tune `sexualArousal` but cannot see sensitivity analysis for it
- The sensitivity section only shows emotions like `emotions.awkwardness`, `emotions.freeze`, `emotions.anxiety`
- No way to assess how `sexualArousal` threshold changes would affect trigger rates

The root cause is inconsistent variable filtering patterns across the codebase:
- `#findMostTunableLeaf()` examines **all leaves** from hierarchical breakdown
- `computeGlobalSensitivityData()` filters using regex patterns that **miss scalar variables**

## Current Implementation Analysis

### Problem Locations

| File | Method | Lines | Pattern Used | What It Misses |
|------|--------|-------|--------------|----------------|
| `SensitivityAnalyzer.js` | `computeSensitivityData` | 48-49 | `^emotions\.(\w+)$`, `^sexual\.(\w+)$` | `sexualArousal`, `sexualStates.*` |
| `SensitivityAnalyzer.js` | `computeGlobalSensitivityData` | 119-120 | Same as above | Same |
| `MonteCarloReportGenerator.js` | Prototype extraction | 634-635 | `^emotions\.(\w+)$`, `^sexualStates\.(\w+)$` | `sexualArousal`, `sexual.*` |
| `MonteCarloReportGenerator.js` | Another extraction | 1649-1650 | `^emotions\.(\w+)$`, `^sexual\.(\w+)$` | `sexualArousal`, `sexualStates.*` |

### How sexualArousal Flows Through the System

1. **Generation**: `RandomStateGenerator` generates raw sexual state values
2. **Calculation**: `MonteCarloSimulator.js:512-523` calculates `sexualArousal` as derived value
3. **Context Exposure**: `MonteCarloSimulator.js:561` exposes as top-level scalar:
   ```javascript
   return {
     emotions,
     sexualStates,
     sexualArousal,           // ← TOP-LEVEL SCALAR
     previousSexualArousal,   // ← TOP-LEVEL SCALAR
     // ...
   };
   ```
4. **Known Keys**: `MonteCarloSimulator.js:1250-1259` correctly identifies these as scalar values

### Why "Most Tunable" Includes sexualArousal

The `#findMostTunableLeaf()` method in `MonteCarloReportGenerator.js:1452-1493` iterates over **all leaves** in the hierarchical breakdown without filtering by variable name pattern. It examines any leaf with `nearMissRate > 0`, which correctly captures `sexualArousal` conditions.

### Why Global Sensitivity Excludes sexualArousal

The `computeGlobalSensitivityData()` method filters using regex:
```javascript
const emotionMatch = varPath.match(/^emotions\.(\w+)$/);
const sexualMatch = varPath.match(/^sexual\.(\w+)$/);
if ((emotionMatch || sexualMatch) && typeof threshold === 'number') { ... }
```

The pattern `^sexual\.(\w+)$` expects nested paths like `sexual.arousal` but `sexualArousal` is:
- A **top-level scalar** (not `sexual.arousal`)
- Not matched by either regex pattern

## Proposed Solution

### Strategy: Centralized Tunable Variable Matcher

Create a centralized utility for recognizing all tunable variables, eliminating duplicated and inconsistent regex patterns.

### Phase 1: Extend advancedMetricsConfig.js

**File**: `src/expressionDiagnostics/config/advancedMetricsConfig.js`

Add new tunable variable detection infrastructure:

```javascript
/**
 * Complete list of tunable variable patterns including scalars.
 * Used by both sensitivity analysis and blocker recommendations.
 */
const TUNABLE_VARIABLE_PATTERNS = {
  // Nested patterns (existing)
  emotions: /^emotions\.(\w+)$/,
  sexualStates: /^sexualStates\.(\w+)$/,
  sexual: /^sexual\.(\w+)$/,
  mood: /^mood\.(\w+)$/,
  moodAxes: /^moodAxes\.(\w+)$/,
  traits: /^traits\.(\w+)$/,
  affectTraits: /^affectTraits\.(\w+)$/,

  // Scalar patterns (NEW)
  sexualArousal: /^sexualArousal$/,
  previousSexualArousal: /^previousSexualArousal$/,
};

/**
 * Check if a variable path represents a tunable variable.
 * @param {string} varPath - The variable path (e.g., 'emotions.joy', 'sexualArousal')
 * @returns {boolean}
 */
function isTunableVariable(varPath) {
  return Object.values(TUNABLE_VARIABLE_PATTERNS).some(
    pattern => pattern.test(varPath)
  );
}

/**
 * Get tunable variable metadata.
 * @param {string} varPath - The variable path
 * @returns {{ domain: string, isScalar: boolean, name: string } | null}
 */
function getTunableVariableInfo(varPath) {
  for (const [domain, pattern] of Object.entries(TUNABLE_VARIABLE_PATTERNS)) {
    const match = varPath.match(pattern);
    if (match) {
      return {
        domain,
        isScalar: domain === 'sexualArousal' || domain === 'previousSexualArousal',
        name: match[1] || varPath,  // Scalars use full path as name
      };
    }
  }
  return null;
}
```

Add epsilon values for scalar variables:

```javascript
const nearMissEpsilon = {
  // Existing
  emotions: 0.05,
  moodAxes: 5,
  sexualStates: 5,
  sexual: 0.05,
  mood: 5,
  traits: 0.05,
  affectTraits: 0.05,

  // NEW: Scalar variables
  sexualArousal: 0.05,      // [0, 1] range
  previousSexualArousal: 0.05,

  default: 0.05,
};
```

### Phase 2: Update SensitivityAnalyzer.js

**File**: `src/expressionDiagnostics/services/SensitivityAnalyzer.js`

Replace inline regex with centralized utility:

**Before** (lines 48-52, 119-122):
```javascript
const emotionMatch = varPath.match(/^emotions\.(\w+)$/);
const sexualMatch = varPath.match(/^sexual\.(\w+)$/);
if ((emotionMatch || sexualMatch) && typeof threshold === 'number') { ... }
```

**After**:
```javascript
import { isTunableVariable, getTunableVariableInfo } from '../config/advancedMetricsConfig.js';

// In computeSensitivityData and computeGlobalSensitivityData
const tunableInfo = getTunableVariableInfo(varPath);
if (tunableInfo && typeof threshold === 'number') {
  // Use tunableInfo.domain, tunableInfo.isScalar, tunableInfo.name as needed
  ...
}
```

### Phase 3: Update MonteCarloReportGenerator.js (Consistency)

**File**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`

Update pattern matching at lines 634-635 and 1649-1650 to use the centralized utility for consistency, even though these paths already work for their specific use cases.

### Phase 4: Handle Scalar Variable Sensitivity Sweeps

Scalar variables like `sexualArousal` need special handling in sensitivity sweeps:

```javascript
// In SensitivityAnalyzer.computeExpressionSensitivity

// For nested variables: context.emotions.joy
// For scalar variables: context.sexualArousal

if (tunableInfo.isScalar) {
  // Direct property on context
  modifiedContext[varPath] = thresholdVariant;
} else {
  // Nested property
  const [domain, property] = varPath.split('.');
  modifiedContext[domain] = { ...modifiedContext[domain], [property]: thresholdVariant };
}
```

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `advancedMetricsConfig.js` | Extend | Add `TUNABLE_VARIABLE_PATTERNS`, `isTunableVariable()`, `getTunableVariableInfo()`, scalar epsilon values |
| `SensitivityAnalyzer.js` | Refactor | Replace inline regex (lines 48-52, 119-122) with centralized utility imports |
| `MonteCarloReportGenerator.js` | Refactor | Replace inline regex (lines 634-635, 1649-1650) with centralized utility imports |
| `sensitivityAnalyzer.test.js` | Extend | Add test cases for `sexualArousal` and `previousSexualArousal` handling |
| `advancedMetricsConfig.test.js` | Extend | Add tests for new utility functions |

## Testing Strategy

### Unit Tests

1. **advancedMetricsConfig.test.js**:
   - `isTunableVariable()` returns true for all valid patterns
   - `isTunableVariable()` returns false for invalid paths
   - `getTunableVariableInfo()` returns correct metadata
   - Scalar detection works correctly

2. **sensitivityAnalyzer.test.js**:
   - Add test for expression with `sexualArousal` threshold
   - Verify `sexualArousal` appears in global sensitivity output
   - Verify sensitivity sweeps work for scalar variables
   - Edge cases: expression with only scalar variables

### Integration Tests

1. Create test expression file with `sexualArousal >= 0.35` condition
2. Run Monte Carlo simulation
3. Verify both Top Blockers and Global Sensitivity show `sexualArousal`
4. Verify sensitivity sweep values are correctly computed

### Verification Checklist

- [ ] `sexualArousal` appears in Global Expression Sensitivity when used in expression
- [ ] `previousSexualArousal` appears when used
- [ ] Sensitivity sweep generates correct threshold variants
- [ ] Epsilon value is correctly applied (0.05 for [0,1] range)
- [ ] Both report and non-report outputs show consistent information
- [ ] No regression in existing emotion/sexualStates handling

## Success Criteria

1. **Parity**: Same variables appear in "most tunable" recommendations AND "Global Expression Sensitivity"
2. **Completeness**: All variable families covered:
   - `emotions.*` ✓
   - `sexualStates.*` ✓
   - `sexual.*` ✓
   - `sexualArousal` (scalar) ✓
   - `previousSexualArousal` (scalar) ✓
   - `mood.*`, `moodAxes.*` ✓
   - `traits.*`, `affectTraits.*` ✓
3. **No Duplication**: Single source of truth for tunable variable detection
4. **Backward Compatible**: Existing behavior unchanged for already-supported variables

## Edge Cases

### Scalar Variables with No Range

Unlike nested variables (`emotions.joy` has documented [0,1] range), scalar variables need explicit range documentation. The `sexualArousal` value is calculated as a [0,1] scalar, so epsilon=0.05 is appropriate.

### Mixed Expressions

Expressions using both nested and scalar variables should show all in sensitivity analysis.

### Temporal Scalar Variables

`previousSexualArousal` should be treated identically to `sexualArousal` for sensitivity purposes.

## Open Questions

1. **Should `moodAxes.threat` be included?** The original example mentions `moodAxes.threat >= 20`. Currently `moodAxes` may or may not be fully supported. Verify during implementation.

2. **Are there other scalar variables?** Check if there are additional top-level scalars in the simulation context that should be tunable.

## Dependencies

- Existing `advancedMetricsConfig.js` structure
- Existing `SensitivityAnalyzer` class structure
- Existing Monte Carlo simulation context shape
