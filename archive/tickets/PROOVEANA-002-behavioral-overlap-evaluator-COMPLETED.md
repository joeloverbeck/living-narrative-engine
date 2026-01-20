# PROOVEANA-002: BehavioralOverlapEvaluator Service

**STATUS: COMPLETED**

## Description

Implement Stage B of the Prototype Overlap Analyzer: the behavioral evaluation service. This service performs Monte Carlo sampling to evaluate how two prototypes behave across random contexts, computing gate overlap statistics, intensity correlation, and collecting divergence examples.

## Files Created

- `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js` (~435 lines)
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/behavioralOverlapEvaluator.test.js` (~1040 lines)

## Files Modified

None

## Corrections Applied During Implementation

### 1. Removed ContextAxisNormalizer Dependency
- **Original**: Ticket listed `ContextAxisNormalizer` as a required dependency with `getNormalizedAxes()` method
- **Correction**: `PrototypeIntensityCalculator.computeIntensity()` and `PrototypeGateChecker.checkAllGatesPass()` both internally use `ContextAxisNormalizer` via composition - it was redundant as a direct dependency
- **Result**: Removed `contextAxisNormalizer` from constructor parameters

### 2. Updated Test Command Syntax
- **Original**: `npm run test:unit -- --testPathPattern="behavioralOverlapEvaluator"` (deprecated flag)
- **Correction**: `npm run test:unit -- --testPathPatterns="behavioralOverlapEvaluator"` (current flag)

## Out of Scope

- Candidate filtering (Stage A) - PROOVEANA-001
- Classification logic - PROOVEANA-003
- DI registration - PROOVEANA-006
- Integration tests - PROOVEANA-010
- Custom normalization or intensity calculation (MUST use existing services)

## Implementation Details

### Key Reusable Services (DO NOT RECREATE)

These services are used via dependency injection:

- `PrototypeIntensityCalculator` - `computeIntensity()` is the SINGLE SOURCE OF TRUTH
- `RandomStateGenerator` - `generate('uniform', 'static')` for context sampling
- `ContextBuilder` - `buildContext()` for context construction
- `PrototypeGateChecker` - `checkAllGatesPass()` for gate evaluation

### Dependencies (5 total)
```
Dependencies:
├── prototypeIntensityCalculator (computeIntensity)
├── randomStateGenerator (generate)
├── contextBuilder (buildContext)
├── prototypeGateChecker (checkAllGatesPass)
├── config (PROTOTYPE_OVERLAP_CONFIG)
└── logger (ILogger)
```

### Return Type
```typescript
interface BehavioralMetrics {
  gateOverlap: {
    onEitherRate: number;  // P(A OR B)
    onBothRate: number;    // P(A AND B)
    pOnlyRate: number;     // P(A AND NOT B)
    qOnlyRate: number;     // P(B AND NOT A)
  };
  intensity: {
    pearsonCorrelation: number;  // [-1, 1] or NaN
    meanAbsDiff: number;         // >= 0 or NaN
    dominanceP: number;          // P(iA > iB + delta)
    dominanceQ: number;          // P(iB > iA + delta)
  };
  divergenceExamples: Array<{
    context: object;
    intensityA: number;
    intensityB: number;
    absDiff: number;
  }>;
}
```

## Acceptance Criteria

### Tests That Must Pass ✅

All tests pass (34 total):

```javascript
// Constructor validation (8 tests)
✅ creates instance with valid dependencies
✅ throws when logger is missing
✅ throws when prototypeIntensityCalculator is missing computeIntensity
✅ throws when randomStateGenerator is missing generate
✅ throws when contextBuilder is missing buildContext
✅ throws when prototypeGateChecker is missing checkAllGatesPass
✅ throws when config is missing required keys
✅ throws when config is null

// Gate overlap stats (4 tests)
✅ returns onBothRate == onEitherRate for identical gates
✅ returns onBothRate == 0 for completely disjoint gates
✅ computes correct pOnlyRate and qOnlyRate
✅ returns correct qOnlyRate when only B passes

// Intensity similarity (5 tests)
✅ returns correlation ~1 for identical prototypes
✅ returns meanAbsDiff ~0 for identical prototypes
✅ computes dominanceP correctly when A always higher
✅ computes dominanceQ correctly when B always higher
✅ returns NaN correlation for no joint samples

// Divergence examples (3 tests)
✅ selects top K examples by absDiff
✅ includes context, intensityA, intensityB, absDiff in examples
✅ produces stable examples with same random seed

// Progress callback (2 tests)
✅ invokes onProgress during sampling
✅ passes completed count and total to onProgress

// Invariants (5 tests)
✅ all rates are in [0, 1]
✅ correlation is in [-1, 1] or NaN
✅ meanAbsDiff >= 0 or NaN
✅ divergenceExamples.length <= config.divergenceExamplesK
✅ for each example: absDiff === |intensityA - intensityB|

// Edge cases (7 tests)
✅ handles zero sample count by using default from config
✅ handles negative sample count by using default from config
✅ handles prototype with no gates
✅ handles prototype with no weights
✅ handles null onProgress callback gracefully
✅ handles divergenceExamplesK of 0
✅ computes complete metrics for varied prototype behaviors
```

### Invariants ✅

- All rates in [0, 1] ✅
- Correlation in [-1, 1] or NaN ✅
- `meanAbsDiff >= 0` or NaN ✅
- `divergenceExamples.length <= config.divergenceExamplesK` ✅
- For each example: `absDiff === |intensityA - intensityB|` ✅
- Uses ONLY existing services for intensity/gate evaluation (no custom math) ✅
- ESLint passes (no errors) ✅

## Verification Commands

```bash
npm run test:unit -- --testPathPatterns="behavioralOverlapEvaluator"
npx eslint src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
```

## Dependencies

- PROOVEANA-000 (config) ✅

## Outcome

### Coverage Results
- **Statements**: 100%
- **Branches**: 90.9% (meets >90% requirement)
- **Functions**: 100%
- **Lines**: 100%

### Actual Diff Size
- Source: ~435 lines
- Tests: ~1040 lines
- **Total: ~1475 lines**

### Implementation Highlights
- Efficient top-K divergence tracking using min-heap
- Pearson correlation with degenerate case handling (NaN for constant values)
- Progress callback at 100-sample intervals
- Defensive handling of missing gates/weights properties
- Complete JSDoc documentation
