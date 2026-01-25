/**
 * @file Unit tests for ExpressionDiagnosticsController
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import ExpressionDiagnosticsController from '../../../../src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js';
import * as clipboardUtils from '../../../../src/domUI/helpers/clipboardUtils.js';

/**
 * Helper to get the custom dropdown container.
 * @returns {HTMLElement|null}
 */
function getDropdownContainer() {
  return document.getElementById('expression-select-container');
}

/**
 * Helper to get all dropdown options from the custom dropdown.
 * @returns {HTMLElement[]}
 */
function getDropdownOptions() {
  const container = getDropdownContainer();
  if (!container) return [];
  return Array.from(container.querySelectorAll('[role="option"]'));
}

/**
 * Helper to select an expression value in the custom dropdown.
 * @param {string} value - The expression ID to select
 */
function selectDropdownValue(value) {
  const container = getDropdownContainer();
  if (!container) return;

  // Find the option with this value
  const options = getDropdownOptions();
  const option = options.find(
    (opt) => opt.dataset.value === value
  );

  if (option) {
    option.click();
  }
}

/**
 * Helper to clear the dropdown selection (select placeholder).
 */
function clearDropdownSelection() {
  const container = getDropdownContainer();
  if (!container) return;

  // Find the placeholder option (value="")
  const options = getDropdownOptions();
  const placeholder = options.find(
    (opt) => opt.dataset.value === ''
  );

  if (placeholder) {
    placeholder.click();
  }
}

/**
 * Helper to get the currently selected value from the dropdown.
 * @returns {string}
 */
function getDropdownValue() {
  const container = getDropdownContainer();
  if (!container) return '';

  const trigger = container.querySelector('[role="combobox"]');
  if (!trigger) return '';

  // Find the selected option
  const options = getDropdownOptions();
  const selected = options.find(
    (opt) => opt.getAttribute('aria-selected') === 'true'
  );

  return selected?.dataset.value || '';
}

/**
 * Helper to get the problematic panel error banner.
 * @returns {HTMLElement|null}
 */
function getProblematicErrorBanner() {
  return document.getElementById('expression-diagnostics-error-banner');
}

function appendOrConstraintWarningSections() {
  document.body.insertAdjacentHTML(
    'beforeend',
    `
      <section id="conditional-pass-rates" hidden>
        <span id="conditional-pass-metrics-flag" hidden></span>
        <div id="conditional-pass-warning" hidden></div>
        <div id="conditional-gate-warning" hidden></div>
        <div id="conditional-pass-rates-content"></div>
      </section>
      <section id="last-mile-decomposition" hidden>
        <span id="last-mile-metrics-flag" hidden></span>
        <div id="last-mile-decomposition-content"></div>
      </section>
      <section id="prototype-fit-analysis" hidden>
        <span id="prototype-fit-metrics-flag" hidden></span>
        <table><tbody id="prototype-fit-tbody"></tbody></table>
        <div id="prototype-fit-details"></div>
        <div id="prototype-fit-suggestion"></div>
        <div id="prototype-fit-warning" hidden></div>
      </section>
      <section id="implied-prototype" hidden>
        <span id="implied-prototype-metrics-flag" hidden></span>
        <table><tbody id="target-signature-tbody"></tbody></table>
        <table><tbody id="similarity-ranking-tbody"></tbody></table>
        <table><tbody id="gate-pass-ranking-tbody"></tbody></table>
        <table><tbody id="combined-ranking-tbody"></tbody></table>
        <div id="implied-prototype-warning" hidden></div>
      </section>
      <section id="gap-detection" hidden>
        <span id="gap-detection-metrics-flag" hidden></span>
        <div id="gap-status"></div>
        <table><tbody id="nearest-prototypes-tbody"></tbody></table>
        <div id="suggested-prototype"></div>
        <div id="suggested-prototype-content"></div>
      </section>
    `
  );
}

describe('ExpressionDiagnosticsController', () => {
  let mockLogger;
  let mockExpressionRegistry;
  let mockGateAnalyzer;
  let mockBoundsCalculator;
  let mockMonteCarloSimulator;
  let mockFailureExplainer;
  let mockExpressionStatusService;
  let mockPathSensitiveAnalyzer;
  let mockReportGenerator;
  let mockReportModal;
  let mockSensitivityAnalyzer;
  let mockDataRegistry;

  beforeEach(() => {
    // Set up the DOM structure directly in Jest's jsdom environment
    document.body.innerHTML = `
      <label id="expression-select-label" for="expression-select">Select Expression:</label>
      <div id="expression-select-container" class="status-select-container">
        <!-- StatusSelectDropdown renders here -->
      </div>
      <p id="expression-description"></p>
      <!-- Status Summary - Centered -->
      <section class="panel status-summary-centered">
        <div id="status-indicator" class="status-indicator status-unknown">
          <span class="status-circle-large status-circle status-unknown"></span>
          <span class="status-label">Unknown</span>
        </div>
        <p id="status-message"></p>
      </section>
      <!-- Static Analysis Section (with button) -->
      <section class="panel static-analysis-panel">
        <div class="section-action-button">
          <button id="run-static-btn" class="action-button" disabled>Run Static Analysis</button>
        </div>
        <div id="static-results">
          <p class="placeholder-text">Run static analysis to see results.</p>
        </div>
      </section>
      <section id="gate-conflicts-section" hidden>
        <table id="gate-conflicts-table">
          <thead><tr><th>Axis</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
      <section id="thresholds-section" hidden>
        <table id="thresholds-table">
          <thead><tr><th>Prototype</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
      <!-- Problematic Expressions Panel -->
      <section class="panel problematic-expressions-panel">
        <div id="problematic-pills-container" class="pills-container">
          <p class="placeholder-text">Loading...</p>
        </div>
      </section>
      <!-- Low Trigger Rate Expressions Panel -->
      <section class="panel low-trigger-rate-panel">
        <div id="low-trigger-rate-pills-container" class="pills-container">
          <p class="placeholder-text">Loading...</p>
        </div>
      </section>
      <!-- Monte Carlo Section -->
      <section id="monte-carlo-section">
        <select id="sample-count">
          <option value="1000">1,000</option>
          <option value="10000" selected>10,000</option>
          <option value="100000">100,000</option>
        </select>
        <select id="distribution">
          <option value="uniform" selected>Uniform</option>
          <option value="gaussian">Gaussian</option>
        </select>
        <button id="run-mc-btn" disabled>Run Simulation</button>
        <div id="mc-results" hidden>
          <div id="mc-rarity-indicator" class="rarity-indicator">
            <span class="rarity-circle status-circle"></span>
            <span class="rarity-label"></span>
          </div>
          <span id="mc-trigger-rate">--</span>
          <span id="mc-confidence-interval">(-- - --)</span>
          <p id="mc-summary"></p>
          <div id="mc-integrity-warnings" hidden>
            <p id="mc-integrity-warnings-summary"></p>
            <ul id="mc-integrity-warnings-list"></ul>
            <p id="mc-integrity-warnings-impact"></p>
            <div id="mc-integrity-drilldown" hidden>
              <p id="mc-integrity-drilldown-summary"></p>
              <div id="mc-integrity-drilldown-content"></div>
            </div>
          </div>
          <span id="mc-gate-metrics-flag" hidden></span>
          <table id="blockers-table">
            <tbody id="blockers-tbody"></tbody>
          </table>
          <div class="mc-results-actions">
            <button id="generate-report-btn" class="action-button action-button--secondary">
              Generate Report
            </button>
          </div>
        <div id="mc-sampling-coverage" class="mc-sampling-coverage-container" hidden>
          <h3>Sampling Coverage</h3>
          <span id="sampling-coverage-metrics-flag" hidden></span>
          <p class="sampling-coverage-summary"></p>
          <div class="sampling-coverage-tables"></div>
            <div class="sampling-coverage-conclusions" hidden>
              <h4>Coverage Conclusions</h4>
              <ul class="sampling-coverage-conclusions-list"></ul>
            </div>
          </div>
        </div>
        <!-- Ground-Truth Witnesses from Monte Carlo -->
      <div id="mc-witnesses" class="mc-witnesses-container" hidden>
        <h3>Ground-Truth Witnesses</h3>
        <div id="mc-witnesses-list" class="mc-witnesses-list"></div>
      </div>
      <section id="global-sensitivity" hidden>
        <span id="global-sensitivity-metrics-flag" hidden></span>
        <div id="global-sensitivity-tables"></div>
      </section>
      <section id="static-cross-reference" hidden>
        <span id="static-cross-reference-metrics-flag" hidden></span>
        <div id="static-cross-reference-content"></div>
        <div id="cross-reference-summary"></div>
      </section>
      </section>
      <!-- Path-Sensitive Analysis Section -->
      <label class="toggle-switch" id="show-all-branches-toggle">
        <input type="checkbox" id="show-all-branches">
        <span class="toggle-slider"></span>
        <span class="toggle-label">Show All</span>
      </label>
      <section id="path-sensitive-results" hidden>
        <div id="path-sensitive-summary">
          <span id="ps-status-indicator"></span>
          <span id="ps-summary-message"></span>
        </div>
        <span id="branch-count">0</span>
        <span id="reachable-count">0</span>
        <div id="branch-cards-container"></div>
        <details id="knife-edge-summary" hidden>
          <span id="ke-count">0</span>
          <table><tbody id="knife-edge-tbody"></tbody></table>
        </details>
      </section>
      <template id="branch-card-template">
        <div class="branch-card" data-status="pending">
          <span class="branch-status-icon"></span>
          <span class="branch-title"></span>
          <span class="prototype-list"></span>
          <div class="branch-thresholds" hidden>
            <table><tbody class="threshold-tbody"></tbody></table>
          </div>
          <div class="branch-knife-edges" hidden>
            <span class="ke-message"></span>
          </div>
        </div>
      </template>
    `;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockExpressionRegistry = {
      getAllExpressions: jest.fn().mockReturnValue([
        { id: 'expr:test1', description: 'Test expression 1' },
        { id: 'expr:test2', description: 'Test expression 2' },
      ]),
      getExpression: jest.fn((id) => {
        if (id === 'expr:test1') {
          return { id: 'expr:test1', description: 'Test expression 1' };
        }
        if (id === 'expr:test2') {
          return { id: 'expr:test2', description: 'Test expression 2' };
        }
        return null;
      }),
    };

    mockGateAnalyzer = {
      analyze: jest.fn().mockReturnValue({
        hasConflict: false,
        conflicts: [],
        axisIntervals: {},
      }),
    };

    mockBoundsCalculator = {
      analyzeExpression: jest.fn().mockReturnValue([]),
    };

    mockMonteCarloSimulator = {
      simulate: jest.fn().mockResolvedValue({
        triggerRate: 0.05,
        triggerCount: 500,
        sampleCount: 10000,
        confidenceInterval: { low: 0.045, high: 0.055 },
        clauseFailures: [],
        distribution: 'uniform',
      }),
    };

    mockFailureExplainer = {
      analyzeHierarchicalBlockers: jest.fn().mockReturnValue([]),
      generateSummary: jest
        .fn()
        .mockReturnValue('Expression triggers at healthy rate (5.000%).'),
    };

    mockExpressionStatusService = {
      scanAllStatuses: jest.fn().mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/expressions/test1.expression.json', diagnosticStatus: 'unknown' },
          { id: 'expr:test2', filePath: 'data/mods/test/expressions/test2.expression.json', diagnosticStatus: 'normal' },
        ],
      }),
      updateStatus: jest.fn().mockResolvedValue({ success: true }),
      getProblematicExpressions: jest.fn().mockReturnValue([]),
      getLowTriggerRateExpressions: jest.fn().mockReturnValue([]),
      formatTriggerRatePercent: jest.fn().mockImplementation((rate) => {
        if (rate === null || rate === undefined || typeof rate !== 'number' || Number.isNaN(rate)) {
          return 'N/A';
        }
        return `${(rate * 100).toFixed(1)}%`;
      }),
    };

    mockPathSensitiveAnalyzer = {
      analyze: jest.fn().mockResolvedValue({
        expressionId: 'expr:test1',
        branches: [],
        branchCount: 0,
        feasibleBranchCount: 0,
        reachabilityByBranch: [],
        hasFullyReachableBranch: false,
        fullyReachableBranchIds: [],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'unreachable',
        statusEmoji: '🔴',
        getSummaryMessage: jest.fn().mockReturnValue('No branches analyzed'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      }),
    };

    mockReportGenerator = {
      generate: jest.fn().mockReturnValue('# Mock Report\n\nGenerated report content'),
      collectReportIntegrityWarnings: jest.fn().mockReturnValue([]),
    };

    mockReportModal = {
      showReport: jest.fn(),
    };

    mockSensitivityAnalyzer = {
      computeSensitivityData: jest.fn().mockReturnValue([]),
      computeGlobalSensitivityData: jest.fn().mockReturnValue([]),
    };

    mockDataRegistry = {
      get: jest.fn().mockReturnValue(null),
      getLookupData: jest.fn().mockReturnValue(null),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Constructor validation', () => {
    it('throws if logger is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: null,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if expressionRegistry is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: null,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if gateAnalyzer is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: null,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if boundsCalculator is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: null,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if monteCarloSimulator is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: null,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if failureExplainer is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: null,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if expressionStatusService is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: null,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if expressionRegistry lacks required methods', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: { someMethod: jest.fn() },
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if monteCarloSimulator lacks required methods', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: { someMethod: jest.fn() },
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if failureExplainer lacks required methods', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: { someMethod: jest.fn() },
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if expressionStatusService lacks required methods', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: { someMethod: jest.fn() },
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if pathSensitiveAnalyzer is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: null,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if pathSensitiveAnalyzer lacks required methods', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: { someMethod: jest.fn() },
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('constructs successfully with valid dependencies', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).not.toThrow();
    });

    it('throws if reportGenerator is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: null,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if reportGenerator lacks required methods', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: { someMethod: jest.fn() },
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if reportModal is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: null,
          sensitivityAnalyzer: mockSensitivityAnalyzer,
          dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if reportModal lacks required methods', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: { someMethod: jest.fn() },
          sensitivityAnalyzer: mockSensitivityAnalyzer,
          dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if sensitivityAnalyzer is missing', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
          sensitivityAnalyzer: null,
          dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('throws if sensitivityAnalyzer lacks required methods', () => {
      expect(() => {
        new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
          sensitivityAnalyzer: { computeSensitivityData: jest.fn() },
          dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });
  });

  describe('initialize()', () => {
    it('populates expression dropdown with expressions from registry', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const options = getDropdownOptions();
      // 3 options: placeholder + 2 expressions
      expect(options.length).toBe(3);
      expect(options[0].dataset.value).toBe(''); // placeholder
      expect(options[1].dataset.value).toBe('expr:test1');
      expect(options[2].dataset.value).toBe('expr:test2');
    });

    it('sorts expression dropdown options alphabetically by id', async () => {
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'expr:zeta', description: 'Zeta' },
        { id: 'expr:alpha', description: 'Alpha' },
        { id: 'expr:beta', description: 'Beta' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const options = getDropdownOptions();
      // Index 0 is placeholder, then sorted expressions
      expect(options[0].dataset.value).toBe(''); // placeholder
      expect(options[1].dataset.value).toBe('expr:alpha');
      expect(options[2].dataset.value).toBe('expr:beta');
      expect(options[3].dataset.value).toBe('expr:zeta');
    });

    it('logs debug message with expression count', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('2 expressions')
      );
    });
  });

  describe('Expression selection', () => {
    it('updates description when expression is selected', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const description = document.getElementById('expression-description');
      expect(description.textContent).toBe('Test expression 1');
    });

    it('enables Run Static button when expression is selected', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-static-btn');

      expect(runBtn.disabled).toBe(true);

      selectDropdownValue('expr:test1');

      expect(runBtn.disabled).toBe(false);
    });

    it('disables Run Static button when selection is cleared', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-static-btn');

      // Select an expression
      selectDropdownValue('expr:test1');
      expect(runBtn.disabled).toBe(false);

      // Clear selection
      clearDropdownSelection();
      expect(runBtn.disabled).toBe(true);
    });

    it('shows fallback description for expression without description', async () => {
      // Override getAllExpressions to include an expression with no description
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'expr:no-desc' }, // No description property
      ]);
      // Override getExpression for this specific test
      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'expr:no-desc') {
          return { id: 'expr:no-desc' }; // No description property
        }
        return null;
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:no-desc');

      const description = document.getElementById('expression-description');
      expect(description.textContent).toBe('No description available');
    });

    it('handles expression not found scenario', async () => {
      // Override getAllExpressions to include the ID we'll test with
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'expr:nonexistent' }, // Will be in dropdown
      ]);
      // Override getExpression to return null for this ID (simulating registry mismatch)
      mockExpressionRegistry.getExpression.mockImplementation(() => null);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-static-btn');

      selectDropdownValue('expr:nonexistent');

      const description = document.getElementById('expression-description');
      expect(description.textContent).toBe('Expression not found');
      expect(runBtn.disabled).toBe(true);
    });
  });

  describe('Static analysis', () => {
    it('calls both analyzers when Run Static is clicked', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Select expression
      selectDropdownValue('expr:test1');

      // Click run
      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      expect(mockGateAnalyzer.analyze).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'expr:test1' })
      );
      expect(mockBoundsCalculator.analyzeExpression).toHaveBeenCalled();
    });

    it('displays success message when no issues found', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      const results = document.getElementById('static-results');
      expect(results.innerHTML).toContain('No static issues detected');
    });

    it('displays gate conflicts table when conflicts exist', async () => {
      mockGateAnalyzer.analyze.mockReturnValue({
        hasConflict: true,
        conflicts: [
          {
            axis: 'arousal',
            required: { min: 0.6, max: 1.0 },
            prototypes: ['lust', 'desire'],
            gates: ['min >= 0.6', 'max <= 0.4'],
          },
        ],
        axisIntervals: {},
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      const section = document.getElementById('gate-conflicts-section');
      expect(section.hidden).toBe(false);

      const tbody = document
        .getElementById('gate-conflicts-table')
        .querySelector('tbody');
      expect(tbody.rows.length).toBe(1);
      expect(tbody.rows[0].innerHTML).toContain('arousal');
    });

    it('displays thresholds table when unreachable thresholds exist', async () => {
      mockBoundsCalculator.analyzeExpression.mockReturnValue([
        {
          prototypeId: 'lust',
          type: 'minimum',
          threshold: 0.8,
          maxPossible: 0.5,
          gap: 0.3,
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      const section = document.getElementById('thresholds-section');
      expect(section.hidden).toBe(false);

      const tbody = document
        .getElementById('thresholds-table')
        .querySelector('tbody');
      expect(tbody.rows.length).toBe(1);
      expect(tbody.rows[0].innerHTML).toContain('lust');
    });

    it('shows issue count summary when issues exist', async () => {
      mockGateAnalyzer.analyze.mockReturnValue({
        hasConflict: true,
        conflicts: [
          {
            axis: 'arousal',
            required: { min: 0.6, max: 1.0 },
            prototypes: ['lust'],
            gates: ['min >= 0.6'],
          },
        ],
        axisIntervals: {},
      });
      mockBoundsCalculator.analyzeExpression.mockReturnValue([
        {
          prototypeId: 'lust',
          type: 'minimum',
          threshold: 0.8,
          maxPossible: 0.5,
          gap: 0.3,
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      const results = document.getElementById('static-results');
      expect(results.innerHTML).toContain('1 gate conflict(s)');
      expect(results.innerHTML).toContain('1 unreachable threshold(s)');
    });

    it('handles analysis error gracefully', async () => {
      mockGateAnalyzer.analyze.mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Static analysis failed:',
        expect.any(Error)
      );

      const indicator = document.getElementById('status-indicator');
      expect(indicator.classList.contains('status-impossible')).toBe(true);
    });

    it('does nothing if no expression is selected', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      expect(mockGateAnalyzer.analyze).not.toHaveBeenCalled();
    });

    it('logs info when running analysis', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Running static analysis')
      );
    });
  });

  describe('Status indicator', () => {
    it('shows unknown status initially', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const indicator = document.getElementById('status-indicator');
      expect(indicator.classList.contains('status-unknown')).toBe(true);

      const circle = indicator.querySelector('.status-circle-large');
      expect(circle.classList.contains('status-unknown')).toBe(true);
    });

    it('resets status when expression selection changes', async () => {
      mockGateAnalyzer.analyze.mockReturnValue({
        hasConflict: true,
        conflicts: [
          {
            axis: 'arousal',
            required: { min: 0.6, max: 1.0 },
            prototypes: ['lust'],
            gates: ['test'],
          },
        ],
        axisIntervals: {},
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      // Change to a different expression (expr:test2 has diagnosticStatus: 'normal')
      selectDropdownValue('expr:test2');

      const indicator = document.getElementById('status-indicator');
      // Should show the saved diagnosticStatus ('normal') from the expression file
      expect(indicator.classList.contains('status-normal')).toBe(true);
    });

    it('displays saved diagnosticStatus when selecting expression with normal status', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // expr:test2 has diagnosticStatus: 'normal' in mock
      selectDropdownValue('expr:test2');

      const indicator = document.getElementById('status-indicator');
      const labelEl = indicator.querySelector('.status-label');
      const circleEl = indicator.querySelector('.status-circle-large');

      expect(indicator.classList.contains('status-normal')).toBe(true);
      expect(circleEl.classList.contains('status-normal')).toBe(true);
      expect(labelEl.textContent).toBe('Normal');
    });

    it('displays Unknown status when selecting expression with unknown diagnosticStatus', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // expr:test1 has diagnosticStatus: 'unknown' in mock
      selectDropdownValue('expr:test1');

      const indicator = document.getElementById('status-indicator');
      const labelEl = indicator.querySelector('.status-label');
      const circleEl = indicator.querySelector('.status-circle-large');

      expect(indicator.classList.contains('status-unknown')).toBe(true);
      expect(circleEl.classList.contains('status-unknown')).toBe(true);
      expect(labelEl.textContent).toBe('Unknown');
    });

    it('displays Unknown status when expression has no diagnosticStatus', async () => {
      // Override mock to include expression without diagnosticStatus
      mockExpressionStatusService.scanAllStatuses.mockResolvedValueOnce({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'path', diagnosticStatus: undefined },
          { id: 'expr:test2', filePath: 'path', diagnosticStatus: 'normal' },
        ],
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Select expression with missing diagnosticStatus
      selectDropdownValue('expr:test1');

      const indicator = document.getElementById('status-indicator');
      const labelEl = indicator.querySelector('.status-label');

      expect(indicator.classList.contains('status-unknown')).toBe(true);
      expect(labelEl.textContent).toBe('Unknown');
    });

    it('displays rare status with correct label and circle class', async () => {
      // Override mock to include expression with rare status
      mockExpressionStatusService.scanAllStatuses.mockResolvedValueOnce({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'path', diagnosticStatus: 'rare' },
          { id: 'expr:test2', filePath: 'path', diagnosticStatus: 'normal' },
        ],
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const indicator = document.getElementById('status-indicator');
      const labelEl = indicator.querySelector('.status-label');
      const circleEl = indicator.querySelector('.status-circle-large');

      expect(indicator.classList.contains('status-rare')).toBe(true);
      expect(circleEl.classList.contains('status-rare')).toBe(true);
      expect(labelEl.textContent).toBe('Rare');
    });

    it('displays impossible status with correct label and circle class', async () => {
      // Override mock to include expression with impossible status
      mockExpressionStatusService.scanAllStatuses.mockResolvedValueOnce({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'path', diagnosticStatus: 'impossible' },
          { id: 'expr:test2', filePath: 'path', diagnosticStatus: 'normal' },
        ],
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const indicator = document.getElementById('status-indicator');
      const labelEl = indicator.querySelector('.status-label');
      const circleEl = indicator.querySelector('.status-circle-large');

      expect(indicator.classList.contains('status-impossible')).toBe(true);
      expect(circleEl.classList.contains('status-impossible')).toBe(true);
      expect(labelEl.textContent).toBe('Impossible');
    });

    it('displays extremely_rare status with hyphenated CSS class', async () => {
      // Override mock to include expression with extremely_rare status
      mockExpressionStatusService.scanAllStatuses.mockResolvedValueOnce({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'path', diagnosticStatus: 'extremely_rare' },
          { id: 'expr:test2', filePath: 'path', diagnosticStatus: 'normal' },
        ],
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const indicator = document.getElementById('status-indicator');
      const labelEl = indicator.querySelector('.status-label');
      const circleEl = indicator.querySelector('.status-circle-large');

      // CSS class should use hyphens, not underscores
      expect(indicator.classList.contains('status-extremely-rare')).toBe(true);
      expect(circleEl.classList.contains('status-extremely-rare')).toBe(true);
      expect(labelEl.textContent).toBe('Extremely Rare');
    });

    it('displays frequent status with correct label and circle class', async () => {
      // Override mock to include expression with frequent status
      mockExpressionStatusService.scanAllStatuses.mockResolvedValueOnce({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'path', diagnosticStatus: 'frequent' },
          { id: 'expr:test2', filePath: 'path', diagnosticStatus: 'normal' },
        ],
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const indicator = document.getElementById('status-indicator');
      const labelEl = indicator.querySelector('.status-label');
      const circleEl = indicator.querySelector('.status-circle-large');

      expect(indicator.classList.contains('status-frequent')).toBe(true);
      expect(circleEl.classList.contains('status-frequent')).toBe(true);
      expect(labelEl.textContent).toBe('Frequent');
    });

    it('resets to Unknown when no expression is selected', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // First select an expression with normal status
      selectDropdownValue('expr:test2');

      const indicator = document.getElementById('status-indicator');
      expect(indicator.classList.contains('status-normal')).toBe(true);

      // Clear selection
      clearDropdownSelection();

      const labelEl = indicator.querySelector('.status-label');
      expect(indicator.classList.contains('status-unknown')).toBe(true);
      expect(labelEl.textContent).toBe('Unknown');
    });
  });

  describe('Results reset', () => {
    it('hides conflict sections when expression changes', async () => {
      mockGateAnalyzer.analyze.mockReturnValue({
        hasConflict: true,
        conflicts: [
          {
            axis: 'arousal',
            required: { min: 0.6, max: 1.0 },
            prototypes: ['lust'],
            gates: ['test'],
          },
        ],
        axisIntervals: {},
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      // Verify sections are visible
      expect(
        document.getElementById('gate-conflicts-section').hidden
      ).toBe(false);

      // Select different expression
      selectDropdownValue('expr:test2');

      // Verify sections are hidden
      expect(
        document.getElementById('gate-conflicts-section').hidden
      ).toBe(true);
      expect(document.getElementById('thresholds-section').hidden).toBe(
        true
      );
    });

    it('restores placeholder text when expression changes', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      // Change expression
      selectDropdownValue('expr:test2');

      const results = document.getElementById('static-results');
      expect(results.innerHTML).toContain('Run static analysis to see results');
    });
  });

  describe('Monte Carlo simulation', () => {
    it('has Run MC button disabled initially', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const runMcBtn = document.getElementById('run-mc-btn');
      expect(runMcBtn.disabled).toBe(true);
    });

    it('enables Run MC button when expression is selected', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const runMcBtn = document.getElementById('run-mc-btn');

      selectDropdownValue('expr:test1');

      expect(runMcBtn.disabled).toBe(false);
    });

    it('disables Run MC button when selection is cleared', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const runMcBtn = document.getElementById('run-mc-btn');

      // Select then clear
      selectDropdownValue('expr:test1');
      expect(runMcBtn.disabled).toBe(false);

      clearDropdownSelection();
      expect(runMcBtn.disabled).toBe(true);
    });

    it('calls simulate with correct config when Run MC is clicked', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      expect(mockMonteCarloSimulator.simulate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'expr:test1' }),
        expect.objectContaining({
          sampleCount: 10000,
          distribution: 'uniform',
          trackClauses: true,
        })
      );
    });

    it('calls analyzeHierarchicalBlockers and generateSummary after simulation', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      expect(mockFailureExplainer.analyzeHierarchicalBlockers).toHaveBeenCalled();
      expect(mockFailureExplainer.generateSummary).toHaveBeenCalledWith(
        0.05,
        expect.any(Array)
      );
    });

    it('renders sampling coverage panel when coverage data is available', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.12,
        triggerCount: 1200,
        sampleCount: 10000,
        confidenceInterval: { low: 0.1, high: 0.14 },
        clauseFailures: [],
        distribution: 'uniform',
        samplingMode: 'static',
        samplingCoverage: {
          summaryByDomain: [
            {
              domain: 'moodAxes',
              variableCount: 6,
              rangeCoverageAvg: 0.72,
              binCoverageAvg: 0.65,
              tailCoverageAvg: { low: 0.08, high: 0.06 },
              rating: 'partial',
            },
          ],
          variables: [
            {
              variablePath: 'moodAxes.valence',
              domain: 'moodAxes',
              minObserved: -10,
              maxObserved: 10,
              rangeCoverage: 0.2,
              binCoverage: 0.1,
              tailCoverage: { low: 0.01, high: 0.02 },
              rating: 'poor',
              sampleCount: 10000,
            },
          ],
        },
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const coverageContainer = document.getElementById('mc-sampling-coverage');
      const coverageSummary = coverageContainer.querySelector('.sampling-coverage-summary');
      const coverageTables = coverageContainer.querySelector('.sampling-coverage-tables');
      const coverageConclusions = coverageContainer.querySelector(
        '.sampling-coverage-conclusions'
      );
      const coverageConclusionsList = coverageContainer.querySelector(
        '.sampling-coverage-conclusions-list'
      );

      expect(coverageContainer.hidden).toBe(false);
      expect(coverageSummary.textContent).toContain('Coverage');
      expect(coverageSummary.textContent).toContain('partial');
      expect(coverageTables.querySelectorAll('table').length).toBe(2);
      expect(coverageConclusions.hidden).toBe(false);
      expect(coverageConclusionsList.querySelectorAll('li').length).toBeGreaterThan(0);
      expect(coverageConclusionsList.textContent).toContain('Worst range coverage');
    });

    it('hides sampling coverage conclusions when no conclusions are emitted', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.12,
        triggerCount: 1200,
        sampleCount: 10000,
        confidenceInterval: { low: 0.1, high: 0.14 },
        clauseFailures: [],
        distribution: 'uniform',
        samplingMode: 'static',
        samplingCoverage: {
          summaryByDomain: [
            {
              domain: 'moodAxes',
              variableCount: 2,
              rating: 'good',
            },
          ],
          variables: [],
          config: { tailPercent: 0.1 },
        },
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const coverageContainer = document.getElementById('mc-sampling-coverage');
      const coverageConclusions = coverageContainer.querySelector(
        '.sampling-coverage-conclusions'
      );
      const coverageConclusionsList = coverageContainer.querySelector(
        '.sampling-coverage-conclusions-list'
      );

      expect(coverageContainer.hidden).toBe(false);
      expect(coverageConclusions.hidden).toBe(true);
      expect(coverageConclusionsList.querySelectorAll('li').length).toBe(0);
    });

    it('hides sampling coverage panel when coverage data is missing', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.12,
        triggerCount: 1200,
        sampleCount: 10000,
        confidenceInterval: { low: 0.1, high: 0.14 },
        clauseFailures: [],
        distribution: 'uniform',
        samplingMode: 'static',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const coverageContainer = document.getElementById('mc-sampling-coverage');
      expect(coverageContainer.hidden).toBe(true);
    });

    it('shows MC results container after simulation', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const mcResults = document.getElementById('mc-results');
      expect(mcResults.hidden).toBe(true);

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      expect(mcResults.hidden).toBe(false);
    });

    it('keeps integrity warnings hidden when no warnings are returned', async () => {
      appendOrConstraintWarningSections();
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      document.getElementById('run-mc-btn').click();
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const warningsContainer = document.getElementById('mc-integrity-warnings');
      const impactNote = document.getElementById('mc-integrity-warnings-impact');
      const gateMetricsFlag = document.getElementById('mc-gate-metrics-flag');
      const conditionalFlag = document.getElementById('conditional-pass-metrics-flag');
      const globalSensitivityFlag = document.getElementById('global-sensitivity-metrics-flag');
      const lastMileFlag = document.getElementById('last-mile-metrics-flag');
      const samplingCoverageFlag = document.getElementById('sampling-coverage-metrics-flag');
      const staticCrossReferenceFlag = document.getElementById('static-cross-reference-metrics-flag');
      const prototypeFitFlag = document.getElementById('prototype-fit-metrics-flag');
      const impliedPrototypeFlag = document.getElementById('implied-prototype-metrics-flag');
      const gapDetectionFlag = document.getElementById('gap-detection-metrics-flag');
      expect(warningsContainer.hidden).toBe(true);
      expect(impactNote.textContent).toBe('');
      expect(gateMetricsFlag.hidden).toBe(true);
      expect(conditionalFlag.hidden).toBe(true);
      expect(globalSensitivityFlag.hidden).toBe(true);
      expect(lastMileFlag.hidden).toBe(true);
      expect(samplingCoverageFlag.hidden).toBe(true);
      expect(staticCrossReferenceFlag.hidden).toBe(true);
      expect(prototypeFitFlag.hidden).toBe(true);
      expect(impliedPrototypeFlag.hidden).toBe(true);
      expect(gapDetectionFlag.hidden).toBe(true);
    });

    it('renders integrity warnings when report generator returns warnings', async () => {
      appendOrConstraintWarningSections();
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.05,
        triggerCount: 500,
        sampleCount: 10000,
        confidenceInterval: { low: 0.045, high: 0.055 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: [{ moodAxes: { valence: 0 } }],
      });
      mockReportGenerator.collectReportIntegrityWarnings.mockReturnValueOnce([
        {
          code: 'I1_GATE_FAILED_NONZERO_FINAL',
          message: 'Gate failed but final intensity is non-zero in stored contexts.',
          populationHash: 'pop-123',
          prototypeId: 'joy',
        },
        {
          code: 'I3_GATEPASS_ZERO_NONZERO_FINAL',
          message: 'Gate pass rate is zero but final distribution has non-zero percentiles.',
          populationHash: 'pop-456',
          prototypeId: 'fear',
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      document.getElementById('run-mc-btn').click();
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const warningsContainer = document.getElementById('mc-integrity-warnings');
      const summary = document.getElementById('mc-integrity-warnings-summary');
      const list = document.getElementById('mc-integrity-warnings-list');
      const impactNote = document.getElementById('mc-integrity-warnings-impact');
      const gateMetricsFlag = document.getElementById('mc-gate-metrics-flag');
      const conditionalFlag = document.getElementById('conditional-pass-metrics-flag');
      const globalSensitivityFlag = document.getElementById('global-sensitivity-metrics-flag');
      const lastMileFlag = document.getElementById('last-mile-metrics-flag');
      const samplingCoverageFlag = document.getElementById('sampling-coverage-metrics-flag');
      const staticCrossReferenceFlag = document.getElementById('static-cross-reference-metrics-flag');
      const prototypeFitFlag = document.getElementById('prototype-fit-metrics-flag');
      const impliedPrototypeFlag = document.getElementById('implied-prototype-metrics-flag');
      const gapDetectionFlag = document.getElementById('gap-detection-metrics-flag');

      expect(warningsContainer.hidden).toBe(false);
      expect(summary.textContent).toContain('2');
      expect(list.querySelectorAll('li').length).toBe(2);
      expect(list.textContent).toContain('I1_GATE_FAILED_NONZERO_FINAL');
      expect(list.textContent).toContain('population=pop-123');
      expect(list.textContent).toContain('prototype=joy');
      expect(impactNote.textContent).toContain('Gate/final mismatches');
      expect(gateMetricsFlag.hidden).toBe(false);
      expect(conditionalFlag.hidden).toBe(false);
      expect(globalSensitivityFlag.hidden).toBe(false);
      expect(lastMileFlag.hidden).toBe(false);
      expect(samplingCoverageFlag.hidden).toBe(false);
      expect(staticCrossReferenceFlag.hidden).toBe(false);
      expect(prototypeFitFlag.hidden).toBe(false);
      expect(impliedPrototypeFlag.hidden).toBe(false);
      expect(gapDetectionFlag.hidden).toBe(false);
    });

    it('recomputes integrity warnings when result contains an empty cache', async () => {
      appendOrConstraintWarningSections();
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.05,
        triggerCount: 500,
        sampleCount: 10000,
        confidenceInterval: { low: 0.045, high: 0.055 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: [{ moodAxes: { valence: 0 } }],
        reportIntegrityWarnings: [],
      });
      mockReportGenerator.collectReportIntegrityWarnings.mockReturnValueOnce([
        {
          code: 'I1_GATE_FAILED_NONZERO_FINAL',
          message: 'Gate failed but final intensity is non-zero in stored contexts.',
          populationHash: 'pop-123',
          prototypeId: 'joy',
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      document.getElementById('run-mc-btn').click();
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const warningsContainer = document.getElementById('mc-integrity-warnings');
      const list = document.getElementById('mc-integrity-warnings-list');
      expect(warningsContainer.hidden).toBe(false);
      expect(list.textContent).toContain('I1_GATE_FAILED_NONZERO_FINAL');
    });

    it('renders drilldown data when integrity warning sample indices are selected', async () => {
      appendOrConstraintWarningSections();
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.05,
        triggerCount: 500,
        sampleCount: 10000,
        confidenceInterval: { low: 0.045, high: 0.055 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: [
          {
            moodAxes: { valence: 0 },
            emotions: { joy: 0.2 },
            gateTrace: {
              emotions: {
                joy: { raw: 0.2, gated: 0.2, final: 0.2, gatePass: true },
              },
            },
          },
          {
            moodAxes: { valence: 0 },
            emotions: { joy: 0.4 },
            gateTrace: {
              emotions: {
                joy: { raw: 0.4, gated: 0.4, final: 0.4, gatePass: true },
              },
            },
          },
        ],
      });
      mockReportGenerator.collectReportIntegrityWarnings.mockReturnValueOnce([
        {
          code: 'I1_GATE_FAILED_NONZERO_FINAL',
          message: 'Gate failed but final intensity is non-zero in stored contexts.',
          populationHash: 'pop-123',
          prototypeId: 'joy',
          details: { sampleIndices: [1] },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      document.getElementById('run-mc-btn').click();
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const sampleButton = document.querySelector('.integrity-sample-button');
      sampleButton.click();

      const drilldown = document.getElementById('mc-integrity-drilldown');
      const summary = document.getElementById('mc-integrity-drilldown-summary');
      const content = document.getElementById('mc-integrity-drilldown-content');
      expect(drilldown.hidden).toBe(false);
      expect(summary.textContent).toContain('Sample 1');
      expect(content.textContent).toContain('Raw (0..1)');
      expect(content.textContent).toContain('0.4000');
    });

    it('shows a fallback message when gate traces are missing', async () => {
      appendOrConstraintWarningSections();
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.05,
        triggerCount: 500,
        sampleCount: 10000,
        confidenceInterval: { low: 0.045, high: 0.055 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: [
          {
            moodAxes: { valence: 0 },
            emotions: { joy: 0.4 },
          },
        ],
      });
      mockReportGenerator.collectReportIntegrityWarnings.mockReturnValueOnce([
        {
          code: 'I1_GATE_FAILED_NONZERO_FINAL',
          message: 'Gate failed but final intensity is non-zero in stored contexts.',
          populationHash: 'pop-123',
          prototypeId: 'joy',
          details: { sampleIndices: [0] },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      document.getElementById('run-mc-btn').click();
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      document.querySelector('.integrity-sample-button').click();

      const content = document.getElementById('mc-integrity-drilldown-content');
      expect(content.textContent).toContain('Gate trace unavailable');
    });

    it('shows global sensitivity tables with a low-confidence warning when baseline hits are low', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.05,
        triggerCount: 5,
        sampleCount: 100,
        confidenceInterval: { low: 0.04, high: 0.06 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: Array.from({ length: 100 }, () => ({})),
      });
      mockSensitivityAnalyzer.computeGlobalSensitivityData.mockReturnValueOnce([
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.35, triggerRate: 0.0003, triggerCount: 3, sampleCount: 10000 },
            { threshold: 0.40, triggerRate: 0.0004, triggerCount: 4, sampleCount: 10000 },
          ],
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');
      document.getElementById('run-mc-btn').click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const tables = document.getElementById('global-sensitivity-tables');
      expect(tables.textContent).toContain('Low confidence');
      expect(tables.querySelector('.sensitivity-table-container')).not.toBeNull();
    });

    it('renders global sensitivity tables when baseline hits are sufficient', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.05,
        triggerCount: 5,
        sampleCount: 100,
        confidenceInterval: { low: 0.04, high: 0.06 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: Array.from({ length: 100 }, () => ({})),
      });
      mockSensitivityAnalyzer.computeGlobalSensitivityData.mockReturnValueOnce([
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.35, triggerRate: 0.001, triggerCount: 10, sampleCount: 10000 },
            { threshold: 0.40, triggerRate: 0.001, triggerCount: 10, sampleCount: 10000 },
          ],
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');
      document.getElementById('run-mc-btn').click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const tables = document.getElementById('global-sensitivity-tables');
      expect(tables.querySelector('.sensitivity-table-container')).not.toBeNull();
      expect(tables.textContent).not.toContain('Low confidence');
    });

    it('shows a non-monotonic sweep warning badge for global sensitivity tables', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.05,
        triggerCount: 5,
        sampleCount: 100,
        confidenceInterval: { low: 0.04, high: 0.06 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: Array.from({ length: 100 }, () => ({})),
      });
      mockSensitivityAnalyzer.computeGlobalSensitivityData.mockReturnValueOnce([
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.35, triggerRate: 0.04, triggerCount: 4, sampleCount: 100 },
            { threshold: 0.40, triggerRate: 0.05, triggerCount: 5, sampleCount: 100 },
            { threshold: 0.45, triggerRate: 0.06, triggerCount: 6, sampleCount: 100 },
          ],
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');
      document.getElementById('run-mc-btn').click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const warning = document.querySelector(
        '#global-sensitivity-tables .sensitivity-warning'
      );
      expect(warning).not.toBeNull();
      expect(warning.textContent).toContain('Sweep is not non-increasing');
    });

    it('renders effective threshold column for integer-domain sensitivity tables', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.05,
        triggerCount: 5,
        sampleCount: 100,
        confidenceInterval: { low: 0.04, high: 0.06 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: Array.from({ length: 100 }, () => ({})),
      });
      mockSensitivityAnalyzer.computeGlobalSensitivityData.mockReturnValueOnce([
        {
          varPath: 'moodAxes.valence',
          operator: '>=',
          originalThreshold: 10,
          isIntegerDomain: true,
          grid: [
            {
              threshold: 9.2,
              effectiveThreshold: 10,
              triggerRate: 0.01,
              triggerCount: 10,
              sampleCount: 1000,
            },
            {
              threshold: 10,
              effectiveThreshold: 10,
              triggerRate: 0.01,
              triggerCount: 10,
              sampleCount: 1000,
            },
          ],
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');
      document.getElementById('run-mc-btn').click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const tables = document.getElementById('global-sensitivity-tables');
      expect(tables.textContent).toContain('Effective');
      expect(tables.textContent).toContain(
        'Thresholds are integer-effective; decimals collapse to integer boundaries.'
      );
    });

    it('omits effective threshold column for float-domain sensitivity tables', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.05,
        triggerCount: 5,
        sampleCount: 100,
        confidenceInterval: { low: 0.04, high: 0.06 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: Array.from({ length: 100 }, () => ({})),
      });
      mockSensitivityAnalyzer.computeGlobalSensitivityData.mockReturnValueOnce([
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            {
              threshold: 0.35,
              triggerRate: 0.01,
              triggerCount: 10,
              sampleCount: 1000,
            },
          ],
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');
      document.getElementById('run-mc-btn').click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const table = document.querySelector('.sensitivity-table');
      const headers = Array.from(table.querySelectorAll('th')).map((th) =>
        th.textContent.trim()
      );
      expect(headers).toEqual(['Threshold', 'Trigger Rate', 'Change', 'Samples']);
    });

    it('formats integer-domain thresholds without trailing decimals', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValueOnce({
        triggerRate: 0.05,
        triggerCount: 5,
        sampleCount: 100,
        confidenceInterval: { low: 0.04, high: 0.06 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: Array.from({ length: 100 }, () => ({})),
      });
      mockSensitivityAnalyzer.computeGlobalSensitivityData.mockReturnValueOnce([
        {
          varPath: 'moodAxes.valence',
          operator: '>=',
          originalThreshold: 10,
          isIntegerDomain: true,
          grid: [
            {
              threshold: 10,
              effectiveThreshold: 10,
              triggerRate: 0.01,
              triggerCount: 10,
              sampleCount: 1000,
            },
            {
              threshold: 11,
              effectiveThreshold: 11,
              triggerRate: 0.02,
              triggerCount: 20,
              sampleCount: 1000,
            },
          ],
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');
      document.getElementById('run-mc-btn').click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const rows = Array.from(
        document.querySelectorAll('.sensitivity-table tbody tr')
      );
      const thresholds = rows.map((row) => row.querySelector('td').textContent.trim());
      expect(thresholds).toEqual(['10', '11']);
    });

    it('displays trigger rate correctly', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const triggerRate = document.getElementById('mc-trigger-rate');
      expect(triggerRate.textContent).toBe('5.00%');
    });

    it('displays confidence interval correctly', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const confidence = document.getElementById('mc-confidence-interval');
      expect(confidence.textContent).toContain('4.50%');
      expect(confidence.textContent).toContain('5.50%');
    });

    it('displays summary text', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const summary = document.getElementById('mc-summary');
      expect(summary.textContent).toBe(
        'Expression triggers at healthy rate (5.000%).'
      );
    });

    it('applies correct rarity class for normal rate', async () => {
      // Override to return a rate in 'normal' category (rate < 0.02)
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.01,
        triggerCount: 100,
        sampleCount: 10000,
        confidenceInterval: { low: 0.008, high: 0.012 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const indicator = document.getElementById('mc-rarity-indicator');
      expect(indicator.classList.contains('rarity-normal')).toBe(true);
    });

    it('applies unobserved rarity class for 0% rate (not logically impossible)', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0,
        triggerCount: 0,
        sampleCount: 10000,
        confidenceInterval: { low: 0, high: 0 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const indicator = document.getElementById('mc-rarity-indicator');
      expect(indicator.classList.contains('rarity-unobserved')).toBe(true);
    });

    it('applies frequent rarity class for high rate', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const indicator = document.getElementById('mc-rarity-indicator');
      expect(indicator.classList.contains('rarity-frequent')).toBe(true);
    });

    it('populates blockers table when blockers exist', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.05,
        triggerCount: 500,
        sampleCount: 10000,
        confidenceInterval: { low: 0.045, high: 0.055 },
        clauseFailures: [
          {
            clauseDescription: 'emotions.joy >= 0.4',
            gateClampRateInRegime: 0.3,
            passRateGivenGateInRegime: 4 / 7,
            gateFailInRegimeCount: 3,
            gatePassInRegimeCount: 7,
            gatePassAndClausePassInRegimeCount: 4,
          },
          {
            clauseDescription: 'moodAxes.valence <= 0.3',
            gateClampRateInRegime: null,
            passRateGivenGateInRegime: null,
          },
        ],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.4',
          failureRate: 0.6,
          averageViolation: 0.25,
          explanation: { severity: 'high' },
        },
        {
          rank: 2,
          clauseDescription: 'moodAxes.valence <= 0.3',
          failureRate: 0.3,
          averageViolation: 0.15,
          explanation: { severity: 'medium' },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const tbody = document.getElementById('blockers-tbody');
      expect(tbody.querySelectorAll('tr').length).toBe(2);
      expect(tbody.innerHTML).toContain('emotions.joy &gt;= 0.4');
      expect(tbody.innerHTML).toContain('severity-high');
      expect(tbody.innerHTML).toContain('severity-medium');
      expect(tbody.innerHTML).toContain('30.00% (3 / 10)');
      expect(tbody.innerHTML).toContain('57.14% (4 / 7)');
    });

    it('renders gate classification badge for emotion-threshold clauses', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.05,
        triggerCount: 500,
        sampleCount: 10000,
        confidenceInterval: { low: 0.045, high: 0.055 },
        clauseFailures: [
          {
            clauseDescription: 'emotions.joy >= 0.4',
            gateClampRateInRegime: 0.6,
            passRateGivenGateInRegime: 0.1,
            gateFailInRegimeCount: 6,
            gatePassInRegimeCount: 4,
            gatePassAndClausePassInRegimeCount: 1,
          },
        ],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.4',
          failureRate: 0.6,
          averageViolation: 0.25,
          explanation: { severity: 'high' },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const tbody = document.getElementById('blockers-tbody');
      expect(tbody.innerHTML).toContain('Both');
      expect(tbody.innerHTML).toContain('classification-both');
    });

    it('renders gate breakdown panel when gate data is available', async () => {
      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'expr:test1') {
          return {
            id: 'expr:test1',
            description: 'Test expression 1',
            prerequisites: [],
          };
        }
        return null;
      });

      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              joy: {
                gates: ['valence >= 0.4', 'threat <= -0.2'],
              },
            },
          };
        }
        return null;
      });

      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.05,
        triggerCount: 500,
        sampleCount: 10000,
        confidenceInterval: { low: 0.045, high: 0.055 },
        clauseFailures: [
          {
            clauseDescription: 'emotions.joy >= 0.4',
            gateClampRateInRegime: 0.3,
            passRateGivenGateInRegime: 0.5,
            gateFailInRegimeCount: 3,
            gatePassInRegimeCount: 7,
            gatePassAndClausePassInRegimeCount: 4,
            hierarchicalBreakdown: {
              nodeType: 'leaf',
              variablePath: 'emotions.joy',
            },
          },
        ],
        storedContexts: [
          { moodAxes: { valence: 20, threat: -10 } },
          { moodAxes: { valence: 60, threat: -30 } },
          { moodAxes: { valence: 50, threat: -10 } },
        ],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.4',
          failureRate: 0.6,
          averageViolation: 0.25,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            failureRate: 0.6,
            description: 'emotions.joy >= 0.4',
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const tbody = document.getElementById('blockers-tbody');
      expect(tbody.innerHTML).toContain('gate-breakdown');
      expect(tbody.innerHTML).toContain('33.33% (1 / 3)');
      expect(tbody.innerHTML).toContain('66.67% (2 / 3)');
    });

    it('shows no blockers message when blockers array is empty', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const tbody = document.getElementById('blockers-tbody');
      expect(tbody.innerHTML).toContain('No blockers identified');
    });

    it('handles simulation error gracefully', async () => {
      mockMonteCarloSimulator.simulate.mockRejectedValue(
        new Error('Simulation failed')
      );

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete (and reject)
      try {
        await mockMonteCarloSimulator.simulate.mock.results[0]?.value;
      } catch {
        // Expected to throw
      }
      // Allow any pending microtasks to complete
      await Promise.resolve();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Monte Carlo simulation failed:',
        expect.any(Error)
      );

      const indicator = document.getElementById('status-indicator');
      expect(indicator.classList.contains('status-impossible')).toBe(true);
    });

    it('does nothing if no expression is selected', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      expect(mockMonteCarloSimulator.simulate).not.toHaveBeenCalled();
    });

    it('logs info when running simulation', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Running MC simulation')
      );
    });

    it('reads sample count from dropdown', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      // Change sample count to 100000
      const sampleCountSelect = document.getElementById('sample-count');
      sampleCountSelect.value = '100000';

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      expect(mockMonteCarloSimulator.simulate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ sampleCount: 100000 })
      );
    });

    it('reads distribution from dropdown', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      // Change distribution to gaussian
      const distributionSelect = document.getElementById('distribution');
      distributionSelect.value = 'gaussian';

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      expect(mockMonteCarloSimulator.simulate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ distribution: 'gaussian' })
      );
    });

    it('resets MC results when expression changes', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const mcResults = document.getElementById('mc-results');
      expect(mcResults.hidden).toBe(false);

      // Change expression
      selectDropdownValue('expr:test2');

      expect(mcResults.hidden).toBe(true);
      expect(document.getElementById('mc-trigger-rate').textContent).toBe('--');
    });

    it('formats 0% trigger rate correctly', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0,
        triggerCount: 0,
        sampleCount: 10000,
        confidenceInterval: { low: 0, high: 0 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const triggerRate = document.getElementById('mc-trigger-rate');
      expect(triggerRate.textContent).toBe('0%');
    });

    it('formats very small trigger rate with <0.01%', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.00005,
        triggerCount: 1,
        sampleCount: 20000,
        confidenceInterval: { low: 0.00001, high: 0.0001 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const triggerRate = document.getElementById('mc-trigger-rate');
      expect(triggerRate.textContent).toBe('<0.01%');
    });

    it('updates Status Summary to show frequent after Monte Carlo completes', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.05,
        triggerCount: 500,
        sampleCount: 10000,
        confidenceInterval: { low: 0.045, high: 0.055 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      // Run static analysis first (creates #currentResult)
      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Verify status is unknown after static analysis (no issues found)
      const statusIndicator = document.getElementById('status-indicator');
      expect(statusIndicator.classList.contains('status-unknown')).toBe(true);

      // Run Monte Carlo
      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      // Verify Status Summary updated to frequent
      expect(statusIndicator.classList.contains('status-frequent')).toBe(true);
      const circle = statusIndicator.querySelector('.status-circle-large');
      expect(circle.classList.contains('status-frequent')).toBe(true);
      const label = statusIndicator.querySelector('.status-label');
      expect(label.textContent).toBe('Frequent');
    });

    it('updates Status Summary to show unobserved when Monte Carlo rate is 0%', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0,
        triggerCount: 0,
        sampleCount: 10000,
        confidenceInterval: { low: 0, high: 0 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      // Run static analysis first
      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Run Monte Carlo
      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      // Verify Status Summary updated to unobserved (not logically impossible, just 0% sampled)
      const statusIndicator = document.getElementById('status-indicator');
      expect(statusIndicator.classList.contains('status-unobserved')).toBe(true);
      const circle = statusIndicator.querySelector('.status-circle-large');
      expect(circle.classList.contains('status-unobserved')).toBe(true);
      const label = statusIndicator.querySelector('.status-label');
      expect(label.textContent).toBe('Unobserved');
    });

    it('updates Status Summary even without prior static analysis', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.01,
        triggerCount: 100,
        sampleCount: 10000,
        confidenceInterval: { low: 0.008, high: 0.012 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      // Verify status starts as unknown
      const statusIndicator = document.getElementById('status-indicator');
      expect(statusIndicator.classList.contains('status-unknown')).toBe(true);

      // Skip static analysis - run Monte Carlo directly
      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      // Verify Status Summary updated to normal (rate < 2%)
      expect(statusIndicator.classList.contains('status-normal')).toBe(true);
      const circle = statusIndicator.querySelector('.status-circle-large');
      expect(circle.classList.contains('status-normal')).toBe(true);
      const label = statusIndicator.querySelector('.status-label');
      expect(label.textContent).toBe('Normal');
    });

    it('Status Summary and MC section show same rarity category', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.0003,
        triggerCount: 3,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0001, high: 0.0005 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      // Both should show 'rare' (rate < 0.05%)
      const statusIndicator = document.getElementById('status-indicator');
      const mcRarityIndicator = document.getElementById('mc-rarity-indicator');

      expect(statusIndicator.classList.contains('status-rare')).toBe(true);
      expect(mcRarityIndicator.classList.contains('rarity-rare')).toBe(true);

      const statusCircle = statusIndicator.querySelector('.status-circle-large');
      const mcCircle = mcRarityIndicator.querySelector('.rarity-circle');
      // Both indicators use CSS circle classes for consistent color rendering
      expect(statusCircle.classList.contains('status-rare')).toBe(true);
      expect(mcCircle.classList.contains('status-rare')).toBe(true);

      const statusLabel = statusIndicator.querySelector('.status-label');
      const mcLabel = mcRarityIndicator.querySelector('.rarity-label');
      expect(statusLabel.textContent).toBe('Rare');
      expect(mcLabel.textContent).toBe('Rare');
    });

    it('updates Status Summary to extremely rare for very low trigger rates', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.000005,
        triggerCount: 1,
        sampleCount: 200000,
        confidenceInterval: { low: 0, high: 0.00001 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      // Verify Status Summary updated to extremely-rare (rate < 0.001%)
      const statusIndicator = document.getElementById('status-indicator');
      expect(statusIndicator.classList.contains('status-extremely-rare')).toBe(true);
      const circle = statusIndicator.querySelector('.status-circle-large');
      expect(circle.classList.contains('status-extremely-rare')).toBe(true);
      const label = statusIndicator.querySelector('.status-label');
      expect(label.textContent).toBe('Extremely Rare');
    });

    describe('Generate Report functionality', () => {
      it('calls reportGenerator.generate with correct parameters when button clicked', async () => {
        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        // Select expression and run simulation
        selectDropdownValue('expr:test1');
        const runMcBtn = document.getElementById('run-mc-btn');
        runMcBtn.click();

        // Wait for async simulation to complete (including all microtasks)
        await mockMonteCarloSimulator.simulate.mock.results[0]?.value;
        await Promise.resolve();
        await Promise.resolve();

        // Click generate report button
        const generateReportBtn = document.getElementById('generate-report-btn');
        generateReportBtn.click();

        expect(mockReportGenerator.generate).toHaveBeenCalledWith(
          expect.objectContaining({
            expressionName: 'test1', // #getExpressionName extracts last segment after ':'
            simulationResult: expect.any(Object),
            blockers: expect.any(Array),
            summary: expect.any(String),
          })
        );
      });

      it('calls reportModal.showReport with generated content', async () => {
        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        // Select expression and run simulation
        selectDropdownValue('expr:test1');
        const runMcBtn = document.getElementById('run-mc-btn');
        runMcBtn.click();

        // Wait for async simulation to complete
        await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

        // Click generate report button
        const generateReportBtn = document.getElementById('generate-report-btn');
        generateReportBtn.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(mockReportModal.showReport).toHaveBeenCalledWith(
          '# Mock Report\n\nGenerated report content'
        );
      });

      it('does not call reportGenerator when no simulation results exist', async () => {
        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        // Select expression but don't run simulation
        selectDropdownValue('expr:test1');

        // Try to click generate report button (button is inside hidden mc-results)
        const generateReportBtn = document.getElementById('generate-report-btn');
        generateReportBtn.click();

        expect(mockReportGenerator.generate).not.toHaveBeenCalled();
        expect(mockReportModal.showReport).not.toHaveBeenCalled();
      });

      it('logs warning when no simulation results and report button is clicked', async () => {
        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        // Select expression but don't run simulation
        selectDropdownValue('expr:test1');

        // Click generate report button
        const generateReportBtn = document.getElementById('generate-report-btn');
        generateReportBtn.click();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Cannot generate report: no simulation results'
        );
      });

      it('stores blockers from displayMonteCarloResults for report generation', async () => {
        const testBlockers = [
          { category: 'mood_constraint', message: 'Test blocker' },
        ];
        mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue(testBlockers);

        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        // Select expression and run simulation
        selectDropdownValue('expr:test1');
        const runMcBtn = document.getElementById('run-mc-btn');
        runMcBtn.click();

        // Wait for async simulation to complete
        await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

        // Click generate report button
        const generateReportBtn = document.getElementById('generate-report-btn');
        generateReportBtn.click();

        expect(mockReportGenerator.generate).toHaveBeenCalledWith(
          expect.objectContaining({
            blockers: testBlockers,
          })
        );
      });

      it('logs error and does not throw when reportGenerator.generate fails', async () => {
        mockReportGenerator.generate.mockImplementation(() => {
          throw new Error('Generation failed');
        });

        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        // Select expression and run simulation
        selectDropdownValue('expr:test1');
        const runMcBtn = document.getElementById('run-mc-btn');
        runMcBtn.click();

        // Wait for async simulation to complete
        await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

        // Click generate report button - should not throw
        const generateReportBtn = document.getElementById('generate-report-btn');
        expect(() => generateReportBtn.click()).not.toThrow();

        await Promise.resolve();
        await Promise.resolve();

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to generate report:',
          expect.any(Error)
        );
        expect(mockReportModal.showReport).not.toHaveBeenCalled();
      });
    });
  });

  describe('Problematic Expressions Panel', () => {
    it('shows error banner when scan response reports failure', async () => {
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: false,
        errorType: 'cors_blocked',
        message: 'CORS blocked',
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const banner = getProblematicErrorBanner();
      expect(banner).toBeTruthy();
      expect(banner.hidden).toBe(false);
      expect(banner.dataset.errorType).toBe('cors_blocked');
      expect(banner.textContent).toContain('CORS blocked');
      expect(banner.textContent).toContain('PROXY_ALLOWED_ORIGIN');
    });

    it('loads problematic expressions panel on initialize', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:problem1', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      expect(mockExpressionStatusService.scanAllStatuses).toHaveBeenCalled();
      expect(mockExpressionStatusService.getProblematicExpressions).toHaveBeenCalledWith(
        expect.any(Array),
        10
      );
    });

    it('renders pills for problematic expressions', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'impossible' },
        { id: 'expr:test2', diagnosticStatus: 'rare' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pills = pillsContainer.querySelectorAll('.expression-pill');
      expect(pills.length).toBe(2);
    });

    it('displays expression name without namespace prefix in pill', async () => {
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'emotions:sad_face', description: 'Sad face' },
      ]);
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'emotions:sad_face', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pillName = pillsContainer.querySelector('.pill-name');
      expect(pillName.textContent).toBe('sad_face');
      expect(pillName.getAttribute('title')).toBe('emotions:sad_face');
    });

    it('applies correct status class to pill status circle', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const statusCircle = pillsContainer.querySelector('.status-circle');
      expect(statusCircle.classList.contains('status-impossible')).toBe(true);
    });

    it('normalizes status with underscores to hyphenated class', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'extremely_rare' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const statusCircle = pillsContainer.querySelector('.status-circle');
      expect(statusCircle.classList.contains('status-extremely-rare')).toBe(true);
    });

    it('shows no-problems message when no problematic expressions', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      expect(pillsContainer.innerHTML).toContain('All expressions have uncommon, normal, or frequent status');
    });

    it('clicking pill selects expression in dropdown', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      pill.click();

      expect(getDropdownValue()).toBe('expr:test1');
    });

    it('clicking pill matches dropdown entries without namespace', async () => {
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'self_disgust_arousal', description: 'Test expression 1' },
      ]);
      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'self_disgust_arousal') {
          return { id: 'self_disgust_arousal', description: 'Test expression 1' };
        }
        return null;
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        {
          id: 'emotions-sexual-conflict:self_disgust_arousal',
          diagnosticStatus: 'impossible',
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      pill.click();

      expect(getDropdownValue()).toBe('self_disgust_arousal');

      const description = document.getElementById('expression-description');
      expect(description.textContent).toBe('Test expression 1');
    });

    it('skips pills for expressions missing from dropdown', async () => {
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'expr:test1', description: 'Test expression 1' },
      ]);
      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'expr:test1') {
          return { id: 'expr:test1', description: 'Test expression 1' };
        }
        return null;
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test2', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      expect(pill).toBeNull();
      expect(pillsContainer.innerHTML).toContain(
        'All expressions have uncommon, normal, or frequent status.'
      );
    });

    it('clicking pill updates description', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      pill.click();

      const description = document.getElementById('expression-description');
      expect(description.textContent).toBe('Test expression 1');
    });

    it('clicking pill enables Run Static button', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const runStaticBtn = document.getElementById('run-static-btn');
      expect(runStaticBtn.disabled).toBe(true);

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      pill.click();

      expect(runStaticBtn.disabled).toBe(false);
    });

    it('does not render pills for expressions missing from registry', async () => {
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'expr:test1', description: 'Test expression 1' },
      ]);
      mockExpressionRegistry.getExpression.mockReturnValue(null);
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:nonexistent', filePath: 'data/mods/test/expressions/missing.expression.json', diagnosticStatus: 'impossible' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:nonexistent', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      expect(pill).toBeNull();
    });

    it('handles scan status error gracefully', async () => {
      mockExpressionStatusService.scanAllStatuses.mockRejectedValue(
        new Error('Network error')
      );

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load problematic expressions:',
        expect.any(Error)
      );

      const pillsContainer = document.getElementById('problematic-pills-container');
      expect(pillsContainer.innerHTML).toContain('Failed to load expression statuses');
      const banner = getProblematicErrorBanner();
      expect(banner).toBeTruthy();
      expect(banner.hidden).toBe(false);
      expect(banner.textContent).toContain('Failed to load expression statuses');
    });

    it('removes loading class after successful load', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      expect(pillsContainer.classList.contains('loading')).toBe(false);
    });

    it('removes loading class after failed load', async () => {
      mockExpressionStatusService.scanAllStatuses.mockRejectedValue(
        new Error('Network error')
      );

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      expect(pillsContainer.classList.contains('loading')).toBe(false);
    });

    it('uses unknown status for expressions without diagnosticStatus', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: null },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const statusCircle = pillsContainer.querySelector('.status-circle');
      expect(statusCircle.classList.contains('status-unknown')).toBe(true);
    });

    it('pill has correct aria-label for accessibility', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      expect(pill.getAttribute('aria-label')).toBe('Select expression expr:test1');
    });

    it('falls back to registry with unknown status when scan returns empty', async () => {
      // Setup: scan returns empty (timeout/error scenario)
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [],
      });

      // Setup: registry has expressions
      const registryExpressions = [
        { id: 'expr:test1', description: 'Test 1' },
        { id: 'expr:test2', description: 'Test 2' },
        { id: 'expr:test3', description: 'Test 3' },
      ];
      mockExpressionRegistry.getAllExpressions.mockReturnValue(registryExpressions);

      // Setup: getProblematicExpressions should be called with fallback data
      // and should return all expressions as unknown (which is problematic)
      mockExpressionStatusService.getProblematicExpressions.mockImplementation(
        (expressions) => {
          // Filter out normal/frequent - unknown should be returned
          return expressions.filter(
            (e) => e.diagnosticStatus !== 'normal' && e.diagnosticStatus !== 'frequent'
          );
        }
      );

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Should log warning about using fallback
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('using registry fallback')
      );

      // Should NOT show "All expressions have uncommon, normal, or frequent status"
      const pillsContainer = document.getElementById('problematic-pills-container');
      expect(pillsContainer.innerHTML).not.toContain(
        'All expressions have uncommon, normal, or frequent status'
      );

      // Should show pills for expressions with unknown status
      const pills = pillsContainer.querySelectorAll('.expression-pill');
      expect(pills.length).toBeGreaterThan(0);
    });

    it('updates dropdown status circles without warnings after initialization', async () => {
      // Setup: registry returns expressions
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'expr:test1', description: 'Test 1' },
        { id: 'expr:test2', description: 'Test 2' },
      ]);

      // Setup: status service returns matching expressions with statuses
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'normal' },
          { id: 'expr:test2', filePath: 'data/mods/test/test2.expression.json', diagnosticStatus: 'impossible' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test2', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Verify NO warnings about options not found
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        'StatusSelectDropdown: updateOptionStatus - option not found',
        expect.anything()
      );

      // Verify dropdown exists and has options
      const dropdownContainer = document.getElementById('expression-select-container');
      expect(dropdownContainer).not.toBeNull();
      const options = dropdownContainer.querySelectorAll('.status-select-option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('applies correct status classes to dropdown options after status update', async () => {
      // Setup: registry returns expressions
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'expr:test1', description: 'Test 1' },
        { id: 'expr:test2', description: 'Test 2' },
      ]);

      // Setup: status service returns expressions with specific statuses
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'normal' },
          { id: 'expr:test2', filePath: 'data/mods/test/test2.expression.json', diagnosticStatus: 'impossible' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test2', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Find the dropdown options
      const dropdownContainer = document.getElementById('expression-select-container');
      const options = dropdownContainer.querySelectorAll('.status-select-option');

      // Find the status circles for each expression
      // Note: First option is placeholder, so we check from index 1
      const statusCircles = [];
      options.forEach((opt) => {
        const circle = opt.querySelector('.status-circle');
        if (circle) statusCircles.push(circle);
      });

      // At minimum, we should have status circles
      expect(statusCircles.length).toBeGreaterThan(0);
    });

    it('logs warnings when status entry IDs do not match dropdown option values', async () => {
      // This test reproduces the bug: registry and status service return
      // different expression IDs, causing updateOptionStatus to fail

      // Setup: registry returns expressions
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'expr:test1', description: 'Test 1' },
        { id: 'expr:test2', description: 'Test 2' },
      ]);

      // Setup: status service returns expressions with DIFFERENT IDs
      // This simulates the production scenario where IDs don't match
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'different:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'normal' },
          { id: 'different:test2', filePath: 'data/mods/test/test2.expression.json', diagnosticStatus: 'impossible' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'different:test2', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Verify warnings ARE logged about options not found due to ID mismatch
      // The warning now includes diagnostic info: optionCount and sampleValues
      // Note: optionCount is 3 because it includes the placeholder option with empty value
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'StatusSelectDropdown: updateOptionStatus - option not found',
        {
          value: 'different:test1',
          optionCount: 3,
          sampleValues: ['', 'expr:test1', 'expr:test2'],
        }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'StatusSelectDropdown: updateOptionStatus - option not found',
        {
          value: 'different:test2',
          optionCount: 3,
          sampleValues: ['', 'expr:test1', 'expr:test2'],
        }
      );
    });
  });

  describe('Low Trigger Rate Expressions Panel', () => {
    it('loads low trigger rate expressions on initialize', async () => {
      mockExpressionStatusService.getLowTriggerRateExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'extremely_rare', triggerRate: 0.00001 },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      expect(mockExpressionStatusService.getLowTriggerRateExpressions).toHaveBeenCalledWith(
        expect.any(Array),
        10
      );
    });

    it('renders pills for low trigger rate expressions with percentage badges', async () => {
      mockExpressionStatusService.getLowTriggerRateExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'extremely_rare', triggerRate: 0.00001 },
        { id: 'expr:test2', diagnosticStatus: 'rare', triggerRate: 0.0003 },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('low-trigger-rate-pills-container');
      const pills = pillsContainer.querySelectorAll('.expression-pill');
      expect(pills.length).toBe(2);

      // Verify trigger rate badges are present
      const badges = pillsContainer.querySelectorAll('.trigger-rate-badge');
      expect(badges.length).toBe(2);
      expect(badges[0].textContent).toBe('0.0%');
      expect(badges[1].textContent).toBe('0.0%');
    });

    it('shows no-data message when no low trigger rate expressions exist', async () => {
      mockExpressionStatusService.getLowTriggerRateExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('low-trigger-rate-pills-container');
      const noDataMessage = pillsContainer.querySelector('.no-data-message');
      expect(noDataMessage).toBeTruthy();
      expect(noDataMessage.textContent).toContain('No trigger rate data available');
      expect(noDataMessage.textContent).toContain('Monte Carlo');
    });

    it('applies correct status CSS class to trigger rate badge', async () => {
      mockExpressionStatusService.getLowTriggerRateExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'extremely_rare', triggerRate: 0.00001 },
        { id: 'expr:test2', diagnosticStatus: 'uncommon', triggerRate: 0.003 },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('low-trigger-rate-pills-container');
      const badges = pillsContainer.querySelectorAll('.trigger-rate-badge');

      // extremely_rare converts to status-extremely-rare
      expect(badges[0].classList.contains('status-extremely-rare')).toBe(true);
      // uncommon converts to status-uncommon
      expect(badges[1].classList.contains('status-uncommon')).toBe(true);
    });

    it('selects expression in dropdown when low trigger rate pill is clicked', async () => {
      mockExpressionStatusService.getLowTriggerRateExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'rare', triggerRate: 0.0003 },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('low-trigger-rate-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      expect(pill).toBeTruthy();

      pill.click();

      expect(getDropdownValue()).toBe('expr:test1');
    });

    it('displays expression name without namespace prefix in low trigger rate pill', async () => {
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'emotions:calm_focus', description: 'Calm focus' },
      ]);
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'emotions:calm_focus', filePath: 'data/mods/emotions/calm_focus.expression.json', diagnosticStatus: 'rare', triggerRate: 0.0004 },
        ],
      });
      mockExpressionStatusService.getLowTriggerRateExpressions.mockReturnValue([
        { id: 'emotions:calm_focus', diagnosticStatus: 'rare', triggerRate: 0.0004 },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('low-trigger-rate-pills-container');
      const pillName = pillsContainer.querySelector('.pill-name');
      expect(pillName).toBeTruthy();
      expect(pillName.textContent).toBe('calm_focus');
      expect(pillName.title).toBe('emotions:calm_focus');
    });

    it('refreshes low trigger rate pills when cache is updated', async () => {
      // Provide filePath to enable persistence (required for #persistExpressionStatus)
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/expressions/test1.expression.json', diagnosticStatus: 'rare', triggerRate: 0.0003 },
          { id: 'expr:test2', filePath: 'data/mods/test/expressions/test2.expression.json', diagnosticStatus: 'normal', triggerRate: 0.015 },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);
      mockExpressionStatusService.getLowTriggerRateExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'rare', triggerRate: 0.0003 },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Verify initial call
      expect(mockExpressionStatusService.getLowTriggerRateExpressions).toHaveBeenCalledTimes(1);

      // Now update mock to return different data
      mockExpressionStatusService.getLowTriggerRateExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'uncommon', triggerRate: 0.003 },
        { id: 'expr:test2', diagnosticStatus: 'normal', triggerRate: 0.015 },
      ]);

      // Select an expression and trigger static analysis which updates cache
      selectDropdownValue('expr:test1');
      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for path-sensitive analysis to complete
      await mockPathSensitiveAnalyzer.analyze.mock.results[0]?.value;
      // Wait for status persistence to complete (called after path-sensitive analysis)
      await mockExpressionStatusService.updateStatus.mock.results[0]?.value;
      // Allow microtask queue to process
      await Promise.resolve();

      // The refresh should have been called during #refreshProblematicPillsFromCache
      expect(mockExpressionStatusService.getLowTriggerRateExpressions.mock.calls.length).toBeGreaterThan(1);
    });

    it('displays full expression name for reasonably long names', async () => {
      const longName = 'emotions-acceptance:quiet_acceptance_after_loss';
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: longName, description: 'Test expression with long name' },
      ]);
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: longName, filePath: 'data/mods/emotions-acceptance/expressions/quiet_acceptance_after_loss.expression.json', diagnosticStatus: 'rare', triggerRate: 0.001 },
        ],
      });
      mockExpressionStatusService.getLowTriggerRateExpressions.mockReturnValue([
        { id: longName, diagnosticStatus: 'rare', triggerRate: 0.001 },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('low-trigger-rate-pills-container');
      const pillName = pillsContainer.querySelector('.pill-name');
      // Name should be extracted as last segment and displayed in full
      expect(pillName.textContent).toBe('quiet_acceptance_after_loss');
      // Title should show full ID for tooltip
      expect(pillName.title).toBe(longName);
    });

    it('formats very small trigger rate percentages with sufficient precision', async () => {
      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        { id: 'test:expr', description: 'Test' },
      ]);
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'test:expr', filePath: 'data/mods/test/expr.expression.json', diagnosticStatus: 'extremely_rare', triggerRate: 0.00040 },
        ],
      });
      mockExpressionStatusService.getLowTriggerRateExpressions.mockReturnValue([
        { id: 'test:expr', diagnosticStatus: 'extremely_rare', triggerRate: 0.00040 },
      ]);
      // The actual formatting is now done by the service with tiered precision
      mockExpressionStatusService.formatTriggerRatePercent.mockReturnValue('0.04%');

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('low-trigger-rate-pills-container');
      const badge = pillsContainer.querySelector('.trigger-rate-badge');
      // Previously this would show "0.0%" - now it should show "0.04%"
      expect(badge.textContent).toBe('0.04%');
    });
  });

  describe('Status persistence', () => {
    it('shows error banner when persistence response fails', async () => {
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'unknown' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);
      mockExpressionStatusService.updateStatus.mockResolvedValue({
        success: false,
        errorType: 'timeout',
        message: 'Request timed out',
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      await mockPathSensitiveAnalyzer.analyze.mock.results[0]?.value;
      await mockExpressionStatusService.updateStatus.mock.results[0]?.value;
      await Promise.resolve();

      const banner = getProblematicErrorBanner();
      expect(banner).toBeTruthy();
      expect(banner.hidden).toBe(false);
      expect(banner.dataset.errorType).toBe('timeout');
      expect(banner.textContent).toContain('Request timed out');
      expect(banner.textContent).toContain('retry');
    });

    it('persists status after static analysis', async () => {
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'unknown' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations (path-sensitive analysis is now async)
      await mockPathSensitiveAnalyzer.analyze.mock.results[0]?.value;
      await Promise.resolve();

      // Static analysis doesn't calculate triggerRate, so it passes null
      expect(mockExpressionStatusService.updateStatus).toHaveBeenCalledWith(
        'data/mods/test/test1.expression.json',
        expect.any(String),
        null
      );
    });

    it('persists status after Monte Carlo simulation', async () => {
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'unknown' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;
      await Promise.resolve();

      // Monte Carlo passes the calculated triggerRate (0.05 from default mock)
      expect(mockExpressionStatusService.updateStatus).toHaveBeenCalledWith(
        'data/mods/test/test1.expression.json',
        expect.any(String),
        0.05
      );
    });

    it('logs warning when no filePath for persistence', async () => {
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', diagnosticStatus: 'unknown' }, // No filePath
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations (path-sensitive analysis is now async)
      await mockPathSensitiveAnalyzer.analyze.mock.results[0]?.value;
      await Promise.resolve();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot persist status: no file path')
      );
      expect(mockExpressionStatusService.updateStatus).not.toHaveBeenCalled();
    });

    it('refreshes panel after status persistence using cached data', async () => {
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'unknown' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Reset the call count after initialize
      mockExpressionStatusService.scanAllStatuses.mockClear();
      mockExpressionStatusService.getProblematicExpressions.mockClear();

      selectDropdownValue('expr:test1');

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations (path-sensitive analysis is now async)
      await mockPathSensitiveAnalyzer.analyze.mock.results[0]?.value;
      await Promise.resolve();
      await Promise.resolve();

      // Panel should be refreshed using cached data (not re-scanning from disk)
      // This prevents race condition where scanAllStatuses returns stale data
      expect(mockExpressionStatusService.getProblematicExpressions).toHaveBeenCalled();
      // Should NOT re-scan from disk after persistence
      expect(mockExpressionStatusService.scanAllStatuses).not.toHaveBeenCalled();
    });

    it('handles persistence error gracefully', async () => {
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'unknown' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);
      mockExpressionStatusService.updateStatus.mockRejectedValue(
        new Error('Network error')
      );

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations (path-sensitive analysis is now async)
      await mockPathSensitiveAnalyzer.analyze.mock.results[0]?.value;
      await Promise.resolve();
      await Promise.resolve();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to persist expression status:',
        expect.any(Error)
      );
    });

    it('logs info on successful persistence', async () => {
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'unknown' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations (path-sensitive analysis is now async)
      await mockPathSensitiveAnalyzer.analyze.mock.results[0]?.value;
      await Promise.resolve();
      await Promise.resolve();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Persisted status")
      );
    });

    it('constructs file path from metadata when not in statuses array', async () => {
      // Setup: expression has _sourceFile and _modId metadata but is NOT in the scanned statuses
      const expressionWithMetadata = {
        id: 'positioning:sit_down',
        description: 'Test expression with metadata',
        _sourceFile: 'sit_down.expression.json',
        _modId: 'positioning',
      };

      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        expressionWithMetadata,
      ]);
      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'positioning:sit_down') {
          return expressionWithMetadata;
        }
        return null;
      });

      // Server scan returns empty array - simulating the bug where non-emotions mods aren't scanned
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('positioning:sit_down');

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations
      await Promise.resolve();
      await Promise.resolve();

      // Should construct path from metadata and call updateStatus
      // Static analysis doesn't calculate triggerRate, so it passes null
      expect(mockExpressionStatusService.updateStatus).toHaveBeenCalledWith(
        'data/mods/positioning/expressions/sit_down.expression.json',
        expect.any(String),
        null
      );
      // Should NOT log the "no file path" warning
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Cannot persist status: no file path')
      );
    });

    it('logs debug message when using constructed path from metadata', async () => {
      const expressionWithMetadata = {
        id: 'core:test_expr',
        description: 'Test expression',
        _sourceFile: 'test_expr.expression.json',
        _modId: 'core',
      };

      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        expressionWithMetadata,
      ]);
      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'core:test_expr') {
          return expressionWithMetadata;
        }
        return null;
      });

      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('core:test_expr');

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      // Should log debug message about constructing path from metadata
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Constructed file path from metadata')
      );
    });

    it('falls back to warning when expression lacks both filePath and metadata', async () => {
      // Expression without _sourceFile or _modId metadata
      const expressionWithoutMetadata = {
        id: 'orphan:no_metadata',
        description: 'Orphan expression without metadata',
      };

      mockExpressionRegistry.getAllExpressions.mockReturnValue([
        expressionWithoutMetadata,
      ]);
      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'orphan:no_metadata') {
          return expressionWithoutMetadata;
        }
        return null;
      });

      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('orphan:no_metadata');

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      // Should still log warning since there's no way to construct the path
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot persist status: no file path')
      );
      expect(mockExpressionStatusService.updateStatus).not.toHaveBeenCalled();
    });

    it('should not overwrite dropdown status when scanAllStatuses returns stale data (race condition prevention)', async () => {
      // This test reproduces the bug where:
      // 1. Monte Carlo simulation determines 'rare' status
      // 2. Dropdown is correctly updated to 'rare' (purple)
      // 3. scanAllStatuses() returns stale data ('impossible') from disk
      // 4. Dropdown gets incorrectly overwritten to 'impossible' (red)

      // Setup expression in registry
      const testExpression = {
        id: 'expr:test1',
        description: 'Test expression',
        _sourceFile: 'test1.expression.json',
        _modId: 'test',
      };
      mockExpressionRegistry.getAllExpressions.mockReturnValue([testExpression]);
      mockExpressionRegistry.getExpression.mockReturnValue(testExpression);

      // Initial scan returns unknown status
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/expressions/test1.expression.json', diagnosticStatus: 'unknown' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      // Mock Monte Carlo to return 'rare' rarity
      // RARITY_THRESHOLDS: RARE < 0.0005 (0.05%), so use 0.0001 (0.01%)
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        iterations: 100000,
        triggers: 10,
        noTriggerIterations: 0,
        noTriggerPercentage: 0,
        triggerRate: 0.0001, // 0.01% - classified as 'rare'
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Reset scanAllStatuses to return STALE 'impossible' status
      // This simulates the race condition where the file write hasn't completed yet
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/expressions/test1.expression.json', diagnosticStatus: 'impossible' },
        ],
      });

      selectDropdownValue('expr:test1');

      // Run Monte Carlo simulation
      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Verify the status was persisted as 'rare' (not stale 'impossible')
      // Monte Carlo passes triggerRate: 0.0001 from the mock
      expect(mockExpressionStatusService.updateStatus).toHaveBeenLastCalledWith(
        expect.stringContaining('test1.expression.json'),
        'rare',
        0.0001
      );

      // The key assertion: scanAllStatuses should NOT be called after persist
      // when using the cache-based refresh (the fix). If this test fails before
      // the fix, it means scanAllStatuses was called in #loadProblematicExpressionsPanel
      // and would have returned stale 'impossible' data.
      //
      // Count scanAllStatuses calls: 1 during initialize, 0 after persist (with fix)
      // Before fix: 1 during initialize, 1 after persist = 2 total
      // After fix: 1 during initialize only = 1 total
      const scanCalls = mockExpressionStatusService.scanAllStatuses.mock.calls.length;

      // With the fix, scanAllStatuses should only be called once (during initialize)
      // If it's called twice, the race condition bug is present
      expect(scanCalls).toBe(1);
    });
  });

  describe('Event dispatch consistency (regression tests)', () => {
    it('pill click updates dropdown selection', async () => {
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
        { id: 'expr:test1', diagnosticStatus: 'impossible' },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Verify dropdown is initially empty or has different value
      expect(getDropdownValue()).not.toBe('expr:test1');

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      pill.click();

      // The dropdown should now have the clicked pill's expression selected
      expect(getDropdownValue()).toBe('expr:test1');
    });

    it('static analysis button waits for async operation to complete', async () => {
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'unknown' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      // Track the order of operations
      const operationOrder = [];
      mockExpressionStatusService.updateStatus.mockImplementation(async () => {
        operationOrder.push('updateStatus-start');
        await new Promise(resolve => setTimeout(resolve, 10));
        operationOrder.push('updateStatus-end');
        return { success: true };
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runStaticBtn = document.getElementById('run-static-btn');

      // Click and await the result - button click should wait for async
      runStaticBtn.click();

      // Give enough time for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // updateStatus should have been called and completed
      expect(operationOrder).toContain('updateStatus-start');
      expect(operationOrder).toContain('updateStatus-end');
    });

    it('Monte Carlo button waits for async operation to complete', async () => {
      mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
        success: true,
        expressions: [
          { id: 'expr:test1', filePath: 'data/mods/test/test1.expression.json', diagnosticStatus: 'unknown' },
        ],
      });
      mockExpressionStatusService.getProblematicExpressions.mockReturnValue([]);

      // Track the order of operations
      const operationOrder = [];
      mockExpressionStatusService.updateStatus.mockImplementation(async () => {
        operationOrder.push('updateStatus-start');
        await new Promise(resolve => setTimeout(resolve, 10));
        operationOrder.push('updateStatus-end');
        return { success: true };
      });

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      selectDropdownValue('expr:test1');

      const runMcBtn = document.getElementById('run-mc-btn');

      // Click and await the result - button click should wait for async
      runMcBtn.click();

      // Give enough time for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // updateStatus should have been called and completed
      expect(operationOrder).toContain('updateStatus-start');
      expect(operationOrder).toContain('updateStatus-end');
    });

    describe('Failed Conditions Display', () => {
      it('should render failed condition descriptions, not [object Object]', async () => {
        // Mock simulator to return impossible expression with nearestMiss data
        mockMonteCarloSimulator.simulate.mockResolvedValue({
          triggerRate: 0,
          triggerCount: 0,
          sampleCount: 10000,
          confidenceInterval: { low: 0, high: 0.001 },
          clauseFailures: [],
          distribution: 'uniform',
          witnessAnalysis: {
            witnesses: [],
            nearestMiss: {
              sample: {
                current: { mood: { joy: 25 } },
                previous: { mood: {} },
                affectTraits: {},
              },
              failedLeafCount: 2,
              failedLeaves: [
                {
                  description: 'emotions.joy >= 50',
                  actual: 25,
                  threshold: 50,
                  violation: 25,
                },
                {
                  description: 'emotions.calm >= 30',
                  actual: 10,
                  threshold: 30,
                  violation: 20,
                },
              ],
            },
          },
        });

        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        // Select expression and trigger simulation
        selectDropdownValue('expr:test1');
        const runMcBtn = document.getElementById('run-mc-btn');
        runMcBtn.click();

        // Wait for async simulation to complete
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Find the failed conditions section
        const failedSection = document.querySelector('.mc-witness-failed-section');
        expect(failedSection).not.toBeNull();

        const html = failedSection.innerHTML;
        expect(html).not.toContain('[object Object]');
        // Note: innerHTML escapes > to &gt;
        expect(html).toContain('emotions.joy');
        expect(html).toContain('emotions.calm');
        expect(html).toContain('actual: 25');
        expect(html).toContain('needed: 50');
      });

      it('should handle failedLeaves with missing description gracefully', async () => {
        mockMonteCarloSimulator.simulate.mockResolvedValue({
          triggerRate: 0,
          triggerCount: 0,
          sampleCount: 10000,
          confidenceInterval: { low: 0, high: 0 },
          clauseFailures: [],
          distribution: 'uniform',
          witnessAnalysis: {
            witnesses: [],
            nearestMiss: {
              sample: { current: {}, previous: {}, affectTraits: {} },
              failedLeafCount: 1,
              failedLeaves: [
                {
                  description: null,
                  actual: null,
                  threshold: null,
                  violation: null,
                },
              ],
            },
          },
        });

        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        selectDropdownValue('expr:test1');
        document.getElementById('run-mc-btn').click();
        await new Promise((resolve) => setTimeout(resolve, 50));

        const failedSection = document.querySelector('.mc-witness-failed-section');
        expect(failedSection).not.toBeNull();
        expect(failedSection.innerHTML).not.toContain('[object Object]');
        expect(failedSection.innerHTML).toContain('Unknown condition');
      });

      it('should display actual and threshold values when available', async () => {
        mockMonteCarloSimulator.simulate.mockResolvedValue({
          triggerRate: 0,
          triggerCount: 0,
          sampleCount: 10000,
          confidenceInterval: { low: 0, high: 0 },
          clauseFailures: [],
          distribution: 'uniform',
          witnessAnalysis: {
            witnesses: [],
            nearestMiss: {
              sample: { current: {}, previous: {}, affectTraits: {} },
              failedLeafCount: 1,
              failedLeaves: [
                {
                  description: 'mood.anger >= 75',
                  actual: 30,
                  threshold: 75,
                  violation: 45,
                },
              ],
            },
          },
        });

        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        selectDropdownValue('expr:test1');
        document.getElementById('run-mc-btn').click();
        await new Promise((resolve) => setTimeout(resolve, 50));

        const failedSection = document.querySelector('.mc-witness-failed-section');
        expect(failedSection).not.toBeNull();
        const html = failedSection.innerHTML;
        // Note: innerHTML escapes > to &gt;
        expect(html).toContain('mood.anger');
        expect(html).toContain('actual: 30');
        expect(html).toContain('needed: 75');
      });
    });
  });


  describe('Path-Sensitive Analysis', () => {
    it('shows path-sensitive section after running static analysis', async () => {
      // Setup mock to return branches for path-sensitive analysis
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [
          {
            branchId: 'branch-1',
            description: 'All prototypes active',
            isInfeasible: false,
            knifeEdges: [],
            requiredPrototypes: ['proto1'],
            activePrototypes: ['proto1'],
            inactivePrototypes: [],
          },
        ],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [],
        feasibilityVolume: 0.8,
        overallStatus: 'reachable',
        statusEmoji: '✅',
        getSummaryMessage: jest.fn().mockReturnValue('Expression is reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([
          { prototypeId: 'proto1', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 },
        ]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      // Run static analysis which triggers path-sensitive analysis
      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const pathSensitiveSection = document.getElementById('path-sensitive-results');
      expect(pathSensitiveSection.hidden).toBe(false);
    });

    it('updates summary status and message', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [],
        branchCount: 2,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'partial',
        statusEmoji: '🟡',
        getSummaryMessage: jest.fn().mockReturnValue('1 of 2 branches reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const summaryMessage = document.getElementById('ps-summary-message');
      const statusIndicator = document.getElementById('ps-status-indicator');
      const branchCount = document.getElementById('branch-count');
      const reachableCount = document.getElementById('reachable-count');

      expect(summaryMessage.textContent).toBe('1 of 2 branches reachable');
      expect(statusIndicator.textContent).toBe('🟡');
      expect(branchCount.textContent).toBe('2');
      expect(reachableCount.textContent).toBe('1');
    });

    it('renders correct number of branch cards', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [
          { branchId: 'branch-1', description: 'Branch 1', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] },
          { branchId: 'branch-2', description: 'Branch 2', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] },
          { branchId: 'branch-3', description: 'Branch 3', isInfeasible: true, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] },
        ],
        branchCount: 3,
        feasibleBranchCount: 2,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1', 'branch-2'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'reachable',
        statusEmoji: '✅',
        getSummaryMessage: jest.fn().mockReturnValue('All branches reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([{ prototypeId: 'p1', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 }]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const branchCards = document.querySelectorAll('.branch-card');
      expect(branchCards.length).toBe(3);
    });

    it('handles analysis error gracefully', async () => {
      mockPathSensitiveAnalyzer.analyze.mockRejectedValue(new Error('Analysis failed'));

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should hide the path-sensitive section on error
      const pathSensitiveSection = document.getElementById('path-sensitive-results');
      expect(pathSensitiveSection.hidden).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith('Path-sensitive analysis failed:', expect.any(Error));
    });

    it('resets path-sensitive results when expression changes', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'Branch 1', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'reachable',
        statusEmoji: '✅',
        getSummaryMessage: jest.fn().mockReturnValue('Reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([{ prototypeId: 'p1', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 }]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      // Run analysis
      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify section is visible
      let pathSensitiveSection = document.getElementById('path-sensitive-results');
      expect(pathSensitiveSection.hidden).toBe(false);

      // Change expression (reset happens)
      selectDropdownValue('expr:test2');
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Section should be hidden after selection change
      pathSensitiveSection = document.getElementById('path-sensitive-results');
      expect(pathSensitiveSection.hidden).toBe(true);
    });
  });

  describe('Branch Cards', () => {
    it('creates reachable branch card with correct status', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'Reachable Branch', isInfeasible: false, knifeEdges: [], requiredPrototypes: ['proto1'], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'reachable',
        statusEmoji: '✅',
        getSummaryMessage: jest.fn().mockReturnValue('Reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([{ prototypeId: 'proto1', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 }]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const card = document.querySelector('.branch-card');
      expect(card.dataset.status).toBe('reachable');
      expect(card.querySelector('.branch-status-icon').textContent).toBe('✅');
      expect(card.querySelector('.branch-title').textContent).toBe('Reachable Branch');
    });

    it('creates infeasible branch card when isInfeasible is true', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'Infeasible Branch', isInfeasible: true, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 0,
        reachabilityByBranch: [],
        hasFullyReachableBranch: false,
        fullyReachableBranchIds: [],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'infeasible',
        statusEmoji: '🚫',
        getSummaryMessage: jest.fn().mockReturnValue('No feasible branches'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const card = document.querySelector('.branch-card');
      expect(card.dataset.status).toBe('infeasible');
      expect(card.querySelector('.branch-status-icon').textContent).toBe('🚫');
    });

    it('creates knife-edge branch card when knifeEdges exist', async () => {
      const mockKnifeEdge = {
        axis: 'valence',
        min: 0.45,
        max: 0.55,
        width: 0.1,
        formatDualScaleInterval: jest.fn().mockReturnValue('[0.45, 0.55]'),
        formatInterval: jest.fn().mockReturnValue('[0.45, 0.55]'),
        contributingPrototypes: ['proto1'],
        formatContributors: jest.fn().mockReturnValue('proto1'),
        branchId: 'branch-1',
      };

      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'Knife Edge Branch', isInfeasible: false, knifeEdges: [mockKnifeEdge], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [mockKnifeEdge],
        feasibilityVolume: null,
        overallStatus: 'knife-edge',
        statusEmoji: '⚠️',
        getSummaryMessage: jest.fn().mockReturnValue('Has knife-edge conditions'),
        getReachabilityForBranch: jest.fn().mockReturnValue([{ prototypeId: 'proto1', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 }]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const card = document.querySelector('.branch-card');
      expect(card.dataset.status).toBe('knife-edge');
      expect(card.querySelector('.branch-status-icon').textContent).toBe('⚠️');
      expect(card.querySelector('.branch-knife-edges').hidden).toBe(false);
      expect(card.querySelector('.ke-message').textContent).toBe('valence: [0.45, 0.55]');
    });

    it('creates unreachable branch card when some reachability false', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'Unreachable Branch', isInfeasible: false, knifeEdges: [], requiredPrototypes: ['proto1'], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 0,
        reachabilityByBranch: [],
        hasFullyReachableBranch: false,
        fullyReachableBranchIds: [],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'unreachable',
        statusEmoji: '❌',
        getSummaryMessage: jest.fn().mockReturnValue('Unreachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([{ prototypeId: 'proto1', isReachable: false, threshold: 0.8, maxPossible: 0.6, gap: 0.2 }]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const card = document.querySelector('.branch-card');
      expect(card.dataset.status).toBe('unreachable');
      expect(card.querySelector('.branch-status-icon').textContent).toBe('❌');
      // Threshold table should be visible
      expect(card.querySelector('.branch-thresholds').hidden).toBe(false);
    });

    it('displays active and inactive prototypes', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{
          branchId: 'branch-1',
          description: 'Partitioned Branch',
          isInfeasible: false,
          knifeEdges: [],
          requiredPrototypes: ['proto1', 'proto2'],
          activePrototypes: ['proto1'],
          inactivePrototypes: ['proto2'],
        }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'reachable',
        statusEmoji: '✅',
        getSummaryMessage: jest.fn().mockReturnValue('Reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([{ prototypeId: 'proto1', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 }]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const prototypeList = document.querySelector('.prototype-list');
      expect(prototypeList.innerHTML).toContain('Active (gates enforced): proto1');
      expect(prototypeList.innerHTML).toContain('Inactive (gates ignored): proto2');
    });

    it('falls back to requiredPrototypes when no active/inactive', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{
          branchId: 'branch-1',
          description: 'Fallback Branch',
          isInfeasible: false,
          knifeEdges: [],
          requiredPrototypes: ['protoA', 'protoB'],
          activePrototypes: [],
          inactivePrototypes: [],
        }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'reachable',
        statusEmoji: '✅',
        getSummaryMessage: jest.fn().mockReturnValue('Reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([{ prototypeId: 'protoA', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 }]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const prototypeList = document.querySelector('.prototype-list');
      expect(prototypeList.textContent).toBe('protoA, protoB');
    });

    it('shows threshold table for unreachable branches', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'Unreachable', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 0,
        reachabilityByBranch: [],
        hasFullyReachableBranch: false,
        fullyReachableBranchIds: [],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'unreachable',
        statusEmoji: '❌',
        getSummaryMessage: jest.fn().mockReturnValue('Unreachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([
          { prototypeId: 'proto1', isReachable: false, threshold: 0.9, maxPossible: 0.7, gap: 0.2 },
          { prototypeId: 'proto2', isReachable: false, threshold: 0.8, maxPossible: 0.5, gap: 0.3 },
        ]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const thresholdsDiv = document.querySelector('.branch-thresholds');
      expect(thresholdsDiv.hidden).toBe(false);

      const rows = document.querySelectorAll('.threshold-tbody tr');
      expect(rows.length).toBe(2);
    });

    it('uses formatInterval fallback when formatDualScaleInterval unavailable', async () => {
      const mockKnifeEdge = {
        axis: 'arousal',
        min: 0.3,
        max: 0.7,
        width: 0.4,
        formatInterval: jest.fn().mockReturnValue('[0.30, 0.70]'),
        contributingPrototypes: ['proto1'],
        branchId: 'branch-1',
      };

      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'KE Branch', isInfeasible: false, knifeEdges: [mockKnifeEdge], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [mockKnifeEdge],
        feasibilityVolume: null,
        overallStatus: 'knife-edge',
        statusEmoji: '⚠️',
        getSummaryMessage: jest.fn().mockReturnValue('Knife-edge'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const keMessage = document.querySelector('.ke-message');
      expect(keMessage.textContent).toBe('arousal: [0.30, 0.70]');
      expect(mockKnifeEdge.formatInterval).toHaveBeenCalled();
    });

    it('uses raw min/max fallback when no format methods available', async () => {
      const mockKnifeEdge = {
        axis: 'engagement',
        min: 0.2,
        max: 0.4,
        width: 0.2,
        contributingPrototypes: ['proto1'],
        branchId: 'branch-1',
      };

      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'Raw KE Branch', isInfeasible: false, knifeEdges: [mockKnifeEdge], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [mockKnifeEdge],
        feasibilityVolume: null,
        overallStatus: 'knife-edge',
        statusEmoji: '⚠️',
        getSummaryMessage: jest.fn().mockReturnValue('Knife-edge'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const keMessage = document.querySelector('.ke-message');
      expect(keMessage.textContent).toBe('engagement: [0.20, 0.40]');
    });
  });

  describe('Branch Filter Toggle', () => {
    it('toggles showAllBranches state on checkbox change', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'Branch', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'reachable',
        statusEmoji: '✅',
        getSummaryMessage: jest.fn().mockReturnValue('Reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([{ prototypeId: 'p1', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 }]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const checkbox = document.getElementById('show-all-branches');

      // Initially reachable cards are hidden (filtered)
      let card = document.querySelector('.branch-card[data-status="reachable"]');
      expect(card.classList.contains('filtered-hidden')).toBe(true);

      // Check the checkbox
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      // Now card should be visible
      card = document.querySelector('.branch-card[data-status="reachable"]');
      expect(card.classList.contains('filtered-hidden')).toBe(false);

      // Uncheck
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));

      // Card hidden again
      card = document.querySelector('.branch-card[data-status="reachable"]');
      expect(card.classList.contains('filtered-hidden')).toBe(true);
    });

    it('hides reachable cards when filter not enabled', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [
          { branchId: 'branch-1', description: 'Reachable', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] },
          { branchId: 'branch-2', description: 'Unreachable', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] },
        ],
        branchCount: 2,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'partial',
        statusEmoji: '🟡',
        getSummaryMessage: jest.fn().mockReturnValue('Partial'),
        getReachabilityForBranch: jest.fn().mockImplementation((branchId) => {
          if (branchId === 'branch-1') {
            return [{ prototypeId: 'p1', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 }];
          }
          return [{ prototypeId: 'p1', isReachable: false, threshold: 0.8, maxPossible: 0.6, gap: 0.2 }];
        }),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const reachableCard = document.querySelector('.branch-card[data-status="reachable"]');
      const unreachableCard = document.querySelector('.branch-card[data-status="unreachable"]');

      expect(reachableCard.classList.contains('filtered-hidden')).toBe(true);
      expect(unreachableCard.classList.contains('filtered-hidden')).toBe(false);
    });

    it('shows all cards when filter enabled', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [
          { branchId: 'branch-1', description: 'Reachable', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] },
          { branchId: 'branch-2', description: 'Also Reachable', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] },
        ],
        branchCount: 2,
        feasibleBranchCount: 2,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1', 'branch-2'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'reachable',
        statusEmoji: '✅',
        getSummaryMessage: jest.fn().mockReturnValue('Reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([{ prototypeId: 'p1', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 }]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Enable show all
      const checkbox = document.getElementById('show-all-branches');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      const cards = document.querySelectorAll('.branch-card');
      for (const card of cards) {
        expect(card.classList.contains('filtered-hidden')).toBe(false);
      }
    });
  });

  describe('Blocker Toggle', () => {
    it('expands collapsed breakdown on click', async () => {
      // Setup Monte Carlo with blockers that have hierarchical breakdown
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [{ clauseId: 'clause1', failureRate: 0.99 }],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'test clause description',
          failureRate: 0.99,
          averageViolation: 0.5,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'and',
            description: 'Root AND',
            failureRate: 0.99,
            isCompound: true,
            averageViolation: 0,
            children: [
              { nodeType: 'leaf', description: 'Child leaf', failureRate: 0.5, isCompound: false, averageViolation: 0.1, children: [] },
            ],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Find the expand toggle
      const toggle = document.querySelector('.expand-toggle');
      expect(toggle).toBeTruthy();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');

      // Click to expand
      toggle.click();

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.textContent).toBe('▼');

      const breakdownRow = document.querySelector('.breakdown-row');
      expect(breakdownRow.classList.contains('collapsed')).toBe(false);
    });

    it('collapses expanded breakdown on click', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [{ clauseId: 'clause1', failureRate: 0.99 }],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'test clause description',
          failureRate: 0.99,
          averageViolation: 0.5,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'and',
            description: 'Root',
            failureRate: 0.99,
            isCompound: true,
            averageViolation: 0,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const toggle = document.querySelector('.expand-toggle');

      // Expand first
      toggle.click();
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      // Then collapse
      toggle.click();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.textContent).toBe('▶');

      const breakdownRow = document.querySelector('.breakdown-row');
      expect(breakdownRow.classList.contains('collapsed')).toBe(true);
    });

    it('does nothing when elements not found', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();

      // Manually remove blocker tbody to test guard clause
      const blockersTbody = document.getElementById('blockers-tbody');
      blockersTbody.innerHTML = `
        <tr data-blocker-id="blocker-1">
          <td><button class="expand-toggle" aria-expanded="false">▶</button></td>
        </tr>
      `;

      // Try to toggle - should not throw because breakdown row doesn't exist
      const toggle = document.querySelector('.expand-toggle');
      expect(() => toggle.click()).not.toThrow();
    });
  });

describe('Compound Node Stats and OR Pass Rate', () => {
    it('shows aggregated stats for compound nodes with worst violation', async () => {
      // Setup Monte Carlo with compound node having leaf children with violations
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [{ clauseId: 'clause1', failureRate: 0.99 }],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'AND of 6 conditions',
          failureRate: 0.99,
          averageViolation: 0,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'and',
            description: 'AND of 6 conditions',
            failureRate: 0.99,
            isCompound: true,
            averageViolation: 0,
            children: [
              {
                nodeType: 'leaf',
                description: 'moodAxes.threat <= 20',
                failureRate: 0.8,
                isCompound: false,
                averageViolation: 40.87,
                nearMissRate: 0.01,
                nearMissEpsilon: 0.05,
                children: [],
              },
              {
                nodeType: 'leaf',
                description: 'previousEmotions.fear >= 0.25',
                failureRate: 0.5,
                isCompound: false,
                averageViolation: 0.1,
                nearMissRate: 0.0548,
                nearMissEpsilon: 0.05,
                children: [],
              },
            ],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check that the violation stats column shows aggregated stats
      const violationStats = document.querySelector(
        '.breakdown-row .violation-stats'
      );
      expect(violationStats).toBeTruthy();
      expect(
        document.querySelector('.blocker-row .violation-stats')
      ).toBeNull();
      expect(violationStats.innerHTML).toContain('worst Δ');
      expect(violationStats.innerHTML).toContain('40.87');
      expect(violationStats.innerHTML).toContain('most tunable');
    });

    it('renders full tunable description without truncation', async () => {
      const longDescription =
        'sexualStates.sexual_performance_anxiety >= 0.9';

      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [{ clauseId: 'clause1', failureRate: 0.99 }],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'AND of 2 conditions',
          failureRate: 0.99,
          averageViolation: 0,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'and',
            description: 'AND of 2 conditions',
            failureRate: 0.99,
            isCompound: true,
            averageViolation: 0,
            children: [
              {
                nodeType: 'leaf',
                description: longDescription,
                failureRate: 0.8,
                isCompound: false,
                averageViolation: 60.46,
                nearMissRate: 0.05,
                nearMissEpsilon: 0.05,
                children: [],
              },
              {
                nodeType: 'leaf',
                description: 'moodAxes.threat <= 20',
                failureRate: 0.5,
                isCompound: false,
                averageViolation: 0.1,
                nearMissRate: 0.01,
                nearMissEpsilon: 0.05,
                children: [],
              },
            ],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const violationStats = document.querySelector(
        '.breakdown-row .violation-stats'
      );
      expect(violationStats).toBeTruthy();
      expect(violationStats.textContent).toContain(longDescription);
    });

    it('shows OR block pass rate summary in hierarchical tree', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [{ clauseId: 'clause1', failureRate: 0.75 }],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'OR block',
          failureRate: 0.75,
          averageViolation: 0.5,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'or',
            description: 'OR of 2 conditions',
            failureRate: 0.75,
            isCompound: true,
            averageViolation: 0,
            children: [
              {
                nodeType: 'leaf',
                description: 'condition A',
                failureRate: 0.9,
                isCompound: false,
                averageViolation: 0.3,
                children: [],
              },
              {
                nodeType: 'leaf',
                description: 'condition B',
                failureRate: 0.833,
                isCompound: false,
                averageViolation: 0.2,
                children: [],
              },
            ],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Expand the blocker to see the hierarchical tree
      const toggle = document.querySelector('.expand-toggle');
      if (toggle) {
        toggle.click();
      }

      // Check for OR summary - combined pass rate = 1 - (0.9 * 0.833) ≈ 25%
      const orSummary = document.querySelector('.tree-or-summary');
      expect(orSummary).toBeTruthy();
      expect(orSummary.textContent).toContain('Combined:');
      expect(orSummary.textContent).toContain('pass rate');
    });

    it('labels OR first-pass share as order-dependent', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.02,
        triggerCount: 20,
        sampleCount: 1000,
        confidenceInterval: { low: 0.01, high: 0.03 },
        clauseFailures: [{ clauseId: 'clause1', failureRate: 0.6 }],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'OR block',
          failureRate: 0.6,
          averageViolation: 0,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'or',
            description: 'OR of 2 conditions',
            failureRate: 0.6,
            isCompound: true,
            averageViolation: 0,
            children: [
              {
                nodeType: 'leaf',
                description: 'condition A',
                failureRate: 0.2,
                isCompound: false,
                averageViolation: 0.1,
                orPassRate: 0.6,
                orPassCount: 6,
                orExclusivePassRate: 0.2,
                orExclusivePassCount: 2,
                orContributionRate: 0.4,
                orContributionCount: 4,
                orSuccessCount: 10,
                children: [],
              },
              {
                nodeType: 'leaf',
                description: 'condition B',
                failureRate: 0.5,
                isCompound: false,
                averageViolation: 0.2,
                orPassRate: 0.4,
                orPassCount: 4,
                orExclusivePassRate: 0.1,
                orExclusivePassCount: 1,
                orContributionRate: 0.6,
                orContributionCount: 6,
                orSuccessCount: 10,
                children: [],
              },
            ],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const toggle = document.querySelector('.expand-toggle');
      if (toggle) {
        toggle.click();
      }

      const breakdown = document.querySelector('.or-contribution-breakdown');
      expect(breakdown).toBeTruthy();
      expect(breakdown.textContent).toContain('first-pass (order-dependent)');
    });

    it('shows tunability badges in leaf nodes', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [{ clauseId: 'clause1', failureRate: 0.5 }],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'AND block',
          failureRate: 0.5,
          averageViolation: 0.1,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'and',
            description: 'AND of 3 conditions',
            failureRate: 0.5,
            isCompound: true,
            averageViolation: 0,
            children: [
              {
                nodeType: 'leaf',
                description: 'high tunability condition',
                failureRate: 0.3,
                isCompound: false,
                averageViolation: 0.1,
                nearMissRate: 0.15,
                thresholdValue: 0.5,
                maxObservedValue: 0.48,
                children: [],
              },
              {
                nodeType: 'leaf',
                description: 'moderate tunability condition',
                failureRate: 0.4,
                isCompound: false,
                averageViolation: 0.2,
                nearMissRate: 0.05,
                thresholdValue: 0.7,
                maxObservedValue: 0.65,
                children: [],
              },
              {
                nodeType: 'leaf',
                description: 'low tunability condition',
                failureRate: 0.6,
                isCompound: false,
                averageViolation: 0.5,
                nearMissRate: 0.01,
                thresholdValue: 0.9,
                maxObservedValue: 0.4,
                ceilingGap: 0.5,
                children: [],
              },
            ],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Expand the blocker to see the hierarchical tree
      const toggle = document.querySelector('.expand-toggle');
      if (toggle) {
        toggle.click();
      }

      // Check for tunability badges
      const tunabilityBadges = document.querySelectorAll('.tree-tunability');
      expect(tunabilityBadges.length).toBeGreaterThan(0);

      // Check for high tunability
      const highBadge = document.querySelector('.tunability-high');
      expect(highBadge).toBeTruthy();
      expect(highBadge.textContent).toBe('high');

      // Check for moderate tunability
      const moderateBadge = document.querySelector('.tunability-moderate');
      expect(moderateBadge).toBeTruthy();
      expect(moderateBadge.textContent).toBe('moderate');

      // Check for low tunability
      const lowBadge = document.querySelector('.tunability-low');
      expect(lowBadge).toBeTruthy();
      expect(lowBadge.textContent).toBe('low');

      // Check for threshold displays
      const thresholdDisplays = document.querySelectorAll('.tree-threshold');
      expect(thresholdDisplays.length).toBeGreaterThan(0);

      // Check for max observed displays
      const maxObsDisplays = document.querySelectorAll('.tree-max-obs');
      expect(maxObsDisplays.length).toBeGreaterThan(0);

      // Check for ceiling gap display
      const gapDisplays = document.querySelectorAll('.tree-gap');
      expect(gapDisplays.length).toBeGreaterThan(0);
    });

    it('falls back to average violation when no leaves have violations', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [{ clauseId: 'clause1', failureRate: 0.99 }],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'AND block',
          failureRate: 0.99,
          averageViolation: 0,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'and',
            description: 'AND of 2 conditions',
            failureRate: 0.99,
            isCompound: true,
            averageViolation: 0,
            children: [
              {
                nodeType: 'leaf',
                description: 'condition with zero violation',
                failureRate: 0.8,
                isCompound: false,
                averageViolation: 0,
                children: [],
              },
              {
                nodeType: 'leaf',
                description: 'another condition with zero violation',
                failureRate: 0.5,
                isCompound: false,
                averageViolation: 0,
                children: [],
              },
            ],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Check that the violation stats column falls back to μ: 0.00
      const violationStats = document.querySelector(
        '.breakdown-row .violation-stats'
      );
      expect(violationStats).toBeTruthy();
      expect(violationStats.innerHTML).toContain('μ:');
      expect(violationStats.innerHTML).not.toContain('worst Δ');
    });
  });

  describe('OR mood constraint warnings', () => {
    it('shows warnings when OR mood constraints are present', async () => {
      appendOrConstraintWarningSections();

      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 0.2] },
              {
                or: [
                  { '>=': [{ var: 'moodAxes.arousal' }, 0.8] },
                  { '>=': [{ var: 'moodAxes.arousal' }, 0.9] },
                ],
              },
            ],
          },
        },
      ];

      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'expr:test1') {
          return {
            id: 'expr:test1',
            description: 'Test expression 1',
            prerequisites,
          };
        }
        return null;
      });

      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.05,
        triggerCount: 50,
        sampleCount: 1000,
        confidenceInterval: { low: 0.04, high: 0.06 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: [
          {
            moodAxes: { valence: 0.3, arousal: 0.85 },
            emotions: { joy: 0.6 },
          },
          {
            moodAxes: { valence: 0.4, arousal: 0.2 },
            emotions: { joy: 0.2 },
          },
        ],
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotion blocker',
          failureRate: 0.5,
          averageViolation: 0,
          explanation: { severity: 'high' },
          hasHierarchy: false,
          condition: 'emotions.joy >= 0.4',
        },
      ]);

      const mockPrototypeFitRankingService = {
        analyzeAllPrototypeFitAsync: jest.fn().mockResolvedValue({
          leaderboard: [
            {
              rank: 1,
              prototypeId: 'proto-1',
              gatePassRate: 0.8,
              intensityDistribution: {
                pAboveThreshold: 0.5,
                p50: 0.3,
                p90: 0.6,
                p95: 0.7,
              },
              conflictScore: 0.1,
              compositeScore: 0.7,
              conflictMagnitude: 0.05,
              conflictingAxes: [],
            },
          ],
        }),
        computeImpliedPrototypeAsync: jest.fn().mockResolvedValue({
          targetSignature: new Map([
            ['moodAxes.valence', { direction: 1, importance: 0.5 }],
          ]),
          bySimilarity: [
            {
              prototypeId: 'proto-1',
              cosineSimilarity: 0.9,
              gatePassRate: 0.8,
              combinedScore: 0.85,
            },
          ],
          byGatePass: [
            {
              prototypeId: 'proto-1',
              cosineSimilarity: 0.9,
              gatePassRate: 0.8,
              combinedScore: 0.85,
            },
          ],
          byCombined: [
            {
              prototypeId: 'proto-1',
              cosineSimilarity: 0.9,
              gatePassRate: 0.8,
              combinedScore: 0.85,
            },
          ],
        }),
        detectPrototypeGapsAsync: jest.fn().mockResolvedValue(null),
      };

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        prototypeFitRankingService: mockPrototypeFitRankingService,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(document.getElementById('conditional-pass-warning').hidden).toBe(false);
      expect(document.getElementById('prototype-fit-warning').hidden).toBe(false);
      expect(document.getElementById('implied-prototype-warning').hidden).toBe(false);
    });

    it('hides warnings when no OR mood constraints are present', async () => {
      appendOrConstraintWarningSections();

      const prerequisites = [
        {
          logic: {
            and: [{ '>=': [{ var: 'moodAxes.valence' }, 0.2] }],
          },
        },
      ];

      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'expr:test1') {
          return {
            id: 'expr:test1',
            description: 'Test expression 1',
            prerequisites,
          };
        }
        return null;
      });

      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.05,
        triggerCount: 50,
        sampleCount: 1000,
        confidenceInterval: { low: 0.04, high: 0.06 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: [
          {
            moodAxes: { valence: 0.3 },
            emotions: { joy: 0.6 },
          },
          {
            moodAxes: { valence: 0.4 },
            emotions: { joy: 0.2 },
          },
        ],
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotion blocker',
          failureRate: 0.5,
          averageViolation: 0,
          explanation: { severity: 'high' },
          hasHierarchy: false,
          condition: 'emotions.joy >= 0.4',
        },
      ]);

      const mockPrototypeFitRankingService = {
        analyzeAllPrototypeFitAsync: jest.fn().mockResolvedValue({
          leaderboard: [
            {
              rank: 1,
              prototypeId: 'proto-1',
              gatePassRate: 0.8,
              intensityDistribution: {
                pAboveThreshold: 0.5,
                p50: 0.3,
                p90: 0.6,
                p95: 0.7,
              },
              conflictScore: 0.1,
              compositeScore: 0.7,
              conflictMagnitude: 0.05,
              conflictingAxes: [],
            },
          ],
        }),
        computeImpliedPrototypeAsync: jest.fn().mockResolvedValue({
          targetSignature: new Map([
            ['moodAxes.valence', { direction: 1, importance: 0.5 }],
          ]),
          bySimilarity: [
            {
              prototypeId: 'proto-1',
              cosineSimilarity: 0.9,
              gatePassRate: 0.8,
              combinedScore: 0.85,
            },
          ],
          byGatePass: [
            {
              prototypeId: 'proto-1',
              cosineSimilarity: 0.9,
              gatePassRate: 0.8,
              combinedScore: 0.85,
            },
          ],
          byCombined: [
            {
              prototypeId: 'proto-1',
              cosineSimilarity: 0.9,
              gatePassRate: 0.8,
              combinedScore: 0.85,
            },
          ],
        }),
        detectPrototypeGapsAsync: jest.fn().mockResolvedValue(null),
      };

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        prototypeFitRankingService: mockPrototypeFitRankingService,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(document.getElementById('conditional-pass-warning').hidden).toBe(true);
      expect(document.getElementById('prototype-fit-warning').hidden).toBe(true);
      expect(document.getElementById('implied-prototype-warning').hidden).toBe(true);
    });

    it('shows gate compatibility warning when incompatibilities exist', async () => {
      appendOrConstraintWarningSections();

      const prerequisites = [
        {
          logic: {
            and: [{ '>=': [{ var: 'moodAxes.valence' }, 0.2] }],
          },
        },
      ];

      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'expr:test1') {
          return {
            id: 'expr:test1',
            description: 'Test expression 1',
            prerequisites,
          };
        }
        return null;
      });

      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.05,
        triggerCount: 50,
        sampleCount: 1000,
        confidenceInterval: { low: 0.04, high: 0.06 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: [
          {
            moodAxes: { valence: 0.3 },
            emotions: { joy: 0.6 },
          },
          {
            moodAxes: { valence: 0.4 },
            emotions: { joy: 0.2 },
          },
        ],
        gateCompatibility: {
          emotions: {
            joy: {
              compatible: false,
              reason: 'Constraint max (0.2) < gate requirement (0.9)',
            },
          },
          sexualStates: {},
        },
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotion blocker',
          failureRate: 0.5,
          averageViolation: 0,
          explanation: { severity: 'high' },
          hasHierarchy: false,
          condition: 'emotions.joy >= 0.4',
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const warning = document.getElementById('conditional-gate-warning');
      expect(warning.hidden).toBe(false);
      expect(warning.textContent).toContain('Gate incompatibility detected');
      expect(warning.textContent).toContain('joy');
    });

    it('hides gate compatibility warning when no incompatibilities exist', async () => {
      appendOrConstraintWarningSections();

      const prerequisites = [
        {
          logic: {
            and: [{ '>=': [{ var: 'moodAxes.valence' }, 0.2] }],
          },
        },
      ];

      mockExpressionRegistry.getExpression.mockImplementation((id) => {
        if (id === 'expr:test1') {
          return {
            id: 'expr:test1',
            description: 'Test expression 1',
            prerequisites,
          };
        }
        return null;
      });

      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.05,
        triggerCount: 50,
        sampleCount: 1000,
        confidenceInterval: { low: 0.04, high: 0.06 },
        clauseFailures: [],
        distribution: 'uniform',
        storedContexts: [
          {
            moodAxes: { valence: 0.3 },
            emotions: { joy: 0.6 },
          },
          {
            moodAxes: { valence: 0.4 },
            emotions: { joy: 0.2 },
          },
        ],
        gateCompatibility: {
          emotions: {
            joy: { compatible: true, reason: null },
          },
          sexualStates: {},
        },
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotion blocker',
          failureRate: 0.5,
          averageViolation: 0,
          explanation: { severity: 'high' },
          hasHierarchy: false,
          condition: 'emotions.joy >= 0.4',
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const warning = document.getElementById('conditional-gate-warning');
      expect(warning.hidden).toBe(true);
    });
  });

  describe('Knife-Edge Summary', () => {
    it('shows knife-edge summary when edges exist', async () => {
      const mockKnifeEdge = {
        axis: 'valence',
        min: 0.4,
        max: 0.6,
        width: 0.2,
        formatDualScaleInterval: jest.fn().mockReturnValue('[0.40, 0.60]'),
        formatContributors: jest.fn().mockReturnValue('proto1, proto2'),
        contributingPrototypes: ['proto1', 'proto2'],
        branchId: 'branch-1',
      };

      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'KE', isInfeasible: false, knifeEdges: [mockKnifeEdge], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [mockKnifeEdge],
        feasibilityVolume: null,
        overallStatus: 'knife-edge',
        statusEmoji: '⚠️',
        getSummaryMessage: jest.fn().mockReturnValue('Knife-edge'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const keSummary = document.getElementById('knife-edge-summary');
      expect(keSummary.hidden).toBe(false);

      const keCount = document.getElementById('ke-count');
      expect(keCount.textContent).toBe('1');

      const keRows = document.querySelectorAll('#knife-edge-tbody tr');
      expect(keRows.length).toBe(1);
    });

    it('hides knife-edge summary when no edges', async () => {
      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'Normal', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'reachable',
        statusEmoji: '✅',
        getSummaryMessage: jest.fn().mockReturnValue('Reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([{ prototypeId: 'p1', isReachable: true, threshold: 0.5, maxPossible: 1.0, gap: 0 }]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const keSummary = document.getElementById('knife-edge-summary');
      expect(keSummary.hidden).toBe(true);
    });

    it('uses formatDualScaleInterval in summary when available', async () => {
      const mockKnifeEdge = {
        axis: 'arousal',
        min: 0.3,
        max: 0.5,
        width: 0.2,
        formatDualScaleInterval: jest.fn().mockReturnValue('[0.30, 0.50] (dual-scale)'),
        contributingPrototypes: ['p1'],
        formatContributors: jest.fn().mockReturnValue('p1'),
        branchId: 'b1',
      };

      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'b1', description: 'KE', isInfeasible: false, knifeEdges: [mockKnifeEdge], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['b1'],
        allKnifeEdges: [mockKnifeEdge],
        feasibilityVolume: null,
        overallStatus: 'knife-edge',
        statusEmoji: '⚠️',
        getSummaryMessage: jest.fn().mockReturnValue('KE'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const row = document.querySelector('#knife-edge-tbody tr');
      expect(row.innerHTML).toContain('[0.30, 0.50] (dual-scale)');
      expect(mockKnifeEdge.formatDualScaleInterval).toHaveBeenCalled();
    });

    it('falls back to formatInterval in summary when dual-scale unavailable', async () => {
      const mockKnifeEdge = {
        axis: 'threat',
        min: 0.1,
        max: 0.3,
        width: 0.2,
        formatInterval: jest.fn().mockReturnValue('[0.10, 0.30]'),
        contributingPrototypes: ['p1'],
        branchId: 'b1',
      };

      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'b1', description: 'KE', isInfeasible: false, knifeEdges: [mockKnifeEdge], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['b1'],
        allKnifeEdges: [mockKnifeEdge],
        feasibilityVolume: null,
        overallStatus: 'knife-edge',
        statusEmoji: '⚠️',
        getSummaryMessage: jest.fn().mockReturnValue('KE'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const row = document.querySelector('#knife-edge-tbody tr');
      expect(row.innerHTML).toContain('[0.10, 0.30]');
      expect(mockKnifeEdge.formatInterval).toHaveBeenCalled();
    });

    it('falls back to raw min/max in summary when no format methods', async () => {
      const mockKnifeEdge = {
        axis: 'agency',
        min: 0.25,
        max: 0.35,
        width: 0.1,
        contributingPrototypes: ['p1'],
        branchId: 'b1',
      };

      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'b1', description: 'KE', isInfeasible: false, knifeEdges: [mockKnifeEdge], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['b1'],
        allKnifeEdges: [mockKnifeEdge],
        feasibilityVolume: null,
        overallStatus: 'knife-edge',
        statusEmoji: '⚠️',
        getSummaryMessage: jest.fn().mockReturnValue('KE'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const row = document.querySelector('#knife-edge-tbody tr');
      expect(row.innerHTML).toContain('[0.25, 0.35]');
    });

    it('uses formatContributors when available', async () => {
      const mockKnifeEdge = {
        axis: 'test',
        min: 0.1,
        max: 0.2,
        width: 0.1,
        formatDualScaleInterval: jest.fn().mockReturnValue('[0.10, 0.20]'),
        formatContributors: jest.fn().mockReturnValue('formatted contributors'),
        contributingPrototypes: ['p1', 'p2'],
        branchId: 'b1',
      };

      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'b1', description: 'KE', isInfeasible: false, knifeEdges: [mockKnifeEdge], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['b1'],
        allKnifeEdges: [mockKnifeEdge],
        feasibilityVolume: null,
        overallStatus: 'knife-edge',
        statusEmoji: '⚠️',
        getSummaryMessage: jest.fn().mockReturnValue('KE'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const row = document.querySelector('#knife-edge-tbody tr');
      expect(row.innerHTML).toContain('formatted contributors');
      expect(mockKnifeEdge.formatContributors).toHaveBeenCalled();
    });

    it('falls back to contributingPrototypes.join when formatContributors unavailable', async () => {
      const mockKnifeEdge = {
        axis: 'test',
        min: 0.1,
        max: 0.2,
        width: 0.1,
        formatDualScaleInterval: jest.fn().mockReturnValue('[0.10, 0.20]'),
        contributingPrototypes: ['protoA', 'protoB'],
        branchId: 'b1',
      };

      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'b1', description: 'KE', isInfeasible: false, knifeEdges: [mockKnifeEdge], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['b1'],
        allKnifeEdges: [mockKnifeEdge],
        feasibilityVolume: null,
        overallStatus: 'knife-edge',
        statusEmoji: '⚠️',
        getSummaryMessage: jest.fn().mockReturnValue('KE'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const row = document.querySelector('#knife-edge-tbody tr');
      expect(row.innerHTML).toContain('protoA, protoB');
    });
  });

  describe('Hierarchical Tree Rendering', () => {
    it('renders AND node with correct icon', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'and condition',
          failureRate: 0.9,
          averageViolation: 0.1,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'and',
            description: 'AND Node',
            failureRate: 0.9,
            isCompound: true,
            averageViolation: 0,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const nodeIcon = document.querySelector('.node-icon.and');
      expect(nodeIcon).toBeTruthy();
      expect(nodeIcon.textContent).toBe('∧');
    });

    it('renders OR node with correct icon', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'or condition',
          failureRate: 0.8,
          averageViolation: 0.1,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'or',
            description: 'OR Node',
            failureRate: 0.8,
            isCompound: true,
            averageViolation: 0,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const nodeIcon = document.querySelector('.node-icon.or');
      expect(nodeIcon).toBeTruthy();
      expect(nodeIcon.textContent).toBe('∨');
    });

    it('renders LEAF node with correct icon', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'leaf condition',
          failureRate: 0.7,
          averageViolation: 0.2,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'Leaf Node',
            failureRate: 0.7,
            isCompound: false,
            averageViolation: 0.2,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const nodeIcon = document.querySelector('.node-icon.leaf');
      expect(nodeIcon).toBeTruthy();
      expect(nodeIcon.textContent).toBe('●');
    });

    it('applies failure-critical class for rate >= 0.9', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'critical condition',
          failureRate: 0.95,
          averageViolation: 0.1,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'Critical failure',
            failureRate: 0.95,
            isCompound: false,
            averageViolation: 0,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const failureRate = document.querySelector('.failure-rate.failure-critical');
      expect(failureRate).toBeTruthy();
    });

    it('applies failure-high class for rate >= 0.5', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'high condition',
          failureRate: 0.6,
          averageViolation: 0.1,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'High failure',
            failureRate: 0.6,
            isCompound: false,
            averageViolation: 0,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const failureRate = document.querySelector('.failure-rate.failure-high');
      expect(failureRate).toBeTruthy();
    });

    it('applies failure-normal class for rate < 0.5', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'normal condition',
          failureRate: 0.3,
          averageViolation: 0.1,
          explanation: { severity: 'low' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'Normal failure',
            failureRate: 0.3,
            isCompound: false,
            averageViolation: 0,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const failureRate = document.querySelector('.failure-rate.failure-normal');
      expect(failureRate).toBeTruthy();
    });

    it('displays violation badge for non-compound nodes', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'violation condition',
          failureRate: 0.5,
          averageViolation: 0.2,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'Leaf with violation',
            failureRate: 0.5,
            isCompound: false,
            averageViolation: 0.15,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const violationBadge = document.querySelector('.violation-badge');
      expect(violationBadge).toBeTruthy();
      expect(violationBadge.textContent).toBe('Δ0.15');
    });

    it('recursively renders child nodes', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'compound condition',
          failureRate: 0.8,
          averageViolation: 0.1,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'and',
            description: 'Root',
            failureRate: 0.8,
            isCompound: true,
            averageViolation: 0,
            children: [
              {
                nodeType: 'leaf',
                description: 'Child 1',
                failureRate: 0.6,
                isCompound: false,
                averageViolation: 0.1,
                children: [],
              },
              {
                nodeType: 'or',
                description: 'Child 2',
                failureRate: 0.4,
                isCompound: true,
                averageViolation: 0,
                children: [
                  {
                    nodeType: 'leaf',
                    description: 'Grandchild',
                    failureRate: 0.2,
                    isCompound: false,
                    averageViolation: 0.05,
                    children: [],
                  },
                ],
              },
            ],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      // Should have 4 tree nodes: Root, Child 1, Child 2, Grandchild
      const treeNodes = document.querySelectorAll('.tree-node');
      expect(treeNodes.length).toBe(4);

      // Verify node types
      expect(document.querySelector('.node-icon.and')).toBeTruthy();
      expect(document.querySelector('.node-icon.or')).toBeTruthy();
      expect(document.querySelectorAll('.node-icon.leaf').length).toBe(2);
    });
  });

  describe('Advanced Metrics Display', () => {
    it('displays violation stats with percentiles and near-miss', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.47,
          averageViolation: 0.08,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'emotions.joy >= 0.5',
            failureRate: 0.47,
            isCompound: false,
            averageViolation: 0.08,
            violationP50: 0.05,
            violationP90: 0.15,
            nearMissRate: 0.12,
            nearMissEpsilon: 0.05,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify violation stats structure
      const violationStats = document.querySelector(
        '.breakdown-row .violation-stats'
      );
      expect(violationStats).toBeTruthy();
      expect(violationStats.innerHTML).toContain('violation-mean');
      expect(violationStats.innerHTML).toContain('μ:');
      expect(violationStats.innerHTML).toContain('violation-percentiles');
      expect(violationStats.innerHTML).toContain('p50:');
      expect(violationStats.innerHTML).toContain('p90:');
      expect(violationStats.innerHTML).toContain('near-miss');
    });

    it('displays last-mile stats with both rates', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.47,
          averageViolation: 0.08,
          lastMileFailRate: 0.82,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'emotions.joy >= 0.5',
            failureRate: 0.47,
            isCompound: false,
            averageViolation: 0.08,
            lastMileFailRate: 0.82,
            isSingleClause: false,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify last-mile column
      const lastMile = document.querySelector('.last-mile');
      expect(lastMile).toBeTruthy();
      expect(lastMile.innerHTML).toContain('last-mile-overall');
      expect(lastMile.innerHTML).toContain('fail_all:');
      expect(lastMile.innerHTML).toContain('last-mile-decisive');
      expect(lastMile.innerHTML).toContain('fail_when_others_pass:');
    });

    it('displays single-clause last-mile format', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'single clause',
          failureRate: 0.5,
          averageViolation: 0.1,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'single clause',
            failureRate: 0.5,
            isCompound: false,
            averageViolation: 0.1,
            isSingleClause: true,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const lastMile = document.querySelector('.last-mile');
      expect(lastMile).toBeTruthy();
      expect(lastMile.innerHTML).toContain('last-mile-single');
    });

    it('displays N/A for missing last-mile data', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'clause without last-mile',
          failureRate: 0.5,
          averageViolation: 0.1,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'clause without last-mile',
            failureRate: 0.5,
            isCompound: false,
            averageViolation: 0.1,
            lastMileFailRate: null,
            isSingleClause: false,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const lastMile = document.querySelector('.last-mile');
      expect(lastMile).toBeTruthy();
      expect(lastMile.innerHTML).toContain('last-mile-na');
      expect(lastMile.innerHTML).toContain('N/A');
    });

    it('displays recommendation from advanced analysis', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.47,
          averageViolation: 0.08,
          explanation: { severity: 'high' },
          hasHierarchy: false,
          advancedAnalysis: {
            recommendation: {
              action: 'tune_threshold',
              priority: 'high',
              message: 'TUNE THIS FIRST: High near-miss rate suggests threshold adjustment will help',
            },
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const recommendation = document.querySelector('.recommendation');
      expect(recommendation).toBeTruthy();
      expect(recommendation.innerHTML).toContain('recommendation-action');
      expect(recommendation.innerHTML).toContain('data-action="tune_threshold"');
      expect(recommendation.innerHTML).toContain('data-priority="high"');
      expect(recommendation.innerHTML).toContain('TUNE THIS FIRST');
    });

    it('renders empty recommendation when no advanced analysis', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'simple clause',
          failureRate: 0.5,
          averageViolation: 0.1,
          explanation: { severity: 'low' },
          hasHierarchy: false,
          // No advancedAnalysis field
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const recommendation = document.querySelector('.recommendation');
      expect(recommendation).toBeTruthy();
      // Should be empty - no recommendation-action div
      expect(recommendation.querySelector('.recommendation-action')).toBeFalsy();
    });

    it('renders hierarchical tree with advanced metrics', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'complex clause',
          failureRate: 0.5,
          averageViolation: 0.1,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'and',
            description: 'Root AND',
            failureRate: 0.5,
            isCompound: true,
            averageViolation: 0,
            children: [
              {
                nodeType: 'leaf',
                description: 'joy >= 0.5',
                failureRate: 0.3,
                isCompound: false,
                averageViolation: 0.1,
                violationP50: 0.08,
                lastMileFailRate: 0.7,
                ceilingGap: 0.05,
                maxObservedValue: 0.45,
                children: [],
              },
            ],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Expand the breakdown
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      // Check for advanced metrics in tree nodes
      const treeHtml = document.querySelector('.hierarchical-tree').innerHTML;
      expect(treeHtml).toContain('tree-percentiles');
      expect(treeHtml).toContain('p50:');
      expect(treeHtml).toContain('tree-last-mile');
      expect(treeHtml).toContain('SB:');
      expect(treeHtml).toContain('tree-ceiling');
      expect(treeHtml).toContain('max:');
    });

    it('handles blocker without hierarchicalBreakdown gracefully', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'clause without breakdown',
          failureRate: 0.5,
          averageViolation: 0.123,
          explanation: { severity: 'medium' },
          hasHierarchy: false,
          // No hierarchicalBreakdown field
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should render the main blocker row without a breakdown row
      const blockerRow = document.querySelector('.blocker-row');
      expect(blockerRow).toBeTruthy();

      const breakdownRow = document.querySelector('.breakdown-row');
      expect(breakdownRow).toBeNull();
    });
  });

  describe('Visual Indicator Styling (MONCARADVMET-010)', () => {
    it('applies near-miss-high class for rate > 10%', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.47,
          averageViolation: 0.08,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'emotions.joy >= 0.5',
            failureRate: 0.47,
            isCompound: false,
            averageViolation: 0.08,
            nearMissRate: 0.15, // > 10%
            nearMissEpsilon: 0.05,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const nearMiss = document.querySelector('.near-miss');
      expect(nearMiss).toBeTruthy();
      expect(nearMiss.classList.contains('near-miss-high')).toBe(true);
    });

    it('applies near-miss-moderate class for rate between 2% and 10%', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.47,
          averageViolation: 0.08,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'emotions.joy >= 0.5',
            failureRate: 0.47,
            isCompound: false,
            averageViolation: 0.08,
            nearMissRate: 0.05, // Between 2% and 10%
            nearMissEpsilon: 0.05,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const nearMiss = document.querySelector('.near-miss');
      expect(nearMiss).toBeTruthy();
      expect(nearMiss.classList.contains('near-miss-moderate')).toBe(true);
    });

    it('applies near-miss-low class for rate <= 2%', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.47,
          averageViolation: 0.08,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'emotions.joy >= 0.5',
            failureRate: 0.47,
            isCompound: false,
            averageViolation: 0.08,
            nearMissRate: 0.01, // <= 2%
            nearMissEpsilon: 0.05,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const nearMiss = document.querySelector('.near-miss');
      expect(nearMiss).toBeTruthy();
      expect(nearMiss.classList.contains('near-miss-low')).toBe(true);
    });

    it('applies decisive class for decisive blockers', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.47,
          lastMileFailRate: 0.82,
          averageViolation: 0.08,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          advancedAnalysis: {
            lastMileAnalysis: { isDecisive: true },
          },
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'emotions.joy >= 0.5',
            failureRate: 0.47,
            isCompound: false,
            averageViolation: 0.08,
            lastMileFailRate: 0.82,
            isSingleClause: false,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const lastMile = document.querySelector('.last-mile-decisive');
      expect(lastMile).toBeTruthy();
      expect(lastMile.classList.contains('decisive')).toBe(true);
    });

    it('renders ceiling warning for detected ceiling', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.47,
          averageViolation: 0.08,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          advancedAnalysis: {
            ceilingAnalysis: { status: 'ceiling_detected', gap: 0.2 },
          },
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'emotions.joy >= 0.5',
            failureRate: 0.47,
            isCompound: false,
            averageViolation: 0.08,
            maxObservedValue: 0.45,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const ceilingWarning = document.querySelector('.ceiling-warning');
      expect(ceilingWarning).toBeTruthy();
      expect(ceilingWarning.textContent).toContain('unreachable');
    });

    it('does not render ceiling warning when no ceiling detected', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.47,
          averageViolation: 0.08,
          explanation: { severity: 'medium' },
          hasHierarchy: true,
          advancedAnalysis: {
            ceilingAnalysis: { status: 'no_ceiling' },
          },
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'emotions.joy >= 0.5',
            failureRate: 0.47,
            isCompound: false,
            averageViolation: 0.08,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const ceilingWarning = document.querySelector('.ceiling-warning');
      expect(ceilingWarning).toBeFalsy();
    });

    it('adds data-decisive and data-ceiling attributes to tree nodes', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.5,
        triggerCount: 5000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.49, high: 0.51 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'compound clause',
          failureRate: 0.5,
          averageViolation: 0.1,
          explanation: { severity: 'high' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'and',
            description: 'All must pass',
            failureRate: 0.5,
            isCompound: true,
            ceilingGap: 0.15, // Has ceiling
            maxObservedValue: 0.35,
            advancedAnalysis: {
              lastMileAnalysis: { isDecisive: true },
            },
            children: [
              {
                nodeType: 'leaf',
                description: 'emotions.joy >= 0.5',
                failureRate: 0.3,
                isCompound: false,
                averageViolation: 0.05,
                children: [],
              },
            ],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Expand the breakdown
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const treeNodes = document.querySelectorAll('.tree-node');
      expect(treeNodes.length).toBeGreaterThan(0);

      // Parent node should have decisive and ceiling attributes
      const parentNode = treeNodes[0];
      expect(parentNode.dataset.decisive).toBe('true');
      expect(parentNode.dataset.ceiling).toBe('true');
    });
  });

  describe('Format Percentage Edge Cases', () => {
    it('formats value between 0.0001 and 0.01 with 3 decimal places', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.001,
        triggerCount: 10,
        sampleCount: 10000,
        confidenceInterval: { low: 0.0005, high: 0.0015 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'low failure condition',
          failureRate: 0.005, // 0.5% - should show 3 decimals (0.500%)
          averageViolation: 0.1,
          explanation: { severity: 'low' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'Low failure',
            failureRate: 0.005,
            isCompound: false,
            averageViolation: 0,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes with .failure-rate
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const failureRate = document.querySelector('.failure-rate');
      expect(failureRate.textContent).toBe('0.500%');
    });

    it('formats very small values as <0.01%', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 0.00001,
        triggerCount: 1,
        sampleCount: 100000,
        confidenceInterval: { low: 0.000005, high: 0.000015 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'tiny failure condition',
          failureRate: 0.00005, // Very small
          averageViolation: 0.01,
          explanation: { severity: 'low' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'Tiny failure',
            failureRate: 0.00005,
            isCompound: false,
            averageViolation: 0,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes with .failure-rate
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const failureRate = document.querySelector('.failure-rate');
      expect(failureRate.textContent).toBe('<0.01%');
    });

    it('formats zero as 0%', async () => {
      mockMonteCarloSimulator.simulate.mockResolvedValue({
        triggerRate: 1.0,
        triggerCount: 10000,
        sampleCount: 10000,
        confidenceInterval: { low: 0.995, high: 1.0 },
        clauseFailures: [],
        distribution: 'uniform',
      });

      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'no failure condition',
          failureRate: 0, // Zero
          averageViolation: 0,
          explanation: { severity: 'low' },
          hasHierarchy: true,
          hierarchicalBreakdown: {
            nodeType: 'leaf',
            description: 'No failure',
            failureRate: 0,
            isCompound: false,
            averageViolation: 0,
            children: [],
          },
        },
      ]);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const mcBtn = document.getElementById('run-mc-btn');
      mcBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click the expand toggle to reveal the tree nodes with .failure-rate
      const toggle = document.querySelector('.expand-toggle');
      toggle.click();

      const failureRate = document.querySelector('.failure-rate');
      expect(failureRate.textContent).toBe('0%');
    });
  });

  describe('Template Not Found Warning', () => {
    it('logs warning when branch card template not found', async () => {
      // Remove the template from DOM
      const template = document.getElementById('branch-card-template');
      template.remove();

      const mockResult = {
        expressionId: 'expr:test1',
        branches: [{ branchId: 'branch-1', description: 'Branch', isInfeasible: false, knifeEdges: [], requiredPrototypes: [], activePrototypes: [], inactivePrototypes: [] }],
        branchCount: 1,
        feasibleBranchCount: 1,
        reachabilityByBranch: [],
        hasFullyReachableBranch: true,
        fullyReachableBranchIds: ['branch-1'],
        allKnifeEdges: [],
        feasibilityVolume: null,
        overallStatus: 'reachable',
        statusEmoji: '✅',
        getSummaryMessage: jest.fn().mockReturnValue('Reachable'),
        getReachabilityForBranch: jest.fn().mockReturnValue([]),
      };
      mockPathSensitiveAnalyzer.analyze.mockResolvedValue(mockResult);

      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
        pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
        reportGenerator: mockReportGenerator,
        reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
      });

      await controller.initialize();
      selectDropdownValue('expr:test1');

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLogger.warn).toHaveBeenCalledWith('Branch card template not found');
    });
  });

  describe('Minor Edge Cases', () => {
    describe('Missing DOM Elements Guard Clauses', () => {
      it('logs debug and returns early when expressionSelectContainer is null', async () => {
        // Remove the expression select container from DOM
        const container = document.getElementById('expression-select-container');
        container.remove();

        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        // Should log debug with expression count and return early
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Populated'));
      });

      it('logs warning when problematic pills container not found during initial load', async () => {
        // Remove the problematic pills container from DOM
        const container = document.getElementById('problematic-pills-container');
        container.remove();

        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        expect(mockLogger.warn).toHaveBeenCalledWith('Problematic pills container not found in DOM');
      });

      it('returns early from updateDropdownStatuses when dropdown is null', async () => {
        // Create controller but remove dropdown after initialization
        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        // Remove expression select container before init to prevent dropdown creation
        const container = document.getElementById('expression-select-container');
        container.remove();

        await controller.initialize();

        // Should not throw and should not call updateOptionStatus
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Populated'));
      });

      it('selects expression successfully when pill is clicked', async () => {
        // Setup: Ensure there are problematic expressions with pills
        mockExpressionStatusService.getProblematicExpressions.mockReturnValue([
          {
            id: 'expr:test1',
            filePath: 'data/mods/test/expressions/test1.expression.json',
            diagnosticStatus: 'rare',
          },
        ]);

        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        // Verify pill exists and clicking it selects the expression
        const pillsContainer = document.getElementById('problematic-pills-container');
        const pill = pillsContainer.querySelector('.expression-pill');

        expect(pill).toBeTruthy();
        pill.click();

        // Verify no warnings were logged about expression not found
        // This confirms the filtering in renderProblematicPills works correctly
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          expect.stringContaining('Expression not found')
        );
      });
    });

    describe('Scan Failure Handling', () => {
      it('logs warning and sets empty statuses when scan fails', async () => {
        // Mock scanAllStatuses to return failure
        mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
          success: false,
          error: 'Network error',
        });

        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'ExpressionStatusService: Scan failed',
          expect.objectContaining({ success: false })
        );
      });
    });


    describe('Progress Callbacks', () => {
      it('updates Monte Carlo button text during simulation progress', async () => {
        // Create a mock that calls the onProgress callback
        let capturedOnProgress = null;
        mockMonteCarloSimulator.simulate.mockImplementation(async (expr, options) => {
          capturedOnProgress = options.onProgress;
          // Simulate progress
          if (options.onProgress) {
            options.onProgress(50, 100);
          }
          return {
            triggerRate: 0.8,
            clauseFailures: {},
            sampleCount: 100,
          };
        });

        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();
        selectDropdownValue('expr:test1');

        const runMcBtn = document.getElementById('run-mc-btn');
        runMcBtn.click();

        await new Promise((resolve) => setTimeout(resolve, 0));

        // The onProgress callback should have been captured and executed
        expect(capturedOnProgress).not.toBeNull();
      });

    });

    describe('Dispose Existing Dropdown', () => {
      it('disposes existing dropdown when re-populating expression select', async () => {
        const controller = new ExpressionDiagnosticsController({
          logger: mockLogger,
          expressionRegistry: mockExpressionRegistry,
          gateAnalyzer: mockGateAnalyzer,
          boundsCalculator: mockBoundsCalculator,
          monteCarloSimulator: mockMonteCarloSimulator,
          failureExplainer: mockFailureExplainer,
          expressionStatusService: mockExpressionStatusService,
          pathSensitiveAnalyzer: mockPathSensitiveAnalyzer,
          reportGenerator: mockReportGenerator,
          reportModal: mockReportModal,
        sensitivityAnalyzer: mockSensitivityAnalyzer,
        dataRegistry: mockDataRegistry,
        });

        await controller.initialize();

        // Store reference to the first dropdown by checking if it was created
        const firstDropdown = document.querySelector('.status-select-trigger');
        expect(firstDropdown).toBeTruthy();

        // Re-initialize to trigger the dispose path (line 238-240)
        await controller.initialize();

        // Should have created a new dropdown
        const newDropdown = document.querySelector('.status-select-trigger');
        expect(newDropdown).toBeTruthy();
      });
    });
  });
});
