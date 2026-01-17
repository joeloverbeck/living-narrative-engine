# PROFITBLOSCODIS-002: Scope Metadata Renderer Utility

## Status: ✅ COMPLETED

## Summary

Create utility function to render scope metadata as markdown header badges for Monte Carlo report sections.

## Files to Touch

### Create
- `src/expressionDiagnostics/utils/scopeMetadataRenderer.js` ✅
- `tests/unit/expressionDiagnostics/utils/scopeMetadataRenderer.test.js` ✅

## Out of Scope

- ❌ Integration with any section generators (PROFITBLOSCODIS-009, 010, 011)
- ❌ CSS styling concerns
- ❌ Any data model changes
- ❌ Any non-rendering logic
- ❌ HTML rendering (markdown only)

## Implementation Details

### scopeMetadataRenderer.js

```javascript
import { SCOPE_METADATA } from '../models/AnalysisScopeMetadata.js';

/**
 * Render scope metadata as markdown header.
 * @param {import('../models/AnalysisScopeMetadata.js').AnalysisScopeMetadata} metadata
 * @returns {string}
 */
export function renderScopeMetadataHeader(metadata) {
  const scopeBadge = getScopeBadge(metadata.scope);
  const populationBadge = getPopulationBadge(metadata.population);

  return [
    `> **[${scopeBadge}]** **[${populationBadge}]**`,
    `> *${metadata.description}*`,
    '',
  ].join('\n');
}

function getScopeBadge(scope) {
  switch (scope) {
    case 'axis_only': return 'AXIS-ONLY FIT';
    case 'full_prereqs': return 'FULL PREREQS';
    case 'non_axis_subset': return 'NON-AXIS ONLY';
    default: return scope.toUpperCase();
  }
}

function getPopulationBadge(population) {
  switch (population) {
    case 'in_regime': return 'IN-REGIME';
    case 'global': return 'GLOBAL';
    default: return population.toUpperCase();
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Badge rendering tests** (`scopeMetadataRenderer.test.js`):
   - `renderScopeMetadataHeader()` is exported ✅
   - Returns string containing scope badge ✅
   - Returns string containing population badge ✅
   - Returns string containing description ✅

2. **Scope badge mapping tests**:
   - `'axis_only'` → `'AXIS-ONLY FIT'` ✅
   - `'full_prereqs'` → `'FULL PREREQS'` ✅
   - `'non_axis_subset'` → `'NON-AXIS ONLY'` ✅
   - Unknown scope falls back to uppercase ✅

3. **Population badge mapping tests**:
   - `'in_regime'` → `'IN-REGIME'` ✅
   - `'global'` → `'GLOBAL'` ✅
   - Unknown population falls back to uppercase ✅

4. **Format verification tests**:
   - Output starts with `> **[` ✅
   - Output contains blockquote description line ✅
   - Output ends with empty line ✅

5. **Integration with SCOPE_METADATA constants**:
   - `renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT)` contains `[AXIS-ONLY FIT]` ✅
   - `renderScopeMetadataHeader(SCOPE_METADATA.BLOCKER_GLOBAL)` contains `[GLOBAL]` ✅
   - `renderScopeMetadataHeader(SCOPE_METADATA.NON_AXIS_FEASIBILITY)` contains `[NON-AXIS ONLY]` ✅

### Commands That Must Succeed

```bash
npm run typecheck  # ✅ Passes (pre-existing errors unrelated to this ticket)
npx eslint src/expressionDiagnostics/utils/scopeMetadataRenderer.js  # ✅ No errors/warnings
npm run test:unit -- --testPathPatterns="scopeMetadataRenderer"  # ✅ 31 tests passed
```

## Invariants That Must Remain True

1. Output format: `> **[BADGE]** **[POPULATION]**\n> *description*\n` ✅
2. Always returns a string (never null/undefined) ✅
3. Badge text is always uppercase ✅
4. Empty description still renders (just with empty italics) ✅
5. No HTML tags in output (markdown only) ✅

## Dependencies

- PROFITBLOSCODIS-001 (AnalysisScopeMetadata model) ✅

## Blocked By

- PROFITBLOSCODIS-001 ✅ (completed)

## Blocks

- PROFITBLOSCODIS-009 (NonAxisFeasibilitySectionGenerator)
- PROFITBLOSCODIS-010 (PrototypeSectionGenerator update)
- PROFITBLOSCODIS-011 (BlockerSectionGenerator update)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Fully aligned with plan:**
- Created `src/expressionDiagnostics/utils/scopeMetadataRenderer.js` with the exact API specified
- Created `tests/unit/expressionDiagnostics/utils/scopeMetadataRenderer.test.js` with comprehensive coverage

**Minor adjustments:**
- Added blank lines in JSDoc comments to satisfy `jsdoc/tag-lines` lint rule
- Test file includes additional invariant tests beyond the minimum required (31 total tests)

### Files Created

1. **`src/expressionDiagnostics/utils/scopeMetadataRenderer.js`** (70 lines)
   - Exports `renderScopeMetadataHeader(metadata)` function
   - Internal helpers `getScopeBadge()` and `getPopulationBadge()`
   - Full JSDoc type annotations referencing `AnalysisScopeMetadataEntry`

2. **`tests/unit/expressionDiagnostics/utils/scopeMetadataRenderer.test.js`** (144 lines)
   - 31 test cases covering all acceptance criteria
   - Tests for export verification, badge mapping, format verification, SCOPE_METADATA integration, and invariants

### Test Results

```
PASS tests/unit/expressionDiagnostics/utils/scopeMetadataRenderer.test.js
Tests:       31 passed, 31 total
```
