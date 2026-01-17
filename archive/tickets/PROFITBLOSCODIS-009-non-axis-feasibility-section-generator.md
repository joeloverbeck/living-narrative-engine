# PROFITBLOSCODIS-009: NonAxisFeasibilitySectionGenerator

## Summary

Create section generator for rendering non-axis clause feasibility results in Monte Carlo reports, including scope metadata header and classification table.

## Files to Touch

### Create
- `src/expressionDiagnostics/services/sectionGenerators/NonAxisFeasibilitySectionGenerator.js`
- `tests/unit/expressionDiagnostics/sectionGenerators/NonAxisFeasibilitySectionGenerator.test.js`

## Out of Scope

- ❌ Feasibility calculation logic (PROFITBLOSCODIS-004)
- ❌ Integration with MonteCarloReportGenerator (PROFITBLOSCODIS-012)
- ❌ DI token/registration (PROFITBLOSCODIS-013)
- ❌ Conflict detection (PROFITBLOSCODIS-005)

## Implementation Details

### NonAxisFeasibilitySectionGenerator.js

Class responsibilities:
1. Accept array of NonAxisClauseFeasibility results
2. Render scope metadata header (NON_AXIS_FEASIBILITY)
3. Generate classification table with all clause data
4. Add detailed breakdowns for IMPOSSIBLE and RARE clauses

### Constructor Pattern

```javascript
constructor({ logger }) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['debug'],
  });
  this.#logger = logger;
}
```

### generate() Method

```javascript
/**
 * Generate the Non-Axis Clause Feasibility section.
 * @param {NonAxisClauseFeasibility[]} feasibilityResults
 * @param {number} inRegimeSampleCount
 * @returns {string}
 */
generate(feasibilityResults, inRegimeSampleCount) {
  // ...
}
```

### Output Format

```markdown
### Non-Axis Clause Feasibility in Mood-Regime

> **[NON-AXIS ONLY]** **[IN-REGIME]**
> *Evaluates emotion/sexual/delta clauses within mood-regime using final values.*

**Population**: 10,000 samples in mood regime

| Clause | Pass Rate | Max Value | P95 | Margin | Classification |
|--------|-----------|-----------|-----|--------|----------------|
| `emotions.confusion >= 0.25` | 0.00% | 0.230 | 0.210 | -0.020 | ⛔ IMPOSSIBLE |
| `emotions.joy >= 0.3` | 45.23% | 0.850 | 0.720 | 0.550 | ✅ OK |

#### ⛔ Impossible Clauses (0% pass rate)

- **`clause_abc123`**: emotions.confusion >= 0.25 but max(final)=0.230 in-regime (0.020 short, 0% pass)

#### ⚠️ Rare Clauses (<0.1% pass rate)

- **`clause_def456`**: emotions.fear passes rarely (0.05% of in-regime samples)
```

### Classification Emojis

```javascript
#getClassificationEmoji(classification) {
  switch (classification) {
    case 'IMPOSSIBLE': return '⛔';
    case 'RARE': return '⚠️';
    case 'OK': return '✅';
    default: return '❓';
  }
}
```

### Number Formatting

- Pass Rate: percentage with 2 decimal places (e.g., "0.00%", "45.23%")
- Max/P95/Margin: 3 decimal places (e.g., "0.230")
- Sample count: locale string with commas (e.g., "10,000")

## Acceptance Criteria

### Tests That Must Pass

1. **Empty input tests**:
   - Empty/null feasibilityResults → message about no non-axis clauses found
   - Still renders section heading even with no data

2. **Scope metadata tests**:
   - Contains `[NON-AXIS ONLY]` badge
   - Contains `[IN-REGIME]` badge
   - Contains description about emotion/sexual/delta clauses

3. **Population display tests**:
   - Shows sample count with locale formatting
   - Uses "in mood regime" phrasing

4. **Table structure tests**:
   - Has exactly 6 columns: Clause, Pass Rate, Max Value, P95, Margin, Classification
   - Clause column shows operator and threshold
   - Values in code spans

5. **Classification emoji tests**:
   - IMPOSSIBLE → ⛔
   - RARE → ⚠️
   - OK → ✅
   - UNKNOWN → ❓

6. **Number formatting tests**:
   - Pass rate as percentage with 2 decimals
   - Max/P95/Margin with 3 decimals
   - Null values display as "N/A"

7. **Detailed breakdown tests**:
   - IMPOSSIBLE clauses get their own section with ⛔
   - RARE clauses get their own section with ⚠️
   - Each clause shows clauseId and evidence note
   - Sections omitted if no clauses of that type

8. **Edge case tests**:
   - All OK clauses → no detailed breakdown sections
   - Mix of classifications → multiple breakdown sections

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/services/sectionGenerators/NonAxisFeasibilitySectionGenerator.js
npm run test:unit -- --testPathPattern="NonAxisFeasibilitySectionGenerator"
```

## Invariants That Must Remain True

1. Always includes scope metadata header when results exist
2. Table has exactly 6 columns in consistent order
3. Classification emoji always precedes classification text
4. Null numeric values display as "N/A" (not empty or undefined)
5. Output is valid markdown table
6. Detailed breakdown only shown for non-OK classifications

## Dependencies

- PROFITBLOSCODIS-002 (scopeMetadataRenderer)
- PROFITBLOSCODIS-006 (NonAxisClauseFeasibility model for types)
- PROFITBLOSCODIS-001 (AnalysisScopeMetadata for SCOPE_METADATA constant)

## Blocked By

- PROFITBLOSCODIS-001, PROFITBLOSCODIS-002, PROFITBLOSCODIS-006

## Blocks

- PROFITBLOSCODIS-012 (MonteCarloReportGenerator integration)
- PROFITBLOSCODIS-013 (DI registration)
