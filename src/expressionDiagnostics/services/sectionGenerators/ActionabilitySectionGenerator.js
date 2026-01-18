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
   * @param {object} deps
   * @param {object} deps.logger - Logger instance
   * @param {object} deps.orBlockAnalyzer - OrBlockAnalyzer service
   * @param {object} deps.witnessSearcher - ConstructiveWitnessSearcher service
   * @param {object} deps.editSetGenerator - EditSetGenerator service
   * @param {object} [deps.config] - Optional config override
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
   *
   * @param {object} simulationResult - Monte Carlo simulation result
   * @returns {object} Section data with formatted output
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
   *
   * @param {object} simulationResult
   * @param {number} triggerRate
   * @returns {object}
   */
  #runAnalyses(simulationResult, triggerRate) {
    // OR Block Analysis (always run if OR blocks exist)
    const orBlocks = simulationResult.orBlocks || [];
    const orBlockAnalyses = this.#config.orBlockAnalysis.enabled
      ? this.#orBlockAnalyzer.analyzeAll(orBlocks, simulationResult)
      : [];

    // Constructive Witness Search (only for zero/near-zero trigger)
    let witnessResult = {
      found: false,
      bestCandidateState: null,
      andBlockScore: 0,
      blockingClauses: [],
      minimalAdjustments: [],
      searchStats: {},
    };
    if (this.#config.witnessSearch.enabled && triggerRate < 0.001) {
      witnessResult = this.#witnessSearcher.search(simulationResult);
    }

    // Edit Set Generation (always run if enabled)
    let editSet = {
      targetBand: [0, 1],
      primaryRecommendation: null,
      alternativeEdits: [],
      notRecommended: [],
    };
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
   *
   * @param {object} analyses
   * @param {number} triggerRate
   * @returns {string[]}
   */
  #formatSection(analyses, triggerRate) {
    const lines = [];

    lines.push('# Actionability Analysis');
    lines.push('');

    // Summary header based on trigger rate
    if (triggerRate === 0) {
      lines.push(
        '**Zero Trigger Rate** - This expression never fires under current conditions.'
      );
      lines.push('');
    } else if (triggerRate < 0.01) {
      lines.push(
        `**Very Low Trigger Rate** (${(triggerRate * 100).toFixed(2)}%) - Consider the recommendations below.`
      );
      lines.push('');
    } else {
      lines.push(`**Current Trigger Rate**: ${(triggerRate * 100).toFixed(2)}%`);
      lines.push('');
    }

    // Witness Search Results (if applicable)
    if (analyses.witnessResult.bestCandidateState) {
      lines.push(...this.#formatWitnessSection(analyses.witnessResult));
    }

    // Edit Recommendations
    if (
      analyses.editSet.primaryRecommendation ||
      analyses.editSet.alternativeEdits.length > 0
    ) {
      lines.push(...this.#formatEditSection(analyses.editSet));
    }

    // OR Block Analysis
    const problematicOrBlocks = analyses.orBlockAnalyses.filter(
      (a) => a.deadWeightCount > 0
    );
    if (problematicOrBlocks.length > 0) {
      lines.push(...this.#formatOrBlockSection(problematicOrBlocks));
    }

    // No recommendations case
    if (lines.length <= 4) {
      lines.push('No critical actionability issues identified.');
      lines.push('');
    }

    return lines;
  }

  /**
   * Format witness search section
   *
   * @param {WitnessSearchResult} witnessResult
   * @returns {string[]}
   */
  #formatWitnessSection(witnessResult) {
    const lines = [];

    lines.push('## Nearest Feasible State');
    lines.push('');

    if (witnessResult.found) {
      lines.push(
        '**Witness Found** - A state exists where this expression would trigger.'
      );
    } else {
      lines.push(
        `**No Perfect Witness** - Best candidate achieves ${(witnessResult.andBlockScore * 100).toFixed(0)}% of clauses.`
      );
    }
    lines.push('');

    // Blocking clauses
    if (witnessResult.blockingClauses.length > 0) {
      lines.push('### Remaining Blockers:');
      lines.push('');
      for (const blocker of witnessResult.blockingClauses.slice(0, 5)) {
        lines.push(`- **${blocker.clauseDescription || blocker.clauseId}**`);
        lines.push(
          `  - Observed: ${blocker.observedValue?.toFixed(2) ?? 'N/A'}, Required: ${blocker.threshold?.toFixed(2) ?? 'N/A'}`
        );
        lines.push(`  - Gap: ${blocker.gap?.toFixed(2) ?? 'N/A'}`);
      }
      lines.push('');
    }

    // Minimal adjustments
    if (witnessResult.minimalAdjustments.length > 0) {
      lines.push('### Suggested Threshold Adjustments:');
      lines.push('');
      for (const adj of witnessResult.minimalAdjustments.slice(0, 3)) {
        const confidenceIcon =
          adj.confidence === 'high'
            ? '[high]'
            : adj.confidence === 'medium'
              ? '[medium]'
              : '[low]';
        lines.push(
          `- ${confidenceIcon} **${adj.clauseId}**: ${adj.currentThreshold?.toFixed(2)} -> ${adj.suggestedThreshold?.toFixed(2)} (delta ${adj.delta?.toFixed(2)})`
        );
      }
      lines.push('');
    }

    // Search stats
    lines.push(
      `_Search evaluated ${witnessResult.searchStats.samplesEvaluated ?? 0} samples in ${witnessResult.searchStats.timeMs ?? 0}ms_`
    );
    lines.push('');

    return lines;
  }

  /**
   * Format edit recommendations section
   *
   * @param {RecommendedEditSet} editSet
   * @returns {string[]}
   */
  #formatEditSection(editSet) {
    const lines = [];

    lines.push('## Recommended Edits');
    lines.push('');
    lines.push(
      `Target trigger rate band: ${(editSet.targetBand[0] * 100).toFixed(2)}% - ${(editSet.targetBand[1] * 100).toFixed(2)}%`
    );
    lines.push('');

    // Primary recommendation
    if (editSet.primaryRecommendation) {
      lines.push('### Primary Recommendation');
      lines.push('');
      lines.push(...this.#formatEditProposal(editSet.primaryRecommendation, 1));
    }

    // Alternative edits
    if (editSet.alternativeEdits.length > 0) {
      lines.push('### Alternative Approaches');
      lines.push('');
      for (let i = 0; i < editSet.alternativeEdits.length; i++) {
        lines.push(
          ...this.#formatEditProposal(editSet.alternativeEdits[i], i + 2)
        );
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
   *
   * @param {object} proposal
   * @param {number} rank
   * @returns {string[]}
   */
  #formatEditProposal(proposal, rank) {
    const lines = [];
    const confidenceIcon =
      proposal.confidence === 'high'
        ? '[high]'
        : proposal.confidence === 'medium'
          ? '[medium]'
          : '[low]';

    lines.push(`**Option ${rank}** ${confidenceIcon}`);
    lines.push('');

    for (const edit of proposal.edits) {
      if (edit.editType === 'threshold') {
        lines.push(
          `- Change \`${edit.clauseId}\` threshold: ${edit.before} -> ${edit.after}`
        );
      } else {
        lines.push(
          `- ${edit.editType}: \`${edit.clauseId}\` ${edit.before} -> ${edit.after}`
        );
      }
    }
    lines.push('');

    lines.push(
      `- **Predicted Rate**: ${(proposal.predictedTriggerRate * 100).toFixed(2)}%`
    );
    lines.push(
      `- **Confidence Interval**: [${(proposal.confidenceInterval[0] * 100).toFixed(2)}%, ${(proposal.confidenceInterval[1] * 100).toFixed(2)}%]`
    );
    lines.push(`- **Validation**: ${proposal.validationMethod}`);
    lines.push('');

    return lines;
  }

  /**
   * Format OR block analysis section
   *
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
   *
   * @returns {object}
   */
  #emptySection() {
    return {
      orBlockAnalyses: [],
      witnessResult: {
        found: false,
        bestCandidateState: null,
        andBlockScore: 0,
        blockingClauses: [],
        minimalAdjustments: [],
        searchStats: {},
      },
      editSet: {
        targetBand: [0, 1],
        primaryRecommendation: null,
        alternativeEdits: [],
        notRecommended: [],
      },
      formatted: ['# Actionability Analysis', '', '_No data available._', ''],
      sectionTitle: 'Actionability Analysis',
    };
  }
}

export default ActionabilitySectionGenerator;
