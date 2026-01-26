/**
 * @file PCA Results Renderer - Renders Principal Component Analysis results
 * @description Extracted from PrototypeAnalysisController to reduce file size.
 * Handles rendering of PCA summary, sparse axes, unused axes, methodology notes,
 * and top-loading prototypes.
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} PCAAnalysis
 * @property {number} [residualVarianceRatio] - Residual variance ratio from PCA
 * @property {number} [significantComponentCount] - Number of significant components
 * @property {number} [expectedComponentCount] - Expected number of components (K)
 * @property {number} [significantBeyondExpected] - Components beyond expected
 * @property {Array<{prototypeId: string, score?: number, loading?: number, contribution?: number}>} [topLoadingPrototypes] - Prototypes with highest loadings
 * @property {string[]} [dimensionsUsed] - Dimensions used in PCA
 * @property {string[]} [excludedSparseAxes] - Axes excluded due to sparsity
 * @property {string[]} [unusedDefinedAxes] - Axes defined but not used in weights
 * @property {string[]} [unusedInGates] - Axes used in weights but not in gates
 * @property {number} [componentsFor80Pct] - Components needed for 80% variance
 * @property {number} [componentsFor90Pct] - Components needed for 90% variance
 * @property {Array<{prototypeId: string, error: number}>} [reconstructionErrors] - Prototypes with reconstruction errors
 */

/**
 * @typedef {object} PCADomElements
 * @property {HTMLElement} [residualVariance] - Element displaying residual variance
 * @property {HTMLElement} [significantComponentCount] - Element displaying significant component count
 * @property {HTMLElement} [expectedComponentCount] - Element displaying expected component count
 * @property {HTMLElement} [significantBeyondExpected] - Element displaying components beyond expected
 * @property {HTMLElement} [pcaDimensionsList] - Container for dimension tags
 * @property {HTMLElement} [pcaDimensionsUsed] - Element displaying dimension count
 * @property {HTMLElement} [pcaExcludedAxesList] - Container for excluded sparse axes
 * @property {HTMLElement} [pcaUnusedAxesList] - Container for unused defined axes
 * @property {HTMLElement} [pcaUnusedInGatesList] - Container for axes unused in gates
 * @property {HTMLElement} [pcaMethodologyNote] - Container for methodology notes
 * @property {HTMLElement} [componentsFor80] - Element for 80% variance threshold
 * @property {HTMLElement} [componentsFor90] - Element for 90% variance threshold
 * @property {HTMLElement} [poorlyFittingList] - List of poorly fitting prototypes
 * @property {HTMLElement} [pcaTopLoading] - Container for top loading prototypes
 */

/**
 * @typedef {import('../../../interfaces/ILogger').ILogger} ILogger
 */

/**
 * Renderer for PCA (Principal Component Analysis) results.
 * Handles all PCA-related DOM rendering operations.
 */
class PCAResultsRenderer {
  /** @type {ILogger} */
  #logger;

  /**
   * Creates a new PCAResultsRenderer.
   *
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('[PCAResultsRenderer] Initialized.');
  }

  /**
   * Escapes HTML characters to prevent XSS.
   *
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  #escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Formats a numeric metric value.
   *
   * @private
   * @param {number} value - Value to format
   * @returns {string} Formatted value
   */
  #formatMetric(value) {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return 'N/A';
    }
    if (!Number.isFinite(value)) {
      return 'N/A';
    }
    return value.toFixed(3);
  }

  /**
   * Generates explanation for top loading prototype scores.
   *
   * @private
   * @param {number} score - The projection score
   * @returns {string} Human-readable explanation
   */
  #generateTopLoadingExplanation(score) {
    const absScore = Math.abs(score);
    if (absScore > 0.8) {
      return `Projection score ${score.toFixed(2)} on unexplained component - strong signal for new dimension`;
    } else if (absScore > 0.5) {
      return `Projection score ${score.toFixed(2)} - moderate signal for potential new dimension`;
    }
    return `Projection score ${score.toFixed(2)} - within expected range`;
  }

  /**
   * Renders the complete PCA summary section.
   *
   * @param {PCAAnalysis} pcaAnalysis - PCA analysis data
   * @param {PCADomElements} elements - DOM elements for rendering
   */
  render(pcaAnalysis, elements) {
    if (!pcaAnalysis) return;

    const {
      residualVarianceRatio,
      significantComponentCount,
      expectedComponentCount,
      significantBeyondExpected,
      topLoadingPrototypes,
      dimensionsUsed,
      excludedSparseAxes,
      unusedDefinedAxes,
      unusedInGates,
      componentsFor80Pct,
      componentsFor90Pct,
      reconstructionErrors,
    } = pcaAnalysis;

    // Render residual variance with warning/alert classes
    this.#renderResidualVariance(elements.residualVariance, residualVarianceRatio);

    // Render significant component count (broken-stick)
    this.#renderComponentCount(elements.significantComponentCount, significantComponentCount);

    // Render expected component count (K)
    this.#renderComponentCount(elements.expectedComponentCount, expectedComponentCount);

    // Render significant beyond expected with visual indicator
    this.#renderSignificantBeyondExpected(
      elements.significantBeyondExpected,
      significantBeyondExpected,
      residualVarianceRatio
    );

    // Render dimensions list with tags and count
    this.#renderDimensionsList(elements.pcaDimensionsList, elements.pcaDimensionsUsed, dimensionsUsed);

    // Render excluded sparse axes (if any were filtered out)
    this.#renderExcludedSparseAxes(elements, excludedSparseAxes);

    // Render unused but defined axes (0% usage axes)
    this.#renderUnusedDefinedAxes(elements, unusedDefinedAxes);

    // Render axes used in weights but not in any prototype gates
    this.#renderUnusedInGates(elements, unusedInGates);

    // Render methodology note explaining broken-stick null hypothesis testing
    this.#renderMethodologyNote(elements, significantBeyondExpected, residualVarianceRatio);

    // Render components for 80% variance
    if (elements.componentsFor80) {
      elements.componentsFor80.textContent =
        componentsFor80Pct !== undefined ? componentsFor80Pct.toString() : '--';
    }

    // Render components for 90% variance
    if (elements.componentsFor90) {
      elements.componentsFor90.textContent =
        componentsFor90Pct !== undefined ? componentsFor90Pct.toString() : '--';
    }

    // Render poorly fitting prototypes (reconstruction errors)
    this.#renderPoorlyFittingList(elements.poorlyFittingList, reconstructionErrors);

    // Render top loading prototypes with enhanced explanations
    this.#renderTopLoadingPrototypes(elements.pcaTopLoading, topLoadingPrototypes);
  }

  /**
   * Renders the residual variance metric.
   *
   * @private
   * @param {HTMLElement|null} element - Target element
   * @param {number|undefined} residualVarianceRatio - Variance ratio
   */
  #renderResidualVariance(element, residualVarianceRatio) {
    if (!element) return;

    const formattedVariance =
      residualVarianceRatio !== undefined
        ? (residualVarianceRatio * 100).toFixed(1) + '%'
        : '--';
    element.textContent = formattedVariance;
    element.className = 'metric-value';

    // Apply warning/alert classes based on thresholds
    if (residualVarianceRatio > 0.15) {
      element.classList.add('alert');
    } else if (residualVarianceRatio > 0.1) {
      element.classList.add('warning');
    }
  }

  /**
   * Renders a component count metric.
   *
   * @private
   * @param {HTMLElement|null} element - Target element
   * @param {number|undefined} count - Component count
   */
  #renderComponentCount(element, count) {
    if (!element) return;
    element.textContent = count?.toString() ?? '--';
  }

  /**
   * Renders significant beyond expected with visual indicator.
   *
   * @private
   * @param {HTMLElement|null} element - Target element
   * @param {number|undefined} significantBeyondExpected - Beyond expected count
   * @param {number|undefined} residualVarianceRatio - Variance ratio for context
   */
  #renderSignificantBeyondExpected(element, significantBeyondExpected, residualVarianceRatio) {
    if (!element) return;

    const beyondValue = significantBeyondExpected ?? 0;
    element.textContent = beyondValue.toString();
    element.className = 'metric-value';

    // Add visual indicator when 0 but residual variance is high
    if (beyondValue === 0 && residualVarianceRatio > 0.15) {
      element.classList.add('zero-with-residual');
      element.textContent = '0 *';
    }
  }

  /**
   * Renders the dimensions list with tags and count.
   *
   * @private
   * @param {HTMLElement|null} listElement - Container for dimension tags
   * @param {HTMLElement|null} countElement - Element showing count
   * @param {string[]|undefined} dimensions - Dimension names
   */
  #renderDimensionsList(listElement, countElement, dimensions) {
    if (listElement) {
      if (Array.isArray(dimensions) && dimensions.length > 0) {
        listElement.innerHTML = dimensions
          .map((dim) => `<span class="dimension-tag">${this.#escapeHtml(dim)}</span>`)
          .join('');
      } else {
        listElement.innerHTML = '';
      }
    }

    if (countElement) {
      countElement.textContent =
        Array.isArray(dimensions) && dimensions.length > 0
          ? dimensions.length.toString()
          : '--';
    }
  }

  /**
   * Renders excluded sparse axes section.
   *
   * @private
   * @param {PCADomElements} elements - DOM elements
   * @param {string[]|undefined} excludedSparseAxes - Excluded axes
   */
  #renderExcludedSparseAxes(elements, excludedSparseAxes) {
    // Try to find the container, or create it dynamically near dimensions list
    let container = elements.pcaExcludedAxesList;

    if (!container && elements.pcaDimensionsList) {
      // Create container dynamically after dimensions list
      container = document.createElement('div');
      container.id = 'pca-excluded-axes-list';
      container.className = 'excluded-axes-section';
      elements.pcaDimensionsList.parentNode?.insertBefore(
        container,
        elements.pcaDimensionsList.nextSibling
      );
      elements.pcaExcludedAxesList = container;
    }

    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    // Only display if there are excluded axes
    if (!Array.isArray(excludedSparseAxes) || excludedSparseAxes.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const header = document.createElement('h5');
    header.className = 'excluded-axes-header';
    header.textContent = `Excluded Sparse Axes (${excludedSparseAxes.length})`;

    const helpText = document.createElement('p');
    helpText.className = 'pca-subtitle excluded-axes-help';
    helpText.textContent =
      'Axes used by <10% of prototypes are excluded to prevent sparse axes from ' +
      'distorting PCA due to unbalanced variance contributions from infrequent usage.';

    const tagContainer = document.createElement('div');
    tagContainer.className = 'excluded-axes-tags';
    excludedSparseAxes.forEach((axis) => {
      const tag = document.createElement('span');
      tag.className = 'dimension-tag excluded';
      tag.textContent = this.#escapeHtml(axis);
      tagContainer.appendChild(tag);
    });

    container.appendChild(header);
    container.appendChild(helpText);
    container.appendChild(tagContainer);
  }

  /**
   * Renders unused but defined axes section.
   *
   * @private
   * @param {PCADomElements} elements - DOM elements
   * @param {string[]|undefined} unusedDefinedAxes - Unused axes
   */
  #renderUnusedDefinedAxes(elements, unusedDefinedAxes) {
    // Try to find the container, or create it dynamically near excluded axes
    let container = elements.pcaUnusedAxesList;

    if (!container && elements.pcaExcludedAxesList) {
      // Create container dynamically after excluded axes list
      container = document.createElement('div');
      container.id = 'pca-unused-axes-list';
      container.className = 'unused-axes-section';
      elements.pcaExcludedAxesList.parentNode?.insertBefore(
        container,
        elements.pcaExcludedAxesList.nextSibling
      );
      elements.pcaUnusedAxesList = container;
    }

    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    // Only display if there are unused axes
    if (!Array.isArray(unusedDefinedAxes) || unusedDefinedAxes.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const header = document.createElement('h5');
    header.className = 'unused-axes-header';
    header.textContent = `Unused but Defined Axes (${unusedDefinedAxes.length})`;

    const helpText = document.createElement('p');
    helpText.className = 'pca-subtitle unused-axes-help';
    helpText.textContent =
      'These axes are defined in the weight-axis registry but appear in zero prototype WEIGHTS. ' +
      'Note: They may still be used in gate conditions. ' +
      'Consider adding prototypes that use them in weights, or verify they are not needed in gates before removing.';

    const tagContainer = document.createElement('div');
    tagContainer.className = 'unused-axes-tags';
    unusedDefinedAxes.forEach((axis) => {
      const tag = document.createElement('span');
      tag.className = 'dimension-tag unused';
      tag.textContent = this.#escapeHtml(axis);
      tagContainer.appendChild(tag);
    });

    container.appendChild(header);
    container.appendChild(helpText);
    container.appendChild(tagContainer);
  }

  /**
   * Renders axes used in weights but not in gates.
   *
   * @private
   * @param {PCADomElements} elements - DOM elements
   * @param {string[]|undefined} unusedInGates - Unused in gates axes
   */
  #renderUnusedInGates(elements, unusedInGates) {
    // Try to find the container, or create it dynamically near unused axes
    let container = elements.pcaUnusedInGatesList;

    if (!container && elements.pcaUnusedAxesList) {
      // Create container dynamically after unused defined axes list
      container = document.createElement('div');
      container.id = 'pca-unused-in-gates-list';
      container.className = 'unused-in-gates-section';
      elements.pcaUnusedAxesList.parentNode?.insertBefore(
        container,
        elements.pcaUnusedAxesList.nextSibling
      );
      elements.pcaUnusedInGatesList = container;
    }

    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    // Only display if there are unused-in-gates axes
    if (!Array.isArray(unusedInGates) || unusedInGates.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const header = document.createElement('h5');
    header.className = 'unused-in-gates-header';
    header.textContent = `Used in Weights but Not in Gates (${unusedInGates.length})`;

    const helpText = document.createElement('p');
    helpText.className = 'pca-subtitle unused-in-gates-help';
    helpText.textContent =
      'These axes appear in prototype WEIGHTS but never appear in any prototype gate conditions. ' +
      'Consider adding gates that reference these axes, or verify they are not needed as gates.';

    const tagContainer = document.createElement('div');
    tagContainer.className = 'unused-in-gates-tags';
    unusedInGates.forEach((axis) => {
      const tag = document.createElement('span');
      tag.className = 'dimension-tag gate-unused';
      tag.textContent = this.#escapeHtml(axis);
      tagContainer.appendChild(tag);
    });

    container.appendChild(header);
    container.appendChild(helpText);
    container.appendChild(tagContainer);
  }

  /**
   * Renders methodology note explaining broken-stick null hypothesis testing.
   *
   * @private
   * @param {PCADomElements} elements - DOM elements
   * @param {number|undefined} significantBeyondExpected - Beyond expected count
   * @param {number|undefined} residualVarianceRatio - Variance ratio
   */
  #renderMethodologyNote(elements, significantBeyondExpected, residualVarianceRatio) {
    // Try to find the container, or create it dynamically
    let container = elements.pcaMethodologyNote;

    if (!container && elements.significantBeyondExpected) {
      // Create container dynamically after significant beyond expected metric
      container = document.createElement('div');
      container.id = 'pca-methodology-note';
      container.className = 'methodology-note';
      const parentRow = elements.significantBeyondExpected.closest('.metric-row');
      parentRow?.parentNode?.insertBefore(container, parentRow.nextSibling);
      elements.pcaMethodologyNote = container;
    }

    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    const beyondValue = significantBeyondExpected ?? 0;
    const residual = residualVarianceRatio ?? 0;
    const highResidual = residual >= 0.15;

    // Only show note when it's contextually useful
    if (beyondValue === 0 && highResidual) {
      // Special case: high residual but no extra components - explain why
      const note = document.createElement('div');
      note.className = 'methodology-explanation warning';
      note.innerHTML = `
        <strong>Methodology Note:</strong> The broken-stick null hypothesis test
        found 0 additional significant components. This means the eigenvalue distribution
        matches random expectation—variance is diffuse across many small components rather
        than concentrated in discoverable hidden dimensions. High residual variance
        (${(residual * 100).toFixed(1)}%) with 0 extra components suggests the unexplained
        variance may be noise or idiosyncratic prototype differences, not a missing axis.
      `;
      container.appendChild(note);
    } else if (beyondValue > 0) {
      // Has extra components - explain what that means
      const note = document.createElement('div');
      note.className = 'methodology-explanation alert';
      note.innerHTML = `
        <strong>Methodology Note:</strong> The broken-stick test found ${beyondValue}
        component${beyondValue > 1 ? 's' : ''} with variance exceeding random expectation.
        This suggests ${beyondValue > 1 ? 'multiple missing dimensions' : 'a potential missing axis'}
        in the current weight space.
      `;
      container.appendChild(note);
    } else {
      // No special case - hide the container
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
  }

  /**
   * Renders poorly fitting prototypes list.
   *
   * @private
   * @param {HTMLElement|null} listElement - Target list element
   * @param {Array<{prototypeId: string, error: number}>|undefined} reconstructionErrors - Errors
   */
  #renderPoorlyFittingList(listElement, reconstructionErrors) {
    if (!listElement) return;

    if (Array.isArray(reconstructionErrors) && reconstructionErrors.length > 0) {
      listElement.innerHTML = '';
      reconstructionErrors.forEach((item) => {
        const li = document.createElement('li');
        const errorClass = item.error > 0.5 ? 'high-error' : '';
        const explanation =
          item.error > 0.5
            ? "exceeds 0.5 threshold - doesn't fit current axis space"
            : 'moderate error - may indicate edge case';
        li.innerHTML = `
          <span class="prototype-id">${this.#escapeHtml(item.prototypeId)}</span>
          <span class="error-value ${errorClass}" title="${explanation}">RMSE: ${item.error.toFixed(3)}</span>
        `;
        listElement.appendChild(li);
      });
    } else {
      listElement.innerHTML =
        '<li class="empty-list-message">No poorly fitting prototypes detected</li>';
    }
  }

  /**
   * Renders top loading prototypes with enhanced explanations.
   *
   * @private
   * @param {HTMLElement|null} container - Target container
   * @param {Array<{prototypeId?: string, id?: string, score?: number, loading?: number, contribution?: number}>|undefined} topLoadingPrototypes - Array of top loading prototypes
   */
  #renderTopLoadingPrototypes(container, topLoadingPrototypes) {
    if (!container || !Array.isArray(topLoadingPrototypes)) return;

    if (topLoadingPrototypes.length === 0) {
      container.innerHTML = '';
      return;
    }

    const header = document.createElement('h4');
    header.textContent = 'Extreme Prototypes on Additional Component';

    const subtitle = document.createElement('p');
    subtitle.className = 'pca-subtitle';
    subtitle.textContent =
      'Prototypes with highest |projection| on unexplained variance component';

    const list = document.createElement('div');
    list.className = 'top-loading-items';

    topLoadingPrototypes.slice(0, 5).forEach((item) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'top-loading-item';
      // Support both new 'score' field and legacy 'loading'/'contribution' fields
      const scoreValue = item.score ?? item.loading ?? item.contribution ?? 0;
      const explanation = this.#generateTopLoadingExplanation(scoreValue);
      itemDiv.innerHTML = `
        <span class="prototype-id">${this.#escapeHtml(item.prototypeId ?? item.id ?? 'Unknown')}</span>
        <span class="loading-value" title="${explanation}">${this.#formatMetric(scoreValue)}</span>
      `;
      list.appendChild(itemDiv);
    });

    container.innerHTML = '';
    container.appendChild(header);
    container.appendChild(subtitle);
    container.appendChild(list);
  }
}

export default PCAResultsRenderer;
