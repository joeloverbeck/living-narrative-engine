# MONCARREPGENREFANA-011: Extract CoreSectionGenerator

## Summary

Extract the core report sections that still live inside `MonteCarloReportGenerator` into a dedicated `CoreSectionGenerator` service. This includes the header, population summary, integrity summary/warnings, signal lineage, executive summary, sampling coverage, witness/nearest miss, static cross-reference, legend, and related helpers used exclusively by those sections.

## Priority: Medium | Effort: Medium | Risk: Medium

## Rationale

These methods:
- Generate foundational report sections that appear in every report
- Depend on ReportFormattingService, WitnessFormatter, and basic data extraction helpers
- Are already exercised by existing unit/integration coverage for the report generator and snapshots

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/sectionGenerators/CoreSectionGenerator.js` | **Create** - New service (~350 lines) |
| `tests/unit/expressionDiagnostics/services/sectionGenerators/coreSectionGenerator.test.js` | **Create** - Unit tests |
| `src/expressionDiagnostics/services/sectionGenerators/index.js` | **Modify** - Add export |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** - Remove methods, add service usage |

## Out of Scope

- **DO NOT** change other section generators (Prototype/Sensitivity/Blocker)
- **DO NOT** change ReportFormattingService
- **DO NOT** change WitnessFormatter
- **DO NOT** change ReportIntegrityAnalyzer
- **DO NOT** modify DI registrations
- **DO NOT** move blocker analysis methods already extracted in `BlockerSectionGenerator`

## Methods to Extract

```javascript
// Header + summary
#generateHeader()
#generatePopulationSummary()
#generateExecutiveSummary()

// Integrity sections
#generateIntegritySummarySection()
#generateReportIntegrityWarningsSection()
#isGateMismatchWarning()

// Analysis sections
#generateSignalLineageSection()
#generateSamplingCoverageSection()
#getLowestCoverageVariables()
#generateWitnessSection()
#generateNearestMissSection()

// Reference sections
#generateStaticCrossReference()
#formatGateConflict()
#checkMcConfirmation()
#checkEmotionMcConfirmation()
#generateLegend()

// Data builders
#buildStoredContextPopulations()
#contextMatchesConstraints()
#resolvePopulationSummary()
#getRarityCategory()
```

## Implementation Details

### Service Structure

```javascript
/**
 * @file CoreSectionGenerator - Generates core report sections (header, summary, legend, etc.)
 */
import ReportFormattingService from '../ReportFormattingService.js';
import WitnessFormatter from '../WitnessFormatter.js';

class CoreSectionGenerator {
  #formattingService;
  #witnessFormatter;
  #statisticalService;
  #dataExtractor;

  constructor({
    formattingService,
    witnessFormatter,
    statisticalService,
    dataExtractor,
  }) {
    if (!formattingService) {
      throw new Error('CoreSectionGenerator requires formattingService');
    }
    if (!witnessFormatter) {
      throw new Error('CoreSectionGenerator requires witnessFormatter');
    }
    if (!statisticalService) {
      throw new Error('CoreSectionGenerator requires statisticalService');
    }
    if (!dataExtractor) {
      throw new Error('CoreSectionGenerator requires dataExtractor');
    }
    this.#formattingService = formattingService;
    this.#witnessFormatter = witnessFormatter;
    this.#statisticalService = statisticalService;
    this.#dataExtractor = dataExtractor;
  }

  generateHeader(context) { /* ... */ }
  // ... other methods
}

export default CoreSectionGenerator;
```

### Integration Test Focus

No new integration test is required. Existing snapshot and report-generator integration tests already validate the output and should remain unchanged.

## Acceptance Criteria

### Tests That Must Pass

1. **New CoreSectionGenerator unit tests:**
   ```bash
   npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/sectionGenerators/coreSectionGenerator.test.js --coverage=false --verbose
   ```

2. **Existing report-generator unit tests:**
   ```bash
   npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --coverage=false --verbose
   ```

3. **Snapshot test unchanged:**
   ```bash
   npm run test:integration -- --testPathPatterns tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --coverage=false --verbose
   ```

### Invariants That Must Remain True

1. **Report output identical**: Snapshot test must pass unchanged
2. **Header format unchanged**: Same title structure and metadata
3. **Legend entries unchanged**: Same legend items and descriptions
4. **Population labels unchanged**: Same labeling for stored contexts

## Verification Commands

```bash
npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/sectionGenerators/coreSectionGenerator.test.js --coverage=false --verbose
npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --coverage=false --verbose
npm run test:integration -- --testPathPatterns tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --coverage=false --verbose
```

## Definition of Done

- [x] CoreSectionGenerator.js created with extracted methods
- [x] Unit tests cover core generator behavior
- [x] sectionGenerators/index.js exports new class
- [x] MonteCarloReportGenerator.js uses new service
- [x] Snapshot test passes unchanged
- [x] Main unit tests pass
- [x] Extracted lines removed from MonteCarloReportGenerator.js
- [x] Ticket marked complete and archived

## Dependencies

- **Requires**: MONCARREPGENREFANA-007 (directory structure)
- **Requires**: MONCARREPGENREFANA-001 (ReportFormattingService)
- **Requires**: MONCARREPGENREFANA-002 (WitnessFormatter)
- **Blocks**: MONCARREPGENREFANA-012 (factory needs all generators)

## Status

Completed

## Outcome

- Extracted core header/summary/integrity/legend/static cross-reference sections into `CoreSectionGenerator` and wired it into `MonteCarloReportGenerator`.
- Added unit coverage for the new generator and kept existing snapshot/unit tests green.
- No new integration tests were added because existing snapshot coverage already validates output.
