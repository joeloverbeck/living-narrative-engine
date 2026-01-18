# MONCARACTIMP-014: ActionabilitySectionGenerator

## Summary

Create a new `ActionabilitySectionGenerator` that synthesizes insights from `OrBlockAnalyzer`, `ConstructiveWitnessSearcher`, and `EditSetGenerator` into a dedicated "Actionability" section of the Monte Carlo report.

## Priority

MEDIUM

## Effort

Medium (~350 LOC)

## Dependencies

- MONCARACTIMP-001 (Configuration & Type Definitions)
- MONCARACTIMP-004 (OrBlockAnalyzer)
- MONCARACTIMP-006 (ConstructiveWitnessSearcher)
- MONCARACTIMP-010 (EditSetGenerator)

## Rationale

The actionability section consolidates all improvement recommendations into a single, actionable report section. This gives content creators a clear "what to do next" guide rather than scattered insights across multiple sections.

## Files to Create

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js` | CREATE | New section generator |

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | MODIFY | Register the service |

## Out of Scope

- Unit tests (add to existing section generator test patterns)
- Integration tests (MONCARACTIMP-016)
- MonteCarloReportGenerator wiring (MONCARACTIMP-015)
- Other section generators
- Report template changes

## Implementation Details

### Section Generator Implementation

```javascript
// src/expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js

/**
 * @file ActionabilitySectionGenerator - Generates actionability section for Monte Carlo reports
 * @see specs/monte-carlo-actionability-improvements.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { actionabilityConfig } from '../../config/actionabilityConfig.js';

/** @typedef {import('../../config/actionabilityConfig.js').OrBlockAnalysis} OrBlockAnalysis */
/** @typedef {import('../../config/actionabilityConfig.js').WitnessSearchResult} WitnessSearchResult */
/** @typedef {import('../../config/actionabilityConfig.js').RecommendedEditSet} RecommendedEditSet */

class ActionabilitySectionGenerator {
  #logger;
  #orBlockAnalyzer;
  #witnessSearcher;
  #editSetGenerator;
  #config;

  /**
   * @param {Object} deps
   * @param {Object} deps.logger - Logger instance
   * @param {Object} deps.orBlockAnalyzer - OrBlockAnalyzer service
   * @param {Object} deps.witnessSearcher - ConstructiveWitnessSearcher service
   * @param {Object} deps.editSetGenerator - EditSetGenerator service
   * @param {Object} [deps.config] - Optional config override
   */
  constructor({
    logger,
    orBlockAnalyzer,
    witnessSearcher,
    editSetGenerator,
    config = actionabilityConfig,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(orBlockAnalyzer, 'IOrBlockAnalyzer', logger, {
      requiredMethods: ['analyze', 'analyzeAll'],
    });
    validateDependency(witnessSearcher, 'IConstructiveWitnessSearcher', logger, {
      requiredMethods: ['search'],
    });
    validateDependency(editSetGenerator, 'IEditSetGenerator', logger, {
      requiredMethods: ['generate'],
    });

    this.#logger = logger;
    this.#orBlockAnalyzer = orBlockAnalyzer;
    this.#witnessSearcher = witnessSearcher;
    this.#editSetGenerator = editSetGenerator;
    this.#config = config;
  }

  /**
   * Generate actionability section
   * @param {Object} simulationResult - Monte Carlo simulation result
   * @returns {Object} Section data with formatted output
   */
  generate(simulationResult) {
    if (!simulationResult) {
      this.#logger.debug('ActionabilitySectionGenerator: No simulation result');
      return this.#emptySection();
    }

    try {
      const triggerRate = simulationResult.triggerRate ?? 0;

      // Determine which analyses to run based on trigger rate
      const analyses = this.#runAnalyses(simulationResult, triggerRate);

      // Build formatted section
      const formatted = this.#formatSection(analyses, triggerRate);

      this.#logger.debug(
        `ActionabilitySectionGenerator: Generated section with ${analyses.orBlockAnalyses.length} OR analyses, ` +
        `witness ${analyses.witnessResult.found ? 'found' : 'not found'}, ` +
        `${analyses.editSet.alternativeEdits.length + (analyses.editSet.primaryRecommendation ? 1 : 0)} edit proposals`
      );

      return {
        ...analyses,
        formatted,
        sectionTitle: 'Actionability Analysis',
      };
    } catch (err) {
      this.#logger.error('ActionabilitySectionGenerator: Generation error', err);
      return this.#emptySection();
    }
  }

  /**
   * Run all analyses
   * @param {Object} simulationResult
   * @param {number} triggerRate
   * @returns {Object}
   */
  #runAnalyses(simulationResult, triggerRate) {
    // OR Block Analysis (always run if OR blocks exist)
    const orBlocks = simulationResult.orBlocks || [];
    const orBlockAnalyses = this.#config.orBlockAnalysis.enabled
      ? this.#orBlockAnalyzer.analyzeAll(orBlocks, simulationResult)
      : [];

    // Constructive Witness Search (only for zero/near-zero trigger)
    let witnessResult = { found: false, bestCandidateState: null, andBlockScore: 0, blockingClauses: [], minimalAdjustments: [], searchStats: {} };
    if (this.#config.witnessSearch.enabled && triggerRate < 0.001) {
      witnessResult = this.#witnessSearcher.search(simulationResult);
    }

    // Edit Set Generation (always run if enabled)
    let editSet = { targetBand: [0, 1], primaryRecommendation: null, alternativeEdits: [], notRecommended: [] };
    if (this.#config.editSetGeneration.enabled) {
      editSet = this.#editSetGenerator.generate(simulationResult);
    }

    return {
      orBlockAnalyses,
      witnessResult,
      editSet,
    };
  }

  /**
   * Format the complete section
   * @param {Object} analyses
   * @param {number} triggerRate
   * @returns {string[]}
   */
  #formatSection(analyses, triggerRate) {
    const lines = [];

    lines.push('# Actionability Analysis');
    lines.push('');

    // Summary header based on trigger rate
    if (triggerRate === 0) {
      lines.push('⚠️ **Zero Trigger Rate** - This expression never fires under current conditions.');
      lines.push('');
    } else if (triggerRate < 0.01) {
      lines.push(`📉 **Very Low Trigger Rate** (${(triggerRate * 100).toFixed(2)}%) - Consider the recommendations below.`);
      lines.push('');
    } else {
      lines.push(`📊 **Current Trigger Rate**: ${(triggerRate * 100).toFixed(2)}%`);
      lines.push('');
    }

    // Witness Search Results (if applicable)
    if (analyses.witnessResult.bestCandidateState) {
      lines.push(...this.#formatWitnessSection(analyses.witnessResult));
    }

    // Edit Recommendations
    if (analyses.editSet.primaryRecommendation || analyses.editSet.alternativeEdits.length > 0) {
      lines.push(...this.#formatEditSection(analyses.editSet));
    }

    // OR Block Analysis
    const problematicOrBlocks = analyses.orBlockAnalyses.filter(a => a.deadWeightCount > 0);
    if (problematicOrBlocks.length > 0) {
      lines.push(...this.#formatOrBlockSection(problematicOrBlocks));
    }

    // No recommendations case
    if (lines.length <= 4) {
      lines.push('✅ No critical actionability issues identified.');
      lines.push('');
    }

    return lines;
  }

  /**
   * Format witness search section
   * @param {WitnessSearchResult} witnessResult
   * @returns {string[]}
   */
  #formatWitnessSection(witnessResult) {
    const lines = [];

    lines.push('## Nearest Feasible State');
    lines.push('');

    if (witnessResult.found) {
      lines.push('✅ **Witness Found** - A state exists where this expression would trigger.');
    } else {
      lines.push(`⚠️ **No Perfect Witness** - Best candidate achieves ${(witnessResult.andBlockScore * 100).toFixed(0)}% of clauses.`);
    }
    lines.push('');

    // Blocking clauses
    if (witnessResult.blockingClauses.length > 0) {
      lines.push('### Remaining Blockers:');
      lines.push('');
      for (const blocker of witnessResult.blockingClauses.slice(0, 5)) {
        lines.push(`- **${blocker.clauseDescription || blocker.clauseId}**`);
        lines.push(`  - Observed: ${blocker.observedValue?.toFixed(2) ?? 'N/A'}, Required: ${blocker.threshold?.toFixed(2) ?? 'N/A'}`);
        lines.push(`  - Gap: ${blocker.gap?.toFixed(2) ?? 'N/A'}`);
      }
      lines.push('');
    }

    // Minimal adjustments
    if (witnessResult.minimalAdjustments.length > 0) {
      lines.push('### Suggested Threshold Adjustments:');
      lines.push('');
      for (const adj of witnessResult.minimalAdjustments.slice(0, 3)) {
        const confidenceIcon = adj.confidence === 'high' ? '✅' : adj.confidence === 'medium' ? '⚠️' : '❓';
        lines.push(`- ${confidenceIcon} **${adj.clauseId}**: ${adj.currentThreshold?.toFixed(2)} → ${adj.suggestedThreshold?.toFixed(2)} (Δ${adj.delta?.toFixed(2)})`);
      }
      lines.push('');
    }

    // Search stats
    lines.push(`_Search evaluated ${witnessResult.searchStats.samplesEvaluated ?? 0} samples in ${witnessResult.searchStats.timeMs ?? 0}ms_`);
    lines.push('');

    return lines;
  }

  /**
   * Format edit recommendations section
   * @param {RecommendedEditSet} editSet
   * @returns {string[]}
   */
  #formatEditSection(editSet) {
    const lines = [];

    lines.push('## Recommended Edits');
    lines.push('');
    lines.push(`Target trigger rate band: ${(editSet.targetBand[0] * 100).toFixed(2)}% - ${(editSet.targetBand[1] * 100).toFixed(2)}%`);
    lines.push('');

    // Primary recommendation
    if (editSet.primaryRecommendation) {
      lines.push('### 🎯 Primary Recommendation');
      lines.push('');
      lines.push(...this.#formatEditProposal(editSet.primaryRecommendation, 1));
    }

    // Alternative edits
    if (editSet.alternativeEdits.length > 0) {
      lines.push('### Alternative Approaches');
      lines.push('');
      for (let i = 0; i < editSet.alternativeEdits.length; i++) {
        lines.push(...this.#formatEditProposal(editSet.alternativeEdits[i], i + 2));
      }
    }

    // Not recommended
    if (editSet.notRecommended.length > 0) {
      lines.push('<details>');
      lines.push('<summary>Edits Not Recommended (low confidence)</summary>');
      lines.push('');
      for (const desc of editSet.notRecommended.slice(0, 5)) {
        lines.push(`- ${desc}`);
      }
      lines.push('</details>');
      lines.push('');
    }

    return lines;
  }

  /**
   * Format a single edit proposal
   * @param {Object} proposal
   * @param {number} rank
   * @returns {string[]}
   */
  #formatEditProposal(proposal, rank) {
    const lines = [];
    const confidenceIcon = proposal.confidence === 'high' ? '✅' : proposal.confidence === 'medium' ? '⚠️' : '❓';

    lines.push(`**Option ${rank}** ${confidenceIcon}`);
    lines.push('');

    for (const edit of proposal.edits) {
      if (edit.editType === 'threshold') {
        lines.push(`- Change \`${edit.clauseId}\` threshold: ${edit.before} → ${edit.after}`);
      } else {
        lines.push(`- ${edit.editType}: \`${edit.clauseId}\` ${edit.before} → ${edit.after}`);
      }
    }
    lines.push('');

    lines.push(`- **Predicted Rate**: ${(proposal.predictedTriggerRate * 100).toFixed(2)}%`);
    lines.push(`- **Confidence Interval**: [${(proposal.confidenceInterval[0] * 100).toFixed(2)}%, ${(proposal.confidenceInterval[1] * 100).toFixed(2)}%]`);
    lines.push(`- **Validation**: ${proposal.validationMethod}`);
    lines.push('');

    return lines;
  }

  /**
   * Format OR block analysis section
   * @param {OrBlockAnalysis[]} orAnalyses
   * @returns {string[]}
   */
  #formatOrBlockSection(orAnalyses) {
    const lines = [];

    lines.push('## OR Block Restructuring');
    lines.push('');

    for (const analysis of orAnalyses) {
      lines.push(`### ${analysis.blockDescription || analysis.blockId}`);
      lines.push('');
      lines.push(`Dead-weight alternatives: ${analysis.deadWeightCount}`);
      lines.push('');

      // Impact summary
      if (analysis.impactSummary) {
        lines.push(`_${analysis.impactSummary}_`);
        lines.push('');
      }

      // Recommendations
      if (analysis.recommendations.length > 0) {
        lines.push('**Recommendations:**');
        lines.push('');
        for (const rec of analysis.recommendations.slice(0, 3)) {
          lines.push(`- **${rec.action}** alternative ${rec.targetAlternative}`);
          lines.push(`  - ${rec.rationale}`);
          if (rec.suggestedValue !== undefined) {
            lines.push(`  - Suggested value: ${rec.suggestedValue}`);
          }
        }
        lines.push('');
      }
    }

    return lines;
  }

  /**
   * Return empty section for error cases
   * @returns {Object}
   */
  #emptySection() {
    return {
      orBlockAnalyses: [],
      witnessResult: { found: false, bestCandidateState: null, andBlockScore: 0, blockingClauses: [], minimalAdjustments: [], searchStats: {} },
      editSet: { targetBand: [0, 1], primaryRecommendation: null, alternativeEdits: [], notRecommended: [] },
      formatted: ['# Actionability Analysis', '', '_No data available._', ''],
      sectionTitle: 'Actionability Analysis',
    };
  }
}

export default ActionabilitySectionGenerator;
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:

```javascript
import ActionabilitySectionGenerator from '../expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js';

// In registerExpressionDiagnosticsServices():
registrar.singletonFactory(
  diagnosticsTokens.IActionabilitySectionGenerator,
  (c) =>
    new ActionabilitySectionGenerator({
      logger: c.resolve(tokens.ILogger),
      orBlockAnalyzer: c.resolve(diagnosticsTokens.IOrBlockAnalyzer),
      witnessSearcher: c.resolve(diagnosticsTokens.IConstructiveWitnessSearcher),
      editSetGenerator: c.resolve(diagnosticsTokens.IEditSetGenerator),
    })
);
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking
npm run typecheck

# Linting
npx eslint src/expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js
npx eslint src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Service can be instantiated (requires mock dependencies)
node -e "
const ActionabilitySectionGenerator = require('./src/expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js').default;
console.log('Module loaded successfully');
"
```

### Invariants That Must Remain True

1. `generate()` must return valid section structure
2. Section must include `formatted` array for report output
3. All sub-analyses must be optional (graceful degradation)
4. Invalid input must return empty section, not throw
5. Existing DI registrations must not be affected

## Verification Commands

```bash
# Verify service file exists
ls -la src/expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js

# Verify DI registration
grep -n "IActionabilitySectionGenerator" src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Full validation
npm run typecheck
npx eslint src/expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js
```

## Estimated Diff Size

- `ActionabilitySectionGenerator.js`: ~350 lines (new file)
- `expressionDiagnosticsRegistrations.js`: ~12 lines added

**Total**: ~365 lines

## Definition of Done

- [x] `ActionabilitySectionGenerator.js` created with full implementation
- [x] Service registered in DI container
- [x] `npm run typecheck` passes (pre-existing errors in unrelated files)
- [x] ESLint passes (0 errors, minor JSDoc warnings only)
- [x] Service can be instantiated with mock dependencies
- [x] `generate()` returns valid section structure
- [x] Integrates with OrBlockAnalyzer
- [x] Integrates with ConstructiveWitnessSearcher
- [x] Integrates with EditSetGenerator
- [x] Formatted output includes all analysis results

## Outcome

### Completed: 2026-01-18

**Implementation Summary:**

1. **Created `ActionabilitySectionGenerator.js`** (~420 lines)
   - Full implementation with constructor validation via `validateDependency`
   - `generate(simulationResult)` method returning structured section data
   - Private formatters: `#runAnalyses`, `#formatSection`, `#formatWitnessSection`, `#formatEditSection`, `#formatEditProposal`, `#formatOrBlockSection`, `#emptySection`
   - Respects `actionabilityConfig` feature flags
   - Graceful error handling with empty section fallback

2. **Added DI Registration** (~15 lines)
   - Import statement for ActionabilitySectionGenerator
   - Singleton factory registration with proper dependency injection

3. **Created Unit Tests** (~400 lines)
   - Constructor validation tests (missing dependencies)
   - `generate()` with null/undefined input
   - Trigger rate handling (zero, very low, normal)
   - Witness search execution conditions
   - OR block analysis integration
   - Edit set generation integration
   - Error handling scenarios
   - Config flag integration tests
   - Formatting correctness tests

**Test Results:**
- All unit tests pass
- ESLint: 0 errors (18 minor JSDoc warnings - missing descriptions)
- TypeScript: Pre-existing errors in unrelated files (cli/validation/)

**Files Created:**
- `src/expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js`
- `tests/unit/expressionDiagnostics/services/sectionGenerators/actionabilitySectionGenerator.test.js`

**Files Modified:**
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`
