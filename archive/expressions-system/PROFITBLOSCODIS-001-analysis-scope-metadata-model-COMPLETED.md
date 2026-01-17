# PROFITBLOSCODIS-001: AnalysisScopeMetadata Data Model

**Status**: ✅ COMPLETED

## Summary

Create the foundational data model for scope metadata types and constants used to label analysis sections in Monte Carlo reports.

## Files to Touch

### Create
- `src/expressionDiagnostics/models/AnalysisScopeMetadata.js`
- `tests/unit/expressionDiagnostics/models/AnalysisScopeMetadata.test.js`

### Modify
- `src/expressionDiagnostics/models/index.js` (add export)

## Out of Scope

- ❌ NonAxisClauseFeasibility model (PROFITBLOSCODIS-006)
- ❌ FitFeasibilityConflict model (PROFITBLOSCODIS-007)
- ❌ Any rendering/formatting logic (PROFITBLOSCODIS-002)
- ❌ Any service integration
- ❌ DI token or registration changes

## Implementation Details

### AnalysisScopeMetadata.js

```javascript
/**
 * @typedef {'axis_only' | 'full_prereqs' | 'non_axis_subset'} AnalysisScope
 */

/**
 * @typedef {'global' | 'in_regime'} PopulationType
 */

/**
 * @typedef {'raw' | 'final' | 'delta'} SignalType
 */

/**
 * @typedef {object} AnalysisScopeMetadata
 * @property {AnalysisScope} scope
 * @property {PopulationType} population
 * @property {SignalType} signal
 * @property {string} description - Human-readable explanation
 */

export const SCOPE_METADATA = Object.freeze({
  PROTOTYPE_FIT: Object.freeze({
    scope: 'axis_only',
    population: 'in_regime',
    signal: 'raw',
    description: 'Computed from mood-regime axis constraints only (emotion clauses not enforced).',
  }),
  BLOCKER_GLOBAL: Object.freeze({
    scope: 'full_prereqs',
    population: 'global',
    signal: 'final',
    description: 'Computed from ALL prerequisites using post-gate (final) values.',
  }),
  BLOCKER_IN_REGIME: Object.freeze({
    scope: 'full_prereqs',
    population: 'in_regime',
    signal: 'final',
    description: 'Computed from ALL prerequisites, restricted to mood-regime samples.',
  }),
  NON_AXIS_FEASIBILITY: Object.freeze({
    scope: 'non_axis_subset',
    population: 'in_regime',
    signal: 'final',
    description: 'Evaluates emotion/sexual/delta clauses within mood-regime using final values.',
  }),
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **Model structure tests** (`AnalysisScopeMetadata.test.js`):
   - `SCOPE_METADATA` constant is exported
   - Has exactly 4 entries: `PROTOTYPE_FIT`, `BLOCKER_GLOBAL`, `BLOCKER_IN_REGIME`, `NON_AXIS_FEASIBILITY`
   - Each entry has `scope`, `population`, `signal`, `description` properties
   - Object is frozen (immutable) - modifications throw in strict mode

2. **Value correctness tests**:
   - `PROTOTYPE_FIT.scope === 'axis_only'`
   - `PROTOTYPE_FIT.population === 'in_regime'`
   - `PROTOTYPE_FIT.signal === 'raw'`
   - `BLOCKER_GLOBAL.population === 'global'`
   - `BLOCKER_IN_REGIME.population === 'in_regime'`
   - `NON_AXIS_FEASIBILITY.scope === 'non_axis_subset'`
   - `NON_AXIS_FEASIBILITY.signal === 'final'`

3. **Export verification**:
   - Can import from `models/index.js`

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/models/AnalysisScopeMetadata.js
npm run test:unit -- --testPathPatterns="AnalysisScopeMetadata"
```

## Invariants That Must Remain True

1. `SCOPE_METADATA` object is deeply frozen (both outer object and inner entries)
2. `PROTOTYPE_FIT.scope === 'axis_only'` - This is the core semantic meaning
3. `BLOCKER_GLOBAL.population === 'global'` - Distinguishes from in-regime
4. `NON_AXIS_FEASIBILITY.signal === 'final'` - Must match gating pipeline output
5. All entries have non-empty `description` string

## Dependencies

- None (foundational ticket)

## Blocked By

- None

## Blocks

- PROFITBLOSCODIS-002 (scopeMetadataRenderer)
- PROFITBLOSCODIS-009 (NonAxisFeasibilitySectionGenerator)
- PROFITBLOSCODIS-010 (PrototypeSectionGenerator update)
- PROFITBLOSCODIS-011 (BlockerSectionGenerator update)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned**:
1. Create `src/expressionDiagnostics/models/AnalysisScopeMetadata.js`
2. Create `tests/unit/expressionDiagnostics/models/AnalysisScopeMetadata.test.js`
3. Modify `src/expressionDiagnostics/models/index.js` (add export)

**Actual Changes**:
All planned changes were implemented exactly as specified. No discrepancies were found between ticket assumptions and codebase patterns.

### Files Created
- `src/expressionDiagnostics/models/AnalysisScopeMetadata.js` - Core model with SCOPE_METADATA constant
- `tests/unit/expressionDiagnostics/models/AnalysisScopeMetadata.test.js` - Comprehensive test suite (51 tests)

### Files Modified
- `src/expressionDiagnostics/models/index.js` - Added barrel export for SCOPE_METADATA

### Test Coverage
- **51 tests** covering:
  - SCOPE_METADATA constant export and structure validation
  - Entry structure (scope, population, signal, description properties)
  - Immutability enforcement (frozen objects)
  - Value correctness for all 4 entries (PROTOTYPE_FIT, BLOCKER_GLOBAL, BLOCKER_IN_REGIME, NON_AXIS_FEASIBILITY)
  - Export verification via barrel export
  - Scope type value coverage
  - Population type value coverage
  - Signal type value coverage

### Verification
- ✅ All 51 unit tests pass
- ✅ All 714 model tests pass
- ✅ ESLint clean (0 errors, 0 warnings)
- ✅ TypeCheck passes
