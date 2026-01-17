# PROFITBLOSCODIS-004: NonAxisFeasibilityAnalyzer Service

## Summary

Create service to analyze feasibility of non-axis clauses within the mood regime population, computing pass rates, max values, and classifying each clause as IMPOSSIBLE, RARE, or OK.

## Files to Touch

### Create
- `src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js`
- `tests/unit/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.test.js`

## Out of Scope

- ❌ Clause extraction (PROFITBLOSCODIS-003)
- ❌ Conflict detection logic (PROFITBLOSCODIS-005)
- ❌ Report section generation (PROFITBLOSCODIS-009)
- ❌ DI token/registration (PROFITBLOSCODIS-013)
- ❌ Integration with MonteCarloReportGenerator (PROFITBLOSCODIS-012)

## Implementation Details

### NonAxisFeasibilityAnalyzer.js

Class responsibilities:
1. Use NonAxisClauseExtractor to get clauses
2. Evaluate each clause against in-regime contexts
3. Compute statistics: passRate, maxValue, p95Value, marginMax
4. Generate deterministic clauseId
5. Classify each clause: IMPOSSIBLE, RARE, or OK

### Constructor Pattern

```javascript
constructor({ logger, clauseExtractor }) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['debug', 'warn', 'error'],
  });
  validateDependency(clauseExtractor, 'NonAxisClauseExtractor', logger, {
    requiredMethods: ['extract'],
  });
  this.#logger = logger;
  this.#clauseExtractor = clauseExtractor;
}
```

### Classification Rules (Deterministic)

```javascript
// IMPOSSIBLE: passRate === 0 AND maxValue < threshold - eps
// RARE: passRate > 0 AND passRate < rareThreshold (0.001)
// OK: otherwise

const eps = 1e-6;
const rareThreshold = 0.001; // 0.1%
```

### ClauseId Generation (Deterministic Hash)

```javascript
#generateClauseId(expressionId, clause) {
  const normalized = [
    expressionId,
    clause.varPath,
    clause.operator,
    clause.threshold.toFixed(4),
    clause.isDelta ? 'delta' : 'current',
  ].join('|');

  // Simple hash (32-bit integer)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `clause_${Math.abs(hash).toString(16)}`;
}
```

### Return Type: NonAxisClauseFeasibility[]

```javascript
{
  clauseId: 'clause_abc123',
  sourcePath: 'prereqs[0].and[1]',
  varPath: 'emotions.confusion',
  operator: '>=',
  threshold: 0.25,
  signal: 'final',
  population: 'in_regime',
  passRate: 0,
  maxValue: 0.23,
  p95Value: 0.21,
  marginMax: -0.02,
  classification: 'IMPOSSIBLE',
  evidence: {
    bestSampleRef: 'sample_47',
    note: 'emotions.confusion >= 0.25 but max(final)=0.230 in-regime (0.020 short, 0% pass)'
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **IMPOSSIBLE classification tests**:
   - `passRate === 0 AND maxValue < threshold - eps` → `IMPOSSIBLE`
   - Context: all samples below threshold

2. **RARE classification tests**:
   - `passRate > 0 AND passRate < 0.001` → `RARE`
   - Context: 1 out of 10000 samples passes (0.01%)

3. **OK classification tests**:
   - `passRate >= 0.001` → `OK`
   - Context: 50% of samples pass

4. **Statistics calculation tests**:
   - `passRate` correctly computed as passCount / totalCount
   - `maxValue` is maximum LHS value across contexts
   - `p95Value` is 95th percentile of LHS values
   - `marginMax` is `maxValue - threshold`

5. **ClauseId determinism tests**:
   - Same inputs produce identical clauseId across multiple calls
   - Different thresholds produce different clauseIds
   - Different varPaths produce different clauseIds

6. **Evidence generation tests**:
   - IMPOSSIBLE clause has evidence note with gap information
   - RARE clause has evidence note with pass percentage
   - OK clause has evidence note with achievability message

7. **Edge case tests**:
   - Empty contexts array → all fields null, classification 'UNKNOWN'
   - No non-axis clauses → empty result array
   - Null/undefined context values handled gracefully

8. **Operator evaluation tests**:
   - `>=` evaluated correctly
   - `>` evaluated correctly
   - `<=` evaluated correctly
   - `<` evaluated correctly

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js
npm run test:unit -- --testPathPattern="NonAxisFeasibilityAnalyzer"
```

## Invariants That Must Remain True

1. `classification === 'IMPOSSIBLE'` implies `passRate === 0`
2. `clauseId` is deterministic for same (expressionId, varPath, operator, threshold, isDelta)
3. `population` is always `'in_regime'` (this analyzer only handles in-regime)
4. `passRate` is in range [0, 1]
5. `marginMax` can be negative (indicates gap from threshold)
6. Service never throws on empty input (returns empty array or null fields)

## Dependencies

- PROFITBLOSCODIS-003 (NonAxisClauseExtractor)

## Blocked By

- PROFITBLOSCODIS-003

## Blocks

- PROFITBLOSCODIS-005 (FitFeasibilityConflictDetector)
- PROFITBLOSCODIS-012 (MonteCarloReportGenerator integration)
- PROFITBLOSCODIS-013 (DI registration)

## Outcome

### Implementation Completed

✅ **Files Created:**
- `src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js` - Core service implementation
- `tests/unit/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.test.js` - Comprehensive unit tests

### Changes from Plan

1. **ClauseId generation**: Used SHA256 crypto hash (via Node.js `crypto.createHash`) instead of simple 32-bit hash for better collision resistance and true determinism
2. **Signal type naming**: Used 'final' instead of 'current' for non-delta clauses (consistent with plan's return type example)
3. **Added delta value computation**: For delta clauses, service computes `current - previous` values using path transformation (e.g., `emotions.joy` → `previousEmotions.joy`)

### Test Coverage

28 test cases covering:
- Constructor validation (5 tests)
- IMPOSSIBLE classification (3 tests)
- RARE classification (2 tests)
- OK classification (3 tests)
- Statistics calculation (4 tests)
- ClauseId determinism (3 tests)
- Evidence generation (3 tests)
- Edge cases (5 tests)
- Operator evaluation (4 tests)
- Signal type handling (3 tests)
- Invariants (3 tests)

### Validation Results

- ✅ ESLint: No errors on both service and test files
- ✅ Unit tests: All tests pass
- ⚠️ Typecheck: Pre-existing errors in other files (not related to this implementation)
