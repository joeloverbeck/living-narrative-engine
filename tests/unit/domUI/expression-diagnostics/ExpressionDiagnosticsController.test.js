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

describe('ExpressionDiagnosticsController', () => {
  let mockLogger;
  let mockExpressionRegistry;
  let mockGateAnalyzer;
  let mockBoundsCalculator;
  let mockMonteCarloSimulator;
  let mockFailureExplainer;
  let mockExpressionStatusService;

  beforeEach(() => {
    // Set up the DOM structure directly in Jest's jsdom environment
    document.body.innerHTML = `
      <select id="expression-select">
        <option value="">-- Select --</option>
      </select>
      <p id="expression-description"></p>
      <button id="run-static-btn" disabled>Run Static Analysis</button>
      <div id="status-indicator" class="status-indicator status-unknown">
        <span class="status-emoji">⚪</span>
        <span class="status-label">Not Analyzed</span>
      </div>
      <p id="status-message"></p>
      <div id="static-results">
        <p class="placeholder-text">Run static analysis to see results.</p>
      </div>
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
            <span class="rarity-emoji"></span>
            <span class="rarity-label"></span>
          </div>
          <span id="mc-trigger-rate">--</span>
          <span id="mc-confidence-interval">(-- - --)</span>
          <p id="mc-summary"></p>
          <table id="blockers-table">
            <tbody id="blockers-tbody"></tbody>
          </table>
        </div>
      </section>
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
        });
      }).not.toThrow();
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      // 1 default option + 2 expressions
      expect(select.options.length).toBe(3);
      expect(select.options[1].value).toBe('expr:test1');
      expect(select.options[2].value).toBe('expr:test2');
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      expect(select.options[1].value).toBe('expr:alpha');
      expect(select.options[2].value).toBe('expr:beta');
      expect(select.options[3].value).toBe('expr:zeta');
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      const runBtn = document.getElementById('run-static-btn');

      expect(runBtn.disabled).toBe(true);

      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      const runBtn = document.getElementById('run-static-btn');

      // Select an expression
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));
      expect(runBtn.disabled).toBe(false);

      // Clear selection
      select.value = '';
      select.dispatchEvent(new Event('change'));
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:no-desc';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      const runBtn = document.getElementById('run-static-btn');

      select.value = 'expr:nonexistent';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      // Select expression
      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const indicator = document.getElementById('status-indicator');
      expect(indicator.classList.contains('status-unknown')).toBe(true);

      const emoji = indicator.querySelector('.status-emoji');
      expect(emoji.textContent).toBe('⚪');
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      // Change to a different expression
      select.value = 'expr:test2';
      select.dispatchEvent(new Event('change'));

      const indicator = document.getElementById('status-indicator');
      expect(indicator.classList.contains('status-unknown')).toBe(true);
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      // Verify sections are visible
      expect(
        document.getElementById('gate-conflicts-section').hidden
      ).toBe(false);

      // Select different expression
      select.value = 'expr:test2';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runBtn = document.getElementById('run-static-btn');
      runBtn.click();

      // Change expression
      select.value = 'expr:test2';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      const runMcBtn = document.getElementById('run-mc-btn');

      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      const runMcBtn = document.getElementById('run-mc-btn');

      // Select then clear
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));
      expect(runMcBtn.disabled).toBe(false);

      select.value = '';
      select.dispatchEvent(new Event('change'));
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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

    it('shows MC results container after simulation', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
        monteCarloSimulator: mockMonteCarloSimulator,
        failureExplainer: mockFailureExplainer,
        expressionStatusService: mockExpressionStatusService,
      });

      await controller.initialize();

      const mcResults = document.getElementById('mc-results');
      expect(mcResults.hidden).toBe(true);

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      expect(mcResults.hidden).toBe(false);
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const indicator = document.getElementById('mc-rarity-indicator');
      expect(indicator.classList.contains('rarity-normal')).toBe(true);
    });

    it('applies impossible rarity class for 0% rate', async () => {
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const indicator = document.getElementById('mc-rarity-indicator');
      expect(indicator.classList.contains('rarity-impossible')).toBe(true);
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const indicator = document.getElementById('mc-rarity-indicator');
      expect(indicator.classList.contains('rarity-frequent')).toBe(true);
    });

    it('populates blockers table when blockers exist', async () => {
      mockFailureExplainer.analyzeHierarchicalBlockers.mockReturnValue([
        {
          rank: 1,
          clauseDescription: 'arousal >= 0.8',
          failureRate: 0.6,
          averageViolation: 0.25,
          explanation: { severity: 'high' },
        },
        {
          rank: 2,
          clauseDescription: 'valence <= 0.3',
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const tbody = document.getElementById('blockers-tbody');
      expect(tbody.querySelectorAll('tr').length).toBe(2);
      expect(tbody.innerHTML).toContain('arousal &gt;= 0.8');
      expect(tbody.innerHTML).toContain('severity-high');
      expect(tbody.innerHTML).toContain('severity-medium');
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      const mcResults = document.getElementById('mc-results');
      expect(mcResults.hidden).toBe(false);

      // Change expression
      select.value = 'expr:test2';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      const emoji = statusIndicator.querySelector('.status-emoji');
      expect(emoji.textContent).toBe('🔵');
      const label = statusIndicator.querySelector('.status-label');
      expect(label.textContent).toBe('Frequent');
    });

    it('updates Status Summary to show impossible when Monte Carlo rate is 0%', async () => {
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      // Run static analysis first
      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Run Monte Carlo
      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      // Verify Status Summary updated to impossible
      const statusIndicator = document.getElementById('status-indicator');
      expect(statusIndicator.classList.contains('status-impossible')).toBe(true);
      const emoji = statusIndicator.querySelector('.status-emoji');
      expect(emoji.textContent).toBe('🔴');
      const label = statusIndicator.querySelector('.status-label');
      expect(label.textContent).toBe('Impossible');
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      const emoji = statusIndicator.querySelector('.status-emoji');
      expect(emoji.textContent).toBe('🟢');
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      // Both should show 'rare' (rate < 0.05%)
      const statusIndicator = document.getElementById('status-indicator');
      const mcRarityIndicator = document.getElementById('mc-rarity-indicator');

      expect(statusIndicator.classList.contains('status-rare')).toBe(true);
      expect(mcRarityIndicator.classList.contains('rarity-rare')).toBe(true);

      const statusEmoji = statusIndicator.querySelector('.status-emoji');
      const mcEmoji = mcRarityIndicator.querySelector('.rarity-emoji');
      expect(statusEmoji.textContent).toBe('🟡');
      expect(mcEmoji.textContent).toBe('🟡');

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;

      // Verify Status Summary updated to extremely-rare (rate < 0.001%)
      const statusIndicator = document.getElementById('status-indicator');
      expect(statusIndicator.classList.contains('status-extremely-rare')).toBe(true);
      const emoji = statusIndicator.querySelector('.status-emoji');
      expect(emoji.textContent).toBe('🟠');
      const label = statusIndicator.querySelector('.status-label');
      expect(label.textContent).toBe('Extremely Rare');
    });
  });

  describe('Problematic Expressions Panel', () => {
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
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      expect(pillsContainer.innerHTML).toContain('All expressions have normal or frequent status');
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
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      pill.click();

      const select = document.getElementById('expression-select');
      expect(select.value).toBe('expr:test1');
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
          id: 'emotions-sexuality:self_disgust_arousal',
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
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      pill.click();

      const select = document.getElementById('expression-select');
      expect(select.value).toBe('self_disgust_arousal');

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
      });

      await controller.initialize();

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      expect(pill).toBeNull();
      expect(pillsContainer.innerHTML).toContain(
        'All expressions have normal or frequent status.'
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
      });

      await controller.initialize();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load problematic expressions:',
        expect.any(Error)
      );

      const pillsContainer = document.getElementById('problematic-pills-container');
      expect(pillsContainer.innerHTML).toContain('Failed to load expression statuses');
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
      });

      await controller.initialize();

      // Should log warning about using fallback
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('using registry fallback')
      );

      // Should NOT show "All expressions have normal or frequent status"
      const pillsContainer = document.getElementById('problematic-pills-container');
      expect(pillsContainer.innerHTML).not.toContain(
        'All expressions have normal or frequent status'
      );

      // Should show pills for expressions with unknown status
      const pills = pillsContainer.querySelectorAll('.expression-pill');
      expect(pills.length).toBeGreaterThan(0);
    });
  });

  describe('Status persistence', () => {
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations
      await Promise.resolve();

      expect(mockExpressionStatusService.updateStatus).toHaveBeenCalledWith(
        'data/mods/test/test1.expression.json',
        expect.any(String)
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runMcBtn = document.getElementById('run-mc-btn');
      runMcBtn.click();

      // Wait for async simulation to complete
      await mockMonteCarloSimulator.simulate.mock.results[0]?.value;
      await Promise.resolve();

      expect(mockExpressionStatusService.updateStatus).toHaveBeenCalledWith(
        'data/mods/test/test1.expression.json',
        expect.any(String)
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      await Promise.resolve();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot persist status: no file path')
      );
      expect(mockExpressionStatusService.updateStatus).not.toHaveBeenCalled();
    });

    it('refreshes panel after status persistence', async () => {
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
      });

      await controller.initialize();

      // Reset the call count after initialize
      mockExpressionStatusService.scanAllStatuses.mockClear();
      mockExpressionStatusService.getProblematicExpressions.mockClear();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations
      await Promise.resolve();
      await Promise.resolve();

      // Panel should be refreshed after persistence
      expect(mockExpressionStatusService.scanAllStatuses).toHaveBeenCalled();
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'positioning:sit_down';
      select.dispatchEvent(new Event('change'));

      const runStaticBtn = document.getElementById('run-static-btn');
      runStaticBtn.click();

      // Wait for async operations
      await Promise.resolve();
      await Promise.resolve();

      // Should construct path from metadata and call updateStatus
      expect(mockExpressionStatusService.updateStatus).toHaveBeenCalledWith(
        'data/mods/positioning/expressions/sit_down.expression.json',
        expect.any(String)
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'core:test_expr';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'orphan:no_metadata';
      select.dispatchEvent(new Event('change'));

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
  });

  describe('Event dispatch consistency (regression tests)', () => {
    it('pill click dispatches change event on dropdown', async () => {
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      const changeHandler = jest.fn();
      select.addEventListener('change', changeHandler);

      const pillsContainer = document.getElementById('problematic-pills-container');
      const pill = pillsContainer.querySelector('.expression-pill');
      pill.click();

      // The change event should have been dispatched
      expect(changeHandler).toHaveBeenCalled();
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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      select.value = 'expr:test1';
      select.dispatchEvent(new Event('change'));

      const runMcBtn = document.getElementById('run-mc-btn');

      // Click and await the result - button click should wait for async
      runMcBtn.click();

      // Give enough time for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // updateStatus should have been called and completed
      expect(operationOrder).toContain('updateStatus-start');
      expect(operationOrder).toContain('updateStatus-end');
    });
  });
});
