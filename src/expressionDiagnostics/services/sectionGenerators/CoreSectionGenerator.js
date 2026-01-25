/**
 * @file CoreSectionGenerator - Generates core report sections (header, summary, legend, etc.)
 */

import { buildSamplingCoverageConclusions } from '../samplingCoverageConclusions.js';
import { evaluateConstraint, getNestedValue } from '../../utils/moodRegimeUtils.js';
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
   * @param {object} [simulationResult] - Optional full simulation result for prototype-only metrics
   * @returns {string}
   */
  generatePopulationSummary(populationSummary, simulationResult = null) {
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

    // Extract prototype-only expression metrics if available
    const isPrototypeOnly = simulationResult?.isPrototypeOnlyExpression ?? false;
    const moodRegimeSemantics = simulationResult?.moodRegimeSemantics ?? 'direct-mood-constraints';
    const intensityPassRate = simulationResult?.intensityPassRate;
    const intensityPassCount = simulationResult?.intensityPassCount;

    // Build regime description based on expression type
    let regimeDescription;
    let intensitySection = '';

    if (isPrototypeOnly) {
      regimeDescription = 'Mood axis constraints derived from prototype gates (minimum activation thresholds). ' +
        'See **Intensity Pass Rate** below for actual probability of meeting intensity thresholds.';

      // Add intensity pass rate for prototype-only expressions
      if (typeof intensityPassRate === 'number' && typeof intensityPassCount === 'number') {
        const intensityPctStr = this.#formattingService.formatPercentage(intensityPassRate);
        const intensityCountStr = this.#formattingService.formatCount(intensityPassCount);
        intensitySection = `\n- **Intensity pass rate**: ${intensityPctStr} (${intensityCountStr} of ${inRegimeSampleStr} gate-passing contexts met intensity thresholds)`;
      }
    } else {
      regimeDescription = 'Mood axis constraints derived from gates of emotion/sexual prototypes referenced in prerequisites.';
    }

    // Add note for prototype-only expressions explaining the semantic difference
    const prototypeOnlyNote = isPrototypeOnly
      ? `\n> **Note**: This expression uses prototype-based prerequisites (\`emotions.*\`, \`sexualStates.*\`) without direct \`moodAxes.*\` constraints. ` +
        `The "mood regime" represents prototype gate thresholds (minimum activation), not the actual intensity requirements. ` +
        `The **Intensity Pass Rate** metric shows what fraction of gate-passing contexts also satisfy the intensity thresholds.\n`
      : '';

    return `## Population Summary\n\n- **Total samples**: ${totalSampleStr} (in-regime ${inRegimeSampleStr}; ${this.#formattingService.formatPercentage(inRegimeSampleRate)})\n- **Stored contexts**: ${storedStr} of ${totalSampleStr} (in-regime ${storedInRegimeStr}; ${this.#formattingService.formatPercentage(storedInRegimeRate)}; limit ${limitStr})${intensitySection}\n- **Mood regime**: ${regimeDescription}${prototypeOnlyNote}${limitNote}\n\n---\n`;
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
   * Generate the Expected Trigger Rate Sanity Box section.
   * Helps users understand whether 0 hits (or low hits) is statistically
   * expected or surprising based on naive probability estimates.
   *
   * @param {object} simulationResult - Monte Carlo result with triggerCount, sampleCount
   * @param {object|object[]} blockers - Blocker tree or array with per-clause failure data
   * @returns {string} Markdown section
   */
  generateSanityBoxSection(simulationResult, blockers) {
    if (!simulationResult || !blockers) {
      return '';
    }

    const { triggerCount = 0, sampleCount = 0 } = simulationResult;
    if (sampleCount === 0) {
      return '';
    }

    // Extract leaf pass rates from blockers (handling tree structure)
    const leafPassRates = this.#extractLeafPassRates(blockers);
    if (leafPassRates.length === 0) {
      return '';
    }

    // Calculate naive probability
    const { naiveProbability, factors, warnings } =
      this.#statisticalService.calculateNaiveProbability(leafPassRates);

    // Calculate expected hits
    const expectedHits = naiveProbability * sampleCount;

    // Calculate P(k=0 | expected)
    const pZeroHits = this.#statisticalService.calculatePoissonProbability(0, expectedHits);

    // Classify the result
    const classification = this.#classifySanityResult({
      expectedHits,
      actualHits: triggerCount,
      pZeroHits,
    });

    // Build section
    const lines = [
      '## Independence Baseline Comparison',
      '',
      'This section compares Monte Carlo results against naive probability estimates (assuming clause independence) to identify correlation effects. Deviations indicate clauses are not statistically independent.',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Naive probability (product of pass rates) | ${this.#formattingService.formatScientificNotation(naiveProbability)} |`,
      `| Expected hits per ${this.#formattingService.formatCount(sampleCount)} samples | ${expectedHits.toFixed(2)} |`,
      `| Actual hits | ${triggerCount} |`,
      `| P(0 hits \\| expected=${expectedHits.toFixed(2)}) | ${this.#formattingService.formatScientificNotation(pZeroHits)} |`,
      '',
      `### Interpretation`,
      '',
      `${this.#formattingService.formatSanityStatus(classification.status)}: ${classification.explanation}`,
    ];

    // Add warnings if any
    if (warnings.length > 0) {
      lines.push('', '**Warnings**:', ...warnings.map(w => `- ${w}`));
    }

    // Detect overconstrained conjunctions
    const overconstrainedInfo = this.detectOverconstrainedConjunctions(blockers);
    if (overconstrainedInfo.length > 0) {
      lines.push('', '### Overconstrained Conjunction Warnings', '');
      for (const info of overconstrainedInfo) {
        const emotionList = info.lowPassChildren
          .map((c) => c.emotionName)
          .join(', ');
        const jointPct = (info.naiveJointProbability * 100).toFixed(4);
        lines.push(
          `> **Warning**: ${info.lowPassChildren.length} emotion thresholds ` +
            `(${emotionList}) each have <10% pass rate and are ANDed together. ` +
            `Joint probability: ${jointPct}%. ` +
            `Consider (2-of-${info.lowPassChildren.length}) rule or OR-softening.`
        );
      }
      lines.push('');
    }

    // Add factor breakdown for transparency (limit to 15 for readability)
    if (factors.length > 0 && factors.length <= 15) {
      lines.push(
        '',
        '### Clause Pass Rate Factors',
        '',
        '| Clause | Pass Rate (in-regime) |',
        '|--------|------------------------|',
        ...factors.map(f => `| ${f.clauseId} | ${this.#formattingService.formatPercentage(f.rate)} |`)
      );
    } else if (factors.length > 15) {
      lines.push(
        '',
        `> **Note**: ${factors.length} clause factors omitted for brevity.`
      );
    }

    lines.push('', '---', '');
    return lines.join('\n');
  }

  /**
   * Extract leaf pass rates from blockers tree structure.
   * Handles both flat arrays and hierarchical HierarchicalClauseNode trees.
   *
   * @private
   * @param {object|object[]} blockers - Blocker tree or array
   * @returns {Array<{clauseId: string, inRegimePassRate?: number, passRate?: number, failureRate?: number}>}
   */
  #extractLeafPassRates(blockers) {
    const leaves = [];

    // Handle array of blockers
    const blockerArray = Array.isArray(blockers) ? blockers : [blockers];

    const traverse = (node) => {
      if (!node) return;

      // Get hierarchical breakdown if present
      const hb = node.hierarchicalBreakdown ?? node;

      // Check if this is a leaf node (no children or nodeType === 'leaf')
      const isLeaf =
        hb.nodeType === 'leaf' || (!hb.children || hb.children.length === 0);

      if (isLeaf) {
        // Calculate pass rate from available data
        // Prefer inRegimePassRate if directly provided, otherwise calculate from failure rate
        let passRate;
        let failureRate;
        if (hb.inRegimePassRate != null) {
          passRate = hb.inRegimePassRate;
          failureRate = 1 - passRate;
        } else if (hb.passRate != null) {
          passRate = hb.passRate;
          failureRate = 1 - passRate;
        } else {
          failureRate = hb.inRegimeFailureRate ?? hb.failureRate ?? 0;
          passRate = 1 - failureRate;
        }

        leaves.push({
          clauseId:
            hb.clauseId ?? hb.description ?? hb.variablePath ?? 'unknown',
          inRegimePassRate: passRate,
          passRate: passRate,
          failureRate: failureRate,
        });
      } else if (hb.nodeType === 'or') {
        // For OR blocks, use the union pass rate as a single factor
        // OR blocks pass if ANY child passes
        let orPassRate;
        let orFailureRate;

        // PREFERRED: Use in-regime counts for in-regime calculation (FIX for Claim B)
        if (hb.orUnionPassInRegimeCount != null && hb.inRegimeEvaluationCount > 0) {
          orPassRate = hb.orUnionPassInRegimeCount / hb.inRegimeEvaluationCount;
          orFailureRate = 1 - orPassRate;
        }
        // FALLBACK: Legacy data with clamping to prevent >100% rates
        else if (hb.orUnionPassCount != null && hb.inRegimeEvaluationCount > 0) {
          orPassRate = hb.orUnionPassCount / hb.inRegimeEvaluationCount;
          // Clamp to valid probability range to handle domain mismatch
          if (orPassRate > 1.0) {
            orPassRate = 1.0;
          }
          orFailureRate = 1 - orPassRate;
        } else if (hb.inRegimePassRate != null) {
          orPassRate = hb.inRegimePassRate;
          orFailureRate = 1 - orPassRate;
        } else {
          orFailureRate = hb.inRegimeFailureRate ?? hb.failureRate ?? 0;
          orPassRate = 1 - orFailureRate;
        }

        leaves.push({
          clauseId: `OR Block (${hb.id ?? hb.description ?? 'unnamed'})`,
          inRegimePassRate: orPassRate,
          passRate: orPassRate,
          failureRate: orFailureRate,
        });
      } else if (Array.isArray(hb.children)) {
        // Recurse into AND-block children
        hb.children.forEach(traverse);
      }
    };

    for (const blocker of blockerArray) {
      traverse(blocker);
    }

    return leaves;
  }

  /**
   * Classify sanity check result.
   *
   * @private
   * @param {object} params
   * @param {number} params.expectedHits - Expected number of hits based on naive probability
   * @param {number} params.actualHits - Actual number of hits from simulation
   * @param {number} params.pZeroHits - Probability of zero hits given expected
   * @returns {{status: string, explanation: string}}
   */
  #classifySanityResult({ expectedHits, actualHits, pZeroHits }) {
    // Guard against invalid expected hits
    if (expectedHits <= 0) {
      return actualHits === 0
        ? {
            status: 'expected_rare',
            explanation:
              'Zero expected hits - expression cannot trigger under independence assumption.',
          }
        : {
            status: 'data_inconsistency',
            explanation: `Got ${actualHits} hits with ≤0 expected. Check data integrity.`,
          };
    }

    // Very rare expression - 0 hits is expected
    if (expectedHits < 1) {
      return {
        status: 'expected_rare',
        explanation: `Expression is inherently rare (expected ${expectedHits.toFixed(2)} hits). Zero hits is mathematically expected.`,
      };
    }

    // Zero hits but within statistical variation (p > 5%)
    if (actualHits === 0 && pZeroHits > 0.05) {
      return {
        status: 'statistically_plausible',
        explanation: `Zero hits has ${(pZeroHits * 100).toFixed(1)}% probability given expected ${expectedHits.toFixed(1)} hits.`,
      };
    }

    // Zero hits but very unexpected (p < 1% and expected >= 5)
    if (actualHits === 0 && expectedHits >= 5 && pZeroHits < 0.01) {
      return {
        status: 'unexpected_zero',
        explanation: `Zero hits is surprising (p=${this.#formattingService.formatScientificNotation(pZeroHits)}). Clause correlations may amplify blocking effects.`,
      };
    }

    // NEW: Deviation check for non-zero actual hits
    // A ratio outside [0.01, 100] indicates the independence assumption is badly violated
    const ratio = actualHits / expectedHits;
    if (ratio < 0.01 || ratio > 100) {
      const ratioFormatted =
        ratio < 0.01
          ? ratio.toExponential(2)
          : this.#formattingService.formatNumber(ratio, 2);
      return {
        status: 'large_deviation',
        explanation: `Actual hits (${actualHits}) differ significantly from expected (${expectedHits.toFixed(1)}). Ratio: ${ratioFormatted}. This indicates clause correlations amplify or suppress triggering beyond independence assumptions.`,
      };
    }

    // Actual hits roughly match expectation
    return {
      status: 'normal',
      explanation: `Actual hits (${actualHits}) align with expected (${expectedHits.toFixed(1)}).`,
    };
  }


  /**
   * Detect AND nodes with ≥3 low-pass emotion threshold children.
   * These represent structurally overconstrained conjunctions that are
   * essentially impossible to satisfy.
   *
   * @param {object|object[]} blockers - Blocker tree or array
   * @returns {Array<{andNodeId: string, lowPassChildren: Array<{clauseId: string, emotionName: string, passRate: number, threshold: number|null, operator: string}>, naiveJointProbability: number, suggestions: string[]}>}
   */
  detectOverconstrainedConjunctions(blockers) {
    const PASS_RATE_THRESHOLD = 0.10;
    const MIN_LOW_PASS_CHILDREN = 3;
    const results = [];

    const traverse = (node, path = '') => {
      if (!node) return;
      const hb = node.hierarchicalBreakdown ?? node;

      // Only process AND nodes
      if (hb.nodeType === 'and' && Array.isArray(hb.children)) {
        const lowPassChildren = [];

        for (const child of hb.children) {
          const childHb = child.hierarchicalBreakdown ?? child;
          const isLeaf =
            childHb.nodeType === 'leaf' ||
            !childHb.children ||
            childHb.children.length === 0;

          if (isLeaf) {
            let passRate;
            if (childHb.inRegimePassRate != null) {
              passRate = childHb.inRegimePassRate;
            } else if (childHb.passRate != null) {
              passRate = childHb.passRate;
            } else {
              const failureRate =
                childHb.inRegimeFailureRate ?? childHb.failureRate ?? 0;
              passRate = 1 - failureRate;
            }

            // Check if this is an emotion threshold with low pass rate
            if (passRate < PASS_RATE_THRESHOLD) {
              const emotionName = this.#extractEmotionName(childHb);
              if (emotionName) {
                lowPassChildren.push({
                  clauseId:
                    childHb.clauseId ?? childHb.description ?? 'unknown',
                  emotionName,
                  passRate,
                  threshold: childHb.thresholdValue ?? null,
                  operator:
                    childHb.comparisonOperator ?? childHb.operator ?? '>=',
                });
              }
            }
          }
        }

        if (lowPassChildren.length >= MIN_LOW_PASS_CHILDREN) {
          const naiveJoint = lowPassChildren.reduce(
            (acc, c) => acc * c.passRate,
            1
          );
          results.push({
            andNodeId: (hb.clauseId ?? path) || 'root_and',
            lowPassChildren,
            naiveJointProbability: naiveJoint,
            suggestions: [], // Will be populated by RecommendationEngine
          });
        }

        // Continue traversing children
        hb.children.forEach((child, i) => traverse(child, `${path}/child_${i}`));
      } else if (Array.isArray(hb.children)) {
        hb.children.forEach((child, i) => traverse(child, `${path}/child_${i}`));
      }
    };

    const blockerArray = Array.isArray(blockers) ? blockers : [blockers];
    blockerArray.forEach((b, i) => traverse(b, `blocker_${i}`));

    return results;
  }

  /**
   * Extract emotion name from a clause node.
   * @param {Object} node - Hierarchical breakdown node
   * @returns {string|null} Emotion name or null
   */
  #extractEmotionName(node) {
    const path = node.variablePath ?? node.clauseId ?? '';
    // Pattern: emotions.{emotionName} or var:emotions.{emotionName}
    const match = path.match(/emotions\.(\w+)/);
    return match ? match[1] : null;
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
      // Use the canonical getNestedValue from moodRegimeUtils for consistency
      // with MonteCarloSimulator's population hash calculation
      const value = getNestedValue(context, constraint.varPath);
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
