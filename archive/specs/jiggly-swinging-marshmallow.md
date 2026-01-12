# Plan: Fix Path-Sensitive Analysis Discrepancy with Monte Carlo

## Problem Summary

There's a significant discrepancy between two analysis methods for `lonely_isolation.expression.json`:

1. **Monte Carlo Simulation**: Reports 0.651% trigger rate
2. **Path-Sensitive Analysis**: Reports all 3 branches **infeasible** because:
   - `despair` requires threshold < 0.65 (LOW direction gate)
   - But claims `despair` max possible = 0.46
   - Gap = 0.19 (unreachable)

**The contradiction**: If all paths are truly infeasible, Monte Carlo should show 0%, not 0.651%.

## Root Cause Analysis

### The Bug

After analyzing the code, I found the bug is in **how Path-Sensitive Analyzer calculates `maxPossible` for LOW-threshold prototypes**.

**Key insight from `lonely_isolation.expression.json`:**

The expression has:
```json
{
  "<": [{ "var": "emotions.despair" }, 0.65]   // LOW threshold (despair < 0.65)
}
```

This is a **LOW direction requirement** - despair must stay BELOW 0.65 for the expression to trigger.

**The bug in `PathSensitiveAnalyzer.js` lines 933-946:**

```javascript
#partitionPrototypesByDirection(requirements) {
  const highPrototypes = new Set();
  const lowPrototypes = new Set();

  for (const req of requirements) {
    if (req.direction === 'high') {
      highPrototypes.add(req.prototypeId);
    } else {
      lowPrototypes.add(req.prototypeId);  // despair goes here
    }
  }
  return { highPrototypes, lowPrototypes };
}
```

**Then in line 121-128:**

```javascript
// Filter to only prototypes that are both in this branch AND have HIGH threshold
const activePrototypesInBranch = branch.requiredPrototypes.filter((p) =>
  highPrototypes.has(p)
);
const inactivePrototypesInBranch = branch.requiredPrototypes.filter((p) =>
  lowPrototypes.has(p)
);
```

**The problem:**
- For LOW prototypes like `despair`, gates are **NOT enforced** during interval computation
- But then in `#computeReachabilityByBranch()` (lines 956-1016), it still calculates max intensity and checks if the threshold is reachable
- **The `maxPossible` calculation for LOW prototypes is checking the WRONG direction**

### The Semantic Error

For `despair < 0.65`:
- We need to check: "Can despair stay BELOW 0.65?"
- The current code incorrectly asks: "Can despair reach UP TO 0.65?" and then reports a gap

**For LOW thresholds, the question is inverted:**
- If max possible despair is 0.46, that's **GOOD** - it means despair can definitely stay < 0.65
- The current code treats it as a **problem** when it's actually a **guarantee of success**

### Why Monte Carlo Works Correctly

Monte Carlo evaluates the actual logic: `despair < 0.65`. When sampling random states:
- If despair = 0.30 → passes (< 0.65) ✅
- If despair = 0.70 → fails (not < 0.65) ❌

Monte Carlo doesn't have the inverted interpretation bug.

## Fix Strategy

### Option 1: Fix Reachability Logic for LOW Direction (Recommended)

In `#computeReachabilityByBranch()`, when processing a requirement with `direction: 'low'`:

**Current (buggy) logic:**
```javascript
// This checks: "Can we reach the threshold?"
// For LOW: threshold=0.65, maxPossible=0.46 → gap=0.19 → unreachable (WRONG!)
```

**Fixed logic:**
```javascript
// For LOW direction: we need max to be UNDER the threshold
// If maxPossible=0.46 and threshold=0.65, that's REACHABLE (max < threshold)
// Only unreachable if minPossible >= threshold (can't get below the threshold)
```

### Changes Required

1. **`PathSensitiveAnalyzer.js` - Add `minPossible` calculation:**
   - Add `#calculateMinIntensity()` method (inverse of `#calculateMaxIntensity()`)
   - For LOW thresholds: check if `minPossible < threshold` (can go below)

2. **`BranchReachability.js` - Add direction awareness:**
   - Store `direction` in reachability result
   - Adjust `isReachable` and `gap` interpretation based on direction

3. **Tests to reproduce the bug:**
   - Create test case that mimics `lonely_isolation.expression.json`'s despair condition
   - Verify that LOW threshold prototypes are correctly evaluated

## Implementation Steps

### Step 1: Create failing test (reproduce bug)
File: `tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.lowThreshold.test.js`

```javascript
describe('LOW threshold reachability (despair < 0.65 case)', () => {
  it('should mark LOW threshold as reachable when maxPossible < threshold', () => {
    // Setup: despair has gates that limit it to max 0.46
    // Requirement: despair < 0.65
    // Expected: REACHABLE (0.46 is below 0.65)
    // Currently: UNREACHABLE (bug)
  });
});
```

### Step 2: Add `#calculateMinIntensity()` method
Location: `PathSensitiveAnalyzer.js`

Parallel to `#calculateMaxIntensity()` but using opposite axis values.

### Step 3: Fix `#computeReachabilityByBranch()`
Location: `PathSensitiveAnalyzer.js` lines 956-1016

Add direction-aware reachability:
```javascript
// For HIGH direction: maxPossible >= threshold means reachable
// For LOW direction: minPossible < threshold means reachable
```

### Step 4: Update `BranchReachability` model
Location: `src/expressionDiagnostics/models/BranchReachability.js`

Add `direction` field and adjust `isReachable`/`gap` getters.

### Step 5: Run all tests, verify fix

## Files to Modify

1. `src/expressionDiagnostics/services/PathSensitiveAnalyzer.js` (main fix)
2. `src/expressionDiagnostics/models/BranchReachability.js` (direction support)
3. `tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js` (new tests)

## Verification Plan

1. **Unit tests**: New tests for LOW threshold reachability
2. **Integration test**: Run against actual `lonely_isolation.expression.json`
3. **Compare Monte Carlo vs Path-Sensitive**: Both should now agree that the expression is reachable (though rare)

## Risk Assessment

- **Low risk**: Changes are localized to reachability calculation
- **Backward compatible**: HIGH threshold logic unchanged
- **No breaking changes**: UI display will improve accuracy

## Success Criteria

After fix:
- Path-Sensitive Analysis for `lonely_isolation` should show branches as **feasible** (not infeasible)
- The `despair < 0.65` requirement should be marked as **reachable** when max despair is 0.46
- Monte Carlo and Path-Sensitive results should be consistent (both show the expression can trigger)
