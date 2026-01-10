/**
 * @file Expression Diagnostics Controller - UI controller for expression diagnostics page.
 *
 * @see statusTheme.js - Single source of truth for status colors and CSS class generation
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import DiagnosticResult from '../../expressionDiagnostics/models/DiagnosticResult.js';
import {
  getStatusCircleCssClass,
  getStatusThemeEntry,
} from '../../expressionDiagnostics/statusTheme.js';
import WitnessState from '../../expressionDiagnostics/models/WitnessState.js';
import { copyToClipboard } from '../helpers/clipboardUtils.js';
import StatusSelectDropdown from './components/StatusSelectDropdown.js';

class ExpressionDiagnosticsController {
  #logger;
  #expressionRegistry;
  #gateAnalyzer;
  #boundsCalculator;
  #monteCarloSimulator;
  #failureExplainer;
  #expressionStatusService;
  #witnessStateFinder;
  #pathSensitiveAnalyzer;

  #selectedExpression = null;
  #currentResult = null;
  #expressionStatuses = [];
  #currentWitnessState = null;
  #currentPathSensitiveResult = null;

  // DOM elements
  #expressionSelectContainer;
  #statusSelectDropdown = null;
  #expressionDescription;
  #runStaticBtn;
  #statusIndicator;
  #statusMessage;
  #staticResults;
  #gateConflictsSection;
  #gateConflictsTable;
  #thresholdsSection;
  #thresholdsTable;
  // Monte Carlo DOM elements
  #sampleCountSelect;
  #distributionSelect;
  #runMcBtn;
  #mcResults;
  #mcRarityIndicator;
  #mcTriggerRate;
  #mcConfidenceInterval;
  #mcSummary;
  #blockersTbody;
  // Problematic Expressions DOM elements
  #problematicPillsContainer;
  // Witness State DOM elements
  #findWitnessBtn;
  #witnessStatus;
  #witnessResults;
  #witnessResultLabel;
  #copyWitnessBtn;
  #moodDisplay;
  #sexualDisplay;
  #witnessJsonContent;
  #violatedClauses;
  #violatedClausesList;
  #fitnessFill;
  #fitnessValue;
  // Path-Sensitive Analysis DOM elements
  #pathSensitiveSection;
  #pathSensitiveSummary;
  #psStatusIndicator;
  #psSummaryMessage;
  #branchCount;
  #reachableCount;
  #branchCardsContainer;
  #knifeEdgeSummary;
  #keCount;
  #knifeEdgeTbody;
  // Branch filter toggle
  #showAllBranchesCheckbox;
  #showAllBranches = false;

  constructor({
    logger,
    expressionRegistry,
    gateAnalyzer,
    boundsCalculator,
    monteCarloSimulator,
    failureExplainer,
    expressionStatusService,
    witnessStateFinder,
    pathSensitiveAnalyzer,
  }) {
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
    validateDependency(monteCarloSimulator, 'IMonteCarloSimulator', logger, {
      requiredMethods: ['simulate'],
    });
    validateDependency(failureExplainer, 'IFailureExplainer', logger, {
      requiredMethods: ['analyzeHierarchicalBlockers', 'generateSummary'],
    });
    validateDependency(expressionStatusService, 'IExpressionStatusService', logger, {
      requiredMethods: ['scanAllStatuses', 'updateStatus', 'getProblematicExpressions'],
    });
    validateDependency(witnessStateFinder, 'IWitnessStateFinder', logger, {
      requiredMethods: ['findWitness'],
    });
    validateDependency(pathSensitiveAnalyzer, 'IPathSensitiveAnalyzer', logger, {
      requiredMethods: ['analyze'],
    });

    this.#logger = logger;
    this.#expressionRegistry = expressionRegistry;
    this.#gateAnalyzer = gateAnalyzer;
    this.#boundsCalculator = boundsCalculator;
    this.#monteCarloSimulator = monteCarloSimulator;
    this.#failureExplainer = failureExplainer;
    this.#expressionStatusService = expressionStatusService;
    this.#witnessStateFinder = witnessStateFinder;
    this.#pathSensitiveAnalyzer = pathSensitiveAnalyzer;
  }

  async initialize() {
    this.#bindDomElements();
    this.#setupEventListeners();
    await this.#populateExpressionSelect();
    await this.#loadProblematicExpressionsPanel();
  }

  #bindDomElements() {
    this.#expressionSelectContainer = document.getElementById(
      'expression-select-container'
    );
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
    // Monte Carlo elements
    this.#sampleCountSelect = document.getElementById('sample-count');
    this.#distributionSelect = document.getElementById('distribution');
    this.#runMcBtn = document.getElementById('run-mc-btn');
    this.#mcResults = document.getElementById('mc-results');
    this.#mcRarityIndicator = document.getElementById('mc-rarity-indicator');
    this.#mcTriggerRate = document.getElementById('mc-trigger-rate');
    this.#mcConfidenceInterval = document.getElementById(
      'mc-confidence-interval'
    );
    this.#mcSummary = document.getElementById('mc-summary');
    this.#blockersTbody = document.getElementById('blockers-tbody');
    // Problematic Expressions elements
    this.#problematicPillsContainer = document.getElementById(
      'problematic-pills-container'
    );
    // Witness State elements
    this.#findWitnessBtn = document.getElementById('find-witness-btn');
    this.#witnessStatus = document.getElementById('witness-status');
    this.#witnessResults = document.getElementById('witness-results');
    this.#witnessResultLabel = document.getElementById('witness-result-label');
    this.#copyWitnessBtn = document.getElementById('copy-witness-btn');
    this.#moodDisplay = document.getElementById('mood-display');
    this.#sexualDisplay = document.getElementById('sexual-display');
    this.#witnessJsonContent = document.getElementById('witness-json-content');
    this.#violatedClauses = document.getElementById('violated-clauses');
    this.#violatedClausesList = document.getElementById('violated-clauses-list');
    this.#fitnessFill = document.getElementById('fitness-fill');
    this.#fitnessValue = document.getElementById('fitness-value');
    // Path-Sensitive Analysis elements
    this.#pathSensitiveSection = document.getElementById('path-sensitive-results');
    this.#pathSensitiveSummary = document.getElementById('path-sensitive-summary');
    this.#psStatusIndicator = document.getElementById('ps-status-indicator');
    this.#psSummaryMessage = document.getElementById('ps-summary-message');
    this.#branchCount = document.getElementById('branch-count');
    this.#reachableCount = document.getElementById('reachable-count');
    this.#branchCardsContainer = document.getElementById('branch-cards-container');
    this.#knifeEdgeSummary = document.getElementById('knife-edge-summary');
    this.#keCount = document.getElementById('ke-count');
    this.#knifeEdgeTbody = document.getElementById('knife-edge-tbody');
    // Branch filter toggle
    this.#showAllBranchesCheckbox = document.getElementById('show-all-branches');
  }

  #setupEventListeners() {
    // Note: expression selection is handled by StatusSelectDropdown's onSelectionChange callback

    this.#runStaticBtn?.addEventListener('click', async () => {
      await this.#runStaticAnalysis();
    });

    this.#runMcBtn?.addEventListener('click', async () => {
      await this.#runMonteCarloSimulation();
    });

    this.#findWitnessBtn?.addEventListener('click', async () => {
      await this.#findWitness();
    });

    this.#copyWitnessBtn?.addEventListener('click', async () => {
      await this.#copyWitnessToClipboard();
    });

    this.#showAllBranchesCheckbox?.addEventListener('change', (e) => {
      this.#showAllBranches = e.target.checked;
      this.#applyBranchFilter();
    });
  }

  async #populateExpressionSelect() {
    const expressions = this.#expressionRegistry.getAllExpressions();

    if (!this.#expressionSelectContainer) {
      this.#logger.debug(`Populated ${expressions.length} expressions`);
      return;
    }

    // Dispose existing dropdown if present
    if (this.#statusSelectDropdown) {
      this.#statusSelectDropdown.dispose();
      this.#statusSelectDropdown = null;
    }

    // Get sorted expression IDs
    const sortedIds = expressions
      .map((expr) => expr?.id)
      .filter((id) => typeof id === 'string' && id.trim() !== '')
      .sort((a, b) => a.localeCompare(b));

    // Build options with status information
    // Start with a placeholder option for "no selection"
    const options = [
      { value: '', label: '-- Select an expression --', status: null },
      ...sortedIds.map((expressionId) => ({
        value: expressionId,
        label: expressionId,
        status: this.#getStatusForExpression(expressionId),
      })),
    ];

    // Create the custom dropdown
    this.#statusSelectDropdown = new StatusSelectDropdown({
      containerElement: this.#expressionSelectContainer,
      onSelectionChange: (value) => this.#onExpressionSelected(value),
      logger: this.#logger,
      placeholder: '-- Select an expression --',
      id: 'expression-select',
    });

    this.#statusSelectDropdown.setOptions(options);

    this.#logger.debug(`Populated ${expressions.length} expressions`);
  }

  /**
   * Get the diagnostic status for an expression.
   *
   * @private
   * @param {string} expressionId - The expression ID
   * @returns {string} The diagnostic status ('unknown', 'impossible', etc.)
   */
  #getStatusForExpression(expressionId) {
    const statusEntry = this.#expressionStatuses.find(
      (e) => e.id === expressionId
    );
    return statusEntry?.diagnosticStatus || 'unknown';
  }

  /**
   * Display the saved diagnostic status for a selected expression.
   * Shows the appropriate colored circle and label based on the expression's
   * persisted diagnosticStatus field.
   *
   * @private
   * @param {string} expressionId - The expression ID
   */
  #displayExpressionStatus(expressionId) {
    const status = this.#getStatusForExpression(expressionId);
    const theme = getStatusThemeEntry(status);
    const cssCategory = status.replace(/_/g, '-');
    this.#updateStatus(cssCategory, theme.label, '');
  }

  #onExpressionSelected(expressionId) {
    if (!expressionId) {
      this.#selectedExpression = null;
      this.#expressionDescription.textContent = '';
      this.#runStaticBtn.disabled = true;
      if (this.#runMcBtn) this.#runMcBtn.disabled = true;
      if (this.#findWitnessBtn) this.#findWitnessBtn.disabled = true;
      this.#resetResults();
      return;
    }

    this.#selectedExpression =
      this.#expressionRegistry.getExpression(expressionId);

    if (this.#selectedExpression) {
      this.#expressionDescription.textContent =
        this.#selectedExpression.description || 'No description available';
      this.#runStaticBtn.disabled = false;
      if (this.#runMcBtn) this.#runMcBtn.disabled = false;
      if (this.#findWitnessBtn) this.#findWitnessBtn.disabled = false;
    } else {
      this.#expressionDescription.textContent = 'Expression not found';
      this.#runStaticBtn.disabled = true;
      if (this.#runMcBtn) this.#runMcBtn.disabled = true;
      if (this.#findWitnessBtn) this.#findWitnessBtn.disabled = true;
    }

    this.#resetResults();

    // Display the expression's saved diagnostic status (if any)
    if (this.#selectedExpression) {
      this.#displayExpressionStatus(expressionId);
    }
  }

  #resetResults() {
    this.#currentResult = null;
    this.#updateStatus('unknown', 'Unknown', '');
    this.#staticResults.innerHTML =
      '<p class="placeholder-text">Run static analysis to see results.</p>';
    this.#gateConflictsSection.hidden = true;
    this.#thresholdsSection.hidden = true;
    this.#resetMonteCarloResults();
    this.#resetWitnessResults();
    this.#resetPathSensitiveResults();
  }

  #resetWitnessResults() {
    this.#currentWitnessState = null;
    if (this.#witnessResults) this.#witnessResults.hidden = true;
    if (this.#witnessStatus) this.#witnessStatus.textContent = '';
    if (this.#witnessResultLabel) this.#witnessResultLabel.textContent = '';
    if (this.#moodDisplay) this.#moodDisplay.innerHTML = '';
    if (this.#sexualDisplay) this.#sexualDisplay.innerHTML = '';
    if (this.#witnessJsonContent) this.#witnessJsonContent.textContent = '';
    if (this.#violatedClauses) this.#violatedClauses.hidden = true;
    if (this.#violatedClausesList) this.#violatedClausesList.innerHTML = '';
    if (this.#fitnessFill) this.#fitnessFill.style.width = '0%';
    if (this.#fitnessValue) this.#fitnessValue.textContent = '--';
  }

  #resetMonteCarloResults() {
    if (this.#mcResults) this.#mcResults.hidden = true;
    if (this.#mcTriggerRate) this.#mcTriggerRate.textContent = '--';
    if (this.#mcConfidenceInterval)
      this.#mcConfidenceInterval.textContent = '(-- - --)';
    if (this.#mcSummary) this.#mcSummary.textContent = '';
    if (this.#blockersTbody) this.#blockersTbody.innerHTML = '';
  }

  async #runStaticAnalysis() {
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

      // Run path-sensitive analysis (provides per-branch details)
      await this.#runPathSensitiveAnalysis();

      // Persist the new status and refresh problematic panel
      const newStatus = this.#currentResult.rarityCategory;
      await this.#persistExpressionStatus(newStatus);
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

    const circleEl = this.#statusIndicator.querySelector('.status-circle-large');
    const labelEl = this.#statusIndicator.querySelector('.status-label');

    // Use CSS circle class instead of emoji text for consistent color rendering
    if (circleEl) {
      circleEl.className = `status-circle-large status-circle status-${category}`;
    }
    if (labelEl) labelEl.textContent = label;
    if (this.#statusMessage) this.#statusMessage.textContent = message;
  }

  async #runMonteCarloSimulation() {
    if (!this.#selectedExpression) return;

    // Disable button during simulation to prevent multiple clicks
    if (this.#runMcBtn) {
      this.#runMcBtn.disabled = true;
      this.#runMcBtn.textContent = 'Running...';
    }

    const sampleCount = parseInt(
      this.#sampleCountSelect?.value || '10000',
      10
    );
    const distribution = this.#distributionSelect?.value || 'uniform';

    this.#logger.info(
      `Running MC simulation for: ${this.#selectedExpression.id} ` +
        `(samples=${sampleCount}, dist=${distribution})`
    );

    try {
      const result = await this.#monteCarloSimulator.simulate(
        this.#selectedExpression,
        {
          sampleCount,
          distribution,
          trackClauses: true,
          onProgress: (completed, total) => {
            if (this.#runMcBtn) {
              const pct = Math.round((100 * completed) / total);
              this.#runMcBtn.textContent = `${pct}%`;
            }
          },
        }
      );

      const blockers = this.#failureExplainer.analyzeHierarchicalBlockers(
        result.clauseFailures
      );
      const summary = this.#failureExplainer.generateSummary(
        result.triggerRate,
        blockers
      );

      // Store results in DiagnosticResult model for unified status tracking
      if (!this.#currentResult) {
        // Create result if static analysis wasn't run first
        this.#currentResult = new DiagnosticResult(this.#selectedExpression.id);
      }
      this.#currentResult.setMonteCarloResults({
        triggerRate: result.triggerRate,
        sampleCount: result.sampleCount,
        distribution: result.distribution,
        confidenceInterval: result.confidenceInterval,
        clauseFailures: result.clauseFailures,
      });

      this.#displayMonteCarloResults(result, blockers, summary);

      // Update Status Summary to reflect Monte Carlo results
      this.#updateStatusFromResult();

      // Persist the new status and refresh problematic panel
      const newStatus = this.#currentResult.rarityCategory;
      await this.#persistExpressionStatus(newStatus);
    } catch (error) {
      this.#logger.error('Monte Carlo simulation failed:', error);
      this.#updateStatus('impossible', 'Simulation Error', error.message);
    } finally {
      // Re-enable button after simulation completes (success or error)
      if (this.#runMcBtn) {
        this.#runMcBtn.disabled = false;
        this.#runMcBtn.textContent = 'Run Simulation';
      }
    }
  }

  #displayMonteCarloResults(result, blockers, summary) {
    if (!this.#mcResults) return;

    this.#mcResults.hidden = false;

    // Update rarity indicator using shared classification
    const rarityCategory = DiagnosticResult.getRarityCategoryForRate(
      result.triggerRate
    );
    this.#updateMcRarityIndicator(rarityCategory);

    // Update trigger rate
    if (this.#mcTriggerRate) {
      this.#mcTriggerRate.textContent = this.#formatPercentage(
        result.triggerRate
      );
    }

    // Update confidence interval
    if (this.#mcConfidenceInterval && result.confidenceInterval) {
      this.#mcConfidenceInterval.textContent =
        `(${this.#formatPercentage(result.confidenceInterval.low)} - ` +
        `${this.#formatPercentage(result.confidenceInterval.high)})`;
    }

    // Update summary
    if (this.#mcSummary) {
      this.#mcSummary.textContent = summary;
    }

    // Update blockers table
    this.#populateBlockersTable(blockers);
  }

  #populateBlockersTable(blockers) {
    if (!this.#blockersTbody) return;

    this.#blockersTbody.innerHTML = '';

    for (const blocker of blockers) {
      // Main blocker row
      const row = document.createElement('tr');
      row.classList.add('blocker-row');
      row.dataset.blockerId = `blocker-${blocker.rank}`;

      const expandToggle = blocker.hasHierarchy
        ? `<button class="expand-toggle" aria-expanded="false" aria-label="Expand breakdown">▶</button>`
        : `<span class="no-toggle"></span>`;

      row.innerHTML = `
        <td class="toggle-cell">${expandToggle}</td>
        <td>${blocker.rank}</td>
        <td><code>${this.#escapeHtml(blocker.clauseDescription)}</code></td>
        <td>${this.#formatPercentage(blocker.failureRate)}</td>
        <td>${blocker.averageViolation.toFixed(3)}</td>
        <td><span class="severity-badge severity-${blocker.explanation.severity}">${blocker.explanation.severity}</span></td>
      `;

      // Add click handler for expand toggle
      if (blocker.hasHierarchy) {
        const toggle = row.querySelector('.expand-toggle');
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#toggleBreakdown(`blocker-${blocker.rank}`, blocker);
        });
      }

      this.#blockersTbody.appendChild(row);

      // Hidden breakdown row (initially collapsed)
      if (blocker.hasHierarchy) {
        const breakdownRow = document.createElement('tr');
        breakdownRow.classList.add('breakdown-row', 'collapsed');
        breakdownRow.dataset.parentId = `blocker-${blocker.rank}`;
        breakdownRow.innerHTML = `
          <td colspan="6" class="breakdown-cell">
            <div class="hierarchical-tree">
              ${this.#renderHierarchicalTree(blocker.hierarchicalBreakdown, 0)}
            </div>
          </td>
        `;
        this.#blockersTbody.appendChild(breakdownRow);
      }
    }

    if (blockers.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML =
        '<td colspan="6" class="no-data">No blockers identified</td>';
      this.#blockersTbody.appendChild(row);
    }
  }


  /**
   * Toggle expand/collapse of a blocker's hierarchical breakdown.
   *
   * @private
   * @param {string} blockerId - The unique ID of the blocker row to toggle
   * @param {object} _blocker - The blocker data (unused but kept for future enhancements)
   */
  #toggleBreakdown(blockerId, _blocker) {
    const blockerRow = this.#blockersTbody.querySelector(
      `[data-blocker-id="${blockerId}"]`
    );
    const breakdownRow = this.#blockersTbody.querySelector(
      `[data-parent-id="${blockerId}"]`
    );
    const toggle = blockerRow?.querySelector('.expand-toggle');

    if (!blockerRow || !breakdownRow || !toggle) return;

    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      // Collapse
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '▶';
      breakdownRow.classList.add('collapsed');
    } else {
      // Expand
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = '▼';
      breakdownRow.classList.remove('collapsed');
    }
  }

  /**
   * Render a hierarchical clause tree as nested HTML.
   *
   * @private
   * @param {object} node - Tree node (from toJSON)
   * @param {number} depth - Current depth (for indentation)
   * @returns {string} HTML string
   */
  #renderHierarchicalTree(node, depth) {
    if (!node) return '';

    const indent = depth * 1.5; // rem units
    const nodeIcon = this.#getNodeIcon(node.nodeType);
    const failureColor = this.#getFailureColor(node.failureRate);

    // Format violation for leaf nodes
    const violationDisplay =
      !node.isCompound && node.averageViolation > 0
        ? ` <span class="violation-badge">Δ${node.averageViolation.toFixed(2)}</span>`
        : '';

    // Build tree line prefix
    const isLastChild = false; // Simplified - always use ├
    const treePrefix = depth > 0 ? (isLastChild ? '└' : '├') : '';

    let html = `
      <div class="tree-node" style="padding-left: ${indent}rem">
        <span class="tree-prefix">${treePrefix}</span>
        <span class="node-icon ${node.nodeType}">${nodeIcon}</span>
        <span class="node-description">${this.#escapeHtml(node.description)}</span>
        <span class="failure-rate ${failureColor}">${this.#formatPercentage(node.failureRate)}</span>
        ${violationDisplay}
      </div>
    `;

    // Render children recursively
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        html += this.#renderHierarchicalTree(child, depth + 1);
      }
    }

    return html;
  }

  /**
   * Get icon for node type.
   *
   * @private
   * @param {string} nodeType - The node type ('and', 'or', or 'leaf')
   * @returns {string} The icon character to display
   */
  #getNodeIcon(nodeType) {
    switch (nodeType) {
      case 'and':
        return '∧';
      case 'or':
        return '∨';
      case 'leaf':
      default:
        return '●';
    }
  }

  /**
   * Get CSS class for failure rate color coding.
   *
   * @private
   * @param {number} failureRate - The failure rate from 0 to 1
   * @returns {string} The CSS class for color coding
   */
  #getFailureColor(failureRate) {
    if (failureRate >= 0.9) return 'failure-critical';
    if (failureRate >= 0.5) return 'failure-high';
    return 'failure-normal';
  }

  #updateMcRarityIndicator(category) {
    if (!this.#mcRarityIndicator) return;

    // Use STATUS_INDICATORS from DiagnosticResult as single source of truth
    const indicators = DiagnosticResult.STATUS_INDICATORS;
    const indicator = indicators[category] || indicators.unknown;

    // CSS class uses hyphens instead of underscores
    const cssCategory = category.replace(/_/g, '-');
    this.#mcRarityIndicator.className = `rarity-indicator rarity-${cssCategory}`;

    const circleEl = this.#mcRarityIndicator.querySelector('.rarity-circle');
    const labelEl = this.#mcRarityIndicator.querySelector('.rarity-label');

    // Use CSS circle class instead of emoji text for consistent color rendering
    if (circleEl) {
      circleEl.className = `rarity-circle status-circle status-${cssCategory}`;
    }
    if (labelEl) labelEl.textContent = indicator.label;
  }

  #formatPercentage(value) {
    if (value === 0) return '0%';
    if (value < 0.0001) return '<0.01%';
    if (value < 0.01) return (value * 100).toFixed(3) + '%';
    return (value * 100).toFixed(2) + '%';
  }

  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }


  /**
   * Load and display the problematic expressions panel.
   * Fetches all expression statuses from the server and renders
   * problematic ones as clickable pills.
   *
   * @private
   */
  async #loadProblematicExpressionsPanel() {
    if (!this.#problematicPillsContainer) {
      this.#logger.warn('Problematic pills container not found in DOM');
      return;
    }

    try {
      this.#problematicPillsContainer.classList.add('loading');
      const scanResult = await this.#expressionStatusService.scanAllStatuses();
      if (scanResult.success) {
        this.#expressionStatuses = scanResult.expressions || [];
      } else {
        this.#logger.warn('ExpressionStatusService: Scan failed', scanResult);
        this.#expressionStatuses = [];
      }

      // Fallback: if scan returns empty (timeout/error), use registry with unknown status
      if (this.#expressionStatuses.length === 0) {
        this.#logger.warn(
          'ExpressionStatusService: Scan returned empty, using registry fallback'
        );
        const allExpressions = this.#expressionRegistry.getAllExpressions();
        this.#expressionStatuses = allExpressions.map((expr) => ({
          id: expr.id,
          filePath: null, // Will use fallback path construction when persisting
          diagnosticStatus: 'unknown',
        }));
      }

      const problematic = this.#expressionStatusService.getProblematicExpressions(
        this.#expressionStatuses,
        10
      );

      this.#renderProblematicPills(problematic);

      // Update dropdown option statuses now that we have the data
      this.#updateDropdownStatuses();
    } catch (error) {
      this.#logger.error('Failed to load problematic expressions:', error);
      this.#problematicPillsContainer.innerHTML =
        '<p class="placeholder-text">Failed to load expression statuses.</p>';
    } finally {
      this.#problematicPillsContainer.classList.remove('loading');
    }
  }

  /**
   * Refresh problematic pills panel using the in-memory cache.
   * Used after persisting status to avoid race condition where scanAllStatuses()
   * might return stale data before the server has finished writing the file.
   *
   * @private
   */
  #refreshProblematicPillsFromCache() {
    // Note: Guard clause for missing container is unnecessary here because:
    // 1. This method is only called from #persistExpressionStatus()
    // 2. #persistExpressionStatus() requires #expressionStatuses to be populated
    // 3. #expressionStatuses is only populated if container existed during init
    // 4. If container existed during init, #problematicPillsContainer is set for controller lifetime
    // Therefore, if this method is reached, container is guaranteed to exist.
    const problematic = this.#expressionStatusService.getProblematicExpressions(
      this.#expressionStatuses,
      10
    );
    this.#renderProblematicPills(problematic);
  }

  /**
   * Render problematic expressions as clickable pill badges.
   *
   * @private
   * @param {Array<{id: string, filePath: string, diagnosticStatus: string}>} problematicExpressions
   */
  #renderProblematicPills(problematicExpressions) {
    if (!this.#problematicPillsContainer) return;

    this.#problematicPillsContainer.innerHTML = '';

    const selectableExpressions = this.#statusSelectDropdown
      ? problematicExpressions.filter((expr) =>
          this.#hasExpressionOption(expr.id)
        )
      : problematicExpressions;

    if (selectableExpressions.length === 0) {
      this.#problematicPillsContainer.innerHTML =
        '<p class="no-problems">All expressions have normal or frequent status.</p>';
      return;
    }

    for (const expr of selectableExpressions) {
      const pill = document.createElement('button');
      pill.className = 'expression-pill';
      pill.type = 'button';
      pill.setAttribute('aria-label', `Select expression ${expr.id}`);
      
      // Extract just the expression name (last segment after colon)
      const displayName = this.#getExpressionName(expr.id) || expr.id;
      
      // Status circle color class
      const statusClass = getStatusCircleCssClass(expr.diagnosticStatus, this.#logger);
      
      pill.innerHTML = `
        <span class="status-circle ${statusClass}"></span>
        <span class="pill-name" title="${expr.id}">${displayName}</span>
      `;
      
      // Click handler to select this expression in the dropdown
      pill.addEventListener('click', () => {
        this.#selectExpressionById(expr.id);
      });
      
      this.#problematicPillsContainer.appendChild(pill);
    }
  }

  #getExpressionName(expressionId) {
    if (typeof expressionId !== 'string') return '';
    const segments = expressionId.split(':');
    return segments[segments.length - 1];
  }

  /**
   * Update all dropdown option statuses from the loaded expression statuses.
   * Called after #loadProblematicExpressionsPanel() has populated #expressionStatuses.
   *
   * @private
   */
  #updateDropdownStatuses() {
    if (!this.#statusSelectDropdown || this.#expressionStatuses.length === 0) {
      return;
    }

    for (const statusEntry of this.#expressionStatuses) {
      this.#statusSelectDropdown.updateOptionStatus(
        statusEntry.id,
        statusEntry.diagnosticStatus
      );
    }

    this.#logger.debug(
      `Updated ${this.#expressionStatuses.length} dropdown option statuses`
    );
  }

  /**
   * Check if an expression exists in the dropdown.
   *
   * @private
   * @param {string} expressionId - The expression ID to check
   * @returns {boolean} True if the expression exists in the dropdown
   */
  #hasExpressionOption(expressionId) {
    if (!this.#statusSelectDropdown) return false;

    // Check by full ID first, then by name only
    const expressionName = this.#getExpressionName(expressionId);
    const currentOptions = this.#statusSelectDropdown.getOptions();

    return currentOptions.some(
      (opt) => opt.value === expressionId || opt.value === expressionName
    );
  }

  /**
   * Select an expression by ID, updating the dropdown and triggering selection.
   * Tries full namespaced ID first, then falls back to short name if needed.
   *
   * @private
   * @param {string} expressionId - The expression ID to select
   */
  #selectExpressionById(expressionId) {
    if (!this.#statusSelectDropdown) return;

    // Try full ID first (without triggering setValue's internal warning via silent check)
    const options = this.#statusSelectDropdown.getOptions();
    const hasFullId = options.some((opt) => opt.value === expressionId);

    if (hasFullId) {
      this.#statusSelectDropdown.setValue(expressionId, true);
      return;
    }

    // Fallback: try without namespace (for expressions without namespace prefix)
    const expressionName = this.#getExpressionName(expressionId);
    if (expressionName !== expressionId) {
      const hasShortName = options.some((opt) => opt.value === expressionName);
      if (hasShortName) {
        this.#statusSelectDropdown.setValue(expressionName, true);
      }
    }
    // Note: No "not found" warning needed here because:
    // 1. This method is only called from pill click handlers
    // 2. Pills are filtered by #hasExpressionOption() before rendering
    // 3. #hasExpressionOption() uses the same logic to check if expression exists
    // Therefore, any pill that renders will always have a matching dropdown option.
  }

  /**
   * Update the diagnostic status of the current expression and persist it.
   *
   * @private
   * @param {string} status - The new diagnostic status
   */
  async #persistExpressionStatus(status) {
    if (!this.#selectedExpression) return;

    // Find the file path for the selected expression
    const expressionInfo = this.#expressionStatuses.find(
      e => e.id === this.#selectedExpression.id
    );

    let filePath = expressionInfo?.filePath;

    // Fallback: construct path from expression metadata if not found in scanned statuses
    if (!filePath) {
      const sourceFile = this.#selectedExpression._sourceFile;
      const modId = this.#selectedExpression._modId;

      if (sourceFile && modId) {
        filePath = `data/mods/${modId}/expressions/${sourceFile}`;
        this.#logger.debug(`Constructed file path from metadata: ${filePath}`);
      } else {
        this.#logger.warn(
          `Cannot persist status: no file path for ${this.#selectedExpression.id}`
        );
        return;
      }
    }

    try {
      await this.#expressionStatusService.updateStatus(
        filePath,
        status
      );
      this.#logger.info(
        `Persisted status '${status}' for ${this.#selectedExpression.id}`
      );

      // Update the dropdown option's status circle
      if (this.#statusSelectDropdown) {
        this.#statusSelectDropdown.updateOptionStatus(
          this.#selectedExpression.id,
          status
        );
      }

      // Update local cache of expression statuses
      const existingEntry = this.#expressionStatuses.find(
        (e) => e.id === this.#selectedExpression.id
      );
      if (existingEntry) {
        existingEntry.diagnosticStatus = status;
      }

      // Refresh the problematic panel using local cache to avoid race condition.
      // Using the in-memory cache (already updated above) instead of re-scanning
      // from disk prevents stale data from overwriting the correct dropdown status.
      this.#refreshProblematicPillsFromCache();
    } catch (error) {
      this.#logger.error('Failed to persist expression status:', error);
    }
  }

  // ========== Witness State Methods ==========

  /**
   * Find a witness state that triggers the selected expression.
   *
   * @private
   */
  async #findWitness() {
    if (!this.#selectedExpression) return;

    this.#logger.info(
      `Finding witness state for: ${this.#selectedExpression.id}`
    );

    // Disable button and show searching status
    if (this.#findWitnessBtn) {
      this.#findWitnessBtn.disabled = true;
      this.#findWitnessBtn.textContent = 'Searching...';
    }
    if (this.#witnessStatus) {
      this.#witnessStatus.textContent = 'Searching for witness state...';
    }

    try {
      const result = await this.#witnessStateFinder.findWitness(
        this.#selectedExpression,
        {
          onProgress: (completed, total) => {
            if (this.#findWitnessBtn) {
              const pct = Math.round((completed / total) * 100);
              this.#findWitnessBtn.textContent = `Searching... ${pct}%`;
            }
          },
        }
      );

      this.#displayWitnessResult(result);
    } catch (error) {
      this.#logger.error('Witness state search failed:', error);
      if (this.#witnessStatus) {
        this.#witnessStatus.textContent = `Error: ${error.message}`;
      }
    } finally {
      // Re-enable button
      if (this.#findWitnessBtn) {
        this.#findWitnessBtn.disabled = false;
        this.#findWitnessBtn.textContent = 'Find Witness State';
      }
    }
  }

  /**
   * Display the witness search result.
   *
   * @private
   * @param {object} result - The search result from WitnessStateFinder
   */
  #displayWitnessResult(result) {
    if (!this.#witnessResults) return;

    this.#witnessResults.hidden = false;

    // Set result label based on whether witness was found
    if (this.#witnessResultLabel) {
      if (result.found) {
        this.#witnessResultLabel.textContent = '✅ Witness Found';
        this.#witnessResultLabel.className = 'result-label result-found';
      } else {
        this.#witnessResultLabel.textContent = '⚠️ Nearest Miss';
        this.#witnessResultLabel.className = 'result-label result-miss';
      }
    }

    // Clear status text since we now have results
    if (this.#witnessStatus) {
      this.#witnessStatus.textContent = '';
    }

    // Get the state to display (witness if found, nearestMiss otherwise)
    const state = result.found ? result.witness : result.nearestMiss;
    this.#currentWitnessState = state;

    // Display mood axes
    if (state) {
      this.#displayMoodAxes(state.mood);
      this.#displaySexualAxes(state.sexual);

      // Display JSON
      if (this.#witnessJsonContent) {
        this.#witnessJsonContent.textContent = state.toClipboardJSON();
      }
    }

    // Display violated clauses if not found
    if (!result.found && result.violatedClauses?.length > 0) {
      if (this.#violatedClauses) this.#violatedClauses.hidden = false;
      if (this.#violatedClausesList) {
        this.#violatedClausesList.innerHTML = '';
        for (const clause of result.violatedClauses) {
          const li = document.createElement('li');
          li.textContent = clause;
          this.#violatedClausesList.appendChild(li);
        }
      }
    } else {
      if (this.#violatedClauses) this.#violatedClauses.hidden = true;
    }

    // Display fitness
    this.#displayFitness(result.bestFitness);
  }

  /**
   * Display mood axes in the grid.
   *
   * @private
   * @param {object} mood - The mood state object
   */
  #displayMoodAxes(mood) {
    if (!this.#moodDisplay || !mood) return;

    this.#moodDisplay.innerHTML = '';

    for (const axis of WitnessState.MOOD_AXES) {
      const value = mood[axis];
      if (value === undefined) continue;

      const item = document.createElement('div');
      item.className = `axis-item ${this.#getValueClass(value, true)}`;
      item.innerHTML = `
        <span class="axis-name">${axis}</span>
        <span class="axis-value">${value.toFixed(2)}</span>
      `;
      this.#moodDisplay.appendChild(item);
    }
  }

  /**
   * Display sexual state axes in the grid.
   *
   * @private
   * @param {object} sexual - The sexual state object
   */
  #displaySexualAxes(sexual) {
    if (!this.#sexualDisplay || !sexual) return;

    this.#sexualDisplay.innerHTML = '';

    for (const axis of WitnessState.SEXUAL_AXES) {
      const value = sexual[axis];
      if (value === undefined) continue;

      const item = document.createElement('div');
      item.className = `axis-item ${this.#getValueClass(value, false)}`;
      item.innerHTML = `
        <span class="axis-name">${axis}</span>
        <span class="axis-value">${value.toFixed(2)}</span>
      `;
      this.#sexualDisplay.appendChild(item);
    }
  }

  /**
   * Get CSS class for value color coding.
   *
   * @private
   * @param {number} value - The axis value (0-1)
   * @param {boolean} isMood - Whether this is a mood axis (vs sexual)
   * @returns {string} CSS class for color coding
   */
  #getValueClass(value, isMood) {
    // For mood: low (0-0.33), mid (0.34-0.66), high (0.67-1.0)
    // For sexual: same ranges but different visual meaning
    const prefix = isMood ? 'mood' : 'sexual';
    if (value <= 0.33) return `${prefix}-low`;
    if (value <= 0.66) return `${prefix}-mid`;
    return `${prefix}-high`;
  }

  /**
   * Display fitness score with visual bar.
   *
   * @private
   * @param {number} fitness - The fitness score (0-1)
   */
  #displayFitness(fitness) {
    if (this.#fitnessFill) {
      const percentage = Math.min(100, Math.max(0, fitness * 100));
      this.#fitnessFill.style.width = `${percentage}%`;

      // Apply color class based on fitness level
      this.#fitnessFill.className = 'fitness-fill';
      if (fitness >= 1.0) {
        this.#fitnessFill.classList.add('fitness-perfect');
      } else if (fitness >= 0.8) {
        this.#fitnessFill.classList.add('fitness-high');
      } else if (fitness >= 0.5) {
        this.#fitnessFill.classList.add('fitness-medium');
      } else {
        this.#fitnessFill.classList.add('fitness-low');
      }
    }

    if (this.#fitnessValue) {
      this.#fitnessValue.textContent = fitness.toFixed(3);
    }
  }

  /**
   * Copy current witness state to clipboard.
   * Uses the centralized clipboard utility for fallback support.
   *
   * @private
   */
  async #copyWitnessToClipboard() {
    if (!this.#currentWitnessState) {
      this.#showCopyFeedback('No witness state to copy');
      return;
    }

    const json = this.#currentWitnessState.toClipboardJSON();
    const success = await copyToClipboard(json);
    this.#showCopyFeedback(success ? 'Copied to clipboard!' : 'Copy failed');
  }

  /**
   * Show temporary feedback message for copy operation.
   * Immediately displays the feedback toast with accessibility support.
   *
   * @private
   * @param {string} message - The message to display
   */
  #showCopyFeedback(message) {
    // Create toast element with accessibility attributes
    const toast = document.createElement('div');
    toast.className = 'copy-feedback show';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    // Find witness panel to position toast relative to it
    const witnessPanel = document.getElementById('witness-section');
    if (witnessPanel) {
      witnessPanel.appendChild(toast);
    } else {
      document.body.appendChild(toast);
    }

    // Remove after visible duration
    setTimeout(() => {
      toast.classList.remove('show');
      // Remove element after fade-out transition completes
      toast.addEventListener('transitionend', () => toast.remove(), {
        once: true,
      });
    }, 2000);
  }

  // ========== Path-Sensitive Analysis Methods ==========

  /**
   * Run path-sensitive analysis on the selected expression.
   *
   * @private
   */
  async #runPathSensitiveAnalysis() {
    if (!this.#selectedExpression) return;

    this.#logger.info(
      `Running path-sensitive analysis for: ${this.#selectedExpression.id}`
    );

    try {
      const result = await this.#pathSensitiveAnalyzer.analyze(
        this.#selectedExpression
      );
      this.#currentPathSensitiveResult = result;

      // Update DiagnosticResult with path-sensitive analysis
      // This can override impossibility if feasible branches exist
      if (this.#currentResult) {
        this.#currentResult.setPathSensitiveResults({
          overallStatus: result.overallStatus,
          feasibleBranchCount: result.feasibleBranchCount,
          branchCount: result.branchCount,
        });
        // Refresh status display after path-sensitive update
        this.#updateStatusFromResult();
      }

      this.#displayPathSensitiveResults(result);
    } catch (error) {
      this.#logger.error('Path-sensitive analysis failed:', error);
      this.#resetPathSensitiveResults();
    }
  }

  /**
   * Display path-sensitive analysis results.
   *
   * @private
   * @param {import('../../expressionDiagnostics/models/PathSensitiveResult.js').default} result
   */
  #displayPathSensitiveResults(result) {
    if (!this.#pathSensitiveSection) return;

    // Show the section
    this.#pathSensitiveSection.hidden = false;

    // Update summary
    if (this.#pathSensitiveSummary) {
      this.#pathSensitiveSummary.dataset.status = result.overallStatus;
    }
    if (this.#psStatusIndicator) {
      this.#psStatusIndicator.textContent = result.statusEmoji;
    }
    if (this.#psSummaryMessage) {
      this.#psSummaryMessage.textContent = result.getSummaryMessage();
    }

    // Update counts
    if (this.#branchCount) {
      this.#branchCount.textContent = result.branchCount;
    }
    if (this.#reachableCount) {
      this.#reachableCount.textContent = result.fullyReachableBranchIds.length;
    }

    // Render branch cards
    this.#renderBranchCards(result);

    // Render knife-edge summary
    this.#renderKnifeEdgeSummary(result);
  }

  /**
   * Render branch cards for path-sensitive results.
   *
   * @private
   * @param {import('../../expressionDiagnostics/models/PathSensitiveResult.js').default} result
   */
  #renderBranchCards(result) {
    if (!this.#branchCardsContainer) return;

    this.#branchCardsContainer.innerHTML = '';

    const template = document.getElementById('branch-card-template');
    if (!template) {
      this.#logger.warn('Branch card template not found');
      return;
    }

    for (const branch of result.branches) {
      const card = this.#createBranchCard(branch, result, template);
      this.#branchCardsContainer.appendChild(card);
    }

    this.#applyBranchFilter();
  }

  /**
   * Apply branch visibility filter based on toggle state.
   * Hides reachable branches unless "Show All" is enabled.
   *
   * @private
   */
  #applyBranchFilter() {
    if (!this.#branchCardsContainer) return;

    const cards = this.#branchCardsContainer.querySelectorAll('.branch-card');
    for (const card of cards) {
      if (card.dataset.status === 'reachable') {
        card.classList.toggle('filtered-hidden', !this.#showAllBranches);
      }
    }
  }

  /**
   * Create a single branch card element.
   *
   * @private
   * @param {import('../../expressionDiagnostics/models/AnalysisBranch.js').default} branch
   * @param {import('../../expressionDiagnostics/models/PathSensitiveResult.js').default} result
   * @param {HTMLTemplateElement} template
   * @returns {HTMLElement}
   */
  #createBranchCard(branch, result, template) {
    const card = template.content.cloneNode(true).querySelector('.branch-card');

    // Determine status
    let status = 'reachable';
    if (branch.isInfeasible) {
      status = 'infeasible';
    } else if (branch.knifeEdges && branch.knifeEdges.length > 0) {
      status = 'knife-edge';
    } else {
      const branchReachability = result.getReachabilityForBranch(branch.branchId);
      const allReachable = branchReachability.every((r) => r.isReachable);
      if (!allReachable) {
        status = 'unreachable';
      }
    }

    card.dataset.status = status;

    // Status icon
    const statusIcons = {
      reachable: '✅',
      'knife-edge': '⚠️',
      unreachable: '❌',
      infeasible: '🚫',
    };
    const statusIcon = card.querySelector('.branch-status-icon');
    if (statusIcon) {
      statusIcon.textContent = statusIcons[status];
    }

    // Title
    const title = card.querySelector('.branch-title');
    if (title) {
      title.textContent = branch.description || `Branch ${branch.branchId}`;
    }

    // Prototypes - show active (gates enforced) vs inactive (gates ignored) partitioning
    const prototypeList = card.querySelector('.prototype-list');
    if (prototypeList) {
      const activePrototypes = branch.activePrototypes || [];
      const inactivePrototypes = branch.inactivePrototypes || [];

      if (activePrototypes.length > 0 || inactivePrototypes.length > 0) {
        // Show partitioned view when we have direction info
        const parts = [];
        if (activePrototypes.length > 0) {
          parts.push(`Active (gates enforced): ${activePrototypes.join(', ')}`);
        }
        if (inactivePrototypes.length > 0) {
          parts.push(`Inactive (gates ignored): ${inactivePrototypes.join(', ')}`);
        }
        prototypeList.innerHTML = parts.join('<br>');
      } else {
        // Fallback to old behavior
        prototypeList.textContent =
          branch.requiredPrototypes?.join(', ') || 'none';
      }
    }

    // Threshold table (if unreachable or knife-edge)
    if (status === 'unreachable' || status === 'knife-edge') {
      const branchReachability = result.getReachabilityForBranch(branch.branchId);
      const unreachable = branchReachability.filter((r) => !r.isReachable);

      if (unreachable.length > 0) {
        const thresholdsDiv = card.querySelector('.branch-thresholds');
        if (thresholdsDiv) {
          thresholdsDiv.hidden = false;

          const tbody = card.querySelector('.threshold-tbody');
          if (tbody) {
            for (const r of unreachable) {
              const row = document.createElement('tr');
              row.innerHTML = `
                <td>${this.#escapeHtml(r.prototypeId)}</td>
                <td>${r.threshold.toFixed(2)}</td>
                <td>${r.maxPossible.toFixed(2)}</td>
                <td>${r.gap.toFixed(2)}</td>
              `;
              tbody.appendChild(row);
            }
          }
        }
      }
    }

    // Knife-edge warning
    if (branch.knifeEdges && branch.knifeEdges.length > 0) {
      const keDiv = card.querySelector('.branch-knife-edges');
      if (keDiv) {
        keDiv.hidden = false;

        const keMessage = branch.knifeEdges
          .map((ke) => {
            // Use dual-scale format if available, fall back to legacy formats
            const interval =
              typeof ke.formatDualScaleInterval === 'function'
                ? ke.formatDualScaleInterval()
                : typeof ke.formatInterval === 'function'
                  ? ke.formatInterval()
                  : `[${ke.min?.toFixed(2) || '?'}, ${ke.max?.toFixed(2) || '?'}]`;
            return `${ke.axis}: ${interval}`;
          })
          .join('; ');
        const keMessageEl = card.querySelector('.ke-message');
        if (keMessageEl) {
          keMessageEl.textContent = keMessage;
        }
      }
    }

    return card;
  }

  /**
   * Render knife-edge summary section.
   *
   * @private
   * @param {import('../../expressionDiagnostics/models/PathSensitiveResult.js').default} result
   */
  #renderKnifeEdgeSummary(result) {
    if (!this.#knifeEdgeSummary) return;

    const allKnifeEdges = result.allKnifeEdges;

    if (allKnifeEdges.length === 0) {
      this.#knifeEdgeSummary.hidden = true;
      return;
    }

    this.#knifeEdgeSummary.hidden = false;

    if (this.#keCount) {
      this.#keCount.textContent = allKnifeEdges.length;
    }

    if (this.#knifeEdgeTbody) {
      this.#knifeEdgeTbody.innerHTML = '';

      for (const ke of allKnifeEdges) {
        const row = document.createElement('tr');
        // Use dual-scale format if available, fall back to legacy formats
        const interval =
          typeof ke.formatDualScaleInterval === 'function'
            ? ke.formatDualScaleInterval()
            : typeof ke.formatInterval === 'function'
              ? ke.formatInterval()
              : `[${ke.min?.toFixed(2) || '?'}, ${ke.max?.toFixed(2) || '?'}]`;
        const width =
          typeof ke.width === 'number' ? ke.width.toFixed(3) : '?';
        const rawWidth =
          typeof ke.width === 'number' ? Math.round(ke.width * 100) : '?';
        const contributors =
          typeof ke.formatContributors === 'function'
            ? ke.formatContributors()
            : ke.contributingPrototypes?.join(', ') || '-';

        row.innerHTML = `
          <td>${this.#escapeHtml(ke.axis || '-')}</td>
          <td>${interval}</td>
          <td>${width} (raw: ${rawWidth})</td>
          <td>${this.#escapeHtml(contributors)}</td>
          <td>${this.#escapeHtml(ke.branchId || '-')}</td>
        `;
        this.#knifeEdgeTbody.appendChild(row);
      }
    }
  }

  /**
   * Reset path-sensitive results display.
   *
   * @private
   */
  #resetPathSensitiveResults() {
    this.#currentPathSensitiveResult = null;

    if (this.#pathSensitiveSection) {
      this.#pathSensitiveSection.hidden = true;
    }
    if (this.#branchCardsContainer) {
      this.#branchCardsContainer.innerHTML = '';
    }
    if (this.#knifeEdgeTbody) {
      this.#knifeEdgeTbody.innerHTML = '';
    }
    if (this.#knifeEdgeSummary) {
      this.#knifeEdgeSummary.hidden = true;
    }
  }
}

export default ExpressionDiagnosticsController;
