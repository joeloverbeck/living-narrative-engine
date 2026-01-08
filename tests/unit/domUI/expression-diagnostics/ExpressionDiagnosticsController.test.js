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
      });

      await controller.initialize();

      const select = document.getElementById('expression-select');
      // 1 default option + 2 expressions
      expect(select.options.length).toBe(3);
      expect(select.options[1].value).toBe('expr:test1');
      expect(select.options[2].value).toBe('expr:test2');
    });

    it('logs debug message with expression count', async () => {
      const controller = new ExpressionDiagnosticsController({
        logger: mockLogger,
        expressionRegistry: mockExpressionRegistry,
        gateAnalyzer: mockGateAnalyzer,
        boundsCalculator: mockBoundsCalculator,
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
});
