/**
 * @file Expression Diagnostics Controller - UI controller for expression diagnostics page.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import DiagnosticResult from '../../expressionDiagnostics/models/DiagnosticResult.js';

class ExpressionDiagnosticsController {
  #logger;
  #expressionRegistry;
  #gateAnalyzer;
  #boundsCalculator;

  #selectedExpression = null;
  #currentResult = null;

  // DOM elements
  #expressionSelect;
  #expressionDescription;
  #runStaticBtn;
  #statusIndicator;
  #statusMessage;
  #staticResults;
  #gateConflictsSection;
  #gateConflictsTable;
  #thresholdsSection;
  #thresholdsTable;

  constructor({ logger, expressionRegistry, gateAnalyzer, boundsCalculator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(expressionRegistry, 'IExpressionRegistry', logger, {
      requiredMethods: ['getAllExpressions', 'getExpression'],
    });
    validateDependency(gateAnalyzer, 'IGateConstraintAnalyzer', logger, {
      requiredMethods: ['analyze'],
    });
    validateDependency(boundsCalculator, 'IIntensityBoundsCalculator', logger, {
      requiredMethods: ['analyzeExpression'],
    });

    this.#logger = logger;
    this.#expressionRegistry = expressionRegistry;
    this.#gateAnalyzer = gateAnalyzer;
    this.#boundsCalculator = boundsCalculator;
  }

  async initialize() {
    this.#bindDomElements();
    this.#setupEventListeners();
    await this.#populateExpressionSelect();
  }

  #bindDomElements() {
    this.#expressionSelect = document.getElementById('expression-select');
    this.#expressionDescription = document.getElementById(
      'expression-description'
    );
    this.#runStaticBtn = document.getElementById('run-static-btn');
    this.#statusIndicator = document.getElementById('status-indicator');
    this.#statusMessage = document.getElementById('status-message');
    this.#staticResults = document.getElementById('static-results');
    this.#gateConflictsSection = document.getElementById(
      'gate-conflicts-section'
    );
    this.#gateConflictsTable = document.getElementById('gate-conflicts-table');
    this.#thresholdsSection = document.getElementById('thresholds-section');
    this.#thresholdsTable = document.getElementById('thresholds-table');
  }

  #setupEventListeners() {
    this.#expressionSelect?.addEventListener('change', (e) => {
      this.#onExpressionSelected(e.target.value);
    });

    this.#runStaticBtn?.addEventListener('click', () => {
      this.#runStaticAnalysis();
    });
  }

  async #populateExpressionSelect() {
    const expressions = this.#expressionRegistry.getAllExpressions();

    for (const expr of expressions) {
      const option = document.createElement('option');
      option.value = expr.id;
      option.textContent = expr.id;
      this.#expressionSelect?.appendChild(option);
    }

    this.#logger.debug(`Populated ${expressions.length} expressions`);
  }

  #onExpressionSelected(expressionId) {
    if (!expressionId) {
      this.#selectedExpression = null;
      this.#expressionDescription.textContent = '';
      this.#runStaticBtn.disabled = true;
      this.#resetResults();
      return;
    }

    this.#selectedExpression =
      this.#expressionRegistry.getExpression(expressionId);

    if (this.#selectedExpression) {
      this.#expressionDescription.textContent =
        this.#selectedExpression.description || 'No description available';
      this.#runStaticBtn.disabled = false;
    } else {
      this.#expressionDescription.textContent = 'Expression not found';
      this.#runStaticBtn.disabled = true;
    }

    this.#resetResults();
  }

  #resetResults() {
    this.#currentResult = null;
    this.#updateStatus('unknown', 'Not Analyzed', '');
    this.#staticResults.innerHTML =
      '<p class="placeholder-text">Run static analysis to see results.</p>';
    this.#gateConflictsSection.hidden = true;
    this.#thresholdsSection.hidden = true;
  }

  #runStaticAnalysis() {
    if (!this.#selectedExpression) return;

    this.#logger.info(
      `Running static analysis for: ${this.#selectedExpression.id}`
    );

    try {
      // Gate conflict analysis
      const gateResult = this.#gateAnalyzer.analyze(this.#selectedExpression);

      // Intensity bounds analysis
      const thresholdIssues = this.#boundsCalculator.analyzeExpression(
        this.#selectedExpression,
        gateResult.axisIntervals
      );

      // Build result
      this.#currentResult = new DiagnosticResult(this.#selectedExpression.id);
      this.#currentResult.setStaticAnalysis({
        gateConflicts: gateResult.conflicts,
        unreachableThresholds: thresholdIssues,
      });

      // Update UI
      this.#displayStaticResults(gateResult, thresholdIssues);
      this.#updateStatusFromResult();
    } catch (error) {
      this.#logger.error('Static analysis failed:', error);
      this.#updateStatus('impossible', 'Analysis Error', error.message);
    }
  }

  #displayStaticResults(gateResult, thresholdIssues) {
    // Gate conflicts
    if (gateResult.conflicts.length > 0) {
      this.#gateConflictsSection.hidden = false;
      this.#renderGateConflictsTable(gateResult.conflicts);
    } else {
      this.#gateConflictsSection.hidden = true;
    }

    // Unreachable thresholds
    if (thresholdIssues.length > 0) {
      this.#thresholdsSection.hidden = false;
      this.#renderThresholdsTable(thresholdIssues);
    } else {
      this.#thresholdsSection.hidden = true;
    }

    // Summary
    if (gateResult.conflicts.length === 0 && thresholdIssues.length === 0) {
      this.#staticResults.innerHTML =
        '<p class="success-text">No static issues detected. All gates compatible, all thresholds reachable.</p>';
    } else {
      this.#staticResults.innerHTML = `
        <p>Found ${gateResult.conflicts.length} gate conflict(s) and ${thresholdIssues.length} unreachable threshold(s).</p>
      `;
    }
  }

  #renderGateConflictsTable(conflicts) {
    const tbody = this.#gateConflictsTable.querySelector('tbody');
    tbody.innerHTML = '';

    for (const conflict of conflicts) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${conflict.axis}</td>
        <td>[${conflict.required.min.toFixed(2)}, ${conflict.required.max.toFixed(2)}]</td>
        <td>${conflict.prototypes.join(', ')}</td>
        <td>${conflict.gates.join('; ')}</td>
      `;
      tbody.appendChild(row);
    }
  }

  #renderThresholdsTable(thresholdIssues) {
    const tbody = this.#thresholdsTable.querySelector('tbody');
    tbody.innerHTML = '';

    for (const issue of thresholdIssues) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${issue.prototypeId}</td>
        <td>${issue.type}</td>
        <td>${issue.threshold.toFixed(2)}</td>
        <td>${issue.maxPossible.toFixed(2)}</td>
        <td>${issue.gap.toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    }
  }

  #updateStatusFromResult() {
    if (!this.#currentResult) return;

    const indicator = this.#currentResult.statusIndicator;
    const category = this.#currentResult.rarityCategory;

    this.#updateStatus(
      category.replace('_', '-'),
      indicator.label,
      this.#currentResult.impossibilityReason || ''
    );
  }

  #updateStatus(category, label, message) {
    // Remove all status classes
    this.#statusIndicator.className = 'status-indicator';
    this.#statusIndicator.classList.add(`status-${category}`);

    const emoji = this.#statusIndicator.querySelector('.status-emoji');
    const labelEl = this.#statusIndicator.querySelector('.status-label');

    const emojiMap = {
      unknown: '⚪',
      impossible: '🔴',
      'extremely-rare': '🟠',
      rare: '🟡',
      normal: '🟢',
      frequent: '🔵',
    };

    if (emoji) emoji.textContent = emojiMap[category] || '⚪';
    if (labelEl) labelEl.textContent = label;
    if (this.#statusMessage) this.#statusMessage.textContent = message;
  }
}

export default ExpressionDiagnosticsController;
