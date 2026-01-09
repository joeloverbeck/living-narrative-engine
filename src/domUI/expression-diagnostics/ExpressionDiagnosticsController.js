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
  #monteCarloSimulator;
  #failureExplainer;
  #expressionStatusService;

  #selectedExpression = null;
  #currentResult = null;
  #expressionStatuses = [];

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

  constructor({
    logger,
    expressionRegistry,
    gateAnalyzer,
    boundsCalculator,
    monteCarloSimulator,
    failureExplainer,
    expressionStatusService,
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

    this.#logger = logger;
    this.#expressionRegistry = expressionRegistry;
    this.#gateAnalyzer = gateAnalyzer;
    this.#boundsCalculator = boundsCalculator;
    this.#monteCarloSimulator = monteCarloSimulator;
    this.#failureExplainer = failureExplainer;
    this.#expressionStatusService = expressionStatusService;
  }

  async initialize() {
    this.#bindDomElements();
    this.#setupEventListeners();
    await this.#populateExpressionSelect();
    await this.#loadProblematicExpressionsPanel();
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
  }

  #setupEventListeners() {
    this.#expressionSelect?.addEventListener('change', (e) => {
      this.#onExpressionSelected(e.target.value);
    });

    this.#runStaticBtn?.addEventListener('click', async () => {
      await this.#runStaticAnalysis();
    });

    this.#runMcBtn?.addEventListener('click', async () => {
      await this.#runMonteCarloSimulation();
    });
  }

  async #populateExpressionSelect() {
    const expressions = this.#expressionRegistry.getAllExpressions();

    if (!this.#expressionSelect) {
      this.#logger.debug(`Populated ${expressions.length} expressions`);
      return;
    }

    const defaultOption = this.#expressionSelect.querySelector(
      'option[value=""]'
    );
    this.#expressionSelect.innerHTML = '';
    if (defaultOption) {
      this.#expressionSelect.appendChild(defaultOption);
    } else {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '-- Select an expression --';
      this.#expressionSelect.appendChild(placeholder);
    }

    const sortedIds = expressions
      .map((expr) => expr?.id)
      .filter((id) => typeof id === 'string' && id.trim() !== '')
      .sort((a, b) => a.localeCompare(b));

    for (const expressionId of sortedIds) {
      this.#expressionSelect.appendChild(
        this.#createExpressionOption(expressionId)
      );
    }

    this.#logger.debug(`Populated ${expressions.length} expressions`);
  }

  #onExpressionSelected(expressionId) {
    if (!expressionId) {
      this.#selectedExpression = null;
      this.#expressionDescription.textContent = '';
      this.#runStaticBtn.disabled = true;
      if (this.#runMcBtn) this.#runMcBtn.disabled = true;
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
    } else {
      this.#expressionDescription.textContent = 'Expression not found';
      this.#runStaticBtn.disabled = true;
      if (this.#runMcBtn) this.#runMcBtn.disabled = true;
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
    this.#resetMonteCarloResults();
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

    const emojiEl = this.#mcRarityIndicator.querySelector('.rarity-emoji');
    const labelEl = this.#mcRarityIndicator.querySelector('.rarity-label');

    if (emojiEl) emojiEl.textContent = indicator.emoji;
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
    } catch (error) {
      this.#logger.error('Failed to load problematic expressions:', error);
      this.#problematicPillsContainer.innerHTML =
        '<p class="placeholder-text">Failed to load expression statuses.</p>';
    } finally {
      this.#problematicPillsContainer.classList.remove('loading');
    }
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

    const selectableExpressions = this.#expressionSelect
      ? problematicExpressions.filter((expr) =>
          this.#findExpressionOption(expr.id)
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
      const statusClass = this.#getStatusCircleClass(expr.diagnosticStatus);
      
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

  #findExpressionOption(expressionId) {
    if (!this.#expressionSelect) return null;

    const expressionName = this.#getExpressionName(expressionId);
    return Array.from(this.#expressionSelect.options).find(
      (opt) => opt.value === expressionId || opt.value === expressionName
    );
  }

  /**
   * Get CSS class for status circle based on diagnostic status.
   *
   * @private
   * @param {string} status - The diagnostic status
   * @returns {string} CSS class for the status circle
   */
  #getStatusCircleClass(status) {
    const normalizedStatus = (status || 'unknown').toLowerCase().replace(/_/g, '-');
    return `status-${normalizedStatus}`;
  }

  /**
   * Select an expression by ID, updating the dropdown and triggering selection.
   *
   * @private
   * @param {string} expressionId - The expression ID to select
   */
  #selectExpressionById(expressionId) {
    if (!this.#expressionSelect) return;

    // Find and select the option
    const option = this.#findExpressionOption(expressionId);

    if (option) {
      this.#expressionSelect.value = option.value;
      // Dispatch change event so the normal event listener handles selection consistently
      this.#expressionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      this.#logger.warn(`Expression not found in dropdown: ${expressionId}`);
    }
  }

  #createExpressionOption(expressionId) {
    const option = document.createElement('option');
    option.value = expressionId;
    option.textContent = expressionId;
    return option;
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

      // Refresh the problematic panel to reflect the change
      await this.#loadProblematicExpressionsPanel();
    } catch (error) {
      this.#logger.error('Failed to persist expression status:', error);
    }
  }
}

export default ExpressionDiagnosticsController;
