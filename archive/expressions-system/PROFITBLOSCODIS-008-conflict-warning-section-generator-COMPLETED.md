# PROFITBLOSCODIS-008: ConflictWarningSectionGenerator

## Summary

Create section generator for rendering fit vs feasibility conflict warnings in Monte Carlo reports as markdown.

## Files to Touch

### Create
- `src/expressionDiagnostics/services/sectionGenerators/ConflictWarningSectionGenerator.js`
- `tests/unit/expressionDiagnostics/sectionGenerators/ConflictWarningSectionGenerator.test.js`

## Out of Scope

- ❌ Conflict detection logic (PROFITBLOSCODIS-005)
- ❌ Integration with MonteCarloReportGenerator (PROFITBLOSCODIS-012)
- ❌ DI token/registration (PROFITBLOSCODIS-013)
- ❌ Scope metadata rendering (this section doesn't need scope badges)

## Implementation Details

### ConflictWarningSectionGenerator.js

Class responsibilities:
1. Accept array of FitFeasibilityConflict objects
2. Generate markdown section with warnings
3. Format each conflict with type, explanation, prototypes, clause IDs, fixes

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
 * Generate conflict warnings section.
 * @param {FitFeasibilityConflict[]} conflicts
 * @returns {string}
 */
generate(conflicts) {
  if (!conflicts || conflicts.length === 0) {
    return '';
  }
  // ... generate markdown
}
```

### Output Format

```markdown
### ⚠️ Fit vs Feasibility Conflicts

> **Important**: These conflicts explain why "fit looks clean" can coexist with "impossible" blockers.
> Different analysis sections use different data scopes.

#### 🚨 Clean Fit but Impossible Clause

Mood signature matches prototypes [flow, joy], but clause(s) [emotions.confusion] cannot be satisfied in-regime on final values.

**Matching Prototypes**:
- flow: score 0.850
- joy: score 0.720

**Impossible Clauses**: `clause_abc123`, `clause_def456`

**Suggested Fixes**:
- Lower threshold for emotions.confusion to <= 0.230
- Move confusion requirement to previous-state or delta gate
```

### Conflict Type Labels

```javascript
#formatConflictType(type) {
  const labels = {
    'fit_vs_clause_impossible': 'Clean Fit but Impossible Clause',
    'gate_contradiction': 'Gate vs Regime Contradiction',
  };
  return labels[type] ?? type;
}
```

### Severity Emojis

- `fit_vs_clause_impossible` → 🚨 (critical)
- `gate_contradiction` → ⚠️ (warning)

## Acceptance Criteria

### Tests That Must Pass

1. **Empty input tests**:
   - Returns empty string for null conflicts
   - Returns empty string for empty array
   - Returns empty string for undefined conflicts

2. **Section header tests**:
   - Output starts with `### ⚠️ Fit vs Feasibility Conflicts`
   - Contains informational blockquote about scope differences

3. **Conflict type formatting tests**:
   - `fit_vs_clause_impossible` → `Clean Fit but Impossible Clause`
   - `gate_contradiction` → `Gate vs Regime Contradiction`
   - Unknown type renders as-is

4. **Severity emoji tests**:
   - `fit_vs_clause_impossible` has 🚨 emoji
   - `gate_contradiction` has ⚠️ emoji

5. **Content rendering tests**:
   - Explanation is rendered
   - Top prototypes rendered with scores (3 decimal places)
   - Impossible clause IDs rendered in code spans
   - Suggested fixes rendered as bullet list

6. **Multiple conflicts tests**:
   - Multiple conflicts all rendered
   - Each conflict has its own subheading

7. **Edge case tests**:
   - Conflict with empty topPrototypes → no "Matching Prototypes" section
   - Conflict with empty impossibleClauseIds → no "Impossible Clauses" section
   - Conflict with empty suggestedFixes → no "Suggested Fixes" section

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/services/sectionGenerators/ConflictWarningSectionGenerator.js
npm run test:unit -- --testPathPattern="ConflictWarningSectionGenerator"
```

## Invariants That Must Remain True

1. Returns empty string when no conflicts (not null/undefined)
2. Section header always uses ⚠️ emoji when conflicts exist
3. Each conflict gets its own #### subheading
4. Prototype scores formatted to 3 decimal places
5. Clause IDs wrapped in backticks (code spans)
6. Output is valid markdown

## Dependencies

- PROFITBLOSCODIS-007 (FitFeasibilityConflict model for types)

## Blocked By

- PROFITBLOSCODIS-007

## Blocks

- PROFITBLOSCODIS-012 (MonteCarloReportGenerator integration)
- PROFITBLOSCODIS-013 (DI registration)
