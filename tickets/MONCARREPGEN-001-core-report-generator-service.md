# MONCARREPGEN-001: Core Report Generator Service

## Summary

Create the `MonteCarloReportGenerator` service class that generates comprehensive markdown reports from Monte Carlo simulation results. This is a pure data-transformation service with no UI dependencies.

## Priority: High | Effort: Medium

## Rationale

The report generator is the core logic layer for the Monte Carlo Report Generator feature. It transforms raw simulation data and blocker analysis into a structured markdown document optimized for AI assistant consumption. By isolating this as a pure service, we enable:
- Easy unit testing without DOM mocking
- Reuse in other contexts (e.g., CLI tools, batch processing)
- Clear separation between data transformation and presentation

## Dependencies

- None (first ticket in the series)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Create** |

## Out of Scope

- **DO NOT** create any UI components (modal, buttons) - that's MONCARREPGEN-003/005
- **DO NOT** modify DI registration - that's MONCARREPGEN-002
- **DO NOT** modify ExpressionDiagnosticsController - that's MONCARREPGEN-006
- **DO NOT** create test files - that's MONCARREPGEN-007
- **DO NOT** add clipboard functionality
- **DO NOT** modify MonteCarloSimulator or FailureExplainer

## Implementation Details

### Class Structure

```javascript
/**
 * @file MonteCarloReportGenerator - Generates markdown reports from Monte Carlo simulation results
 * @see specs/monte-carlo-report-generator.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

class MonteCarloReportGenerator {
  #logger;

  /**
   * @param {object} deps
   * @param {import('../../interfaces/ILogger.js').ILogger} deps.logger
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
  }

  /**
   * Generate a complete markdown report from simulation results.
   * @param {object} params
   * @param {string} params.expressionName - Name of the expression analyzed
   * @param {object} params.simulationResult - Raw result from MonteCarloSimulator
   * @param {object[]} params.blockers - Analyzed blockers from FailureExplainer
   * @param {string} params.summary - Summary text from FailureExplainer
   * @returns {string} Markdown report content
   */
  generate({ expressionName, simulationResult, blockers, summary }) {
    this.#logger.debug(`Generating report for expression: ${expressionName}`);

    const sections = [
      this.#generateHeader(expressionName, simulationResult),
      this.#generateExecutiveSummary(simulationResult, summary),
      this.#generateBlockerAnalysis(blockers, simulationResult.sampleCount),
      this.#generateLegend(),
    ];

    return sections.join('\n');
  }

  // Private section generators
  #generateHeader(expressionName, simulationResult) { /* ... */ }
  #generateExecutiveSummary(simulationResult, summary) { /* ... */ }
  #generateBlockerAnalysis(blockers, sampleCount) { /* ... */ }
  #generateBlockerSection(blocker, rank, sampleCount) { /* ... */ }
  #generateFlags(blocker) { /* ... */ }
  #generateDistributionAnalysis(blocker) { /* ... */ }
  #generateCeilingAnalysis(blocker) { /* ... */ }
  #generateNearMissAnalysis(blocker) { /* ... */ }
  #generateLastMileAnalysis(blocker) { /* ... */ }
  #generateRecommendation(blocker) { /* ... */ }
  #generateLegend() { /* ... */ }

  // Formatting helpers
  #formatPercentage(value, decimals = 2) { /* ... */ }
  #formatNumber(value, decimals = 2) { /* ... */ }
  #getRarityCategory(triggerRate) { /* ... */ }
}

export default MonteCarloReportGenerator;
```

### Flag Detection Logic

Implement flags according to spec section "Problem Indicators and Actions":

```javascript
#generateFlags(blocker) {
  const flags = [];
  const adv = blocker.advancedAnalysis || {};

  // 1. Ceiling Effect (Critical)
  if (adv.ceilingAnalysis?.status === 'ceiling_detected') {
    flags.push('[CEILING]');
  }

  // 2. Decisive Blocker (High Priority)
  if (adv.lastMileAnalysis?.isDecisive || blocker.isSingleClause) {
    flags.push('[DECISIVE]');
  }

  // 3. High Tunability (Quick Wins)
  const nearMissRate = blocker.hierarchicalBreakdown?.nearMissRate;
  if (nearMissRate != null && nearMissRate > 0.10) {
    flags.push('[TUNABLE]');
  }

  // 4. Low Tunability (Upstream Fix Required)
  if (nearMissRate != null && nearMissRate < 0.02) {
    flags.push('[UPSTREAM]');
  }

  // 5. Heavy-Tailed Distribution
  const avgViol = blocker.averageViolation;
  const p50 = blocker.hierarchicalBreakdown?.violationP50;
  if (p50 != null && avgViol != null && p50 < avgViol * 0.5) {
    flags.push('[OUTLIERS-SKEW]');
  }

  // 6. Severe Outliers Present
  const p90 = blocker.hierarchicalBreakdown?.violationP90;
  if (p90 != null && avgViol != null && p90 > avgViol * 2) {
    flags.push('[SEVERE-TAIL]');
  }

  return flags.length > 0 ? flags.join(' ') : 'None';
}
```

### Rarity Category Mapping

```javascript
#getRarityCategory(triggerRate) {
  if (triggerRate === 0) return 'impossible';
  if (triggerRate < 0.00001) return 'extremely_rare';
  if (triggerRate < 0.0005) return 'rare';
  if (triggerRate < 0.02) return 'normal';
  return 'frequent';
}
```

### Report Format

The generated markdown must follow the exact format in the spec (see `## Report Format (Markdown)` section). Key elements:
- Header with expression name, timestamp, distribution, sample size
- Executive summary with trigger rate, confidence interval, rarity
- Blocker sections with all analysis subsections
- Legend explaining all metrics (NOT repeated per blocker)

### Input Data Structures

The generator expects these structures:

**simulationResult** (from MonteCarloSimulator):
```javascript
{
  triggerRate: number,           // 0-1
  triggerCount: number,
  sampleCount: number,
  confidenceInterval: { low: number, high: number },
  distribution: 'uniform' | 'gaussian',
  clauseFailures: ClauseResult[]
}
```

**blockers** (from FailureExplainer.analyzeHierarchicalBlockers):
```javascript
[{
  clauseDescription: string,
  failureRate: number,
  averageViolation: number,
  rank: number,
  severity: 'critical' | 'high' | 'medium' | 'low',
  advancedAnalysis: {
    percentileAnalysis: { status: string, insight: string },
    nearMissAnalysis: { status: string, tunability: string, insight: string },
    ceilingAnalysis: { status: string, achievable: boolean, gap?: number, headroom?: number, insight: string },
    lastMileAnalysis: { status: string, isDecisive: boolean, insight: string },
    recommendation: { action: string, priority: string, message: string }
  },
  hierarchicalBreakdown: {
    variablePath: string,
    comparisonOperator: string,
    thresholdValue: number,
    violationP50: number,
    violationP90: number,
    nearMissRate: number,
    nearMissEpsilon: number,
    maxObservedValue: number,
    ceilingGap: number,
    lastMileFailRate: number,
    othersPassedCount: number,
    isSingleClause: boolean
  }
}]
```

## Acceptance Criteria

### Tests That Must Pass

After MONCARREPGEN-007 is complete:
```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --verbose
```

### Invariants That Must Remain True

1. **Pure function**: `generate()` has no side effects (only logging)
2. **Null safety**: Handle missing optional fields gracefully (use `??`, `?.`)
3. **Format compliance**: Output matches spec's markdown format exactly
4. **Flag accuracy**: Each flag detection matches spec thresholds precisely
5. **Percentage display**: All percentages shown as 0-100 scale with `%` suffix
6. **No UI coupling**: Class has no DOM or browser dependencies

## Verification Commands

```bash
# Type check
npm run typecheck

# Lint the new file
npx eslint src/expressionDiagnostics/services/MonteCarloReportGenerator.js

# Manual verification: Import and instantiate
node -e "
  import('./src/expressionDiagnostics/services/MonteCarloReportGenerator.js')
    .then(m => {
      const gen = new m.default({ logger: console });
      console.log('Class instantiated successfully');
    })
    .catch(e => console.error('Import failed:', e));
"
```

## Definition of Done

- [ ] `MonteCarloReportGenerator.js` created in `src/expressionDiagnostics/services/`
- [ ] Constructor validates `logger` dependency
- [ ] `generate()` method accepts `{ expressionName, simulationResult, blockers, summary }`
- [ ] Header section includes expression name, timestamp, distribution, sample size
- [ ] Executive summary includes trigger rate (as %), CI bounds, rarity category
- [ ] Blocker sections include all 6 analysis subsections per spec
- [ ] Flag detection implements all 6 problem indicators from spec
- [ ] Legend section defines all metrics (single occurrence, not per blocker)
- [ ] All percentages displayed as 0-100 scale
- [ ] Numbers formatted with appropriate decimal places
- [ ] Null/undefined values handled with fallbacks
- [ ] No DOM or browser dependencies
- [ ] File passes ESLint
- [ ] File passes typecheck
- [ ] JSDoc comments on public methods
