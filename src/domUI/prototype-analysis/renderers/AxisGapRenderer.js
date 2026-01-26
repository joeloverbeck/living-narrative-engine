/**
 * @file Renderer for axis gap analysis display components
 * Handles rendering of summary statistics, hub prototypes, coverage gaps,
 * multi-axis conflicts, sign tensions, and polarity analysis.
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {Object} AxisGapSummary
 * @property {number} [totalPrototypesAnalyzed] - Total prototypes in analysis
 * @property {number} [recommendationCount] - Number of axis recommendations
 * @property {number} [potentialGapsDetected] - Backward compat: potential gaps
 * @property {string} [confidence] - Confidence level (HIGH/MEDIUM/LOW)
 * @property {Object} [signalBreakdown] - Signal breakdown by category
 * @property {number} [signalBreakdown.pcaSignals] - PCA signal count
 * @property {number} [signalBreakdown.hubSignals] - Hub signal count
 * @property {number} [signalBreakdown.coverageGapSignals] - Coverage gap signals
 * @property {number} [signalBreakdown.multiAxisConflictSignals] - Conflict signals
 */

/**
 * @typedef {Object} HubPrototype
 * @property {string} [prototypeId] - Prototype identifier
 * @property {string} [id] - Fallback prototype identifier
 * @property {number} [hubScore] - Hub score value
 * @property {number} [score] - Fallback score value
 * @property {number} [connectedClusters] - Number of connected clusters
 * @property {number} [spanningAxes] - Number of axes spanned
 * @property {number} [axisCount] - Fallback axis count
 * @property {string} [explanation] - Optional explanation text
 */

/**
 * @typedef {Object} CoverageGap
 * @property {string} [clusterLabel] - Label for the gap cluster
 * @property {string} [label] - Fallback label
 * @property {number} [distanceFromAxes] - Distance from nearest axis
 * @property {number} [distance] - Fallback distance value
 * @property {number} [prototypeCount] - Number of prototypes in gap
 * @property {string} [explanation] - Optional explanation text
 */

/**
 * @typedef {Object} MultiAxisConflict
 * @property {string} [prototypeId] - Prototype identifier
 * @property {string} [id] - Fallback identifier
 * @property {number} [activeAxisCount] - Number of active axes
 * @property {number} [axisCount] - Fallback axis count
 * @property {string[]} [conflictingAxes] - List of conflicting axis names
 * @property {number} [signBalance] - Sign balance ratio
 * @property {number} [balance] - Fallback balance value
 * @property {string} [explanation] - Optional explanation text
 */

/**
 * @typedef {Object} SignTension
 * @property {string} [prototypeId] - Prototype identifier
 * @property {string} [id] - Fallback identifier
 * @property {number} [activeAxisCount] - Number of active axes
 * @property {number} [signBalance] - Sign balance ratio (0-1)
 * @property {string[]} [highMagnitudePositive] - Positive high-magnitude axes
 * @property {string[]} [positiveAxes] - Fallback positive axes
 * @property {string[]} [highMagnitudeNegative] - Negative high-magnitude axes
 * @property {string[]} [negativeAxes] - Fallback negative axes
 */

/**
 * @typedef {Object} ImbalancedAxis
 * @property {string} [axis] - Axis name
 * @property {string} [direction] - Dominant direction (positive/negative)
 * @property {number} [ratio] - Imbalance ratio
 * @property {number} [dominant] - Count of dominant direction prototypes
 * @property {number} [minority] - Count of minority direction prototypes
 */

/**
 * @typedef {Object} PolarityAnalysis
 * @property {number} [imbalancedCount] - Number of imbalanced axes
 * @property {ImbalancedAxis[]} [imbalancedAxes] - Array of imbalanced axis data
 * @property {string[]} [warnings] - Warning messages
 */

/**
 * @typedef {Object} PcaAnalysis
 * @property {number} [residualVarianceRatio] - Residual variance ratio
 * @property {number} [additionalSignificantComponents] - Additional components
 */

/**
 * @typedef {Object} AxisGapDomElements
 * @property {HTMLElement} [axisGapTotalPrototypes] - Total prototypes element
 * @property {HTMLElement} [axisGapRecommendations] - Recommendations count element
 * @property {HTMLElement} [axisGapConfidence] - Confidence badge element
 * @property {HTMLElement} [signalPca] - PCA signal count element
 * @property {HTMLElement} [signalHubs] - Hubs signal count element
 * @property {HTMLElement} [signalCoverageGaps] - Coverage gaps signal element
 * @property {HTMLElement} [signalMultiAxisConflicts] - Conflicts signal element
 * @property {HTMLElement} [signalPcaStatus] - PCA status element
 * @property {HTMLElement} [signalHubsStatus] - Hubs status element
 * @property {HTMLElement} [signalCoverageGapsStatus] - Coverage gaps status
 * @property {HTMLElement} [signalMultiAxisConflictsStatus] - Conflicts status
 * @property {HTMLElement} [signalPcaThreshold] - PCA threshold display
 * @property {HTMLElement} [signalCoverageGapsThreshold] - Coverage threshold
 * @property {HTMLElement} [hubList] - Hub prototypes list container
 * @property {HTMLElement} [coverageGapList] - Coverage gaps list container
 * @property {HTMLElement} [conflictList] - Multi-axis conflicts list container
 * @property {HTMLElement} [signTensionList] - Sign tensions list container
 * @property {HTMLElement} [polarityAnalysisList] - Polarity analysis container
 */

/**
 * Renderer responsible for axis gap analysis display components.
 * Handles summary statistics, signal breakdown, and various analysis lists.
 */
class AxisGapRenderer {
  /** @type {Object} */
  #logger;

  /**
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} dependencies.logger - Logger instance with debug/info/warn/error
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('[AxisGapRenderer] Initialized.');
  }

  /**
   * Renders the summary section of axis gap analysis.
   * @param {AxisGapSummary} summary - Summary data to render
   * @param {AxisGapDomElements} elements - DOM elements for rendering
   */
  renderSummary(summary, elements) {
    if (!summary) return;

    const {
      totalPrototypesAnalyzed,
      recommendationCount,
      potentialGapsDetected,
      signalBreakdown,
      confidence,
    } = summary;

    if (elements.axisGapTotalPrototypes) {
      elements.axisGapTotalPrototypes.textContent =
        totalPrototypesAnalyzed?.toString() ?? '--';
    }

    // Use recommendationCount with fallback to potentialGapsDetected for backward compat
    if (elements.axisGapRecommendations) {
      const recCount = recommendationCount ?? potentialGapsDetected;
      elements.axisGapRecommendations.textContent = recCount?.toString() ?? '--';
    }

    if (elements.axisGapConfidence) {
      elements.axisGapConfidence.textContent = confidence ?? '--';
      // Update confidence badge styling
      elements.axisGapConfidence.className = 'summary-value confidence-badge';
      if (confidence) {
        const confidenceClass = `confidence-${confidence.toLowerCase()}`;
        elements.axisGapConfidence.classList.add(confidenceClass);
      }
    }

    // Render signal breakdown if available
    this.#renderSignalBreakdown(signalBreakdown, elements);
  }

  /**
   * Updates the PCA threshold display based on analysis results.
   * @param {PcaAnalysis} pcaAnalysis - PCA analysis data
   * @param {AxisGapDomElements} elements - DOM elements for rendering
   */
  updatePcaThresholdDisplay(pcaAnalysis, elements) {
    if (!elements.signalPcaThreshold) return;

    const residualVariance = pcaAnalysis?.residualVarianceRatio ?? 0;
    const additionalComponents = pcaAnalysis?.additionalSignificantComponents ?? 0;
    const threshold = 0.15; // 15% threshold

    const highResidual = residualVariance >= threshold;
    const hasComponents = additionalComponents > 0;

    // Determine which conditions triggered (OR logic)
    if (highResidual && hasComponents) {
      elements.signalPcaThreshold.textContent = `(residual ≥${(threshold * 100).toFixed(0)}% OR components >0)`;
    } else if (highResidual) {
      elements.signalPcaThreshold.textContent = `(residual ≥${(threshold * 100).toFixed(0)}% triggered)`;
    } else if (hasComponents) {
      elements.signalPcaThreshold.textContent = '(components >0 triggered)';
    } else {
      elements.signalPcaThreshold.textContent = `(residual <${(threshold * 100).toFixed(0)}% AND no extra components)`;
    }
  }

  /**
   * Updates the coverage gap threshold display.
   * @param {AxisGapDomElements} elements - DOM elements for rendering
   */
  updateCoverageGapThresholdDisplay(elements) {
    if (!elements.signalCoverageGapsThreshold) return;

    // Adaptive thresholds are enabled by default in config
    // The actual threshold is computed dynamically based on data
    elements.signalCoverageGapsThreshold.textContent = '(adaptive threshold)';
  }

  /**
   * Renders the hub prototypes list.
   * @param {HubPrototype[]} hubPrototypes - Array of hub prototype data
   * @param {AxisGapDomElements} elements - DOM elements for rendering
   */
  renderHubPrototypes(hubPrototypes, elements) {
    if (!elements.hubList) return;

    elements.hubList.innerHTML = '';

    if (!Array.isArray(hubPrototypes) || hubPrototypes.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No hub prototypes detected.';
      elements.hubList.appendChild(emptyMsg);
      return;
    }

    hubPrototypes.forEach((hub) => {
      const li = document.createElement('li');
      const hubScore = hub.hubScore ?? hub.score ?? 0;
      const connectedClusters = hub.connectedClusters ?? 0;
      const spanningAxes = hub.spanningAxes ?? hub.axisCount ?? 0;

      // Generate contextual explanation
      const explanation = this.#generateHubExplanation(
        hubScore,
        connectedClusters,
        spanningAxes
      );

      li.innerHTML = `
        <div class="hub-item-header">
          <span class="hub-prototype-id">${this.#escapeHtml(hub.prototypeId ?? hub.id ?? 'Unknown')}</span>
          <span class="hub-score">Score: ${this.#formatMetric(hubScore)}</span>
        </div>
        <div class="hub-details">
          <span class="hub-explanation">${this.#escapeHtml(explanation)}</span>
          ${hub.explanation ? `<br><em>${this.#escapeHtml(hub.explanation)}</em>` : ''}
        </div>
      `;
      elements.hubList.appendChild(li);
    });
  }

  /**
   * Renders the coverage gaps list.
   * @param {CoverageGap[]} coverageGaps - Array of coverage gap data
   * @param {AxisGapDomElements} elements - DOM elements for rendering
   */
  renderCoverageGaps(coverageGaps, elements) {
    if (!elements.coverageGapList) return;

    elements.coverageGapList.innerHTML = '';

    if (!Array.isArray(coverageGaps) || coverageGaps.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No coverage gaps detected.';
      elements.coverageGapList.appendChild(emptyMsg);
      return;
    }

    coverageGaps.forEach((gap) => {
      const li = document.createElement('li');
      const distance = gap.distanceFromAxes ?? gap.distance ?? 0;
      const prototypeCount = gap.prototypeCount ?? 0;

      // Generate contextual explanation
      const explanation = this.#generateCoverageGapExplanation(
        distance,
        prototypeCount
      );

      li.innerHTML = `
        <div class="gap-item-header">
          <span class="gap-cluster-label">${this.#escapeHtml(gap.clusterLabel ?? gap.label ?? 'Gap')}</span>
          <span class="gap-distance">Distance: ${this.#formatMetric(distance)}</span>
        </div>
        <div class="gap-details">
          <span class="gap-explanation">${this.#escapeHtml(explanation)}</span>
          ${gap.explanation ? `<br><em>${this.#escapeHtml(gap.explanation)}</em>` : ''}
        </div>
      `;
      elements.coverageGapList.appendChild(li);
    });
  }

  /**
   * Renders the multi-axis conflicts list.
   * @param {MultiAxisConflict[]} conflicts - Array of conflict data
   * @param {AxisGapDomElements} elements - DOM elements for rendering
   */
  renderMultiAxisConflicts(conflicts, elements) {
    if (!elements.conflictList) return;

    elements.conflictList.innerHTML = '';

    if (!Array.isArray(conflicts) || conflicts.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No multi-axis conflicts detected.';
      elements.conflictList.appendChild(emptyMsg);
      return;
    }

    conflicts.forEach((conflict) => {
      const li = document.createElement('li');
      const axisCount = conflict.activeAxisCount ?? conflict.axisCount ?? conflict.conflictingAxes?.length ?? 0;
      const signBalance = conflict.signBalance ?? conflict.balance ?? null;

      // Generate contextual explanation
      const explanation = this.#generateConflictExplanation(axisCount, signBalance);

      li.innerHTML = `
        <div class="conflict-item-header">
          <span class="conflict-prototype-id">${this.#escapeHtml(conflict.prototypeId ?? conflict.id ?? 'Unknown')}</span>
          <span class="conflict-axis-count">Axes: ${axisCount}</span>
        </div>
        <div class="conflict-details">
          <span class="conflict-explanation">${this.#escapeHtml(explanation)}</span>
          ${conflict.conflictingAxes ? `<br>Conflicting: ${conflict.conflictingAxes.map((a) => this.#escapeHtml(a)).join(', ')}` : ''}
          ${conflict.explanation ? `<br><em>${this.#escapeHtml(conflict.explanation)}</em>` : ''}
        </div>
      `;
      elements.conflictList.appendChild(li);
    });
  }

  /**
   * Renders the sign tensions list (informational metadata).
   * @param {SignTension[]} signTensions - Array of sign tension data
   * @param {AxisGapDomElements} elements - DOM elements for rendering
   */
  renderSignTensions(signTensions, elements) {
    if (!elements.signTensionList) return;

    elements.signTensionList.innerHTML = '';

    if (!Array.isArray(signTensions) || signTensions.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message metadata-empty';
      emptyMsg.textContent = 'No sign tensions detected.';
      elements.signTensionList.appendChild(emptyMsg);
      return;
    }

    signTensions.forEach((tension) => {
      const li = document.createElement('li');
      li.className = 'sign-tension-item metadata-item';

      const prototypeId = tension.prototypeId ?? tension.id ?? 'Unknown';
      const activeAxisCount = tension.activeAxisCount ?? 0;
      const signBalance = tension.signBalance ?? null;
      const positiveAxes = tension.highMagnitudePositive ?? tension.positiveAxes ?? [];
      const negativeAxes = tension.highMagnitudeNegative ?? tension.negativeAxes ?? [];

      // Format sign balance display
      const balanceDisplay = signBalance !== null
        ? `${100 - Math.round(signBalance * 100)}% sign diversity`
        : 'mixed signs';

      li.innerHTML = `
        <div class="sign-tension-header">
          <span class="sign-tension-prototype-id">${this.#escapeHtml(prototypeId)}</span>
          <span class="sign-tension-badge metadata-badge">Informational</span>
        </div>
        <div class="sign-tension-details">
          <span class="sign-tension-summary">
            ${activeAxisCount} active axes, ${balanceDisplay}
          </span>
          ${positiveAxes.length > 0 ? `<div class="sign-tension-positive">+: ${positiveAxes.map((a) => this.#escapeHtml(a)).join(', ')}</div>` : ''}
          ${negativeAxes.length > 0 ? `<div class="sign-tension-negative">−: ${negativeAxes.map((a) => this.#escapeHtml(a)).join(', ')}</div>` : ''}
        </div>
      `;
      elements.signTensionList.appendChild(li);
    });
  }

  /**
   * Renders the polarity analysis list (actionable - imbalanced axes).
   * @param {PolarityAnalysis} polarityAnalysis - Polarity analysis data
   * @param {AxisGapDomElements} elements - DOM elements for rendering
   */
  renderPolarityAnalysis(polarityAnalysis, elements) {
    if (!elements.polarityAnalysisList) return;

    elements.polarityAnalysisList.innerHTML = '';

    if (!polarityAnalysis || polarityAnalysis.imbalancedCount === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No axis polarity imbalances detected.';
      elements.polarityAnalysisList.appendChild(emptyMsg);
      return;
    }

    const { imbalancedAxes, warnings } = polarityAnalysis;

    if (!Array.isArray(imbalancedAxes) || imbalancedAxes.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No axis polarity imbalances detected.';
      elements.polarityAnalysisList.appendChild(emptyMsg);
      return;
    }

    // Render summary header
    const summaryLi = document.createElement('li');
    summaryLi.className = 'polarity-summary-item';
    summaryLi.innerHTML = `
      <div class="polarity-summary-header">
        <span class="polarity-summary-count">${imbalancedAxes.length} imbalanced ${imbalancedAxes.length === 1 ? 'axis' : 'axes'} detected</span>
        <span class="polarity-summary-badge actionable-badge">Actionable</span>
      </div>
    `;
    elements.polarityAnalysisList.appendChild(summaryLi);

    // Render each imbalanced axis
    imbalancedAxes.forEach((axisInfo) => {
      const li = document.createElement('li');
      li.className = 'polarity-analysis-item';

      const axis = axisInfo.axis ?? 'Unknown';
      const direction = axisInfo.direction ?? 'unknown';
      const ratio = axisInfo.ratio ?? 0;
      const dominant = axisInfo.dominant ?? 0;
      const minority = axisInfo.minority ?? 0;

      const percentDisplay = Math.round(ratio * 100);
      const directionClass = direction === 'positive' ? 'polarity-positive' : 'polarity-negative';
      const oppositeDirection = direction === 'positive' ? 'negative' : 'positive';

      li.innerHTML = `
        <div class="polarity-item-header">
          <span class="polarity-axis-name">${this.#escapeHtml(axis)}</span>
          <span class="polarity-direction-badge ${directionClass}">${percentDisplay}% ${direction}</span>
        </div>
        <div class="polarity-item-details">
          <span class="polarity-counts">
            ${dominant} prototypes use ${direction}, only ${minority} use ${oppositeDirection}
          </span>
          <span class="polarity-action-hint">
            Consider adding prototypes with ${oppositeDirection} "${this.#escapeHtml(axis)}" values
          </span>
        </div>
      `;
      elements.polarityAnalysisList.appendChild(li);
    });

    // Render warnings if any
    if (Array.isArray(warnings) && warnings.length > 0) {
      const warningsLi = document.createElement('li');
      warningsLi.className = 'polarity-warnings-item';
      warningsLi.innerHTML = `
        <div class="polarity-warnings-header">
          <span class="polarity-warnings-title">⚠️ Warnings</span>
        </div>
        <ul class="polarity-warnings-list">
          ${warnings.map((w) => `<li>${this.#escapeHtml(w)}</li>`).join('')}
        </ul>
      `;
      elements.polarityAnalysisList.appendChild(warningsLi);
    }
  }

  // --- Private Methods ---

  /**
   * Renders the signal breakdown section.
   * @param {Object} signalBreakdown - Signal breakdown data
   * @param {AxisGapDomElements} elements - DOM elements for rendering
   */
  #renderSignalBreakdown(signalBreakdown, elements) {
    if (!signalBreakdown) return;

    const { pcaSignals, hubSignals, coverageGapSignals, multiAxisConflictSignals } =
      signalBreakdown;

    this.#updateSignalElement(elements.signalPca, pcaSignals);
    this.#updateSignalElement(elements.signalHubs, hubSignals);
    this.#updateSignalElement(elements.signalCoverageGaps, coverageGapSignals);
    this.#updateSignalElement(elements.signalMultiAxisConflicts, multiAxisConflictSignals);

    // Update PASS/FAIL status indicators
    this.#updateSignalStatus(elements.signalPcaStatus, pcaSignals);
    this.#updateSignalStatus(elements.signalHubsStatus, hubSignals);
    this.#updateSignalStatus(elements.signalCoverageGapsStatus, coverageGapSignals);
    this.#updateSignalStatus(elements.signalMultiAxisConflictsStatus, multiAxisConflictSignals);
  }

  /**
   * Updates a signal count element.
   * @param {HTMLElement} element - The element to update
   * @param {number} value - The signal count value
   */
  #updateSignalElement(element, value) {
    if (!element) return;
    const numValue = value ?? 0;
    element.textContent = numValue.toString();
    element.classList.toggle('has-signals', numValue > 0);
  }

  /**
   * Updates a signal status (PASS/FAIL) element.
   * @param {HTMLElement} statusElement - The status element to update
   * @param {number} signalCount - The signal count value
   */
  #updateSignalStatus(statusElement, signalCount) {
    if (!statusElement) return;

    const hasFailed = (signalCount ?? 0) > 0;

    statusElement.textContent = hasFailed ? '✗ FAIL' : '✓ PASS';
    statusElement.classList.remove('pass', 'fail');
    statusElement.classList.add(hasFailed ? 'fail' : 'pass');
  }

  /**
   * Generates a contextual explanation for a hub prototype.
   * @param {number} hubScore - The hub score
   * @param {number} connectedClusters - Number of connected clusters
   * @param {number} spanningAxes - Number of spanning axes
   * @returns {string} Generated explanation text
   */
  #generateHubExplanation(hubScore, connectedClusters, spanningAxes) {
    const parts = [];
    parts.push(`Hub score ${hubScore.toFixed(2)}`);

    if (connectedClusters > 0) {
      parts.push(`connects ${connectedClusters} cluster${connectedClusters !== 1 ? 's' : ''}`);
    }

    if (spanningAxes > 0) {
      parts.push(`spanning ${spanningAxes} ax${spanningAxes !== 1 ? 'es' : 'is'}`);
    }

    return parts.join(' - ');
  }

  /**
   * Generates a contextual explanation for a coverage gap.
   * @param {number} distance - Distance from nearest axis
   * @param {number} prototypeCount - Number of prototypes in gap
   * @returns {string} Generated explanation text
   */
  #generateCoverageGapExplanation(distance, prototypeCount) {
    const parts = [];
    parts.push(`Distance ${distance.toFixed(2)} from nearest axis`);

    if (prototypeCount > 0) {
      parts.push(
        `cluster of ${prototypeCount} prototype${prototypeCount !== 1 ? 's' : ''} in uncovered region`
      );
    } else {
      parts.push('uncovered region detected');
    }

    return parts.join(' - ');
  }

  /**
   * Generates a contextual explanation for a multi-axis conflict.
   * @param {number} axisCount - Number of conflicting axes
   * @param {number|null} signBalance - Sign balance ratio
   * @returns {string} Generated explanation text
   */
  #generateConflictExplanation(axisCount, signBalance) {
    const parts = [];
    parts.push(`Uses ${axisCount} ax${axisCount !== 1 ? 'es' : 'is'}`);

    if (signBalance !== null && signBalance !== undefined) {
      const sameSignPercent = Math.round(signBalance * 100);
      if (sameSignPercent > 70) {
        parts.push(`${sameSignPercent}% same-sign weighted`);
      } else if (sameSignPercent < 30) {
        parts.push(`evenly mixed signs`);
      } else {
        parts.push(`${sameSignPercent}% sign skew`);
      }
    }

    return parts.join(' with ');
  }

  /**
   * Escapes HTML special characters for safe rendering.
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  #escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Formats a numeric metric value for display.
   * @param {number} value - The value to format
   * @param {number} [decimals=3] - Number of decimal places
   * @returns {string} Formatted value string
   */
  #formatMetric(value, decimals = 3) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '--';
    }
    return value.toFixed(decimals);
  }
}

export default AxisGapRenderer;
