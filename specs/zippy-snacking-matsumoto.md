# Implementation Plan: Sexual State Prototype Parity in Expression Diagnostics

## Problem Summary

The Monte Carlo simulation system correctly calculates both emotion and sexual state prototypes (architecturally identical with weights and gates). However, the analysis and reporting components only process emotion prototypes in several key areas:

1. **PrototypeFitRankingService.js** - `#getAllPrototypes()` hardcodes `core:emotion_prototypes`
2. **MonteCarloReportGenerator.js** - `#generateLastMileDecompositionSection()` only matches `emotions.*`
3. **MonteCarloReportGenerator.js** - `#getPrototypeWeights()` hardcodes `'emotion'` type

## Key Requirement

If sexual_state prototypes aren't used in an expression's prerequisites, they should NOT be included in output. Only calculate/output data for prototype types that are actually referenced.

## Files to Modify

### 1. PrototypeFitRankingService.js

**Path**: `src/expressionDiagnostics/services/PrototypeFitRankingService.js`

**Changes**:

1. Add `#detectReferencedPrototypeTypes(expression)` - scans prerequisites for `emotions.*` and `sexualStates.*` references
2. Add `#getPrototypesByType(type)` - fetches from `core:emotion_prototypes` or `core:sexual_prototypes`
3. Modify `#getAllPrototypes()` - accept `typesToFetch` param, conditionally fetch both types
4. Rename `#findEmotionInLogic()` → `#findPrototypeRefInLogic()` - return `{id, type}` instead of just id
5. Modify `#extractExpressionPrototype()` - return structured `{id, type}` result
6. Update `analyzeAllPrototypeFit()`, `computeImpliedPrototype()`, `detectPrototypeGaps()` to use detected types
7. Include `type` field in result objects for downstream consumers

### 2. MonteCarloReportGenerator.js

**Path**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`

**Changes**:

1. Modify `#getPrototypeWeights(prototypeId, type)` - accept type param, use for lookup key
2. Modify `#generateLastMileDecompositionSection()`:
   - Match both `emotions\.(\w+)` and `sexualStates\.(\w+)` patterns
   - Pass correct type to `#getPrototypeWeights()`
   - Use correct context key (`emotions` or `sexualStates`) for value extraction
   - Update display strings to reflect prototype type

## Implementation Steps

### Step 1: PrototypeFitRankingService Type Detection

Add type detection helper that scans JSON Logic for prototype references:

```javascript
#detectReferencedPrototypeTypes(expression) {
  // Scan prerequisites for emotions.* and sexualStates.* paths
  // Return { hasEmotions: boolean, hasSexualStates: boolean }
}
```

### Step 2: PrototypeFitRankingService Lookup Refactor

Modify prototype fetching to be type-aware:

```javascript
#getPrototypesByType(type) {
  const lookupKey = type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
  // Return prototypes with type field included
}

#getAllPrototypes(typesToFetch) {
  // Conditionally fetch each type based on what's referenced
}
```

### Step 3: Generalize Prototype Logic Discovery

Rename and update to find both emotion and sexual references:

```javascript
#findPrototypeRefInLogic(logic) {
  // Return { id, type } for emotions.* or sexualStates.*
}
```

### Step 4: Update Public API Methods

All three public methods need:
- Detect referenced types at start
- Early return if no prototypes referenced
- Pass types to `#getAllPrototypes()`
- Include type in results

### Step 5: MonteCarloReportGenerator Fixes

Update last-mile decomposition:

```javascript
const emotionMatch = varPath.match(/^emotions\.(\w+)$/);
const sexualMatch = varPath.match(/^sexualStates\.(\w+)$/);
if (!emotionMatch && !sexualMatch) continue;

const prototypeId = emotionMatch ? emotionMatch[1] : sexualMatch[1];
const prototypeType = emotionMatch ? 'emotion' : 'sexual';
const weights = this.#getPrototypeWeights(prototypeId, prototypeType);
```

## Test Updates Required

### PrototypeFitRankingService.test.js

Add tests for:
- Type detection from mixed prerequisites
- Sexual prototype fetching when referenced
- No sexual fetch when only emotions referenced
- Type field in results

### MonteCarloReportGenerator.test.js

Add tests for:
- Last-mile decomposition with `sexualStates.*` blockers
- Correct prototype weights lookup by type
- Report section formatting for sexual states

## Verification

```bash
# After each file:
npx eslint <modified-files>
npm run typecheck
npm run test:unit -- --testPathPattern="prototypeFitRankingService|monteCarloReportGenerator"

# Final:
npm run test:integration -- --testPathPattern="expressionDiagnostics"
```

## Existing Pattern Reference

Follow the established pattern from other services:

```javascript
// From PrototypeConstraintAnalyzer.js line 466
const lookupKey = type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
```

## Notes

- **Backward Compatibility**: Report output unchanged when only emotions referenced
- **Performance**: Only fetch sexual prototypes when actually referenced in prerequisites
- **Report Labeling**: Update section titles/content to indicate prototype type when sexual states involved
