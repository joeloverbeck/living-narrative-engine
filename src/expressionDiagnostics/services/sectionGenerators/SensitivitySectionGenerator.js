/**
 * @file SensitivitySectionGenerator - Generates sensitivity analysis report sections
 * @description Generates sensitivity analysis sections for Monte Carlo reports.
 * Includes special handling for zero-hit cases where traditional sensitivity
 * sweeps are not informative.
 */

import { actionabilityConfig } from '../../config/actionabilityConfig.js';

/**
 * Target pass rates for threshold suggestions in zero-hit analysis.
 * @constant {number[]}
 */
const TARGET_PASS_RATES = [0.01, 0.05, 0.1]; // 1%, 5%, 10%

class SensitivitySectionGenerator {
  #formattingService;
  #sweepWarningBuilder;

  constructor({ formattingService, sweepWarningBuilder = null } = {}) {
    if (!formattingService) {
      throw new Error('SensitivitySectionGenerator requires formattingService');
    }

    this.#formattingService = formattingService;
    this.#sweepWarningBuilder = sweepWarningBuilder;
  }

  #getSensitivityKindMetadata(kind, fallbackKind = 'marginalClausePassRateSweep') {
    const resolvedKind = kind ?? fallbackKind;

    switch (resolvedKind) {
      case 'expressionTriggerRateSweep':
        return {
          label: 'Global Expression Sensitivity',
          sectionTitle: 'Global Expression Sensitivity Analysis',
          sectionIntro:
            'This section shows how adjusting thresholds affects the **entire expression trigger rate**, not just individual clause pass rates.',
        };
      case 'marginalClausePassRateSweep':
      default:
        return {
          label: 'Marginal Clause Pass-Rate Sweep',
          sectionTitle: 'Marginal Clause Pass-Rate Sweep',
          sectionIntro:
            'This sweep shows how adjusting thresholds changes marginal clause pass rates across stored contexts.',
          disclaimer:
            'It does **not** estimate overall expression trigger rate.',
        };
    }
  }

  #buildSweepWarnings(result, options) {
    if (typeof this.#sweepWarningBuilder !== 'function') {
      return [];
    }

    return this.#sweepWarningBuilder(result, options) ?? [];
  }

  /**
   * Generate sensitivity analysis section showing how threshold changes affect pass rates.
   * @param {import('../MonteCarloSimulator.js').SensitivityResult[]} sensitivityData
   * @returns {string}
   */
  generateSensitivityAnalysis(
    sensitivityData,
    populationSummary,
    storedPopulations,
    sweepWarningContext = null
  ) {
    if (!sensitivityData || sensitivityData.length === 0) {
      return '';
    }

    const kindMetadata = this.#getSensitivityKindMetadata(
      sensitivityData?.[0]?.kind,
      'marginalClausePassRateSweep'
    );
    const sections = sensitivityData.map((result) =>
      this.formatSensitivityResult(result, sweepWarningContext)
    );

    const populationLabel =
      this.#formattingService.formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedGlobal ?? null
      );

    const disclaimerLine = kindMetadata.disclaimer
      ? `${kindMetadata.disclaimer}\n`
      : '';

    return `## ${kindMetadata.sectionTitle}

${kindMetadata.sectionIntro}
${disclaimerLine}${populationLabel}${sections.join('\n\n')}`;
  }

  /**
   * Format a single sensitivity result as a markdown table.
   * For zero-hit cases, provides alternative analysis instead of misleading "+∞" changes.
   * @param {import('../MonteCarloSimulator.js').SensitivityResult} result
   * @param {object|null} sweepWarningContext
   * @returns {string}
   */
  formatSensitivityResult(result, sweepWarningContext = null) {
    const { conditionPath, operator, originalThreshold, grid } = result;
    const isIntegerDomain = result?.isIntegerDomain === true;
    const kindMetadata = this.#getSensitivityKindMetadata(
      result?.kind,
      'marginalClausePassRateSweep'
    );

    if (!grid || grid.length === 0) {
      return '';
    }

    const originalIndex = grid.findIndex(
      (pt) => Math.abs(pt.threshold - originalThreshold) < 0.001
    );

    // Check for zero-hit baseline case
    const originalRate = originalIndex >= 0 ? grid[originalIndex].passRate : 0;
    if (originalRate === 0) {
      return this.#formatZeroHitAlternative(result, sweepWarningContext);
    }

    const lines = [
      `### ${kindMetadata.label}: ${conditionPath} ${operator} [threshold]`,
      '',
      this.#formattingService.formatSweepWarningsInline(
        this.#buildSweepWarnings(result, {
          rateKey: 'passRate',
          scope: 'marginal',
          andOnly: sweepWarningContext?.andOnly === true,
          baselineTriggerRate:
            typeof sweepWarningContext?.baselineTriggerRate === 'number'
              ? sweepWarningContext.baselineTriggerRate
              : null,
        })
      ),
      isIntegerDomain
        ? '| Threshold | Effective Threshold | Pass Rate | Change | Samples |'
        : '| Threshold | Pass Rate | Change | Samples |',
      isIntegerDomain
        ? '|-----------|---------------------|-----------|--------|---------|'
        : '|-----------|-----------|--------|---------|',
    ];

    for (let i = 0; i < grid.length; i++) {
      const point = grid[i];
      const isOriginal = i === originalIndex;

      let changeStr = '—';
      if (originalIndex >= 0 && i !== originalIndex) {
        changeStr = this.#formatRateChange(originalRate, point.passRate);
      }

      const thresholdStr = isOriginal
        ? `**${this.#formattingService.formatThresholdValue(point.threshold, isIntegerDomain)}**`
        : this.#formattingService.formatThresholdValue(point.threshold, isIntegerDomain);
      const rateStr = isOriginal
        ? `**${this.#formattingService.formatPercentage(point.passRate)}**`
        : this.#formattingService.formatPercentage(point.passRate);
      const samplesStr = point.sampleCount.toLocaleString();
      const changeDisplay = isOriginal
        ? '**baseline (stored contexts)**'
        : changeStr;

      if (isIntegerDomain) {
        const effectiveThresholdStr = isOriginal
          ? `**${this.#formattingService.formatEffectiveThreshold(point.effectiveThreshold)}**`
          : this.#formattingService.formatEffectiveThreshold(point.effectiveThreshold);
        lines.push(
          `| ${thresholdStr} | ${effectiveThresholdStr} | ${rateStr} | ${changeDisplay} | ${samplesStr} |`
        );
      } else {
        lines.push(
          `| ${thresholdStr} | ${rateStr} | ${changeDisplay} | ${samplesStr} |`
        );
      }
    }

    if (isIntegerDomain) {
      lines.push('');
      lines.push(
        '_Thresholds are integer-effective; decimals collapse to integer boundaries._'
      );
      lines.push('');
    }

    // Recommendation for low but non-zero pass rates (originalRate already defined above)
    if (originalRate > 0 && originalRate < 0.01) {
      const betterOption = grid.find((pt) => pt.passRate >= originalRate * 10);
      if (betterOption && betterOption.threshold !== originalThreshold) {
        lines.push('');
        lines.push(
          `**💡 Recommendation**: Consider adjusting threshold to ${this.#formattingService.formatThresholdValue(
            betterOption.threshold,
            isIntegerDomain
          )} for ~${this.#formattingService.formatPercentage(betterOption.passRate)} pass rate.`
        );
      }
    }

    // Add threshold suggestions for low but non-zero pass rates (1-10%)
    if (
      actionabilityConfig.thresholdSuggestions.enabled &&
      actionabilityConfig.thresholdSuggestions.includeInNonZeroHitCases &&
      originalRate > 0 &&
      originalRate < 0.1
    ) {
      const suggestions = this.#computeThresholdSuggestions(
        grid,
        originalThreshold,
        operator,
        isIntegerDomain,
        'passRate'
      );
      if (suggestions.length > 0) {
        lines.push('');
        lines.push('#### Threshold Suggestions for Higher Pass Rates');
        lines.push('');
        lines.push(
          this.#formatThresholdSuggestionsTable(
            suggestions,
            conditionPath,
            isIntegerDomain
          )
        );
      }
    }

    return lines.join('\n');
  }

  // ============================================================================
  // Zero-Hit Alternative Analysis
  // ============================================================================

  /**
   * Format alternative analysis for zero-hit marginal clause pass rate sweeps.
   * Replaces misleading "+∞" changes with actionable quantile and threshold information.
   * @param {object} result - Sensitivity result object
   * @param {object|null} sweepWarningContext
   * @returns {string}
   */
  #formatZeroHitAlternative(result, _sweepWarningContext = null) {
    const { conditionPath, operator, originalThreshold, grid } = result;
    const isIntegerDomain = result?.isIntegerDomain === true;
    const sampleCount = grid?.[0]?.sampleCount ?? 0;

    const lines = [
      `### 🟡 Zero-Hit Analysis: ${conditionPath} ${operator} [threshold]`,
      '',
      `> We found **0 passing samples** out of ${sampleCount.toLocaleString()} at the original threshold (${this.#formattingService.formatThresholdValue(originalThreshold, isIntegerDomain)}).`,
      `> Traditional sensitivity sweeps showing "+∞" changes are not informative in this case.`,
      '',
    ];

    // Add threshold distribution from grid
    lines.push('#### Pass Rate by Threshold');
    lines.push('');
    lines.push(this.#formatPassRateDistributionTable(grid, originalThreshold, isIntegerDomain));
    lines.push('');

    // Add threshold suggestions for target pass rates
    const suggestions = this.#computeThresholdSuggestions(grid, originalThreshold, operator, isIntegerDomain, 'passRate');
    if (suggestions.length > 0) {
      lines.push('#### 💡 Suggested Threshold Adjustments for Target Pass Rates');
      lines.push('');
      lines.push(this.#formatThresholdSuggestionsTable(suggestions, conditionPath, isIntegerDomain));
      lines.push('');
    }

    // Add nearest miss analysis
    const nearestMiss = this.#findNearestMiss(grid, originalThreshold, 'passRate');
    if (nearestMiss) {
      lines.push('#### Nearest Miss Analysis');
      lines.push('');
      lines.push(this.#formatNearestMissSection(nearestMiss, operator, isIntegerDomain, 'passRate'));
    }

    return lines.join('\n');
  }

  /**
   * Format alternative analysis for zero-hit global expression sensitivity sweeps.
   * @param {object} result - Sensitivity result object
   * @param {object|null} sweepWarningContext
   * @returns {string}
   */
  #formatGlobalZeroHitAlternative(result, _sweepWarningContext = null) {
    const { varPath, operator, originalThreshold, grid } = result;
    const isIntegerDomain = result?.isIntegerDomain === true;
    const sampleCount = grid?.[0]?.sampleCount ?? 0;

    const lines = [
      `### 🎯🟡 Zero-Hit Global Analysis: ${varPath} ${operator} [threshold]`,
      '',
      '> **Note**: This analyzes the ENTIRE EXPRESSION trigger rate.',
      '',
      `> We found **0 expression triggers** out of ${sampleCount.toLocaleString()} samples at the original threshold (${this.#formattingService.formatThresholdValue(originalThreshold, isIntegerDomain)}).`,
      `> Traditional sensitivity sweeps cannot estimate expression trigger rate in this case.`,
      '',
    ];

    // Add trigger rate distribution from grid
    lines.push('#### Trigger Rate by Threshold');
    lines.push('');
    lines.push(this.#formatTriggerRateDistributionTable(grid, originalThreshold, isIntegerDomain));
    lines.push('');

    // Add threshold suggestions for target trigger rates
    const suggestions = this.#computeThresholdSuggestions(grid, originalThreshold, operator, isIntegerDomain, 'triggerRate');
    if (suggestions.length > 0) {
      lines.push('#### 💡 Suggested Threshold Adjustments for Target Trigger Rates');
      lines.push('');
      lines.push(this.#formatThresholdSuggestionsTable(suggestions, varPath, isIntegerDomain));
      lines.push('');
    }

    // Add nearest miss analysis
    const nearestMiss = this.#findNearestMiss(grid, originalThreshold, 'triggerRate');
    if (nearestMiss) {
      lines.push('#### Nearest Miss Analysis');
      lines.push('');
      lines.push(this.#formatNearestMissSection(nearestMiss, operator, isIntegerDomain, 'triggerRate'));
    } else {
      lines.push('#### ⚠️ No Triggers Found');
      lines.push('');
      lines.push('None of the tested thresholds produced expression triggers. The expression may require:');
      lines.push('- More extreme threshold changes');
      lines.push('- Addressing other blocking conditions');
      lines.push('- Reviewing the overall expression logic');
    }

    return lines.join('\n');
  }

  /**
   * Format pass rate distribution table from grid data.
   * @param {Array} grid - Grid points with threshold and passRate
   * @param {number} originalThreshold
   * @param {boolean} isIntegerDomain
   * @returns {string}
   */
  #formatPassRateDistributionTable(grid, originalThreshold, isIntegerDomain) {
    const lines = [
      '| Threshold | Pass Rate | Samples |',
      '|-----------|-----------|---------|',
    ];

    for (const point of grid) {
      const isOriginal = Math.abs(point.threshold - originalThreshold) < 0.001;
      const thresholdStr = isOriginal
        ? `**${this.#formattingService.formatThresholdValue(point.threshold, isIntegerDomain)}** (original)`
        : this.#formattingService.formatThresholdValue(point.threshold, isIntegerDomain);
      const rateStr = isOriginal
        ? `**${this.#formattingService.formatPercentage(point.passRate)}**`
        : this.#formattingService.formatPercentage(point.passRate);
      const samplesStr = point.sampleCount.toLocaleString();

      lines.push(`| ${thresholdStr} | ${rateStr} | ${samplesStr} |`);
    }

    return lines.join('\n');
  }

  /**
   * Format trigger rate distribution table from grid data.
   * @param {Array} grid - Grid points with threshold and triggerRate
   * @param {number} originalThreshold
   * @param {boolean} isIntegerDomain
   * @returns {string}
   */
  #formatTriggerRateDistributionTable(grid, originalThreshold, isIntegerDomain) {
    const lines = [
      '| Threshold | Trigger Rate | Samples |',
      '|-----------|--------------|---------|',
    ];

    for (const point of grid) {
      const isOriginal = Math.abs(point.threshold - originalThreshold) < 0.001;
      const thresholdStr = isOriginal
        ? `**${this.#formattingService.formatThresholdValue(point.threshold, isIntegerDomain)}** (original)`
        : this.#formattingService.formatThresholdValue(point.threshold, isIntegerDomain);
      const rateStr = isOriginal
        ? `**${this.#formattingService.formatPercentage(point.triggerRate)}**`
        : this.#formattingService.formatPercentage(point.triggerRate);
      const samplesStr = point.sampleCount.toLocaleString();

      lines.push(`| ${thresholdStr} | ${rateStr} | ${samplesStr} |`);
    }

    return lines.join('\n');
  }

  /**
   * Compute threshold suggestions for target pass/trigger rates.
   * @param {Array} grid - Grid points
   * @param {number} originalThreshold
   * @param {string} operator
   * @param {boolean} isIntegerDomain
   * @param {string} rateKey - 'passRate' or 'triggerRate'
   * @returns {Array} Array of {targetRate, suggestedThreshold, achievedRate, delta}
   */
  #computeThresholdSuggestions(grid, originalThreshold, operator, isIntegerDomain, rateKey) {
    const suggestions = [];

    for (const targetRate of TARGET_PASS_RATES) {
      // Find grid points that bracket the target rate
      const achievingPoints = grid.filter((pt) => pt[rateKey] >= targetRate);
      if (achievingPoints.length === 0) {
        continue;
      }

      // Find the threshold closest to original that achieves the target
      const sorted = [...achievingPoints].sort((a, b) => {
        const deltaA = Math.abs(a.threshold - originalThreshold);
        const deltaB = Math.abs(b.threshold - originalThreshold);
        return deltaA - deltaB;
      });

      const best = sorted[0];
      const delta = best.threshold - originalThreshold;

      suggestions.push({
        targetRate,
        suggestedThreshold: best.threshold,
        achievedRate: best[rateKey],
        delta,
      });
    }

    return suggestions;
  }

  /**
   * Format threshold suggestions table.
   * @param {Array} suggestions
   * @param {string} varPath
   * @param {boolean} isIntegerDomain
   * @returns {string}
   */
  #formatThresholdSuggestionsTable(suggestions, varPath, isIntegerDomain) {
    const lines = [
      '| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |',
      '|-------------|---------------------|---------------|-------------|',
    ];

    for (const s of suggestions) {
      const targetStr = this.#formattingService.formatPercentage(s.targetRate);
      const thresholdStr = this.#formattingService.formatThresholdValue(s.suggestedThreshold, isIntegerDomain);
      const achievedStr = this.#formattingService.formatPercentage(s.achievedRate);
      const deltaStr = s.delta >= 0 ? `+${s.delta.toFixed(3)}` : s.delta.toFixed(3);

      lines.push(`| ${targetStr} | ${thresholdStr} | ${achievedStr} | ${deltaStr} |`);
    }

    if (suggestions.length > 0) {
      const firstSuggestion = suggestions[0];
      lines.push('');
      lines.push(
        `**Interpretation**: To achieve ~${this.#formattingService.formatPercentage(firstSuggestion.targetRate)} pass rate, ` +
        `adjust threshold by ${firstSuggestion.delta >= 0 ? '+' : ''}${firstSuggestion.delta.toFixed(3)} ` +
        `to ${this.#formattingService.formatThresholdValue(firstSuggestion.suggestedThreshold, isIntegerDomain)}.`
      );
    }

    return lines.join('\n');
  }

  // ============================================================================
  // Percent-Change Display Formatting
  // ============================================================================

  /**
   * Format rate change with absolute delta as primary and multiplier as secondary.
   * Shows percentage points (pp) for clarity instead of misleading percent changes.
   *
   * @param {number} originalRate - Original rate (0-1 scale)
   * @param {number} newRate - New rate (0-1 scale)
   * @returns {string} Formatted change string (e.g., "+1.14 pp (×58)")
   */
  #formatRateChange(originalRate, newRate) {
    // Calculate delta in percentage points
    const deltaPercent = (newRate - originalRate) * 100;

    // Handle zero-to-nonzero case
    if (originalRate === 0 && newRate > 0) {
      return `+${deltaPercent.toFixed(2)} pp (from zero)`;
    }

    // Handle nonzero-to-zero case
    if (originalRate > 0 && newRate === 0) {
      return `${deltaPercent.toFixed(2)} pp (→ 0)`;
    }

    // Handle zero-to-zero case
    if (originalRate === 0 && newRate === 0) {
      return '0 pp';
    }

    // Format the delta with sign
    const deltaStr = deltaPercent >= 0
      ? `+${deltaPercent.toFixed(2)} pp`
      : `${deltaPercent.toFixed(2)} pp`;

    // Calculate multiplier for context
    const multiplier = newRate / originalRate;

    // Include multiplier only for significant changes (>1.5× or <0.67×)
    if (multiplier > 1.5 || multiplier < 0.67) {
      if (multiplier >= 1000) {
        return `${deltaStr} (>1000×)`;
      } else if (multiplier <= 0.001) {
        return `${deltaStr} (<0.001×)`;
      } else {
        const multiplierStr = multiplier >= 10
          ? `×${Math.round(multiplier)}`
          : `×${multiplier.toFixed(1)}`;
        return `${deltaStr} (${multiplierStr})`;
      }
    }

    return deltaStr;
  }

  /**
   * Find the nearest miss - the first threshold with non-zero rate.
   * @param {Array} grid
   * @param {number} originalThreshold
   * @param {string} rateKey - 'passRate' or 'triggerRate'
   * @returns {object|null}
   */
  #findNearestMiss(grid, originalThreshold, rateKey) {
    // Find points with non-zero rate
    const nonZeroPoints = grid.filter((pt) => pt[rateKey] > 0);
    if (nonZeroPoints.length === 0) {
      return null;
    }

    // Find the one closest to original threshold
    const sorted = [...nonZeroPoints].sort((a, b) => {
      const deltaA = Math.abs(a.threshold - originalThreshold);
      const deltaB = Math.abs(b.threshold - originalThreshold);
      return deltaA - deltaB;
    });

    const nearest = sorted[0];
    return {
      threshold: nearest.threshold,
      rate: nearest[rateKey],
      delta: nearest.threshold - originalThreshold,
      sampleCount: nearest.sampleCount,
    };
  }

  /**
   * Format nearest miss section.
   * @param {object} nearestMiss
   * @param {string} operator
   * @param {boolean} isIntegerDomain
   * @param {string} rateKey
   * @returns {string}
   */
  #formatNearestMissSection(nearestMiss, operator, isIntegerDomain, rateKey) {
    const rateLabel = rateKey === 'triggerRate' ? 'trigger rate' : 'pass rate';
    const lines = [
      `The first threshold with non-zero ${rateLabel}:`,
      '',
      `- **Threshold**: ${this.#formattingService.formatThresholdValue(nearestMiss.threshold, isIntegerDomain)}`,
      `- **${rateKey === 'triggerRate' ? 'Trigger Rate' : 'Pass Rate'}**: ${this.#formattingService.formatPercentage(nearestMiss.rate)}`,
      `- **Δ from original**: ${nearestMiss.delta >= 0 ? '+' : ''}${nearestMiss.delta.toFixed(3)}`,
      '',
      `**Actionable Insight**: Adjusting threshold by ${nearestMiss.delta >= 0 ? '+' : ''}${nearestMiss.delta.toFixed(3)} ` +
      `would achieve ~${this.#formattingService.formatPercentage(nearestMiss.rate)} ${rateLabel}.`,
    ];

    return lines.join('\n');
  }

  /**
   * Format global expression sensitivity results.
   * Shows how changing a threshold affects the ENTIRE expression trigger rate.
   * @param {object} result
   * @returns {string}
   */
  formatGlobalSensitivityResult(result, sweepWarningContext = null) {
    const { varPath, operator, originalThreshold, grid } = result;
    const isIntegerDomain = result?.isIntegerDomain === true;
    const kindMetadata = this.#getSensitivityKindMetadata(
      result?.kind,
      'expressionTriggerRateSweep'
    );

    if (!grid || grid.length === 0) {
      return '';
    }

    const originalIndex = grid.findIndex(
      (pt) => Math.abs(pt.threshold - originalThreshold) < 0.001
    );

    // Check for zero-hit baseline case
    const originalRate = originalIndex >= 0 ? grid[originalIndex].triggerRate : 0;
    if (originalRate === 0) {
      return this.#formatGlobalZeroHitAlternative(result, sweepWarningContext);
    }

    const lines = [
      `### 🎯 ${kindMetadata.label}: ${varPath} ${operator} [threshold]`,
      '',
      this.#formattingService.formatSweepWarningsInline(
        this.#buildSweepWarnings(result, {
          rateKey: 'triggerRate',
          scope: 'expression',
          andOnly: sweepWarningContext?.andOnly === true,
          baselineTriggerRate:
            typeof sweepWarningContext?.baselineTriggerRate === 'number'
              ? sweepWarningContext.baselineTriggerRate
              : null,
        })
      ),
      '> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.',
      '',
      isIntegerDomain
        ? '| Threshold | Effective Threshold | Trigger Rate | Change | Samples |'
        : '| Threshold | Trigger Rate | Change | Samples |',
      isIntegerDomain
        ? '|-----------|---------------------|--------------|--------|---------|'
        : '|-----------|--------------|--------|---------|',
    ];

    for (let i = 0; i < grid.length; i++) {
      const point = grid[i];
      const isOriginal = i === originalIndex;

      let changeStr = '—';
      if (originalIndex >= 0 && i !== originalIndex) {
        changeStr = this.#formatRateChange(originalRate, point.triggerRate);
      }

      const thresholdStr = isOriginal
        ? `**${this.#formattingService.formatThresholdValue(point.threshold, isIntegerDomain)}**`
        : this.#formattingService.formatThresholdValue(point.threshold, isIntegerDomain);
      const rateStr = isOriginal
        ? `**${this.#formattingService.formatPercentage(point.triggerRate)}**`
        : this.#formattingService.formatPercentage(point.triggerRate);
      const samplesStr = point.sampleCount.toLocaleString();
      const changeDisplay = isOriginal
        ? '**baseline (stored contexts)**'
        : changeStr;

      if (isIntegerDomain) {
        const effectiveThresholdStr = isOriginal
          ? `**${this.#formattingService.formatEffectiveThreshold(point.effectiveThreshold)}**`
          : this.#formattingService.formatEffectiveThreshold(point.effectiveThreshold);
        lines.push(
          `| ${thresholdStr} | ${effectiveThresholdStr} | ${rateStr} | ${changeDisplay} | ${samplesStr} |`
        );
      } else {
        lines.push(
          `| ${thresholdStr} | ${rateStr} | ${changeDisplay} | ${samplesStr} |`
        );
      }
    }

    if (isIntegerDomain) {
      lines.push('');
      lines.push(
        '_Thresholds are integer-effective; decimals collapse to integer boundaries._'
      );
      lines.push('');
    }

    // Recommendation for low but non-zero trigger rates (originalRate already defined above)
    // Zero-hit cases are now handled by #formatGlobalZeroHitAlternative via early return
    if (originalRate > 0 && originalRate < 0.01) {
      const betterOption = grid.find((pt) => pt.triggerRate >= originalRate * 5);
      if (betterOption && betterOption.threshold !== originalThreshold) {
        lines.push('');
        lines.push(
          `**💡 Actionable Insight**: Adjusting threshold to ${this.#formattingService.formatThresholdValue(
            betterOption.threshold,
            isIntegerDomain
          )} would increase expression trigger rate to ~${this.#formattingService.formatPercentage(
            betterOption.triggerRate
          )}.`
        );
      }
    }

    // Add threshold suggestions for low but non-zero trigger rates (1-10%)
    if (
      actionabilityConfig.thresholdSuggestions.enabled &&
      actionabilityConfig.thresholdSuggestions.includeInNonZeroHitCases &&
      originalRate > 0 &&
      originalRate < 0.1
    ) {
      const suggestions = this.#computeThresholdSuggestions(
        grid,
        originalThreshold,
        operator,
        isIntegerDomain,
        'triggerRate'
      );
      if (suggestions.length > 0) {
        lines.push('');
        lines.push('#### Threshold Suggestions for Higher Trigger Rates');
        lines.push('');
        lines.push(
          this.#formatThresholdSuggestionsTable(
            suggestions,
            varPath,
            isIntegerDomain
          )
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate global sensitivity analysis section.
   * Shows how changing thresholds affects the entire expression, not just individual clauses.
   * @param {object[]} globalSensitivityData
   * @returns {string}
   */
  generateGlobalSensitivitySection(
    globalSensitivityData,
    populationSummary,
    storedPopulations,
    sweepWarningContext = null,
    fullSampleTriggerRate = null
  ) {
    if (!globalSensitivityData || globalSensitivityData.length === 0) {
      return '';
    }

    const kindMetadata = this.#getSensitivityKindMetadata(
      globalSensitivityData?.[0]?.kind,
      'expressionTriggerRateSweep'
    );
    const populationLabel =
      this.#formattingService.formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedGlobal ?? null
      );
    const storedBaselineTriggerRate =
      typeof sweepWarningContext?.baselineTriggerRate === 'number'
        ? sweepWarningContext.baselineTriggerRate
        : null;
    const baselineParts = [];
    if (typeof fullSampleTriggerRate === 'number') {
      baselineParts.push(
        `**Baseline (full sample)**: ${this.#formattingService.formatPercentage(fullSampleTriggerRate)}`
      );
    }
    if (typeof storedBaselineTriggerRate === 'number') {
      baselineParts.push(
        `**Baseline (stored contexts)**: ${this.#formattingService.formatPercentage(
          storedBaselineTriggerRate
        )}`
      );
    }
    const baselineLine =
      baselineParts.length > 0 ? `${baselineParts.join(' | ')}\n` : '';

    const lowConfidenceResults = globalSensitivityData.reduce(
      (acc, result) => {
        if (!result.grid || result.grid.length === 0) return acc;
        const originalIndex = result.grid.findIndex(
          (pt) => Math.abs(pt.threshold - result.originalThreshold) < 0.001
        );
        if (originalIndex < 0) return acc;
        const baseline = result.grid[originalIndex];
        const estimatedHits = baseline.triggerRate * baseline.sampleCount;
        if (estimatedHits < 5) {
          acc.push({
            sampleCount: baseline.sampleCount,
            estimatedHits,
          });
        }
        return acc;
      },
      []
    );

    const lowConfidenceWarning = (() => {
      if (lowConfidenceResults.length === 0) {
        return '';
      }

      const populationName =
        storedPopulations?.storedGlobal?.name ??
        (populationSummary?.storedContextCount > 0
          ? 'stored contexts'
          : 'full sample');
      const sampleCount =
        lowConfidenceResults[0]?.sampleCount ?? populationSummary?.sampleCount;
      const estimatedHits = lowConfidenceResults[0]?.estimatedHits;
      const sampleCountStr = this.#formattingService.formatCount(sampleCount);
      const hitCountStr = this.#formattingService.formatCount(
        Math.round(estimatedHits ?? 0)
      );

      return `> ⚠️ **Low confidence**: fewer than 5 baseline expression hits for population ${populationName} (N=${sampleCountStr}, hits≈${hitCountStr}). Global sensitivity tables are shown for reference.\n\n`;
    })();

    const sections = globalSensitivityData.map((result) =>
      this.formatGlobalSensitivityResult(result, sweepWarningContext)
    );

    return `## ${kindMetadata.sectionTitle}

${kindMetadata.sectionIntro}
This is the key metric for tuning—it answers "What actually happens to the expression if I change this?"
${lowConfidenceWarning}${baselineLine}${populationLabel}${sections.join('\n\n')}`;
  }
}

export default SensitivitySectionGenerator;
