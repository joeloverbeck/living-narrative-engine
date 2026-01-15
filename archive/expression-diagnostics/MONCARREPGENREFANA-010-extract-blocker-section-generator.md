# MONCARREPGENREFANA-010: Extract BlockerSectionGenerator

**Status**: Completed

## Summary

Extract the blocker analysis section generation logic from MonteCarloReportGenerator into a dedicated BlockerSectionGenerator service. This handles probability funnel, leaf breakdown, OR contribution/overlap, worst-offender analysis, and the blocker subsection helpers used only by the blocker section output.

## Priority: Medium | Effort: High | Risk: HIGHER

## Rationale

These methods:
- Generate the most complex report sections
- Depend on multiple services (formatting, statistics, tree traversal)
- Well-tested through existing MonteCarloReportGenerator tests (probabilityFunnel/orOverlap)
- Handle hierarchical blocker visualization

## Assumptions & Scope Update (2026-01-15)

- ReportFormattingService, StatisticalComputationService, BlockerTreeTraversal, ReportDataExtractor, and ReportIntegrityAnalyzer already exist in `src/expressionDiagnostics/services/`.
- PrototypeSectionGenerator and SensitivitySectionGenerator are already extracted and used by MonteCarloReportGenerator.
- There is no `buildFeasibilitySummary()` method in MonteCarloReportGenerator; remove it from scope.
- `buildClauseAnchorId()` is used by recommendation links outside the blocker section, so it must remain available to MonteCarloReportGenerator (either kept there or shared without breaking).
- Blocker section helpers currently live in MonteCarloReportGenerator; extracting `#generateBlockerSection()` requires moving its dependent helper methods too (flags, distribution, ceiling, near-miss, last-mile, recommendation helpers, and clamp-trivial resolution).
- Existing integration tests already cover full report output and worker usage (`monteCarloReportSnapshot.integration.test.js`, `monteCarloReportWorker.integration.test.js`).

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js` | **Create** - New service (~450 lines) |
| `tests/unit/expressionDiagnostics/services/sectionGenerators/blockerSectionGenerator.test.js` | **Create** - Unit tests |
| `src/expressionDiagnostics/services/sectionGenerators/index.js` | **Modify** - Add export |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** - Remove methods, add service usage |

## Out of Scope

- **DO NOT** change other section generators
- **DO NOT** change BlockerTreeTraversal
- **DO NOT** change StatisticalComputationService
- **DO NOT** change ReportFormattingService
- **DO NOT** modify DI registrations

## Methods to Extract

```javascript
#generateBlockerAnalysis()
#generateBlockerSection()
#generateProbabilityFunnel()
#selectKeyThresholdClauses()
#generateLeafBreakdown()
#generateStructuredBreakdown()
#generateConditionGroup()
#generateOrContributionBreakdown()
#generateOrOverlapBreakdown()
#generateWorstOffenderAnalysis()
#generateLeafRow()
#resolveClampTrivialInRegime()
#generateFlags()
#generateDistributionAnalysis()
#aggregateLeafViolationStats()
#generateCeilingAnalysis()
#generateNearMissAnalysis()
#generateLastMileAnalysis()
#generateRecommendation()

Keep `#buildClauseAnchorId()` available in MonteCarloReportGenerator since it is referenced by recommendation link rendering.
```

## Implementation Details

### Service Structure

```javascript
/**
 * @file BlockerSectionGenerator - Generates blocker analysis report sections
 */
import ReportFormattingService from '../ReportFormattingService.js';
import StatisticalComputationService from '../StatisticalComputationService.js';
import BlockerTreeTraversal from '../BlockerTreeTraversal.js';

class BlockerSectionGenerator {
  #formattingService;
  #statisticsService;
  #treeTraversal;
  #logger;

  constructor({
    formattingService,
    statisticsService,
    treeTraversal,
    logger = null,
  }) {
    if (!formattingService) {
      throw new Error('BlockerSectionGenerator requires formattingService');
    }
    if (!statisticsService) {
      throw new Error('BlockerSectionGenerator requires statisticsService');
    }
    if (!treeTraversal) {
      throw new Error('BlockerSectionGenerator requires treeTraversal');
    }
    this.#formattingService = formattingService;
    this.#statisticsService = statisticsService;
    this.#treeTraversal = treeTraversal;
    this.#logger = logger;
  }

  /**
   * Generates the blocker analysis section.
   * @param {object} context - Report generation context
   * @returns {string} Markdown section
   */
  generateBlockerAnalysis(context) { /* ... */ }

  // ... other methods
}

export default BlockerSectionGenerator;
```

### Complex Dependencies

This generator has the most dependencies:
- ReportFormattingService (all section generators)
- StatisticalComputationService (rate calculations)
- BlockerTreeTraversal (OR/AND tree operations)

All must be correctly wired in the constructor.

## Acceptance Criteria

### Tests That Must Pass

1. **New BlockerSectionGenerator unit tests:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/sectionGenerators/blockerSectionGenerator.test.js --verbose
   ```

2. **Existing funnel tests still pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.probabilityFunnel.test.js --verbose
   ```

3. **OR overlap tests still pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.orOverlap.test.js --verbose
   ```

4. **Snapshot test unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

### Invariants That Must Remain True

1. **Report output identical**: Snapshot test must pass unchanged
2. **Anchor IDs unchanged**: buildClauseAnchorId produces same IDs
3. **Funnel structure unchanged**: Same hierarchical visualization
4. **OR overlap calculations**: Same overlap percentages displayed

## Verification Commands

```bash
# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/sectionGenerators/blockerSectionGenerator.test.js --verbose

# Verify funnel tests still pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.probabilityFunnel.test.js --verbose

# Verify OR tests still pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.orOverlap.test.js --verbose

# Verify snapshot unchanged
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose

# Lint new files
npx eslint src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js
```

## Definition of Done

- [x] BlockerSectionGenerator.js created with blocker analysis methods and helper subsections
- [x] Unit tests cover core blocker section output and helper behavior
- [x] sectionGenerators/index.js exports new class
- [x] MonteCarloReportGenerator.js uses new service
- [x] Snapshot test passes unchanged
- [x] probabilityFunnel.test.js passes
- [x] orOverlap.test.js continues passing
- [x] Blocker-related methods removed from MonteCarloReportGenerator.js

## Outcome

- Extracted blocker analysis methods (including leaf breakdowns, OR coverage/overlap, and worst-offender analysis) into BlockerSectionGenerator; MonteCarloReportGenerator now delegates to it.
- Kept clause anchor ID generation in MonteCarloReportGenerator for recommendation links, while BlockerSectionGenerator maintains its own anchor builder for blocker sections.
- Added focused BlockerSectionGenerator unit tests; relied on existing probability funnel, OR overlap, and snapshot integration tests rather than adding a new integration test file.

## Dependencies

- **Requires**: MONCARREPGENREFANA-007 (directory structure)
- **Requires**: MONCARREPGENREFANA-001 (ReportFormattingService)
- **Requires**: MONCARREPGENREFANA-003 (StatisticalComputationService)
- **Requires**: MONCARREPGENREFANA-005 (BlockerTreeTraversal)
- **Blocks**: MONCARREPGENREFANA-012 (factory needs all generators)
