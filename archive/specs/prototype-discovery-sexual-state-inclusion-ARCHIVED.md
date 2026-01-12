# Spec: Include Sexual State Prototypes in Prototype Discovery

## Problem Statement

When analyzing expressions in the Expression Diagnostics tool, the Prototype Fit Analysis, Implied Prototype Analysis, and Gap Detection sections only consider **emotion prototypes** from `core:emotion_prototypes`, even when the expression's prerequisites reference **sexual state prototypes** from `core:sexual_prototypes`.

### Example

The expression `sensual_enjoyment.expression.json` references:
- `sexualStates.sexual_sensual_pleasure` (primary trigger)
- `sexualStates.sexual_frustration`
- `sexualStates.aroused_with_disgust`
- `sexualStates.aroused_with_shame`

Yet the Prototype Fit Analysis leaderboard shows only emotion prototypes (calm, relief, trust, etc.) and excludes all 16 sexual state prototypes (`sexual_lust`, `passion`, `sexual_sensual_pleasure`, etc.).

### Root Cause

In `PrototypeFitRankingService.js`, all three public methods (`analyzeAllPrototypeFit`, `computeImpliedPrototype`, `detectPrototypeGaps`) use this pattern:

```javascript
const expression = Array.isArray(prerequisitesOrExpression) ? null : prerequisitesOrExpression;
const typesToFetch = this.#detectReferencedPrototypeTypes(expression);
```

When callers pass a **prerequisites array** (not a full expression object), `expression` becomes `null`, and `#detectReferencedPrototypeTypes(null)` returns `{ hasEmotions: false, hasSexualStates: false }`.

The fallback then defaults to emotions only:
```javascript
if (!typesToFetch.hasEmotions && !typesToFetch.hasSexualStates) {
  typesToFetch.hasEmotions = true;  // BUG: Defaults to ONLY emotions
}
```

**Affected callers:**
1. `ExpressionDiagnosticsController.#displayPrototypeFitAnalysis()` - passes `prerequisites` array
2. `MonteCarloReportGenerator.#performPrototypeFitAnalysis()` - passes `prerequisites` array

## Solution

### 1. Fix `#detectReferencedPrototypeTypes` to Accept Prerequisites Array

**File:** `src/expressionDiagnostics/services/PrototypeFitRankingService.js`

**Current Implementation (lines 449-461):**
```javascript
#detectReferencedPrototypeTypes(expression) {
    const result = { hasEmotions: false, hasSexualStates: false };
    if (!expression?.prerequisites) return result;
    for (const prereq of expression.prerequisites) {
      this.#scanLogicForPrototypeTypes(prereq.logic, result);
      if (result.hasEmotions && result.hasSexualStates) break;
    }
    return result;
}
```

**New Implementation:**
```javascript
#detectReferencedPrototypeTypes(expressionOrPrerequisites) {
    const result = { hasEmotions: false, hasSexualStates: false };

    // Handle array of prerequisites directly OR extract from expression object
    const prerequisites = Array.isArray(expressionOrPrerequisites)
      ? expressionOrPrerequisites
      : expressionOrPrerequisites?.prerequisites;

    if (!prerequisites || prerequisites.length === 0) return result;

    for (const prereq of prerequisites) {
      this.#scanLogicForPrototypeTypes(prereq.logic, result);
      if (result.hasEmotions && result.hasSexualStates) break;
    }
    return result;
}
```

### 2. Update Public Methods to Pass Input Directly

**In `analyzeAllPrototypeFit` (line ~167):**
```javascript
// BEFORE:
const expression = Array.isArray(prerequisitesOrExpression) ? null : prerequisitesOrExpression;
const typesToFetch = this.#detectReferencedPrototypeTypes(expression);

// AFTER:
const typesToFetch = this.#detectReferencedPrototypeTypes(prerequisitesOrExpression);
const expression = Array.isArray(prerequisitesOrExpression) ? null : prerequisitesOrExpression;
```

**In `computeImpliedPrototype` (line ~275):**
```javascript
// BEFORE:
const expression = prerequisitesOrAxisConstraintsOrExpression?.prerequisites
  ? prerequisitesOrAxisConstraintsOrExpression
  : null;
const typesToFetch = this.#detectReferencedPrototypeTypes(expression);

// AFTER:
const typesToFetch = this.#detectReferencedPrototypeTypes(prerequisitesOrAxisConstraintsOrExpression);
```

**In `detectPrototypeGaps` (line ~345):**
```javascript
// BEFORE:
const expression = prerequisitesOrTargetSignatureOrExpression?.prerequisites
  ? prerequisitesOrTargetSignatureOrExpression
  : null;
const typesToFetch = this.#detectReferencedPrototypeTypes(expression);

// AFTER:
const typesToFetch = this.#detectReferencedPrototypeTypes(prerequisitesOrTargetSignatureOrExpression);
```

### 3. Retain Expression Extraction for Other Uses

The `expression` variable is still needed in `analyzeAllPrototypeFit` for `#extractExpressionPrototype(expression)`, so keep that extraction but call it after type detection:

```javascript
// Detect types first (works with array or expression)
const typesToFetch = this.#detectReferencedPrototypeTypes(prerequisitesOrExpression);

// Extract expression for prototype extraction (only works with expression object)
const expression = Array.isArray(prerequisitesOrExpression) ? null : prerequisitesOrExpression;
```

## Testing Requirements

### Unit Tests

**File:** `tests/unit/expressionDiagnostics/services/prototypeFitRankingService.test.js`

**New test cases for `#detectReferencedPrototypeTypes` (via public method behavior):**

1. **Test: Detects emotion prototypes from prerequisites array**
   - Input: Prerequisites array with `emotions.calm >= 0.5`
   - Expected: `hasEmotions: true, hasSexualStates: false`

2. **Test: Detects sexual state prototypes from prerequisites array**
   - Input: Prerequisites array with `sexualStates.sexual_lust >= 0.3`
   - Expected: `hasEmotions: false, hasSexualStates: true`

3. **Test: Detects both types from mixed prerequisites array**
   - Input: Prerequisites array with both `emotions.calm` and `sexualStates.passion`
   - Expected: `hasEmotions: true, hasSexualStates: true`

4. **Test: Falls back to emotions when no prototypes referenced**
   - Input: Prerequisites array with only `moodAxes.valence >= 50`
   - Expected: `hasEmotions: true` (fallback behavior)

**New test cases for `analyzeAllPrototypeFit`:**

5. **Test: Returns both prototype types in leaderboard with mixed prerequisites**
   - Input: Prerequisites array referencing both `emotions.calm` and `sexualStates.passion`
   - Expected: Leaderboard contains entries with `type: 'emotion'` AND `type: 'sexual'`

6. **Test: Sexual prototypes ranked correctly when referenced**
   - Input: Prerequisites with `sexualStates.sexual_sensual_pleasure >= 0.62`
   - Expected: `sexual_sensual_pleasure` appears in top rankings

**New test cases for `computeImpliedPrototype`:**

7. **Test: Returns sexual prototypes in similarity rankings**
   - Input: Prerequisites referencing sexual states
   - Expected: `bySimilarity`, `byGatePass`, `byCombined` include sexual prototypes

**New test cases for `detectPrototypeGaps`:**

8. **Test: Includes sexual prototypes in k-nearest neighbors**
   - Input: Prerequisites referencing sexual states
   - Expected: `kNearestNeighbors` includes entries with `type: 'sexual'`

### Integration Tests

**File:** `tests/integration/expression-diagnostics/prototypeFitWithSexualStates.integration.test.js` (NEW)

1. **Test: Full analysis flow with sensual_enjoyment expression**
   - Load real expression file
   - Run Monte Carlo simulation
   - Verify Prototype Fit leaderboard includes both emotion and sexual prototypes
   - Verify Implied Prototype analysis includes sexual prototypes in rankings
   - Verify Gap Detection considers both prototype types

2. **Test: Report generation includes both prototype types**
   - Generate report for mixed expression
   - Verify Prototype Fit section includes sexual prototypes
   - Verify Implied Prototype section includes sexual prototypes

3. **Test: Edge case - expression with only sexual state references**
   - Create/use expression with only `sexualStates.*` references
   - Verify only sexual prototypes appear in rankings

### Existing Test Updates

**File:** `tests/unit/expressionDiagnostics/services/prototypeFitRankingService.test.js`

Review and update existing tests to ensure they:
- Use appropriate fixtures (expression object vs prerequisites array)
- Verify backward compatibility with expression object input
- Add assertions for `type` field in results

**File:** `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.prototypeFit.test.js`

Add tests verifying the controller correctly displays both prototype types.

**File:** `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.prototypeFit.test.js`

Add tests verifying report generation includes both prototype types.

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/services/PrototypeFitRankingService.js` | Bug fix | Fix `#detectReferencedPrototypeTypes` to accept arrays |
| `tests/unit/expressionDiagnostics/services/prototypeFitRankingService.test.js` | Test update | Add unit tests for array input handling |
| `tests/integration/expression-diagnostics/prototypeFitWithSexualStates.integration.test.js` | New file | Add integration tests for mixed prototype scenarios |

## Verification Steps

1. Run unit tests: `npm run test:unit -- --testPathPattern=prototypeFit`
2. Run integration tests: `npm run test:integration -- --testPathPattern=prototypeFit`
3. Manual verification:
   - Open `expression-diagnostics.html`
   - Select `emotions-sexual-desire:sensual_enjoyment`
   - Run Monte Carlo simulation
   - Verify Prototype Fit Analysis shows both emotion and sexual prototypes
   - Generate report and verify both types appear in all prototype sections

## Acceptance Criteria

1. Sexual state prototypes appear in Prototype Fit Analysis leaderboard when expression references them
2. Sexual state prototypes appear in Implied Prototype rankings
3. Sexual state prototypes appear in Gap Detection k-nearest neighbors
4. Generated reports include both prototype types
5. All existing tests pass
6. New tests achieve 100% coverage of the fix

## Non-Goals

- Changing the calculation logic for prototype intensities
- Modifying how prototypes are loaded from lookup files
- Changing the UI layout or styling
- Adding new prototype types beyond emotion and sexual
