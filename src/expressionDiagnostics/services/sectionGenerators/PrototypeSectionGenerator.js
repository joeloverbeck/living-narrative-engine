/**
 * @file PrototypeSectionGenerator - Generates prototype-related report sections
 */

import ReportFormattingService from '../ReportFormattingService.js';
import WitnessFormatter from '../WitnessFormatter.js';
import StatisticalComputationService from '../StatisticalComputationService.js';
import ReportDataExtractor from '../ReportDataExtractor.js';
import BlockerTreeTraversal from '../BlockerTreeTraversal.js';
import { filterContextsByConstraints } from '../../utils/moodRegimeUtils.js';

class PrototypeSectionGenerator {
  #formattingService;
  #prototypeConstraintAnalyzer;
  #prototypeFitRankingService;
  #statisticalService;
  #dataExtractor;
  #treeTraversal;
  #witnessFormatter;
  #logger;

  constructor({
    formattingService,
    prototypeConstraintAnalyzer = null,
    prototypeFitRankingService = null,
    statisticalService = null,
    dataExtractor = null,
    treeTraversal = null,
    witnessFormatter = null,
    logger = null,
  } = {}) {
    if (!formattingService) {
      throw new Error('PrototypeSectionGenerator requires formattingService');
    }

    this.#formattingService = formattingService;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    this.#prototypeFitRankingService = prototypeFitRankingService;
    this.#statisticalService =
      statisticalService ?? new StatisticalComputationService();
    this.#dataExtractor =
      dataExtractor ??
      new ReportDataExtractor({
        logger,
        prototypeConstraintAnalyzer: this.#prototypeConstraintAnalyzer,
      });
    this.#treeTraversal = treeTraversal ?? new BlockerTreeTraversal();
    this.#witnessFormatter =
      witnessFormatter ??
      new WitnessFormatter({ formattingService: this.#formattingService });
    this.#logger = logger;
  }

  /**
   * Perform prototype fit analysis using the ranking service.
   * @param {Array|null} prerequisites
   * @param {Array} storedContexts
   * @returns {Object|null}
   */
  performPrototypeFitAnalysis(prerequisites, storedContexts) {
    if (!this.#prototypeFitRankingService || !prerequisites) {
      return null;
    }

    try {
      const fitResults = this.#prototypeFitRankingService.analyzeAllPrototypeFit(
        prerequisites,
        storedContexts
      );

      const impliedPrototype =
        this.#prototypeFitRankingService.computeImpliedPrototype(
          prerequisites,
          storedContexts
        );

      const gapDetection =
        this.#prototypeFitRankingService.detectPrototypeGaps(
          prerequisites,
          storedContexts
        );

      return {
        fitResults: fitResults?.leaderboard ?? [],
        impliedPrototype,
        gapDetection,
      };
    } catch (err) {
      if (this.#logger) {
        this.#logger.warn('Failed to perform prototype fit analysis:', err.message);
      }
      return null;
    }
  }

  /**
   * Generate the Prototype Fit & Substitution section.
   * @param {Array|null} fitResults
   * @returns {string}
   */
  generatePrototypeFitSection(
    fitResults,
    populationSummary,
    storedPopulations,
    hasOrMoodConstraints = false
  ) {
    const results = Array.isArray(fitResults) ? fitResults : [];
    if (results.length === 0) {
      return '';
    }

    const top10 = results.slice(0, 10);
    const includeType = top10.some((result) => result.type === 'sexual');

    const orConstraintWarning = hasOrMoodConstraints
      ? this.#formattingService.formatOrMoodConstraintWarning()
      : '';
    const populationLabel =
      this.#formattingService.formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedMoodRegime ?? null
      );

    let section = `
## 🎯 Prototype Fit Analysis

Ranking of ${includeType ? 'emotion/sexual' : 'emotion'} prototypes by how well they fit this expression's mood regime.

${orConstraintWarning}${populationLabel}| Rank | Prototype |${includeType ? ' Type |' : ''} Gate Pass | P(I≥t) | Conflict | Composite |
|------|-----------|${includeType ? '------|' : ''}-----------|--------|----------|-----------|
`;

    for (const result of top10) {
      const gatePass = this.#formattingService.formatPercentage(result.gatePassRate);
      const intensity = this.#formattingService.formatPercentage(
        result.intensityDistribution?.pAboveThreshold ?? 0
      );
      const conflict = this.#formattingService.formatPercentage(result.conflictScore);
      const composite = this.#formattingService.formatNumber(result.compositeScore);

      const typeLabel = result.type === 'sexual' ? 'sexual' : 'emotion';
      section += `| ${result.rank} | **${result.prototypeId}** |${includeType ? ` ${typeLabel} |` : ''} ${gatePass} | ${intensity} | ${conflict} | ${composite} |\n`;
    }

    section += '\n### Top 3 Prototype Details\n\n';

    for (const result of top10.slice(0, 3)) {
      const typeLabel = result.type === 'sexual' ? 'sexual' : 'emotion';
      section += `#### ${result.rank}. ${result.prototypeId}${includeType ? ` (${typeLabel})` : ''}\n\n`;

      if (result.intensityDistribution) {
        const dist = result.intensityDistribution;
        section += `- **Intensity Distribution**: P50=${this.#formattingService.formatNumber(dist.p50)}, P90=${this.#formattingService.formatNumber(dist.p90)}, P95=${this.#formattingService.formatNumber(dist.p95)}\n`;
      }

      if (result.conflictingAxes && result.conflictingAxes.length > 0) {
        const conflicts = result.conflictingAxes
          .map(
            (c) =>
              `${c.axis} (weight=${this.#formattingService.formatNumber(c.weight)}, wants ${c.direction})`
          )
          .join(', ');
        section += `- **Conflicting Axes**: ${conflicts}\n`;
        section += `- **Conflict Magnitude**: ${this.#formattingService.formatNumber(result.conflictMagnitude)}\n`;
      } else {
        section += '- **Conflicting Axes**: None\n';
      }

      section += '\n';
    }

    const currentPrototype = results.find((r) => r.rank === 1);
    if (currentPrototype && results.length > 1) {
      const secondBest = results[1];
      if (secondBest.compositeScore > currentPrototype.compositeScore * 1.2) {
        section += `> **💡 Suggestion**: Consider using **${secondBest.prototypeId}** instead - it scores ${this.#formattingService.formatNumber((secondBest.compositeScore / currentPrototype.compositeScore - 1) * 100)}% better for this mood regime.\n\n`;
      }
    }

    section += '---\n';
    return section;
  }

  /**
   * Generate the Implied Prototype section.
   * @param {Object|null} impliedAnalysis
   * @returns {string}
   */
  generateImpliedPrototypeSection(
    impliedAnalysis,
    populationSummary,
    storedPopulations,
    hasOrMoodConstraints = false
  ) {
    if (!impliedAnalysis) {
      return '';
    }
    const includeType = ['bySimilarity', 'byGatePass', 'byCombined'].some(
      (key) => impliedAnalysis[key]?.some((result) => result.type === 'sexual')
    );

    const orConstraintWarning = hasOrMoodConstraints
      ? this.#formattingService.formatOrMoodConstraintWarning()
      : '';
    const populationLabel =
      this.#formattingService.formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedMoodRegime ?? null
      );

    let section = `## 🧭 Implied Prototype from Prerequisites

Analysis of which prototypes best match the expression's constraint pattern.

${orConstraintWarning}${populationLabel}
`;

    if (impliedAnalysis.targetSignature && impliedAnalysis.targetSignature.size > 0) {
      section += '### Target Signature\n\n';
      section += '| Axis | Direction | Importance |\n';
      section += '|------|-----------|------------|\n';

      for (const [axis, data] of impliedAnalysis.targetSignature) {
        const direction =
          data.direction > 0
            ? '↑ High'
            : data.direction < 0
              ? '↓ Low'
              : '— Neutral';
        section += `| ${axis} | ${direction} | ${this.#formattingService.formatNumber(data.importance)} |\n`;
      }
      section += '\n';
    }

    if (impliedAnalysis.bySimilarity && impliedAnalysis.bySimilarity.length > 0) {
      section += '### Top 5 by Cosine Similarity\n\n';
      section += `| Rank | Prototype |${includeType ? ' Type |' : ''} Similarity | Gate Pass | Combined |\n`;
      section += `|------|-----------|${includeType ? '------|' : ''}------------|-----------|----------|\n`;

      for (let i = 0; i < Math.min(5, impliedAnalysis.bySimilarity.length); i++) {
        const r = impliedAnalysis.bySimilarity[i];
        const typeLabel = r.type === 'sexual' ? 'sexual' : 'emotion';
        section += `| ${i + 1} | **${r.prototypeId}** |${includeType ? ` ${typeLabel} |` : ''} ${this.#formattingService.formatNumber(r.cosineSimilarity)} | ${this.#formattingService.formatPercentage(r.gatePassRate)} | ${this.#formattingService.formatNumber(r.combinedScore)} |\n`;
      }
      section += '\n';
    }

    if (impliedAnalysis.byGatePass && impliedAnalysis.byGatePass.length > 0) {
      section += '### Top 5 by Gate Pass Rate\n\n';
      section += `| Rank | Prototype |${includeType ? ' Type |' : ''} Gate Pass | Similarity | Combined |\n`;
      section += `|------|-----------|${includeType ? '------|' : ''}-----------|------------|----------|\n`;

      for (let i = 0; i < Math.min(5, impliedAnalysis.byGatePass.length); i++) {
        const r = impliedAnalysis.byGatePass[i];
        const typeLabel = r.type === 'sexual' ? 'sexual' : 'emotion';
        section += `| ${i + 1} | **${r.prototypeId}** |${includeType ? ` ${typeLabel} |` : ''} ${this.#formattingService.formatPercentage(r.gatePassRate)} | ${this.#formattingService.formatNumber(r.cosineSimilarity)} | ${this.#formattingService.formatNumber(r.combinedScore)} |\n`;
      }
      section += '\n';
    }

    if (impliedAnalysis.byCombined && impliedAnalysis.byCombined.length > 0) {
      section += '### Top 5 by Combined Score\n\n';
      section += `| Rank | Prototype |${includeType ? ' Type |' : ''} Combined | Similarity | Gate Pass |\n`;
      section += `|------|-----------|${includeType ? '------|' : ''}----------|------------|----------|\n`;

      for (let i = 0; i < Math.min(5, impliedAnalysis.byCombined.length); i++) {
        const r = impliedAnalysis.byCombined[i];
        const typeLabel = r.type === 'sexual' ? 'sexual' : 'emotion';
        section += `| ${i + 1} | **${r.prototypeId}** |${includeType ? ` ${typeLabel} |` : ''} ${this.#formattingService.formatNumber(r.combinedScore)} | ${this.#formattingService.formatNumber(r.cosineSimilarity)} | ${this.#formattingService.formatPercentage(r.gatePassRate)} |\n`;
      }
      section += '\n';
    }

    section += '---\n';
    return section;
  }

  /**
   * Generate the Gap Detection section.
   * @param {Object|null} gapResult
   * @returns {string}
   */
  generateGapDetectionSection(gapResult, populationSummary, storedPopulations) {
    if (!gapResult) {
      return '';
    }

    const populationLabel =
      this.#formattingService.formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedMoodRegime ?? null
      );

    let section = `## 🔍 Prototype Gap Detection

Analysis of prototype coverage in "prototype space".

${populationLabel}
`;

    if (gapResult.gapDetected) {
      section += `### ⚠️ Coverage Gap Detected\n\n**Nearest Distance**: ${this.#formattingService.formatNumber(gapResult.nearestDistance)} (threshold: 0.5)\n\n`;
      if (gapResult.distanceContext) {
        section += `**Distance Context**: ${gapResult.distanceContext}\n\n`;
      }
      if (gapResult.coverageWarning) {
        section += `> ${gapResult.coverageWarning}\n\n`;
      }
    } else {
      section += `### ✅ Good Coverage\n\n**Nearest Distance**: ${this.#formattingService.formatNumber(gapResult.nearestDistance)} - within acceptable range.\n\n`;
      if (gapResult.distanceContext) {
        section += `**Distance Context**: ${gapResult.distanceContext}\n\n`;
      }
    }

    if (gapResult.kNearestNeighbors && gapResult.kNearestNeighbors.length > 0) {
      const includeType = gapResult.kNearestNeighbors.some(
        (neighbor) => neighbor.type === 'sexual'
      );
      section += '### k-Nearest Prototypes\n\n';
      section += `| Rank | Prototype |${includeType ? ' Type |' : ''} Distance | Weight Dist | Gate Dist |\n`;
      section += `|------|-----------|${includeType ? '------|' : ''}----------|-------------|----------|\n`;

      for (let i = 0; i < gapResult.kNearestNeighbors.length; i++) {
        const n = gapResult.kNearestNeighbors[i];
        const typeLabel = n.type === 'sexual' ? 'sexual' : 'emotion';
        section += `| ${i + 1} | **${n.prototypeId}** |${includeType ? ` ${typeLabel} |` : ''} ${this.#formattingService.formatNumber(n.combinedDistance)} | ${this.#formattingService.formatNumber(n.weightDistance)} | ${this.#formattingService.formatNumber(n.gateDistance)} |\n`;
      }
      section += '\n';
    }

    if (gapResult.suggestedPrototype) {
      const suggested = gapResult.suggestedPrototype;
      section += '### 💡 Suggested New Prototype\n\n';

      if (suggested.rationale) {
        section += `**Rationale**: ${suggested.rationale}\n\n`;
      }

      if (suggested.weights && Object.keys(suggested.weights).length > 0) {
        section += '**Suggested Weights**:\n\n';
        section += '| Axis | Weight |\n';
        section += '|------|--------|\n';

        const sortedWeights = Object.entries(suggested.weights).sort(
          (a, b) => Math.abs(b[1]) - Math.abs(a[1])
        );

        for (const [axis, weight] of sortedWeights) {
          section += `| ${axis} | ${this.#formattingService.formatNumber(weight)} |\n`;
        }
        section += '\n';
      }

      if (suggested.gates && suggested.gates.length > 0) {
        section += '**Suggested Gates**:\n\n';
        for (const gate of suggested.gates) {
          section += `- \`${gate}\`\n`;
        }
        section += '\n';
      }
    }

    section += '---\n';
    return section;
  }

  /**
   * Generate prototype math section for emotion/sexual threshold blockers.
   * @returns {string}
   */
  generatePrototypeMathSection(
    blocker,
    axisConstraints,
    storedContexts = null,
    populationSummary = null,
    storedPopulations = null,
    hasOrMoodConstraints = false,
    moodConstraints = [],
    gateCompatibility = null
  ) {
    if (!this.#prototypeConstraintAnalyzer || !axisConstraints) {
      return '';
    }

    const emotionConditions = this.#extractEmotionConditions(blocker);

    if (emotionConditions.length === 0) {
      return '';
    }

    const analyses = emotionConditions.map((cond) => ({
      analysis: this.#analyzeEmotionCondition(cond, axisConstraints),
      operator: cond.operator ?? '>=',
    }));

    const validAnalyses = analyses.filter((entry) => entry.analysis !== null);

    if (validAnalyses.length === 0) {
      return '';
    }

    const sections = validAnalyses.map(({ analysis, operator }) =>
      this.#formatPrototypeAnalysis(
        analysis,
        operator,
        storedContexts,
        moodConstraints,
        gateCompatibility
      )
    );

    const orConstraintWarning = hasOrMoodConstraints
      ? this.#formattingService.formatOrMoodConstraintWarning()
      : '';
    const populationLabel =
      this.#formattingService.formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedGlobal ?? null
      );

    return `#### Prototype Math Analysis\n\n${orConstraintWarning}${populationLabel}${sections.join('\n\n')}`;
  }

  #extractEmotionConditions(blocker) {
    if (!this.#dataExtractor || !this.#treeTraversal) {
      return [];
    }
    return this.#dataExtractor.extractEmotionConditions(
      blocker,
      (node) => this.#treeTraversal.flattenLeaves(node)
    );
  }

  #analyzeEmotionCondition(condition, axisConstraints) {
    try {
      return this.#prototypeConstraintAnalyzer.analyzeEmotionThreshold(
        condition.prototypeId,
        condition.type,
        condition.threshold,
        axisConstraints,
        condition.operator ?? '>='
      );
    } catch (err) {
      if (this.#logger) {
        this.#logger.warn(
          `Failed to analyze ${condition.type} condition ${condition.prototypeId}:`,
          err.message
        );
      }
      return null;
    }
  }

  #formatPrototypeAnalysis(
    analysis,
    operator,
    storedContexts = null,
    moodConstraints = [],
    gateCompatibility = null
  ) {
    const {
      prototypeId,
      type,
      threshold,
      maxAchievable,
      minAchievable,
      weights,
      gates,
      gateStatus,
      bindingAxes,
      axisAnalysis,
      sumAbsWeights,
      requiredRawSum,
      explanation,
    } = analysis;

    const comparisonOperator = analysis.operator ?? operator ?? '>=';
    const feasibility = this.#buildFeasibilitySummary({
      minAchievable,
      maxAchievable,
      threshold,
      operator: comparisonOperator,
    });
    const feasibilityBlock = this.#formatFeasibilityBlock(feasibility);

    const weightsTable = this.#formatWeightsTable(axisAnalysis);

    const gateFailureRates = this.#statisticalService.computeGateFailureRates(
      gates,
      storedContexts
    );

    const gateStatusStr = this.#formatGateStatus(
      gates,
      gateStatus,
      gateFailureRates,
      comparisonOperator
    );

    const bindingStr = this.#witnessFormatter.formatBindingAxes(bindingAxes);

    const recommendations = this.#generatePrototypeRecommendations(
      analysis,
      comparisonOperator
    );

    const regimeStats = this.#formatPrototypeRegimeStats({
      prototypeId,
      type,
      gates,
      weights,
      storedContexts,
      moodConstraints,
    });
    const gateCompatibilityBlock = this.#formatGateCompatibilityBlock(
      { prototypeId, type, comparisonOperator },
      gateCompatibility
    );

    return `##### ${type === 'emotion' ? '🧠' : '💗'} ${prototypeId} ${comparisonOperator} ${this.#formattingService.formatNumber(threshold)} ${feasibility.statusIcon} ${feasibility.statusLabel}

${feasibilityBlock}
**Sum|Weights|**: ${sumAbsWeights.toFixed(2)} | **Required Raw Sum**: ${requiredRawSum.toFixed(2)}

${regimeStats}

${gateCompatibilityBlock}

${weightsTable}

${gateStatusStr}

${bindingStr}

**Analysis**: ${explanation}

${recommendations}`;
  }

  #formatWeightsTable(axisAnalysis) {
    if (!axisAnalysis || axisAnalysis.length === 0) {
      return '*No weight analysis available*';
    }

    const header =
      '| Axis | Weight | Constraint | Optimal | Contribution | Binding |';
    const separator = '|------|--------|------------|---------|--------------|---------|';
    const rows = axisAnalysis.map((a) => {
      const weight = a.weight >= 0 ? `+${a.weight.toFixed(2)}` : a.weight.toFixed(2);
      const constraint = `[${a.constraintMin.toFixed(2)}, ${a.constraintMax.toFixed(2)}]`;
      const optimal = a.optimalValue.toFixed(2);
      const contribution = a.contribution.toFixed(3);
      const binding = a.isBinding
        ? a.conflictType
          ? `⚠️ ${a.conflictType}`
          : '⚠️ yes'
        : '—';
      return `| ${a.axis} | ${weight} | ${constraint} | ${optimal} | ${contribution} | ${binding} |`;
    });

    return `**Prototype Weights**:\n${header}\n${separator}\n${rows.join('\n')}`;
  }

  #formatGateStatus(gates, gateStatus, gateFailureRates = new Map(), operator = '>=') {
    if (!gates || gates.length === 0) {
      return '**Gates**: None';
    }

    const gateLines = gateStatus.gates.map((g) => {
      const icon = g.satisfiable ? '✅' : '❌';

      let failRateStr = '';
      if (gateFailureRates.has(g.gate)) {
        const failRate = gateFailureRates.get(g.gate);
        failRateStr = ` | **Observed Fail Rate**: ${this.#formattingService.formatPercentage(failRate)}`;
      }

      return `- ${icon} \`${g.gate}\` - ${g.reason}${failRateStr}`;
    });

    const overallIcon = gateStatus.allSatisfiable ? '✅' : '❌';
    const isUpperBound = operator === '<=' || operator === '<';
    const gateNote =
      !gateStatus.allSatisfiable && isUpperBound
        ? '\n- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.'
        : '';
    return `**Gates** ${overallIcon}:\n${gateLines.join('\n')}${gateNote}`;
  }

  #generatePrototypeRecommendations(analysis, operator) {
    const { isReachable, gap, bindingAxes, gateStatus, threshold, maxAchievable } =
      analysis;

    const recommendations = [];
    const isUpperBound = operator === '<=' || operator === '<';

    if (isUpperBound) {
      if (maxAchievable <= threshold) {
        recommendations.push(
          '**Recommendation**: Always satisfies threshold within constraints.'
        );
      } else {
        recommendations.push(
          '**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.'
        );
      }
      return recommendations.join('\n');
    }

    if (!isReachable) {
      if (!gateStatus.allSatisfiable) {
        recommendations.push(
          '**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.'
        );
      } else if (bindingAxes.length > 0) {
        const conflicts = bindingAxes.filter((a) => a.conflictType);
        if (conflicts.length > 0) {
          recommendations.push(
            `**Recommendation**: Lower threshold to ${analysis.maxAchievable.toFixed(2)} or relax conflicting constraints on: ${conflicts.map((a) => a.axis).join(', ')}`
          );
        } else {
          recommendations.push(
            `**Recommendation**: Lower threshold to approximately ${analysis.maxAchievable.toFixed(2)}`
          );
        }
      } else {
        recommendations.push(
          `**Recommendation**: Threshold ${threshold} may be too high; max achievable is ${analysis.maxAchievable.toFixed(2)}`
        );
      }
    } else {
      const reachMargin = maxAchievable - threshold;
      if (reachMargin >= 0 && reachMargin < 0.05) {
        recommendations.push(
          `**Note**: Threshold is achievable but with narrow margin (gap: ${reachMargin.toFixed(3)}). Consider lowering threshold for more reliable triggering.`
        );
      }
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '';
  }

  #buildFeasibilitySummary({ minAchievable, maxAchievable, threshold, operator }) {
    const tuningDirection = this.#formattingService.formatTuningDirection(operator);
    const isUpperBound = operator === '<=' || operator === '<';
    const hasNumbers =
      typeof minAchievable === 'number' &&
      typeof maxAchievable === 'number' &&
      typeof threshold === 'number';

    let status = 'unknown';
    if (hasNumbers) {
      if (isUpperBound) {
        const impossible =
          operator === '<' ? minAchievable >= threshold : minAchievable > threshold;
        const always =
          operator === '<' ? maxAchievable < threshold : maxAchievable <= threshold;
        status = impossible ? 'impossible' : always ? 'always' : 'sometimes';
      } else {
        const impossible =
          operator === '>' ? maxAchievable <= threshold : maxAchievable < threshold;
        const always =
          operator === '>' ? minAchievable > threshold : minAchievable >= threshold;
        status = impossible ? 'impossible' : always ? 'always' : 'sometimes';
      }
    }

    const statusIcon =
      status === 'always'
        ? '✅'
        : status === 'sometimes'
          ? '⚠️'
          : status === 'impossible'
            ? '❌'
            : '❓';

    const feasibilitySlack = hasNumbers
      ? isUpperBound
        ? threshold - minAchievable
        : maxAchievable - threshold
      : null;
    const alwaysSlack = hasNumbers
      ? isUpperBound
        ? threshold - maxAchievable
        : minAchievable - threshold
      : null;

    return {
      minAchievable,
      maxAchievable,
      threshold,
      status,
      statusIcon,
      statusLabel: status.toUpperCase(),
      feasibilitySlack,
      alwaysSlack,
      tuningDirection,
    };
  }

  #formatFeasibilityBlock(feasibility) {
    const minStr = this.#formattingService.formatNumber(feasibility.minAchievable);
    const maxStr = this.#formattingService.formatNumber(feasibility.maxAchievable);
    const thresholdStr = this.#formattingService.formatNumber(feasibility.threshold);
    const slackStr = this.#formattingService.formatSignedNumber(
      feasibility.feasibilitySlack
    );
    const alwaysSlackStr = this.#formattingService.formatSignedNumber(
      feasibility.alwaysSlack
    );
    const tuning = feasibility.tuningDirection;

    return `**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [${minStr}, ${maxStr}]
- **Threshold**: ${thresholdStr}
- **Status**: ${feasibility.status}
- **Slack**: feasibility ${slackStr}; always ${alwaysSlackStr}
- **Tuning direction**: loosen -> ${tuning.loosen}, tighten -> ${tuning.tighten}`;
  }

  #formatPrototypeRegimeStats({
    prototypeId,
    type,
    gates,
    weights,
    storedContexts,
    moodConstraints,
  }) {
    if (!storedContexts || storedContexts.length === 0) {
      return '*Regime stats unavailable (no stored contexts).*';
    }

    const path = this.#dataExtractor.getPrototypeContextPath(type, prototypeId);
    if (!path) {
      return '*Regime stats unavailable (unknown prototype path).*';
    }

    const inRegimeContexts = this.#filterContextsByMoodConstraints(
      storedContexts,
      moodConstraints
    );
    const callbacks = {
      resolveGateTraceTarget: (varPath) => this.#resolveGateTraceTarget(varPath),
      getGateTraceSignals: (context, contextType, protoId) =>
        this.#dataExtractor.getGateTraceSignals(context, contextType, protoId),
    };
    const globalStats = this.#statisticalService.computePrototypeRegimeStats(
      storedContexts,
      path,
      gates,
      weights,
      callbacks
    );
    const inRegimeStats = this.#statisticalService.computePrototypeRegimeStats(
      inRegimeContexts,
      path,
      gates,
      weights,
      callbacks
    );
    const inRegimeLabel =
      moodConstraints && moodConstraints.length > 0
        ? 'In mood regime'
        : 'In mood regime (no mood constraints)';

    const header = '| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |';
    const divider = '|--------|--------|-----|-----|-----|-----|-----|----------|';
    const rows = [
      ...this.#formatPrototypeRegimeRows('Global', globalStats),
      ...this.#formatPrototypeRegimeRows(inRegimeLabel, inRegimeStats),
    ];
    const globalMaxStr = globalStats?.finalDistribution
      ? this.#formattingService.formatNumber(globalStats.finalDistribution.max)
      : 'N/A';
    const inRegimeMaxStr = inRegimeStats?.finalDistribution
      ? this.#formattingService.formatNumber(inRegimeStats.finalDistribution.max)
      : 'N/A';

    return `**Regime Stats**:\n${header}\n${divider}\n${rows.join('\n')}
- **Observed max (global, final)**: ${globalMaxStr}
- **Observed max (mood-regime, final)**: ${inRegimeMaxStr}`;
  }

  #formatPrototypeRegimeRows(label, stats) {
    if (!stats || !stats.finalDistribution) {
      return [
        `| ${label} | final | N/A | N/A | N/A | N/A | N/A | ${this.#formattingService.formatPercentage(stats?.gatePassRate)} |`,
      ];
    }

    const finalRow = `| ${label} | final | ${this.#formattingService.formatNumber(stats.finalDistribution.median)} | ${this.#formattingService.formatNumber(stats.finalDistribution.p90)} | ${this.#formattingService.formatNumber(stats.finalDistribution.p95)} | ${this.#formattingService.formatNumber(stats.finalDistribution.min)} | ${this.#formattingService.formatNumber(stats.finalDistribution.max)} | ${this.#formattingService.formatPercentage(stats.gatePassRate)} |`;

    if (!stats.rawDistribution) {
      return [finalRow];
    }

    const rawRow = `| ${label} | raw | ${this.#formattingService.formatNumber(stats.rawDistribution.median)} | ${this.#formattingService.formatNumber(stats.rawDistribution.p90)} | ${this.#formattingService.formatNumber(stats.rawDistribution.p95)} | ${this.#formattingService.formatNumber(stats.rawDistribution.min)} | ${this.#formattingService.formatNumber(stats.rawDistribution.max)} | N/A |`;

    return [finalRow, rawRow];
  }

  #formatGateCompatibilityBlock(
    { prototypeId, type, comparisonOperator },
    gateCompatibility
  ) {
    if (!gateCompatibility) {
      return '**Gate Compatibility (mood regime)**: N/A';
    }

    const compatibilityMap =
      type === 'sexual'
        ? gateCompatibility.sexualStates
        : gateCompatibility.emotions;
    const status = compatibilityMap?.[prototypeId];

    if (!status) {
      return '**Gate Compatibility (mood regime)**: N/A';
    }

    if (status.compatible) {
      return '**Gate Compatibility (mood regime)**: ✅ compatible';
    }

    const isBenignCeiling =
      comparisonOperator === '<=' || comparisonOperator === '<';
    const reason = status.reason ? ` - ${status.reason}` : '';
    if (isBenignCeiling) {
      return (
        '**Gate Compatibility (mood regime)**: ⚠️ incompatible ' +
        '(benign for <=/< clauses)' +
        `${reason}`
      );
    }

    return `**Gate Compatibility (mood regime)**: ❌ incompatible${reason}`;
  }

  #resolveGateTraceTarget(varPath) {
    if (!varPath || typeof varPath !== 'string') {
      return null;
    }
    if (varPath.startsWith('emotions.')) {
      return { type: 'emotion', prototypeId: varPath.slice('emotions.'.length) };
    }
    if (varPath.startsWith('sexualStates.')) {
      return { type: 'sexual', prototypeId: varPath.slice('sexualStates.'.length) };
    }
    return null;
  }

  #filterContextsByMoodConstraints(storedContexts, moodConstraints) {
    return filterContextsByConstraints(storedContexts, moodConstraints);
  }
}

export default PrototypeSectionGenerator;
