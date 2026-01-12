/**
 * @file Unit tests for ExpressionDiagnosticsController population summary UI.
 */

import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import ExpressionDiagnosticsController from '../../../../src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js';

const getDropdownContainer = () =>
  document.getElementById('expression-select-container');

const getDropdownOptions = () => {
  const container = getDropdownContainer();
  if (!container) return [];
  return Array.from(container.querySelectorAll('[role="option"]'));
};

const selectDropdownValue = (value) => {
  const options = getDropdownOptions();
  const option = options.find((opt) => opt.dataset.value === value);
  option?.click();
};

const normalizeNumberText = (value) =>
  String(value || '').replace(/[^\d]/g, '');

describe('ExpressionDiagnosticsController population summary', () => {
  let controller;
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
    document.body.innerHTML = `
      <label id="expression-select-label" for="expression-select">Select Expression:</label>
      <div id="expression-select-container" class="status-select-container"></div>
      <p id="expression-description"></p>
      <section class="panel status-summary-centered">
        <div id="status-indicator" class="status-indicator status-unknown">
          <span class="status-circle-large status-circle status-unknown"></span>
          <span class="status-label">Unknown</span>
        </div>
        <p id="status-message"></p>
      </section>
      <section class="panel static-analysis-panel">
        <div class="section-action-button">
          <button id="run-static-btn" class="action-button" disabled>Run Static Analysis</button>
        </div>
        <div id="static-results">
          <p class="placeholder-text">Run static analysis to see results.</p>
        </div>
      </section>
      <section id="gate-conflicts-section" hidden>
        <table id="gate-conflicts-table"><tbody></tbody></table>
      </section>
      <section id="thresholds-section" hidden>
        <table id="thresholds-table"><tbody></tbody></table>
      </section>
      <section class="panel problematic-expressions-panel">
        <div id="problematic-pills-container" class="pills-container">
          <p class="placeholder-text">Loading...</p>
        </div>
      </section>
      <section id="monte-carlo-section">
        <select id="sample-count">
          <option value="1000">1,000</option>
          <option value="10000" selected>10,000</option>
        </select>
        <select id="distribution">
          <option value="uniform" selected>Uniform</option>
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
          <div id="mc-population-summary" hidden>
            <span id="mc-population-sample-count">--</span>
            <span id="mc-population-in-regime-sample-count">--</span>
            <span id="mc-population-stored-count">--</span>
            <span id="mc-population-stored-in-regime-count">--</span>
            <span id="mc-population-stored-limit">--</span>
          </div>
          <table id="blockers-table">
            <tbody id="blockers-tbody"></tbody>
          </table>
          <div class="mc-results-actions">
            <button id="generate-report-btn">Generate Report</button>
          </div>
          <div id="mc-sampling-coverage" class="mc-sampling-coverage-container" hidden>
            <p class="sampling-coverage-summary"></p>
            <div class="sampling-coverage-tables"></div>
            <div class="sampling-coverage-conclusions" hidden>
              <ul class="sampling-coverage-conclusions-list"></ul>
            </div>
          </div>
        </div>
      </section>
      <section id="global-sensitivity" hidden>
        <p class="population-label" data-population-role="stored-contexts"></p>
        <div id="global-sensitivity-tables"></div>
      </section>
      <section id="conditional-pass-rates" hidden>
        <p class="population-label" data-population-role="stored-contexts"></p>
        <div id="conditional-pass-warning" hidden></div>
        <div id="conditional-gate-warning" hidden></div>
        <div id="conditional-pass-rates-content"></div>
      </section>
      <section id="last-mile-decomposition" hidden>
        <p class="population-label" data-population-role="stored-contexts"></p>
        <div id="last-mile-decomposition-content"></div>
      </section>
      <section id="prototype-fit-analysis" hidden>
        <p class="population-label" data-population-role="stored-contexts"></p>
        <table><tbody id="prototype-fit-tbody"></tbody></table>
        <div id="prototype-fit-details"></div>
        <div id="prototype-fit-suggestion"></div>
        <div id="prototype-fit-warning" hidden></div>
      </section>
      <section id="implied-prototype" hidden>
        <p class="population-label" data-population-role="stored-contexts"></p>
        <table><tbody id="target-signature-tbody"></tbody></table>
        <table><tbody id="similarity-ranking-tbody"></tbody></table>
        <table><tbody id="gate-pass-ranking-tbody"></tbody></table>
        <table><tbody id="combined-ranking-tbody"></tbody></table>
        <div id="implied-prototype-warning" hidden></div>
      </section>
      <section id="gap-detection" hidden>
        <p class="population-label" data-population-role="stored-contexts"></p>
        <div id="gap-status"></div>
        <table><tbody id="nearest-prototypes-tbody"></tbody></table>
        <div id="suggested-prototype-content"></div>
      </section>
    `;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const expression = {
      id: 'expr:test',
      description: 'Test expression',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 10] },
            ],
          },
        },
      ],
      _sourceFile: 'expr.json',
      _modId: 'test-mod',
    };

    mockExpressionRegistry = {
      getAllExpressions: jest.fn().mockReturnValue([expression]),
      getExpression: jest.fn().mockReturnValue(expression),
    };

    mockGateAnalyzer = {
      analyze: jest.fn().mockReturnValue({ conflicts: [], axisIntervals: {} }),
    };

    mockBoundsCalculator = {
      analyzeExpression: jest.fn().mockReturnValue([]),
    };

    mockMonteCarloSimulator = {
      simulate: jest.fn().mockResolvedValue({
        triggerRate: 0.1,
        triggerCount: 1000,
        sampleCount: 10000,
        inRegimeSampleCount: 32,
        confidenceInterval: { low: 0.08, high: 0.12 },
        clauseFailures: [],
        distribution: 'uniform',
        samplingMode: 'static',
        witnessAnalysis: { witnesses: [] },
        storedContexts: [{ moodAxes: { valence: 12 } }],
        populationSummary: {
          sampleCount: 10000,
          inRegimeSampleCount: 32,
          storedContextCount: 1000,
          storedContextLimit: 10000,
          storedInRegimeCount: 3,
        },
      }),
    };

    mockFailureExplainer = {
      analyzeHierarchicalBlockers: jest.fn().mockReturnValue([]),
      generateSummary: jest.fn().mockReturnValue('Summary'),
    };

    mockExpressionStatusService = {
      scanAllStatuses: jest.fn().mockResolvedValue({
        success: true,
        expressions: [
          {
            id: 'expr:test',
            filePath: 'data/mods/test-mod/expressions/expr.json',
            diagnosticStatus: 'unknown',
          },
        ],
      }),
      updateStatus: jest.fn().mockResolvedValue({ success: true }),
      getProblematicExpressions: jest.fn().mockReturnValue([]),
    };

    mockPathSensitiveAnalyzer = {
      analyze: jest.fn().mockReturnValue(null),
    };

    mockReportGenerator = {
      generate: jest.fn().mockReturnValue(''),
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
      getLookupData: jest.fn().mockReturnValue(null),
    };

    controller = new ExpressionDiagnosticsController({
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders population summary counts and stored-context labels after simulation', async () => {
    await controller.initialize();

    selectDropdownValue('expr:test');

    const runMcBtn = document.getElementById('run-mc-btn');
    runMcBtn.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    const summary = document.getElementById('mc-population-summary');
    expect(summary.hidden).toBe(false);

    expect(normalizeNumberText(
      document.getElementById('mc-population-sample-count').textContent
    )).toBe('10000');
    expect(normalizeNumberText(
      document.getElementById('mc-population-in-regime-sample-count').textContent
    )).toBe('32');
    expect(normalizeNumberText(
      document.getElementById('mc-population-stored-count').textContent
    )).toBe('1000');
    expect(normalizeNumberText(
      document.getElementById('mc-population-stored-in-regime-count').textContent
    )).toBe('3');
    expect(normalizeNumberText(
      document.getElementById('mc-population-stored-limit').textContent
    )).toBe('10000');

    const labels = Array.from(
      document.querySelectorAll('[data-population-role="stored-contexts"]')
    );
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.textContent).toContain('Population: stored contexts');
      expect(normalizeNumberText(label.textContent)).toContain('1000');
      expect(normalizeNumberText(label.textContent)).toContain('10000');
    }
  });
});
