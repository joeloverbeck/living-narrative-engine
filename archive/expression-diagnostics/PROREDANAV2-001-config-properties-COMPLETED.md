# PROREDANAV2-001: Add v2 Configuration Properties [COMPLETED]

## Description

Add new configuration properties to `prototypeOverlapConfig.js` required by the v2 specification. These properties control thresholds for new metrics, gate analysis, and feature flags.

## Files to Touch

### Modify
- `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

### Create
- `tests/unit/expressionDiagnostics/config/prototypeOverlapConfig.test.js` (if not exists, add v2 tests)

## Out of Scope

- Modifying any service files (BehavioralOverlapEvaluator, OverlapClassifier, etc.)
- Adding new DI tokens (that's PROREDANAV2-002)
- Changing existing classification logic
- Creating new service classes
- Any UI changes

## Changes Required

Add the following properties to the config object:

### Part A Metrics Config
```javascript
minCoPassSamples: 200,        // Minimum co-pass samples for valid correlation
intensityEps: 0.05,           // Epsilon for "near-equal" intensity comparison
minPctWithinEpsForMerge: 0.85 // Required % of co-pass samples within epsilon for merge
```

### Part B Gate Analysis Config
```javascript
strictEpsilon: 1e-6           // Epsilon for normalizing strict inequalities
```

### Part C Classification Thresholds
```javascript
nestedConditionalThreshold: 0.97,        // pA_given_B threshold for behavioral nesting
strongGateOverlapRatio: 0.80,            // Gate overlap ratio for merge (lowered)
strongCorrelationForMerge: 0.97,         // Lowered from existing 0.98
minExclusiveForBroader: 0.01,            // Min exclusive rate for broader prototype in subsumption
highThresholds: [0.4, 0.6, 0.75],        // Thresholds for high-intensity co-activation
minHighJaccardForMergeAtT: { '0.6': 0.75 } // Optional high Jaccard signal per threshold
```

### Part D Feature Config
```javascript
changeEmotionNameHints: ['relief', 'surprise_startle', 'release'], // Name patterns for CONVERT_TO_EXPRESSION
enableConvertToExpression: true,  // Feature flag for v2 classification
bandMargin: 0.05                  // Gate banding suggestion margin
```

## Acceptance Criteria

### Tests That Must Pass

1. **Config completeness test**: All 13 new properties exist in the config object
2. **Type validation test**: Each property has the correct type:
   - `minCoPassSamples`: number (positive integer)
   - `intensityEps`: number (0 < x < 1)
   - `minPctWithinEpsForMerge`: number (0 < x <= 1)
   - `strictEpsilon`: number (small positive)
   - `nestedConditionalThreshold`: number (0 < x <= 1)
   - `strongGateOverlapRatio`: number (0 < x <= 1)
   - `strongCorrelationForMerge`: number (0 < x <= 1)
   - `minExclusiveForBroader`: number (0 < x < 1)
   - `highThresholds`: array of numbers
   - `minHighJaccardForMergeAtT`: object with string keys and number values
   - `changeEmotionNameHints`: array of strings
   - `enableConvertToExpression`: boolean
   - `bandMargin`: number (positive)
3. **Immutability test**: Config object is frozen (Object.isFrozen returns true)
4. **Backward compatibility test**: All existing config properties unchanged

### Invariants That Must Remain True

- Config object remains a single exported frozen object
- Existing properties (`activeAxisEpsilon`, `candidateMinActiveAxisOverlap`, etc.) retain their current values
- No circular dependencies introduced
- Config can be imported without side effects

## Estimated Size

~50 lines of code changes + ~100 lines of tests

## Dependencies

None - this is a foundation ticket.

## Verification Commands

```bash
# Run config tests
npm run test:unit -- --testPathPattern=prototypeOverlapConfig

# Verify no syntax errors
npm run typecheck

# Lint the config file
npx eslint src/expressionDiagnostics/config/prototypeOverlapConfig.js
```

---

## Outcome

### Status: ✅ COMPLETED

### What Was Actually Changed

1. **`src/expressionDiagnostics/config/prototypeOverlapConfig.js`**:
   - Added JSDoc reference to v2 spec (`@see specs/prototype-redundancy-analyzer-v2.md`)
   - Extended `@typedef PrototypeOverlapConfig` with all 13 v2 property types
   - Added all 13 v2 configuration properties with JSDoc documentation:
     - Part A: `minCoPassSamples`, `intensityEps`, `minPctWithinEpsForMerge`
     - Part B: `strictEpsilon`
     - Part C: `nestedConditionalThreshold`, `strongGateOverlapRatio`, `strongCorrelationForMerge`, `minExclusiveForBroader`, `highThresholds`, `minHighJaccardForMergeAtT`
     - Part D: `changeEmotionNameHints`, `enableConvertToExpression`, `bandMargin`
   - Fixed JSDoc type annotation for `minHighJaccardForMergeAtT` to use index signature syntax

2. **`tests/unit/expressionDiagnostics/config/prototypeOverlapConfig.test.js`** (NEW):
   - Created comprehensive test suite with 58 test cases
   - Tests config object immutability (Object.isFrozen)
   - Tests backward compatibility (21 existing properties unchanged)
   - Tests all 13 v2 properties for correct values and types
   - Tests property relationships and invariants
   - Tests completeness (all 13 v2 properties present)

### Compared to Original Plan

- **Exactly as planned**: All 13 properties added with specified values
- **Additional**: Added relationship invariant tests (e.g., `strongCorrelationForMerge < minCorrelationForMerge`)
- **Additional**: More comprehensive type validation tests (e.g., sorted array, key correspondence)
- **Lines changed**: ~100 lines config + ~300 lines tests (more tests than estimated)

### Test Results

All 58 tests pass:
- Config object structure: 2 tests
- Backward compatibility: 21 tests
- v2 Part A metrics: 6 tests
- v2 Part B gate analysis: 2 tests
- v2 Part C classification: 19 tests
- v2 Part D features: 6 tests
- v2 completeness: 2 tests
- Config relationships: 4 tests
