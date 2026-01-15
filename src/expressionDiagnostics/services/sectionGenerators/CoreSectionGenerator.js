/**
 * @file CoreSectionGenerator - Generates core report sections (header, summary, legend, etc.)
 */

import { buildSamplingCoverageConclusions } from '../samplingCoverageConclusions.js';
import { evaluateConstraint } from '../../utils/moodRegimeUtils.js';
import {
  buildPopulationHash,
  buildPopulationPredicate,
} from '../../utils/populationHashUtils.js';
import { REPORT_INTEGRITY_SAMPLE_LIMIT } from '../../utils/reportIntegrityUtils.js';

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
  } = {}) {
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

  /**
   * Normalize population summary fields from simulation results.
   * @param {object} simulationResult
   * @returns {object}
   */
  resolvePopulationSummary(simulationResult) {
    const summary = simulationResult?.populationSummary ?? {};
    const storedContexts = simulationResult?.storedContexts ?? null;
    const sampleCount = summary.sampleCount ?? simulationResult?.sampleCount ?? 0;
    const inRegimeSampleCount =
      summary.inRegimeSampleCount ?? simulationResult?.inRegimeSampleCount ?? 0;
    const storedContextCount =
      summary.storedContextCount ?? (storedContexts ? storedContexts.length : 0);
    const storedContextLimit =
      summary.storedContextLimit ??
      (storedContexts ? storedContexts.length : 0);
    const storedInRegimeCount =
      summary.storedInRegimeCount ??
      (storedContextCount > 0 ? storedContextCount : 0);

    return {
      sampleCount,
      inRegimeSampleCount,
      inRegimeSampleRate:
        summary.inRegimeSampleRate ??
        (sampleCount > 0 ? inRegimeSampleCount / sampleCount : 0),
      storedContextCount,
      storedContextLimit,
      storedInRegimeCount,
      storedInRegimeRate:
        summary.storedInRegimeRate ??
        (storedContextCount > 0
          ? storedInRegimeCount / storedContextCount
          : 0),
    };
  }

  /**
   * Build stored-context population objects for report metadata.
   * @param {Array<object>|null} storedContexts
   * @param {Array} moodConstraints
   * @returns {{storedGlobal: object, storedMoodRegime: object}|null}
   */
  buildStoredContextPopulations(storedContexts, moodConstraints) {
    if (!Array.isArray(storedContexts) || storedContexts.length === 0) {
      return null;
    }

    const storedGlobalSampleIds = storedContexts.map((_, index) => index);
    const storedGlobalPredicate = 'all';
    const storedGlobalHash = buildPopulationHash(
      storedGlobalSampleIds,
      storedGlobalPredicate
    );

    const moodPredicate = buildPopulationPredicate(moodConstraints);
    const storedMoodRegimeSampleIds =
      moodConstraints && moodConstraints.length > 0
        ? storedContexts.reduce((acc, context, index) => {
          if (this.#contextMatchesConstraints(context, moodConstraints)) {
            acc.push(index);
          }
          return acc;
        }, [])
        : storedGlobalSampleIds;
    const storedMoodRegimeHash = buildPopulationHash(
      storedMoodRegimeSampleIds,
      moodPredicate
    );

    return {
      storedGlobal: {
        name: 'stored-global',
        predicate: storedGlobalPredicate,
        sampleIds: storedGlobalSampleIds,
        count: storedGlobalSampleIds.length,
        hash: storedGlobalHash,
      },
      storedMoodRegime: {
        name: 'stored-mood-regime',
        predicate: moodPredicate,
        sampleIds: storedMoodRegimeSampleIds,
        count: storedMoodRegimeSampleIds.length,
        hash: storedMoodRegimeHash,
      },
    };
  }

  /**
   * Generate the population summary block near the report header.
   * @param {object|null} populationSummary
   * @returns {string}
   */
  generatePopulationSummary(populationSummary) {
    if (!populationSummary) {
      return '';
    }

    const {
      sampleCount,
      inRegimeSampleCount,
      inRegimeSampleRate,
      storedContextCount,
      storedContextLimit,
      storedInRegimeCount,
      storedInRegimeRate,
    } = populationSummary;

    const totalSampleStr = this.#formattingService.formatCount(sampleCount);
    const inRegimeSampleStr =
      this.#formattingService.formatCount(inRegimeSampleCount);
    const storedStr = this.#formattingService.formatCount(storedContextCount);
    const storedInRegimeStr =
      this.#formattingService.formatCount(storedInRegimeCount);
    const limitStr = this.#formattingService.formatCount(storedContextLimit);
    const needsLimitNote =
      Number.isFinite(sampleCount) &&
      Number.isFinite(storedContextCount) &&
      Number.isFinite(storedContextLimit) &&
      storedContextLimit > 0 &&
      storedContextCount < sampleCount;

    const limitNote = needsLimitNote
      ? `\n> **Note**: Stored contexts are capped at ${limitStr}, so sections labeled "Population: stored-*" may not match full-sample counts.\n`
      : '';

    return `## Population Summary\n\n- **Total samples**: ${totalSampleStr} (in-regime ${inRegimeSampleStr}; ${this.#formattingService.formatPercentage(inRegimeSampleRate)})\n- **Stored contexts**: ${storedStr} of ${totalSampleStr} (in-regime ${storedInRegimeStr}; ${this.#formattingService.formatPercentage(storedInRegimeRate)}; limit ${limitStr})\n- **Mood regime**: AND-only mood constraints from prerequisites (moodAxes.* or mood.*).${limitNote}\n\n---\n`;
  }

  /**
   * Generate the report header section.
   * @param {string} expressionName
   * @param {object} simulationResult
   * @returns {string}
   */
  generateHeader(expressionName, simulationResult) {
    const timestamp = new Date().toISOString();
    const distribution = simulationResult.distribution ?? 'uniform';
    const sampleCount = simulationResult.sampleCount ?? 0;
    const samplingMode = simulationResult.samplingMode ?? 'static';
    const samplingMetadata = simulationResult.samplingMetadata ?? {};

    // Build sampling mode description
    const samplingDescription =
      samplingMetadata.description ??
      (samplingMode === 'static'
        ? 'Prototype-gated sampling (emotions derived from mood axes; not independent)'
        : 'Coupled sampling (tests fixed transition model)');

    return `# Monte Carlo Analysis Report\n\n**Expression**: ${expressionName}\n**Generated**: ${timestamp}\n**Distribution**: ${distribution}\n**Sample Size**: ${sampleCount}\n**Sampling Mode**: ${samplingMode} - ${samplingDescription}\n**Gating model**: HARD (gate fail => final = 0)\n**Regime Note**: Report includes global vs in-regime (mood-pass) statistics\n\n${samplingMetadata.note ? `> **Note**: ${samplingMetadata.note}` : ''}\n\n---\n`;
  }

  /**
   * Generate a concise integrity summary block near the top of the report.
   * @param {Array<object>} warnings
   * @returns {string}
   */
  generateIntegritySummarySection(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) {
      return '';
    }

    const integrityWarnings = warnings.filter((warning) =>
      typeof warning?.code === 'string' && warning.code.startsWith('I')
    );
    if (integrityWarnings.length === 0) {
      return '';
    }

    const mismatchWarnings = integrityWarnings.filter((warning) =>
      this.#isGateMismatchWarning(warning)
    );
    const mismatchCount = mismatchWarnings.length;
    const affectedPrototypes = [
      ...new Set(
        mismatchWarnings.map((warning) => warning.prototypeId).filter(Boolean)
      ),
    ];

    const exampleIndices = [];
    for (const warning of mismatchWarnings) {
      const sampleIndices = warning?.details?.sampleIndices;
      if (!Array.isArray(sampleIndices)) {
        continue;
      }
      for (const sampleIndex of sampleIndices) {
        if (exampleIndices.length >= REPORT_INTEGRITY_SAMPLE_LIMIT) {
          break;
        }
        if (!exampleIndices.includes(sampleIndex)) {
          exampleIndices.push(sampleIndex);
        }
      }
      if (exampleIndices.length >= REPORT_INTEGRITY_SAMPLE_LIMIT) {
        break;
      }
    }

    const warningCount = integrityWarnings.length;
    const reliabilityLabel = mismatchCount > 0 ? 'UNRELIABLE' : 'OK';
    const mismatchNote =
      mismatchCount > 0
        ? '\n> **Note**: Gate-dependent metrics (pass rates, blocker stats) are unreliable while mismatches exist.\n'
        : '\n';

    const prototypeLabel =
      affectedPrototypes.length > 0 ? affectedPrototypes.join(', ') : 'None';
    const exampleLabel =
      exampleIndices.length > 0 ? exampleIndices.join(', ') : 'None';

    return `## Integrity Summary\n\n- **Integrity warnings**: ${warningCount}\n- **Gate/final mismatches**: ${mismatchCount}\n- **Gate-dependent metrics**: ${reliabilityLabel}\n- **Affected prototypes**: ${prototypeLabel}\n- **Example indices**: ${exampleLabel}${mismatchNote}\n---\n`;
  }

  /**
   * Generate a short signal lineage section (raw -> gated -> final).
   * @returns {string}
   */
  generateSignalLineageSection() {
    return `## Signal Lineage\n\n- **Raw**: Weighted sum of normalized axes (clamped to 0..1).\n- **Gated**: Raw value when gate constraints pass; otherwise 0.\n- **Final**: Hard-gated output (final = gated).\n\n**Gate input scales**\n- Mood axes: raw [-100, 100] -> normalized [-1, 1]\n- Sexual axes: raw [0, 100] -> normalized [0, 1] (sexual_arousal derived, clamped)\n- Affect traits: raw [0, 100] -> normalized [0, 1]\n\n---\n`;
  }

  /**
   * Generate the executive summary section.
   * @param {object} simulationResult
   * @param {string} summary
   * @returns {string}
   */
  generateExecutiveSummary(simulationResult, summary) {
    const triggerRate = simulationResult.triggerRate ?? 0;
    const ci = simulationResult.confidenceInterval ?? { low: 0, high: 0 };
    const rarity = this.#getRarityCategory(triggerRate);

    // Clarify that 0 triggers ≠ logically impossible
    const rarityNote =
      triggerRate === 0
        ? ` (not triggered in ${simulationResult.sampleCount ?? 'N/A'} samples—trigger rate is below ${this.#formattingService.formatPercentage(ci.high)} upper bound, not logically impossible)`
        : '';

    return `## Executive Summary\n\n**Trigger Rate**: ${this.#formattingService.formatPercentage(triggerRate)} (95% CI: ${this.#formattingService.formatPercentage(ci.low)} - ${this.#formattingService.formatPercentage(ci.high)})\n**Rarity**: ${rarity}${rarityNote}\n\n${summary || 'No summary available.'}\n\n---\n`;
  }

  /**
   * Generate the Sampling Coverage section.
   * @param {object|null} samplingCoverage
   * @param {string|null} samplingMode
   * @returns {string}
   */
  generateSamplingCoverageSection(samplingCoverage, samplingMode) {
    if (!samplingCoverage) {
      return '';
    }

    const summaryByDomain = samplingCoverage.summaryByDomain ?? [];
    const variables = samplingCoverage.variables ?? [];
    const config = samplingCoverage.config ?? {};

    if (summaryByDomain.length === 0 && variables.length === 0) {
      return '';
    }

    let section = '## Sampling Coverage\n\n';

    if (samplingMode) {
      section += `**Sampling Mode**: ${samplingMode}\n\n`;
    }

    if (summaryByDomain.length > 0) {
      section += '### Summary by Domain\n\n';
      section += '| Domain | Variables | Range Coverage | Bin Coverage | Tail Low | Tail High | Zero Rate Avg | Rating |\n';
      section += '|--------|-----------|----------------|--------------|----------|-----------|---------------|--------|\n';

      for (const summary of summaryByDomain) {
        section += `| ${summary.domain} | ${summary.variableCount} | ${this.#formattingService.formatPercentage(summary.rangeCoverageAvg)} | ${this.#formattingService.formatPercentage(summary.binCoverageAvg)} | ${this.#formattingService.formatPercentage(summary.tailCoverageAvg?.low)} | ${this.#formattingService.formatPercentage(summary.tailCoverageAvg?.high)} | ${this.#formattingService.formatPercentage(summary.zeroRateAvg)} | ${summary.rating} |\n`;
      }
      section += '\n';
    }

    const lowestCoverageVariables = this.#getLowestCoverageVariables(variables, 5);
    if (lowestCoverageVariables.length > 0) {
      section += '### Lowest Coverage Variables\n\n';
      section += '| Variable | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |\n';
      section += '|----------|----------------|--------------|----------|-----------|--------|\n';

      for (const variable of lowestCoverageVariables) {
        section += `| ${variable.variablePath} | ${this.#formattingService.formatPercentage(variable.rangeCoverage)} | ${this.#formattingService.formatPercentage(variable.binCoverage)} | ${this.#formattingService.formatPercentage(variable.tailCoverage?.low)} | ${this.#formattingService.formatPercentage(variable.tailCoverage?.high)} | ${variable.rating} |\n`;
      }
      section += '\n';
    }

    const binCount = Number.isFinite(config.binCount) ? config.binCount : null;
    const tailPercent = Number.isFinite(config.tailPercent) ? config.tailPercent : null;
    section += 'Notes:\n';
    section += '- Range coverage is observed span divided by domain span.\n';
    section += binCount
      ? `- Bin coverage is occupancy across ${binCount} equal-width bins.\n`
      : '- Bin coverage is occupancy across equal-width bins.\n';
    section += tailPercent !== null
      ? `- Tail coverage is the share of samples in the bottom/top ${this.#formattingService.formatPercentage(tailPercent)} of the domain.\n`
      : '- Tail coverage is the share of samples in the bottom/top of the domain.\n';
    section += '- Variables with unknown domain ranges are excluded from summaries.\n\n';

    const warningDomains = summaryByDomain.filter(
      (summary) => summary.rating === 'poor'
    );
    if (warningDomains.length > 0) {
      const domainList = warningDomains.map((summary) => summary.domain).join(', ');
      const modeNote = samplingMode ? ` (sampling mode: ${samplingMode})` : '';
      section += `> ⚠️ Sampling coverage is low for ${domainList}${modeNote}. Trigger rates may be understated.\n\n`;
    }

    const conclusions = buildSamplingCoverageConclusions(samplingCoverage, {
      includeWatchlist: true,
    });
    const conclusionItems = [
      ...conclusions.domainConclusions,
      ...conclusions.variableSummary,
      ...conclusions.globalImplications,
      ...conclusions.watchlist,
    ];

    if (conclusionItems.length > 0) {
      section += '### Coverage Conclusions\n\n';
      section += `${conclusionItems
        .map((item) => `- ${item.text}`)
        .join('\n')}\n\n`;
    }

    section += '---\n';
    return section;
  }

  /**
   * Generate the ground-truth witnesses section.
   * These are actual samples that triggered the expression during simulation,
   * validated by the same evaluator used for statistics.
   * @param {object} simulationResult
   * @returns {string}
   */
  generateWitnessSection(simulationResult) {
    const witnessAnalysis = simulationResult.witnessAnalysis ?? {};
    const witnesses = witnessAnalysis.witnesses ?? [];

    if (witnesses.length === 0) {
      // No triggers - show nearest miss analysis if available
      const nearestMiss = simulationResult.nearestMiss;
      const nearestMissSection = this.#generateNearestMissSection(nearestMiss);

      return `## Ground-Truth Witnesses\n\nNo triggering states found during simulation.\n\n${nearestMissSection}\n---\n`;
    }

    const witnessSections = witnesses.map((w, i) =>
      this.#witnessFormatter.formatWitness(w, i + 1)
    );

    return `## Ground-Truth Witnesses\n\nThese states were verified to trigger the expression during simulation.\nEach witness represents a valid combination of mood, sexual state, and affect traits.\n\n${witnessSections.join('\n\n')}\n\n---\n`;
  }

  /**
   * Render the report integrity warnings section.
   * @param {Array<object>} warnings
   * @returns {string}
   */
  generateReportIntegrityWarningsSection(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) {
      return '';
    }

    const lines = warnings.map((warning) => {
      const meta = [];
      if (warning.populationHash) {
        meta.push(`population=${warning.populationHash}`);
      }
      if (warning.prototypeId) {
        meta.push(`prototype=${warning.prototypeId}`);
      }
      if (warning.signal) {
        meta.push(`signal=${warning.signal}`);
      }

      const metaStr = meta.length > 0 ? ` [${meta.join('; ')}]` : '';
      const sampleIndices = warning?.details?.sampleIndices;
      const examples =
        Array.isArray(sampleIndices) && sampleIndices.length > 0
          ? ` examples: index ${sampleIndices.join(', ')}`
          : '';
      return `- ${warning.code}: ${warning.message}${metaStr}${examples}`;
    });

    const hasGateMismatchWarning = warnings.some((warning) =>
      typeof warning?.code === 'string' && warning.code.startsWith('I')
    );
    const impactNote = hasGateMismatchWarning
      ? '\n\n> **Impact (full sample)**: Gate/final mismatches can invalidate pass-rate and blocker metrics; treat threshold feasibility as provisional until resolved.\n'
      : '\n';
    return `## Report Integrity Warnings\n${lines.join('\n')}${impactNote}`;
  }

  /**
   * Generate the legend section (appears once at end of report).
   * @returns {string}
   */
  generateLegend() {
    return `## Legend\n\n### Global Metrics\n- **Trigger Rate**: Probability (0-100%) that the expression evaluates to true across random samples\n- **Confidence Interval**: 95% Wilson score interval indicating statistical certainty of the trigger rate\n- **Sample Size**: Number of random state pairs generated for simulation\n- **Rarity Categories**: impossible (0%), extremely_rare (<0.001%), rare (<0.05%), normal (<2%), frequent (>=2%)\n\n### Per-Clause Metrics\n- **Fail% global**: Percentage of samples where this specific clause evaluated to false (unconditional)\n- **Fail% | mood-pass**: Percentage of samples where this clause evaluated to false within the mood regime\n- **Gate pass (mood)**: Percentage of mood-regime samples where gates passed (emotion-threshold clauses only)\n- **Gate clamp (mood)**: Percentage of mood-regime samples where gates failed and the final intensity was clamped to 0 (emotion-threshold clauses only)\n- **Pass | gate (mood)**: Percentage of gate-pass samples that passed the threshold within the mood regime (emotion-threshold clauses only)\n- **Pass | mood (mood)**: Percentage of mood-regime samples that passed the threshold (emotion-threshold clauses only)\n- **Support**: Number of samples evaluated for this clause (evaluation count)\n- **Clamp-trivial (regime)**: Clause is trivially satisfied because gates always clamp intensity to 0 in regime (<= or < thresholds only)\n- **Violation Magnitude**: How far the actual value was from the threshold when the clause failed\n- **P50 (Median)**: Middle value of violations; 50% of failures had violations at or below this\n- **P90 (90th Percentile)**: 90% of failures had violations at or below this; indicates severity of worst cases\n- **P95 (95th Percentile)**: 95% of failures had violations at or below this; shows extreme violations\n- **P99 (99th Percentile)**: 99% of failures had violations at or below this; identifies outlier violations\n- **Min Observed**: Lowest value observed for this variable across all samples\n- **Mean Observed**: Average value observed for this variable across all samples\n- **Near-Miss Rate**: Percentage of ALL samples where the value was within epsilon of the threshold (close calls)\n- **Epsilon**: The tolerance distance used to detect near-misses (typically 5% of value range)\n- **Sole-Blocker Rate (N)**: Failure rate among samples where ALL OTHER clauses passed. N differs per clause because each clause excludes itself from the "others" check: Clause A's N = samples where B,C,D... passed; Clause B's N = samples where A,C,D... passed. This variance is mathematically correct and order-invariant\n- **Bound**: The relevant extreme value for verifying Gap. For \`>=\` operators: Max Observed (highest value seen). For \`<=\` operators: Min Observed (lowest value seen)\n- **Ceiling Gap**: Direction-aware calculation. For \`>=\` operators: (Threshold - Max Observed). For \`<=\` operators: (Min Observed - Threshold). Positive = threshold unreachable; negative = threshold achievable\n\n### Tunability Levels\n- **High**: >10% near-miss rate; threshold adjustments will help significantly\n- **Moderate**: 2-10% near-miss rate; threshold adjustments may help somewhat\n- **Low**: <2% near-miss rate; threshold adjustments won't help; fix upstream\n\n### Severity Levels\n- **Critical**: Ceiling detected or fundamentally broken condition\n- **High**: Decisive blocker with tuning potential\n- **Medium**: Moderate contributor to failures\n- **Low**: Other clauses fail first; lower priority\n\n### Recommended Actions\n- **redesign**: Condition is fundamentally problematic; rethink the logic\n- **tune_threshold**: Adjust threshold value; quick win available\n- **adjust_upstream**: Modify prototypes, gates, or weights that feed this variable\n- **lower_priority**: Focus on other blockers first\n- **investigate**: Needs further analysis\n\n### Problem Flags\n- **[CEILING]**: Threshold is unreachable (max observed never reaches threshold)\n- **[DECISIVE]**: This clause is the primary bottleneck\n- **[TUNABLE]**: Many samples are borderline; small adjustments help\n- **[UPSTREAM]**: Values are far from threshold; fix upstream data\n- **[OUTLIERS-SKEW]**: Median violation much lower than mean (outliers skew average)\n- **[SEVERE-TAIL]**: Some samples fail badly while most are moderate\n`;
  }

  /**
   * Generate the static analysis cross-reference section.
   * Compares static analysis findings with Monte Carlo observations.
   * @param {object|null} staticAnalysis - Static analysis results
   * @param {object[]} blockers - MC blocker results for comparison
   * @returns {string}
   */
  generateStaticCrossReference(staticAnalysis, blockers) {
    // Skip section if no static analysis data
    if (
      !staticAnalysis ||
      ((!staticAnalysis.gateConflicts ||
        staticAnalysis.gateConflicts.length === 0) &&
        (!staticAnalysis.unreachableThresholds ||
          staticAnalysis.unreachableThresholds.length === 0))
    ) {
      return '';
    }

    const lines = [
      '## Static Analysis Cross-Reference',
      '',
      'This section compares findings from static analysis with Monte Carlo observations.',
      '',
    ];

    // Gate Conflicts Section
    if (staticAnalysis.gateConflicts && staticAnalysis.gateConflicts.length > 0) {
      lines.push('### Gate Conflicts');
      lines.push('');
      lines.push('| Axis | Conflict | Static Result | MC Confirmation |');
      lines.push('|------|----------|---------------|-----------------|');

      for (const conflict of staticAnalysis.gateConflicts) {
        const axis = conflict.axis || 'unknown';
        const conflictDesc = this.#formatGateConflict(conflict);
        const mcConfirmation = this.#checkMcConfirmation(axis, blockers);

        lines.push(`| ${axis} | ${conflictDesc} | ❌ Impossible | ${mcConfirmation} |`);
      }

      lines.push('');
    }

    // Unreachable Thresholds Section
    if (
      staticAnalysis.unreachableThresholds &&
      staticAnalysis.unreachableThresholds.length > 0
    ) {
      lines.push('### Unreachable Thresholds');
      lines.push('');
      lines.push('| Prototype | Required | Max Possible | Gap | MC Confirmation |');
      lines.push('|-----------|----------|--------------|-----|-----------------|');

      for (const issue of staticAnalysis.unreachableThresholds) {
        const prototypeId = issue.prototypeId || 'unknown';
        const threshold =
          typeof issue.threshold === 'number'
            ? this.#formattingService.formatNumber(issue.threshold)
            : '?';
        const maxPossible =
          typeof issue.maxPossible === 'number'
            ? this.#formattingService.formatNumber(issue.maxPossible)
            : '?';
        const gap =
          typeof issue.threshold === 'number' &&
          typeof issue.maxPossible === 'number'
            ? this.#formattingService.formatNumber(
              issue.threshold - issue.maxPossible
            )
            : '?';
        const mcConfirmation = this.#checkEmotionMcConfirmation(
          prototypeId,
          blockers
        );

        lines.push(
          `| ${prototypeId} | ${threshold} | ${maxPossible} | +${gap} | ${mcConfirmation} |`
        );
      }

      lines.push('');
    }

    // Summary
    lines.push('### Cross-Reference Summary');
    lines.push('');

    const totalStaticIssues =
      (staticAnalysis.gateConflicts?.length || 0) +
      (staticAnalysis.unreachableThresholds?.length || 0);

    const hasMcBlockers = blockers && blockers.length > 0;

    if (hasMcBlockers) {
      lines.push(
        '✅ **Confirmed**: Static analysis issues are corroborated by Monte Carlo simulation.'
      );
    } else {
      lines.push(
        '⚠️ **Discrepancy**: Static analysis found issues but MC shows no blockers. May indicate path-sensitivity.'
      );
    }

    lines.push('');

    return lines.join('\n');
  }

  #contextMatchesConstraints(context, moodConstraints) {
    if (!Array.isArray(moodConstraints) || moodConstraints.length === 0) {
      return true;
    }

    return moodConstraints.every((constraint) => {
      const value = this.#statisticalService.getNestedValue(
        context,
        constraint.varPath
      );
      return evaluateConstraint(
        value,
        constraint.operator,
        constraint.threshold
      );
    });
  }

  #generateNearestMissSection(nearestMiss) {
    if (!nearestMiss || !nearestMiss.failedLeaves) {
      return '';
    }

    const { failedLeafCount, failedLeaves } = nearestMiss;
    const totalLeaves = failedLeafCount + (nearestMiss.passedLeafCount ?? 0);

    let section = `### Nearest Miss Analysis\n\n**Best Sample**: Failed ${failedLeafCount} condition${failedLeafCount === 1 ? '' : 's'}${totalLeaves > 0 ? ` (out of ~${totalLeaves} evaluated)` : ''}\n\nThis sample came closest to triggering the expression. Focus on these failing conditions:\n\n`;

    // Format each failing leaf with its violation details
    for (let i = 0; i < failedLeaves.length; i++) {
      const leaf = failedLeaves[i];
      const desc = leaf.description ?? 'Unknown condition';
      let detail = `${i + 1}. \`${desc}\``;

      if (leaf.actual !== null && leaf.threshold !== null) {
        const actualStr = this.#formattingService.formatNumber(leaf.actual);
        const threshStr = this.#formattingService.formatNumber(leaf.threshold);
        const violationStr =
          typeof leaf.violation === 'number'
            ? this.#formattingService.formatNumber(Math.abs(leaf.violation))
            : 'N/A';
        detail += ` - Actual: ${actualStr}, Threshold: ${threshStr}, Gap: ${violationStr}`;
      }

      section += detail + '\n';
    }

    if (failedLeaves.length > 0) {
      section += `\n**Insight**: These are the conditions preventing this expression from triggering.\nConsider adjusting thresholds or upstream prototypes for the conditions with the smallest gaps.\n`;
    }

    return section;
  }

  #getLowestCoverageVariables(variables, limit) {
    return this.#dataExtractor.getLowestCoverageVariables(variables, limit);
  }

  #isGateMismatchWarning(warning) {
    const code = warning?.code;
    if (typeof code !== 'string') {
      return false;
    }
    return (
      code.startsWith('I1_') ||
      code.startsWith('I2_') ||
      code.startsWith('I3_')
    );
  }

  #formatGateConflict(conflict) {
    if (conflict.description) {
      return conflict.description;
    }

    const requiredMin = conflict.requiredMin;
    const requiredMax = conflict.requiredMax;

    if (typeof requiredMin === 'number' && typeof requiredMax === 'number') {
      if (requiredMin > requiredMax) {
        return `Requires ≥${this.#formattingService.formatNumber(requiredMin)} AND ≤${this.#formattingService.formatNumber(requiredMax)}`;
      }
    }

    return 'Conflicting constraints';
  }

  #checkMcConfirmation(axis, blockers) {
    if (!blockers || blockers.length === 0) {
      return '— No MC data';
    }

    // Check if any blocker references this axis
    for (const blocker of blockers) {
      const varPath = blocker.hierarchicalBreakdown?.variablePath || '';
      if (varPath.includes(axis) || varPath.includes(`moodAxes.${axis}`)) {
        const failRate = blocker.hierarchicalBreakdown?.failureRate;
        const inRegimeFailRate =
          blocker.hierarchicalBreakdown?.inRegimeFailureRate;
        if (typeof failRate === 'number') {
          return `✅ Fail% global: ${this.#formattingService.formatPercentage(failRate)} | Fail% \\| mood-pass: ${this.#formattingService.formatPercentage(inRegimeFailRate)}`;
        }
        return '✅ Confirmed';
      }
    }

    return '— Not observed';
  }

  #checkEmotionMcConfirmation(prototypeId, blockers) {
    if (!blockers || blockers.length === 0) {
      return '— No MC data';
    }

    // Check if any blocker references this emotion/prototype
    for (const blocker of blockers) {
      const varPath = blocker.hierarchicalBreakdown?.variablePath || '';
      if (
        varPath.includes(`emotions.${prototypeId}`) ||
        varPath.includes(`sexualStates.${prototypeId}`)
      ) {
        const failRate = blocker.hierarchicalBreakdown?.failureRate;
        const inRegimeFailRate =
          blocker.hierarchicalBreakdown?.inRegimeFailureRate;
        if (typeof failRate === 'number') {
          return `✅ Fail% global: ${this.#formattingService.formatPercentage(failRate)} | Fail% \\| mood-pass: ${this.#formattingService.formatPercentage(inRegimeFailRate)}`;
        }
        return '✅ Confirmed';
      }
    }

    return '— Not observed';
  }

  #getRarityCategory(triggerRate) {
    if (triggerRate === 0) return 'unobserved';
    if (triggerRate < 0.00001) return 'extremely_rare';
    if (triggerRate < 0.0005) return 'rare';
    if (triggerRate < 0.02) return 'normal';
    return 'frequent';
  }
}

export default CoreSectionGenerator;
