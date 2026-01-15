# MONCARREPGENREFANA-009: Extract SensitivitySectionGenerator

## Summary

Extract ~5 sensitivity analysis section generation methods from MonteCarloReportGenerator into a dedicated SensitivitySectionGenerator service. This handles global sensitivity analysis and sweep result sections.

## Priority: Medium | Effort: Medium | Risk: HIGHER

## Rationale

These methods:
- Handle sensitivity/sweep analysis sections
- Depend on ReportFormattingService plus sweep warning generation
- Generate complex multi-part sections
- Work with global sensitivity data structures

## Assumptions Reassessed (2026-01-15)

- `#selectKeyThresholdClauses()` is part of blocker analysis (probability funnel), not sensitivity sections.
- Sensitivity section methods do **not** use `ReportDataExtractor`; they only use formatting plus sweep warnings.
- `MonteCarloReportWorker.js` does not construct section generators directly; it instantiates `MonteCarloReportGenerator`, which owns them.
- `sectionGenerators/` already exists with `PrototypeSectionGenerator`; the new generator should follow that pattern.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js` | **Create** - New service (size depends on extracted methods) |
| `tests/unit/expressionDiagnostics/services/sectionGenerators/sensitivitySectionGenerator.test.js` | **Create** - Unit tests |
| `src/expressionDiagnostics/services/sectionGenerators/index.js` | **Modify** - Add export |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** - Remove methods, add service usage |

## Out of Scope

- **DO NOT** change other section generators
- **DO NOT** change ReportDataExtractor
- **DO NOT** change ReportFormattingService
- **DO NOT** change global sensitivity calculation logic (that's in SensitivityAnalyzer)
- **DO NOT** modify DI registrations

## Methods to Extract

```javascript
#generateGlobalSensitivitySection()
#generateSensitivityAnalysis()
#formatGlobalSensitivityResult()
#formatSensitivityResult()
#getSensitivityKindMetadata()
```

## Implementation Details

### Service Structure

```javascript
/**
 * @file SensitivitySectionGenerator - Generates sensitivity analysis report sections
 */

class SensitivitySectionGenerator {
  #formattingService;
  #sweepWarningBuilder;

  constructor({
    formattingService,
    sweepWarningBuilder = null,
  }) {
    if (!formattingService) {
      throw new Error('SensitivitySectionGenerator requires formattingService');
    }
    this.#formattingService = formattingService;
    this.#sweepWarningBuilder = sweepWarningBuilder;
  }

  /**
   * Generates the global sensitivity section.
   * @param {object} context - Report generation context
   * @returns {string} Markdown section
   */
  generateGlobalSensitivitySection(context) { /* ... */ }

  // ... other methods
}

export default SensitivitySectionGenerator;
```

### Integration Test Focus

No new integration test required; existing report snapshot integration tests cover sensitivity output.

## Acceptance Criteria

### Tests That Must Pass

1. **New SensitivitySectionGenerator unit tests:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/sectionGenerators/sensitivitySectionGenerator.test.js --verbose
   ```

2. **Existing sensitivity-related tests still pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --testNamePattern="sensitivity" --verbose
   ```

3. **Snapshot test unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

### Invariants That Must Remain True

1. **Report output identical**: Snapshot test must pass unchanged
2. **Section format unchanged**: Same markdown structure and tables
3. **Dependency injection**: Receives formattingService and sweepWarningBuilder
4. **Empty data handling**: Works correctly with empty sensitivityData

## Verification Commands

```bash
# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/sectionGenerators/sensitivitySectionGenerator.test.js --verbose

# Verify snapshot unchanged
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose

# Lint new files
npx eslint src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js
```

## Definition of Done

- [x] SensitivitySectionGenerator.js created with all 5 methods
- [x] Unit tests cover generator surface
- [x] sectionGenerators/index.js exports new class
- [x] MonteCarloReportGenerator.js uses new service
- [x] Snapshot test passes unchanged
- [x] Lines removed from MonteCarloReportGenerator.js match extracted methods

## Dependencies

- **Requires**: MONCARREPGENREFANA-007 (directory structure)
- **Requires**: MONCARREPGENREFANA-001 (ReportFormattingService)
- **Blocks**: MONCARREPGENREFANA-012 (factory needs all generators)

## Status

Completed.

## Outcome

Extracted sensitivity section rendering into `SensitivitySectionGenerator`, wired it into `MonteCarloReportGenerator`, and added focused unit coverage. Skipped new integration tests because the existing report snapshot suite already validates sensitivity output end-to-end.
