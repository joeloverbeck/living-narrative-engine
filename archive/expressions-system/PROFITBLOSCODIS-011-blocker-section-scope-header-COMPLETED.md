# PROFITBLOSCODIS-011: BlockerSectionGenerator Scope Metadata Update

## Summary

Add scope metadata header to the existing BlockerSectionGenerator to clearly label that blocker analysis uses full prerequisites with global population (showing both global and in-regime failure rates in combined metrics).

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js`
- `tests/unit/expressionDiagnostics/services/sectionGenerators/blockerSectionGenerator.test.js`

## Out of Scope

- ❌ PrototypeSectionGenerator updates (PROFITBLOSCODIS-010)
- ❌ Changes to blocker analysis logic
- ❌ Changes to compound node handling
- ❌ Changes to distribution calculations
- ❌ Any new section generators
- ❌ DI token/registration changes

## Implementation Details

### Actual Architecture (Corrected from original assumptions)

The actual implementation has:
- **Single section**: `## Blocker Analysis` (not separate population sections)
- **Combined metrics**: Each blocker shows BOTH `Fail% global` and `Fail% | mood-pass` together
- **One heading**: No `### Blocker Analysis (In-Regime)` or `### Blocker Analysis (Global)` subsections exist

### Changes to BlockerSectionGenerator.js

1. Add imports at top of file:

```javascript
import { SCOPE_METADATA } from '../../models/AnalysisScopeMetadata.js';
import { renderScopeMetadataHeader } from '../../utils/scopeMetadataRenderer.js';
```

2. Modify `generateBlockerAnalysis()` return statement to include scope header:

```javascript
const scopeHeader = renderScopeMetadataHeader(SCOPE_METADATA.BLOCKER_GLOBAL);

return `## Blocker Analysis
Signal: final (gate-clamped intensity).

${scopeHeader}
${probabilityFunnel}

${blockerSections.join('\n')}
${note}`;
```

### Expected Output

Before:
```markdown
## Blocker Analysis
Signal: final (gate-clamped intensity).

### Probability Funnel
...
```

After:
```markdown
## Blocker Analysis
Signal: final (gate-clamped intensity).

> **[FULL PREREQS]** **[GLOBAL]**
> *Computed from ALL prerequisites using post-gate (final) values.*

### Probability Funnel
...
```

Note: The "GLOBAL" badge is appropriate because the primary failure rates are global (all samples), with in-regime rates shown as supplementary info (`Fail% | mood-pass`).

### Minimal Change Principle

This ticket should make the MINIMUM changes necessary to add the scope header. No refactoring, no other modifications.

## Acceptance Criteria

### Tests That Must Pass

1. **Scope header tests**:
   - Blocker section contains `[FULL PREREQS]` badge
   - Blocker section contains `[GLOBAL]` badge
   - Section contains description about post-gate values

2. **Existing functionality tests**:
   - All existing BlockerSectionGenerator tests still pass
   - Compound node rendering still works
   - Distribution tables still render correctly
   - Worst offenders section still works

3. **Import verification tests**:
   - Can import SCOPE_METADATA from models
   - Can import renderScopeMetadataHeader from utils

4. **Output position tests**:
   - Scope header appears after Signal line
   - Scope header appears before Probability Funnel

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js
npm run test:unit -- --testPathPattern="blockerSectionGenerator"
```

## Invariants That Must Remain True

1. Blocker section MUST contain `[FULL PREREQS]` and `[GLOBAL]`
2. No changes to blocker analysis calculation logic
3. No changes to compound node traversal
4. No changes to distribution computation
5. All existing tests continue to pass

## Dependencies

- PROFITBLOSCODIS-001 (AnalysisScopeMetadata)
- PROFITBLOSCODIS-002 (scopeMetadataRenderer)

## Blocked By

- PROFITBLOSCODIS-001, PROFITBLOSCODIS-002

## Blocks

- PROFITBLOSCODIS-012 (MonteCarloReportGenerator integration - can proceed without this, but should be complete for full feature)
