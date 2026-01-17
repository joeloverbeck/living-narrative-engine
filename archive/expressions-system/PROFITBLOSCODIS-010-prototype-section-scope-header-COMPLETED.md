# PROFITBLOSCODIS-010: PrototypeSectionGenerator Scope Metadata Update

**Status**: ✅ COMPLETED

## Summary

Add scope metadata header to the existing PrototypeSectionGenerator to clearly label that prototype fit analysis uses axis-only constraints.

## Outcome

### What Was Changed vs Originally Planned

**Ticket Corrections Made** (before implementation):
1. Fixed test file path from `tests/unit/expressionDiagnostics/sectionGenerators/` to `tests/unit/expressionDiagnostics/services/sectionGenerators/` (missing "services" folder)
2. Updated expected output format to reflect actual code uses `## 🎯 Prototype Fit Analysis` (H2 with emoji), not H3
3. Added note that code uses template strings, not line arrays

**Implementation** (minimal changes as planned):
1. Added 2 imports to `PrototypeSectionGenerator.js`:
   - `import { SCOPE_METADATA } from '../../models/AnalysisScopeMetadata.js';`
   - `import { renderScopeMetadataHeader } from '../../utils/scopeMetadataRenderer.js';`
2. Added ~4 lines to `generatePrototypeFitSection()` to insert scope header after description and before table

**Tests Added**:
- 4 new tests in `describe('scope metadata header')` block:
  - `contains [AXIS-ONLY FIT] badge in prototype fit section`
  - `contains [IN-REGIME] badge in prototype fit section`
  - `contains scope description about axis constraints`
  - `positions scope header after section description and before table`
- Added `createMinimalFitResult()` helper function

**All Tests Pass**: ✅

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/sectionGenerators/PrototypeSectionGenerator.js`
- `tests/unit/expressionDiagnostics/services/sectionGenerators/prototypeSectionGenerator.test.js`

## Out of Scope

- ❌ BlockerSectionGenerator updates (PROFITBLOSCODIS-011)
- ❌ Changes to prototype fit calculation logic
- ❌ Changes to prototype leaderboard logic
- ❌ Changes to gap detection logic
- ❌ Any new section generators
- ❌ DI token/registration changes

## Implementation Details

### Changes to PrototypeSectionGenerator.js

1. Add imports at top of file:

```javascript
import { SCOPE_METADATA } from '../../models/AnalysisScopeMetadata.js';
import { renderScopeMetadataHeader } from '../../utils/scopeMetadataRenderer.js';
```

2. Modify `generatePrototypeFitSection()` method to include scope header after the section title and description:

**NOTE**: The actual section uses `## 🎯 Prototype Fit Analysis` (H2 with emoji) not H3.
The section uses template strings, not line arrays. The scope header should be inserted
after the introductory description and before the leaderboard table.

```javascript
// Insert renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT) + '\n'
// after the description "Ranking of ... prototypes by how well they fit..."
// and before the warning/population labels and table.
```

### Expected Output Change

Before:
```markdown
## 🎯 Prototype Fit Analysis

Ranking of emotion prototypes by how well they fit this expression's mood regime.

| Rank | Prototype | ...
```

After:
```markdown
## 🎯 Prototype Fit Analysis

Ranking of emotion prototypes by how well they fit this expression's mood regime.

> **[AXIS-ONLY FIT]** **[IN-REGIME]**
> *Computed from mood-regime axis constraints only (emotion clauses not enforced).*

| Rank | Prototype | ...
```

### Minimal Change Principle

This ticket should make the MINIMUM changes necessary to add the scope header. No refactoring, no other modifications.

## Acceptance Criteria

### Tests That Must Pass

1. **Scope header presence tests**:
   - Prototype fit section contains `[AXIS-ONLY FIT]` badge
   - Prototype fit section contains `[IN-REGIME]` badge
   - Prototype fit section contains description about axis constraints

2. **Existing functionality tests**:
   - All existing PrototypeSectionGenerator tests still pass
   - Prototype leaderboard still renders correctly
   - Gap detection still renders correctly
   - Implied prototype section still renders correctly

3. **Import verification tests**:
   - Can import SCOPE_METADATA from models
   - Can import renderScopeMetadataHeader from utils

4. **Output position tests**:
   - Scope header appears immediately after section heading
   - Scope header appears before any analysis content

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/services/sectionGenerators/PrototypeSectionGenerator.js
npm run test:unit -- --testPathPattern="prototypeSectionGenerator"
```

## Invariants That Must Remain True

1. Output MUST contain `[AXIS-ONLY FIT]` when prototype fit section is generated
2. No changes to prototype fit calculation logic
3. No changes to prototype score computation
4. No changes to leaderboard generation
5. All existing tests continue to pass without modification to test expectations (except adding scope header checks)

## Dependencies

- PROFITBLOSCODIS-001 (AnalysisScopeMetadata)
- PROFITBLOSCODIS-002 (scopeMetadataRenderer)

## Blocked By

- PROFITBLOSCODIS-001, PROFITBLOSCODIS-002

## Blocks

- PROFITBLOSCODIS-012 (MonteCarloReportGenerator integration - can proceed without this, but should be complete for full feature)
