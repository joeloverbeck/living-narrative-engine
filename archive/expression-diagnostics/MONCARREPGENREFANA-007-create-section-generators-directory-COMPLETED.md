# MONCARREPGENREFANA-007: Create sectionGenerators Directory Structure

## Summary

Create the directory structure and barrel export for section generators. This establishes the foundation for extracting the 4 section generator modules without changing behavior.

## Priority: Medium | Effort: Low | Risk: LOW

## Status

Completed

## Rationale

Before extracting section generators, we need:
- Directory structure in place
- Index file for exports
- Clear organization for the 4 section generator modules

No base class is required at this stage; that can be introduced only if shared patterns emerge later.

## Assumptions Check (from `reports/monteCarloReportGenerator-refactoring-analysis.md`)

- ✅ Baseline snapshot and worker integration tests already exist in `tests/integration/expression-diagnostics/`, so this ticket does not need to add new test files.
- ✅ Foundational services (ReportFormattingService, WitnessFormatter, StatisticalComputationService, ReportDataExtractor, BlockerTreeTraversal, ReportIntegrityAnalyzer) already exist in `src/expressionDiagnostics/services/` and are not part of this change.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/sectionGenerators/` | **Create** - Directory |
| `src/expressionDiagnostics/services/sectionGenerators/index.js` | **Create** - Export barrel |

## Out of Scope (unchanged)

- **DO NOT** create any section generator implementations (that's 008-011)
- **DO NOT** change MonteCarloReportGenerator.js yet
- **DO NOT** change MonteCarloReportWorker.js yet
- **DO NOT** create test files (they come with each generator)
- **DO NOT** modify DI registrations

## Implementation Details

### Directory Structure

```
src/expressionDiagnostics/services/
├── sectionGenerators/
│   └── index.js
├── ReportFormattingService.js
├── WitnessFormatter.js
├── StatisticalComputationService.js
├── ReportDataExtractor.js
├── BlockerTreeTraversal.js
├── ReportIntegrityAnalyzer.js
└── MonteCarloReportGenerator.js
```

### Index File (Placeholder)

```javascript
/**
 * @file Section generator exports for Monte Carlo reports
 *
 * This barrel exports all section generator classes used by
 * MonteCarloReportGenerator to produce report sections.
 */

// Section generators will be added as they are extracted:
// export { default as PrototypeSectionGenerator } from './PrototypeSectionGenerator.js';
// export { default as SensitivitySectionGenerator } from './SensitivitySectionGenerator.js';
// export { default as BlockerSectionGenerator } from './BlockerSectionGenerator.js';
// export { default as CoreSectionGenerator } from './CoreSectionGenerator.js';

// Placeholder export until generators are added
export const SECTION_GENERATORS_VERSION = '1.0.0';
```

## Acceptance Criteria

### Tests That Must Pass

1. **All existing tests unchanged:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/ --verbose
   npm run test:integration -- tests/integration/expression-diagnostics/ --verbose
   ```

2. **Snapshot test unchanged (already present in repo):**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

### Invariants That Must Remain True

1. **No behavior changes**: This is purely structural preparation
2. **Import paths ready**: Directory structure matches planned file locations
3. **Index ready for exports**: Placeholder structure supports future additions

## Verification Commands

```bash
# Verify directory created
ls -la src/expressionDiagnostics/services/sectionGenerators/

# Verify index file exists
cat src/expressionDiagnostics/services/sectionGenerators/index.js

# Verify all tests still pass
npm run test:unit -- tests/unit/expressionDiagnostics/ --verbose

# Lint new files
npx eslint src/expressionDiagnostics/services/sectionGenerators/
```

## Definition of Done

- [x] sectionGenerators directory created
- [x] index.js created with placeholder exports
- [x] All existing tests pass
- [x] Snapshot test passes unchanged
- [x] ESLint passes on new files

## Dependencies

- **Requires**: None (foundational services already present in repo)
- **Blocks**: MONCARREPGENREFANA-008, 009, 010, 011 (section generators)

## Notes

- This is a minimal structural ticket
- No behavior changes - purely preparation
- Quick to implement and verify

## Outcome

Created `src/expressionDiagnostics/services/sectionGenerators/` with a placeholder barrel export. No generator implementations or DI changes were made, matching the intended scope.
