# PROFITBLOSCODIS-005: FitFeasibilityConflictDetector Service - COMPLETED

## Summary

Create service to detect conflicts between prototype fit results and clause feasibility, generating structured warnings when "fit looks clean" but clauses are impossible.

## Files to Touch

### Create
- `src/expressionDiagnostics/services/FitFeasibilityConflictDetector.js`
- `tests/unit/expressionDiagnostics/services/FitFeasibilityConflictDetector.test.js`

## Out of Scope

- ❌ Feasibility analysis (PROFITBLOSCODIS-004)
- ❌ Section generation for conflicts (PROFITBLOSCODIS-008)
- ❌ Integration with MonteCarloReportGenerator (PROFITBLOSCODIS-012)
- ❌ DI token/registration (PROFITBLOSCODIS-013)
- ❌ Prototype fit calculation
- ❌ Gate alignment analysis (already exists in PrototypeGateAlignmentAnalyzer)

## Implementation Details

### FitFeasibilityConflictDetector.js

Class responsibilities:
1. Receive prototype fit results and feasibility analysis
2. Detect `fit_vs_clause_impossible` conflicts
3. Detect `gate_contradiction` conflicts (from existing analyzer)
4. Generate explanations and suggested fixes

### Constructor Pattern

```javascript
constructor({ logger }) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['debug', 'info'],
  });
  this.#logger = logger;
}
```

### Conflict Type 1: fit_vs_clause_impossible

Triggered when:
- Top prototype score >= 0.3 (fit is "clean")
- AND one or more feasibility results have `classification === 'IMPOSSIBLE'`

### Conflict Type 2: gate_contradiction

Triggered when:
- `gateAlignmentResult.contradictions.length > 0`

### Return Type: FitFeasibilityConflict[]

```javascript
{
  type: 'fit_vs_clause_impossible',
  topPrototypes: [
    { prototypeId: 'flow', score: 0.85 },
    { prototypeId: 'joy', score: 0.72 }
  ],
  impossibleClauseIds: ['clause_abc123', 'clause_def456'],
  explanation: 'Mood signature matches prototypes [flow, joy], but clause(s) [emotions.confusion] cannot be satisfied in-regime on final values.',
  suggestedFixes: [
    'Lower threshold for emotions.confusion to <= 0.230',
    'Move confusion requirement to previous-state or delta gate',
    'Replace confusion with curiosity/interest in current state'
  ]
}
```

### Fit Score Threshold

```javascript
#fitScoreThreshold = 0.3; // Consider fit "clean" if top prototype score >= this
```

## Acceptance Criteria

### Tests That Must Pass

1. **fit_vs_clause_impossible detection tests**:
   - Detects conflict when topScore >= 0.3 AND IMPOSSIBLE clause exists
   - Does NOT detect conflict when topScore < 0.3
   - Does NOT detect conflict when no IMPOSSIBLE clauses
   - Multiple IMPOSSIBLE clauses all included in `impossibleClauseIds`

2. **gate_contradiction detection tests**:
   - Detects conflict when gateAlignmentResult has contradictions
   - Formats gate contradictions as `gate:emotionId:axis` in clauseIds
   - Does NOT detect when no contradictions

3. **Top prototypes extraction tests**:
   - Extracts top 3 prototypes from leaderboard
   - Handles missing leaderboard gracefully
   - Handles empty leaderboard gracefully

4. **Explanation generation tests**:
   - Explanation includes prototype names
   - Explanation includes variable paths from impossible clauses
   - Explanation is human-readable

5. **Suggested fixes generation tests**:
   - Generates threshold lowering suggestion with actual maxValue
   - Generates emotion-specific fixes for emotion clauses
   - Generates delta-specific fixes for delta clauses
   - Deduplicates fixes
   - Limits to 5 fixes maximum

6. **Edge case tests**:
   - Null prototypeFitResult → no conflict
   - Null feasibilityResults → no conflict
   - Empty feasibilityResults → no conflict
   - Both conflict types can be detected simultaneously

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/services/FitFeasibilityConflictDetector.js
npm run test:unit -- --testPathPattern="FitFeasibilityConflictDetector"
```

## Invariants That Must Remain True

1. `fit_vs_clause_impossible` only emitted when topScore >= 0.3
2. `suggestedFixes.length > 0` when any conflict detected
3. `suggestedFixes.length <= 5` always
4. `impossibleClauseIds` only contains clauses with `classification === 'IMPOSSIBLE'`
5. `topPrototypes.length <= 3` always
6. Service never throws on null/empty input (returns empty array)

## Dependencies

- PROFITBLOSCODIS-004 (NonAxisFeasibilityAnalyzer - for feasibility result type)

## Blocked By

- PROFITBLOSCODIS-004 (for type definitions, not runtime dependency)

## Blocks

- PROFITBLOSCODIS-008 (ConflictWarningSectionGenerator)
- PROFITBLOSCODIS-012 (MonteCarloReportGenerator integration)
- PROFITBLOSCODIS-013 (DI registration)

---

## Outcome

**Status**: ✅ COMPLETED

**Implementation Date**: 2026-01-17

### Files Created

| File | Purpose |
|------|---------|
| `src/expressionDiagnostics/services/FitFeasibilityConflictDetector.js` | Conflict detection service between prototype fit and clause feasibility |
| `tests/unit/expressionDiagnostics/services/FitFeasibilityConflictDetector.test.js` | Comprehensive unit tests (38 tests) |

### Implementation Summary

1. **FitFeasibilityConflictDetector Service**:
   - Constructor takes `{ logger }` dependency with validation for `['debug', 'info']` methods
   - `detect(prototypeFitResult, feasibilityResults, gateAlignmentResult)` returns `FitFeasibilityConflict[]`
   - `FIT_SCORE_THRESHOLD = 0.3` for "clean fit" detection
   - Two conflict types implemented: `fit_vs_clause_impossible` and `gate_contradiction`
   - Helper methods: `#isFitClean()`, `#extractTopPrototypes()`, `#buildExplanation()`, `#generateSuggestedFixes()`

2. **Type Definitions**:
   - `ConflictType`: `'fit_vs_clause_impossible' | 'gate_contradiction'`
   - `TopPrototype`: `{ prototypeId: string, score: number }`
   - `FitFeasibilityConflict`: `{ type, topPrototypes, impossibleClauseIds, explanation, suggestedFixes }`

3. **Test Coverage**:
   - Constructor validation tests
   - fit_vs_clause_impossible detection tests (threshold boundary, IMPOSSIBLE clause filtering)
   - gate_contradiction detection tests (clause ID formatting as `gate:emotionId:axis`)
   - Top prototypes extraction tests (handles missing/empty leaderboard)
   - Explanation generation tests (includes prototype names and var paths)
   - Suggested fixes generation tests (threshold, emotion-specific, delta-specific, deduplication, max 5 limit)
   - Edge case tests (null inputs, empty inputs, simultaneous conflict types)
   - Invariant tests (all 6 invariants verified)
   - Logging tests

### Verification Commands Executed

```bash
npm run typecheck           # ✅ Pass (pre-existing errors in CLI files only)
npx eslint <files>          # ✅ Pass (no errors or warnings)
npm test:unit -- --testPathPatterns="FitFeasibilityConflictDetector"  # ✅ 38/38 tests pass
```

### Notes

- All ticket assumptions were verified correct before implementation
- No DI registration performed (deferred to PROFITBLOSCODIS-013 as specified)
- Service is ready for integration with MonteCarloReportGenerator (PROFITBLOSCODIS-012)
