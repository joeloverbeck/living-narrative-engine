/**
 * @file Complexity Renderer for prototype analysis.
 * Handles rendering of complexity analysis results including histograms,
 * outliers, co-occurrence bundles, and recommendations.
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} DistributionHistogramBin
 * @property {number} bin - The bin value (axis count)
 * @property {number} count - Number of prototypes in this bin
 */

/**
 * @typedef {object} DistributionOutlier
 * @property {string} prototypeId - The prototype identifier
 * @property {number} axisCount - Number of axes
 */

/**
 * @typedef {object} CoOccurrenceBundle
 * @property {string[]} axes - Array of axis names in the bundle
 * @property {number} frequency - How many prototypes contain this bundle
 * @property {string} [suggestedConcept] - Optional suggested concept name
 */

/**
 * @typedef {object} ComplexityRecommendation
 * @property {string} [type] - Recommendation type
 * @property {string[]} [bundle] - Associated axis bundle
 * @property {string} [reason] - Recommendation reason
 */

/**
 * @typedef {object} Distribution
 * @property {number} median - Median value
 * @property {number} q1 - First quartile
 * @property {number} q3 - Third quartile
 * @property {DistributionHistogramBin[]} [histogram] - Histogram data
 * @property {DistributionOutlier[]} [outliers] - Statistical outliers
 */

/**
 * @typedef {object} CoOccurrence
 * @property {CoOccurrenceBundle[]} [bundles] - Co-occurrence bundles
 */

/**
 * @typedef {object} ComplexityAnalysis
 * @property {number} [totalPrototypes] - Total prototypes analyzed
 * @property {number} [averageComplexity] - Average axis count
 * @property {Distribution} [distribution] - Distribution statistics
 * @property {CoOccurrence} [coOccurrence] - Co-occurrence analysis
 * @property {ComplexityRecommendation[]} [recommendations] - Recommendations
 */

/**
 * @typedef {object} ComplexityElements
 * @property {HTMLElement|null} complexityAnalysisContainer - Container for complexity analysis
 */

/**
 * Renderer for complexity analysis in prototype analysis.
 * Handles rendering of complexity summaries, histograms, outliers,
 * co-occurrence bundles, and recommendations.
 */
class ComplexityRenderer {
  /** @type {object} */
  #logger;

  /**
   * CSS class mappings for recommendation types.
   *
   * @type {Record<string, string>}
   */
  static RECOMMENDATION_TYPE_CLASSES = {
    consider_new_axis: 'rec-type-axis',
    refine_bundle: 'rec-type-refine',
    investigate: 'rec-type-investigate',
    simplify: 'rec-type-simplify',
  };

  /**
   * Create a ComplexityRenderer.
   *
   * @param {object} dependencies - Injected dependencies
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('[ComplexityRenderer] Initialized.');
  }

  /**
   * Escape HTML to prevent XSS.
   *
   * @param {string} text - Raw text
   * @returns {string} Escaped HTML
   * @private
   */
  #escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get CSS class for recommendation type badge.
   *
   * @param {string} type - Recommendation type
   * @returns {string} CSS class name
   */
  getRecommendationTypeClass(type) {
    return ComplexityRenderer.RECOMMENDATION_TYPE_CLASSES[type] || 'rec-type-info';
  }

  /**
   * Render complexity analysis section.
   *
   * @param {ComplexityAnalysis|null} complexityAnalysis - Complexity analysis result
   * @param {ComplexityElements} elements - DOM elements
   */
  renderComplexityAnalysis(complexityAnalysis, elements) {
    const { complexityAnalysisContainer } = elements;
    if (!complexityAnalysisContainer) return;

    complexityAnalysisContainer.innerHTML = '';

    if (!complexityAnalysis) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'Complexity analysis not available.';
      complexityAnalysisContainer.appendChild(emptyMsg);
      return;
    }

    const {
      totalPrototypes = 0,
      averageComplexity = 0,
      distribution = null,
      coOccurrence = null,
      recommendations = [],
    } = complexityAnalysis;

    // Render summary
    this.#renderSummary(complexityAnalysisContainer, totalPrototypes, averageComplexity, distribution);

    // Render distribution histogram if available
    if (distribution && distribution.histogram) {
      this.#renderDistributionHistogram(complexityAnalysisContainer, distribution.histogram);
    }

    // Render outliers if any
    if (distribution && Array.isArray(distribution.outliers) && distribution.outliers.length > 0) {
      this.#renderOutliers(complexityAnalysisContainer, distribution.outliers);
    }

    // Render co-occurrence bundles if available
    if (coOccurrence && Array.isArray(coOccurrence.bundles) && coOccurrence.bundles.length > 0) {
      this.#renderCoOccurrenceBundles(complexityAnalysisContainer, coOccurrence.bundles);
    }

    // Render recommendations if any
    if (Array.isArray(recommendations) && recommendations.length > 0) {
      this.#renderRecommendations(complexityAnalysisContainer, recommendations);
    }
  }

  /**
   * Render the complexity summary section.
   *
   * @param {HTMLElement} container - Container element
   * @param {number} totalPrototypes - Total prototypes count
   * @param {number} averageComplexity - Average complexity value
   * @param {Distribution|null} distribution - Distribution statistics
   * @private
   */
  #renderSummary(container, totalPrototypes, averageComplexity, distribution) {
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'complexity-summary';
    summaryDiv.innerHTML = `
      <div class="complexity-summary-item">
        <span class="complexity-summary-label">Prototypes Analyzed:</span>
        <span class="complexity-summary-value">${totalPrototypes}</span>
      </div>
      <div class="complexity-summary-item">
        <span class="complexity-summary-label">Average Axis Count:</span>
        <span class="complexity-summary-value">${averageComplexity.toFixed(2)}</span>
      </div>
      ${distribution ? `
      <div class="complexity-summary-item">
        <span class="complexity-summary-label">Median:</span>
        <span class="complexity-summary-value">${distribution.median}</span>
      </div>
      <div class="complexity-summary-item">
        <span class="complexity-summary-label">Q1 / Q3:</span>
        <span class="complexity-summary-value">${distribution.q1} / ${distribution.q3}</span>
      </div>
      ` : ''}
    `;
    container.appendChild(summaryDiv);
  }

  /**
   * Render the distribution histogram section.
   *
   * @param {HTMLElement} container - Container element
   * @param {DistributionHistogramBin[]} histogram - Histogram data
   * @private
   */
  #renderDistributionHistogram(container, histogram) {
    const histogramDiv = document.createElement('div');
    histogramDiv.className = 'complexity-distribution-section';
    histogramDiv.innerHTML = `
      <h4>Axis Count Distribution</h4>
      <div class="complexity-histogram">
        ${this.renderHistogramBars(histogram)}
      </div>
    `;
    container.appendChild(histogramDiv);
  }

  /**
   * Render outliers section.
   *
   * @param {HTMLElement} container - Container element
   * @param {DistributionOutlier[]} outliers - Outlier data
   * @private
   */
  #renderOutliers(container, outliers) {
    const outliersDiv = document.createElement('div');
    outliersDiv.className = 'complexity-outliers-section';
    outliersDiv.innerHTML = `
      <h4>Complexity Outliers (${outliers.length})</h4>
      <p class="section-description">Prototypes with unusually high axis counts (statistical outliers).</p>
      <ul class="outliers-list">
        ${outliers.map((o) => `
          <li class="outlier-item">
            <span class="outlier-prototype">${this.#escapeHtml(o.prototypeId)}</span>
            <span class="outlier-count">${o.axisCount} axes</span>
          </li>
        `).join('')}
      </ul>
    `;
    container.appendChild(outliersDiv);
  }

  /**
   * Render co-occurrence bundles section.
   *
   * @param {HTMLElement} container - Container element
   * @param {CoOccurrenceBundle[]} bundles - Bundle data
   * @private
   */
  #renderCoOccurrenceBundles(container, bundles) {
    const bundlesDiv = document.createElement('div');
    bundlesDiv.className = 'complexity-bundles-section';
    bundlesDiv.innerHTML = `
      <h4>Frequently Co-occurring Axis Bundles (${bundles.length})</h4>
      <p class="section-description">Axes that frequently appear together may suggest composite concepts.</p>
      <ul class="bundles-list">
        ${bundles.map((bundle) => `
          <li class="bundle-item">
            <div class="bundle-axes">
              ${bundle.axes.map((axis) => `<span class="bundle-axis-tag">${this.#escapeHtml(axis)}</span>`).join('')}
            </div>
            <div class="bundle-meta">
              <span class="bundle-frequency">Appears in ${bundle.frequency} prototypes</span>
              ${bundle.suggestedConcept ? `<span class="bundle-suggestion">Suggested: ${this.#escapeHtml(bundle.suggestedConcept)}</span>` : ''}
            </div>
          </li>
        `).join('')}
      </ul>
    `;
    container.appendChild(bundlesDiv);
  }

  /**
   * Render recommendations section.
   *
   * @param {HTMLElement} container - Container element
   * @param {ComplexityRecommendation[]} recommendations - Recommendations
   * @private
   */
  #renderRecommendations(container, recommendations) {
    const recsDiv = document.createElement('div');
    recsDiv.className = 'complexity-recommendations-section';
    recsDiv.innerHTML = `
      <h4>Complexity Recommendations (${recommendations.length})</h4>
      <ul class="complexity-recommendations-list">
        ${recommendations.map((rec) => `
          <li class="complexity-recommendation-item">
            <span class="recommendation-type-badge ${this.getRecommendationTypeClass(rec.type)}">${this.#escapeHtml(rec.type || 'info')}</span>
            ${rec.bundle ? `<span class="recommendation-bundle">${rec.bundle.map((a) => this.#escapeHtml(a)).join(' + ')}</span>` : ''}
            <span class="recommendation-reason">${this.#escapeHtml(rec.reason || '')}</span>
          </li>
        `).join('')}
      </ul>
    `;
    container.appendChild(recsDiv);
  }

  /**
   * Render histogram bars for axis count distribution.
   *
   * @param {DistributionHistogramBin[]} histogram - Array of histogram bin objects
   * @returns {string} HTML string for histogram bars
   */
  renderHistogramBars(histogram) {
    // Handle array format: [{bin, count}, ...]
    if (!Array.isArray(histogram) || histogram.length === 0) {
      return '<p class="empty-list-message">No histogram data.</p>';
    }

    const sortedEntries = [...histogram].sort((a, b) => a.bin - b.bin);
    const maxCount = Math.max(...sortedEntries.map((h) => h.count));
    if (maxCount === 0) return '<p class="empty-list-message">No histogram data.</p>';

    const barsHtml = sortedEntries
      .map(({ bin, count }) => {
        const heightPercent = (count / maxCount) * 100;
        return `
          <div class="histogram-bar-container">
            <span class="histogram-count">${count}</span>
            <div class="histogram-bar" style="height: ${heightPercent}%"></div>
            <span class="histogram-label">${bin}</span>
          </div>
        `;
      })
      .join('');

    // Add collapsible table fallback for explicit clarity
    const tableRows = sortedEntries
      .map(({ bin, count }) => `<tr><td>${bin}</td><td>${count}</td></tr>`)
      .join('');

    const tableFallback = `
      <details class="histogram-table-fallback">
        <summary>View as table</summary>
        <table class="histogram-data-table">
          <thead><tr><th>Axis Count</th><th>Prototypes</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </details>
    `;

    return barsHtml + tableFallback;
  }
}

export default ComplexityRenderer;
