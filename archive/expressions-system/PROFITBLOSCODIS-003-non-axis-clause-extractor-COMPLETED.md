# PROFITBLOSCODIS-003: NonAxisClauseExtractor Service

**Status**: ✅ COMPLETED

## Summary

Create service to extract non-axis atomic clauses (emotions, sexual states, deltas) from expression prerequisites for feasibility analysis.

## Files to Touch

### Create
- `src/expressionDiagnostics/services/NonAxisClauseExtractor.js`
- `tests/unit/expressionDiagnostics/services/NonAxisClauseExtractor.test.js`

## Out of Scope

- ❌ Feasibility analysis (passRate, maxValue calculation) - PROFITBLOSCODIS-004
- ❌ ClauseId generation (hash computation) - PROFITBLOSCODIS-004
- ❌ Integration with MonteCarloReportGenerator - PROFITBLOSCODIS-012
- ❌ DI token/registration - PROFITBLOSCODIS-013
- ❌ Report section generation
- ❌ Axis constraint extraction (already in moodRegimeUtils.js)

## Implementation Details

### NonAxisClauseExtractor.js

Class responsibilities:
1. Traverse JSON Logic prerequisite trees
2. Extract comparison clauses (`>=`, `>`, `<=`, `<`, `==`, `!=`)
3. Identify non-axis variable paths (emotions.*, sexualStates.*, deltas)
4. Exclude axis paths (moodAxes.*, mood.*, sexualAxes.*, affectTraits.*)
5. Handle delta patterns `{ "-": [current, previous] }`
6. Return normalized clause objects

### Extracted Clause Structure

```javascript
{
  varPath: 'emotions.confusion',      // Normalized variable path
  operator: '>=',                      // Comparison operator
  threshold: 0.25,                     // Threshold value
  isDelta: false,                      // Whether this is a delta clause
  sourcePath: 'prereqs[0].and[1]',    // Path in original prerequisites
  clauseType: 'emotion'               // 'emotion' | 'sexual' | 'delta' | 'other'
}
```

### Axis Exclusion Patterns

Must NOT extract clauses with these variable path prefixes:
- `moodAxes.*`
- `mood.*` (alias for moodAxes)
- `sexualAxes.*`
- `affectTraits.*`

### Constructor Pattern

```javascript
constructor({ logger }) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['debug', 'warn'],
  });
  this.#logger = logger;
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Basic extraction tests**:
   - Extracts `emotions.*` comparison clauses
   - Extracts `sexualStates.*` comparison clauses
   - Extracts `previousEmotions.*` clauses
   - Extracts `previousSexualStates.*` clauses

2. **Axis exclusion tests**:
   - Does NOT extract `moodAxes.*` clauses
   - Does NOT extract `mood.*` clauses
   - Does NOT extract `sexualAxes.*` clauses
   - Does NOT extract `affectTraits.*` clauses

3. **Delta pattern tests**:
   - Extracts delta pattern `{ "-": [{ var: "current" }, { var: "previous" }] }`
   - Sets `isDelta: true` for delta clauses
   - Sets `clauseType: 'delta'` for delta clauses

4. **Operator handling tests**:
   - Handles `>=` operator
   - Handles `>` operator
   - Handles `<=` operator
   - Handles `<` operator
   - Handles `==` operator

5. **Compound logic traversal tests**:
   - Traverses `and` arrays
   - Traverses `or` arrays
   - Handles nested compound logic

6. **Edge case tests**:
   - Returns empty array for empty prerequisites
   - Returns empty array for axis-only prerequisites
   - Handles null/undefined prerequisites gracefully
   - Handles malformed logic nodes without crashing

7. **Classification tests**:
   - `emotions.confusion` → `clauseType: 'emotion'`
   - `sexualStates.arousal` → `clauseType: 'sexual'`
   - Delta pattern → `clauseType: 'delta'`

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/services/NonAxisClauseExtractor.js
npm run test:unit -- --testPathPatterns="NonAxisClauseExtractor"
```

## Invariants That Must Remain True

1. `emotions.*` variables classified as `clauseType: 'emotion'`
2. `moodAxes.*` variables NEVER extracted
3. Delta patterns yield `isDelta: true`
4. `sourcePath` accurately reflects position in original prerequisites
5. Empty prerequisites → empty result array (not null)
6. Service never throws on malformed input (logs warning instead)

## Dependencies

- None (can be developed in parallel with models)

## Blocked By

- None

## Blocks

- PROFITBLOSCODIS-004 (NonAxisFeasibilityAnalyzer)
- PROFITBLOSCODIS-012 (MonteCarloReportGenerator integration)
- PROFITBLOSCODIS-013 (DI registration)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned Changes:**
- Create `src/expressionDiagnostics/services/NonAxisClauseExtractor.js`
- Create `tests/unit/expressionDiagnostics/services/NonAxisClauseExtractor.test.js`

**Actual Changes:**
- ✅ Created `src/expressionDiagnostics/services/NonAxisClauseExtractor.js` (279 lines)
- ✅ Created `tests/unit/expressionDiagnostics/services/NonAxisClauseExtractor.test.js` (44 tests)

### Assumption Verification

All ticket assumptions were verified against the existing codebase:

1. ✅ `moodRegimeUtils.js` exists and handles axis constraint extraction
2. ✅ `AnalysisScopeMetadata.js` exists (from prior ticket PROFITBLOSCODIS-001)
3. ✅ `scopeMetadataRenderer.js` exists (from prior ticket PROFITBLOSCODIS-002)
4. ✅ Constructor pattern matches existing services (validateDependency with requiredMethods)

**No ticket corrections were necessary** - all assumptions matched the actual codebase.

### Test Coverage

- **44 tests** covering all acceptance criteria
- **98.48%** statement coverage
- **95.08%** branch coverage
- **100%** function coverage
- **98.55%** line coverage

### Validation Commands

```bash
# All passed:
npm run test:unit -- --testPathPatterns="NonAxisClauseExtractor"  # 44/44 tests pass
npx eslint src/expressionDiagnostics/services/NonAxisClauseExtractor.js  # No errors
npm run typecheck  # Pre-existing errors only, none from this implementation
```

### Implementation Notes

The service follows the exact structure specified in the ticket:
- Private `#logger` field with dependency validation
- `extract(prerequisites)` public method returning `ExtractedClause[]`
- Recursive `#traverseLogic()` for JSON Logic tree traversal
- `#extractComparison()` for clause detail extraction
- Helper methods: `#isVarNode()`, `#isDeltaNode()`, `#isNonAxisClause()`, `#classifyClauseType()`, `#canonicalizeVarPath()`
- Proper handling of all comparison operators (`>=`, `>`, `<=`, `<`, `==`, `!=`)
- Delta pattern support with correct `isDelta` and `clauseType` classification
- Graceful handling of malformed input with debug logging
