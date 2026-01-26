/**
 * @file Metadata Renderer for prototype analysis results.
 * Handles metadata grid, recommendation cards, and evidence display.
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} FilteringStats
 * @property {number} totalPossiblePairs - Total possible pairs count
 * @property {number} passedFiltering - Pairs that passed filtering
 * @property {number} rejectedByActiveAxisOverlap - Rejected by active axis overlap
 * @property {number} rejectedBySignAgreement - Rejected by sign agreement
 * @property {number} rejectedByCosineSimilarity - Rejected by cosine similarity
 */

/**
 * @typedef {object} ClassificationBreakdown
 * @property {number} mergeRecommended - Merge recommendation count
 * @property {number} subsumedRecommended - Subsumption recommendation count
 * @property {number} nestedSiblings - Nested siblings count
 * @property {number} needsSeparation - Separation needed count
 * @property {number} convertToExpression - Expression conversion count
 * @property {number} keepDistinct - Distinct count
 */

/**
 * @typedef {object} ClosestPairInfo
 * @property {string} prototypeA - First prototype name
 * @property {string} prototypeB - Second prototype name
 * @property {number} compositeScore - Composite similarity score
 * @property {number} gateOverlapRatio - Gate overlap ratio
 * @property {number} correlation - Correlation value
 * @property {number} globalMeanAbsDiff - Global mean absolute difference
 */

/**
 * @typedef {object} SummaryInsight
 * @property {string} status - Status classification
 * @property {string} message - Summary message
 * @property {ClosestPairInfo} [closestPair] - Closest pair information
 */

/**
 * @typedef {object} AnalysisMetadata
 * @property {string} prototypeFamily - Prototype family name
 * @property {number} totalPrototypes - Total prototype count
 * @property {number} candidatePairsFound - Candidate pairs found
 * @property {number} candidatePairsEvaluated - Pairs evaluated
 * @property {number} redundantPairsFound - Redundant pairs found
 * @property {number} sampleCountPerPair - Samples per pair
 * @property {FilteringStats} [filteringStats] - Filtering statistics
 * @property {ClassificationBreakdown} [classificationBreakdown] - Classification breakdown
 * @property {SummaryInsight} [summaryInsight] - Summary insight
 */

/**
 * @typedef {object} DivergenceExample
 * @property {number} [intensityDifference] - Intensity difference value
 * @property {string} [contextSummary] - Context summary text
 */

/**
 * @typedef {object} MatchEvidence
 * @property {string} type - Evidence type
 * @property {number} confidence - Confidence score
 * @property {object} [evidence] - Additional evidence data
 */

/**
 * @typedef {object} Recommendation
 * @property {string} [prototypeA] - V1 prototype A name
 * @property {string} [prototypeB] - V1 prototype B name
 * @property {object} [prototypes] - V2 prototypes object
 * @property {string} [prototypes.a] - V2 prototype A name
 * @property {string} [prototypes.b] - V2 prototype B name
 * @property {string} [summary] - Summary text
 * @property {string} [actionableInsight] - V1 actionable insight
 * @property {string[]} [actions] - V2 actions array
 * @property {DivergenceExample[]} [divergenceExamples] - V1 divergence examples
 * @property {object} [evidence] - V2 evidence object
 * @property {DivergenceExample[]} [evidence.divergenceExamples] - V2 divergence examples
 * @property {number} severity - Severity score
 * @property {string} type - Recommendation type
 * @property {MatchEvidence[]} [allMatchingClassifications] - All matching classifications
 */

/**
 * @typedef {object} MetadataElements
 * @property {HTMLElement|null} resultsMetadata - Metadata container
 * @property {HTMLElement|null} recommendationsContainer - Recommendations container
 */

/**
 * Renderer for metadata and recommendation cards in prototype analysis.
 * Handles metadata grid display, recommendation card rendering, and evidence formatting.
 */
class MetadataRenderer {
  /** @type {object} */
  #logger;

  /** @type {Object<string, string>} */
  static TYPE_LABELS = {
    // v1 types (backward compatible)
    structurally_redundant: 'Structurally Redundant',
    behaviorally_redundant: 'Behaviorally Redundant',
    high_overlap: 'High Overlap',
    not_redundant: 'Not Redundant',
    // v2 types
    prototype_merge_suggestion: 'Merge Suggestion',
    prototype_subsumption_suggestion: 'Subsumption Suggestion',
    prototype_overlap_info: 'Overlap Info',
    prototype_nested_siblings: 'Nested Siblings',
    prototype_needs_separation: 'Needs Separation',
    prototype_distinct_info: 'Distinct',
    prototype_expression_conversion: 'Expression Conversion',
    // v2 classification types
    merge_recommended: 'Merge Recommended',
    subsumed_recommended: 'Subsumed Recommended',
    convert_to_expression: 'Convert to Expression',
    nested_siblings: 'Nested Siblings',
    needs_separation: 'Needs Separation',
    keep_distinct: 'Keep Distinct',
  };

  /** @type {Object<string, string>} */
  static TYPE_SUMMARIES = {
    prototype_merge_suggestion:
      'These prototypes behave nearly identically and may be candidates for merging.',
    prototype_subsumption_suggestion:
      'One prototype appears to be a behavioral subset of the other.',
    prototype_overlap_info:
      'These prototypes share significant structural similarity.',
    prototype_nested_siblings:
      'These prototypes have a nested relationship where one contains the other.',
    prototype_needs_separation:
      'These prototypes overlap significantly but serve different purposes.',
    prototype_distinct_info:
      'These prototypes are correctly distinct despite structural similarity.',
    prototype_expression_conversion:
      'These prototypes may be better expressed as a single parameterized definition.',
    // v1 types
    structurally_redundant: 'These prototypes share significant structural overlap.',
    behaviorally_redundant: 'These prototypes produce similar behavioral responses.',
    high_overlap: 'These prototypes have high overlap but are behaviorally distinct.',
    not_redundant: 'These prototypes are sufficiently distinct.',
  };

  /** @type {Object<string, string>} */
  static RECOMMENDATION_TYPE_CLASSES = {
    consider_new_axis: 'rec-type-axis',
    refine_bundle: 'rec-type-refine',
    investigate: 'rec-type-investigate',
    simplify: 'rec-type-simplify',
  };

  /**
   * Create a MetadataRenderer.
   *
   * @param {object} dependencies - Injected dependencies
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('[MetadataRenderer] Initialized.');
  }

  /**
   * Render the metadata grid.
   *
   * @param {AnalysisMetadata} metadata - Analysis metadata
   * @param {MetadataElements} elements - DOM elements
   */
  renderMetadata(metadata, elements) {
    if (!elements.resultsMetadata) {
      this.#logger.debug('[MetadataRenderer] No resultsMetadata element provided.');
      return;
    }

    const {
      prototypeFamily,
      totalPrototypes,
      candidatePairsFound,
      candidatePairsEvaluated,
      redundantPairsFound,
      sampleCountPerPair,
      filteringStats,
      classificationBreakdown,
      summaryInsight,
    } = metadata;

    const filteringBreakdown = this.#buildFilteringBreakdown(filteringStats);
    const classBreakdown = this.#buildClassificationBreakdown(classificationBreakdown);
    const summarySection = this.#buildSummarySection(summaryInsight);

    elements.resultsMetadata.innerHTML = `
      <div class="metadata-grid">
        <div class="metadata-item">
          <span class="metadata-label">Family:</span>
          <span class="metadata-value">${this.#escapeHtml(prototypeFamily)}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Prototypes:</span>
          <span class="metadata-value">${totalPrototypes}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Candidates:</span>
          <span class="metadata-value">${candidatePairsFound}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Evaluated:</span>
          <span class="metadata-value">${candidatePairsEvaluated}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Redundant:</span>
          <span class="metadata-value redundant-count">${redundantPairsFound}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Samples/Pair:</span>
          <span class="metadata-value">${sampleCountPerPair}</span>
        </div>
      </div>

      <div class="metadata-expanded">
        <details class="filtering-details">
          <summary>Filtering Details</summary>
          ${filteringBreakdown}
        </details>

        ${classBreakdown}

        ${summarySection}
      </div>
    `;
  }

  /**
   * Render a single recommendation card.
   *
   * @param {Recommendation} recommendation - Recommendation data
   * @param {number} index - Card index
   * @param {MetadataElements} elements - DOM elements
   */
  renderRecommendationCard(recommendation, index, elements) {
    if (!elements.recommendationsContainer) {
      this.#logger.debug('[MetadataRenderer] No recommendationsContainer element provided.');
      return;
    }

    const {
      // v1 fields (backward compatible)
      prototypeA: v1ProtoA,
      prototypeB: v1ProtoB,
      summary,
      actionableInsight,
      divergenceExamples: v1Divergence,
      // v2 fields
      prototypes,
      actions,
      evidence,
      // Common fields
      severity,
      type,
      allMatchingClassifications,
    } = recommendation;

    // Extract prototype names: prefer v2 nested format, fall back to v1, then fallback text
    const prototypeA = prototypes?.a ?? v1ProtoA ?? 'Unknown A';
    const prototypeB = prototypes?.b ?? v1ProtoB ?? 'Unknown B';

    // Build actionable insight: prefer v2 actions array, fall back to v1 string
    const actionText = this.#buildActionText(actions, actionableInsight);

    // Extract divergence examples: prefer v2 evidence.divergenceExamples, fall back to v1
    const divergenceExamples = evidence?.divergenceExamples ?? v1Divergence ?? [];
    const secondaryMatches =
      allMatchingClassifications?.filter((match) => !match.isPrimary) ?? [];

    // Build summary text: use v1 summary if available, otherwise derive from type
    const summaryText = summary ?? this.#deriveSummaryFromType(type);

    const severityClass = this.#getSeverityClass(severity);
    const typeLabel = this.#formatType(type);
    const cardId = `rec-card-${index}`;
    const detailsId = `rec-details-${index}`;

    const card = document.createElement('article');
    card.className = `recommendation-card ${severityClass}`;
    card.id = cardId;

    card.innerHTML = `
      <header class="rec-header">
        <div class="rec-prototypes">
          <span class="prototype-name">${this.#escapeHtml(prototypeA)}</span>
          <span class="vs-separator">↔</span>
          <span class="prototype-name">${this.#escapeHtml(prototypeB)}</span>
        </div>
        <div class="rec-badges">
          <span class="severity-badge ${severityClass}">${severity.toFixed(2)}</span>
          <span class="type-badge">${typeLabel}</span>
        </div>
      </header>
      <div class="rec-summary">
        <p>${this.#escapeHtml(summaryText)}</p>
      </div>
      <div id="${detailsId}" class="rec-details">
        <div class="rec-insight">
          <h4>Actionable Insight</h4>
          <p>${this.#escapeHtml(actionText)}</p>
        </div>
        ${this.#renderDivergenceExamples(divergenceExamples)}
        ${this.#renderAdditionalEvidence(secondaryMatches)}
      </div>
    `;

    elements.recommendationsContainer.appendChild(card);
  }

  /**
   * Get CSS class for recommendation type.
   *
   * @param {string} type - Recommendation type
   * @returns {string} CSS class name
   */
  getRecommendationTypeClass(type) {
    return MetadataRenderer.RECOMMENDATION_TYPE_CLASSES[type] || 'rec-type-info';
  }

  /**
   * Format a type value as a display label.
   *
   * @param {string} type - Type identifier
   * @returns {string} Formatted label
   */
  formatType(type) {
    return this.#formatType(type);
  }

  /**
   * Get severity CSS class.
   *
   * @param {number} severity - Severity value
   * @returns {string} CSS class name
   */
  getSeverityClass(severity) {
    return this.#getSeverityClass(severity);
  }

  /**
   * Format a metric value for display.
   *
   * @param {number|null|undefined} value - Metric value
   * @returns {string} Formatted value
   */
  formatMetric(value) {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return 'N/A';
    }
    if (!Number.isFinite(value)) {
      return 'N/A';
    }
    return value.toFixed(3);
  }

  /**
   * Build filtering breakdown HTML.
   *
   * @param {FilteringStats|undefined} filteringStats - Filtering statistics
   * @returns {string} HTML string
   * @private
   */
  #buildFilteringBreakdown(filteringStats) {
    if (!filteringStats) {
      return '';
    }

    const filteringPercentage =
      filteringStats.totalPossiblePairs > 0
        ? ((filteringStats.passedFiltering / filteringStats.totalPossiblePairs) * 100).toFixed(1)
        : '0.0';

    return `
      <div class="metadata-detail">
        <span class="detail-label">Total possible pairs:</span>
        <span class="detail-value">${filteringStats.totalPossiblePairs.toLocaleString()}</span>
      </div>
      <div class="metadata-detail">
        <span class="detail-label">Passed filtering:</span>
        <span class="detail-value">${filteringStats.passedFiltering.toLocaleString()} (${filteringPercentage}%)</span>
      </div>
      <div class="metadata-detail rejection-breakdown">
        <span class="detail-label">Rejected by:</span>
        <span class="detail-value">
          Axis overlap: ${filteringStats.rejectedByActiveAxisOverlap.toLocaleString()} |
          Sign agreement: ${filteringStats.rejectedBySignAgreement.toLocaleString()} |
          Cosine sim: ${filteringStats.rejectedByCosineSimilarity.toLocaleString()}
        </span>
      </div>
    `;
  }

  /**
   * Build classification breakdown HTML.
   *
   * @param {ClassificationBreakdown|undefined} classificationBreakdown - Classification breakdown
   * @returns {string} HTML string
   * @private
   */
  #buildClassificationBreakdown(classificationBreakdown) {
    if (!classificationBreakdown) {
      return '';
    }

    return `
      <div class="metadata-detail">
        <span class="detail-label">Classification:</span>
        <span class="detail-value">
          <span class="classification-merge">${classificationBreakdown.mergeRecommended} merge</span> |
          <span class="classification-subsumed">${classificationBreakdown.subsumedRecommended} subsumed</span> |
          <span class="classification-nested">${classificationBreakdown.nestedSiblings} nested</span> |
          <span class="classification-separation">${classificationBreakdown.needsSeparation} separation</span> |
          <span class="classification-expression">${classificationBreakdown.convertToExpression} expression</span> |
          <span class="classification-distinct">${classificationBreakdown.keepDistinct} distinct</span>
        </span>
      </div>
    `;
  }

  /**
   * Build summary section HTML.
   *
   * @param {SummaryInsight|undefined} summaryInsight - Summary insight data
   * @returns {string} HTML string
   * @private
   */
  #buildSummarySection(summaryInsight) {
    if (!summaryInsight) {
      return '';
    }

    const closestPairHtml = summaryInsight.closestPair
      ? `
        <div class="closest-pair">
          Closest pair: <em>${this.#escapeHtml(summaryInsight.closestPair.prototypeA)}</em> ↔
          <em>${this.#escapeHtml(summaryInsight.closestPair.prototypeB)}</em>
          <div class="closest-pair-metrics">
            <span title="Composite score: weighted combination of global output similarity (50%), gate overlap (30%), and correlation (20%)">
              composite: <strong>${this.formatMetric(summaryInsight.closestPair.compositeScore)}</strong>
            </span> |
            <span title="Proportion of contexts where both prototypes fire">
              gate overlap: ${this.formatMetric(summaryInsight.closestPair.gateOverlapRatio)}
            </span> |
            <span title="Pearson correlation when both prototypes fire (co-pass only)">
              correlation: ${this.formatMetric(summaryInsight.closestPair.correlation)}
            </span> |
            <span title="Mean absolute output difference over ALL samples (not just co-pass)">
              global diff: ${this.formatMetric(summaryInsight.closestPair.globalMeanAbsDiff)}
            </span>
          </div>
        </div>
      `
      : '';

    return `
      <div class="summary-insight status-${this.#escapeHtml(summaryInsight.status)}">
        <strong>Summary:</strong> ${this.#escapeHtml(summaryInsight.message)}
        ${closestPairHtml}
      </div>
    `;
  }

  /**
   * Build action text from v2 actions array or v1 string.
   *
   * @param {string[]|undefined} actions - V2 actions array
   * @param {string|undefined} actionableInsight - V1 actionable insight
   * @returns {string} Action text
   * @private
   */
  #buildActionText(actions, actionableInsight) {
    if (Array.isArray(actions) && actions.length > 0) {
      return actions.join(' • ');
    }
    if (actionableInsight) {
      return actionableInsight;
    }
    return 'No specific actions recommended.';
  }

  /**
   * Derive summary text from recommendation type.
   *
   * @param {string} type - Recommendation type
   * @returns {string} Summary text
   * @private
   */
  #deriveSummaryFromType(type) {
    return MetadataRenderer.TYPE_SUMMARIES[type] ?? 'Prototype overlap detected.';
  }

  /**
   * Get severity CSS class.
   *
   * @param {number} severity - Severity value
   * @returns {string} CSS class name
   * @private
   */
  #getSeverityClass(severity) {
    if (severity >= 0.8) return 'severity-high';
    if (severity >= 0.5) return 'severity-medium';
    return 'severity-low';
  }

  /**
   * Format type value as display label.
   *
   * @param {string} type - Type identifier
   * @returns {string} Formatted label
   * @private
   */
  #formatType(type) {
    return MetadataRenderer.TYPE_LABELS[type] ?? type;
  }

  /**
   * Render divergence examples HTML.
   *
   * @param {DivergenceExample[]} examples - Divergence examples
   * @returns {string} HTML string
   * @private
   */
  #renderDivergenceExamples(examples) {
    if (!examples || examples.length === 0) {
      return '';
    }

    const exampleItems = examples
      .slice(0, 3) // Show max 3 examples
      .map((ex) => {
        const diffFormatted =
          typeof ex.intensityDifference === 'number'
            ? ex.intensityDifference.toFixed(3)
            : 'N/A';
        return `
          <li class="divergence-example">
            <span class="diff-value">Δ ${diffFormatted}</span>
            <span class="example-context">${this.#escapeHtml(ex.contextSummary ?? '')}</span>
          </li>
        `;
      })
      .join('');

    return `
      <div class="rec-divergence">
        <h4>Divergence Examples</h4>
        <ul class="divergence-list">
          ${exampleItems}
        </ul>
      </div>
    `;
  }

  /**
   * Render additional evidence HTML.
   *
   * @param {MatchEvidence[]} matches - Secondary matches
   * @returns {string} HTML string
   * @private
   */
  #renderAdditionalEvidence(matches) {
    if (!Array.isArray(matches) || matches.length === 0) {
      return '';
    }

    const items = matches
      .map((match) => {
        const typeLabel = this.#formatType(match.type);
        const confidence = Number.isFinite(match.confidence)
          ? match.confidence.toFixed(2)
          : 'N/A';
        const evidenceSummary = this.#formatEvidenceForDisplay(match.evidence);
        return `
          <li class="evidence-item">
            <span class="evidence-pill">${this.#escapeHtml(typeLabel)}</span>
            <span class="evidence-confidence">Confidence ${confidence}</span>
            <span class="evidence-summary">${this.#escapeHtml(evidenceSummary)}</span>
          </li>
        `;
      })
      .join('');

    return `
      <details class="rec-evidence">
        <summary>Additional Evidence</summary>
        <ul class="evidence-list">
          ${items}
        </ul>
      </details>
    `;
  }

  /**
   * Format evidence object for display.
   *
   * @param {object|undefined} evidence - Evidence object
   * @returns {string} Formatted evidence string
   * @private
   */
  #formatEvidenceForDisplay(evidence) {
    if (!evidence || typeof evidence !== 'object') {
      return '';
    }

    const entries = Object.entries(evidence)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        if (typeof value === 'number') {
          return `${key}: ${value.toFixed(2)}`;
        }
        return `${key}: ${String(value)}`;
      });

    return entries.slice(0, 4).join(', ');
  }

  /**
   * Escape HTML characters for safe display.
   *
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   * @private
   */
  #escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default MetadataRenderer;
