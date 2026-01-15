/**
 * @file SensitivitySectionGenerator - Generates sensitivity analysis report sections
 */

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
   * @param {import('../MonteCarloSimulator.js').SensitivityResult} result
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
        const originalRate = grid[originalIndex].passRate;
        if (originalRate > 0 && point.passRate > 0) {
          const multiplier = point.passRate / originalRate;
          if (multiplier > 1) {
            changeStr = `+${this.#formattingService.formatNumber((multiplier - 1) * 100)}%`;
          } else if (multiplier < 1) {
            changeStr = `${this.#formattingService.formatNumber((multiplier - 1) * 100)}%`;
          }
        } else if (originalRate === 0 && point.passRate > 0) {
          changeStr = '+∞';
        } else if (originalRate > 0 && point.passRate === 0) {
          changeStr = '-100%';
        }
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

    const originalRate =
      originalIndex >= 0 ? grid[originalIndex].passRate : null;
    if (originalRate !== null && originalRate < 0.01) {
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
        const originalRate = grid[originalIndex].triggerRate;
        if (originalRate > 0 && point.triggerRate > 0) {
          const multiplier = point.triggerRate / originalRate;
          if (multiplier > 1) {
            changeStr = `+${this.#formattingService.formatNumber((multiplier - 1) * 100)}%`;
          } else if (multiplier < 1) {
            changeStr = `${this.#formattingService.formatNumber((multiplier - 1) * 100)}%`;
          }
        } else if (originalRate === 0 && point.triggerRate > 0) {
          changeStr = '+∞';
        } else if (originalRate > 0 && point.triggerRate === 0) {
          changeStr = '-100%';
        } else if (originalRate === 0 && point.triggerRate === 0) {
          changeStr = '0%';
        }
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

    const originalRate =
      originalIndex >= 0 ? grid[originalIndex].triggerRate : null;
    if (originalRate !== null && originalRate === 0) {
      const betterOption = grid.find((pt) => pt.triggerRate > 0);
      if (betterOption && betterOption.threshold !== originalThreshold) {
        lines.push('');
        lines.push(
          `**🎯 First threshold with triggers**: ${this.#formattingService.formatThresholdValue(
            betterOption.threshold,
            isIntegerDomain
          )} → ${this.#formattingService.formatPercentage(betterOption.triggerRate)} trigger rate`
        );
        lines.push(
          `**💡 Actionable Insight**: Adjusting threshold to ${this.#formattingService.formatThresholdValue(
            betterOption.threshold,
            isIntegerDomain
          )} would achieve ~${this.#formattingService.formatPercentage(
            betterOption.triggerRate
          )} expression trigger rate.`
        );
      } else {
        lines.push('');
        lines.push(
          '**⚠️ No Triggers Found**: None of the tested thresholds produced expression triggers. The expression may require more extreme threshold changes or other blocking conditions may dominate.'
        );
      }
    } else if (originalRate !== null && originalRate < 0.01) {
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
